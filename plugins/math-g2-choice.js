/**
 * plugins/math-g2-choice.js — 二年级选择题插件（M12 选择）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M12 模块）：
 *   math-g2-m12-choice-mixed    选择综合      （category: mix）
 *
 * 每题 4 个选项：正确答案 + 常见错误干扰项；renderCard 的 choice 分支 + 数值批改。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g2-choice.js 依赖 shared/common.js（PluginUtil），请先加载');


  // 每条：{ q, answer, wrong: 干扰项[3], hint, cat }
  var ITEMS = [
    // 计算（两位数加减、表内乘除、有余数除法）
    { q: '37 + 25 = ?', answer: '62', wrong: ['52', '63', '61'], hint: '个位 7+5=12 进 1，十位 3+2+1=6，得 62。', cat: 'calc' },
    { q: '52 - 27 = ?', answer: '25', wrong: ['35', '24', '26'], hint: '个位 2-7 不够借位得 5，十位 4-2=2，得 25。', cat: 'calc' },
    { q: '8 × 7 = ?', answer: '56', wrong: ['54', '63', '48'], hint: '口诀“七八五十六”。', cat: 'calc' },
    { q: '42 ÷ 6 = ?', answer: '7', wrong: ['6', '8', '9'], hint: '想“六七四十二”，42÷6=7。', cat: 'calc' },
    { q: '23 ÷ 5 = ?', answer: '4……3', wrong: ['4……2', '5', '3……8'], hint: '5×4=20，23-20=3，商 4 余 3。', cat: 'calc' },
    { q: '6 × 9 = ?', answer: '54', wrong: ['45', '63', '56'], hint: '口诀“六九五十四”。', cat: 'calc' },
    { q: '80 - 25 - 18 = ?', answer: '37', wrong: ['47', '43', '33'], hint: '80-25=55，55-18=37。', cat: 'calc' },
    { q: '3 × 4 + 2 = ?', answer: '14', wrong: ['20', '12', '18'], hint: '先算乘法 3×4=12，再算加法 12+2=14。', cat: 'calc' },
    { q: '(3 + 4) × 2 = ?', answer: '14', wrong: ['20', '11', '13'], hint: '先算括号 3+4=7，再算 7×2=14。', cat: 'calc' },
    { q: '45 + 20 + 15 = ?', answer: '80', wrong: ['70', '75', '85'], hint: '45+20=65，65+15=80。', cat: 'calc' },

    // 概念辨析（角）
    { q: '下面哪个角最大？', answer: '钝角', wrong: ['锐角', '直角', '一样大'], hint: '钝角 > 直角 > 锐角，所以钝角最大。', cat: 'angle' },
    { q: '三角尺上的直角是几度？', answer: '90°', wrong: ['45°', '180°', '60°'], hint: '直角等于 90°。', cat: 'angle' },
    { q: '钟面上 3 时整，时针和分针成什么角？', answer: '直角', wrong: ['锐角', '钝角', '平角'], hint: '3 时整时针指 3、分针指 12，夹角 90° 是直角。', cat: 'angle' },

    // 概念辨析（图形运动）
    { q: '下面哪种是平移现象？', answer: '推拉抽屉', wrong: ['风车转动', '旋转木马', '钟表指针走'], hint: '推拉抽屉沿直线移动，是平移。', cat: 'motion' },
    { q: '下面哪种是旋转现象？', answer: '拧瓶盖', wrong: ['滑滑梯', '拉窗帘', '乘电梯'], hint: '拧瓶盖绕中心转动，是旋转。', cat: 'motion' },

    // 单位换算
    { q: '3 米等于多少厘米？', answer: '300 厘米', wrong: ['30 厘米', '3 厘米', '3000 厘米'], hint: '1 米=100 厘米，3 米=300 厘米。', cat: 'unit' },
    { q: '5 千克等于多少克？', answer: '5000 克', wrong: ['500 克', '50 克', '50000 克'], hint: '1 千克=1000 克，5 千克=5000 克。', cat: 'unit' },
    { q: '1 时 30 分等于多少分？', answer: '90 分', wrong: ['130 分', '60 分', '100 分'], hint: '1 时=60 分，60+30=90 分。', cat: 'unit' },
    { q: '一枚硬币厚约 1（ ）。', answer: '毫米', wrong: ['厘米', '分米', '米'], hint: '硬币很薄，用毫米作单位合适。', cat: 'unit' },
    { q: '一棵大树高约 8（ ）。', answer: '米', wrong: ['厘米', '分米', '毫米'], hint: '大树较高，用米作单位合适。', cat: 'unit' },

    // 有余数除法概念
    { q: '在有余数的除法里，余数和除数比较（ ）。', answer: '余数 < 除数', wrong: ['余数 > 除数', '余数 = 除数', '不能确定'], hint: '余数必须比除数小。', cat: 'rem' },
    { q: '□ ÷ 6 = 4……△，△最大是（ ）。', answer: '5', wrong: ['6', '4', '3'], hint: '余数要比除数 6 小，最大是 5。', cat: 'rem' },
    { q: '□ ÷ △ = 7……3，除数最小是（ ）。', answer: '4', wrong: ['3', '5', '2'], hint: '余数 3，除数要比余数大，最小是 4。', cat: 'rem' },

    // 比较与运算顺序
    { q: '3 × 4 ○ 12，○里应填（ ）。', answer: '=', wrong: ['>', '<', '≠'], hint: '3×4=12，两边相等。', cat: 'order' },
    { q: '先算括号的算式是（ ）。', answer: '(3+4)×2', wrong: ['3+4×2', '3×4+2', '45+20+15'], hint: '带小括号的算式要先算括号里面的。', cat: 'order' },
    { q: '24 ÷ (3 + 5) = ?', answer: '3', wrong: ['8', '6', '1'], hint: '先算括号 3+5=8，再算 24÷8=3。', cat: 'order' },
    { q: '15 - 7 ○ 9，○里应填（ ）。', answer: '<', wrong: ['>', '=', '≥'], hint: '15-7=8，8 < 9。', cat: 'order' },

    // 看图列式 / 乘法意义
    { q: '4 个 5 相加，写成乘法算式是（ ）。', answer: '4 × 5', wrong: ['4 + 5', '5 × 5', '4 + 4'], hint: '4 个 5 相加可以写作 4×5 或 5×4。', cat: 'meaning' },
    { q: '“三五十五”可以计算（ ）。', answer: '3 × 5 = 15', wrong: ['3 + 5 = 15', '15 ÷ 3 = 4', '5 - 3 = 15'], hint: '口诀“三五十五”对应 3×5=15 和 15÷3=5。', cat: 'meaning' },
    { q: '把 12 个苹果平均分成 3 盘，每盘几个？', answer: '4 个', wrong: ['3 个', '9 个', '15 个'], hint: '12÷3=4，每盘 4 个。', cat: 'meaning' }
  ];

  function buildOf(cat) {
    var pool = ITEMS.filter(function (s) { return s.cat === cat; });
    return pool[_PU.randInt(0, pool.length - 1)];
  }
  function buildMixed() { return ITEMS[_PU.randInt(0, ITEMS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed, 'choice': buildMixed,
    'calc': function () { return buildOf('calc'); },
    'angle': function () { return buildOf('angle'); },
    'motion': function () { return buildOf('motion'); },
    'unit': function () { return buildOf('unit'); },
    'rem': function () { return buildOf('rem'); },
    'order': function () { return buildOf('order'); },
    'meaning': function () { return buildOf('meaning'); }
  };
  var TYPE_NAMES = {
    'mix': '综合选择', 'choice': '综合选择', 'calc': '计算', 'angle': '角的认识',
    'motion': '图形运动', 'unit': '单位换算', 'rem': '有余数除法', 'order': '运算顺序', 'meaning': '乘法意义'
  };

  var _pool = _PU.createPoolCache('math-g2-choice:mix', function () { return ITEMS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '计算、角的认识、图形运动、单位换算与有余数除法',
    grades: [2],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      2: ['math-g2-m12-choice-mixed']
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '综合选择' },
          { value: 'calc',    label: '计算' },
          { value: 'angle',   label: '角的认识' },
          { value: 'motion',  label: '图形运动' },
          { value: 'unit',    label: '单位换算' },
          { value: 'rem',     label: '有余数除法' },
          { value: 'order',   label: '运算顺序' },
          { value: 'meaning', label: '乘法意义' }
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
          type: 'choice',
          q: p.q,
          answer: p.answer,
          options: _PU.shuffle([p.answer].concat(p.wrong)),
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
        title: '小学二年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
