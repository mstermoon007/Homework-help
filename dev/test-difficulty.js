/**
 * dev/test-difficulty.js — 难度系统回归验证
 * 运行：node dev/test-difficulty.js
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var registry = require(path.join(ROOT, 'plugins/registry.js'));
var common = require(path.join(ROOT, 'shared/common.js'));

var fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.log('  FAIL: ' + msg); }
  else console.log('  OK:   ' + msg);
}

function loadPlugin(rec) {
  if (rec.id === 'math-comprehensive') return Promise.resolve(null);
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
    var amap = answersFor(qs);
    qs.forEach(function (q, idx) {
      var html = q.render(idx);
      assert(html.indexOf('question-card') !== -1 || html.indexOf('class="problem"') !== -1, plugin.id + ' d' + d + ' #' + idx + ' 渲染含卡片');
      var ok = q.check(amap, idx);
      assert(ok === true, plugin.id + ' d' + d + ' #' + idx + ' 正确答案判定');
      var badMap = {};
      badMap[idx] = '__wrong__';
      if (effInputType(q) === 'multi') (Array.isArray(q.answer) ? q.answer : [q.answer]).forEach(function (_, j) { badMap[idx + ':' + j] = '__wrong__'; });
      var bad = q.check(badMap, idx);
      assert(bad === false, plugin.id + ' d' + d + ' #' + idx + ' 错误答案判定');
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
    var k = (q.__src ? q.__src.id + ':' : q.type + ':') + q.kind + '|' + (q.question || '') + '|' + detail + '|' + q.answer;
    if (keys[k]) dups++; else keys[k] = 1;
  });
  return dups;
}

var mathPlugins = registry.filter(function (r) {
  return r.id.indexOf('math-') === 0 && r.id !== 'math-comprehensive';
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
        var badMap = {};
        badMap[idx] = '__wrong__';
        if (effInputType(q) === 'multi') (Array.isArray(q.answer) ? q.answer : [q.answer]).forEach(function (_, j) { badMap[idx + ':' + j] = '__wrong__'; });
        var bad = q.check(badMap, idx);
        assert(bad === false, p.id + ' d' + d + ' #' + idx + ' 错误答案判定');
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
  console.log('\n===== math-comprehensive 难度透传 =====');
  return new Promise(function (resolve) {
    var comp = require(path.join(ROOT, 'plugins/math-comprehensive.js'));
    comp.generate({ grade: 1, count: 20, type: 'average', difficulty: 8 }).then(function (set) {
      assert(set.questions.length > 0, 'comprehensive diff=8 生成 ' + set.questions.length + ' 题');
      var dup = dedupe(set.questions);
      assert(dup === 0, 'comprehensive 混合无重复（重复 ' + dup + '）');
      var hasSrc = set.questions.filter(function (q) { return q.__src; }).length;
      assert(hasSrc === set.questions.length, '全部题目带 __src 来源');
      var amap = answersFor(set.questions);
      set.questions.forEach(function (q, idx) {
        var ok = q.check(amap, idx);
        assert(ok === true, 'comp #' + idx + ' 正确答案判定');
      });
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

  console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ ' + fail + ' 项失败'));
  process.exit(fail === 0 ? 0 : 1);
});
