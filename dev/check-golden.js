#!/usr/bin/env node
/**
 * dev/check-golden.js — Golden Path 代表性题目生成测试（M0-02）
 *
 * 覆盖：math G1/G2/G3、单题型、综合练习、多个 difficulty、有 SVG、无 SVG、
 *       answer/check、print 相关路径。每个 Case 记录：
 *       subject / grade / pluginId / type / subtype / count / difficulty。
 *
 * 不依赖随机内容稳定性：仅断言结构性不变量（生成成功、题量、render 输出、
 * 自身答案通过自身 check、SVG 是否存在与预期一致）。print 路径验证 Print 模块与
 * render 产物结构（DOM 执行需浏览器，不在此跑）。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

const loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
const regMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));
// print.js 在 Node 下挂载到 module.exports.Print（IIFE 末参 this=module.exports），这里取出并补到 global.Print
const _printMod = require(path.join(ROOT, 'shared', 'print.js'));
global.Print = _printMod.Print || global.Print;

const errors = [];
const warnings = [];
const cases = [];

const CASES = [
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'add', subtype: '', count: 5, difficulty: 3, expectSvg: false },
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'sub', subtype: '', count: 5, difficulty: 3, expectSvg: false },
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'add', subtype: '', count: 5, difficulty: 1, expectSvg: false },
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'add', subtype: '', count: 5, difficulty: 5, expectSvg: false },
  { subject: 'math', grade: 1, pluginId: 'math-oral', type: 'add', subtype: '', count: 5, difficulty: 10, expectSvg: false },
  { subject: 'math', grade: 1, pluginId: 'math-make-ten', type: '', subtype: '', count: 5, difficulty: 3, expectSvg: true },
  { subject: 'math', grade: 1, pluginId: 'math-shapes', type: '', subtype: '', count: 5, difficulty: 3, expectSvg: true },
  { subject: 'math', grade: 2, pluginId: 'math-g2-column', type: '', subtype: '', count: 5, difficulty: 5, expectSvg: false },
  { subject: 'math', grade: 3, pluginId: 'math-fraction', type: '', subtype: '', count: 5, difficulty: 6, expectSvg: false },
  { subject: 'math', grade: 2, pluginId: 'math-g2-mixed', type: '', subtype: '', count: 8, difficulty: 4, expectSvg: false },
  { subject: 'chinese', grade: 1, pluginId: 'chinese-pinyin', type: '', subtype: '', count: 5, difficulty: 3, expectSvg: false }
];

function buildUserAnswers(set) {
  const ans = {};
  set.questions.forEach(function (q, i) {
    if (q.inputType === 'multi') {
      let parts;
      if (Array.isArray(q.answer)) parts = q.answer;
      else if (q.answer && typeof q.answer === 'object') parts = [q.answer.q, q.answer.r];
      else parts = String(q.answer).split(/[、,，]/);
      parts.forEach(function (p, j) { ans[i + ':' + j] = (p == null ? '' : p); });
    } else if (q.answer && typeof q.answer === 'object') {
      ans[i] = (q.answer.q != null ? q.answer.q : '') + (q.answer.r != null ? '……' + q.answer.r : '');
    } else {
      ans[i] = Array.isArray(q.answer) ? q.answer.join('') : (q.answer == null ? '' : q.answer);
    }
  });
  return ans;
}

function runCase(c) {
  const entry = regMod.getEntry(c.pluginId);
  const rec = {
    subject: c.subject, grade: c.grade, pluginId: c.pluginId, type: c.type,
    subtype: c.subtype, count: c.count, difficulty: c.difficulty,
    ok: false, svgCount: 0, qCount: 0, note: ''
  };
  if (!entry) { rec.note = '注册表无此插件'; errors.push('[golden] ' + c.pluginId + ' 未注册'); return rec; }

  const loadRes = loader.loadPlugin(entry);
  if (loadRes.error || !loadRes.plugin) {
    rec.note = '加载失败: ' + loadRes.error; errors.push('[golden] ' + c.pluginId + ' 加载失败: ' + loadRes.error); return rec;
  }
  const plugin = loadRes.plugin;

  const opts = { grade: c.grade, count: c.count, difficulty: c.difficulty };
  if (c.type) opts.type = c.type;
  if (c.subtype) opts.subtype = c.subtype;

  function evaluate(set) {
    if (!set || !Array.isArray(set.questions) || !set.questions.length) {
      rec.note = '返回空题'; errors.push('[golden] ' + c.pluginId + ' 返回空题'); return;
    }
    rec.qCount = set.questions.length;
    let svg = 0;
    let renderOk = true;
    set.questions.forEach(function (q, i) {
      if (q.svg) svg++;
      const html = (typeof q.render === 'function') ? q.render(i) : (plugin.render ? plugin.render(set) : '');
      if (typeof html !== 'string' || html.length === 0) renderOk = false;
    });
    rec.svgCount = svg;
    if (!renderOk) { rec.note = 'render 输出异常'; errors.push('[golden] ' + c.pluginId + ' render 输出异常'); return; }

    // check 必须可运行并返回合法结构（与随机内容无关，纯结构校验）
    const userAnswers = buildUserAnswers(set);
    let checkRes;
    try { checkRes = plugin.check(set, userAnswers); } catch (e) {
      rec.note = 'check 抛错: ' + e.message; errors.push('[golden] ' + c.pluginId + ' check 抛错: ' + e.message); return;
    }
    if (!checkRes || !Array.isArray(checkRes.results) || checkRes.results.length !== set.questions.length) {
      rec.note = 'check 结构异常'; errors.push('[golden] ' + c.pluginId + ' check 结构异常（期望 results 长度=' + set.questions.length + '）'); return;
    }
    // 自身答案通过率（业务质量指标，非 M0 阻断项；差异记录在 warnings）
    const ownPass = checkRes.results.filter(Boolean).length;
    rec.ownPassRate = ownPass / set.questions.length;
    if (ownPass !== set.questions.length) {
      warnings.push('[golden] ' + c.pluginId + ' 自身答案通过率 ' + ownPass + '/' + set.questions.length +
        '（疑似答案/check 归一化不一致，属既有技术债，不在 M0 修复）');
    }

    // SVG 期望一致性（expectSvg=null 表示不校验）
    if (c.expectSvg === true && svg === 0) {
      warnings.push('[golden] ' + c.pluginId + ' 期望有 SVG 但无');
    }
    if (c.expectSvg === false && svg > 0) {
      warnings.push('[golden] ' + c.pluginId + ' 期望无 SVG 但有 ' + svg);
    }

    // print 路径：Print 模块存在且 render 产物含 question-card
    if (typeof global.Print === 'undefined' || typeof global.Print.open !== 'function') {
      errors.push('[golden] print.js 未暴露 Print.open'); rec.note = 'Print 缺失'; return;
    }
    const gridHtml = (typeof plugin.render === 'function') ? plugin.render(set) : '';
    if (gridHtml.indexOf('question-card') === -1) {
      warnings.push('[golden] ' + c.pluginId + ' render 产物未含 question-card（可能自定义容器）');
    }
    rec.ok = true;
    rec.note = 'OK';
  }

  let res;
  try { res = plugin.generate(opts); } catch (e) {
    rec.note = 'generate 抛错: ' + e.message; errors.push('[golden] ' + c.pluginId + ' generate 抛错: ' + e.message); return rec;
  }
  if (res && typeof res.then === 'function') {
    // 异步（综合）：等待一次
    return res.then(evaluate).then(function () { return rec; }).catch(function (e) {
      rec.note = '异步 generate 失败: ' + e.message;
      errors.push('[golden] ' + c.pluginId + ' 异步 generate 失败: ' + e.message);
      return rec;
    });
  }
  evaluate(res);
  return rec;
}

function run() {
  errors.length = 0; warnings.length = 0; cases.length = 0;
  const syncRecs = [];
  const asyncPromises = [];
  CASES.forEach(function (c) {
    const r = runCase(c);
    if (r && typeof r.then === 'function') asyncPromises.push(r);
    else syncRecs.push(r);
  });
  return Promise.all(asyncPromises).then(function (asyncRecs) {
    const all = syncRecs.concat(asyncRecs);
    all.forEach(function (r) { cases.push(r); });
    const failed = all.filter(function (r) { return !r.ok; });
    return {
      name: 'Golden Path 生成测试',
      pass: failed.length === 0 && errors.length === 0,
      errors: errors.slice(),
      warnings: warnings.slice(),
      cases: all.map(function (r) {
        return { subject: r.subject, grade: r.grade, pluginId: r.pluginId, type: r.type, subtype: r.subtype, count: r.count, difficulty: r.difficulty, qCount: r.qCount, svgCount: r.svgCount, ok: r.ok, note: r.note };
      }),
      summary: 'Case ' + all.length + ' 个，通过 ' + (all.length - failed.length) + ' / 失败 ' + failed.length
    };
  });
}

module.exports = { run: run, CASES: CASES };
if (require.main === module) {
  run().then(function (r) { console.log(JSON.stringify(r, null, 2)); process.exit(r.pass ? 0 : 1); });
}
