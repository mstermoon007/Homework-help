/**
 * shared/generator/core/variation-apply.js — FINAL-50 6 桶变式应用器
 *
 * 消费 plan.variation.{numeric|unknown-position|representation|context|operation|cognitive}
 * 在题目已生成（prompt/answer/data 已成型）后施加结构变式：
 *   numeric          → 算术 `a op b = ?` 数值再滚（sub-seed，与 generator baseline 不同）
 *   unknown-position → 算术 `a op b = ?` 转为 `? op b = c` / `a op ? = c`，answer 变为未知操作数
 *   representation   → prompt 前缀呈现提示（计数器/数轴/算式/图形）
 *   context          → prompt 包装情境句（购物/教室/分苹果）
 *   operation        → 算术逆运算（a+b=c → c-b=?），仅 KP 名含"关系/逆/加减/乘除"或 data.operation='mixed' 时启用
 *   cognitive        → hint 追加认知提示（说明思路/比较解法/解释为什么）
 *
 * FINAL-50 设计原则：
 *   - 同 KP：变式不改 knowledgePointId/questionType/difficulty（不漂移）
 *   - 真结构变：unknown-position/representation/context/operation/cognitive 改变 prompt/answer/data 结构（非纯数值互换）
 *   - baseline 不变：variation 缺失/全 false 时 no-op，freeze/edu/golden 默认无 learner → variation=undefined → 输出逐字节相等
 *   - 保守安全：operation 仅在 KP 语义允许逆运算时启用；桶不匹配 prompt 形状时 SKIP（非 DEAD）
 *   - 只 ADD data 装饰字段（variationRead/variationApplied/unknownPosition/representation/contextType/operationInverse/cognitiveHint/numericRoll），
 *     不改 data.operation/steps/mode/subType 等 kpSem derive 依赖字段 → kpSem PASS 端态不变
 *
 * 三态信号（probe 用）：
 *   variationRead[]   - 桶被读（plan.variation[bucket] truthy），无论是否产生结构变化
 *   variationApplied[] - 桶产生结构变化（fingerprint 改变）
 *   桶 in read 但 not in applied → SKIP（被读但不适用，如 concept prompt 不匹配算术形状）
 *   桶 not in read → DEAD（generator 不读 plan.variation）
 */
'use strict';

// 确定性子随机（从 q.seed 派生，解耦 rng 模块 API；同 seed 同输出，可重放）
function makeRng(seed) {
  var s = 0;
  var str = String(seed == null ? 'variation-default' : seed);
  for (var i = 0; i < str.length; i++) {
    s = ((s * 31) + str.charCodeAt(i)) & 0x7fffffff;
  }
  if (s === 0) s = 1;
  return {
    int: function (lo, hi) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return lo + (s % (hi - lo + 1));
    }
  };
}

// 深拷贝（题对象无函数，JSON 安全）
function clone(q) {
  return JSON.parse(JSON.stringify(q));
}

// 算术题形：`a op b = ?`（op ∈ + - − × ÷）
var ARITH_RE = /^(\d+)\s*([+\-−×÷])\s*(\d+)\s*=\s*\?$/;
var OP_RESULT = {
  '+': function (a, b) { return a + b; },
  '-': function (a, b) { return a - b; },
  '−': function (a, b) { return a - b; },
  '×': function (a, b) { return a * b; },
  '÷': function (a, b) { return b === 0 ? null : a / b; }
};
var OP_INVERSE = { '+': '−', '-': '+', '−': '+', '×': '÷', '÷': '×' };

function computeArith(a, opSym, b) {
  var fn = OP_RESULT[opSym];
  if (!fn) return null;
  var r = fn(a, b);
  if (r == null || r % 1 !== 0 || r < 0) return null;
  return r;
}

// ===== 各桶实现（返回 true=已施, false/null=SKIP） =====

function applyNumeric(q, rng) {
  if (!q.prompt) return false;
  var m = q.prompt.match(ARITH_RE);
  if (!m) return false;
  var a = parseInt(m[1], 10);
  var opSym = m[2];
  var b = parseInt(m[3], 10);
  var na = rng.int(1, 20);
  var nb = rng.int(1, 20);
  var result = computeArith(na, opSym, nb);
  if (result == null) return false;
  q.prompt = na + ' ' + opSym + ' ' + nb + ' = ?';
  q.answer = { value: String(result), acceptable: [], explanation: na + ' ' + opSym + ' ' + nb + ' = ' + result };
  q.data = q.data || {};
  q.data.numericRoll = { a: na, b: nb, result: result };
  return true;
}

function applyUnknownPosition(q, rng) {
  if (!q.prompt) return false;
  var m = q.prompt.match(ARITH_RE);
  if (!m) return false;
  var a = parseInt(m[1], 10);
  var opSym = m[2];
  var b = parseInt(m[3], 10);
  var result = computeArith(a, opSym, b);
  if (result == null) return false;
  var pos = rng.int(1, 2); // 1=求a, 2=求b
  var newPrompt, newAnswer;
  if (pos === 1) {
    newPrompt = '? ' + opSym + ' ' + b + ' = ' + result;
    newAnswer = String(a);
  } else {
    newPrompt = a + ' ' + opSym + ' ? = ' + result;
    newAnswer = String(b);
  }
  q.prompt = newPrompt;
  q.answer = { value: newAnswer, acceptable: [], explanation: newPrompt.replace('?', newAnswer) };
  q.data = q.data || {};
  q.data.unknownPosition = pos;
  return true;
}

