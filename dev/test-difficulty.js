/**
 * dev/test-difficulty.js — 难度系统回归验证（MATH-14 native-only）
 * 运行：node dev/test-difficulty.js
 *
 * MATH-14：legacy 插件轨道已删除，原「逐插件难度行为断言」随之移除；
 *          难度透传改由以下 native Gate 承接：
 *            - dev/check-golden.js（单 KP difficulty 1/3/5/10 透传）
 *            - dev/check-strategy-plumbing.js（difficulty 维度 549/549）
 *          本文件保留：难度工具单元测试 + Comprehensive 难度透传。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
// localStorage shim（供难度相关断言使用）
global.localStorage = {
  _d: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem: function (k, v) { this._d[k] = String(v); },
  removeItem: function (k) { delete this._d[k]; }
};
var common = require(path.join(ROOT, 'shared/common.js'));

var fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.log('  FAIL: ' + msg); }
  else console.log('  OK:   ' + msg);
}

function dedupe(questions) {
  var keys = {};
  var dups = 0;
  questions.forEach(function (q) {
    var d = q.data || {};
    var detail = JSON.stringify(d);
    // 题干兼容三种字段：question（标准）、q（简式）、prompt（SemanticQuestion 主链）
    var ans = q.answer && typeof q.answer === 'object' ? JSON.stringify(q.answer) : q.answer;
    var k = (q.__src ? q.__src.id + ':' : (q.type || '') + ':') + (q.kind || '') + '|' + (q.question || q.q || q.prompt || '') + '|' + detail + '|' + ans;
    if (keys[k]) dups++; else keys[k] = 1;
  });
  return dups;
}

Promise.resolve().then(function () {
  console.log('\n===== 综合练习（comprehensive 主链）难度透传 =====');
  // 综合练习经生成层 ComprehensiveStrategy：装配 strategy-engine.bundle + generation-engine。
  // MATH-14：plugins/registry.js / plugin-loader / legacy-svg-adapter 已删除。
  require(path.join(ROOT, 'shared/difficulty-static.js'));
  require(path.join(ROOT, 'shared/knowledge-bank.js'));
  require(path.join(ROOT, 'shared/strategy-engine.bundle.js'));
  require(path.join(ROOT, 'shared/presentation-engine.bundle.js'));
  require(path.join(ROOT, 'shared/presentation/render-options.js'));
  require(path.join(ROOT, 'shared/presentation/render-result.js'));
  require(path.join(ROOT, 'shared/presentation/svg-registry.js'));
  require(path.join(ROOT, 'shared/presentation/html-renderer.js'));
  require(path.join(ROOT, 'shared/presentation/renderer.js'));
  require(path.join(ROOT, 'shared/generation-engine.js'));
  require(path.join(ROOT, 'shared/strategy/comprehensive-strategy.js'));
  var Engine = require(path.join(ROOT, 'shared/generation-engine.js'));
  return Engine.generate({ subject: 'math', grade: 1, count: 20, mode: 'comprehensive', difficulty: 8 })
    .then(function (res) {
      var set = { questions: res.questions || [] };
      assert(set.questions.length > 0, 'comprehensive diff=8 生成 ' + set.questions.length + ' 题');
      var dup = dedupe(set.questions);
      // 小题池年级存在随机碰撞：沿用全仓容忍线 min(max(2,20%),12)，仅拦系统性重复
      var dupTol = Math.min(Math.max(2, Math.ceil(set.questions.length * 0.2)), 12);
      assert(dup <= dupTol, 'comprehensive 混合重复 ≤ 容忍线 ' + dupTol + '（实际 ' + dup + '）');
      var okAll = set.questions.every(function (q) {
        var v = q.answer && typeof q.answer === 'object' ? q.answer.value : q.answer;
        return v != null && String(v).length > 0;
      });
      assert(okAll, 'comp 全部题目答案有效（语义题 answer.value 非空）');
    }).catch(function (e) { fail++; console.log('  FAIL: comprehensive 生成异常: ' + e.message); });
}).then(function () {
  console.log('\n===== 难度工具单元测试 =====');
  var PU = common; // Node 下 require 直接返回 PluginUtil 工具对象
  assert(PU.diffLevel(undefined) === 3, 'diffLevel 默认 3');
  assert(PU.diffLevel(0) === 3, 'diffLevel 非法(0)回退 3');
  assert(PU.diffLevel(15) === 10, 'diffLevel 上限 10');
  assert(PU.diffLevel(3.4) === 3, 'diffLevel 四舍五入(3.4→3)');
  assert(PU.diffLevel(3.5) === 4, 'diffLevel 四舍五入(3.5→4)');
  assert(PU.diffScale(3) === 1, 'diffScale(3)=1');
  assert(PU.diffScale(1) === 0.6, 'diffScale(1)=0.6');
  assert(PU.diffMax(20, 3) === 20, 'diffMax(20,3)=20');
  assert(PU.diffMax(20, 8) === 40, 'diffMax(20,8)=40');

  // ===== 统一难度消费（App.Difficulty.consume） =====
  console.log('\n===== 统一难度消费（App.Difficulty.consume） =====');
  var D = require(path.join(ROOT, 'shared/difficulty.js'));

  // consume：自带分档 → 通用难度不叠加；无分档 → 正常解析
  var c1 = D.consume({ difficulty: 9, level: 'advanced' });
  assert(c1.hasOwnLevel === true && c1.effectiveLevel === 3,
    'consume：level 存在 → hasOwnLevel=true，effectiveLevel 回落默认档（通用隐藏不叠加）');
  var c2p = D.consume({ difficulty: 7 });
  assert(c2p.hasOwnLevel === false && c2p.effectiveLevel === 7 && c2p.structure.allowBracket === true,
    'consume：无 level → effectiveLevel=7，结构含括号');

  // ===== 步骤6 回归：结构单调 / 难度档案 =====
  console.log('\n===== 步骤6 回归（结构单调 · 难度档案） =====');
  // a) difficultyToStructure 单调性 + 分档边界抽查
  var prevScore = -Infinity, monoOk = true;
  [1,2,3,4,5,6,7,8,9,10].forEach(function (l) {
    var sc = D.difficultyToStructure(l).complexityScore;
    if (!(sc > prevScore)) monoOk = false;
    prevScore = sc;
  });
  assert(monoOk, 'difficultyToStructure：1-10 complexityScore 严格单调递增');
  assert(D.difficultyToStructure(3).steps === 2 && D.difficultyToStructure(3).allowBracket === false,
    'structure lv3：steps=2 无括号');
  assert(D.difficultyToStructure(9).steps === 5 && D.difficultyToStructure(9).nestedBrackets === true,
    'structure lv9：steps=5 多层括号');

  // ===== 任务10 回归：难度系统按科目差异化 =====
  console.log('\n===== 任务10 回归（DifficultyProfiles · 科目策略路由） =====');

  // a) 档案存在 + 科目代号归一（cn/en 已随语文/英语剔除，未知科目/其余回落 math）
  assert(D.DifficultyProfiles && D.DifficultyProfiles.math,
    'DifficultyProfiles 含 math 档案');
  assert(D.profileFor('math') === D.DifficultyProfiles.math, 'profileFor(math) → math 档案');
  assert(D.profileFor('chinese') === D.DifficultyProfiles.math, 'profileFor(chinese) 回落 math');
  assert(D.profileFor('english') === D.DifficultyProfiles.math, 'profileFor(english) 回落 math');
  assert(D.profileFor('unknown-x') === D.DifficultyProfiles.math, '未知科目回落 math 档案');

  // b) 数学行为不变：paramsFor 与既有 createProfile/diffScale 完全一致
  var pm3 = D.paramsFor('math', 3);
  assert(pm3.scale === PU.diffScale(3) && pm3.steps === D.difficultyToStructure(3).steps
    && pm3.allowBracket === false && pm3.allowMultDiv === false,
    'paramsFor(math,3)：scale=1、steps=2、无括号无乘除（现行行为）');
  var pm8 = D.paramsFor('math', 8);
  assert(pm8.allowBracket === true && pm8.allowMultDiv === true && pm8.scale === PU.diffScale(8),
    'paramsFor(math,8)：scale 放大且结构含括号乘除');

  // e) 策略路由：math 策略可用且数学规则数值不变
  var rM = D.strategyFor('math').apply({ emaRate: 0.95, lastRate: 1 });
  assert(rM.delta === 2 && rM.bias === 'hard', 'strategyFor(math)：ema .95/.last 1 → +2 hard');
  assert(D.strategyFor('math').apply({ emaRate: 0.4, lastRate: 0.3 }).delta === -2,
    'strategyFor(math)：ema .4 → −2 easy（现行规则）');
  assert(D.strategyFor('math').apply({ emaRate: 0.75, lastRate: 0.75 }).delta === 0,
    'strategyFor(math)：ema .75 → 0（中间带）');
  assert(D.strategyFor('cn') === D.strategyFor('math') && D.strategyFor('en') === D.strategyFor('math'),
    'cn/en 策略回落 math（科目已移除）');

  // g) paramsFor 叠加自适应 delta（math 现行行为）
  var pm = D.paramsFor('math', 5, 2);
  assert(pm.level === 7, 'paramsFor(math,5,+2) → level 7');
  var pme = D.paramsFor('math', 3, -2);
  assert(pme.level === 1, 'paramsFor(math,3,-2) → level 1');

  console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ ' + fail + ' 项失败'));
  process.exit(fail === 0 ? 0 : 1);
});
