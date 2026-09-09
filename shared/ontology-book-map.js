/**
 * shared/ontology-book-map.js — KP 新版教材归属标注表（V4.1.1 → 一期升级）
 *
 * 背景：人教版教材 2022 课标修订版分年级逐年替换（2024 一/二年级、2025 三/四年级、
 * 2026 五/六年级）。用户确认：以电子课本网（dzkbw）2025/2026 版目录为唯一基准，
 * 一期完成已定稿年级（一~四年级）的 KP 归属迁移与 book/unit 重标注。
 *
 * 现状：
 *   - G1：数据层（knowledge-math.js）既有 book/unit 已对齐 2024/2025 新版，本表不覆盖。
 *   - G2–G4：本表按新版教材给出 grade（跨年级迁移，缺省 = 原年级）+ book + unit。
 *
 * 新版教材重大调整（本表依据）：
 *   - 100 以内加减/笔算提前到一下（G2 口算/竖式 KP → G1）
 *   - 混合运算 → 三上（G2 脱式/两步应用 KP → G3）
 *   - 线和角 → 三上（G2 角/线段射线直线 KP → G3）；观察物体 → 三上（G4 draw-view → G3）
 *   - 生活中的运动现象 → 三下（G2 图形运动 KP → G3）
 *   - 曹冲称象（质量单位）→ 三上（G2 质量 KP → G3）
 *   - 万以内的加减法 → 二下（G3 add-sub-wan → G2）；时分秒 → 二下☆时间在哪里（G3 time → G2）
 *   - 两位数乘两位数 → 四上 多位数乘两位数（G3 mul-2digit → G4）
 *   - 除法（除数是两位数）/公顷/优化 去向待核实（G4 10 个 KP 标 grade+book 待定，unit=null）
 *   - 倍的认识/数学广角集合 新版删除（G3 2 个 KP 标记清理候选）
 *
 * 查询语义：
 *   bookUnitForKp(kp) -> { grade?:number, book?:string, unit?:string|null } | null
 *     grade 缺省 = 原年级（不迁移）；book ∈ up|down|mixed|advance；
 *     unit 为教材单元显示名；unit=null 表示待核实（不参与分组）。
 *
 * 与 ontology-category-map.js 同构：不改 KnowledgeBank 原始条目，
 * 由 Normalizer 归一化时应用；可审计、可回滚。
 */
