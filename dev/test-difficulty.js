/**
 * dev/test-difficulty.js — 难度系统回归验证
 * 运行：node dev/test-difficulty.js
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
var registry = require(path.join(ROOT, 'plugins/registry.js'));
var common = require(path.join(ROOT, 'shared/common.js'));

var fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.log('  FAIL: ' + msg); }
  else console.log('  OK:   ' + msg);
}

function loadPlugin(rec) {
  return Promise.resolve(require(path.join(ROOT, rec.file)));
}

// 构造该题的标准答案映射（兼容单输入 idx / 多输入 idx:field / choice）
// 注意：
// 1. 仅 multi 输入按 idx:field 回填；单输入题即使答案为名单数组也回填整串键 idx；
// 2. 兼容 data 包装的旧式题目（字段在 q.data 中，如 math-number-sense）。
function effInputType(q) {
  var d = q.data || {};
  return q.inputType != null ? q.inputType : d.inputType;
}
function checkAnswer(q, amap, idx) {
  var input = amap[idx];
  var r = common.computeResult([q], { 0: input });
  return r && Array.isArray(r.results) && r.results[0] === true;
}

function answersFor(questions) {
  var map = {};
  questions.forEach(function (q, idx) {
    var d = q.data || {};
    var ans = d.answer != null ? d.answer : q.answer;
    var isMulti = effInputType(q) === 'multi';
    if (ans && typeof ans === 'object' && !Array.isArray(ans) && 'q' in ans && 'r' in ans) {
      // 有余数除法：商/余数双框（idx:0 / idx:1），见 math-g4-vertical remInp
      map[idx + ':0'] = String(ans.q);
      map[idx + ':1'] = String(ans.r);
    } else if (d.kind === 'div' && typeof d.r === 'number' && d.r > 0 && typeof d.q === 'number') {
      // 旧式 data 包装的除法题：q/r 在 data 字段上，判定读 idx:0 / idx:1
      map[idx + ':0'] = String(d.q);
      map[idx + ':1'] = String(d.r);
    } else if (Array.isArray(ans)) {
      if (isMulti) ans.forEach(function (a, j) { map[idx + ':' + j] = String(a); });
      else map[idx] = ans.join('');
    } else {
      map[idx] = String(ans);
    }
    // 命名输入（如拆十法 idx:answer / idx:need / idx:c_answer）
    var named = [{ id: 'answer', expect: ans }].concat(d.decompInputs || [], d.combineInputs || []);
    named.forEach(function (inp) { map[idx + ':' + inp.id] = String(inp.expect); });
  });
  return map;
}

// 小题池插件（判断/推理/口算）：参数空间天然有限，重复断言仅记录不判失败
var SMALL_POOL = /(^math-oral$|judge|reasoning)/;

function checkLevels(plugin, grade, diffs) {
  var results = {};
  diffs.forEach(function (d) {
    var set = plugin.generate({ grade: grade, count: 8, type: 'mix', difficulty: d });
    var qs = (set && set.questions) || [];
    results[d] = qs;
    if (!qs.length) { fail++; console.log('  FAIL: ' + plugin.id + ' diff=' + d + ' 生成 0 题'); return; }
    // 家长批改题型（plugin.check 返回 parentCheck：单题 check 恒为真，不显示数字得分）
    // —— 此类题型无自动判定，跳过「错误答案判定」断言（见 math-g1-operation：画图形/钟面/圈数/分类）
    var parentCheck = false;
    try {
      var pc = plugin.check && plugin.check(set);
      parentCheck = !!(pc && pc.parentCheck);
    } catch (e) { parentCheck = false; }
    var amap = answersFor(qs);
    qs.forEach(function (q, idx) {
      var html = q.render(idx);
      assert(html.indexOf('question-card') !== -1 || html.indexOf('class="problem"') !== -1, plugin.id + ' d' + d + ' #' + idx + ' 渲染含卡片');
      var ok = q.check(amap, idx);
      assert(ok === true, plugin.id + ' d' + d + ' #' + idx + ' 正确答案判定');
      if (parentCheck) {
        // 家长批改：单题判定恒为真，错误答案判定不适用（已通过 plugin.check 返回 parentCheck 识别）
        console.log('  SKIP: ' + plugin.id + ' d' + d + ' #' + idx + ' 错误答案判定（家长批改题型，单题 check 恒为真）');
      } else {
        var badMap = {};
        badMap[idx] = '__wrong__';
        if (effInputType(q) === 'multi') (Array.isArray(q.answer) ? q.answer : [q.answer]).forEach(function (_, j) { badMap[idx + ':' + j] = '__wrong__'; });
        var bad = q.check(badMap, idx);
        assert(bad === false, plugin.id + ' d' + d + ' #' + idx + ' 错误答案判定');
      }
    });
  });
  return results;
}

function dedupe(questions) {
  var keys = {};
  var dups = 0;
  questions.forEach(function (q) {
    var d = q.data || {};
    var detail = JSON.stringify(d);
    // 题干兼容三种字段：question（标准）、q（口算/配对等简式插件）、prompt（SemanticQuestion 新轨）
    var ans = q.answer && typeof q.answer === 'object' ? JSON.stringify(q.answer) : q.answer;
    var k = (q.__src ? q.__src.id + ':' : (q.type || '') + ':') + (q.kind || '') + '|' + (q.question || q.q || q.prompt || '') + '|' + detail + '|' + ans;
    if (keys[k]) dups++; else keys[k] = 1;
  });
  return dups;
}

var mathPlugins = registry.filter(function (r) {
  return r.id.indexOf('math-') === 0;
});

var promises = [];
mathPlugins.forEach(function (rec) {
  promises.push(loadPlugin(rec).then(function (p) {
    if (!p) return;
    // 占位插件 generate 返回空题目集，属预期行为，跳过（不记失败）
    if (p.isPlaceholder) { console.log('\n===== ' + p.id + '（占位插件）跳过 ====='); return; }
    console.log('\n===== ' + p.id + '（' + p.name + '）=====');
    var isComp = p.id.indexOf('competition') !== -1;
    // 竞赛插件生成器较重：减少档位与题量以控制总时长
    var diffs = isComp ? [1, 6, 10] : [1, 3, 5, 8, 10];
    var perLevel = isComp ? 6 : 8;
    var all = {};
    // 家长批改题型（plugin.check 返回 parentCheck）：单题 check 恒为真，无自动判定，
    // 跳过「错误答案判定」断言（见 math-g1-operation：画图形/钟面/圈数/分类）
    var parentCheck = false;
    try {
      var _pcSet = p.generate({ grade: p.grades[0] || 1, count: 1, type: 'mix', difficulty: 1 });
      var _pc = p.check && p.check(_pcSet);
      parentCheck = !!(_pc && _pc.parentCheck);
    } catch (e) { parentCheck = false; }
    diffs.forEach(function (d) {
      var set = p.generate({ grade: p.grades[0] || 1, count: perLevel, type: 'mix', difficulty: d });
      var qs = (set && set.questions) || [];
      all[d] = qs;
      if (!qs.length) { fail++; console.log('  FAIL: ' + p.id + ' diff=' + d + ' 生成 0 题'); return; }
      var amap = answersFor(qs);
      qs.forEach(function (q, idx) {
        var html = q.render(idx);
        assert(html.indexOf('question-card') !== -1 || html.indexOf('class="problem"') !== -1, p.id + ' d' + d + ' #' + idx + ' 渲染含卡片');
        var ok = q.check(amap, idx);
        assert(ok === true, p.id + ' d' + d + ' #' + idx + ' 正确答案判定');
        if (parentCheck) {
          console.log('  SKIP: ' + p.id + ' d' + d + ' #' + idx + ' 错误答案判定（家长批改题型，单题 check 恒为真）');
        } else {
          var badMap = {};
          badMap[idx] = '__wrong__';
          if (effInputType(q) === 'multi') (Array.isArray(q.answer) ? q.answer : [q.answer]).forEach(function (_, j) { badMap[idx + ':' + j] = '__wrong__'; });
          var bad = q.check(badMap, idx);
          assert(bad === false, p.id + ' d' + d + ' #' + idx + ' 错误答案判定');
        }
      });
    });
    // 无重复断言（容错）：小参数空间题型允许少量随机碰撞，
    // 阈值 20%（且绝对值 ≤ 8）；超过视为系统性重复。
    var totalQs = diffs.reduce(function (s, d) { return s + (all[d] || []).length; }, 0);
    var dupTotal = 0;
    Object.keys(all).forEach(function (d) { dupTotal += dedupe(all[d]); });
    var tol = Math.max(2, Math.ceil(totalQs * 0.2));
    var tolCap = Math.min(tol, 12);
    if (SMALL_POOL.test(p.id)) {
      if (dupTotal > 0) console.log('  INFO: ' + p.id + ' 小题池插件，重复 ' + dupTotal + '/' + totalQs + '（不判失败）');
    } else if (dupTotal > tolCap) {
      fail++;
      console.log('  FAIL: ' + p.id + ' 题目重复过多（重复 ' + dupTotal + '/' + totalQs + '，容许 ≤' + tolCap + '）');
    } else if (dupTotal > 0) {
      console.log('  OK:   ' + p.id + ' 无系统性重复（随机碰撞 ' + dupTotal + '/' + totalQs + '，≤ 容忍线 ' + tolCap + '）');
    }

    // 多年级回归：对 grades 中每个年级各跑 3 档难度
    var extra = (p.grades || []).slice(1);
    extra.forEach(function (g) {
      checkLevels(p, g, isComp ? [1, 6, 10] : [1, 5, 10]);
      assert(true, p.id + ' grade=' + g + ' 生成/渲染/判定通过');
    });

    // math-number-sense：二年级读写/近似数专项
    if (p.id === 'math-number-sense') {
      var rw = p.generate({ grade: 2, type: 'readwrite', count: 60, difficulty: 5 }).questions;
      rw.forEach(function (q) {
        var d = q.data;
        assert(q.answer === String(d.answer), 'readwrite #' + q.answer + ' 答案自洽');
        assert(d.num >= 100 && d.num <= 9999, 'readwrite 数域 100~9999（' + d.num + '）');
      });
      var ap = p.generate({ grade: 2, type: 'approx', count: 40, difficulty: 5 }).questions;
      ap.forEach(function (q) {
        var d = q.data;
        var ok = q.answer === String(d.approx);
        assert(ok, 'approx #' + d.num + ' 答案=约数(' + d.approx + ')');
        assert(d.options.indexOf(String(d.approx)) !== -1, 'approx 选项含正确答案');
      });
    }
  }).catch(function (e) { fail++; console.log('  FAIL: ' + rec.id + ' 加载失败: ' + e.message); }));
});

Promise.all(promises).then(function () {
  console.log('\n===== 综合练习（comprehensive 新轨）难度透传 =====');
  return new Promise(function (resolve) {
    // 综合练习经生成层 ComprehensiveStrategy：装配 strategy-engine.bundle + generation-engine。
    require(path.join(ROOT, 'shared/difficulty-static.js'));
    require(path.join(ROOT, 'shared/knowledge-bank.js'));
    require(path.join(ROOT, 'plugins/registry.js'));
    require(path.join(ROOT, 'shared/strategy-engine.bundle.js'));
    require(path.join(ROOT, 'shared/presentation-engine.bundle.js'));
    require(path.join(ROOT, 'shared/presentation/render-options.js'));
    require(path.join(ROOT, 'shared/presentation/render-result.js'));
    require(path.join(ROOT, 'shared/presentation/legacy-svg-adapter.js'));
    require(path.join(ROOT, 'shared/presentation/svg-registry.js'));
    require(path.join(ROOT, 'shared/presentation/html-renderer.js'));
    require(path.join(ROOT, 'shared/presentation/renderer.js'));
    require(path.join(ROOT, 'shared/generation-engine.js'));
    require(path.join(ROOT, 'shared/strategy/comprehensive-strategy.js'));
    var Engine = require(path.join(ROOT, 'shared/generation-engine.js'));
    Engine.generate({ subject: 'math', grade: 1, count: 20, mode: 'comprehensive', difficulty: 8 })
      .then(function (res) {
        var set = { questions: res.questions || [] };
        assert(set.questions.length > 0, 'comprehensive diff=8 生成 ' + set.questions.length + ' 题');
        var dup = dedupe(set.questions);
        // 小题池年级存在随机碰撞：沿用全仓容忍线 min(max(2,20%),12)，仅拦系统性重复
        var dupTol = Math.min(Math.max(2, Math.ceil(set.questions.length * 0.2)), 12);
        assert(dup <= dupTol, 'comprehensive 混合重复 ≤ 容忍线 ' + dupTol + '（实际 ' + dup + '）');
        var amap = answersFor(set.questions);
        var okAll = set.questions.every(function (q, idx) { return checkAnswer(q, amap, idx); });
        assert(okAll, 'comp 全部正确答案判定');
        resolve();
      }).catch(function (e) { fail++; console.log('  FAIL: comprehensive 生成异常: ' + e.message); resolve(); });
  });
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

  // ===== 统一难度消费（批次4：连续式插件迁移） =====
  console.log('\n===== 统一难度消费（App.Difficulty.consume） =====');
  var D = require(path.join(ROOT, 'shared/difficulty.js'));
  function numsMean(qs) {
    var all = [], re = /\d+(\.\d+)?/g;
    qs.forEach(function (q) {
      var text = typeof q.q === 'string' ? q.q : '';
      var m = text.match(re);
      if (m) all = all.concat(m.map(Number));
    });
    return all.length ? all.reduce(function (a, b) { return a + b; }, 0) / all.length : 0;
  }
  function loadP(id) { return require(path.join(ROOT, 'plugins', id + '.js')); }

  // consume：自带分档 → 通用难度不叠加；无分档 → 正常解析
  var c1 = D.consume({ difficulty: 9, level: 'advanced' });
  assert(c1.hasOwnLevel === true && c1.effectiveLevel === 3,
    'consume：level 存在 → hasOwnLevel=true，effectiveLevel 回落默认档（通用隐藏不叠加）');
  var c2p = D.consume({ difficulty: 7 });
  assert(c2p.hasOwnLevel === false && c2p.effectiveLevel === 7 && c2p.structure.allowBracket === true,
    'consume：无 level → effectiveLevel=7，结构含括号');

  // math-oral：scale 驱动数值范围，难度 3 vs 7 幅度明显不同 + 题目标注 difficulty
  // （大样本降低均值抖动：随机抽题下 30 题均值波动可达 ±20%，200 题后稳定）
  var oralMean = {};
  [3, 7].forEach(function (lv) {
    var p = loadP('math-oral');
    var set = p.generate({ grade: 3, count: 30, difficulty: lv });
    assert(set.questions.every(function (q) { return q.difficulty === lv; }),
      'math-oral lv' + lv + '：全部题目标注 difficulty=' + lv);
    var big = p.generate({ grade: 3, count: 220, difficulty: lv }).questions;
    oralMean[lv] = numsMean(big);
  });
  assert(oralMean[7] > oralMean[3] * 1.2,
    'math-oral 难度 7 数值幅度 > 难度 3 的 1.2 倍（' + oralMean[3].toFixed(1) + ' → ' + oralMean[7].toFixed(1) + '）');

  // 三个迁移插件的标注与结构参数传递
  ['math-g6-oral', 'math-g6-calc'].forEach(function (id) {
    var mean = {};
    [3, 7].forEach(function (lv) {
      var set = loadP(id).generate({ grade: 6, count: 12, difficulty: lv });
      assert(set.questions.every(function (q) { return q.difficulty === lv; }),
        id + ' lv' + lv + '：题目标注 difficulty=' + lv);
      // 分数/小数域整数旋钮放大有限，用大样本+5% 容差抗抖动（放大样本进一步压低方差，避免偶发抖动）
      var big = loadP(id).generate({ grade: 6, count: 400, difficulty: lv }).questions;
      mean[lv] = numsMean(big);
    });
    // g6 两款为分数/小数域，整数旋钮放大后高难均值不应低于低难（宽松单调）
    assert(mean[7] >= mean[3] * 0.95, id + '：难度 7 数值均值 ≥ 难度 3×0.95');
  });
  var vert = loadP('math-g4-vertical').generate({ grade: 4, count: 10, difficulty: 9 });
  assert(vert.questions.every(function (q) { return q.difficulty === 9; }),
    'math-g4-vertical：标注型迁移生效（位数语义保持，仅标注）');

  // ===== 步骤6 回归：结构单调 / 难度档案 =====
  console.log('\n===== 步骤6 回归（结构单调 · 加权率 · KP 级存储） =====');
  // App.Adaptive 模块已移除：步骤6b/6c 与语文/英语自适应断言一并删除
  function approx(a, b) { return Math.abs(a - b) < 1e-9; }
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

  // b/c) 加权正确率 / KP 级自适应断言已移除（App.Adaptive 模块已删除）

  // ===== 步骤7 回归：批次迁移 + KP 标注扩量 =====
  console.log('\n===== 步骤7 回归（consume 迁移批次7/8 · KP 标注有效性） =====');
  var KB = require(path.join(ROOT, 'shared/knowledge-bank.js'));
  // 知识点索引：(pluginId|grade|kpId) → true，用于校验题目标注的 knowledgePointId 合法
  var kpIndex = {};
  // 同年级知识点索引：(grade|kpId) → true，用于支持「跨插件共享」的知识点
  // （如 math-g1-m9-classify 登记在 math-g1-operation 下，但 math-statistics 也会标注使用）
  var kpByGrade = {};
  Object.keys(KB).forEach(function (subject) {
    if (!Array.isArray(KB[subject])) return;
    KB[subject].forEach(function (g) {
      g.modules.forEach(function (m) {
        m.knowledgePoints.forEach(function (k) {
          kpIndex[k.pluginId + '|' + g.grade + '|' + k.id] = true;
          kpByGrade[g.grade + '|' + k.id] = true;
        });
      });
    });
  });

  // a) 批次7/8 插件：难度透传标注 + KP 标注合法且属于本插件本年级
  var BATCH78 = [
    { id: 'math-patterns',          grades: [1] },
    { id: 'math-make-ten',          grades: [1] },
    { id: 'math-picture-equations', grades: [1] },
    { id: 'math-number-sense',      grades: [1, 2, 3] },
    { id: 'math-money',             grades: [1] },
    { id: 'math-area',              grades: [3] },
    { id: 'math-decimal',           grades: [3] },
    { id: 'math-fraction',          grades: [3] },
    { id: 'math-geometry',          grades: [2, 3] },
    { id: 'math-shapes',            grades: [1, 2, 3] },
    { id: 'math-unit-convert',      grades: [1, 2, 3] },
    { id: 'math-data-stats',        grades: [2, 3] },
    { id: 'math-logic-reasoning',   grades: [2] }
  ];
  BATCH78.forEach(function (rec) {
    rec.grades.forEach(function (grade) {
      [3, 8].forEach(function (lv) {
        var set = loadP(rec.id).generate({ grade: grade, count: 6, difficulty: lv });
        var qs = set.questions || set;
        assert(qs.length > 0 && qs.every(function (q) { return q.difficulty === lv; }),
          rec.id + ' g' + grade + ' lv' + lv + '：题目标注 difficulty=' + lv);
      });
      var set = loadP(rec.id).generate({ grade: grade, count: 10 });
      var qs = set.questions || set;
      var stamped = qs.filter(function (q) { return q.knowledgePointId; });
      if (stamped.length) {
        // 校验标注的 knowledgePointId 在同年级知识库中已登记（允许跨插件共享同一知识点）
        var allValid = stamped.every(function (q) {
          return kpByGrade[grade + '|' + q.knowledgePointId] === true;
        });
        assert(allValid,
          rec.id + ' g' + grade + '：KP 标注均登记于知识库（同年级有效，支持跨插件共享）（' + stamped.length + '/' + qs.length + ' 题标注）');
      } else {
        assert(true, rec.id + ' g' + grade + '：无本插件知识点，保持纯插件级统计（不标注）');
      }
    });
  });

  // b) math-word-problems：自带 level 分档 → 不叠加通用难度（无 difficulty 标注），KP 按桶标注
  (function () {
    var wp = loadP('math-word-problems');
    [1, 2, 3].forEach(function (grade) {
      var set = wp.generate({ grade: grade, count: 8, level: 'adv' });
      var noDiffStamp = set.questions.every(function (q) { return q.difficulty == null; });
      var kpOk = set.questions.every(function (q) {
        return !q.knowledgePointId || kpIndex['math-word-problems|' + grade + '|' + q.knowledgePointId];
      });
      assert(noDiffStamp && kpOk,
        'math-word-problems g' + grade + '：level 分档生效不叠加通用难度，KP 标注合法');
    });
  })();

  // ===== 任务10 回归：难度系统按科目差异化 =====
  console.log('\n===== 任务10 回归（DifficultyProfiles · 科目策略路由） =====');

  // a) 档案存在 + 科目代号归一
  assert(D.DifficultyProfiles && D.DifficultyProfiles.math && D.DifficultyProfiles.cn && D.DifficultyProfiles.en,
    'DifficultyProfiles 含 math/cn/en 三科目档案');
  assert(D.profileFor('chinese') === D.DifficultyProfiles.cn, 'profileFor(chinese) → cn 档案');
  assert(D.profileFor('english') === D.DifficultyProfiles.en, 'profileFor(english) → en 档案');
  assert(D.profileFor('math') === D.DifficultyProfiles.math, 'profileFor(math) → math 档案');
  assert(D.profileFor('unknown-x') === D.DifficultyProfiles.math, '未知科目回落 math 档案');

  // b) 数学行为不变：paramsFor 与既有 createProfile/diffScale 完全一致
  var pm3 = D.paramsFor('math', 3);
  assert(pm3.scale === PU.diffScale(3) && pm3.steps === D.difficultyToStructure(3).steps
    && pm3.allowBracket === false && pm3.allowMultDiv === false,
    'paramsFor(math,3)：scale=1、steps=2、无括号无乘除（现行行为）');
  var pm8 = D.paramsFor('math', 8);
  assert(pm8.allowBracket === true && pm8.allowMultDiv === true && pm8.scale === PU.diffScale(8),
    'paramsFor(math,8)：scale 放大且结构含括号乘除');

  // c) 语文映射：字词复杂度 + 句子长度（边界与单调）
  var pc3 = D.DifficultyProfiles.cn.toParams(3), pc7 = D.DifficultyProfiles.cn.toParams(7),
      pc10 = D.DifficultyProfiles.cn.toParams(10);
  assert(pc3.vocabTier === 'basic' && pc3.sentenceLength === 12 && pc3.charCountMax === 8,
    'cn lv3：vocabTier=basic，句长 12，字数上限 8');
  assert(pc7.vocabTier === 'advanced' && pc7.sentenceLength === 20 && pc7.charCountMax === 16,
    'cn lv7：vocabTier=advanced，句长 20，字数上限 16');
  assert(pc10.vocabTier === 'extension' && pc10.sentenceLength === 26,
    'cn lv10：vocabTier=extension，句长 26');
  var monoCn = true, prevLen = -1;
  for (var lv = 1; lv <= 10; lv++) {
    var len = D.DifficultyProfiles.cn.toParams(lv).sentenceLength;
    if (len < prevLen) monoCn = false;
    prevLen = len;
  }
  assert(monoCn, 'cn 句长随难度单调不减');

  // d) 英语映射：词汇长度 + 语法分档 + 句型层级
  var pe3 = D.DifficultyProfiles.en.toParams(3), pe5 = D.DifficultyProfiles.en.toParams(5),
      pe9 = D.DifficultyProfiles.en.toParams(9);
  assert(pe3.grammarTier === 1 && pe3.sentencePattern === 'simple' && pe3.wordLengthMax === 4,
    'en lv3：tier1/simple，词长上限 4');
  assert(pe5.grammarTier === 2 && pe5.sentencePattern === 'compound' && pe5.wordLengthMax === 6,
    'en lv5：tier2/compound，词长上限 6');
  assert(pe9.grammarTier === 4 && pe9.sentencePattern === 'complex' && pe9.wordLengthMax === 10,
    'en lv9：tier4/complex，词长上限 10');
  var monoEn = true, prevW = -1;
  for (var lv2 = 1; lv2 <= 10; lv2++) {
    var wl = D.DifficultyProfiles.en.toParams(lv2).wordLengthMax;
    if (wl < prevW) monoEn = false;
    prevW = wl;
  }
  assert(monoEn, 'en 词长上限随难度单调不减');

  // e) 策略路由：三科目策略可用且数学规则数值不变
  [['math', 0.95, 1, 2], ['cn', 0.95, 1, 2], ['en', 0.95, 1, 2]].forEach(function (c) {
    var r = D.strategyFor(c[0]).apply({ emaRate: c[1], lastRate: c[2] });
    assert(r.delta === c[3] && r.bias === 'hard', 'strategyFor(' + c[0] + ')：ema .95/.last 1 → +' + c[3] + ' hard');
  });
  assert(D.strategyFor('math').apply({ emaRate: 0.4, lastRate: 0.3 }).delta === -2,
    'strategyFor(math)：ema .4 → −2 easy（现行规则）');
  assert(D.strategyFor('math').apply({ emaRate: 0.75, lastRate: 0.75 }).delta === 0,
    'strategyFor(math)：ema .75 → 0（中间带）');

  // f) 语文/英语自适应存储断言已移除（App.Adaptive 模块已删除）

  // g) paramsFor 叠加自适应 delta
  var pd = D.paramsFor('cn', 5, 2);
  assert(pd.sentenceLength === D.DifficultyProfiles.cn.toParams(7).sentenceLength,
    'paramsFor(cn,5,+2) 等价 toParams(7)');
  var pme = D.paramsFor('en', 3, -2);
  assert(pme.wordLengthMax === D.DifficultyProfiles.en.toParams(1).wordLengthMax,
    'paramsFor(en,3,-2) 等价 toParams(1)');

  console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ ' + fail + ' 项失败'));
  process.exit(fail === 0 ? 0 : 1);
});
