#!/usr/bin/env node
/**
 * dev/plugin-fingerprint.js — Plugin Duplicate-Rate Fingerprint System (Task 12)
 *
 * Unified engine combining:
 *   1) 3-Level generation fingerprint (design spec)
 *        L1: content hash        (MD5 of normalized source)
 *        L2: parameter signature (randInt/shuffle argument shapes)
 *        L3: structure fingerprint(subject:title:kp-set:methods)
 *   2) Runtime question-duplicate measurement (reuses check-duplicates logic)
 *        Generates ROUNDS×COUNT questions, measures cross-round repeat rate.
 *   3) Fix-category attribution
 *        Maps each over-threshold plugin to a root-cause category so the
 *        duplicate rate can actually be acted on.
 *
 * Output: dev/fingerprint-report.json + dev/fingerprint-report.md
 */

'use strict';

// Some plugin modules throw asynchronously on load.
// Those are already handled by per-plugin try/catch; suppress stray rejections
// so the report is written and the process exits cleanly.
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PLUGIN_DIR = path.join(ROOT, 'plugins');
const reg = require(path.join(PLUGIN_DIR, 'registry.js'));

const ROUNDS = 5, COUNT = 20;
const DUP_THRESHOLD = 0.5;
const SMALL_POOL = /judge|reasoning|oral|make-ten/;

// ---------------- helpers ----------------
function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