var REPS = [
  { key: '计数器', cue: '（用计数器表示）' },
  { key: '数轴', cue: '（用数轴表示）' },
  { key: '算式', cue: '（用算式表示）' },
  { key: '图形', cue: '（用图形表示）' }
];
function applyRepresentation(q, rng) {
  if (!q.prompt) return false;
  var r = REPS[rng.int(0, REPS.length - 1)];
  q.prompt = r.cue + q.prompt;
  q.data = q.data || {};
  q.data.representation = r.key;
  return true;
}

var CTXS = [
  { key: '购物', tpl: function (p) { return '商店里，' + p; } },
  { key: '教室', tpl: function (p) { return '教室里，' + p; } },
  { key: '分苹果', tpl: function (p) { return '小朋友分苹果：' + p; } }
];
function applyContext(q, rng) {
  if (!q.prompt) return false;
  var c = CTXS[rng.int(0, CTXS.length - 1)];
  q.prompt = c.tpl(q.prompt);
  q.data = q.data || {};
  q.data.contextType = c.key;
  return true;
}

function applyOperation(q, plan, rng) {
  if (!q.prompt || !q.data) return false;
  var m = q.prompt.match(ARITH_RE);
  if (!m) return false;
  var a = parseInt(m[1], 10);
  var opSym = m[2];
  var b = parseInt(m[3], 10);
  var result = computeArith(a, opSym, b);
  if (result == null) return false;
  var kpName = plan && plan.semanticParams && plan.semanticParams.name;
  var allowInverse = (q.data.operation === 'mixed') ||
    (kpName && (kpName.indexOf('关系') !== -1 || kpName.indexOf('逆') !== -1 ||
      kpName.indexOf('加减') !== -1 || kpName.indexOf('乘除') !== -1));
  if (!allowInverse) return false; // SKIP：单运算 KP，禁逆
  var invSym = OP_INVERSE[opSym];
  if (!invSym) return false;
  q.prompt = result + ' ' + invSym + ' ' + b + ' = ?';
  q.answer = { value: String(a), acceptable: [], explanation: result + ' ' + invSym + ' ' + b + ' = ' + a };
  q.data.operationInverse = true;
  return true;
}

var COGS = [
  { key: '说明思路', cue: '（请说明你的思路）' },
  { key: '比较解法', cue: '（比较两种解法）' },
  { key: '解释为什么', cue: '（解释为什么）' }
];
function applyCognitive(q, rng) {
  if (!q.prompt) return false;
  var c = COGS[rng.int(0, COGS.length - 1)];
  q.prompt = q.prompt + ' ' + c.cue;
  q.hint = (q.hint || '') + (q.hint ? ' | ' : '') + c.key;
  q.data = q.data || {};
  q.data.cognitiveHint = c.key;
  return true;
}

// ===== 主入口 =====

var BUCKET_KEYS = ['numeric', 'unknown-position', 'representation', 'context', 'operation', 'cognitive'];

/**
 * 对单题施加 6 桶变式。
 * @param {Object} q          - 已生成的 SemanticQuestion（含 prompt/answer/data/seed）
 * @param {Object} variation  - 6 桶 object（{numeric,unknown-position,representation,context,operation,cognitive}）
 * @param {Object} plan        - QuestionPlan（用于 KP 名等只读上下文）
 * @returns {Object} 变式后的题（variation 缺失/全 false 时原样返回）
 */
function applyVariation(q, variation, plan) {
  if (!q || !variation || typeof variation !== 'object') return q;
  var anyOn = false;
  BUCKET_KEYS.forEach(function (k) { if (variation[k]) anyOn = true; });
  if (!anyOn) return q; // 全 false：返回原题（保 baseline 等价）

  var changed = clone(q);
  var rng = makeRng(q.seed || (plan && plan.seed) || 'variation-default');
  var applied = [];
  var read = [];

  if (variation['numeric']) {
    read.push('numeric');
    if (applyNumeric(changed, rng)) applied.push('numeric');
  }
  if (variation['unknown-position']) {
    read.push('unknown-position');
    if (applyUnknownPosition(changed, rng)) applied.push('unknown-position');
  }
  if (variation['representation']) {
    read.push('representation');
    if (applyRepresentation(changed, rng)) applied.push('representation');
  }
  if (variation['context']) {
    read.push('context');
    if (applyContext(changed, rng)) applied.push('context');
  }
  if (variation['operation']) {
    read.push('operation');
    if (applyOperation(changed, plan, rng)) applied.push('operation');
  }
  if (variation['cognitive']) {
    read.push('cognitive');
    if (applyCognitive(changed, rng)) applied.push('cognitive');
  }

  // 始终设置三态信号（即使 applied 为空，read 也记录——probe 区分 DEAD vs SKIP）
  changed.data = changed.data || {};
  changed.data.variationRead = read;
  changed.data.variationApplied = applied;
  return changed;
}

/**
 * 批量施加变式。variation 缺失/非 object 时原样返回（no-op）。
 * @param {Array} questions
 * @param {Object} plan
 * @returns {Array} 变式后的题数组
 */
function applyToAll(questions, plan) {
  if (!Array.isArray(questions)) return questions;
  var variation = plan && plan.variation;
  if (!variation || typeof variation !== 'object') return questions; // no-op（freeze/edu/golden 默认路径）
  return questions.map(function (q) { return applyVariation(q, variation, plan); });
}

var VariationApply = {
  applyVariation: applyVariation,
  applyToAll: applyToAll,
  makeRng: makeRng,
  BUCKET_KEYS: BUCKET_KEYS
};

module.exports = VariationApply;
if (typeof window !== 'undefined') window.VariationApply = VariationApply;
if (typeof global !== 'undefined') global.VariationApply = VariationApply;
