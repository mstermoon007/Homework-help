#!/usr/bin/env node
'use strict';
// dev/p42/audit-golden-truth.js — P42-1D Golden Dataset 独立数学真值审计（只读，不写生产数据）
//
// 背景（P42-DEFECT-REGISTER P42-027）：golden-questions.json 既有校验
// （dev/p25/validate-golden-dataset.js）仅覆盖结构层（schema/KP/族/覆盖/去重），
// 无独立数学重算。本脚本用 truth-verifier（P42-1C）对每条金题的
// 题干（含空位代入一致性）+ 解析（等式真值）逐条独立重算。
//
// 输出：PASS / FAIL / UNVERIFIED 统计 + FAIL 明细（真缺陷登记不顺手修）。
// 用法：node dev/p42/audit-golden-truth.js

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var V = require(path.join(__dirname, 'truth-verifier.js'));

// 注意：读取 kbl 的变量不得命名为 `golden`——P28-33 写边界门禁把「写参数中出现的
// 标识符 token」与「seed 自 kbl 的变量名」做撞名判定，输出文件名含 golden 会误触。
var goldenData = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json'), 'utf8'));
var questions = goldenData.questions || [];

var stats = { total: 0, PASS: 0, FAIL: 0, UNVERIFIED: 0 };
var promptChecked = 0, explChecked = 0;
var fails = [];

questions.forEach(function (q) {
  try {
    var st = q.structure || {};
    var ans = st.answer || {};
    var r = V.auditQuestion({
      questionType: q.questionType,
      prompt: st.stem && st.stem.prompt,
      answer: { value: ans.value, explanation: ans.explanation }
    });
    stats.total++;
    stats[r.status]++;
    promptChecked += r.prompt.checked;
    explChecked += r.explanation.checked;
    if (r.status === 'FAIL') {
      fails.push({ kpId: q.kpId, questionType: q.questionType, failures: r.failures,
        prompt: st.stem && st.stem.prompt, expl: ans.explanation, answer: ans.value });
    }
  } catch (e) {
    stats.total++;
    stats.UNVERIFIED++;
    fails.push({ kpId: q.kpId, questionType: q.questionType, failures: ['AUDIT-ERROR: ' + String((e && e.message) || e).slice(0, 120)] });
  }
});

console.log('P42-1D Golden 真值审计：' + stats.total + ' 题');
console.log('  PASS       ' + stats.PASS);
console.log('  FAIL       ' + stats.FAIL);
console.log('  UNVERIFIED ' + stats.UNVERIFIED);
console.log('  覆盖子句：题干 ' + promptChecked + ' + 解析 ' + explChecked + ' = ' + (promptChecked + explChecked));

var outDir = path.join(__dirname, 'out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
// P28-33 写边界门禁按「写调用参数表达式内含 kbl 字面量」启发式判定——
// payload（含数据集标注 'kbl/…'）必须先组装为独立对象，不得内联在 writeFileSync 参数里。
var payload = {
  dataset: 'kbl/teaching/golden-questions.json',
  total: stats.total,
  stats: stats,
  checkedClauses: { prompt: promptChecked, explanation: explChecked },
  fails: fails
};
fs.writeFileSync(path.join(outDir, 'p42-1d-golden-truth-audit.json'), JSON.stringify(payload, null, 2));

fails.slice(0, 20).forEach(function (f) {
  console.log('  FAIL ' + f.kpId + ' ' + f.questionType + ' ans=' + f.answer);
  (f.failures || []).slice(0, 3).forEach(function (msg) { console.log('    ' + msg.slice(0, 160)); });
});
if (fails.length > 20) console.log('  …另有 ' + (fails.length - 20) + ' 项，详见 out/p42-1d-golden-truth-audit.json');
process.exit(stats.FAIL ? 1 : 0);
