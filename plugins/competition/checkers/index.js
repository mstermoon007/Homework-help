'use strict';
/* plugins/competition/checkers/index.js — 竞赛题独立 Checker 框架（统一入口）
 *
 * 设计原则（对应任务04）：
 *   Generator（生成题目与答案）
 *     ↓
 *   Question（题面，含 q/svg 文本）
 *     ↓
 *   Independent Checker（本框架：从题面反解出 expected）
 *     ↓
 *   check(question, answer) → { correct, expected, reason }
 *
 * 求解器契约：function (question) → { expected: [...] } 或 { problems: ['原因'] }
 *   - expected 必须由题面（q/svg 文本）独立推导，禁止读取 question.answer 作为解题依据；
 *     （对 question.answer 的「格式检查」（如分数是否约分）不属于解题依据，允许。）
 *   - 无法解析 / 无解 / 解不唯一 → 返回 problems。
 *
 * 统一检查接口（任务04验收用）：
 *   check(question, answer) → { correct: true/false, expected: xxx, reason: xxx }
 *
 * 注意：本目录是 CommonJS（与项目其余部分一致），文件放在 plugins/competition/checkers/
 * 但不被浏览器页面加载，仅由 dev 校验工具与压力测试消费。
 */

var R = require('./_registry.js');

/* 载入各竞赛模块的独立求解器（C1-C9） */
require('./c1.js');
require('./c2.js');
require('./c3.js');
require('./c4.js');
require('./c5.js');
require('./c6.js');
require('./c7.js');
require('./c8.js');
require('./c9.js');

module.exports = R;