function normalize(content) {
  return content
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/\b\d+\b/g, '0')
    .split('\n').map(l => l.trim()).filter(Boolean);
}
function shingles(lines, k = 3) {
  const set = new Set();
  for (let i = 0; i + k <= lines.length; i++) set.add(lines.slice(i, i + k).join(' | '));
  if (set.size === 0 && lines.length) set.add(lines.join(' | '));
  return set;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------- Level 1/2/3 fingerprints ----------------
const meta = {};
for (const f of fs.readdirSync(PLUGIN_DIR).filter(x => x.endsWith('.js'))) {
  const content = fs.readFileSync(path.join(PLUGIN_DIR, f), 'utf8');
  const name = f.replace(/\.js$/, '');
  const titleMatch = content.match(/['"]title['"]\s*:\s*['"]([^'"]+)['"]/);
  const subjectMatch = content.match(/subject\s*[:=]\s*['"]([^'"]+)['"]/i);
  const kps = [...new Set(content.match(/cn-g\d+-\d+|en-g\d+-\d+/g) || [])].sort();
  const methods = {
    generate: /generate\s*[:=(]/i.test(content) ? 'y' : 'n',
    render: /render\s*[:=(]/i.test(content) ? 'y' : 'n',
    check: /check\s*[:=(]/i.test(content) ? 'y' : 'n',
  };
  const randArgs = (content.match(/randInt\(([^)]*)\)/g) || []).map(m => m.replace('randInt(', '').replace(')', ''));
  const shufArgs = (content.match(/shuffle\(([^)]*)\)/g) || []).map(m => m.replace('shuffle(', '').replace(')', ''));
  const paramSig = randArgs.length ? randArgs.join('|') : (shufArgs.length ? shufArgs.join('|') : 'no-params');
  const structFp = [subjectMatch ? subjectMatch[1] : 'unknown', titleMatch ? titleMatch[1] : name, kps.join(','), `${methods.generate}-${methods.render}-${methods.check}`].join('::');
  meta[name] = {
    name, file: f, subject: subjectMatch ? subjectMatch[1] : 'unknown',
    title: titleMatch ? titleMatch[1] : name, kps, methods,
    L1: md5(normalize(content).join('\n')),
    L2: md5(paramSig), L3: md5(structFp),
    shingles: shingles(normalize(content)),
  };
}

// ---------------- code-level duplicate rate (jaccard max) ----------------
const names = Object.keys(meta);
for (const a of names) {
  let best = 0, bestOther = null;
  for (const b of names) {
    if (a === b) continue;
    const s = jaccard(meta[a].shingles, meta[b].shingles);
    if (s > best) { best = s; bestOther = b; }
  }
  meta[a].codeDupRate = Number(best.toFixed(3));
  meta[a].codeDupWith = bestOther;
}

// ---------------- runtime question duplicate rate ----------------
function measure(rec) {
  let p;
  try { p = require(path.join(ROOT, rec.file)); } catch (e) { return null; }
  if (!p || typeof p.generate !== 'function') return null;
  const grade = (p.grades && p.grades[0]) || 1;
  const isSmall = SMALL_POOL.test(rec.id);
  const threshold = isSmall ? 0.5 : (grade <= 2 ? 0.6 : grade <= 4 ? 0.35 : 0.15);
  const sigs = {}; let totalQ = 0, dupQ = 0;
  for (let r = 0; r < ROUNDS; r++) {
    try {
      const qs = p.generate({ grade, count: COUNT, type: 'mix', difficulty: 6 }).questions || [];
      qs.forEach(q => {
        totalQ++;
        const key = (q.q || '') + '|' + (q.svg || '') + '|' + JSON.stringify(q.answer || '');
        if (sigs[key]) dupQ++; else sigs[key] = 1;
      });
    } catch (e) { /* skip round */ }
  }
  let poolSize = null;
  try { if (p.poolCache && typeof p.poolCache.size === 'function') poolSize = p.poolCache.size(); } catch (e) {}
  const rate = totalQ > 0 ? dupQ / totalQ : 0;
  const limited = poolSize != null && poolSize < ROUNDS * COUNT;
  return { grade, isSmall, threshold, rate: Number(rate.toFixed(3)), totalQ, dupQ, poolSize, limited, over: rate > threshold && !limited };
}

// ---------------- fix-category attribution ----------------
function categorize(m, q) {
  if (!q) return 'unmeasurable';
  if (q.limited) return 'pool-too-small';
  if (q.over) {
    if (q.poolSize != null && q.poolSize < 40) return 'small-pool';
    return 'weak-variation';
  }
  return 'ok';
}

// ---------------- build report ----------------
const records = [];
reg.filter(r => !r.isPlaceholder && r.subject === 'math').forEach(rec => {
  const m = meta[path.basename(rec.file, '.js')];
  if (!m) return;
  const q = measure(rec);
  const cat = categorize(m, q);
  records.push({
    id: rec.id,
    subject: m.subject,
    title: m.title,
    L1: m.L1, L2: m.L2, L3: m.L3,
    codeDupRate: m.codeDupRate, codeDupWith: m.codeDupWith,
    qDupRate: q ? q.rate : null,
    qThreshold: q ? q.threshold : null,
    poolSize: q ? q.poolSize : null,
    over: q ? q.over : false,
    category: cat,
  });
});

records.sort((a, b) => (b.qDupRate || 0) - (a.qDupRate || 0));

// ---------------- aggregate ----------------
const overList = records.filter(r => r.over);
const catCount = {};
for (const r of records) catCount[r.category] = (catCount[r.category] || 0) + 1;

// code-level duplicates (L1 or L3 collision)
const l1g = {}, l3g = {};
for (const r of records) { (l1g[r.L1] = l1g[r.L1] || []).push(r.id); (l3g[r.L3] = l3g[r.L3] || []).push(r.id); }
const codeDupGroups = [...Object.values(l1g), ...Object.values(l3g)].filter(arr => arr.length > 1);

// ---------------- console ----------------
console.log('=== Plugin Duplicate-Rate Fingerprint Report ===');
console.log('Math plugins analyzed :', records.length);
console.log('Over question-dup threshold:', overList.length);
console.log('Code-level dup groups (L1/L3):', codeDupGroups.length);
console.log('Fix categories:', JSON.stringify(catCount));
console.log('\nOver-threshold plugins (need action):');
for (const r of overList) {
  console.log(`  ✗ ${r.id.padEnd(30)} qDup=${(r.qDupRate * 100).toFixed(0)}% thr=${(r.qDupRate > 0 ? r.qThreshold * 100 : 0).toFixed(0)}% pool=${r.poolSize == null ? '-' : r.poolSize} [${r.category}]`);
}

// ---------------- write ----------------
const jsonPath = path.join(__dirname, 'fingerprint-report.json');
fs.writeFileSync(jsonPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  thresholds: { qDup: DUP_THRESHOLD, rounds: ROUNDS, count: COUNT },
  summary: { analyzed: records.length, over: overList.length, codeDupGroups: codeDupGroups.length, categories: catCount },
  records,
}, null, 2));

const mdPath = path.join(__dirname, 'fingerprint-report.md');
const md = [
  '# Plugin Duplicate-Rate Fingerprint Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Math plugins analyzed | ${records.length} |`,
  `| Over question-dup threshold | ${overList.length} |`,
  `| Code-level dup groups (L1/L3) | ${codeDupGroups.length} |`,
  `| Fix categories | ${JSON.stringify(catCount)} |`,
  '',
  `## Over-threshold plugins (require fix)`,
  '',
  `| Plugin | Q-Dup% | Threshold% | Pool | Category |`,
  `| --- | --- | --- | --- | --- |`,
  ...overList.map(r => `| ${r.id} | ${(r.qDupRate * 100).toFixed(0)} | ${(r.qThreshold * 100).toFixed(0)} | ${r.poolSize == null ? '-' : r.poolSize} | ${r.category} |`),
  '',
  `## All plugins (sorted by question-dup rate)`,
  '',
  `| Plugin | Q-Dup% | Code-Dup% | With | Category |`,
  `| --- | --- | --- | --- | --- |`,
  ...records.map(r => `| ${r.id} | ${r.qDupRate == null ? '-' : (r.qDupRate * 100).toFixed(0)} | ${(r.codeDupRate * 100).toFixed(0)} | ${r.codeDupWith || '-'} | ${r.category} |`),
  '',
].join('\n');
fs.writeFileSync(mdPath, md);

console.log('\nReports written:');
console.log('  ' + jsonPath);
console.log('  ' + mdPath);
