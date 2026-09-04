/**
 * dev/r2-qtype-normalize-map.js — R2 题型规范化共享映射模块
 *
 * 供 draft（生成草案文档）与 apply（改写 knowledge-*.js）共用。
 * 原则：question-type-registry 为 SSOT；显式别名语义合理即采用；
 * 启发式/悬空/误判经 OVERRIDES 语义纠偏。decide(v) 返回 { to, why, src }。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
if (!global.PluginUtil) require(path.join(ROOT, 'shared/common.js'));
const Registry = require(path.join(ROOT, 'shared/question-type-registry.js'));

const CANONICAL = Registry.all().map((t) => t.id);

/** 语义纠偏覆盖表：registry 建议不可靠 / 悬空值的权威映射 */
const OVERRIDES = {
  // ---- 悬空值（registry unmapped）----
  logic:          { to: 'apply',  why: '逻辑推理=应用类' },
  combination:    { to: 'apply',  why: '搭配/排列组合=应用' },
  'pie-chart':    { to: 'apply',  why: '扇形统计图=统计应用' },
  compose:        { to: 'fill',   why: '数的组成=填空' },
  'div-partitive': { to: 'calc',  why: '看图列除法（等分）=计算' },
  'div-quotative': { to: 'calc',  why: '看图列除法（包含）=计算' },
  'two-step':     { to: 'apply',  why: '两步混合应用=应用' },
  money:          { to: 'apply',  why: '人民币购物=应用' },
  extra:          { to: 'apply',  why: '多余条件问题=应用' },
  question:       { to: 'apply',  why: '统计回答问题=应用' },
  sudoku:         { to: 'apply',  why: '数独=逻辑应用' },
  handshake:      { to: 'apply',  why: '握手问题=组合应用' },
  multi1:         { to: 'calc',   why: '多位数乘一位数=计算' },
  div1:           { to: 'calc',   why: '除数是一位数的除法=计算' },
  dress:          { to: 'apply',  why: '搭配问题=应用' },
  'bar-chart':    { to: 'apply',  why: '条形统计图=统计应用' },
  'double-bar':   { to: 'apply',  why: '复式条形统计图=统计应用' },
  'avg-stats':    { to: 'apply',  why: '平均数统计=应用' },
  worst:          { to: 'apply',  why: '最不利原则=应用' },
  magic3:         { to: 'apply',  why: '三阶幻方=应用' },
  magic4:         { to: 'apply',  why: '四阶幻方=应用' },
  // ---- registry 显式别名误判（语义纠偏）----
  clock:          { to: 'recognize', why: '时间认读=认识类（非几何）' },
  'factor-multiple': { to: 'apply', why: '因数倍数特征判断=数论应用（非几何）' },
  all:            { to: 'recognize', why: '字母认读=认识类（非几何）' },
  relation:       { to: 'calc',   why: '乘除法关系口算=计算' },
  operator:       { to: 'calc',   why: '填运算符号=计算' },
  'mult-meaning': { to: 'fill',   why: '乘法意义填空=填空' },
  'div-meaning':  { to: 'fill',   why: '除法意义填空=填空' },
  tally:          { to: 'apply',  why: '数据收集（正字法）=统计应用' },
  multiTable:     { to: 'apply',  why: '复式统计表=统计应用（非计算）' },
  set:            { to: 'apply',  why: '集合思想=应用' },
  'big-num':      { to: 'recognize', why: '大数的认识=概念认识（非计算）' },
  hectare:        { to: 'recognize', why: '公顷平方千米=单位认识（非几何）' },
  'op-meaning':   { to: 'recognize', why: '四则运算意义=概念认识（非几何）' },
  'quotient-law': { to: 'calc',   why: '商不变规律=计算规律（非几何）' },
  'law-formula':  { to: 'choice', why: '运算律字母式连线=连线选择' },
  'dec-frac':     { to: 'choice', why: '小数分数连线=连线选择' },
  'brace-addsub': { to: 'calc',   why: '大括号图列式=计算' },
  'area-hectare': { to: 'apply',  why: '面积问题（公顷）=应用' },
  basic:          { to: 'apply',  why: '基本行程=应用（非几何）' },
  meet:           { to: 'apply',  why: '相遇问题=应用（非几何）' },
  chase:          { to: 'apply',  why: '追及问题=应用（非几何）' },
  train:          { to: 'apply',  why: '火车过桥=应用（非几何）' },
  river:          { to: 'apply',  why: '流水行船=应用（非几何）' },
  extreme:        { to: 'apply',  why: '最值问题=应用（非几何）' },
  drawer:         { to: 'apply',  why: '抽屉原理=应用（非几何）' },
  integrated:     { to: 'apply',  why: '综合应用题=应用（非几何）' },
  misc:           { to: 'apply',  why: '杂题选讲=应用（非几何）' },
  mock:           { to: 'open',   why: '模拟竞赛卷=开放综合卷' },
  average:        { to: 'apply',  why: '平均数=统计应用（非几何）' },
  pa:             { to: 'geometry', why: '周长与面积=几何' },
  count:          { to: 'geometry', why: '图形计数=几何' },
  'dec-meaning':  { to: 'recognize', why: '小数意义=概念认识（非计算）' },
  parity:         { to: 'apply',  why: '奇偶性与运算规律=数论应用' },
  place:          { to: 'apply',  why: '位值原理=数论应用' },
  law:            { to: 'judge',  why: '运算律判断题=判断' },
  'segment-multiple': { to: 'apply', why: '线段图列式（倍数）=应用' },
  enum:           { to: 'apply',  why: '枚举法=计数应用' },
  am:             { to: 'apply',  why: '加法乘法原理=计数应用' },
  perm:           { to: 'apply',  why: '排列组合初步=计数应用' },
  'extract-factor': { to: 'calc', why: '提取公因数巧算=计算' },
  twodigit:       { to: 'calc',   why: '两位数乘两位数=计算' },
  'array-closed':  { to: 'apply', why: '封闭型数阵=应用' },
  'array-radial':  { to: 'apply', why: '辐射型数阵=应用' },
  'array-composite': { to: 'apply', why: '复合型数阵=应用' },
  'interval-departure': { to: 'apply', why: '发车间隔问题=应用（非几何）' },
  'pick-up':      { to: 'apply',  why: '接送问题=应用（非几何）' },
  mixture:        { to: 'apply',  why: '混合问题=应用（非几何）' },
  'digit-reason': { to: 'apply',  why: '数字推理综合=应用' },
  'clockFace':    { to: 'recognize', why: '时、分、秒认读=认识类' },
  'unit-convert': { to: 'recognize', why: '单位换算=认识/换算' }
};

/** 判定某题型值 → canonical（返回 {to, why, src}；无法判定 to='待定'） */
function decide(v) {
  if (OVERRIDES[v]) return { to: OVERRIDES[v].to, why: OVERRIDES[v].why, src: '覆盖' };
  const n = Registry.normalizeQuestionType(v, { allowHeuristic: false });
  if (n.id && CANONICAL.indexOf(n.id) !== -1) {
    return { to: n.id, why: 'registry 别名', src: 'registry:' + n.confidence };
  }
  return { to: '待定', why: '无法判定', src: 'unmapped' };
}

module.exports = { CANONICAL, OVERRIDES, decide };
