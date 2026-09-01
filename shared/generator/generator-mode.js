/**
 * shared/generator/generator-mode.js — M4-R14 Generator Feature Flag
 *
 * 新旧 Generator 双轨运行的开关，支持四级粒度覆盖（从最具体到最宽泛）：
 *
 *   generatorMode:
 *     "legacy"  —— 双轨中只跑旧插件（LegacyAdapter）
 *     "hybrid"  —— 双轨并行：旧插件与核心 Generator 都作为候选，按优先级选优
 *     "native"  —— 双轨中只跑核心 Generator（无匹配时回退旧插件）
 *
 * 覆盖粒度（更具体者优先）：
 *   ① 单插件      override('plugin', 'math-oral', 'native')
 *   ② 单知识点    override('knowledgePoint', 'math-g1-m1-addsub-5', 'native')
 *   ③ 单题型      override('questionType', 'calc', 'legacy')
 *   ④ 单科目      override('subject', 'math', 'hybrid')
 *   ⑤ 全局        setGlobal('hybrid')
 *
 * 解析：resolve(plan) → 有效模式（供 GeneratorSelector 决策）。
 * 该模块是纯配置层：不持执行逻辑、不加载插件。
 */
'use strict';

var MODES = ['legacy', 'hybrid', 'native'];
var SCOPES = ['plugin', 'knowledgePoint', 'questionType', 'subject'];

// 科目双命名归一：registry 用 chinese/english，knowledge-point 用 cn/en
var SUBJECT_ALIASES = { cn: 'chinese', chinese: 'chinese', en: 'english', english: 'english', math: 'math' };

function canonicalSubject(subject) {
  if (typeof subject !== 'string') return subject;
  return SUBJECT_ALIASES[subject] || subject;
}

var globalMode = 'hybrid';      // 默认双轨并行
var overrides = {               // scope → key → mode
  plugin: {},
  knowledgePoint: {
    // P4-R04: Hybrid KP 切换到 Native 模式（62 个 Hybrid KP，排除 judge 类）
    'math-g1-m1-addsub-10': 'native',
    'math-g1-m1-addsub-100': 'native',
    'math-g1-m1-addsub-5': 'native',
    'math-g1-m1-carry-add-20': 'native',
    'math-g1-m1-mixed-chain': 'native',
    'math-g1-m1-retreat-sub-20': 'native',
    'math-g1-m1-two-digit-add': 'native',
    'math-g1-m12-choice-mixed': 'native',
    'math-g1-m13-division-table': 'native',
    'math-g1-m13-fill-blank': 'native',
    
    'math-g1-m4-num-fill-unknown': 'native',
    'math-g1-m5-match-calc': 'native',
    'math-g1-m5-match-clock': 'native',
    'math-g1-m5-match-rmb': 'native',
    'math-g1-m5-match-shape': 'native',
    'math-g2-m1-addsub-1000': 'native',
    'math-g2-m1-div-table': 'native',
    'math-g2-m1-mixed-addsub': 'native',
    'math-g2-m1-mixed-multdiv': 'native',
    'math-g2-m1-muldiv-relation': 'native',
    'math-g2-m1-mult-table': 'native',
    'math-g2-m12-choice-mixed': 'native',
    'math-g2-m2-div-col': 'native',
    'math-g2-m2-mult-col': 'native',
    'math-g2-m3-chain-addsub': 'native',
    'math-g2-m3-fill-operator': 'native',
    'math-g2-m3-mixed-bracket': 'native',
    'math-g2-m3-mixed-no-bracket': 'native',
    'math-g2-m3-multdiv-mixed': 'native',
    'math-g2-m4-division-meaning': 'native',
    'math-g2-m4-fill-length': 'native',
    'math-g2-m4-fill-mass': 'native',
    'math-g2-m4-fill-time': 'native',
    'math-g2-m4-length-unit': 'native',
    'math-g2-m4-mass-unit': 'native',
    'math-g2-m4-multiplication-meaning': 'native',
    'math-g2-m4-time-unit': 'native',
    'math-g2-m5-match-multdiv': 'native',
    'math-g2-m7-pic-div': 'native',
    'math-g2-m7-pic-div-include': 'native',
    'math-g2-m7-pic-mult': 'native',
    'math-g2-m8-div-partitive': 'native',
    'math-g2-m8-div-quotative': 'native',
    'math-g2-m8-mult-total': 'native',
    'math-g3-m1-g3-div1': 'native',
    'math-g3-m1-g3-mul-multi1': 'native',
    'math-g3-m4-g3-measure': 'native',
    'math-g4-c2-c2-divisible': 'native',
    'math-g4-c4-c4-count': 'native',
    'math-g4-c4-c4-cutfill': 'native',
    'math-g4-c4-c4-pa': 'native',
    'math-g4-c4-c4-solid': 'native',
    'math-g4-m1-g4-oral-big': 'native',
    'math-g4-m1-g4-oral-dec': 'native',
    'math-g4-m1-g4-oral-divt': 'native',
    'math-g4-m1-g4-oral-law': 'native',
    'math-g4-m1-g4-oral-mul2t': 'native',
    'math-g4-m1-g4-oral-mul3x1': 'native',
    'math-g5-m1-g5-oral-decmul': 'native',
    'math-g5-m1-g5-oral-decdiv': 'native',
    'math-g4-m2-g4-v-div2': 'native',
    'math-g4-m2-g4-v-div2q': 'native',
    'math-g4-m8-g4-word-div': 'native',
    'math-g5-c2-divisibility': 'native',
    'math-g6-c1-vertical-multidigit': 'native',
    'math-g6-c2-divisibility': 'native',
    'math-g6-c3-multiplication-principle': 'native'
  },
  questionType: {},
  subject: {}
};

