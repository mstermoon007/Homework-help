/**
 * plugins/math-g2-judge.js — 二年级判断题插件（M11 判断）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M11 模块）：
 *   math-g2-m11-judge-mixed      判断综合        （category: mix）
 *
 * 判断题以 choice 呈现（√ / ×），复用 renderCard 的 choice 分支（mirror math-g1-judge）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g2-judge.js 依赖 shared/common.js（PluginUtil），请先加载');


  // 每条：{ q: 题干, right: boolean, hint: 解析, cat: 类别 }
  var STATEMENTS = [
    // 角（锐角 < 直角 < 钝角；直角是 90°；角的大小与边长短无关）
    { q: '锐角比直角小。', right: true, hint: '锐角小于 90°，直角等于 90°，所以锐角比直角小。', cat: 'angle' },
    { q: '钝角比直角大。', right: true, hint: '钝角大于 90°，所以钝角比直角大。', cat: 'angle' },
    { q: '直角是 90°。', right: true, hint: '直角的大小正好是 90°。', cat: 'angle' },
    { q: '角的大小与边的长短有关。', right: false, hint: '角的大小只与两边张开的程度有关，与边的长短无关。', cat: 'angle' },
    { q: '三角尺上有一个直角。', right: true, hint: '常用的三角尺都有一个直角。', cat: 'angle' },
    { q: '所有的角都比直角大。', right: false, hint: '锐角比直角小，钝角比直角大，并非所有角都比直角大。', cat: 'angle' },

    // 图形运动（平移 / 旋转 / 轴对称）
    { q: '推拉窗户属于平移现象。', right: true, hint: '推拉窗户时物体沿直线移动，方向大小不变，是平移。', cat: 'motion' },
    { q: '电梯上下运动属于平移。', right: true, hint: '电梯沿直线上下移动，是平移。', cat: 'motion' },
    { q: '风车转动属于旋转现象。', right: true, hint: '风车绕中心转动，是旋转。', cat: 'motion' },
    { q: '平移会改变图形的方向。', right: false, hint: '平移只改变位置，不改变图形的方向和大小。', cat: 'motion' },
    { q: '旋转会改变图形的大小。', right: false, hint: '旋转只改变方向和位置，不改变图形的大小。', cat: 'motion' },
    { q: '照镜子时看到的像与自己是对称的。', right: true, hint: '镜子成像左右相反，属于轴对称现象。', cat: 'motion' },

    // 单位换算（米/厘米、千克/克、时/分）
    { q: '1 米 = 100 厘米。', right: true, hint: '米和厘米的进率是 100。', cat: 'unit' },
    { q: '1 千克 = 1000 克。', right: true, hint: '千克与克的进率是 1000。', cat: 'unit' },
    { q: '1 时 = 60 分。', right: true, hint: '1 小时 = 60 分钟。', cat: 'unit' },
    { q: '3 米 = 30 厘米。', right: false, hint: '1 米 = 100 厘米，3 米 = 300 厘米。', cat: 'unit' },
    { q: '5 千克 = 5000 克。', right: true, hint: '1 千克 = 1000 克，5 千克 = 5000 克。', cat: 'unit' },
    { q: '半小时就是 30 分。', right: true, hint: '1 时 = 60 分，半小时 = 30 分。', cat: 'unit' },

    // 余数（余数比除数小；余数可以是 0 吗？——能整除时余数为 0）
    { q: '在有余数的除法里，余数一定比除数小。', right: true, hint: '余数必须比除数小，否则还能再分。', cat: 'rem' },
    { q: '23 ÷ 5 = 4……3，这里余数是 3。', right: true, hint: '23 = 5×4 + 3，余数是 3，且 3 < 5。', cat: 'rem' },
    { q: '余数可以比除数大。', right: false, hint: '余数必须比除数小。', cat: 'rem' },
    { q: '15 ÷ 3 = 5，这道除法没有余数。', right: true, hint: '15 能被 3 整除，余数为 0。', cat: 'rem' },
    { q: '把 10 块糖平均分给 3 人，每人 3 块，还剩 1 块。', right: true, hint: '3×3=9，10-9=1，余 1 块。', cat: 'rem' },

    // 计算正误（两位数加减、表内乘除、有余数除法）
    { q: '37 + 25 = 62。', right: true, hint: '个位 7+5=12 进 1，十位 3+2+1=6，得 62。', cat: 'calc' },
    { q: '52 - 27 = 25。', right: true, hint: '个位 2 减 7 不够，向十位借 1，12-7=5；十位 4-2=2，得 25。', cat: 'calc' },
    { q: '8 × 7 = 56。', right: true, hint: '口诀“七八五十六”。', cat: 'calc' },
    { q: '42 ÷ 6 = 7。', right: true, hint: '想“六七四十二”，所以 42÷6=7。', cat: 'calc' },
    { q: '15 - 8 = 6。', right: false, hint: '15-8 应等于 7，不是 6。', cat: 'calc' },
    { q: '6 × 9 = 54。', right: true, hint: '口诀“六九五十四”。', cat: 'calc' },
    { q: '80 - 25 - 18 = 37。', right: true, hint: '80-25=55，55-18=37。', cat: 'calc' },
    { q: '3 × 4 + 2 = 14。', right: false, hint: '先算乘法 3×4=12，再算加法 12+2=14？不对，12+2=14 是对的——注意：3×4+2=14 正确。', right2: true, cat: 'calc' }
  ];

  // 修正上面最后一条（保证答案正确）
  STATEMENTS[STATEMENTS.length - 1].right = true;
  STATEMENTS[STATEMENTS.length - 1].hint = '先算乘法 3×4=12，再算加法 12+2=14，正确。';

  function buildOf(cat) {
    var pool = STATEMENTS.filter(function (s) { return s.cat === cat; });
    return pool[_PU.randInt(0, pool.length - 1)];
  }
  function buildMixed() { return STATEMENTS[_PU.randInt(0, STATEMENTS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed,
    'judge': buildMixed,
    'angle': function () { return buildOf('angle'); },
    'motion': function () { return buildOf('motion'); },
    'unit': function () { return buildOf('unit'); },
    'rem': function () { return buildOf('rem'); },
    'calc': function () { return buildOf('calc'); }
  };
  var TYPE_NAMES = {
    'mix': '综合判断', 'judge': '综合判断', 'angle': '角的认识', 'motion': '图形运动',
    'unit': '单位换算', 'rem': '有余数除法', 'calc': '计算正误'
  };

  var _pool = _PU.createPoolCache('math-g2-judge:mix', function () { return STATEMENTS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-judge',
    moduleId: 'M11',
    name: '判断题',
    pageSubtitle: '角的认识、图形运动、单位换算、有余数除法与计算正误',
    grades: [2],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      2: ['math-g2-m11-judge-mixed']
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',    label: '综合判断' },
          { value: 'angle',  label: '角的认识' },
          { value: 'motion', label: '图形运动' },
          { value: 'unit',   label: '单位换算' },
          { value: 'rem',    label: '有余数除法' },
          { value: 'calc',   label: '计算正误' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return {
          type: 'judge',
          q: p.q,
          answer: p.right ? '√' : '×',
          options: _PU.shuffle(['√', '×']),
          inputType: 'choice',
          hint: p.hint
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学二年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
