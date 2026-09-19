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
 * 仅解析「单步、单/双算符、纯算术」类 legacyType（addsub/add/sub/mult/div/remainder），
 * 其余（mixed/relation/multi1/twodigit/div1/fraction/decimal）返回 null，
 * 记为「不可用纯算术迁移」，由 BATCH 边界脚本决定保留 legacy 还是走专项模板生成器。
 * remainder（有余数除法）于 2025 落地：派发 div-remainder 专用结构，答案携带 "q……r"，
 * 覆盖 math-g2-m1-remainder-oral / math-g2-m2-remainder-col 两个 KP。
 */
'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

var SINGLE_STEP_PROFILE = {
  addsub: { operators: [OP_ADD, OP_SUB], steps: 1 },
  add: { operators: [OP_ADD], steps: 1 },
  sub: { operators: [OP_SUB], steps: 1 },
  mult: { operators: [OP_MUL], steps: 1 },
  div: { operators: [OP_DIV], steps: 1 },
  // 有余数除法：a ÷ b = q……r（0<r<b），由 buildDivRemainder 专用结构承载，
  // 答案为余数记号字符串，与 normalizeAns 的余数记号归一化配套。
  remainder: { operators: [OP_DIV], steps: 1, kind: 'div-remainder' }
};

// M4-R24 特殊口算族：legacy g4-oral 的整数域口算（除数是整十数/大数加减/三位乘一位/乘整十）。
// kind 供 native 生成器分派到对应的专用结构构造（镜像 legacy 粒度），不落入通用 generateStructure。
// M4-R25 扩展：g4/g5 口算的小数加减/小数乘除与运算律简便（见 docs/DEV_LOG.md 附录 C）。
var SPECIAL_ORAL_PROFILE = {
  'div-tens':   { operators: [OP_DIV], steps: 1, kind: 'div-tens' },
  'big-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'big-addsub' },
  'mul3x1':     { operators: [OP_MUL], steps: 1, kind: 'mul3x1' },
  'mul2tens':   { operators: [OP_MUL], steps: 1, kind: 'mul2tens' },
  'dec-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'dec-addsub' },
  'law-oral':   { operators: [OP_MUL], steps: 1, kind: 'law-oral' },
  'dec-mul-oral': { operators: [OP_MUL], steps: 1, kind: 'dec-mul-oral' },
  'dec-div-oral': { operators: [OP_DIV], steps: 1, kind: 'dec-div-oral' },
  // M4-R26 简便计算（多步凑整）族
  'add-law':    { operators: [OP_ADD], steps: 2, kind: 'add-law' },
  'mul-law':    { operators: [OP_MUL], steps: 2, kind: 'mul-law' },
  // M4-R27 六上小数/负数族：负数加减口算（操作数含负）、小数乘法笔算（含 <1 因数）
  'neg-add-sub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'neg-add-sub' },
  'dec-mult':   { operators: [OP_MUL], steps: 1, kind: 'dec-mult' }
};

var NON_MIGRATABLE = ['mixed', 'relation', 'multi1', 'twodigit', 'div1', 'fraction', 'decimal', 'g3', 'md'];

// P24-02：canonical KP 算术语义覆盖（按 canonical ID 精确指定算术语义 profile）。
// 这些 2025 人教版 KP 无 legacyType，但 KBL 教育属性（operations/families）明确，
// 且 arithmetic-core 已有对应专用结构构造器，按 ID 直接派发，不走 legacy 解析。
// 绑定以 knowledgePoints 引用形式声明（KBL 数据真值源仍为 kbl/canonical，此处不内嵌数据载荷）。
var CANONICAL_KP_OVERRIDES = [
  // 五上「小数乘小数」（operations=multiplication, families=decimal）：一位/两位小数因数乘法笔算
  { knowledgePoints: ['math-g5-up-u02-k002'], operators: [OP_MUL], steps: 1, kind: 'dec-mult' }
];

var CANONICAL_KP_PROFILE = {};
CANONICAL_KP_OVERRIDES.forEach(function (rec) {
  rec.knowledgePoints.forEach(function (kpId) { CANONICAL_KP_PROFILE[kpId] = rec; });
});

/**
 * 解析 KP 算术语义；无法由纯算术核心覆盖时返回 null。
 * @param {Object} kp Canonical KnowledgePoint
 * @param {Object} options { allowMultiStep: boolean } 默认 false（第一批仅单步）
 */
function resolveArithmeticSemantics(kp, options) {
  options = options || {};
  if (!kp || !kp.source) return null;

  // P24-02：canonical ID 精确覆盖优先于 legacyType 解析
  var kpId = kp.knowledgeId || kp.id || (kp.source && kp.source.knowledgeId);
  var canonical = kpId ? CANONICAL_KP_PROFILE[kpId] : null;
  if (canonical) {
    var cout = {
      operators: canonical.operators.slice(),
      steps: canonical.steps,
      canonicalKp: kpId,
      migratable: true
    };
    if (canonical.kind) cout.kind = canonical.kind;
    return cout;
  }

  var lt = kp.source.legacyType;

  if (NON_MIGRATABLE.indexOf(lt) !== -1) return null;

  var profile = SPECIAL_ORAL_PROFILE[lt] || SINGLE_STEP_PROFILE[lt];
  if (!profile) return null;

  var out = {
    operators: profile.operators.slice(),
    steps: profile.steps,
    legacyType: lt,
    migratable: true
  };
  if (profile.kind) out.kind = profile.kind;
  return out;
}

/** 供对照/回归脚本用：给定 KP 判断是否可经算术语义迁移 */
function isArithmeticMigratable(kp) {
  return !!resolveArithmeticSemantics(kp);
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  SINGLE_STEP_PROFILE: SINGLE_STEP_PROFILE,
  SPECIAL_ORAL_PROFILE: SPECIAL_ORAL_PROFILE,
  NON_MIGRATABLE: NON_MIGRATABLE,
  CANONICAL_KP_PROFILE: CANONICAL_KP_PROFILE,
  resolveArithmeticSemantics: resolveArithmeticSemantics,
  isArithmeticMigratable: isArithmeticMigratable
};