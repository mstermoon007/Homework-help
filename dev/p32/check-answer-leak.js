#!/usr/bin/env node
'use strict';
// dev/p32/check-answer-leak.js — P32-AS-18 答案防泄露门禁（正式化）
//
// 任务书 §3 决策 4 / §9.2 口径：对 1570 ALLOW(KP,QT) 真实生成跑 L1-L4 规则 + 标准答案自判回放。
// 生成口径与冻结矩阵完全同源（freezeSeed p28-v1 / FREEZE_DIFFICULTY=3，镜像
// dev/p28/check-generation-matrix-freeze.js），保证白名单注册表稳定可复现。
//
// L1 题面泄露：fill/calc/apply/geometry/choice/classify 的 prompt 不得含 answer.value /
//   acceptable 任一原文（token 边界匹配 (^|[^\d.])token($|[^\d.])）。judge 答案为 boolean，
//   无文本可泄，不参与 token 扫描。命中必须落入下方白名单注册表（含 AS-16C 用户裁决
//   #1~11 概念支架白名单与 B/P/数据巧合既定白名单），未登记命中 → FAIL。
//   严格口径：任何形式的原文出现（含操作数重合/散文已知量）都必须显式登记，
//   不做「操作数豁免」等结构放行——保证散文式泄露（如「对着刻度 8」复述所求）也被拦截。
// L2 图形泄露：带 graphic 描述符的题渲染 SVG（与生产同链 SVGRegistry.render），
//   提取 <text> 文本内容扫描答案原文；命中须登记白名单（图形刻度/图内已知量），否则 FAIL。
//   （「允许出现的数字 = 题干已知量」的逐 role 核对即由注册表 reason 字段承载。）
// L3 语义串道（结构断言，AS-02 结论：文本重合启发式 40 条全误报，禁用）：
//   a. html-renderer.js 源码零读取 explanation（唯一流道 = computeResult 提交后通道，
//      practice.html markQuestions 注入）；
//   b. 全生成 prompt/options/hint/explanation 零内部溯源 key
//      （'说明思路'/'比较解法'/'解释为什么'/'cognitiveHint'，variation-apply AS-15 已删轨道）。
// L4 hint 清点：全生成 hint 非空必须为 0（hint 无 SSOT 生产者，§4 可见时机矩阵）。
// 自判回放（AS-14 risk② 固化）：RenderFormat → answerSpec → gradeUserAnswer 以标准答案作答，
//   FALSE 必须为 0；null（家长检查）只允许出现在 apply/geometry（长文本说理边界）。
//
// 退出码：任何 FAIL → 1。白名单注册表变更 = 有意决策，必须同步 docs/P32/change-log.md。

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var RenderFormat = env.RenderFormat || require(path.join(ROOT, 'shared', 'presentation', 'render-format.js'));
var AV = require(path.join(ROOT, 'shared', 'validator', 'answer-validator.js'));
var HTML_RENDERER = path.join(ROOT, 'shared', 'presentation', 'html-renderer.js');

// ---- L2：加载与生产同链的 SVG 渲染栈（镜像 tests/presentation/svg-contract-full.test.js）----
['shared/svg/svg-core.js',
  'shared/svg/svg-geometry.js',
  'shared/svg/svg-calculation.js',
  'shared/svg/svg-make-ten.js',
  'shared/svg/svg-chart.js',
  'shared/svg/svg-diagram.js',
  'shared/svg/svg-currency.js',
  'plugins/svg-clock.js',
  'plugins/svg-area.js',
  'plugins/svg-fraction.js',
  'plugins/svg-data-stats.js',
  'plugins/svg-draw.js'].forEach(function (rel) { require(path.join(ROOT, rel)); });
var SVGRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
SVGRegistry.seedFromGlobal();

