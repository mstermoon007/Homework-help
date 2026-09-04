#!/usr/bin/env node
/**
 * dev/g1-fill-draft.js — 一年级数学 53 条知识点补全草案生成器（只读草案，不改生产文件）
 *
 * 依据：人教版（2022 课标）2024 秋一上 / 2025 春一下 新教材知识点。
 * 产出：docs/G1_MATH_FILL_DRAFT.md（可读）+ docs/g1-knowledge-fill-draft.json（可机改 patch）
 * 同时做字段级校验：operations ∈ canonical、error id/category 合法、factual type 合法、
 * applicable_question_types ∈ 7 类 canonical、graphicType ∈ 6 类枚举。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const KB = require('/Users/zhanggaozhang/Code/Homework Help/shared/knowledge-bank.js');
const Ops = require('/Users/zhanggaozhang/Code/Homework Help/shared/knowledge-operation.js');
const Fact = require('/Users/zhanggaozhang/Code/Homework Help/shared/knowledge-factual.js');
const Err = require('/Users/zhanggaozhang/Code/Homework Help/shared/knowledge-error.js');
const Ont = require('/Users/zhanggaozhang/Code/Homework Help/shared/knowledge-ontology.js');

const QT = ['calc', 'fill', 'judge', 'choice', 'operate', 'apply', 'open'];
const GRAPHIC = ['geometry', 'chart', 'diagram', 'number-line', 'grid', 'custom'];

// ============ 53 条补全内容（key = KP id） ============
const FILL = {
  // ---------- M0 巧算专项（20以内进位加法/退位减法策略） ----------
  'math-g1-m0-make-ten': {
    concept: '进位加法策略：把一个加数拆分，使其与另一个加数凑成 10，再用 10 加剩余部分（如 9+5=9+1+4=14）。',
    operations: ['add', 'decompose'],
    factualContent: { rule: '拆小数凑十：9+x 把 x 拆成 1 和(x-1)，8+x 拆成 2 和(x-2)；十的组成 1+9、2+8、3+7、4+6、5+5' },
    common_errors: [
      { id: 'split-error', category: 'calculation', description: '加数拆分错误，凑不成 10' },
      { id: 'remnant-omission', category: 'calculation', description: '凑成 10 后遗漏加剩余部分' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m0-make-ten-ping': {
    concept: '退位减法策略：把减数拆成两部分，先用被减数减去与个位相同的部分得整十，再减剩余部分（如 15-8=15-5-3=7）。',
    operations: ['subtract', 'decompose'],
    factualContent: { rule: '平十法：15-8 把 8 拆成 5 和 3，15-5=10，10-3=7；先减个位凑整十' },
    common_errors: [
      { id: 'split-error', category: 'calculation', description: '减数拆分未先取个位，凑不成整十' },
      { id: 'borrow-omission', category: 'calculation', description: '连续减时漏减剩余部分' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m0-make-ten-po': {
    concept: '退位减法策略：把被减数拆成 10 和几，先用 10 减减数，再加剩余部分（如 13-5=10-5+3=8）。',
    operations: ['subtract', 'decompose'],
    factualContent: { rule: '破十法：13-5 → 13 拆成 10 和 3，10-5=5，5+3=8' },
    common_errors: [
      { id: 'split-error', category: 'calculation', description: '被减数拆分错误' },
      { id: 'remnant-omission', category: 'calculation', description: '10 减减数后遗漏加剩余部分' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m0-make-ten-cushi': {
    concept: '判断用凑十法/破十法计算的过程与结果是否正确，巩固算法步骤的规范性。',
    operations: ['reason', 'compare'],
    factualContent: { rule: '凑十法/破十法标准步骤：拆数→凑十→加余；破十→减→加余' },
    common_errors: [
      { id: 'step-sequence-error', category: 'reasoning', description: '对凑十/破十步骤顺序或拆分过程判断错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'judge', coefficient: 1 }]
  },

  // ---------- M1 口算练习 ----------
  'math-g1-m1-addsub-5': {
    concept: '在 5 以内进行加、减法口算，借助实物与点数建立初步数感与运算概念。',
    operations: ['add', 'subtract'],
    factualContent: { count: '5 以内数的分与合（如 5 分成 1 和 4、2 和 3）', notation: '运算符号：+ 加、- 减、= 等于' },
    common_errors: [
      { id: 'count-error', category: 'calculation', description: '点数/口算计数错误' },
      { id: 'sign-confusion', category: 'notation', description: '加号减号混淆' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-addsub-10': {
    concept: '在 10 以内进行加、减法口算，熟练掌握 10 以内数的组成与分解。',
    operations: ['add', 'subtract'],
    factualContent: { relationship: '10 的组成：1+9、2+8、3+7、4+6、5+5、6+4、7+3、8+2、9+1' },
    common_errors: [
      { id: 'count-error', category: 'calculation', description: '口算计数错误' },
      { id: 'compose-decompose-error', category: 'concept', description: '分与合不熟练导致计算错误' },
      { id: 'sign-confusion', category: 'notation', description: '加号减号混淆' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-carry-add-20': {
    concept: '20 以内进位加法口算，以凑十法为标准算法（上册第五单元）。',
    operations: ['add'],
    factualContent: { rule: '进位加法用凑十法：拆小数凑 10，再加剩余数' },
    common_errors: [
      { id: 'split-error', category: 'calculation', description: '凑十拆分错误' },
      { id: 'remnant-omission', category: 'calculation', description: '凑十后漏加剩余数' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-retreat-sub-20': {
    concept: '20 以内退位减法口算，可选用破十法、平十法或想加算减（下册第二单元）。',
    operations: ['subtract'],
    factualContent: { rule: '退位减法可用破十法/平十法/想加算减：想 9+（ ）=13 求 13-9' },
    common_errors: [
      { id: 'borrow-omission', category: 'calculation', description: '退位减法忘记退位' },
      { id: 'split-error', category: 'calculation', description: '破十/平十拆分错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-addsub-100': {
    concept: '整十数加、减整十数及相应口算（如 30+20、50-30），理解以十为单位的计数（下册第三、四单元）。',
    operations: ['add', 'subtract'],
    factualContent: { rule: '整十数相加减只把十位上的数相加减，个位写 0（如 30+20 想 3 个十加 2 个十）' },
    common_errors: [
      { id: 'count-error', category: 'calculation', description: '十位计算错误' },
      { id: 'place-value-error', category: 'concept', description: '整十数相加减时个位处理错误' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-two-digit-add': {
    concept: '两位数加、减一位数（不进位/进位）及两位数加减整十数的口算（如 34+5、47-6、23+40）（下册第四单元）。',
    operations: ['add', 'subtract'],
    factualContent: { rule: '两位数加减一位数先算个位，两位数加减整十数先算十位' },
    common_errors: [
      { id: 'digit-confusion', category: 'concept', description: '个位与十位混淆、错位相加减' },
      { id: 'carry-omission', category: 'calculation', description: '进位加法忘记进位' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m1-mixed-chain': {
    concept: '连加、连减及加减混合运算，按从左到右的顺序口算（如 3+4+2、10-3-4、4+6-5）。',
    operations: ['add', 'subtract'],
    factualContent: { rule: '连加连减、加减混合按从左到右的顺序依次计算' },
    common_errors: [
      { id: 'order-error', category: 'structure', description: '未按从左到右顺序计算' },
      { id: 'count-error', category: 'calculation', description: '中间步骤计算错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },

  // ---------- M4 填空题 ----------
  'math-g1-m4-compose-number': {
    concept: '理解数的组成：11~20 由 1 个十和几个一组成，100 以内数由几个十和几个一组成（一上第四单元/一下第三单元）。',
    operations: ['compose', 'decompose', 'identify'],
    factualContent: { relationship: '十几=1 个十+几个一；如 15 由 1 个十和 5 个一组成' },
    common_errors: [
      { id: 'place-value-error', category: 'concept', description: '十位/个位表示的数混淆' },
      { id: 'compose-decompose-error', category: 'concept', description: '数的组成拆分错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-digit-place': {
    concept: '认识个位、十位（及百位），理解各数位数字表示的意义，正确读写数。',
    operations: ['read', 'write', 'identify'],
    factualContent: { notation: '个位表示几个一，十位表示几个十，百位表示几个百（从右往左）' },
    common_errors: [
      { id: 'place-value-error', category: 'concept', description: '数位意义混淆' },
      { id: 'notation-error', category: 'notation', description: '读数或写数错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-adjacent-number': {
    concept: '会求一个数的相邻数（前一个、后一个），理解自然数的顺序（如 15 的相邻数是 14 和 16）。',
    operations: ['order', 'identify'],
    factualContent: { rule: '相邻数=前一个数(该数-1)和后一个数(该数+1)' },
    common_errors: [
      { id: 'adjacent-confusion', category: 'concept', description: '相邻数取错（只找一个/把自身算入）' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-compare-number': {
    concept: '会比较 20 以内及 100 以内数的大小，用 >、<、= 表示（先比位数，再比十位，十位相同比个位）。',
    operations: ['compare'],
    factualContent: { rule: '比较大小：位数多的大；位数相同先比十位，十位相同比个位' },
    common_errors: [
      { id: 'comparison-direction-error', category: 'concept', description: '大于号/小于号方向写反' },
      { id: 'comparison-digit-error', category: 'concept', description: '比较时看错位数或数位' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-split-number': {
    concept: '把一个数分成几和几、把两部分合起来，掌握 10 以内数的分与合（如 10 可以分成 3 和 7）。',
    operations: ['compose', 'decompose'],
    factualContent: { relationship: '10 以内的分与合：如 5 分成 1 和 4、2 和 3；10 分成 1 和 9 等' },
    common_errors: [
      { id: 'compose-decompose-error', category: 'concept', description: '分与合结果写错或漏写' },
      { id: 'pair-omission', category: 'attention', description: '分与合遗漏部分组合' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }]
  },
  'math-g1-m4-number-pattern': {
    concept: '找数字排列中的规律（等差、递增/递减、间隔等），并依规律填数。',
    operations: ['reason', 'order'],
    factualContent: { rule: '常见规律：每次加/减同一个数、间隔规律、个位/十位规律' },
    common_errors: [
      { id: 'pattern-rule-error', category: 'reasoning', description: '规律判断错误' },
      { id: 'pattern-extension-error', category: 'reasoning', description: '按规律续写数错误' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-clock-read': {
    concept: '认识钟面（时针、分针），会读整时和几时半，会用整时描述时间。',
    operations: ['read', 'identify'],
    factualContent: { notation: '分针指向 12、时针指向几就是几时；分针指向 6、时针走过几就是几时半', unit: '小时' },
    common_errors: [
      { id: 'clock-hand-confusion', category: 'concept', description: '时针分针混淆' },
      { id: 'clock-read-error', category: 'reading', description: '读钟面时间错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-clock-approx': {
    concept: '会用"快几时了""几时刚过"描述接近整时的时间，初步建立时间感知。',
    operations: ['read', 'identify'],
    factualContent: { rule: '分针接近 12 且未到是"快几时了"；分针刚过 12 是"几时刚过"' },
    common_errors: [
      { id: 'clock-approx-confusion', category: 'concept', description: '快几时/刚过几时判断颠倒' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }, { type: 'judge', coefficient: 0.6 }]
  },
  'math-g1-m4-rmb-unit': {
    concept: '认识人民币单位元、角、分及进率，进行单位间换算（1 元=10 角，1 角=10 分）（下册"欢乐购物街"）。',
    operations: ['convert', 'measure'],
    factualContent: { unit: ['元', '角', '分'], relationship: '1 元=10 角，1 角=10 分' },
    common_errors: [
      { id: 'unit-confusion', category: 'unit', description: '元角分单位混淆' },
      { id: 'unit-convert-error', category: 'unit', description: '单位换算进率错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-rmb-calc': {
    concept: '人民币加减计算，先统一单位再计算（如 5 元+3 元、1 元-6 角）。',
    operations: ['calculate', 'convert'],
    factualContent: { rule: '人民币计算先统一单位：元加元、角加角，满 10 角进 1 元' },
    common_errors: [
      { id: 'unit-confusion', category: 'unit', description: '单位未统一直接加减' },
      { id: 'unit-convert-error', category: 'unit', description: '角/分与元换算错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'apply', coefficient: 0.6 }]
  },
  'math-g1-m4-number-chart': {
    concept: '在百数表中观察 1~100 的排列规律（行/列/斜向），巩固 100 以内数的顺序与位置关系。',
    operations: ['order', 'identify', 'reason'],
    factualContent: { rule: '百数表：同一行十位相同、同一列个位相同；左右相差 1、上下相差 10' },
    common_errors: [
      { id: 'chart-position-error', category: 'concept', description: '百数表中数的位置判断错误' },
      { id: 'place-value-error', category: 'concept', description: '上下/左右相邻数关系错误' }
    ],
    graphicType: 'grid',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m4-num-fill-unknown': {
    concept: '根据加减法关系求未知数（如 3+□=9、□-4=6），理解加减互为逆运算。',
    operations: ['reason', 'calculate'],
    factualContent: { rule: '加数=和-另一个加数；被减数=差+减数；减数=被减数-差' },
    common_errors: [
      { id: 'inverse-operation-error', category: 'reasoning', description: '求未知数选错运算' },
      { id: 'count-error', category: 'calculation', description: '计算错误' }
    ],
    graphicType: 'number-line',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },

  // ---------- M5 连线题 ----------
  'math-g1-m5-match-calc': {
    concept: '把算式与对应得数连线，考查口算熟练度与对应能力。',
    operations: ['identify', 'calculate'],
    factualContent: { relationship: '算式与得数一一对应（先口算得数再配对）' },
    common_errors: [
      { id: 'matching-link-error', category: 'attention', description: '连错算式与得数' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }]
  },
  'math-g1-m5-match-shape': {
    concept: '把平面/立体图形与名称连线，考查图形特征识别。',
    operations: ['identify', 'classify'],
    factualContent: { classification: '平面图形：长方形、正方形、三角形、圆、平行四边形；立体图形：长方体、正方体、圆柱、球' },
    common_errors: [
      { id: 'shape-name-confusion', category: 'concept', description: '图形与名称对应错误' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }]
  },
  'math-g1-m5-match-clock': {
    concept: '把钟面所表示的时间与文字/数字时间连线。',
    operations: ['read', 'identify'],
    factualContent: { notation: '整时（分针指 12）与几时半（分针指 6）的钟面特征' },
    common_errors: [
      { id: 'clock-read-error', category: 'reading', description: '读钟面时间错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }]
  },
  'math-g1-m5-match-rmb': {
    concept: '把人民币面值（元/角/分）与数值、单位连线。',
    operations: ['identify', 'classify'],
    factualContent: { unit: ['元', '角', '分'], relationship: '1 元=10 角，1 角=10 分' },
    common_errors: [
      { id: 'unit-confusion', category: 'unit', description: '人民币面值单位混淆' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }]
  },

  // ---------- M6 操作题 ----------
  'math-g1-m6-solid-shape': {
    concept: '认识长方体、正方体、圆柱、球等立体图形，能根据特征辨认与区分（一上第三单元 认识立体图形）。',
    operations: ['identify', 'classify'],
    factualContent: { classification: '立体图形：长方体（6 个面）、正方体（6 个面都相同）、圆柱（上下两个圆面）、球（圆滑可滚动）' },
    common_errors: [
      { id: 'shape-name-confusion', category: 'concept', description: '立体图形名称/特征混淆' },
      { id: 'solid-flat-confusion', category: 'concept', description: '立体图形与平面图形混淆' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m6-flat-shape': {
    concept: '认识长方形、正方形、三角形、圆、平行四边形等平面图形，能辨认与区分（一下第一单元 认识平面图形）。',
    operations: ['identify', 'classify'],
    factualContent: { classification: '平面图形：长方形（对边相等）、正方形（四边相等）、三角形、圆、平行四边形' },
    common_errors: [
      { id: 'shape-name-confusion', category: 'concept', description: '平面图形名称/特征混淆' },
      { id: 'flat-edge-confusion', category: 'concept', description: '长方形与正方形边特征混淆' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m6-count-graph': {
    concept: '数一数组合图形中各类图形的个数，考查有序观察与分类计数。',
    operations: ['identify', 'classify'],
    factualContent: { rule: '图形计数先分类再数，不重复不遗漏' },
    common_errors: [
      { id: 'count-omission', category: 'attention', description: '图形计数遗漏或重复' },
      { id: 'shape-name-confusion', category: 'concept', description: '图形类型识别错误' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m6-position': {
    concept: '会用上、下、前、后、左、右描述物体的位置关系，并能按描述判断与摆放。',
    operations: ['identify'],
    factualContent: { vocabulary: '位置词：上、下、前、后、左、右' },
    common_errors: [
      { id: 'left-right-confusion', category: 'concept', description: '左右方位混淆' },
      { id: 'position-reference-error', category: 'concept', description: '相对位置的参照对象搞错' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m6-shape-combine': {
    concept: '用平面图形（含七巧板）拼摆组合成新图形，体会图形间的关系（一下第一单元）。',
    operations: ['represent', 'identify'],
    factualContent: { classification: '七巧板由 1 个正方形、1 个平行四边形、5 个三角形组成' },
    common_errors: [
      { id: 'shape-combine-error', category: 'reasoning', description: '拼组关系判断错误' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },
  'math-g1-m6-draw-shape': {
    concept: '按要求画出平面图形（用直尺画长方形、正方形、三角形等）。',
    operations: ['represent', 'identify'],
    factualContent: { classification: '平面图形边角特征：长方形对边相等、正方形四边相等、三角形三条边' },
    common_errors: [
      { id: 'shape-draw-error', category: 'writing', description: '画图不规范（边不直、特征不符）' }
    ],
    graphicType: 'geometry',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }]
  },

  // ---------- M7 看图列式 ----------
  'math-g1-m7-picture-add': {
    concept: '根据情境图（合起来、又来了等）列出加法算式并计算（部分+部分=总数）。',
    operations: ['represent', 'add'],
    factualContent: { rule: '把两部分合起来用加法：部分+部分=总数' },
    common_errors: [
      { id: 'picture-read-error', category: 'reading', description: '看图信息读取错误（数量看错）' },
      { id: 'model-error', category: 'reasoning', description: '合起来误用减法' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'apply', coefficient: 0.6 }]
  },
  'math-g1-m7-picture-sub': {
    concept: '根据情境图（去掉、拿走、飞走等）列出减法算式并计算（总数-部分=剩余）。',
    operations: ['represent', 'subtract'],
    factualContent: { rule: '从总数里去掉一部分用减法：总数-部分=剩余' },
    common_errors: [
      { id: 'picture-read-error', category: 'reading', description: '看图信息读取错误' },
      { id: 'model-error', category: 'reasoning', description: '去掉/拿走误用加法' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'apply', coefficient: 0.6 }]
  },
  'math-g1-m7-picture-mixed': {
    concept: '根据多步情境图列出连加、连减算式并按顺序计算。',
    operations: ['represent', 'add', 'subtract'],
    factualContent: { rule: '连加连减按从左到右顺序计算' },
    common_errors: [
      { id: 'picture-read-error', category: 'reading', description: '多步图信息读取错误' },
      { id: 'order-error', category: 'structure', description: '连加连减顺序错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'apply', coefficient: 0.6 }]
  },
  'math-g1-m7-brace-question': {
    concept: '根据大括号与问号图判断求总数还是求部分，列出正确算式。',
    operations: ['represent', 'reason'],
    factualContent: { rule: '大括号下问号求总数用加法；总数已知求一部分用减法' },
    common_errors: [
      { id: 'brace-direction-error', category: 'reading', description: '求总数/求部分判断错误' },
      { id: 'model-error', category: 'reasoning', description: '列式方向错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'calc', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },

  // ---------- M8 解决问题（一下第六单元 数量间的加减关系） ----------
  'math-g1-m8-add-total': {
    concept: '已知两部分，求合起来的总数，用加法（部分+部分=总数）。',
    operations: ['reason', 'add'],
    factualContent: { relationship: '部分+部分=总数（求总数用加法）' },
    common_errors: [
      { id: 'word-model-error', category: 'reasoning', description: '数量关系判断错误' },
      { id: 'word-read-error', category: 'reading', description: '应用题信息提取错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m8-sub-remain': {
    concept: '已知总数和去掉的部分，求剩余，用减法（总数-部分=剩余）。',
    operations: ['reason', 'subtract'],
    factualContent: { relationship: '总数-部分=剩余（求剩余用减法）' },
    common_errors: [
      { id: 'word-model-error', category: 'reasoning', description: '数量关系判断错误' },
      { id: 'word-read-error', category: 'reading', description: '应用题信息提取错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m8-sub-part': {
    concept: '已知总数和其中一部分，求另一部分，用减法（总数-已知部分=未知部分）。',
    operations: ['reason', 'subtract'],
    factualContent: { relationship: '总数-已知部分=未知部分（求部分用减法）' },
    common_errors: [
      { id: 'remain-part-confusion', category: 'reasoning', description: '求剩余与求部分建模混淆' },
      { id: 'word-read-error', category: 'reading', description: '应用题信息提取错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m8-compare-more': {
    concept: '求比一个数多几的数是多少，用加法（较小数+相差数=较大数）。',
    operations: ['reason', 'compare', 'add'],
    factualContent: { relationship: '求比某数多几的数用加法：小数+相差数=大数' },
    common_errors: [
      { id: 'more-less-direction-error', category: 'reasoning', description: '比多比少运算方向错误' },
      { id: 'word-read-error', category: 'reading', description: '"比…多几"信息提取错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }]
  },
  'math-g1-m8-compare-less': {
    concept: '求比一个数少几的数是多少，用减法（较大数-相差数=较小数）。',
    operations: ['reason', 'compare', 'subtract'],
    factualContent: { relationship: '求比某数少几的数用减法：大数-相差数=小数' },
    common_errors: [
      { id: 'more-less-direction-error', category: 'reasoning', description: '比多比少运算方向错误' },
      { id: 'word-read-error', category: 'reading', description: '"比…少几"信息提取错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }]
  },
  'math-g1-m8-two-step': {
    concept: '两步计算的应用题（先求中间量再求结果），体会数量关系的连续性。',
    operations: ['reason', 'calculate'],
    factualContent: { rule: '两步应用题先确定中间问题，再列式解决' },
    common_errors: [
      { id: 'two-step-order-error', category: 'structure', description: '两步计算的中间量求错' },
      { id: 'word-model-error', category: 'reasoning', description: '数量关系建模错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }]
  },
  'math-g1-m8-rmb-shopping': {
    concept: '在购物情境中计算总价与找零，综合运用人民币与加减法（"欢乐购物街"综合实践）。',
    operations: ['reason', 'calculate', 'convert'],
    factualContent: { relationship: '总价=几件商品合起来的钱数（用加法）；找回的钱=付出的钱-应付的钱' },
    common_errors: [
      { id: 'unit-confusion', category: 'unit', description: '元角分单位未统一' },
      { id: 'word-model-error', category: 'reasoning', description: '总价/找零数量关系错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }, { type: 'calc', coefficient: 0.6 }]
  },
  'math-g1-m8-exclude-extra': {
    concept: '从问题出发筛选有用信息，排除多余条件后再列式。',
    operations: ['reason', 'identify'],
    factualContent: { rule: '根据问题找所需条件，排除多余条件' },
    common_errors: [
      { id: 'extra-condition-error', category: 'reading', description: '被多余条件误导' },
      { id: 'word-model-error', category: 'reasoning', description: '有用条件筛选错误' }
    ],
    graphicType: 'diagram',
    applicable_question_types: [{ type: 'apply', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },

  // ---------- M9 分类与整理 ----------
  'math-g1-m9-classify': {
    concept: '按一定标准对事物分类，并用计数、记录等方法整理数据。',
    operations: ['classify', 'identify'],
    factualContent: { rule: '分类标准一致，不重复不遗漏' },
    common_errors: [
      { id: 'classify-standard-error', category: 'concept', description: '分类标准不一致或混乱' },
      { id: 'classify-omission', category: 'attention', description: '分类遗漏项目' }
    ],
    graphicType: 'chart',
    applicable_question_types: [{ type: 'operate', coefficient: 1 }, { type: 'fill', coefficient: 0.6 }]
  },
  'math-g1-m9-stats-table': {
    concept: '把分类整理的结果填入统计表，能读出表中信息并比较多少。',
    operations: ['classify', 'identify'],
    factualContent: { rule: '统计表行/列对应分类，格内填计数结果' },
    common_errors: [
      { id: 'stats-count-error', category: 'attention', description: '统计计数错误' },
      { id: 'stats-read-error', category: 'reading', description: '读统计表信息错误' }
    ],
    graphicType: 'chart',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'operate', coefficient: 0.6 }]
  },
  'math-g1-m9-pictograph': {
    concept: '用象形图（一个图形代表一个或几个数量）表示数据，会读图并比较。',
    operations: ['classify', 'identify'],
    factualContent: { rule: '象形统计图一个图形代表一定数量，读数时按图例换算' },
    common_errors: [
      { id: 'picto-scale-error', category: 'reading', description: '象形图单位（一图代表几）换算错误' },
      { id: 'stats-count-error', category: 'attention', description: '读图计数错误' }
    ],
    graphicType: 'chart',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'choice', coefficient: 0.6 }]
  },

  // ---------- M13 提前预习（乘除法启蒙） ----------
  'math-g1-m13-multiplication-table': {
    concept: '初步认识乘法意义（几个几相加），熟悉 1~9 的乘法口诀表（超前预习）。',
    operations: ['multiply'],
    factualContent: { table: '乘法口诀表 1~9', rule: '乘法是相同加数连加的简便运算（3×4=3+3+3+3）' },
    common_errors: [
      { id: 'multiplication-fact-confusion', category: 'operation', description: '乘法口诀混淆' },
      { id: 'multiply-add-confusion', category: 'concept', description: '乘法与加法意义混淆' }
    ],
    graphicType: 'grid',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'calc', coefficient: 0.6 }]
  },
  'math-g1-m13-division-table': {
    concept: '初步认识除法意义（平均分），结合乘法口诀求商（超前预习）。',
    operations: ['divide'],
    factualContent: { table: '除法表（由乘法口诀求商）', rule: '除法表示平均分，商=被除数÷除数' },
    common_errors: [
      { id: 'division-fact-confusion', category: 'operation', description: '除法求商口诀混淆' },
      { id: 'divide-multiply-confusion', category: 'concept', description: '除法与乘法关系混淆' }
    ],
    graphicType: 'grid',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }, { type: 'calc', coefficient: 0.6 }]
  },
  'math-g1-m13-fill-blank': {
    concept: '在乘除法算式中填空（如 3×□=12、□÷4=3），巩固口诀与逆运算关系（超前预习）。',
    operations: ['multiply', 'divide', 'reason'],
    factualContent: { rule: '用乘法口诀求乘除法算式中的未知数' },
    common_errors: [
      { id: 'multiplication-fact-confusion', category: 'operation', description: '用口诀求未知数错误' }
    ],
    graphicType: 'grid',
    applicable_question_types: [{ type: 'fill', coefficient: 1 }]
  },

  // ---------- M11 / M12 综合题型 ----------
  'math-g1-m11-judge-mixed': {
    concept: '对一年级数学概念、计算、图形等作正误判断（综合判断题）。',
    operations: ['reason', 'identify'],
    factualContent: { range: '覆盖一年级全册知识：数与运算、图形、时间、人民币、分类统计' },
    common_errors: [
      { id: 'concept-confusion', category: 'concept', description: '概念辨析错误' },
      { id: 'step-sequence-error', category: 'reasoning', description: '计算/推理过程判断错误' }
    ],
    graphicType: 'custom',
    applicable_question_types: [{ type: 'judge', coefficient: 1 }]
  },
  'math-g1-m12-choice-mixed': {
    concept: '对一年级数学知识作多项选择（综合选择题），考查概念辨析。',
    operations: ['identify', 'reason'],
    factualContent: { range: '覆盖一年级全册知识：数与运算、图形、时间、人民币、分类统计' },
    common_errors: [
      { id: 'distractor-confusion', category: 'concept', description: '受干扰项误导选错' },
      { id: 'concept-confusion', category: 'concept', description: '概念辨析错误' }
    ],
    graphicType: 'custom',
    applicable_question_types: [{ type: 'choice', coefficient: 1 }]
  }
};

// ============ 校验 ============
const g1 = KB.findGrade('math', 1);
const byId = {};
g1.modules.forEach(m => (m.knowledgePoints || []).forEach(kp => { byId[kp.id] = kp; }));

const problems = [];
const covered = new Set();
Object.keys(FILL).forEach(id => {
  if (!byId[id]) problems.push('FILL 含未知 KP: ' + id);
  covered.add(id);
});
Object.keys(byId).forEach(id => { if (!FILL[id]) problems.push('缺少 FILL: ' + id); });

Object.entries(FILL).forEach(([id, f]) => {
  (f.operations || []).forEach(o => { if (!Ops.isCanonical(o)) problems.push(id + ' 非法 operation: ' + o); });
  (f.common_errors || []).forEach(e => {
    if (!Err.isValidId(e.id)) problems.push(id + ' 非法 error id: ' + e.id);
    if (!Err.isCategory(e.category)) problems.push(id + ' 非法 error category: ' + e.category);
    if (!e.description) problems.push(id + ' error 缺 description: ' + e.id);
  });
  const fc = f.factualContent || {};
  const v = Fact.validate(fc);
  v.errors.forEach(er => problems.push(id + ' factual error: ' + er));
  v.warnings.forEach(er => problems.push(id + ' factual warning: ' + er));
  (f.applicable_question_types || []).forEach(a => { if (QT.indexOf(a.type) === -1) problems.push(id + ' 非法题型: ' + a.type); });
  if (GRAPHIC.indexOf(f.graphicType) === -1) problems.push(id + ' 非法 graphicType: ' + f.graphicType);
});

if (problems.length) {
  console.log('[FAIL] 草案校验未通过:');
  problems.forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('[OK] 草案字段级校验通过：53 条全覆盖，operations/errors/factual/qt/graphicType 全部合法');

// ============ 生成 patch JSON ============
const patch = { meta: { subject: 'math', grade: 1, total: Object.keys(FILL).length, basis: '人教版（2022课标）2024秋一上 / 2025春一下 新教材' }, items: [] };
Object.entries(FILL).forEach(([id, f]) => {
  const cur = byId[id];
  patch.items.push({
    id, name: cur.name,
    patch: {
      concept: f.concept,
      operations: f.operations,
      factualContent: f.factualContent,
      common_errors: f.common_errors,
      graphicType: f.graphicType,
      applicable_question_types: f.applicable_question_types,
      prerequisites: Array.isArray(cur.prerequisites) && cur.prerequisites.length === 0 ? [] : (cur.prerequisites || [])
    }
  });
});
const outJson = path.join(__dirname, '..', 'docs', 'g1-knowledge-fill-draft.json');
fs.writeFileSync(outJson, JSON.stringify(patch, null, 2) + '\n');
console.log('[OK] 已生成 ' + outJson);

// ============ 生成可读 Markdown ============
const moduleName = { M0: '巧算专项', M1: '口算练习', M4: '填空题', M5: '连线题', M6: '操作题', M7: '看图列式', M8: '解决问题', M9: '分类与整理', M11: '判断题', M12: '选择题', M13: '提前预习' };
const curRange = kp => (kp.number_range_default && kp.number_range_default.min + '-' + kp.number_range_default.max) || '-';

const lines = [];
lines.push('# 一年级数学知识库 · 53 条补全草案（G1 Knowledge Fill Draft）');
lines.push('');
lines.push('> 依据：**人教版（2022 年版课标）2024 秋一年级上册 / 2025 春一年级下册新教材**。');
lines.push('> 仅草案，未写入生产文件。字段级校验已通过（operations ∈ canonical 枚举、error id/category 合法、factual type 合法、题型 ∈ 7 类 canonical、graphicType ∈ 6 类枚举）。');
lines.push('');
lines.push('## 覆盖说明');
lines.push('');
lines.push('| 补齐维度 | 当前 | 草案后 |');
lines.push('|---|---|---|');
lines.push('| knowledge.concept | 0/53 | **53/53** |');
lines.push('| knowledge.operations（显式） | 0/53（靠 plugin 兜底） | **53/53**（显式覆盖） |');
lines.push('| knowledge.factualContent | 10/53 | **53/53** |');
lines.push('| assessment.common_errors | 8/53 | **53/53** |');
lines.push('| presentation.graphicType | 0/53 | **53/53** |');
lines.push('| applicable_question_types 规范化 | 13/53 canonical | **53/53 canonical** |');
lines.push('| prerequisites 显式（根节点 []） | 6 条已显式 [] | 保持，全部显式 |');
lines.push('');
lines.push('## 模块 ↔ 人教版新教材单元映射');
lines.push('');
lines.push('| 模块（题型维度） | 条数 | 人教版单元对应（2022 课标新教材） |');
lines.push('|---|---|---|');
lines.push('| M0 巧算专项 | 4 | 一上五单元 20以内的进位加法（凑十法）；一下二单元 20以内的退位减法（平十法/破十法） |');
lines.push('| M1 口算练习 | 7 | 一上 5以内/6~10的认识和加减法、五单元进位加法；一下二单元退位减法、三/四单元 100以内口算 |');
lines.push('| M4 填空题 | 12 | 一上四单元 11~20的认识；一下三单元 100以内数的认识；欢乐购物街（人民币）；认识钟表 |');
lines.push('| M5 连线题 | 4 | 跨单元题型模块（计算/图形/钟表/人民币） |');
lines.push('| M6 操作题 | 6 | 一上三单元 认识立体图形；一下一单元 认识平面图形与拼组；位置与方向 |');
lines.push('| M7 看图列式 | 4 | 一上/一下加减法单元（大括号问号、合起来/去掉情境） |');
lines.push('| M8 解决问题 | 8 | 一下六单元 数量间的加减关系（求总数/剩余/部分、比多比少、两步、购物） |');
lines.push('| M9 分类与整理 | 3 | 统计与分类（分类、统计表、象形统计图） |');
lines.push('| M13 提前预习 | 3 | 超前拓展（乘除法启蒙，非教材课时） |');
lines.push('| M11/M12 综合 | 2 | 综合题型模块（判断题/选择题） |');
lines.push('');
lines.push('## 各条草案');
lines.push('');

Object.keys(moduleName).forEach(mid => {
  const kps = g1.modules.find(m => m.moduleId === mid).knowledgePoints;
  kps.forEach(kp => {
    const f = FILL[kp.id];
    const qt = f.applicable_question_types.map(a => a.type + (a.coefficient !== 1 ? '(' + a.coefficient + ')' : '')).join('、');
    const ops = f.operations.join('、');
    const errs = f.common_errors.map(e => `\`${e.id}\`（${e.category}）${e.description}`).join('；');
    const facts = Object.entries(f.factualContent).map(([k, v]) => `\`${k}\`: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('；');
    lines.push(`### ${kp.id} — ${kp.name}`);
    lines.push('');
    lines.push(`- **现有元数据**：range=${curRange(kp)}，difficulty=${kp.difficulty}，cognitive=${kp.cognitive_level}，spiral=${kp.spiral_level}/${kp.max_spiral_level || kp.spiral_level}`);
    lines.push(`- **concept**：${f.concept}`);
    lines.push(`- **operations**：\`${ops}\``);
    lines.push(`- **factualContent**：${facts || '—'}`);
    lines.push(`- **common_errors**：${errs || '—'}`);
    lines.push(`- **graphicType**：\`${f.graphicType}\``);
    lines.push(`- **applicable_question_types**：\`${qt}\``);
    lines.push(`- **prerequisites**：\`${JSON.stringify(kp.prerequisites || [])}\``);
    lines.push('');
  });
});

const outMd = path.join(__dirname, '..', 'docs', 'G1_MATH_FILL_DRAFT.md');
fs.writeFileSync(outMd, lines.join('\n'));
console.log('[OK] 已生成 ' + outMd);

// ============ 预演：应用 patch 后 canonical 缺口 ============
const applied = {};
Object.entries(FILL).forEach(([id, f]) => {
  const cur = byId[id];
  applied[id] = Object.assign({}, cur, {
    concept: f.concept,
    operations: f.operations,
    factualContent: f.factualContent,
    common_errors: f.common_errors,
    graphicType: f.graphicType,
    applicable_question_types: f.applicable_question_types
  });
});
let cEmpty = 0, fEmpty = 0, eEmpty = 0, gEmpty = 0, nonCanon = 0;
Object.entries(applied).forEach(([id, kp]) => {
  const c = Ont.normalize(kp);
  if (!c.knowledge.concept) cEmpty++;
  if (!Object.keys(c.knowledge.factualContent).length) fEmpty++;
  if (!c.errors.length) eEmpty++;
  if (!c.presentation.graphicType) gEmpty++;
  c.presentation.questionTypes.forEach(q => { if (QT.indexOf(q.type) === -1) nonCanon++; });
});
console.log('\n[预演] 应用草案后 canonical 缺口：');
console.log('  concept 空: ' + cEmpty + '  factualContent 空: ' + fEmpty + '  errors 空: ' + eEmpty + '  graphicType 空: ' + gEmpty + '  非canonical题型: ' + nonCanon);
