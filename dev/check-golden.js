#!/usr/bin/env node
/**
 * dev/check-golden.js — Golden Path 代表性题目生成测试（M0-02，MATH-14 native-only）
 *
 * 覆盖：math G1/G2/G3、单知识点（含多个 difficulty）、综合练习、有 SVG、无 SVG、
 *       answer/check、print 相关路径。每个 Case 记录：
 *       subject / grade / knowledgePointId / mode / count / difficulty。
 *
 * 不依赖随机内容稳定性：仅断言结构性不变量（生成成功、题量、render 输出、
 * 自身答案通过自身 check、SVG 是否存在与预期一致）。print 路径验证 Print 模块与
 * render 产物结构（DOM 执行需浏览器，不在此跑）。
 *
 * MATH-14：legacy 插件轨道（dev/plugin-loader + plugins/registry）已删除，
 *          本 Gate 统一经 GenerationEngine.generate() 主链生成。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = global;
['./shared/common.js', './shared/difficulty.js', './shared/difficulty-static.js',
 './shared/knowledge-bank.js',
 './shared/strategy-engine.bundle.js', './shared/presentation-engine.bundle.js',
 './shared/presentation/render-options.js', './shared/presentation/render-result.js',
 './shared/presentation/svg-registry.js',
 './shared/presentation/html-renderer.js', './shared/presentation/renderer.js',
 './shared/generation-engine.js', './shared/strategy/comprehensive-strategy.js'
].forEach(function (rel) {
  require(path.join(ROOT, rel));
});

// print.js 在 Node 下挂载到 module.exports.Print，这里取出并补到 global.Print
const _printMod = require(path.join(ROOT, 'shared', 'print.js'));
global.Print = _printMod.Print || global.Print;

const RenderFormat = require(path.join(ROOT, 'shared', 'presentation', 'render-format.js'));
const Engine = global.GenerationEngine || require(path.join(ROOT, './shared/generation-engine.js'));

const errors = [];
const warnings = [];
const cases = [];

const CASES = [
  { name: 'G1 口算 addsub-10 d1', subject: 'math', grade: 1, kp: 'math-g1-m1-addsub-10', count: 5, difficulty: 1, expectSvg: false },
  { name: 'G1 口算 addsub-10 d3', subject: 'math', grade: 1, kp: 'math-g1-m1-addsub-10', count: 5, difficulty: 3, expectSvg: false },
  { name: 'G1 口算 addsub-10 d5', subject: 'math', grade: 1, kp: 'math-g1-m1-addsub-10', count: 5, difficulty: 5, expectSvg: false },
  { name: 'G1 口算 addsub-10 d10', subject: 'math', grade: 1, kp: 'math-g1-m1-addsub-10', count: 5, difficulty: 10, expectSvg: false },
  { name: 'G1 凑十（SVG）', subject: 'math', grade: 1, kp: 'math-g1-m0-make-ten', count: 5, difficulty: 3, expectSvg: true },
  { name: 'G2 竖式乘法', subject: 'math', grade: 2, kp: 'math-g2-m2-mult-col', count: 5, difficulty: 5, expectSvg: false },
  // math-g2-column 族答案/check 归一化闭环（2025）：6 个历史挂账竖式 KP 必须「错误答案 0」
  { name: 'G2 竖式加法', subject: 'math', grade: 2, kp: 'math-g2-m2-add-col', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G2 竖式减法', subject: 'math', grade: 2, kp: 'math-g2-m2-sub-col', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G2 竖式有余数除法', subject: 'math', grade: 2, kp: 'math-g2-m2-remainder-col', count: 5, difficulty: 5, expectSvg: false },
  { name: 'G2 竖式连加', subject: 'math', grade: 2, kp: 'math-g2-m2-chain-add-col', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G2 竖式连减', subject: 'math', grade: 2, kp: 'math-g2-m2-chain-sub-col', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G2 竖式加减混合', subject: 'math', grade: 2, kp: 'math-g2-m2-mixed-col', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G2 口算 addsub-1000', subject: 'math', grade: 2, kp: 'math-g2-m1-addsub-1000', count: 5, difficulty: 4, expectSvg: false },
  { name: 'G3 测量', subject: 'math', grade: 3, kp: 'math-g3-m4-g3-measure', count: 5, difficulty: 6, expectSvg: false },
  { name: '综合练习 G3（无单点 KP）', subject: 'math', grade: 3, mode: 'comprehensive', count: 12, difficulty: 4, expectSvg: null }
];

function buildUserAnswers(renderable) {
  const ans = {};
  renderable.forEach(function (q, i) {
    if (q.inputType === 'multi') {
      let parts;
      const a = q.answer;
      if (Array.isArray(a)) parts = a;
      else if (a && typeof a === 'object') parts = [a.q, a.r];
      else parts = String(a == null ? '' : a).split(/[、,，]/);
      parts.forEach(function (p, j) { ans[i + ':' + j] = (p == null ? '' : p); });
    } else if (q.answer && typeof q.answer === 'object') {
      ans[i] = (q.answer.q != null ? q.answer.q : '') + (q.answer.r != null ? '……' + q.answer.r : '');
    } else {
      ans[i] = Array.isArray(q.answer) ? q.answer.join('') : (q.answer == null ? '' : q.answer);
    }
  });
  return ans;
}

function evaluate(caseRec, res) {
  const qs = res.questions || [];
  if (!qs.length) {
    caseRec.note = '返回空题';
    errors.push('[golden] ' + caseRec.name + ' 返回空题');
    return;
  }
  caseRec.qCount = qs.length;

  // 结构不变量：语义题必须带 prompt + 有效答案 + knowledgePointId
  let structuralOk = true;
  qs.forEach(function (q, i) {
    if (typeof q.prompt !== 'string' || !q.prompt.length) { structuralOk = false; errors.push('[golden] ' + caseRec.name + ' 题 ' + i + ' prompt 缺失'); }
    const v = q.answer && typeof q.answer === 'object' ? q.answer.value : q.answer;
    if (v == null || String(v).length === 0) { structuralOk = false; errors.push('[golden] ' + caseRec.name + ' 题 ' + i + ' answer 为空'); }
    if (!q.knowledgePointId) { structuralOk = false; errors.push('[golden] ' + caseRec.name + ' 题 ' + i + ' knowledgePointId 缺失'); }
  });
  if (!structuralOk) { caseRec.note = '结构不变量失败'; return; }

  // 渲染不变量：html 非空且含 question-card
  const html = res.html || '';
  if (typeof html !== 'string' || html.length === 0) {
    caseRec.note = 'render 输出异常';
    errors.push('[golden] ' + caseRec.name + ' render 输出异常');
    return;
  }
  const svgCount = (html.match(/<svg/g) || []).length;
  caseRec.svgCount = svgCount;
  if (html.indexOf('question-card') === -1) {
    warnings.push('[golden] ' + caseRec.name + ' render 产物未含 question-card（可能自定义容器）');
  }

  // 自身答案通过自身 check：按「错误答案 0」字面口径，任何一题自测不通过即阻断 Gate
  // （历史上该指标仅作 warning，math-g2-column 的答案/check 归一化挂账因此被放行）。
  const renderable = RenderFormat.toRenderableQuestions(qs);
  const PE = global.PresentationEngine || require(path.join(ROOT, 'shared', 'presentation-engine.js'));
  try {
    const checkRes = PE.checkAnswers(renderable, buildUserAnswers(renderable));
    if (!checkRes || !Array.isArray(checkRes.results) || checkRes.results.length !== renderable.length) {
      errors.push('[golden] ' + caseRec.name + ' check 结构异常');
    } else {
      const ownPass = checkRes.results.filter(function (r) { return r && r.correct; }).length;
      caseRec.ownPassRate = ownPass / renderable.length;
      if (ownPass !== renderable.length) {
        errors.push('[golden] ' + caseRec.name + ' 自身答案通过率 ' + ownPass + '/' + renderable.length + '（错误答案 ' + (renderable.length - ownPass) + '）');
      }
    }
  } catch (e) {
    errors.push('[golden] ' + caseRec.name + ' check 抛错: ' + e.message);
  }

  // SVG 期望一致性（expectSvg=null 表示不校验）
  if (caseRec.expectSvg === true && svgCount === 0) {
    warnings.push('[golden] ' + caseRec.name + ' 期望有 SVG 但无');
  }
  if (caseRec.expectSvg === false && svgCount > 0) {
    warnings.push('[golden] ' + caseRec.name + ' 期望无 SVG 但有 ' + svgCount);
  }

  // print 路径：Print 模块存在
  if (typeof global.Print === 'undefined' || typeof global.Print.open !== 'function') {
    errors.push('[golden] print.js 未暴露 Print.open');
    caseRec.note = 'Print 缺失';
    return;
  }

  caseRec.ok = true;
  caseRec.note = 'OK';
}

function runCase(c) {
  const caseRec = {
    name: c.name, subject: c.subject, grade: c.grade, kp: c.kp || null,
    mode: c.mode || 'single-kp', count: c.count, difficulty: c.difficulty,
    ok: false, svgCount: 0, qCount: 0, note: ''
  };
  const request = c.kp
    ? { knowledgePointId: c.kp, count: c.count, difficulty: c.difficulty }
    : { subject: c.subject, grade: c.grade, mode: c.mode, count: c.count, difficulty: c.difficulty };
  return Engine.generate(request, { skipValidation: false }).then(function (res) {
    evaluate(caseRec, res);
    return caseRec;
  }).catch(function (e) {
    caseRec.note = 'generate 异常: ' + (e && e.message || e);
    errors.push('[golden] ' + c.name + ' generate 异常: ' + (e && e.message || e));
    return caseRec;
  });
}

function run() {
  errors.length = 0; warnings.length = 0; cases.length = 0;
  return Promise.all(CASES.map(runCase)).then(function (all) {
    all.forEach(function (r) { cases.push(r); });
    const failed = all.filter(function (r) { return !r.ok; });
    return {
      name: 'Golden Path 生成测试（native-only）',
      pass: failed.length === 0 && errors.length === 0,
      errors: errors.slice(),
      warnings: warnings.slice(),
      cases: all.map(function (r) {
        return { name: r.name, subject: r.subject, grade: r.grade, knowledgePointId: r.kp, mode: r.mode, count: r.count, difficulty: r.difficulty, qCount: r.qCount, svgCount: r.svgCount, ok: r.ok, note: r.note };
      }),
      summary: 'Case ' + all.length + ' 个，通过 ' + (all.length - failed.length) + ' / 失败 ' + failed.length
    };
  });
}

module.exports = { run: run, CASES: CASES };
if (require.main === module) {
  run().then(function (r) { console.log(JSON.stringify(r, null, 2)); process.exit(r.pass ? 0 : 1); });
}
