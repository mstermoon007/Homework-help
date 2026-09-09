/**
 * shared/ontology-book-map.js — KP 上下册 × 单元标注表（V4.1.1）
 *
 * 背景：三种练习模式的新分层（快速/教师：年级 → 上下册 → 单元 → …）要求
 * 每个基础 KP 携带 book（up/down/mixed/advance）与 unit（单元名称）。
 * 知识库现状：仅 G1 46 条显式填写 book/unit（2024 新版教材单元名），
 * G2–G6 共 503 条缺失。
 *
 * 教材版本对齐决策：
 *   - G1：沿用数据层既有 2024 新版单元名（欢乐购物街 / 数量间的加减关系等）。
 *   - G2–G6：KP 内容分布对齐旧版人教版教材（2013 审定版，如 G2 万以内数/克和千克/
 *     数据收集整理均为旧版二下单元），故按旧版教材目录标注，避免知识点与单元名错配。
 *   - 竞赛模块 C1–C9：竞赛模式不走「上下册/单元」层级，不标注（返回 null）。
 *
 * 与 ontology-category-map.js 同构：不改 KnowledgeBank 原始条目，
 * 由 Normalizer 归一化时应用；可审计、可回滚。
 *
 * 查询语义：
 *   bookUnitForKp(kp) -> { book, unit } | null
 *     book ∈ up|down|mixed|advance（与 select.html kpMatchesBook 一致）
 *     unit 为教材单元显示名（沿用 G1 既有命名风格：第X单元 名称 / 跨册（…）/ 超前（…））
 */
