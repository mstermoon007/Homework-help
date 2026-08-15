/**
 * shared/knowledge-bank.js — 数学知识库（统一结构，1-6 年级）
 *
 * 数据结构：
 *   KnowledgeBank = [
 *     {
 *       grade: 1,
 *       modules: [
 *         {
 *           moduleId: 'M0',                 // 对应 shared/module-catalog.js 中的题型模块 ID
 *           knowledgePoints: [
 *             { id, name, pluginId, weight, type }
 *             // weight：抽题比例权重（综合练习按此分配题量），也用于题型选择页排序
 *             // type：推荐传给插件 generate 的 opts.type（细分子题型），省略则用插件默认
 *           ]
 *         }
 *       ]
 *     },
 *     // grade 2, 3, ... 后续自动追加
 *   ]
 *
 * 浏览器：<script src="shared/knowledge-bank.js"></script> -> 全局 KnowledgeBank（数组）
 * Node：  const KnowledgeBank = require('./shared/knowledge-bank.js')
 *
 * 便捷查询（挂在数组对象上）：
 *   KnowledgeBank.findGrade(g)                    -> 该年级对象（{grade, modules}）或 null
 *   KnowledgeBank.getEntries(subject, grade)      -> 扁平知识点数组 [{id,name,pluginId,moduleId,weight,type}]
 *   KnowledgeBank.getCoverage(subject, grade, ids)-> 覆盖统计（ids 为已注册且适用该年级的插件 id 集合）
 *   KnowledgeBank.coverageFromRegistry(...)       -> 同上，但自动从注册表提取覆盖插件 id
 *
 * weight 由旧数据结构中的 importance 映射得到：
 *   importance 5 / 4 -> weight 3，3 / 2 -> weight 2，1 -> weight 1
 *   （importance 代表课时占比/重要度，weight 用于抽题比例，取小量级便于展示与排序）
 */
