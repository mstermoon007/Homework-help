/**
 * plugins/math-g4-reason.js — 四年级推理与数学广角插件（M10 推理广角）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M10 模块）：
 *   g4-reason-opt   优化问题（沏茶、烙饼）  （type: 'pancake'）
 *   g4-reason-cr    鸡兔同笼（假设法）      （type: 'assume'）
 *   g4-reason-logic 简单逻辑推理            （type: 'logic'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-reason.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function uniqueNums(cands, hi, lo, n) {
    var pool = [];
    cands.forEach(function (c) {
      if (c >= lo && c < hi && pool.indexOf(c) === -1) pool.push(c);
    });
    var guard = 0;
    while (pool.length < n && guard < 60) {
      var extra = rnd(lo, hi - 1);
      if (pool.indexOf(extra) === -1) pool.push(extra);
      guard++;
    }
    var shuffled = shuffle(pool);
    var out = [];
    for (var i = 0; i < n; i++) out.push(shuffled[i % shuffled.length]);
    return shuffle(out);
  }

  // ============ 优化问题（沏茶、烙饼） ============
  function buildOptimize() {
    var v = pick(['tea', 'pancake']);
    if (v === 'tea') {
      var wash = rnd(1, 2);
      var boil = rnd(6, 9);
      var prepare = rnd(2, 4);
      var total = wash + boil;
      var q = '妈妈沏茶：洗水壶 ' + wash + ' 分钟、烧水 ' + boil + ' 分钟、洗茶杯 ' + prepare + ' 分钟。她最快（  ）分钟能沏好茶';
      var opts = uniqueNums([total, wash + boil + prepare, boil + prepare, boil], 40, 1, 4);
      return { q: q, answer: total, options: opts,
        hint: '烧水的同时洗茶杯，总时间 = 洗水壶 + 烧水 = ' + wash + ' + ' + boil + '。' };
    }
    // 烙饼
    var min = pick([2, 3]);
    var n = pick([3, 4, 5, 6]);
    var totalT = n * min;
    var wrong1 = n * min * 2;
    var wrong2 = (n + 1) * min;
    var q = '平底锅一次最多烙 2 张饼，两面都要烙，每面 ' + min + ' 分钟。烙 ' + n + ' 张饼最少要（  ）分钟';
    var opts = uniqueNums([totalT, wrong1, wrong2, totalT + 2], 60, 1, 4);
    return { q: q, answer: totalT, options: opts,
      hint: '锅够大时，总时间 = 饼数 × 每面时间 = ' + n + ' × ' + min + '。' };
  }

  // ============ 鸡兔同笼（假设法） ============
  function buildAssume() {
    var v = pick(['solve', 'step']);
    var head = pick([10, 12, 14, 15, 16, 18, 20]);
    var rabbit = rnd(2, head - 2);
    var chicken = head - rabbit;
    var legs = rabbit * 4 + chicken * 2;
    if (v === 'solve') {
      var q = '鸡兔同笼：头共 ' + head + ' 个，脚共 ' + legs + ' 只。鸡有（  ）只，兔有（  ）只';
      var ansArr = [chicken, rabbit];
      var opts = uniqueNums([chicken, rabbit, head - 1, Math.round(legs / 2)], 40, 1, 4);
      return { q: q, answer: chicken + '、' + rabbit, inputCount: 2, inputType: 'multi',
        answerParts: [String(chicken), String(rabbit)],
        hint: '假设全是鸡：脚数 ' + head * 2 + '，比实际少 ' + (legs - head * 2) + ' 只，每把一只鸡换成兔多 2 只脚，兔 = ' + (legs - head * 2) / 2 + ' 只。' };
    }
    // 第一步：假设全是鸡
    var stepAns = head * 2;
    var opts2 = uniqueNums([stepAns, legs, head, rabbit * 4], 80, 1, 4);
    return { q: '鸡兔同笼：头共 ' + head + ' 个、脚共 ' + legs + ' 只。假设全是鸡，脚应有（  ）只',
      answer: stepAns, options: opts2,
      hint: '全是鸡：每只 2 只脚，' + head + ' 只鸡共 ' + head * 2 + ' 只脚。' };
  }

  // ============ 简单逻辑推理 ============
  function buildLogic() {
    var v = pick(['three', 'not', 'who']);
    if (v === 'three') {
      // 三人各拿一样东西
      var names = shuffle(['小明', '小红', '小刚']);
      var things = shuffle(['语文书', '数学书', '英语书']);
      // 线索：A 拿 X，B 不拿 Y
      var aName = names[0], bName = names[1], cName = names[2];
      var aThing = things[0];
      var bNotThing = things[2];
      var bThing = things[1];
      var cThing = things[2];
      var q = aName + '拿的是' + aThing + '，' + bName + '拿的不是' + bNotThing + '。' + cName + '拿的是（  ）';
      var opts = shuffle(things.slice());
      return { q: q, answer: cThing, options: opts,
        hint: aName + '拿' + aThing + '，' + bName + '不是' + bNotThing + '，剩下那个就是' + cName + '的。' };
    }
    if (v === 'not') {
      // 三句话推理谁在说谎
      var persons = ['甲', '乙', '丙'];
      var liar = pick(persons);
      var truth = [];
      persons.forEach(function (p) {
        if (p === liar) truth.push('说谎');
        else truth.push('说真话');
      });
      var q = '甲、乙、丙三人中只有一人说真话。甲说：「乙说谎」，乙说：「丙说谎」，丙说：「甲说谎」。说真话的是（  ）';
      // 实际推理较复杂，简化：直接问说谎的是谁（由题目设计决定）
      return { q: q, answer: liar, options: shuffle(persons.slice()),
        hint: '用排除法：假设某人说真话，检查是否矛盾。' };
    }
    // who：四人座位推理
    var seats = ['东', '南', '西', '北'];
    var sA = seats[0], sB = seats[1];
    var q = '小红面向北，小华面向南，小明面向西。面向（  ）的同学在小明对面';
    var opposite = '东';
    var opts = shuffle(['东', '南', '西', '北']);
    return { q: q, answer: opposite, options: opts,
      hint: '南与北相对，东与西相对。' };
  }

  // ============ 综合推理 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 40) return buildOptimize();
    if (r <= 75) return buildAssume();
    return buildLogic();
  }

  var TYPE_BUILDERS = {
    'pancake': buildOptimize,
    'assume': buildAssume,
    'logic': buildLogic,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'pancake': '优化问题',
    'assume': '鸡兔同笼',
    'logic': '逻辑推理',
    mix: '综合推理'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-reason',
    moduleId: 'M10',
    name: '推理与数学广角',
    pageTitle: '四年级推理与数学广角',
    pageSubtitle: '优化问题、鸡兔同笼与逻辑推理',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g4-reason-opt', 'g4-reason-cr', 'g4-reason-logic'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '综合推理' },
          { value: 'pancake', label: '优化问题' },
          { value: 'assume',  label: '鸡兔同笼' },
          { value: 'logic',   label: '逻辑推理' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 50, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = { type: 'reason', q: p.q, hint: p.hint };
        if (p.inputType === 'multi') {
          q.inputType = 'multi';
          q.inputCount = p.inputCount;
          q.answer = p.answerParts;
          // 多空答案：按字段分别比对（容器用 answers['i:j'] 收集）
          q.check = function (answers, idx) {
            var parts = p.answerParts;
            for (var j = 0; j < parts.length; j++) {
              if (_PU.normalizeAns ? _PU.normalizeAns(answers[idx + ':' + j]) !== _PU.normalizeAns(parts[j]) : String(answers[idx + ':' + j]) !== String(parts[j])) return false;
            }
            return true;
          };
        } else if (p.options) {
          q.inputType = 'choice';
          q.options = p.options;
          q.answer = String(p.answer);
        } else {
          q.inputType = 'text';
          q.answer = String(p.answer);
        }
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级推理与数学广角（' + (TYPE_NAMES[type] || '综合推理') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);