(function (global) {
  'use strict';

  var BOOK_UNIT_MAP = {
    // ==================== 二年级（新版：二上 8 单元 / 二下 5 单元 + ☆时间在哪里） ====================
    // ---- 迁移到 G1（100 以内加减提前到一下）----
    'math-g2-m1-add-100':              { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m1-sub-100':              { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m1-mixed-addsub':         { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m2-add-col':              { grade: 1, book: 'down', unit: '第五单元 100以内的笔算加、减法' },
    'math-g2-m2-sub-col':              { grade: 1, book: 'down', unit: '第五单元 100以内的笔算加、减法' },
    'math-g2-m2-chain-add-col':        { grade: 1, book: 'down', unit: '第五单元 100以内的笔算加、减法' },
    'math-g2-m2-chain-sub-col':        { grade: 1, book: 'down', unit: '第五单元 100以内的笔算加、减法' },
    'math-g2-m2-mixed-col':            { grade: 1, book: 'down', unit: '第五单元 100以内的笔算加、减法' },
    'math-g2-m7-pic-add':              { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m7-pic-sub':              { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m7-pic-mixed':            { grade: 1, book: 'down', unit: '第四单元 100以内的口算加、减法' },
    'math-g2-m8-add-total':            { grade: 1, book: 'down', unit: '第六单元 数量间的加减关系' },
    'math-g2-m8-sub-remain':           { grade: 1, book: 'down', unit: '第六单元 数量间的加减关系' },
    'math-g2-m8-compare-diff':         { grade: 1, book: 'down', unit: '第六单元 数量间的加减关系' },
    'math-g2-m8-money':                { grade: 1, book: 'down', unit: '欢乐购物街（人民币购物）' },
    'math-g2-m8-extra-condition':      { grade: 1, book: 'mixed', unit: '跨册（解决问题·含多余条件）' },
    // ---- 迁移到 G3（混合运算 / 线和角 / 运动现象 / 质量 / 搭配）----
    'math-g2-m1-mixed-two-step':       { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-mixed-no-bracket':     { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-mixed-bracket':        { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-chain-addsub':         { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-multdiv-mixed':        { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-compare-simple':       { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m3-fill-operator':        { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m8-two-step':             { grade: 3, book: 'up', unit: '第二单元 混合运算' },
    'math-g2-m6-motion':               { grade: 3, book: 'down', unit: '第一单元 生活中的运动现象' },
    'math-g2-m6-grid-draw':            { grade: 3, book: 'down', unit: '第一单元 生活中的运动现象' },
    'math-g2-m4-angle-basic':          { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g2-m6-angle-recognize':      { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g2-m5-match-angle':          { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g2-m6-draw-angle':           { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g2-m4-mass-unit':            { grade: 3, book: 'up', unit: '曹冲称象的故事（认识质量单位）' },
    'math-g2-m4-fill-mass':            { grade: 3, book: 'up', unit: '曹冲称象的故事（认识质量单位）' },
    'math-g2-m8-mass-app':             { grade: 3, book: 'up', unit: '曹冲称象的故事（认识质量单位）' },
    'math-g2-m10-combination':         { grade: 3, book: 'up', unit: '数学广角：搭配问题' },
    'math-g2-m10-handshake':           { grade: 3, book: 'up', unit: '数学广角：搭配问题' },
    // ---- 保留 G2（二上）----
    'math-g2-m1-mult-table':           { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m1-div-table':            { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m2-mult-col':             { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m2-div-col':              { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m4-multiplication-meaning': { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m4-division-meaning':     { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m5-match-multdiv':        { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m7-pic-mult':             { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m7-pic-div':              { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m7-pic-div-include':      { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m8-mult-total':           { book: 'up', unit: '第二~四单元 表内乘法' },
    'math-g2-m8-div-partitive':        { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m8-div-quotative':        { book: 'up', unit: '第四~六单元 表内除法' },
    'math-g2-m4-length-unit':          { book: 'up', unit: '第三单元 厘米和米' },
    'math-g2-m4-fill-length':          { book: 'up', unit: '第三单元 厘米和米' },
    'math-g2-m6-draw-line':            { book: 'up', unit: '第三单元 厘米和米' },
    'math-g2-m6-measure':              { book: 'up', unit: '第三单元 厘米和米' },
    'math-g2-m8-length-app':           { book: 'up', unit: '第三单元 厘米和米' },
    'math-g2-m9-data-tally':           { book: 'up', unit: '第一单元 分类与整理' },
    'math-g2-m9-data-question':        { book: 'up', unit: '第一单元 分类与整理' },
    // ---- 保留 G2（二下）----
    'math-g2-m1-remainder-oral':       { book: 'down', unit: '第一单元 有余数的除法' },
    'math-g2-m2-remainder-col':        { book: 'down', unit: '第一单元 有余数的除法' },
    'math-g2-m8-remainder-apply':      { book: 'down', unit: '第一单元 有余数的除法' },
    'math-g2-m1-mixed-multdiv':        { book: 'down', unit: '第二单元 数量间的乘除关系' },
    'math-g2-m1-muldiv-relation':      { book: 'down', unit: '第二单元 数量间的乘除关系' },
    'math-g2-m4-read-10000':           { book: 'down', unit: '第三单元 万以内数的认识' },
    'math-g2-m4-compose-10000':        { book: 'down', unit: '第三单元 万以内数的认识' },
    'math-g2-m4-digit-order':          { book: 'down', unit: '第三单元 万以内数的认识' },
    'math-g2-m4-approx-number':        { book: 'down', unit: '第三单元 万以内数的认识' },
    'math-g2-m4-compare-10000':        { book: 'down', unit: '第三单元 万以内数的认识' },
    'math-g2-m1-addsub-1000':          { book: 'down', unit: '第四单元 万以内的加法和减法' },
    'math-g2-m4-time-unit':            { book: 'down', unit: '☆时间在哪里（认识时间）' },
    'math-g2-m4-fill-time':            { book: 'down', unit: '☆时间在哪里（认识时间）' },
    'math-g2-m4-clock-read':           { book: 'down', unit: '☆时间在哪里（认识时间）' },
    'math-g2-m6-clock-draw':           { book: 'down', unit: '☆时间在哪里（认识时间）' },
    'math-g2-m5-match-clock':          { book: 'down', unit: '☆时间在哪里（认识时间）' },
    // ---- 跨册 / 综合（G2）----
    'math-g2-m4-number-pattern':       { book: 'mixed', unit: '跨册（数列与算式规律续写）' },
    'math-g2-m5-match-calc':           { book: 'mixed', unit: '跨册（口算练习）' },
    'math-g2-m5-match-shape':          { book: 'mixed', unit: '跨册（图形与名称连线）' },
    'math-g2-m5-match-unit':           { book: 'mixed', unit: '跨册（单位与物品连线）' },
    'math-g2-m6-solid-shape':          { book: 'mixed', unit: '跨册（立体图形认识）' },
    'math-g2-m10-logic-reasoning':     { book: 'mixed', unit: '跨册（逻辑推理）' },
    'math-g2-m10-sudoku3':             { book: 'mixed', unit: '跨册（数独游戏）' },
    'math-g2-m10-order':               { book: 'mixed', unit: '跨册（排队问题）' },
    'math-g2-m11-judge-mixed':         { book: 'mixed', unit: '跨册（判断题综合）' },
    'math-g2-m12-choice-mixed':        { book: 'mixed', unit: '跨册（选择题综合）' },

    // ==================== 三年级（新版：三上 7 单元 + 曹冲称象/数字编码 + 广角搭配 / 三下 7 单元 + ☆年月日） ====================
    // ---- 迁移到 G2（万以内加减法 / 时分秒）----
    'math-g3-m1-g3-add-sub-wan':       { grade: 2, book: 'down', unit: '第四单元 万以内的加法和减法' },
    'math-g3-m4-g3-time':              { grade: 2, book: 'down', unit: '☆时间在哪里（认识时间）' },
    // ---- 迁移到 G4（两位数乘两位数）----
    'math-g3-m1-g3-mul-2digit':        { grade: 4, book: 'up', unit: '第三单元 多位数乘两位数' },
    // ---- 保留 G3（三上）----
    'math-g3-m1-g3-mul-multi1':        { book: 'up', unit: '第四单元 多位数乘一位数' },
    'math-g3-m1-g3-oral-mul':          { book: 'up', unit: '第四单元 多位数乘一位数' },
    'math-g3-m4-g3-fraction':          { book: 'up', unit: '第六单元 分数的初步认识' },
    'math-g3-m4-g3-fracadd':           { book: 'up', unit: '第六单元 分数的初步认识' },
    'math-g3-m4-g3-measure':           { book: 'up', unit: '第三单元 毫米、分米和千米' },
    'math-g3-m6-g3-position':          { book: 'mixed', unit: '清理候选（新版三上/三下删除位置与方向单元）' },
    // ---- 保留 G3（三下）----
    'math-g3-m1-g3-div1':              { book: 'down', unit: '第二单元 除数是一位数的除法' },
    'math-g3-m6-g3-perimeter':         { book: 'down', unit: '第三单元 长方形和正方形' },
    'math-g3-m6-g3-polygon':           { book: 'down', unit: '第三单元 长方形和正方形' },
    'math-g3-m6-g3-area':              { book: 'down', unit: '第四单元 图形的面积' },
    'math-g3-m9-g3-stats-table':       { book: 'down', unit: '第五单元 数据的收集与整理' },
    'math-g3-m4-g3-year-month':        { book: 'down', unit: '☆年、月、日的秘密' },
    'math-g3-m4-g3-decimal':           { book: 'down', unit: '第六单元 小数的初步认识' },
    'math-g3-m10-g3-combination':      { book: 'up', unit: '数学广角：搭配问题' },
    'math-g3-m10-g3-code':             { book: 'up', unit: '数字编码（认识数字编码/编制学号）' },
    'math-g3-m8-g3-equivalent':        { book: 'up', unit: '曹冲称象的故事（等量代换）' },
    // ---- 清理候选（新版删除）----
    'math-g3-m8-g3-times':             { book: 'mixed', unit: '清理候选（新版三上删除倍的认识）' },
    'math-g3-m10-g3-set':              { book: 'mixed', unit: '清理候选（新版删除数学广角集合）' },

    // ==================== 四年级（新版：四上 7 单元 + 综合实践 / 四下 10 单元） ====================
    // ---- 迁移到 G3（线段射线直线 / 观察物体）----
    'math-g4-m4-g4-fill-line':         { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g4-m11-g4-judge-line':       { grade: 3, book: 'up', unit: '第五单元 线和角' },
    'math-g4-m6-g4-draw-view':         { grade: 3, book: 'up', unit: '第一单元 观察物体' },
    // ---- 保留 G4（四上）----
    'math-g4-m1-g4-oral-big':          { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m4-g4-fill-bignum':       { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m5-g4-match-read':        { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m7-g4-pic-brace':         { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m8-g4-word-big':          { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m11-g4-judge-read':       { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m12-g4-choice-big':       { book: 'up', unit: '第一单元 万以上数的认识' },
    'math-g4-m4-g4-fill-angle':        { book: 'up', unit: '第二单元 角的度量' },
    'math-g4-m5-g4-match-angle':       { book: 'up', unit: '第二单元 角的度量' },
    'math-g4-m6-g4-draw-protractor':   { book: 'up', unit: '第二单元 角的度量' },
    'math-g4-m11-g4-judge-angle':      { book: 'up', unit: '第二单元 角的度量' },
    'math-g4-m12-g4-choice-angle':     { book: 'up', unit: '第二单元 角的度量' },
    'math-g4-m1-g4-oral-mul3x1':       { book: 'up', unit: '第三单元 多位数乘两位数' },
    'math-g4-m1-g4-oral-mul2t':        { book: 'up', unit: '第三单元 多位数乘两位数' },
    'math-g4-m2-g4-v-mul3x2':          { book: 'up', unit: '第三单元 多位数乘两位数' },
    'math-g4-m2-g4-v-mulzero':         { book: 'up', unit: '第三单元 多位数乘两位数' },
    'math-g4-m12-g4-choice-est':       { book: 'up', unit: '第三单元 多位数乘两位数' },
    'math-g4-m7-g4-pic-segment':       { book: 'up', unit: '第四单元 加法模型和乘法模型' },
    'math-g4-m7-g4-pic-speed':         { book: 'up', unit: '第四单元 加法模型和乘法模型' },
    'math-g4-m8-g4-word-speed':        { book: 'up', unit: '第四单元 加法模型和乘法模型' },
    'math-g4-m8-g4-word-price':        { book: 'up', unit: '第四单元 加法模型和乘法模型' },
    'math-g4-m4-g4-fill-quad':         { book: 'up', unit: '第五单元 平行四边形和梯形' },
    'math-g4-m5-g4-match-shape':       { book: 'up', unit: '第五单元 平行四边形和梯形' },
    'math-g4-m6-g4-draw-para':         { book: 'up', unit: '第五单元 平行四边形和梯形' },
    'math-g4-m6-g4-draw-grid':         { book: 'up', unit: '第五单元 平行四边形和梯形' },
    'math-g4-m12-g4-choice-shape':     { book: 'up', unit: '第五单元 平行四边形和梯形' },
    'math-g4-m9-g4-stats-bar':         { book: 'up', unit: '第六单元 条形统计图' },
    'math-g4-m9-g4-stats-double':      { book: 'up', unit: '第六单元 条形统计图' },
    // ---- 保留 G4（四下）----
    'math-g4-m3-g4-mix-order':         { book: 'down', unit: '第一单元 四则运算' },
    'math-g4-m4-g4-fill-op':           { book: 'down', unit: '第一单元 四则运算' },
    'math-g4-m1-g4-oral-law':          { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m3-g4-mix-addlaw':        { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m3-g4-mix-mullaw':        { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m3-g4-mix-dist':          { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m5-g4-match-law':         { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m11-g4-judge-law':        { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m12-g4-choice-law':       { book: 'down', unit: '第三单元 运算定律' },
    'math-g4-m4-g4-fill-dec':          { book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g4-m5-g4-match-decfrac':     { book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g4-m11-g4-judge-dec':        { book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g4-m12-g4-choice-dec':       { book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g4-m4-g4-fill-tri':          { book: 'down', unit: '第五单元 三角形' },
    'math-g4-m11-g4-judge-tri':        { book: 'down', unit: '第五单元 三角形' },
    'math-g4-m1-g4-oral-dec':          { book: 'down', unit: '第六单元 小数的加法和减法' },
    'math-g4-m2-g4-v-dec':             { book: 'down', unit: '第六单元 小数的加法和减法' },
    'math-g4-m3-g4-mix-dec':           { book: 'down', unit: '第六单元 小数的加法和减法' },
    'math-g4-m7-g4-pic-dec':           { book: 'down', unit: '第六单元 小数的加法和减法' },
    'math-g4-m8-g4-word-dec':          { book: 'down', unit: '第六单元 小数的加法和减法' },
    'math-g4-m6-g4-draw-sym':          { book: 'down', unit: '第七单元 图形的运动（二）' },
    'math-g4-m6-g4-draw-move':         { book: 'down', unit: '第七单元 图形的运动（二）' },
    'math-g4-m4-g4-fill-avg':          { book: 'down', unit: '第八单元 平均数与条形统计图' },
    'math-g4-m8-g4-word-avg':          { book: 'down', unit: '第八单元 平均数与条形统计图' },
    'math-g4-m9-g4-stats-avg':         { book: 'down', unit: '第八单元 平均数与条形统计图' },
    'math-g4-m11-stats':               { book: 'down', unit: '第八单元 平均数与条形统计图' },
    'math-g4-m8-g4-word-cr':           { book: 'down', unit: '第九单元 数学广角——鸡兔同笼' },
    'math-g4-m10-g4-reason-cr':        { book: 'down', unit: '第九单元 数学广角——鸡兔同笼' },
    'math-g4-m10-logic-reasoning':     { book: 'mixed', unit: '跨册（简单逻辑推理）' },
    // ---- 待核实处置（二期核实：2026 秋教材培训多源确认）----
    // 除数是两位数的除法 / 公顷和平方千米 → 调整至四下（分散计算难点）
    // 数学广角——优化 → 删除独立单元（思想简化融入练习）
    'math-g4-m1-g4-oral-divt':         { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m2-g4-v-div2':            { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m2-g4-v-div2q':           { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m4-g4-fill-quotient':     { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m8-g4-word-div':          { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m11-g4-judge-quotient':   { book: 'down', unit: '除数是两位数的除法（调整至四下）' },
    'math-g4-m4-g4-fill-hectare':      { book: 'down', unit: '公顷和平方千米（调整至四下）' },
    'math-g4-m8-g4-word-area':         { book: 'down', unit: '公顷和平方千米（调整至四下）' },
    'math-g4-m8-g4-word-opt':          { book: 'mixed', unit: '清理候选（新版删除数学广角优化）' },
    'math-g4-m10-g4-reason-opt':       { book: 'mixed', unit: '清理候选（新版删除数学广角优化）' },
    // ==================== 五年级（新版：五上 8 单元已定稿 2026 秋 / 五下待 2027 春定稿） ====================
    // ---- 迁移 G4（小数数位/比较→四下；积的变化规律→四上）----
    'math-g5-m4-g5-fill-decloc':       { grade: 4, book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g5-m4-g5-fill-deccmp':       { grade: 4, book: 'down', unit: '第四单元 小数的意义和性质' },
    'math-g5-m4-g5-fill-prodrule':     { grade: 4, book: 'up', unit: '第三单元 多位数乘两位数' },
    // ---- 迁移 G6（数对/位置移六上）----
    'math-g5-m4-g5-fill-coord':        { grade: 6, book: 'up', unit: '位置与方向（数对并入，待六上定稿）' },
    'math-g5-m6-g5-draw-coord':        { grade: 6, book: 'up', unit: '位置与方向（数对并入，待六上定稿）' },
    // ---- 保留 G5（五上 2026 秋新版）----
    'math-g5-m1-g5-oral-decmul':       { book: 'up', unit: '第二单元 小数乘法' },
    'math-g5-m2-g5-v-decmul':          { book: 'up', unit: '第二单元 小数乘法' },
    'math-g5-m3-g5-mix-decsimple':     { book: 'up', unit: '第二单元 小数乘法' },
    'math-g5-m7-g5-pic-segment':       { book: 'up', unit: '第二~三单元 小数乘除法' },
    'math-g5-m8-g5-word-decmul':       { book: 'up', unit: '第二单元 小数乘法' },
    'math-g5-m1-g5-oral-decdiv':       { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m2-g5-v-divint':          { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m2-g5-v-ddivdec':         { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m2-g5-v-repeating':       { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m4-g5-fill-repeating':    { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m8-g5-word-decdiv':       { book: 'up', unit: '第三单元 小数除法' },
    'math-g5-m3-g5-mix-decmixed':      { book: 'up', unit: '第二~三单元 小数乘除法' },
    'math-g5-m6-g5-draw-observe':      { book: 'up', unit: '第一单元 观察简单组合体' },
    'math-g5-m4-g5-fill-rotate':       { book: 'up', unit: '第四单元 图形的运动' },
    'math-g5-m6-g5-draw-rotate':       { book: 'up', unit: '第四单元 图形的运动' },
    'math-g5-m6-g5-draw-sym':          { book: 'up', unit: '第四单元 图形的运动' },
    'math-g5-m11-motion':              { book: 'up', unit: '第四单元 图形的运动' },
    'math-g5-m12-motion':              { book: 'up', unit: '第四单元 图形的运动' },
    'math-g5-m4-g5-fill-area':         { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m5-g5-match-areaf':       { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m6-g5-draw-height':       { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m7-g5-pic-area':          { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m8-g5-word-area':         { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m11-g5-judge-area':       { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m12-g5-choice-area':      { book: 'up', unit: '第六单元 多边形的面积' },
    'math-g5-m4-g5-fill-possible':     { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m5-g5-match-possib':      { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m8-g5-word-possib':       { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m9-g5-stats-possib':      { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m11-g5-judge-possib':     { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m12-g5-choice-possib':    { book: 'up', unit: '第七单元 可能性' },
    'math-g5-m11-g5-judge-decmul':     { book: 'up', unit: '第二~三单元 小数乘除法' },
    'math-g5-m12-g5-choice-decmul':    { book: 'up', unit: '第二~三单元 小数乘除法' },
    'math-g5-m4-g5-fill-letter':       { book: 'up', unit: '第五单元 用字母表示数和数量关系' },
    // ---- 五下（2027 春待定稿，unit 不带序号，先标下）----
    'math-g5-m1-g5-oral-fracadd':      { book: 'down', unit: '分数的加法和减法（五下）' },
    'math-g5-m3-g5-mix-fracmixed':     { book: 'down', unit: '分数的加法和减法（五下）' },
    'math-g5-m3-g5-mix-fracsimple':    { book: 'down', unit: '分数的加法和减法（五下）' },
    'math-g5-m1-g5-oral-fm':           { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m4-g5-fill-fm':           { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m4-g5-fill-prime':        { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m8-g5-word-fm':           { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m11-g5-judge-fm':         { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m12-g5-choice-fm':        { book: 'down', unit: '因数与倍数（五下）' },
    'math-g5-m4-g5-fill-fracmean':     { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m4-g5-fill-fracprop':     { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m4-g5-fill-fracdec':      { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m5-g5-match-fracdec':     { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m8-g5-word-frac':         { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m11-g5-judge-frac':       { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m12-g5-choice-frac':      { book: 'down', unit: '分数的意义和性质（五下）' },
    'math-g5-m4-g5-fill-solid':        { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m5-g5-match-solid':       { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m6-g5-draw-net':          { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m8-g5-word-solid':        { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m11-g5-judge-solid':      { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m12-g5-choice-solid':     { book: 'down', unit: '长方体和正方体（五下）' },
    'math-g5-m4-g5-fill-linechart':    { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m8-g5-word-linechart':    { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m9-g5-stats-line1':       { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m9-g5-stats-line2':       { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m11-stats':               { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m12-stats':               { book: 'down', unit: '折线统计图（五下）' },
    'math-g5-m8-g5-word-defect':       { book: 'down', unit: '数学广角——找次品（五下）' },
    'math-g5-m10-g5-reason-defect':    { book: 'down', unit: '数学广角——找次品（五下）' },
    // ---- 清理候选（新版五上删除简易方程/数学广角植树问题）----
    'math-g5-m1-g5-oral-equ':          { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m4-g5-fill-equation':     { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m5-g5-match-equ':         { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m7-g5-pic-balance':       { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m8-g5-word-equ':          { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m11-g5-judge-equ':        { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m12-g5-choice-equ':       { book: 'mixed', unit: '清理候选（新版解方程移出小学）' },
    'math-g5-m7-g5-pic-tree':          { book: 'mixed', unit: '清理候选（新版五上删除数学广角植树问题）' },
    'math-g5-m8-g5-word-tree':         { book: 'mixed', unit: '清理候选（新版五上删除数学广角植树问题）' },
    'math-g5-m10-g5-reason-tree3':     { book: 'mixed', unit: '清理候选（新版五上删除数学广角植树问题）' },
    // ---- 跨册（G5）----
    'math-g5-m10-logic-reasoning':     { book: 'mixed', unit: '跨册（逻辑推理）' },
    'math-g5-m10-g5-reason-seq':       { book: 'mixed', unit: '跨册（数字推理）' }
    // ==================== 六年级（新版六上目录未完全定稿：dzkbw 仍旧版，多源指向百分数整合版；暂不映射） ====================
  };

  /**
   * 解析 KP 新版教材归属（grade/book/unit）。
   * @param {object} kp 扁平 KP 记录（含 id）
   * @returns {{grade?:number, book?:string, unit?:string|null}|null}
   *   未标注（竞赛 KP / 未知）返回 null；unit=null 表示待核实。
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