(function (global) {
  'use strict';

  var KnowledgeBank = [
    // ==================================================================
    //  一年级
    // ==================================================================
    {
      grade: 1,
      modules: [
        {
          moduleId: 'M0',
          knowledgePoints: [
            { id: 'make-ten', name: '凑十法', pluginId: 'math-make-ten', weight: 1, type: 'cushi' },
            { id: 'make-ten-ping', name: '平十法', pluginId: 'math-make-ten', weight: 1, type: 'pingshi' },
            { id: 'make-ten-po', name: '破十法', pluginId: 'math-make-ten', weight: 1, type: 'poshi' }
          ]
        },
        {
          moduleId: 'M1',
          knowledgePoints: [
            { id: 'addsub-20', name: '20 以内加减法', pluginId: 'math-oral', weight: 3, type: 'addsub' }
          ]
        },
        {
          moduleId: 'M4',
          knowledgePoints: [
            { id: 'count', name: '数数与顺序', pluginId: 'math-number-sense', weight: 2, type: 'count' },
            { id: 'compose-digit', name: '数的组成与数位', pluginId: 'math-number-sense', weight: 2, type: 'compose' },
            { id: 'compare', name: '比大小', pluginId: 'math-number-sense', weight: 2, type: 'compare' },
            { id: 'clock-hour', name: '认识钟表（整时）', pluginId: 'math-clock', weight: 2, type: 'read' },
            { id: 'patterns', name: '找规律', pluginId: 'math-patterns', weight: 2, type: 'mix' },
            { id: 'money', name: '认识人民币', pluginId: 'math-money', weight: 2, type: 'mix' }
          ]
        },
        {
          moduleId: 'M6',
          knowledgePoints: [
            { id: 'solid-shapes', name: '认识立体图形', pluginId: 'math-shapes', weight: 2, type: 'solid' },
            { id: 'flat-shapes', name: '认识平面图形', pluginId: 'math-shapes', weight: 2, type: 'flat' },
            { id: 'shape-compose', name: '图形拼组', pluginId: 'math-shapes', weight: 2, type: 'count' },
            { id: 'position', name: '上下左右位置', pluginId: 'math-shapes', weight: 2, type: 'position' }
          ]
        },
        {
          moduleId: 'M7',
          knowledgePoints: [
            { id: 'picture-equations', name: '看图列式', pluginId: 'math-picture-equations', weight: 2, type: 'mix' }
          ]
        },
        {
          moduleId: 'M8',
          knowledgePoints: [
            { id: 'chain-mixed', name: '连加连减与加减混合', pluginId: 'math-word-problems', weight: 2, type: 'mix' },
            { id: 'solve-problems', name: '解决问题', pluginId: 'math-word-problems', weight: 3, type: 'mix' }
          ]
        },
        {
          moduleId: 'M9',
          knowledgePoints: [
            { id: 'classify', name: '分类与整理', pluginId: 'math-statistics', weight: 2, type: 'classify' },
            { id: 'stats-table', name: '填写简单统计表', pluginId: 'math-statistics', weight: 2, type: 'table' },
            { id: 'pictograph', name: '象形统计图', pluginId: 'math-statistics', weight: 2, type: 'picto' }
          ]
        }
      ]
    },

    // ==================================================================
    //  二年级
    // ==================================================================
    {
      grade: 2,
      modules: [
        {
          moduleId: 'M1',
          knowledgePoints: [
            { id: 'addsub-100', name: '100 以内加减法', pluginId: 'math-oral', weight: 3, type: 'addsub' },
            { id: 'muldiv', name: '表内乘除法', pluginId: 'math-oral', weight: 3, type: 'muldiv' },
            { id: 'remainder', name: '有余数除法', pluginId: 'math-oral', weight: 3, type: 'remainder' },
            { id: 'mixed', name: '混合运算', pluginId: 'math-oral', weight: 3, type: 'mixed' }
          ]
        },
        {
          moduleId: 'M4',
          knowledgePoints: [
            { id: 'readwrite', name: '万以内数的读写', pluginId: 'math-number-sense', weight: 2, type: 'readwrite' },
            { id: 'compose-4', name: '数的组成与数位', pluginId: 'math-number-sense', weight: 2, type: 'compose' },
            { id: 'approx', name: '近似数', pluginId: 'math-number-sense', weight: 2, type: 'approx' },
            { id: 'unit-convert', name: '单位换算', pluginId: 'math-unit-convert', weight: 2, type: 'convert' },
            { id: 'fill-unit', name: '填合适单位', pluginId: 'math-unit-convert', weight: 2, type: 'fillUnit' }
          ]
        },
        {
          moduleId: 'M6',
          knowledgePoints: [
            { id: 'shapes-2', name: '认识图形', pluginId: 'math-shapes', weight: 2, type: 'mix' },
            { id: 'angles', name: '角的初步认识', pluginId: 'math-geometry', weight: 2, type: 'angleClass' },
            { id: 'motion', name: '图形的运动', pluginId: 'math-geometry', weight: 2, type: 'motion' },
            { id: 'grid', name: '方格纸', pluginId: 'math-geometry', weight: 2, type: 'grid' }
          ]
        },
        {
          moduleId: 'M8',
          knowledgePoints: [
            { id: 'wp-solve', name: '解决问题', pluginId: 'math-word-problems', weight: 3, type: 'mix' }
          ]
        },
        {
          moduleId: 'M9',
          knowledgePoints: [
            { id: 'data-tally', name: '数据收集与整理', pluginId: 'math-data-stats', weight: 2, type: 'tally' },
            { id: 'data-question', name: '根据统计结果回答问题', pluginId: 'math-data-stats', weight: 2, type: 'result' }
          ]
        },
        {
          moduleId: 'M10',
          knowledgePoints: [
            { id: 'logic-reasoning', name: '简单逻辑推理', pluginId: 'math-logic-reasoning', weight: 2, type: 'bookGuess' },
            { id: 'sudoku3', name: '3×3 数独', pluginId: 'math-logic-reasoning', weight: 1, type: 'sudoku3' }
          ]
        }
      ]
    },

    // ==================================================================
    //  三年级
    // ==================================================================
    {
      grade: 3,
      modules: [
        {
          moduleId: 'M1',
          knowledgePoints: [
            { id: 'g3-add-sub-wan', name: '万以内的加减法', pluginId: 'math-oral', weight: 3, type: 'addsub' },
            { id: 'g3-mul-multi1', name: '多位数乘一位数', pluginId: 'math-oral', weight: 3, type: 'multi1' },
            { id: 'g3-div1', name: '除数是一位数的除法', pluginId: 'math-oral', weight: 3, type: 'div1' },
            { id: 'g3-mul-2digit', name: '两位数乘两位数', pluginId: 'math-oral', weight: 3, type: 'twodigit' }
          ]
        },
        {
          moduleId: 'M4',
          knowledgePoints: [
            { id: 'g3-fraction', name: '分数的初步认识', pluginId: 'math-fraction', weight: 3, type: 'shard' },
            { id: 'g3-decimal', name: '小数的初步认识', pluginId: 'math-decimal', weight: 3, type: 'read' },
            { id: 'g3-time', name: '时、分、秒', pluginId: 'math-time-date', weight: 2, type: 'clockFace' },
            { id: 'g3-year-month', name: '年、月、日', pluginId: 'math-time-date', weight: 2, type: 'ym' },
            { id: 'g3-measure', name: '测量', pluginId: 'math-unit-convert', weight: 2, type: 'mix' }
          ]
        },
        {
          moduleId: 'M6',
          knowledgePoints: [
            { id: 'g3-perimeter', name: '长方形正方形的周长', pluginId: 'math-geometry', weight: 2, type: 'perimeter' },
            { id: 'g3-area', name: '面积', pluginId: 'math-area', weight: 3, type: 'rect' },
            { id: 'g3-position', name: '位置与方向', pluginId: 'math-position-direction', weight: 2, type: 'compass' }
          ]
        },
        {
          moduleId: 'M8',
          knowledgePoints: [
            { id: 'g3-times', name: '倍的认识', pluginId: 'math-word-problems', weight: 2, type: 'mix' }
          ]
        },
        {
          moduleId: 'M9',
          knowledgePoints: [
            { id: 'g3-stats-table', name: '复式统计表', pluginId: 'math-data-stats', weight: 2, type: 'multiTable' }
          ]
        },
        {
          moduleId: 'M10',
          knowledgePoints: [
            { id: 'g3-combination', name: '搭配问题', pluginId: 'math-combination-set', weight: 2, type: 'dress' },
            { id: 'g3-set', name: '集合思想', pluginId: 'math-combination-set', weight: 2, type: 'set' }
          ]
        }
      ]
    },

    // ==================================================================
    //  四年级（全年级题型模块目录重构版，M1-M12 全覆盖）
    //  pluginId 为预留新插件 id，已由 registry 占位注册，后续逐模块实现
    // ==================================================================
    {
      grade: 4,
      modules: [
        {
          moduleId: 'M1',
          knowledgePoints: [
            { id: 'g4-oral-big', name: '大数加减口算', pluginId: 'math-g4-oral', weight: 3, type: 'big-addsub' },
            { id: 'g4-oral-mul3x1', name: '三位数乘一位数口算', pluginId: 'math-g4-oral', weight: 3, type: 'mul3x1' },
            { id: 'g4-oral-mul2t', name: '两位数乘整十数口算', pluginId: 'math-g4-oral', weight: 3, type: 'mul2tens' },
            { id: 'g4-oral-divt', name: '除数是整十数的口算', pluginId: 'math-g4-oral', weight: 3, type: 'div-tens' },
            { id: 'g4-oral-dec', name: '小数加减法口算', pluginId: 'math-g4-oral', weight: 3, type: 'dec-addsub' },
            { id: 'g4-oral-law', name: '运用运算律简便口算', pluginId: 'math-g4-oral', weight: 2, type: 'law-oral' }
          ]
        },
        {
          moduleId: 'M2',
          knowledgePoints: [
            { id: 'g4-v-mul3x2', name: '三位数乘两位数', pluginId: 'math-g4-vertical', weight: 3, type: 'mul3x2' },
            { id: 'g4-v-mulzero', name: '因数中间或末尾有 0 的乘法', pluginId: 'math-g4-vertical', weight: 3, type: 'mul-zero' },
            { id: 'g4-v-div2', name: '除数是两位数的除法', pluginId: 'math-g4-vertical', weight: 3, type: 'div-2digit' },
            { id: 'g4-v-div2q', name: '商是两位数的除法', pluginId: 'math-g4-vertical', weight: 3, type: 'div-2quotient' },
            { id: 'g4-v-dec', name: '小数加减法竖式', pluginId: 'math-g4-vertical', weight: 3, type: 'dec-vertical' }
          ]
        },
        {
          moduleId: 'M3',
          knowledgePoints: [
            { id: 'g4-mix-order', name: '四则混合运算顺序', pluginId: 'math-g4-mixed', weight: 3, type: 'order' },
            { id: 'g4-mix-addlaw', name: '加法运算律简便计算', pluginId: 'math-g4-mixed', weight: 3, type: 'add-law' },
            { id: 'g4-mix-mullaw', name: '乘法运算律简便计算', pluginId: 'math-g4-mixed', weight: 3, type: 'mul-law' },
            { id: 'g4-mix-dist', name: '乘法分配律简便计算', pluginId: 'math-g4-mixed', weight: 3, type: 'dist-law' },
            { id: 'g4-mix-dec', name: '小数加减简便计算', pluginId: 'math-g4-mixed', weight: 2, type: 'dec-simple' }
          ]
        },
        {
          moduleId: 'M4',
          knowledgePoints: [
            { id: 'g4-fill-bignum', name: '大数的认识', pluginId: 'math-g4-fill', weight: 3, type: 'big-num' },
            { id: 'g4-fill-hectare', name: '公顷和平方千米', pluginId: 'math-g4-fill', weight: 2, type: 'hectare' },
            { id: 'g4-fill-line', name: '线段、射线、直线', pluginId: 'math-g4-fill', weight: 2, type: 'line-ray' },
            { id: 'g4-fill-angle', name: '角的度量与分类', pluginId: 'math-g4-fill', weight: 3, type: 'angle-metric' },
            { id: 'g4-fill-quad', name: '平行四边形和梯形', pluginId: 'math-g4-fill', weight: 2, type: 'quad' },
            { id: 'g4-fill-op', name: '四则运算的意义与关系、0 的运算', pluginId: 'math-g4-fill', weight: 2, type: 'op-meaning' },
            { id: 'g4-fill-quotient', name: '商不变规律', pluginId: 'math-g4-fill', weight: 2, type: 'quotient-law' },
            { id: 'g4-fill-dec', name: '小数', pluginId: 'math-g4-fill', weight: 3, type: 'decimal' },
            { id: 'g4-fill-tri', name: '三角形', pluginId: 'math-g4-fill', weight: 3, type: 'triangle' },
            { id: 'g4-fill-avg', name: '平均数', pluginId: 'math-g4-fill', weight: 2, type: 'average' }
          ]
        },
        {
          moduleId: 'M5',
          knowledgePoints: [
            { id: 'g4-match-read', name: '大数与读法连线', pluginId: 'math-g4-match', weight: 2, type: 'read' },
            { id: 'g4-match-angle', name: '角与度数连线', pluginId: 'math-g4-match', weight: 2, type: 'angle-degree' },
            { id: 'g4-match-shape', name: '图形与特征连线', pluginId: 'math-g4-match', weight: 2, type: 'shape-feature' },
            { id: 'g4-match-law', name: '运算律与字母表达式连线', pluginId: 'math-g4-match', weight: 2, type: 'law-formula' },
            { id: 'g4-match-decfrac', name: '小数与分数连线', pluginId: 'math-g4-match', weight: 2, type: 'dec-frac' }
          ]
        },
        {
          moduleId: 'M6',
          knowledgePoints: [
            { id: 'g4-draw-protractor', name: '用量角器量角、画角', pluginId: 'math-g4-draw', weight: 3, type: 'protractor' },
            { id: 'g4-draw-para', name: '画平行线、垂线', pluginId: 'math-g4-draw', weight: 3, type: 'parallel-perp' },
            { id: 'g4-draw-grid', name: '在方格纸上画平行四边形、梯形', pluginId: 'math-g4-draw', weight: 2, type: 'grid-quad' },
            { id: 'g4-draw-view', name: '观察物体', pluginId: 'math-g4-draw', weight: 2, type: 'observe' },
            { id: 'g4-draw-sym', name: '画轴对称图形', pluginId: 'math-g4-draw', weight: 2, type: 'symmetry' },
            { id: 'g4-draw-move', name: '图形平移', pluginId: 'math-g4-draw', weight: 2, type: 'translate' }
          ]
        },
        {
          moduleId: 'M7',
          knowledgePoints: [
            { id: 'g4-pic-segment', name: '线段图列式（倍数问题）', pluginId: 'math-g4-picture', weight: 3, type: 'segment-multiple' },
            { id: 'g4-pic-brace', name: '大括号图列式（加减）', pluginId: 'math-g4-picture', weight: 2, type: 'brace-addsub' },
            { id: 'g4-pic-speed', name: '速度时间路程图', pluginId: 'math-g4-picture', weight: 2, type: 'speed-distance' },
            { id: 'g4-pic-dec', name: '小数加减情境图', pluginId: 'math-g4-picture', weight: 2, type: 'dec-scene' }
          ]
        },
        {
          moduleId: 'M8',
          knowledgePoints: [
            { id: 'g4-word-big', name: '大数应用', pluginId: 'math-g4-word', weight: 2, type: 'big-app' },
            { id: 'g4-word-speed', name: '乘法问题（速度×时间=路程）', pluginId: 'math-g4-word', weight: 3, type: 'mul-travel' },
            { id: 'g4-word-div', name: '除法问题（总量÷份数=每份数）', pluginId: 'math-g4-word', weight: 3, type: 'div-share' },
            { id: 'g4-word-price', name: '单价、数量、总价问题', pluginId: 'math-g4-word', weight: 3, type: 'price-qty' },
            { id: 'g4-word-area', name: '面积问题（公顷/平方千米）', pluginId: 'math-g4-word', weight: 2, type: 'area-hectare' },
            { id: 'g4-word-opt', name: '优化问题', pluginId: 'math-g4-word', weight: 2, type: 'optimize' },
            { id: 'g4-word-cr', name: '鸡兔同笼', pluginId: 'math-g4-word', weight: 2, type: 'chicken-rabbit' },
            { id: 'g4-word-dec', name: '小数加减问题', pluginId: 'math-g4-word', weight: 3, type: 'dec-pay' },
            { id: 'g4-word-avg', name: '平均数问题', pluginId: 'math-g4-word', weight: 2, type: 'avg-score' }
          ]
        },
        {
          moduleId: 'M9',
          knowledgePoints: [
            { id: 'g4-stats-bar', name: '条形统计图（1 格表示多个单位）', pluginId: 'math-g4-stats', weight: 3, type: 'bar-chart' },
            { id: 'g4-stats-double', name: '复式条形统计图', pluginId: 'math-g4-stats', weight: 2, type: 'double-bar' },
            { id: 'g4-stats-avg', name: '平均数与统计', pluginId: 'math-g4-stats', weight: 2, type: 'avg-stats' }
          ]
        },
        {
          moduleId: 'M10',
          knowledgePoints: [
            { id: 'g4-reason-opt', name: '优化问题（沏茶、烙饼）', pluginId: 'math-g4-reason', weight: 3, type: 'pancake' },
            { id: 'g4-reason-cr', name: '鸡兔同笼（假设法）', pluginId: 'math-g4-reason', weight: 3, type: 'assume' },
            { id: 'g4-reason-logic', name: '简单逻辑推理', pluginId: 'math-g4-reason', weight: 2, type: 'logic' }
          ]
        },
        {
          moduleId: 'M11',
          knowledgePoints: [
            { id: 'g4-judge-read', name: '大数读写', pluginId: 'math-g4-judge', weight: 2, type: 'read' },
            { id: 'g4-judge-law', name: '运算律', pluginId: 'math-g4-judge', weight: 2, type: 'law' },
            { id: 'g4-judge-angle', name: '几何概念', pluginId: 'math-g4-judge', weight: 2, type: 'angle' },
            { id: 'g4-judge-line', name: '线段、射线、直线', pluginId: 'math-g4-judge', weight: 2, type: 'line-ray' },
            { id: 'g4-judge-quotient', name: '商不变规律', pluginId: 'math-g4-judge', weight: 2, type: 'quotient' },
            { id: 'g4-judge-dec', name: '小数性质', pluginId: 'math-g4-judge', weight: 2, type: 'dec' },
            { id: 'g4-judge-tri', name: '三角形', pluginId: 'math-g4-judge', weight: 2, type: 'triangle' },
            { id: 'g4-judge-stats', name: '统计', pluginId: 'math-g4-judge', weight: 2, type: 'stats' }
          ]
        },
        {
          moduleId: 'M12',
          knowledgePoints: [
            { id: 'g4-choice-big', name: '大数比较', pluginId: 'math-g4-choice', weight: 3, type: 'big-compare' },
            { id: 'g4-choice-est', name: '乘除法估算', pluginId: 'math-g4-choice', weight: 2, type: 'est-muldiv' },
            { id: 'g4-choice-angle', name: '角的认识', pluginId: 'math-g4-choice', weight: 2, type: 'angle' },
            { id: 'g4-choice-shape', name: '图形特征', pluginId: 'math-g4-choice', weight: 2, type: 'shape' },
            { id: 'g4-choice-dec', name: '小数意义', pluginId: 'math-g4-choice', weight: 2, type: 'dec-meaning' },
            { id: 'g4-choice-law', name: '运算律应用', pluginId: 'math-g4-choice', weight: 2, type: 'law' }
          ]
        }
      ]
    },
    // ==================================================================
    //  五年级（全年级题型模块目录重构版，M1-M12 全覆盖）
    //  pluginId 为预留新插件 id，已由 registry 占位注册，后续逐模块实现
    // ==================================================================
    {
      grade: 5,
      modules: [
        {
          moduleId: 'M1',
          knowledgePoints: [
            { id: 'g5-oral-decmul', name: '小数乘法口算', pluginId: 'math-g5-oral', weight: 3, type: 'dec-mul-oral' },
            { id: 'g5-oral-decdiv', name: '小数除法口算', pluginId: 'math-g5-oral', weight: 3, type: 'dec-div-oral' },
            { id: 'g5-oral-fracadd', name: '同分母分数加减法口算', pluginId: 'math-g5-oral', weight: 3, type: 'frac-addsub-oral' },
            { id: 'g5-oral-equ', name: '简易方程口算', pluginId: 'math-g5-oral', weight: 2, type: 'equation-oral' },
            { id: 'g5-oral-fm', name: '因数倍数特征快速判断', pluginId: 'math-g5-oral', weight: 2, type: 'factor-multiple' }
          ]
        },
        {
          moduleId: 'M2',
          knowledgePoints: [
            { id: 'g5-v-decmul', name: '小数乘法竖式', pluginId: 'math-g5-vertical', weight: 3, type: 'dec-mul-vertical' },
            { id: 'g5-v-divint', name: '除数是整数的小数除法竖式', pluginId: 'math-g5-vertical', weight: 3, type: 'dec-div-int' },
            { id: 'g5-v-ddivdec', name: '除数是小数的小数除法竖式', pluginId: 'math-g5-vertical', weight: 3, type: 'dec-div-dec' },
            { id: 'g5-v-repeating', name: '循环小数竖式表示', pluginId: 'math-g5-vertical', weight: 2, type: 'repeating-dec' }
          ]
        },
        {
          moduleId: 'M3',
          knowledgePoints: [
            { id: 'g5-mix-decmixed', name: '小数四则混合运算', pluginId: 'math-g5-mixed', weight: 3, type: 'dec-mixed' },
            { id: 'g5-mix-fracmixed', name: '分数加减混合运算', pluginId: 'math-g5-mixed', weight: 3, type: 'frac-mixed' },
            { id: 'g5-mix-decsimple', name: '运算律推广到小数简便计算', pluginId: 'math-g5-mixed', weight: 3, type: 'dec-simple' },
            { id: 'g5-mix-fracsimple', name: '运算律推广到分数简便计算', pluginId: 'math-g5-mixed', weight: 3, type: 'frac-simple' }
          ]
        },
        {
          moduleId: 'M4',
          knowledgePoints: [
            { id: 'g5-fill-decloc', name: '小数的计数单位与数位', pluginId: 'math-g5-fill', weight: 3, type: 'dec-place' },
            { id: 'g5-fill-deccmp', name: '小数大小比较', pluginId: 'math-g5-fill', weight: 2, type: 'dec-compare' },
            { id: 'g5-fill-prodrule', name: '积的变化规律', pluginId: 'math-g5-fill', weight: 3, type: 'product-rule' },
            { id: 'g5-fill-repeating', name: '循环小数与简便记法', pluginId: 'math-g5-fill', weight: 2, type: 'repeating-note' },
            { id: 'g5-fill-equation', name: '方程概念与等式的性质', pluginId: 'math-g5-fill', weight: 3, type: 'equation-prop' },
            { id: 'g5-fill-fm', name: '因数与倍数的概念', pluginId: 'math-g5-fill', weight: 3, type: 'factor-multiple' },
            { id: 'g5-fill-prime', name: '质数与合数', pluginId: 'math-g5-fill', weight: 3, type: 'prime-composite' },
            { id: 'g5-fill-fracmean', name: '分数的意义与分数单位', pluginId: 'math-g5-fill', weight: 3, type: 'frac-meaning' },
            { id: 'g5-fill-fracprop', name: '分数的基本性质（约分、通分）', pluginId: 'math-g5-fill', weight: 3, type: 'frac-property' },
            { id: 'g5-fill-fracdec', name: '分数与小数的互化', pluginId: 'math-g5-fill', weight: 2, type: 'frac-decimal' },
            { id: 'g5-fill-coord', name: '数对的含义', pluginId: 'math-g5-fill', weight: 2, type: 'coordinate' },
            { id: 'g5-fill-area', name: '多边形面积公式', pluginId: 'math-g5-fill', weight: 3, type: 'area-formula' },
            { id: 'g5-fill-solid', name: '长方体正方体特征与公式', pluginId: 'math-g5-fill', weight: 3, type: 'solid-formula' },
            { id: 'g5-fill-rotate', name: '旋转三要素', pluginId: 'math-g5-fill', weight: 2, type: 'rotation-elem' },
            { id: 'g5-fill-possible', name: '可能性描述', pluginId: 'math-g5-fill', weight: 2, type: 'possibility' },
            { id: 'g5-fill-linechart', name: '折线统计图特点', pluginId: 'math-g5-fill', weight: 2, type: 'linechart-feature' }
          ]
        },
        {
          moduleId: 'M5',
          knowledgePoints: [
            { id: 'g5-match-areaf', name: '图形与面积公式连线', pluginId: 'math-g5-match', weight: 3, type: 'area-formula' },
            { id: 'g5-match-solid', name: '立体图形特征连线', pluginId: 'math-g5-match', weight: 2, type: 'solid-feature' },
            { id: 'g5-match-possib', name: '事件与可能性描述连线', pluginId: 'math-g5-match', weight: 2, type: 'possibility-desc' },
            { id: 'g5-match-equ', name: '方程与解连线', pluginId: 'math-g5-match', weight: 3, type: 'equation-solve' },
            { id: 'g5-match-fracdec', name: '分数与小数连线', pluginId: 'math-g5-match', weight: 2, type: 'frac-decimal' }
          ]
        },
        {
          moduleId: 'M6',
          knowledgePoints: [
            { id: 'g5-draw-rotate', name: '画旋转后的图形', pluginId: 'math-g5-draw', weight: 3, type: 'rotation-draw' },
            { id: 'g5-draw-observe', name: '观察物体（三）', pluginId: 'math-g5-draw', weight: 3, type: 'observe-3d' },
            { id: 'g5-draw-height', name: '画多边形的高', pluginId: 'math-g5-draw', weight: 2, type: 'polygon-height' },
            { id: 'g5-draw-sym', name: '补全轴对称图形', pluginId: 'math-g5-draw', weight: 2, type: 'symmetry' },
            { id: 'g5-draw-coord', name: '用数对表示位置', pluginId: 'math-g5-draw', weight: 2, type: 'coordinate-plot' },
            { id: 'g5-draw-net', name: '长方体展开图', pluginId: 'math-g5-draw', weight: 2, type: 'solid-net' }
          ]
        },
        {
          moduleId: 'M7',
          knowledgePoints: [
            { id: 'g5-pic-balance', name: '天平平衡图（列方程）', pluginId: 'math-g5-picture', weight: 3, type: 'balance-equation' },
            { id: 'g5-pic-area', name: '多边形面积图', pluginId: 'math-g5-picture', weight: 3, type: 'area-picture' },
            { id: 'g5-pic-segment', name: '线段图（小数倍数）', pluginId: 'math-g5-picture', weight: 3, type: 'segment-multiple' },
            { id: 'g5-pic-tree', name: '植树问题示意图', pluginId: 'math-g5-picture', weight: 2, type: 'tree-planting' }
          ]
        },
        {
          moduleId: 'M8',
          knowledgePoints: [
            { id: 'g5-word-decmul', name: '小数乘法应用题', pluginId: 'math-g5-word', weight: 3, type: 'dec-mul-app' },
            { id: 'g5-word-decdiv', name: '小数除法应用题（进一法、去尾法）', pluginId: 'math-g5-word', weight: 3, type: 'dec-div-app' },
            { id: 'g5-word-equ', name: '列方程解决问题', pluginId: 'math-g5-word', weight: 3, type: 'equation-app' },
            { id: 'g5-word-fm', name: '因数与倍数简单应用', pluginId: 'math-g5-word', weight: 2, type: 'factor-app' },
            { id: 'g5-word-frac', name: '分数加减法应用题', pluginId: 'math-g5-word', weight: 3, type: 'frac-app' },
            { id: 'g5-word-area', name: '多边形面积应用题', pluginId: 'math-g5-word', weight: 3, type: 'area-app' },
            { id: 'g5-word-solid', name: '长方体正方体应用题', pluginId: 'math-g5-word', weight: 3, type: 'solid-app' },
            { id: 'g5-word-possib', name: '可能性问题', pluginId: 'math-g5-word', weight: 2, type: 'possibility-app' },
            { id: 'g5-word-linechart', name: '折线统计图分析', pluginId: 'math-g5-word', weight: 2, type: 'linechart-app' },
            { id: 'g5-word-tree', name: '植树问题', pluginId: 'math-g5-word', weight: 3, type: 'tree-app' },
            { id: 'g5-word-defect', name: '找次品', pluginId: 'math-g5-word', weight: 2, type: 'defective' }
          ]
        },
        {
          moduleId: 'M9',
          knowledgePoints: [
            { id: 'g5-stats-possib', name: '可能性大小比较', pluginId: 'math-g5-stats', weight: 3, type: 'possibility-compare' },
            { id: 'g5-stats-line1', name: '单式折线统计图', pluginId: 'math-g5-stats', weight: 3, type: 'linechart-single' },
            { id: 'g5-stats-line2', name: '复式折线统计图', pluginId: 'math-g5-stats', weight: 3, type: 'linechart-double' }
          ]
        },
        {
          moduleId: 'M10',
          knowledgePoints: [
            { id: 'g5-reason-tree3', name: '植树问题（三种情况）', pluginId: 'math-g5-reason', weight: 3, type: 'tree-three' },
            { id: 'g5-reason-defect', name: '找次品（天平称量）', pluginId: 'math-g5-reason', weight: 3, type: 'defective-scale' },
            { id: 'g5-reason-logic', name: '逻辑推理', pluginId: 'math-g5-reason', weight: 2, type: 'logic' },
            { id: 'g5-reason-seq', name: '数字推理', pluginId: 'math-g5-reason', weight: 2, type: 'sequence' }
          ]
        },
        {
          moduleId: 'M11',
          knowledgePoints: [
            { id: 'g5-judge-decmul', name: '小数乘除法', pluginId: 'math-g5-judge', weight: 3, type: 'dec' },
            { id: 'g5-judge-equ', name: '方程概念', pluginId: 'math-g5-judge', weight: 2, type: 'equation' },
            { id: 'g5-judge-fm', name: '因数与倍数', pluginId: 'math-g5-judge', weight: 3, type: 'factor-multiple' },
            { id: 'g5-judge-frac', name: '分数的意义与性质', pluginId: 'math-g5-judge', weight: 3, type: 'fraction' },
            { id: 'g5-judge-area', name: '多边形面积', pluginId: 'math-g5-judge', weight: 3, type: 'area' },
            { id: 'g5-judge-solid', name: '长方体正方体', pluginId: 'math-g5-judge', weight: 3, type: 'solid' },
            { id: 'g5-judge-rotate', name: '图形的运动', pluginId: 'math-g5-judge', weight: 2, type: 'rotation' },
            { id: 'g5-judge-possib', name: '可能性', pluginId: 'math-g5-judge', weight: 2, type: 'possibility' },
            { id: 'g5-judge-stats', name: '统计', pluginId: 'math-g5-judge', weight: 2, type: 'stats' }
          ]
        },
        {
          moduleId: 'M12',
          knowledgePoints: [
            { id: 'g5-choice-decmul', name: '小数乘除法', pluginId: 'math-g5-choice', weight: 3, type: 'dec' },
            { id: 'g5-choice-equ', name: '方程', pluginId: 'math-g5-choice', weight: 3, type: 'equation' },
            { id: 'g5-choice-fm', name: '因数与倍数', pluginId: 'math-g5-choice', weight: 3, type: 'factor-multiple' },
            { id: 'g5-choice-frac', name: '分数的意义与性质', pluginId: 'math-g5-choice', weight: 3, type: 'fraction' },
            { id: 'g5-choice-area', name: '多边形的面积', pluginId: 'math-g5-choice', weight: 3, type: 'area' },
            { id: 'g5-choice-solid', name: '长方体正方体容积', pluginId: 'math-g5-choice', weight: 3, type: 'solid' },
            { id: 'g5-choice-rotate', name: '图形的运动', pluginId: 'math-g5-choice', weight: 2, type: 'rotation' },
            { id: 'g5-choice-possib', name: '可能性', pluginId: 'math-g5-choice', weight: 2, type: 'possibility' },
            { id: 'g5-choice-stats', name: '统计', pluginId: 'math-g5-choice', weight: 2, type: 'stats' }
          ]
        }
      ]
    }
  ];

  // ============ 便捷查询（挂在数组对象上） ============

  /** 取某年级对象（{grade, modules}），不存在返回 null */
  KnowledgeBank.findGrade = function (grade) {
    for (var i = 0; i < this.length; i++) {
      if (this[i].grade === grade) return this[i];
    }
    return null;
  };

  /** 兼容旧名 getGrade（返回与 findGrade 相同的年级对象），便于旧代码/文档过渡 */
  KnowledgeBank.getGrade = function (grade) {
    return this.findGrade(grade);
  };

  /** 扁平化某年级全部知识点：[{id,name,pluginId,moduleId,weight,type}]；非数学科目返回空数组 */
  KnowledgeBank.getEntries = function (subject, grade) {
    if (subject && subject !== 'math') return [];
    var g = this.findGrade(grade);
    if (!g) return [];
    var out = [];
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push({
          id: kp.id,
          name: kp.name,
          pluginId: kp.pluginId,
          moduleId: m.moduleId,
          weight: kp.weight,
          type: kp.type
        });
      });
    });
    return out;
  };

  /**
   * 知识点覆盖统计。
   * @param {string} subject 科目（仅 'math' 有数据）
   * @param {number} grade 年级
   * @param {string[]} coveredPluginIds 已注册且适用该年级的插件 id 集合
   * @returns {{total:number,covered:number,ratio:number,missing:Array,next:Object|null}}
   */
  KnowledgeBank.getCoverage = function (subject, grade, coveredPluginIds) {
    var entries = this.getEntries(subject, grade);
    if (!entries.length) {
      return { total: 0, covered: 0, ratio: 0, missing: [], next: null };
    }
    var set = {};
    (coveredPluginIds || []).forEach(function (id) { set[id] = true; });
    var missing = entries.filter(function (e) { return !set[e.pluginId]; });
    var covered = entries.length - missing.length;
    return {
      total: entries.length,
      covered: covered,
      ratio: entries.length ? Math.round(covered / entries.length * 100) : 0,
      missing: missing,
      next: missing.length ? missing[0] : null
    };
  };

  /** 从注册表（[{id,subject,grades}]）计算覆盖（自动提取适用该年级的插件 id；排除占位插件） */
  KnowledgeBank.coverageFromRegistry = function (subject, grade, registry) {
    var ids = [];
    (registry || []).forEach(function (p) {
      if (p.subject === subject && p.grades && p.grades.indexOf(grade) !== -1 && !p.isPlaceholder) ids.push(p.id);
    });
    return this.getCoverage(subject, grade, ids);
  };

  /** 建议下一个应开发的插件：{pluginId,name} 或 null（已全部覆盖） */
  KnowledgeBank.suggestNext = function (subject, grade, coveredPluginIds) {
    var cov = this.getCoverage(subject, grade, coveredPluginIds);
    return cov.next ? { pluginId: cov.next.pluginId, name: cov.next.name } : null;
  };

  global.KnowledgeBank = KnowledgeBank;

  if (typeof module !== 'undefined' && module.exports) module.exports = global.KnowledgeBank;

})(typeof window !== 'undefined' ? window : globalThis);