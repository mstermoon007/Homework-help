#!/usr/bin/env node
/**
 * dev/check-snapshot.js — 题目结构 Snapshot 基线（M0-03）
 *
 * 对每个代表 Case 生成题目，记录「结构不变量」快照（与随机内容无关，可重复）：
 *   qCount / allHaveAnswer / allHaveRender / allHaveCheck / allHaveType /
 *   anySvg / anyKpId
 *
 * 规则遵守：
 *   - 不依赖随机内容稳定性（不比对随机数值/题干）。
 *   - 当前系统无统一 seed，本脚本不修改任何业务随机机制。
 *   - 首次运行写入基线 tests/snapshot/snapshot.json；之后运行比对，结构漂移即报错。
 *
 * 直接比对数值的 qCount 为确定性（生成题量 = 请求量），纳入快照。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
const regMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));
const SNAP_FILE = path.join(ROOT, 'tests', 'snapshot', 'snapshot.json');

const errors = [];
const warnings = [];

const SNAP_CASES = [
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'add', difficulty: 3, count: 6 },
  { subject: 'math', grade: 2, pluginId: 'math-oral', type: 'muldiv', difficulty: 5, count: 6 },
  { subject: 'math', grade: 3, pluginId: 'math-oral', type: 'add', difficulty: 7, count: 6 },
  { subject: 'math', grade: 1, pluginId: 'math-make-ten', type: '', difficulty: 3, count: 6 },
  { subject: 'math', grade: 1, pluginId: 'math-shapes', type: '', difficulty: 3, count: 5 },
  { subject: 'math', grade: 2, pluginId: 'math-g2-column', type: '', difficulty: 5, count: 6 },
  { subject: 'math', grade: 3, pluginId: 'math-fraction', type: '', difficulty: 6, count: 5 },
  { subject: 'math', grade: 2, pluginId: 'math-comprehensive', type: '', difficulty: 4, count: 10 },
  { subject: 'chinese', grade: 1, pluginId: 'chinese-pinyin', type: '', difficulty: 3, count: 5 }
];

function metricsOf(set) {
  const qs = set.questions || [];
  let allHaveAnswer = true, allHaveRender = true, allHaveCheck = true, allHaveType = true;
  let anySvg = false, anyKpId = false;
  qs.forEach(function (q) {
    if (q.answer == null) allHaveAnswer = false;
    if (typeof q.render !== 'function' && !(q.q || q.text || q.question || q.rawHtml)) allHaveRender = false;
    if (typeof q.check !== 'function') allHaveCheck = false;
    if (!q.type) allHaveType = false;
    if (q.svg) anySvg = true;
    if (q.knowledgePointId) anyKpId = true;
  });
  return {
    qCount: qs.length,
    allHaveAnswer: allHaveAnswer,
    allHaveRender: allHaveRender,
    allHaveCheck: allHaveCheck,
    allHaveType: allHaveType,
    anySvg: anySvg,
    anyKpId: anyKpId
  };
}

// 仅比较「与随机内容无关」的确定性结构不变量（满足 M0-03：随机内容不得导致测试不稳定）。
// anySvg / anyKpId 受随机选题影响，仅作记录、不参与漂移判定。
const COMPARE_KEYS = ['qCount', 'allHaveAnswer', 'allHaveRender', 'allHaveCheck', 'allHaveType'];

function keyOf(c) { return [c.pluginId, c.grade, c.type || '', c.difficulty].join('|'); }

function runCase(c) {
  const entry = regMod.getEntry(c.pluginId);
  if (!entry) { errors.push('[snapshot] ' + c.pluginId + ' 未注册'); return Promise.resolve(null); }
  const loadRes = loader.loadPlugin(entry);
  if (loadRes.error || !loadRes.plugin) { errors.push('[snapshot] ' + c.pluginId + ' 加载失败: ' + loadRes.error); return Promise.resolve(null); }
  const plugin = loadRes.plugin;
  const opts = { grade: c.grade, count: c.count, difficulty: c.difficulty };
  if (c.type) opts.type = c.type;
  const res = plugin.generate(opts);
  if (res && typeof res.then === 'function') {
    return res.then(metricsOf).catch(function (e) { errors.push('[snapshot] ' + c.pluginId + ' 异步失败: ' + e.message); return null; });
  }
  try { return Promise.resolve(metricsOf(res)); } catch (e) { errors.push('[snapshot] ' + c.pluginId + ' 异常: ' + e.message); return Promise.resolve(null); }
}

function run() {
  errors.length = 0; warnings.length = 0;
  const promises = SNAP_CASES.map(runCase);
  return Promise.all(promises).then(function (metricsList) {
    const current = {};
    SNAP_CASES.forEach(function (c, i) {
      const m = metricsList[i];
      if (m) current[keyOf(c)] = m;
    });

    let baseline = null;
    if (fs.existsSync(SNAP_FILE)) {
      try { baseline = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8')); } catch (e) { warnings.push('[snapshot] 基线文件损坏，已忽略: ' + e.message); }
    }

    if (!baseline) {
      fs.writeFileSync(SNAP_FILE, JSON.stringify(current, null, 2), 'utf8');
      return {
        name: '题目结构 Snapshot 基线',
        pass: errors.length === 0,
        errors: errors.slice(),
        warnings: warnings.slice(),
        summary: '首次运行：写入基线 ' + Object.keys(current).length + ' 个 Case'
      };
    }

    // 比对
    Object.keys(current).forEach(function (k) {
      if (!baseline[k]) { warnings.push('[snapshot] 新增 Case（无基线对比）: ' + k); return; }
      const a = baseline[k], b = current[k];
      const diffs = [];
      COMPARE_KEYS.forEach(function (f) {
        if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) diffs.push(f + ': ' + JSON.stringify(a[f]) + ' → ' + JSON.stringify(b[f]));
      });
      if (diffs.length) errors.push('[snapshot] 结构漂移 ' + k + ' : ' + diffs.join('; '));
    });

    return {
      name: '题目结构 Snapshot 基线',
      pass: errors.length === 0,
      errors: errors.slice(),
      warnings: warnings.slice(),
      summary: '比对 ' + Object.keys(current).length + ' 个 Case；漂移 ' + errors.length
    };
  });
}

module.exports = { run: run, SNAP_CASES: SNAP_CASES };
if (require.main === module) {
  run().then(function (r) { console.log(JSON.stringify(r, null, 2)); process.exit(r.pass ? 0 : 1); });
}