(function (global) {
  'use strict';

  var BOOK_UNIT_MAP = {
    // ==================== 二年级（旧版：上 9 单元 / 下 10 单元） ====================
    'math-g2-m1-add-100':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m1-sub-100':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m1-mult-table':           { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m1-div-table':            { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m1-remainder-oral':       { book: 'down', unit: '第6单元 有余数的除法' },
    'math-g2-m1-mixed-addsub':         { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m1-mixed-multdiv':        { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m1-mixed-two-step':       { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m1-addsub-1000':          { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m1-muldiv-relation':      { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m2-add-col':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m2-sub-col':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m2-chain-add-col':        { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m2-chain-sub-col':        { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m2-mixed-col':            { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m2-mult-col':             { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m2-div-col':              { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m2-remainder-col':        { book: 'down', unit: '第6单元 有余数的除法' },
    'math-g2-m3-mixed-no-bracket':     { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m3-mixed-bracket':        { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m3-chain-addsub':         { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m3-multdiv-mixed':        { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m3-compare-simple':       { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m3-fill-operator':        { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m4-read-10000':           { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m4-compose-10000':        { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m4-digit-order':          { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m4-approx-number':        { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m4-compare-10000':        { book: 'down', unit: '第7单元 万以内数的认识' },
    'math-g2-m4-length-unit':          { book: 'up', unit: '第1单元 长度单位' },
    'math-g2-m4-mass-unit':            { book: 'down', unit: '第8单元 克和千克' },
    'math-g2-m4-time-unit':            { book: 'up', unit: '第7单元 认识时间' },
    'math-g2-m4-fill-length':          { book: 'up', unit: '第1单元 长度单位' },
    'math-g2-m4-fill-mass':            { book: 'down', unit: '第8单元 克和千克' },
    'math-g2-m4-fill-time':            { book: 'up', unit: '第7单元 认识时间' },
    'math-g2-m4-number-pattern':       { book: 'mixed', unit: '跨册（数列与算式规律续写）' },
    'math-g2-m4-multiplication-meaning': { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m4-division-meaning':     { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m4-angle-basic':          { book: 'up', unit: '第3单元 角的初步认识' },
    'math-g2-m4-clock-read':           { book: 'up', unit: '第7单元 认识时间' },
    'math-g2-m5-match-calc':           { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m5-match-shape':          { book: 'mixed', unit: '跨册（平面/立体图形与名称连线）' },
    'math-g2-m5-match-angle':          { book: 'up', unit: '第3单元 角的初步认识' },
    'math-g2-m5-match-clock':          { book: 'up', unit: '第7单元 认识时间' },
    'math-g2-m5-match-unit':           { book: 'mixed', unit: '跨册（长度/质量单位与物品连线）' },
    'math-g2-m5-match-multdiv':        { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m6-solid-shape':          { book: 'mixed', unit: '跨册（立体图形认识）' },
    'math-g2-m6-angle-recognize':      { book: 'up', unit: '第3单元 角的初步认识' },
    'math-g2-m6-motion':               { book: 'down', unit: '第3单元 图形的运动（一）' },
    'math-g2-m6-grid-draw':            { book: 'down', unit: '第3单元 图形的运动（一）' },
    'math-g2-m6-draw-line':            { book: 'up', unit: '第1单元 长度单位' },
    'math-g2-m6-draw-angle':           { book: 'up', unit: '第3单元 角的初步认识' },
    'math-g2-m6-clock-draw':           { book: 'up', unit: '第7单元 认识时间' },
    'math-g2-m6-measure':              { book: 'up', unit: '第1单元 长度单位' },
    'math-g2-m7-pic-add':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m7-pic-sub':              { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m7-pic-mult':             { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m7-pic-div':              { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m7-pic-div-include':      { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m7-pic-mixed':            { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m8-add-total':            { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m8-sub-remain':           { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m8-mult-total':           { book: 'up', unit: '第4~6单元 表内乘法' },
    'math-g2-m8-div-partitive':        { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m8-div-quotative':        { book: 'down', unit: '第2~4单元 表内除法' },
    'math-g2-m8-remainder-apply':      { book: 'down', unit: '第6单元 有余数的除法' },
    'math-g2-m8-compare-diff':         { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m8-two-step':             { book: 'down', unit: '第5单元 混合运算' },
    'math-g2-m8-money':                { book: 'mixed', unit: '跨册（人民币购物）' },
    'math-g2-m8-length-app':           { book: 'up', unit: '第1单元 长度单位' },
    'math-g2-m8-mass-app':             { book: 'down', unit: '第8单元 克和千克' },
    'math-g2-m8-extra-condition':      { book: 'up', unit: '第2单元 100以内的加法和减法（二）' },
    'math-g2-m9-data-tally':           { book: 'down', unit: '第1单元 数据收集整理' },
    'math-g2-m9-data-question':        { book: 'down', unit: '第1单元 数据收集整理' },
    'math-g2-m10-logic-reasoning':     { book: 'down', unit: '第9单元 数学广角——推理' },
    'math-g2-m10-sudoku3':             { book: 'down', unit: '第9单元 数学广角——推理' },
    'math-g2-m10-combination':         { book: 'down', unit: '第9单元 数学广角——推理' },
    'math-g2-m10-handshake':           { book: 'down', unit: '第9单元 数学广角——推理' },
    'math-g2-m10-order':               { book: 'down', unit: '第9单元 数学广角——推理' },
    'math-g2-m11-judge-mixed':         { book: 'mixed', unit: '跨册（判断题综合）' },
    'math-g2-m12-choice-mixed':        { book: 'mixed', unit: '跨册（选择题综合）' }
  };

  /**
   * 解析 KP 上下册 × 单元标注。
   * @param {object} kp 扁平 KP 记录（含 id）
   * @returns {{book:string, unit:string}|null} 未标注（竞赛 KP / 未知）返回 null
   */
  function bookUnitForKp(kp) {
    if (!kp || !kp.id) return null;
    return BOOK_UNIT_MAP[kp.id] || null;
  }

  var API = {
    bookUnitForKp: bookUnitForKp,
    BOOK_UNIT_MAP: BOOK_UNIT_MAP
  };

  global.OntologyBookMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
