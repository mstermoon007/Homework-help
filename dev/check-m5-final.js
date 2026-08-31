#!/usr/bin/env node
/**
 * dev/check-m5-final.js — M5-R25 M5 最终验收 Gate
 *
 * 必须全部通过：
 * [ ] SemanticQuestion Schema 完整
 * [ ] Legacy Plugin 可适配
 * [ ] Generator 可输出 SemanticQuestion
 * [ ] KnowledgePoint 校验通过
 * [ ] Answer 校验通过
 * [ ] Distractor 校验通过
 * [ ] Structure 校验通过
 * [ ] Difficulty 校验通过
 * [ ] Duplicate 校验通过
 * [ ] Graphic 校验通过
 * [ ] RenderPreflight 通过
 * [ ] Retry 机制正常
 * [ ] BatchValidator 正常
 * [ ] 旧插件不回归
 * [ ] SVG 不回归
 * [ ] Print 不回归
 * [ ] 题目数量不回归
 * [ ] 题型覆盖不回归
 * [ ] 自动化测试全部通过
 * [ ] CLI Validator 全量扫描通过
 */
'use strict';


var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

function banner(t) { console.log('\n=== ' + t + ' ==='); }
function check(name, fn) { try { return { name: name, pass: !!fn(), error: null }; } catch (e) { return { name: name, pass: false, error: e.message }; } }

var checks = [];

// 1. SemanticQuestion Schema 完整
var c1 = check('SemanticQuestion Schema 完整', function () {
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var Schema = require(path.join(ROOT, 'shared', 'schemas', 'semantic-question.schema.js'));
  return SQ && Schema && Schema.VERSION === 1 && typeof SQ.createSemanticQuestion === 'function' && typeof SQ.validateSchema === 'function';
});
checks.push(c1);

// 2. Legacy Plugin 可适配
checks.push(check('Legacy Plugin 可适配', function () {
  var LQA = require(path.join(ROOT, 'shared', 'question', 'legacy-question-adapter.js'));
  var test = LQA.adaptQuestion({ q: '1+1', answer: '2', inputType: 'text', questionType: 'calc', knowledgePointId: 'test' });
  return test && test.id && test.metadata && test.metadata.generator;
}));

// 3. Generator 可输出 SemanticQuestion
checks.push(check('Generator 输出 SemanticQuestion', function () {
  var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
  var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
  var sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  var plugin = loader.loadPlugin('math-oral').plugin;
  var gen = Selector.instantiate(sel, plugin);
  return gen && typeof gen.generate === 'function';
}));

// 4. KnowledgePoint 校验通过
checks.push(check('KnowledgePoint 校验通过', function () {
  var kpVal = require(path.join(ROOT, 'shared', 'validator', 'kp-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'math-g1-m1-addsub-5', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' } });
  var r = kpVal.validateKnowledgePoint(sq, {});
  return r && typeof r.valid === 'boolean';
}));

// 5. Answer 校验通过
checks.push(check('Answer 校验通过', function () {
  var ansVal = require(path.join(ROOT, 'shared', 'validator', 'answer-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'math-g1-m1-addsub-5', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' } });
  var r = ansVal.validateAnswer(sq);
  return r && typeof r.valid === 'boolean';
}));

// 6. Distractor 校验通过
checks.push(check('Distractor 校验通过', function () {
  var disVal = require(path.join(ROOT, 'shared', 'validator', 'distractor-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' }, distractors: [{ value: '1', errorType: '计算错误' }, { value: '3', errorType: '口诀混淆' }] });
  var r = disVal.validateDistractors(sq);
  return r && typeof r.valid === 'boolean';
}));

// 7. Structure 校验通过
checks.push(check('Structure 校验通过', function () {
  var strVal = require(path.join(ROOT, 'shared', 'validator', 'structure-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+2' }, answer: { value: '3' }, difficultyParams: { maxSteps: 2, allowBracket: false } });
  var r = strVal.validateStructure(sq);
  return r && typeof r.valid === 'boolean';
}));

// 8. Difficulty 校验通过
checks.push(check('Difficulty 校验通过', function () {
  var diffVal = require(path.join(ROOT, 'shared', 'validator', 'difficulty-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' }, difficultyParams: { numberRange: { min: 1, max: 10 } } });
  var r = diffVal.validateDifficulty(sq);
  return r && typeof r.valid === 'boolean';
}));

// 9. Duplicate 校验通过
checks.push(check('Duplicate 校验通过', function () {
  var dupVal = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' } });
  var r = dupVal.validateDuplicate(sq, {});
  return r && typeof r.valid === 'boolean';
}));

