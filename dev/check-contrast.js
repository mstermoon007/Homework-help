#!/usr/bin/env node
/**
 * dev/check-contrast.js — WCAG 2.1 对比度校验（任务2.1）
 *
 * 静态解析 shared/tokens.css 中的颜色令牌，对「核心文本/背景」组合计算对比度，
 * 阻断不满足 WCAG AA 的组合（正文 4.5:1，大文本 3:1）。
 *
 *  - CORE  组合：断言必须达到 4.5:1（正常文本），否则脚本退出码 1（纳入 npm test）。
 *  - EXTENDED 组合：仅警告（如状态色在其浅底上的对比），不阻断。
 *
 * 用法：node dev/check-contrast.js
 */
const fs = require('fs');
const path = require('path');

const TOKENS = path.join(__dirname, '..', 'shared', 'tokens.css');
const css = fs.readFileSync(TOKENS, 'utf8');

// 1. 解析所有 --name: value;
const raw = {};
const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
let m;
while ((m = re.exec(css))) raw[m[1]] = m[2].trim();

// 2. 解析 var() 引用（最多 6 层）
function resolve(v) {
  let s = v, depth = 0;
  while (s.indexOf('var(') !== -1 && depth < 6) {
    s = s.replace(/var\((--[\w-]+)\)/g, (_, n) => raw[n] != null ? raw[n] : n);
    depth++;
  }
  return s.trim();
}

// 3. 取颜色：若为渐变则提取所有 #hex 停靠色
function colorsOf(v) {
  const s = resolve(v);
  const hexes = (s.match(/#[0-9a-fA-F]{3,8}/g) || []).map(normHex);
  return hexes.length ? hexes : [];
}
function normHex(h) {
  if (h.length === 4) {
    return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (h.length === 7) return h;
  return h; // 8 位（带 alpha）暂按 6 位处理
}

// 4. 相对亮度 + 对比度
function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function contrast(c1, c2) {
  const l1 = lum(c1), l2 = lum(c2);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// 5. 组合定义
const WHITE = '#ffffff';
const CORE = [
  ['--ink', '--bg'],
  ['--ink', '--card'],
  ['--muted', '--bg'],
  ['--muted', '--card'],
  [WHITE, '--toolbar-btn-grad'],
  [WHITE, '--toolbar-chip-grad'],
  ['--brand', '--card'],
  ['--brand', '--brand-bg'],
  ['--math-primary', '--card'],
  ['--cn-primary', '--card'],
  ['--en-primary', '--card'],
];
const EXTENDED = [
  ['--ok', '--ok-bg'],
  ['--bad', '--bad-bg'],
  ['--warn', '--card'],
  ['--brand-d', '--card'],
  ['--math-accent', '--card'],
  ['--cn-accent', '--card'],
  ['--en-accent', '--card'],
];

function tokenVal(name) {
  return (name.indexOf('--') === 0 && raw[name] != null) ? raw[name] : name;
}
function evalCombo(fgName, bgName) {
  const fgs = colorsOf(tokenVal(fgName));
  const bgs = colorsOf(tokenVal(bgName));
  if (!fgs.length || !bgs.length) return null; // 无法解析，跳过
  let min = Infinity, pair = '';
  fgs.forEach(fg => bgs.forEach(bg => {
    const r = contrast(fg, bg);
    if (r < min) { min = r; pair = `${fg} / ${bg}`; }
  }));
  return { ratio: min, pair };
}

const errors = [];
const warnings = [];
const AA_NORMAL = 4.5;

console.log('\n🎨 WCAG 对比度校验（任务2.1）\n' + '='.repeat(44));
CORE.forEach(([fg, bg]) => {
  const r = evalCombo(fg, bg);
  if (!r) { warnings.push(`[跳过] 无法解析组合 ${fg} / ${bg}`); return; }
  const ok = r.ratio >= AA_NORMAL;
  const tag = ok ? '✅' : '❌';
  console.log(`  ${tag} CORE  ${fg} on ${bg}  = ${r.ratio.toFixed(2)}:1  (${r.pair})`);
  if (!ok) errors.push(`CORE 对比度不足: ${fg} on ${bg} = ${r.ratio.toFixed(2)}:1 (需 ≥ ${AA_NORMAL})`);
});
EXTENDED.forEach(([fg, bg]) => {
  const r = evalCombo(fg, bg);
  if (!r) return;
  const ok = r.ratio >= AA_NORMAL;
  const tag = ok ? '✅' : '⚠️ ';
  console.log(`  ${tag} EXT   ${fg} on ${bg}  = ${r.ratio.toFixed(2)}:1  (${r.pair})`);
  if (!ok) warnings.push(`EXT 对比度偏低: ${fg} on ${bg} = ${r.ratio.toFixed(2)}:1`);
});

if (warnings.length) {
  console.log('\n⚠️  警告：');
  warnings.forEach(w => console.log('  - ' + w));
}
if (errors.length) {
  console.log('\n❌ 对比度校验失败，请调整 tokens.css 直至 CORE 组合 ≥ 4.5:1：');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✅ 核心颜色对比度均满足 WCAG AA（正文 4.5:1）。');
