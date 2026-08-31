/**
 * shared/generator/core/kp-arithmetic-semantics.js — M4-R17 KP 级算术语义解析
 *
 * 将 Canonical KnowledgePoint 的 legacy 语义（source.legacyType）解析为可供
 * native 算术生成器与 legacy Adapter 共同消费的约束：
 *
 *   { operators: ['+','−']  | ['+'] | ['−'] | ['×'] | ['÷'],  steps: 1 }
 *
 * 作用：
 *   ① plan.constraints 注入 operation（算符集）与 exactSteps（精确步数），
 *     使 native arithmetic 生成器按 KP 语义固定算符/步数（不再按难度乱生成多步链）
 *   ② legacy Adapter 据此映射 operators，使对照公平（同一语义驱动）
 *
 * 仅解析「单步、单/双算符、纯算术」类 legacyType（addsub/add/sub/mult/div），
 * 其余（remainder/mixed/relation/multi1/twodigit/div1/fraction/decimal）返回 null，
 * 记为「不可用纯算术迁移」，由 BATCH 边界脚本决定保留 legacy 还是走专项模板生成器。
 */
'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

var SINGLE_STEP_PROFILE = {
  addsub: { operators: [OP_ADD, OP_SUB], steps: 1 },
  add: { operators: [OP_ADD], steps: 1 },
  sub: { operators: [OP_SUB], steps: 1 },
  mult: { operators: [OP_MUL], steps: 1 },
  div: { operators: [OP_DIV], steps: 1 }
};

var NON_MIGRATABLE = ['remainder', 'mixed', 'relation', 'multi1', 'twodigit', 'div1', 'fraction', 'decimal', 'g3', 'md'];

/**
 * 解析 KP 算术语义；无法由纯算术核心覆盖时返回 null。
 * @param {Object} kp Canonical KnowledgePoint
 * @param {Object} options { allowMultiStep: boolean } 默认 false（第一批仅单步）
 */
function resolveArithmeticSemantics(kp, options) {
  options = options || {};
  if (!kp || !kp.source) return null;
  var lt = kp.source.legacyType;

  if (NON_MIGRATABLE.indexOf(lt) !== -1) return null;

  var profile = SINGLE_STEP_PROFILE[lt];
  if (!profile) return null;

  var out = {
    operators: profile.operators.slice(),
    steps: profile.steps,
    legacyType: lt,
    migratable: true
  };
  return out;
}

/** 供对照/回归脚本用：给定 KP 判断是否可经算术语义迁移 */
function isArithmeticMigratable(kp) {
  return !!resolveArithmeticSemantics(kp);
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  SINGLE_STEP_PROFILE: SINGLE_STEP_PROFILE,
  NON_MIGRATABLE: NON_MIGRATABLE,
  resolveArithmeticSemantics: resolveArithmeticSemantics,
  isArithmeticMigratable: isArithmeticMigratable
};