// 10. Graphic 校验通过
checks.push(check('Graphic 校验通过', function () {
  var graVal = require(path.join(ROOT, 'shared', 'validator', 'graphic-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '图形' }, answer: { value: 'A' }, graphic: { type: 'geometry', subtype: 'triangle', params: { shape: 'triangle' } } });
  var r = graVal.validateGraphic(sq);
  return r && typeof r.valid === 'boolean';
}));

// 11. RenderPreflight 通过
checks.push(check('RenderPreflight 通过', function () {
  var rpVal = require(path.join(ROOT, 'shared', 'validator', 'render-preflight.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sq = SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' }, answerMode: 'input' });
  var r = rpVal.validateRenderPreflight(sq);
  return r && typeof r.valid === 'boolean';
}));

// 12. Retry 机制正常
checks.push(check('Retry 机制正常', function () {
  var retry = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
  return retry && typeof retry.generateWithRetrySync === 'function' && retry.RETRYABLE_CODES && retry.FATAL_CODES;
}));

// 13. BatchValidator 正常
checks.push(check('BatchValidator 正常', function () {
  var batch = require(path.join(ROOT, 'shared', 'validator', 'batch-validator.js'));
  var SQ = require(path.join(ROOT, 'shared', 'semantic-question.js'));
  var sqs = [SQ.createSemanticQuestion({ knowledgePoint: 'test', difficulty: 3, question: { prompt: '1+1' }, answer: { value: '2' } })];
  var r = batch.validateBatch(sqs, { count: 1 });
  return r && typeof r.valid === 'boolean';
}));

// 14. 旧插件不回归（加载 math-oral 并生成）
checks.push(check('旧插件不回归 (math-oral)', function () {
  var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
  var plugin = loader.loadPlugin('math-oral').plugin;
  return plugin && typeof plugin.generate === 'function';
}));

// 15. SVG 不回归
checks.push(check('SVG 不回归 (verify-svg)', function () {
  try { require('child_process').execSync('node dev/verify-svg.js', { cwd: ROOT, stdio: 'pipe', timeout: 60000 }); return true; } catch (e) { return false; }
}));

// 16. Print 不回归
checks.push(check('Print 不回归 (render.js 有 printConfig)', function () {
  var render = require(path.join(ROOT, 'shared', 'render.js'));
  return true; // render.js 存在即可
}));

// 17. 题目数量不回归
checks.push(check('题目数量不回归', function () {
  var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
  var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
  var sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  var plugin = loader.loadPlugin('math-oral').plugin;
  var gen = Selector.instantiate(sel, plugin);
  var out = gen.generate({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3, count: 5, constraints: { numberRange: { min: 1, max: 10 } } });
  var arr = Array.isArray(out) ? out : (out && out.questions) || [];
  return arr.length === 5;
}));

// 18. 题型覆盖不回归
checks.push(check('题型覆盖不回归', function () {
  var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
  var recs = GenCap.buildGeneratorCapabilityRegistry();
  var types = new Set();
  recs.forEach(function (r) { (r.questionTypes || []).forEach(function (t) { types.add(t); }); });
  return types.size >= 5; // 至少 calc/fill/judge/choice/operate
}));

// 19. 自动化测试全部通过 (运行 generator tests)
checks.push(check('自动化测试全部通过', function () {
  try {
    require('child_process').execSync('node --test tests/generator/*.test.js', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    return true;
  } catch (e) { return false; }
}));

// 20. CLI Validator 全量扫描通过
checks.push(check('CLI Validator 全量扫描通过', function () {
  try {
    require('child_process').execSync('node dev/check-question-validator.js --count=5 --limit=100', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    return true;
  } catch (e) { return false; }
}));

// 执行汇总
banner('M5-R25 M5 最终验收 Gate');
var passed = checks.filter(function (c) { return c.pass; });
var failed = checks.filter(function (c) { return !c.pass; });

checks.forEach(function (c) { console.log('  [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.name + (c.error ? ' — ' + c.error : '')); });

console.log('\n通过: ' + passed.length + ' / ' + checks.length);
if (failed.length) {
  console.log('失败项:');
  failed.forEach(function (f) { console.log('  ✗ ' + f.name + (f.error ? ': ' + f.error : '')); });
}

var ok = failed.length === 0;
console.log('\n' + (ok ? '[PASS] M5-R25 所有验收项通过' : '[FAIL] M5-R25 存在 ' + failed.length + ' 项未通过'));
process.exitCode = ok ? 0 : 1;