function isValidMode(mode) {
  return typeof mode === 'string' && MODES.indexOf(mode) !== -1;
}

function isValidScope(scope) {
  return typeof scope === 'string' && SCOPES.indexOf(scope) !== -1;
}

function setGlobal(mode) {
  if (!isValidMode(mode)) {
    throw new Error('GeneratorMode: 非法 generatorMode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  }
  globalMode = mode;
  return globalMode;
}

function getGlobal() {
  return globalMode;
}

/**
 * 设定单粒度覆盖。
 * @param {string} scope  plugin|knowledgePoint|questionType|subject
 * @param {string} key    pluginId / kpId / questionTypeId / subject（math|chinese|english）
 * @param {string} mode   legacy|hybrid|native
 */
function override(scope, key, mode) {
  if (!isValidScope(scope)) {
    throw new Error('GeneratorMode: 非法 scope="' + scope + '"（合法值: ' + SCOPES.join('/') + '）');
  }
  if (key == null || key === '') {
    throw new Error('GeneratorMode: ' + scope + ' 覆盖缺少 key');
  }
  if (!isValidMode(mode)) {
    throw new Error('GeneratorMode: 非法 mode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  }
  var mapKey = scope === 'subject' ? canonicalSubject(key) : String(key);
  overrides[scope][mapKey] = mode;
  return mode;
}

function clearOverride(scope, key) {
  if (!isValidScope(scope)) return;
  if (key == null) {
    overrides[scope] = {};
    return;
  }
  var mapKey = scope === 'subject' ? canonicalSubject(key) : String(key);
  delete overrides[scope][mapKey];
}

function clearAll() {
  globalMode = 'hybrid';
  SCOPES.forEach(function (s) { overrides[s] = {}; });
}

function dump() {
  var out = { generatorMode: globalMode };
  SCOPES.forEach(function (s) {
    out[s + 'Overrides'] = Object.assign({}, overrides[s]);
  });
  return out;
}

/**
 * 解析 plan 的有效 generatorMode（更具体覆盖优先）。
 *
 * plan 需要 knowledgePointId（→ 该 KP 的 legacyPluginId）、可选 questionTypeId 与 subject。
 * 链：plugin → knowledgePoint → questionType → subject → global。
 *
 * @returns {string} legacy|hybrid|native
 */
function resolve(plan) {
  plan = plan || {};
  var kp = null;
  var legacyPluginId = plan.legacyPluginId;

  if (plan.knowledgePointId) {
    try {
      var KnowledgePoint = require('../knowledge-point.js');
      kp = KnowledgePoint.get(plan.knowledgePointId);
      if (kp) {
        if (legacyPluginId == null) {
          legacyPluginId = kp.legacyPluginId || (kp.source && kp.source.pluginId) || null;
        }
        if (plan.subject == null) plan.subject = kp.subject;
      }
    } catch (e) { /* KP 缺失不影响模式解析 */ }
  }

  if (legacyPluginId && overrides.plugin[legacyPluginId]) return overrides.plugin[legacyPluginId];
  if (plan.knowledgePointId && overrides.knowledgePoint[plan.knowledgePointId]) return overrides.knowledgePoint[plan.knowledgePointId];
  if (plan.questionTypeId && overrides.questionType[plan.questionTypeId]) return overrides.questionType[plan.questionTypeId];
  if (plan.subject) {
    var subjectKey = canonicalSubject(plan.subject);
    if (overrides.subject[subjectKey]) return overrides.subject[subjectKey];
  }

  return globalMode;
}

module.exports = {
  MODES: MODES,
  SCOPES: SCOPES,
  setGlobal: setGlobal,
  getGlobal: getGlobal,
  override: override,
  clearOverride: clearOverride,
  clearAll: clearAll,
  dump: dump,
  resolve: resolve
};