// ---- 冻结口径（与 check-generation-matrix-freeze.js 逐字一致）----
var FREEZE_SEED_VERSION = 'p28-v1';
var FREEZE_DIFFICULTY = 3;
function freezeSeed(kp, qt) {
  return 'freeze:' + FREEZE_SEED_VERSION + '|' + kp + '|' + qt + '|d' + FREEZE_DIFFICULTY;
}
function gradeOf(kp) {
  var m = /^math-g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

// ---- 白名单注册表（严格显式登记，layer ∈ L1/L2）----
// 来源：AS-02 泄露审计四向分流 + AS-16C 用户裁决（2026-10-07「#1~11 白名单固化进 AS-18 门禁」）。
// 首跑观察模式收集 freezeSeed 口径实际命中后，逐条对照裁决家族登记；
// 未登记命中 → FAIL（新泄露或口径漂移，须人工裁决后更新本表）。
var WHITELIST = [
  // [kp, qt, token, layer, bucket, reason] — 163 条：AS-18 观察运行（freeze 口径 1570 行）逐行人工裁决
  ['math-g1-down-u03-k001', 'apply', '6', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g1-down-u03-k006', 'apply', '<', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g1-down-u04-k003', 'calc', '34', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-down-u07-k003', 'choice', '5分', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-up-u01-k001', 'calc', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-up-u01-k001', 'fill', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-up-u01-k002', 'fill', '3', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-up-u02-k002', 'fill', '6', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u02-k005', 'fill', '☆', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g2-down-u02-k005', 'choice', '○', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g2-down-u02-k005', 'geometry', '□', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g2-down-u02-k005', 'apply', '红花', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g2-down-u03-k001', 'calc', '4', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u03-k001', 'fill', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u03-k001', 'choice', '9', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u03-k001', 'apply', '2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u03-k002', 'fill', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u04-k004', 'fill', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-down-u04-k004', 'apply', '1', 'L1', 'C-ABACUS', 'AS-16C #7：算盘下珠表示 1 为教具定义'],
  ['math-g2-down-u04-k005', 'apply', '<', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g2-down-u07-k002', 'fill', '8', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-up-u03-k002', 'fill', '7', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-up-u03-k003', 'fill', '8', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-up-u03-k004', 'fill', '3', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g2-up-u03-k005', 'fill', '7', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-down-u02-k002', 'calc', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-down-u02-k002', 'fill', '8', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-down-u02-k004', 'apply', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-down-u02-k006', 'fill', '8', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-down-u04-k001', 'geometry', '甲', 'L1', 'C-AREA', 'AS-16C #2：铺满计数与面积同源为面积定义本身'],
  ['math-g3-down-u04-k001', 'apply', '12', 'L1', 'C-AREA', 'AS-16C #2：铺满计数与面积同源为面积定义本身'],
  ['math-g3-down-u06-k002', 'fill', '闰年', 'L1', 'C-CONCEPT', 'AS-16C #8：概念认识题，概念名入题面为题面材料'],
  ['math-g3-down-u07-k002', 'fill', '>', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g3-down-u07-k002', 'apply', '小明', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g3-up-u01-k001', 'choice', '上面', 'L1', 'C-VIEW', 'AS-16C #4：观察方向词为题面材料'],
  ['math-g3-up-u02-k001', 'fill', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u02-k004', 'apply', '21', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u03-k002', 'geometry', '10', 'L1', 'C-UNIT', 'AS-16C #6：米-分米进率 10 为定义值'],
  ['math-g3-up-u04-k004', 'apply', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u05-k001', 'fill', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u05-k005', 'calc', '1', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u05-k005', 'apply', '2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g3-up-u07-k002', 'geometry', '不变', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g3-up-u08-k001', 'fill', '9', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g3-up-u08-k002', 'fill', '4', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g3-up-u08-k003', 'calc', '1/4', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g3-up-u08-k003', 'fill', '<', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g3-up-u08-k003', 'apply', '小华', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g3-up-u08-k005', 'fill', '9', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g3-up-u09-k001', 'choice', '4', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u01-k002', 'calc', '6', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u01-k002', 'fill', '6', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u01-k002', 'apply', '3', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u01-k003', 'fill', '16', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u02-k002', 'fill', '3', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g4-down-u02-k002', 'choice', '3', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g4-down-u02-k002', 'geometry', '3', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g4-down-u03-k003', 'apply', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u04-k004', 'fill', '<', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g4-down-u04-k004', 'apply', '小红', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u04-k007', 'choice', '9.2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-down-u05-k006', 'fill', '90', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g4-down-u05-k006', 'choice', '90', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g4-down-u05-k006', 'geometry', '90', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g4-down-u07-k002', 'fill', '3', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g4-down-u07-k002', 'choice', '3', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g4-down-u07-k002', 'geometry', '3', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g4-down-u09-k001', 'fill', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u09-k001', 'choice', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u09-k001', 'apply', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u09-k002', 'fill', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u09-k002', 'choice', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-down-u09-k002', 'apply', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g4-up-u01-k005', 'apply', '<', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g4-up-u02-k001', 'choice', '角', 'L1', 'C-CONCEPT', 'AS-16C #8：概念认识题，概念名入题面为题面材料'],
  ['math-g4-up-u02-k003', 'choice', '角', 'L1', 'C-CONCEPT', 'AS-16C #8：概念认识题，概念名入题面为题面材料'],
  ['math-g4-up-u03-k002', 'apply', '3', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-up-u03-k003', 'fill', '4', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-up-u04-k002', 'calc', '6', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g4-up-u04-k002', 'apply', '2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g5-down-u01-k001', 'fill', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u01-k001', 'choice', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u01-k001', 'geometry', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u01-k002', 'fill', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u01-k002', 'choice', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u01-k002', 'geometry', '4', 'L1', 'C-VIEW', 'AS-16C #4：视图描述读数即视图定义，为题面材料'],
  ['math-g5-down-u02-k002', 'calc', '9', 'L1', 'C-LCM', 'AS-16C #5：倍数/因数/质数判断中给定数即判断对象'],
  ['math-g5-down-u02-k002', 'fill', '8', 'L1', 'C-LCM', 'AS-16C #5：倍数/因数/质数判断中给定数即判断对象'],
  ['math-g5-down-u02-k002', 'choice', '8', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g5-down-u02-k002', 'apply', '5', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g5-down-u02-k003', 'apply', '30', 'L1', 'C-LCM', 'AS-16C #5：倍数/因数/质数判断中给定数即判断对象'],
  ['math-g5-down-u02-k004', 'calc', '25', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g5-down-u02-k004', 'fill', '48', 'L1', 'C-LCM', 'AS-16C #5：倍数/因数/质数判断中给定数即判断对象'],
  ['math-g5-down-u02-k004', 'apply', '偶数', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g5-down-u02-k005', 'fill', '13', 'L1', 'C-LCM', 'AS-16C #5：倍数/因数/质数判断中给定数即判断对象'],
  ['math-g5-down-u02-k005', 'apply', '质数', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g5-down-u02-k006', 'calc', '偶数', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g5-down-u02-k006', 'fill', '偶数', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g5-down-u02-k006', 'apply', '奇数', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g5-down-u04-k002', 'fill', '4', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g5-down-u04-k004', 'fill', '3', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g5-down-u04-k006', 'fill', '5', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g5-down-u05-k003', 'fill', '4', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g5-down-u05-k003', 'choice', '4', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g5-down-u05-k003', 'geometry', '4', 'L1', 'C-SYMMETRY', 'AS-16C #3：对称距离为题面给定条件'],
  ['math-g5-down-u06-k002', 'fill', '5/6', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g5-down-u06-k003', 'fill', '1/7', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g5-down-u08-k001', 'fill', '1', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g5-down-u08-k001', 'choice', '1', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g5-down-u08-k001', 'apply', '1', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g5-down-u10-k001', 'fill', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-down-u10-k001', 'choice', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-down-u10-k001', 'apply', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-down-u10-k004', 'fill', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-down-u10-k004', 'choice', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-down-u10-k004', 'apply', '乙', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-up-u01-k001', 'choice', '正面', 'L1', 'C-VIEW', 'AS-16C #4：观察方向词为题面材料'],
  ['math-g5-up-u07-k002', 'fill', '红球', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-up-u07-k002', 'choice', '红球', 'L1', 'P-KNOWN', '人名/规律符号/已知量等题面给定材料，非所求答案'],
  ['math-g5-up-u07-k003', 'fill', '2', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g5-up-u07-k004', 'fill', '3', 'L1', 'P-KNOWN', '已知角 90°/1 瓶次品/试验统计等题面给定数量，非所求答案'],
  ['math-g5-up-u08-k004', 'fill', '6', 'L1', 'C-AREA', 'AS-16C #2：铺满计数与面积同源为面积定义本身'],
  ['math-g5-up-u08-k004', 'choice', '6', 'L1', 'C-AREA', 'AS-16C #2：铺满计数与面积同源为面积定义本身'],
  ['math-g6-down-u01-k005', 'choice', '25', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-down-u04-k001', 'calc', '能', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g6-down-u04-k001', 'fill', '3', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-down-u04-k002', 'calc', '2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-down-u04-k002', 'choice', '2', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-down-u04-k003', 'calc', '能', 'L1', 'C-OPTIONSET', 'AS-16C #10/#11：选项集语义（比较符号/判断词），答案为集合语义非数值复述'],
  ['math-g6-down-u04-k004', 'calc', '18', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-down-u04-k005', 'calc', '20', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g6-up-u01-k001', 'fill', '3', 'L1', 'C-POSITION', 'AS-16C #9：数对位置描述即位置定义'],
  ['math-g6-up-u03-k004', 'fill', '2/9', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g6-up-u03-k005', 'fill', '2/4', 'L1', 'C-FRACTION-PART', 'AS-16C #1：分数部分定义/基本性质中已知分数与所填数值同源'],
  ['math-g6-up-u04-k001', 'geometry', '圆', 'L1', 'C-CONCEPT', 'AS-16C #8：概念认识题，概念名入题面为题面材料'],
  ['math-g6-up-u05-k001', 'fill', '25', 'L1', 'B-OPERAND', '数值 token 为算式操作数/题面已知成分，非答案复述（AS-16C 既定口径）'],
  ['math-g1-down-u07-k003', 'choice', '5分', 'L2', 'B-OPERAND', '换算算式可视化中的已知操作数，非答案复述'],
  ['math-g1-up-u03-k001', 'fill', '6', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g1-up-u03-k001', 'geometry', '6', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g1-up-u03-k002', 'choice', '6', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g2-down-u02-k005', 'geometry', '□', 'L2', 'GRAPHIC-MATERIAL', '图形为规律序列材料，□ 为序列元素非答案'],
  ['math-g2-up-u05-k003', 'fill', '2', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g2-up-u05-k003', 'choice', '2', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g3-down-u01-k001', 'fill', '2', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g3-down-u01-k001', 'choice', '2', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g3-down-u08-k004', 'choice', '葡萄', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g3-up-u01-k003', 'fill', '3', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g3-up-u03-k002', 'geometry', '10', 'L2', 'C-UNIT', 'AS-16C #6 延伸：题面已述「平均分成 10 份」，图形未新增信息（用户裁决白名单）'],
  ['math-g3-up-u07-k004', 'choice', '1', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g3-up-u07-k004', 'geometry', '1', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g4-down-u02-k002', 'fill', '3', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g4-down-u02-k002', 'geometry', '3', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g4-down-u08-k004', 'fill', '755', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g4-down-u08-k004', 'choice', '猪肉炖粉条', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g4-up-u05-k003', 'choice', '1', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g4-up-u05-k003', 'geometry', '1', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g4-up-u06-k001', 'choice', '二月', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g4-up-u06-k002', 'choice', '跳绳', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g4-up-u06-k003', 'choice', '跳绳', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g5-down-u01-k001', 'choice', '4', 'L2', 'GRAPHIC-COINCIDENCE', '图形标注数值与答案数值巧合，图形承载结构信息非数量信息（逐行取证）'],
  ['math-g5-down-u07-k001', 'choice', '周六', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g5-down-u07-k002', 'choice', '周六', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
  ['math-g5-down-u07-k003', 'choice', '周六', 'L2', 'GRAPHIC-DATA', '图表读数目标本身，图形承载读数教学目标（逐行取证）'],
];

function whitelistKey(kp, qt, token, layer) {
  for (var i = 0; i < WHITELIST.length; i++) {
    var w = WHITELIST[i];
    if (w[0] === kp && w[1] === qt && w[2] === token && w[3] === layer) return w;
  }
  return null;
}

// ---- 扫描工具 ----
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// token 边界匹配：避免「3」命中「13」；中文/符号均作边界
function tokenHit(text, token) {
  if (!token) return false;
  return new RegExp('(^|[^\\d.])' + escapeRegExp(token) + '($|[^\\d.])').test(String(text));
}
function candidatesOf(sq) {
  var a = sq.answer || {};
  var out = [];
  if (a.value !== undefined && a.value !== null && String(a.value) !== '') out.push(String(a.value));
  if (Array.isArray(a.acceptable)) {
    a.acceptable.forEach(function (x) {
      if ((typeof x === 'string' || typeof x === 'number') && String(x) !== '') out.push(String(x));
    });
  }
  return out;
}
// SVG 只扫 text 内容（>…< 之间），不扫属性（宽高/坐标数字非标注）
function svgTexts(svg) {
  var out = [];
  var m = String(svg).match(/>([^<>]+)</g) || [];
  m.forEach(function (s) { out.push(s.slice(1, -1)); });
  return out.join('\n');
}
function snippetAround(text, token) {
  var i = String(text).indexOf(String(token));
  if (i < 0) return String(text).slice(0, 60);
  var s = Math.max(0, i - 30);
  return String(text).slice(s, i + String(token).length + 30);
}

// ---- 枚举 ALLOW 对（镜像冻结门禁）----
var CANONICAL = QTR.TYPES.map(function (t) { return t.id; });
var ALL = CANONICAL;
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// ---- 内部溯源 key（AS-15 已删轨道，防回归）----
var INTERNAL_KEYS = ['说明思路', '比较解法', '解释为什么', 'cognitiveHint'];

// ---- L3a 结构断言：html-renderer 零读取 explanation ----
var l3Source = fs.readFileSync(HTML_RENDERER, 'utf8');
var l3aOk = l3Source.indexOf('explanation') === -1;

// ---- 主扫描 ----
(async function run() {
  var fails = [];
  var l1Hits = 0, l1Wl = 0, l1Bad = [];
  var l2Scanned = 0, l2Status = { SUCCESS: 0, UNSUPPORTED: 0, FAILED: 0 }, l2Hits = 0, l2Bad = [];
  var l3bBad = [];
  var l4Bad = [];
  var replay = { TRUE: 0, FALSE: 0, NULL: 0 };
  var replayFalseRows = [];
  var replayNullBad = [];

  if (pairs.length !== 1570) {
    console.log('ALLOW 对枚举 ' + pairs.length + ' != 1570（先修 6b 矩阵门禁再跑本门禁）');
    process.exit(1);
  }

  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var sq = null;
    try {
      var session = new PracticeSession({
        subject: 'math', grade: gradeOf(p.kp), count: 1,
        difficulty: FREEZE_DIFFICULTY,
        knowledgePointId: p.kp, questionType: p.qt,
        seed: freezeSeed(p.kp, p.qt)
      });
      await session.start();
      sq = (session.semanticQuestions || [])[0] || null;
    } catch (e) {
      fails.push(p.kp + '/' + p.qt + ' 生成异常: ' + String((e && e.message) || e).slice(0, 100));
      continue;
    }
    if (!sq) { fails.push(p.kp + '/' + p.qt + ' 零产出'); continue; }

    var qt = sq.questionType || p.qt;
    var prompt = String(sq.prompt || '');
    var cands = qt === 'judge' ? [] : candidatesOf(sq); // judge 答案 boolean，无文本可泄

    // ---- L1 题面 ----
    cands.forEach(function (tok) {
      if (!tokenHit(prompt, tok)) return;
      l1Hits++;
      var w = whitelistKey(p.kp, p.qt, tok, 'L1');
      if (w) { l1Wl++; return; }
      l1Bad.push(p.kp + '/' + p.qt + ' token=「' + tok + '」 | …' + snippetAround(prompt, tok) + '…');
    });

    // ---- L2 图形（描述符归一化逐字镜像 renderer.js L52-56：sq.graphic 优先，兜底 sq.data.graphic）----
    var graphic = (sq.graphic && typeof sq.graphic === 'object' && typeof sq.graphic.type === 'string')
      ? sq.graphic
      : (sq.data && sq.data.graphic) || null;
    if (graphic && typeof graphic === 'object') {
      l2Scanned++;
      var rendered = null, svgStr = null;
      try { rendered = SVGRegistry.render(graphic); } catch (e2) { rendered = { status: 'FAILED', error: e2 }; }
      l2Status[rendered.status] = (l2Status[rendered.status] || 0) + 1;
      if (rendered && rendered.status === 'SUCCESS' && typeof rendered.svg === 'string') svgStr = rendered.svg;
      if (svgStr == null && typeof sq.svg === 'string') svgStr = sq.svg; // 原始 svg 直存轨（现状应为空）
      if (svgStr != null) {
        var texts = svgTexts(svgStr);
        cands.forEach(function (tok) {
          if (!tokenHit(texts, tok)) return;
          l2Hits++;
          var w2 = whitelistKey(p.kp, p.qt, tok, 'L2');
          if (w2) return;
          l2Bad.push(p.kp + '/' + p.qt + ' token=「' + tok + '」 | …' + snippetAround(texts, tok) + '…');
        });
      }
    }

    // ---- L3b 内部 key ----
    var opts = (sq.data && Array.isArray(sq.data.options)) ? sq.data.options.join('\n') : '';
    var expl = (sq.answer && sq.answer.explanation != null) ? String(sq.answer.explanation) : '';
    var hintStr = sq.hint != null ? String(sq.hint) : '';
    INTERNAL_KEYS.forEach(function (key) {
      if (tokenHit(prompt, key) || tokenHit(opts, key) || tokenHit(expl, key) || tokenHit(hintStr, key)) {
        l3bBad.push(p.kp + '/' + p.qt + ' 内部 key「' + key + '」入 ' + (tokenHit(prompt, key) ? 'prompt' : tokenHit(opts, key) ? 'options' : tokenHit(expl, key) ? 'explanation' : 'hint'));
      }
    });

    // ---- L4 hint ----
    if (sq.hint != null && String(sq.hint).trim() !== '') l4Bad.push(p.kp + '/' + p.qt + ' hint=「' + String(sq.hint).slice(0, 40) + '」');

    // ---- 自判回放（RenderFormat → answerSpec → gradeUserAnswer）----
    var view = RenderFormat.toRenderableQuestion(sq);
    var spec = view && view.answerSpec;
    if (!view || !spec || spec.value == null || String(spec.value) === '') {
      fails.push(p.kp + '/' + p.qt + ' answerSpec 缺失/空值');
    } else {
      var raw = String(spec.value);
      var grade = AV.gradeUserAnswer(raw, spec, { questionType: view.questionType, prompt: view.q });
      if (grade === true) replay.TRUE++;
      else if (grade === false) { replay.FALSE++; replayFalseRows.push(p.kp + '/' + p.qt + ' value=「' + String(spec.value).slice(0, 24) + '」'); }
      else {
        replay.NULL++;
        if (qt !== 'apply' && qt !== 'geometry') replayNullBad.push(p.kp + '/' + p.qt + ' value=「' + String(spec.value).slice(0, 24) + '」');
      }
    }

    if (i % 200 === 0) process.stdout.write('\r  泄露扫描进度 ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  泄露扫描进度 ' + pairs.length + '/' + pairs.length + '          \n');

  // ---- 汇总 ----
  var ok = true;
  console.log('L1 题面扫描：命中 ' + l1Hits + '（白名单 ' + l1Wl + ' / 未登记 ' + l1Bad.length + '）');
  l1Bad.slice(0, 200).forEach(function (l) { console.log('  L1-FAIL ' + l); });
  if (l1Bad.length) { ok = false; if (l1Bad.length > 200) console.log('  … 其余 ' + (l1Bad.length - 200) + ' 条略'); }
  console.log('L2 图形扫描：渲染 ' + l2Scanned + '（SUCCESS ' + (l2Status.SUCCESS || 0) + ' / UNSUPPORTED ' + (l2Status.UNSUPPORTED || 0) + ' / FAILED ' + (l2Status.FAILED || 0) + '），text 命中 ' + l2Hits + '，未登记 ' + l2Bad.length);
  l2Bad.slice(0, 40).forEach(function (l) { console.log('  L2-FAIL ' + l); });
  if (l2Bad.length) ok = false;
  console.log('L3 结构断言：html-renderer 零读取 explanation → ' + (l3aOk ? 'PASS' : 'FAIL') + '；内部 key 入题面/选项/hint/explanation → ' + (l3bBad.length === 0 ? '0 PASS' : l3bBad.length + ' FAIL'));
  if (!l3aOk) ok = false;
  l3bBad.forEach(function (l) { console.log('  L3b-FAIL ' + l); });
  if (l3bBad.length) ok = false;
  console.log('L4 hint 清点：非空 ' + l4Bad.length + (l4Bad.length === 0 ? ' PASS' : ''));
  l4Bad.slice(0, 20).forEach(function (l) { console.log('  L4-FAIL ' + l); });
  if (l4Bad.length) ok = false;
  console.log('自判回放：TRUE ' + replay.TRUE + ' / FALSE ' + replay.FALSE + ' / NULL ' + replay.NULL + '（null 仅限 apply/geometry）');
  replayFalseRows.slice(0, 20).forEach(function (l) { console.log('  REPLAY-FAIL(标准答案判 false) ' + l); });
  replayNullBad.forEach(function (l) { console.log('  REPLAY-FAIL(null 越界题型) ' + l); });
  if (replay.FALSE > 0 || replayNullBad.length) ok = false;
  fails.forEach(function (l) { console.log('  GEN-FAIL ' + l); });
  if (fails.length) ok = false;

  console.log(ok ? 'P32-AS-18 答案防泄露门禁：PASS' : 'P32-AS-18 答案防泄露门禁：FAIL（未登记泄露 = 新泄露或口径漂移，裁决后更新 WHITELIST 注册表）');
  process.exit(ok ? 0 : 1);
})().catch(function (e) {
  console.error('门禁执行异常：' + String((e && e.stack) || e));
  process.exit(1);
});
