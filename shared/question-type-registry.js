/**
 * shared/question-type-registry.js — 全局唯一题型注册表 (M2-01 / M2-02 / M2-03)
 *
 * 标准题型 ID 全部来自项目既有数据（M1 已归一化的 canonical 题型 + 显见几何类）：
 *   oral / calc / fill / choice / judge / apply / open / geometry
 * 禁止凭想象新增；legacy 细粒度 type/subtype 经 legacyTypeMap 归一到标准 ID。
 *
 * 归并策略（确定性、可审计）：
 *   1) 精确匹配标准 ID
 *   2) 显式 canonical 别名（operate->oral 等）
 *   3) 关键字启发式：几何关键字 -> geometry；认读关键字 -> recognize；其余 -> calc
 * 启发式归并结果在 verifier 中以 WARNING 暴露，不静默伪造。
 *
 * 纯数据 + 纯函数；不依赖 DOM / 插件 / 生成器。
 */
(function (global) {
  'use strict';

  var COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  var TYPES = [
    { id: 'oral', name: '口算', category: 'calculation',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'calc', name: '计算', category: 'calculation',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'fill', name: '填空', category: 'written',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'choice', name: '选择', category: 'selection',
      cognitiveLevels: ['recognize', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: true } },
    { id: 'judge', name: '判断', category: 'selection',
      cognitiveLevels: ['recognize', 'understand'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'apply', name: '应用', category: 'application',
      cognitiveLevels: ['understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'open', name: '开放', category: 'open',
      cognitiveLevels: ['apply', 'analyze', 'create'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'geometry', name: '几何', category: 'geometry',
      cognitiveLevels: ['recognize', 'understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: false, graphic: true, distractors: false } },
    { id: 'recognize', name: '认读', category: 'recognition',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: false, graphic: true, distractors: false } }
  ];

  // 显式 canonical 别名（legacy type/subtype/format -> 标准 questionType）
  var CANONICAL_ALIASES = {
    operate: 'oral', oral: 'oral', 'law-oral': 'oral', 'dec-mul-oral': 'oral', 'dec-div-oral': 'oral',
    'frac-addsub-oral': 'oral', 'equation-oral': 'oral', 'mul-oral': 'oral',
    calc: 'calc', cushi: 'calc', addsub: 'calc', mixed: 'calc', mix: 'calc', column: 'calc',
    'chain-add': 'calc', 'chain-sub': 'calc', 'chain': 'calc', bracket: 'calc', 'multdiv': 'calc',
    add: 'calc', sub: 'calc', mult: 'calc', div: 'calc', remainder: 'calc',
    'mul-table': 'calc', 'div-table': 'calc', multiTable: 'calc', 'big-addsub': 'calc',
    'mul3x1': 'calc', 'mul2tens': 'calc', 'div-tens': 'calc', 'mul3x2': 'calc', 'mul-zero': 'calc',
    'div-2digit': 'calc', 'div-2quotient': 'calc', 'dec-vertical': 'calc', 'add-law': 'calc',
    'mul-law': 'calc', 'dist-law': 'calc', 'dec-simple': 'calc', 'dec-addsub': 'calc',
    'big-num': 'calc', dec: 'calc', vertical: 'calc', 'vertical-multi': 'calc', 'carry-complex': 'calc',
    'neg-add-sub': 'calc', 'dec-mult': 'calc', 'dec-div': 'calc', decimal: 'calc', negative: 'calc',
    'est-muldiv': 'calc', estimate: 'calc', rounding: 'calc', 'dec-meaning': 'calc', 'dec-place': 'calc',
    'dec-compare': 'calc', 'dec-mixed': 'calc', 'frac-mixed': 'calc', 'frac-simple': 'calc',
    'frac-line': 'calc', 'int-split': 'calc', 'frac-split': 'calc', 'frac-perc': 'calc',
    fill: 'fill', 'fill-length': 'fill', 'fill-mass': 'fill', 'fill-time': 'fill', cutfill: 'fill',
    choice: 'choice', matching: 'choice', 'match-shape': 'choice', 'match-clock': 'choice', 'match-rmb': 'choice',
    judge: 'judge', comparison: 'judge',
    apply: 'apply', word: 'apply', open: 'apply', 'big-app': 'apply', 'mul-travel': 'apply',
    'word-problem': 'apply', 'word-problems': 'apply',
    'div-share': 'apply', 'price-qty': 'apply', 'dec-pay': 'apply', 'avg-score': 'apply', 'dec-scene': 'apply',
    'dec-mul-app': 'apply', 'dec-div-app': 'apply', 'equation-app': 'apply', 'factor-app': 'apply',
    'frac-app': 'apply', 'area-app': 'apply', 'solid-app': 'apply', 'possibility-app': 'apply',
    'linechart-app': 'apply', 'tree-app': 'apply', 'speed-distance': 'apply', work: 'apply',
    concentration: 'apply', 'profit-loss': 'apply', age: 'apply', planting: 'apply', phalanx: 'apply',
    grass: 'apply', economics: 'apply', 'percent-discount': 'apply', ratio: 'apply', proportion: 'apply',
    percent: 'apply', optimize: 'apply', optimization: 'apply', 'journey-complex': 'apply', 'travel-work': 'apply',
    'sum-diff': 'apply', 'inclusion-exclusion': 'apply', equation: 'apply', fraction: 'apply', area: 'apply',
    rotation: 'apply', array: 'apply', magic: 'apply', sequence: 'apply', series: 'apply', recurring: 'apply',
    'chicken-rabbit': 'apply', pancake: 'apply', assume: 'apply', law: 'apply', quotient: 'apply', stats: 'apply',
    'big-compare': 'apply', horizontal: 'apply', symbol: 'apply', 'divisibility': 'apply', 'prime-factor': 'apply',
    'factor-count': 'apply', 'gcd-lcm': 'apply', 'perfect-square': 'apply', 'nt-extreme': 'apply',
    'add-principle': 'apply', 'mult-principle': 'apply', permutation: 'apply', enumeration: 'apply',
    bundling: 'apply', insertion: 'apply', 'stars-bars': 'apply', pigeonhole: 'apply', 'worst-case': 'apply',
    'area-basic': 'apply', 'equal-area': 'apply', 'bird-head': 'apply', 'butterfly': 'apply', 'swallow-tail': 'apply',
    half: 'apply', 'painted-cube': 'apply', pythagorean: 'apply', lattice: 'apply', boat: 'apply', circular: 'apply',
    'avg-speed': 'apply', 'ratio-prop': 'apply', 'ratio-simp': 'apply', 'frac-percent': 'apply', 'cy-cone': 'apply',
    'cyl-cone': 'apply', 'number-shape': 'apply', 'percent-ratio': 'apply', 'magic-adv': 'apply', 'array-adv': 'apply',
    competition: 'apply', modulo: 'apply', recursion: 'apply', derangement: 'apply', periodic: 'apply',
    'sequence-sum': 'apply', extremum: 'apply', winning: 'apply', 'define-op': 'apply', 'complex-frac': 'apply',
    diophantine: 'apply', eq1: 'apply', eq2: 'apply', 'frac-mult-int': 'apply', 'frac-mult-frac': 'apply',
    'frac-div-int': 'apply', 'frac-div-frac': 'apply', 'dec-perc': 'apply', 'frac-mult-div': 'apply',
    'solve-proportion': 'apply', 'frac-order': 'apply', 'solve-equation': 'apply', 'cylinder-cone': 'apply',
    formula: 'apply', chart: 'apply', 'rotate-scale': 'apply', 'frac-mult': 'apply', 'frac-div': 'apply', scale: 'apply',
    'dec-div-int': 'apply', 'dec-div-dec': 'apply', 'repeating-dec': 'apply', 'product-rule': 'apply',
    'repeating-note': 'apply', 'equation-prop': 'apply', 'prime-composite': 'apply', 'frac-meaning': 'apply',
    'frac-property': 'apply', 'frac-decimal': 'apply', coordinate: 'apply', 'area-formula': 'apply',
    'solid-formula': 'apply', 'rotation-elem': 'apply', possibility: 'apply', 'linechart-feature': 'apply',
    'solid-feature': 'apply', 'possibility-desc': 'apply', 'equation-solve': 'apply', 'rotation-draw': 'apply',
    'observe-3d': 'apply', 'polygon-height': 'apply', 'coordinate-plot': 'apply', 'solid-net': 'apply',
    'balance-equation': 'apply', 'area-picture': 'apply', 'tree-planting': 'apply', 'possibility-compare': 'apply',
    'linechart-single': 'apply', 'linechart-double': 'apply', 'tree-three': 'apply', defective: 'apply',
    'defective-scale': 'apply', 'dec-mul-vertical': 'apply',
    geometry: 'geometry', circle: 'geometry', angle: 'geometry', clock: 'geometry', 'clock-read': 'geometry',
    'clock-draw': 'geometry', clockFace: 'geometry', shape: 'geometry', 'draw-shape': 'geometry', symmetry: 'geometry',
    translate: 'geometry', perimeter: 'geometry', rect: 'geometry', compass: 'geometry', 'line-ray': 'geometry',
    'angle-metric': 'geometry', quad: 'geometry', 'op-meaning': 'geometry', 'quotient-law': 'geometry',
    triangle: 'geometry', average: 'geometry', 'angle-degree': 'geometry', 'shape-feature': 'geometry',
    'law-formula': 'geometry', 'dec-frac': 'geometry', protractor: 'geometry', 'parallel-perp': 'geometry',
    'grid-quad': 'geometry', observe: 'geometry', 'segment-multiple': 'geometry', 'brace-addsub': 'geometry',
    'area-hectare': 'geometry', hectare: 'geometry', solid: 'geometry', flat: 'geometry', 'count-graph': 'geometry',
    position: 'geometry', grid: 'geometry', 'draw-line': 'geometry', 'draw-angle': 'geometry', measure: 'geometry',
    motion: 'geometry', transform: 'geometry', basic: 'geometry', meet: 'geometry', chase: 'geometry', train: 'geometry',
    river: 'geometry', extreme: 'geometry', drawer: 'geometry', integrated: 'geometry', misc: 'geometry', mock: 'geometry',
    'geometry-count': 'geometry', 'circle-angle': 'geometry', 'solid-rotation': 'geometry', 'interval-departure': 'geometry',
    'pick-up': 'geometry', mixture: 'geometry', all: 'geometry', 'factor-multiple': 'geometry',
    read: 'recognize', number: 'recognize', count: 'recognize', tally: 'recognize', enum: 'recognize',
    classify: 'recognize', table: 'recognize', picto: 'recognize', set: 'recognize', place: 'recognize',
    am: 'recognize', perm: 'recognize', pa: 'recognize', digit: 'recognize', composite: 'recognize', shard: 'recognize',
    ym: 'recognize', relation: 'recognize', operator: 'recognize', readwrite: 'recognize', approx: 'recognize',
    length: 'recognize', mass: 'recognize', time: 'recognize', pattern: 'recognize', 'mult-meaning': 'recognize',
    'div-meaning': 'recognize', unit: 'recognize', convert: 'recognize', order: 'recognize', compare: 'recognize',
    'big-compare': 'recognize', parity: 'recognize', divisible: 'recognize', prime: 'recognize', factor: 'recognize',
    'digit-reason': 'recognize'
  };

  var GEOMETRY_KEYWORDS = [
    'angle', 'shape', 'clock', 'circle', 'symmetry', 'coordinate', 'draw', 'grid', 'line', 'ray',
    'perimeter', 'area', 'solid', 'rotate', 'rotation', 'translate', 'scale', 'cylinder', 'cone',
    'triangle', 'quad', 'parallel', 'perpendicular', 'protractor', 'compass', 'segment', 'polygon',
    'lattice', 'pythagorean', 'geometry', 'observe-3d', 'solid-net', 'solid-feature', 'rotation-elem',
    'rotation-draw', 'polygon-height', 'coordinate-plot', 'geomcount', 'geometry-count', 'grid-quad',
    'circle-angle', 'solid-rotation', 'angle-degree', 'angle-metric', 'shape-feature', 'line-ray',
    'draw-line', 'draw-angle', 'draw-shape', 'motion', 'transform', 'count-graph', 'measure'
  ];

  var RECOGNIZE_KEYWORDS = [
    'read', 'number', 'count', 'tally', 'enum', 'classify', 'table', 'picto', 'set', 'place',
    'digit', 'composite', 'shard', 'ym', 'relation', 'operator', 'readwrite', 'approx', 'length',
    'mass', 'time', 'pattern', 'meaning', 'unit', 'convert', 'order', 'compare', 'parity',
    'divisible', 'prime', 'factor', 'recognize', 'recall'
  ];

  var BY_ID = {};
  TYPES.forEach(function (t) { BY_ID[t.id] = t; });

  // 历史细粒度 qt 值 → 展示名（R9 上收自 practice.html TYPE_PRETTY）。
  // canonical 题型展示名由 TYPES.name 提供；本表仅承载 canonical 之外的历史深链
  // （qt=addsub / pingshi / money 等）在 UI 标题/提示中的中文展示名。UI 不再持有展示表。
  var LEGACY_DISPLAY_NAMES = {
    addsub: '加减法', muldiv: '乘除法', cushi: '凑十法', pingshi: '平十法', poshi: '破十法',
    mix: '混合', pattern: '找规律', clock: '钟表', money: '人民币'
  };

  function isCognitiveLevel(v) { return COGNITIVE_LEVELS.indexOf(v) !== -1; }

  function normalizeQuestionType(token, opts) {
    opts = opts || {};
    if (!token || typeof token !== 'string') return { id: null, confidence: 'none' };
    if (BY_ID[token]) return { id: token, confidence: 'exact' };
    var mapped = CANONICAL_ALIASES[token];
    if (mapped) return { id: mapped, confidence: 'explicit' };
    var lower = token.toLowerCase();
    var i;
    for (i = 0; i < GEOMETRY_KEYWORDS.length; i++) {
      if (lower.indexOf(GEOMETRY_KEYWORDS[i]) !== -1) return { id: 'geometry', confidence: 'heuristic' };
    }
    for (i = 0; i < RECOGNIZE_KEYWORDS.length; i++) {
      if (lower.indexOf(RECOGNIZE_KEYWORDS[i]) !== -1) return { id: 'recognize', confidence: 'heuristic' };
    }
    if (opts.allowHeuristic !== false) return { id: 'calc', confidence: 'heuristic' };
    return { id: null, confidence: 'unmapped' };
  }

  function validateType(t) {
    var errs = [];
    if (!t || !t.id) errs.push('题型缺少 id');
    if (!t.name) errs.push('题型缺少 name');
    if (!t.category) errs.push('题型缺少 category');
    if (!Array.isArray(t.cognitiveLevels) || t.cognitiveLevels.length === 0) errs.push('cognitiveLevels 非法');
    else t.cognitiveLevels.forEach(function (c) { if (!isCognitiveLevel(c)) errs.push('非法 cognitiveLevel: ' + c); });
    if (!Array.isArray(t.difficultyRange) || t.difficultyRange.length !== 2) errs.push('difficultyRange 非法');
    else {
      var lo = t.difficultyRange[0], hi = t.difficultyRange[1];
      if (typeof lo !== 'number' || typeof hi !== 'number' || lo < 1 || hi > 6 || lo > hi) errs.push('difficultyRange 越界: ' + lo + '-' + hi);
    }
    if (!t.supports || typeof t.supports !== 'object') errs.push('supports 非法');
    else {
      ['context', 'graphic', 'distractors'].forEach(function (k) {
        if (typeof t.supports[k] !== 'boolean') errs.push('supports.' + k + ' 必须为布尔');
      });
    }
    return errs;
  }

  // 题型展示名：canonical 题型 → TYPES.name；历史细粒度 qt → LEGACY_DISPLAY_NAMES；未知 → null。
  function displayName(value) {
    if (!value || typeof value !== 'string') return null;
    var t = BY_ID[value];
    if (t) return t.name;
    return LEGACY_DISPLAY_NAMES[value] || null;
  }

  var validationErrors = [];
  var seen = {};
  TYPES.forEach(function (t) {
    if (seen[t.id]) validationErrors.push('重复题型 ID: ' + t.id);
    seen[t.id] = 1;
    validateType(t).forEach(function (e) { validationErrors.push(t.id + ' :: ' + e); });
  });

  var API = {
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    TYPES: TYPES,
    canonicalAliases: CANONICAL_ALIASES,
    LEGACY_DISPLAY_NAMES: LEGACY_DISPLAY_NAMES,
    get: function (id) { return BY_ID[id] || null; },
    has: function (id) { return !!BY_ID[id]; },
    all: function () { return TYPES.slice(); },
    displayName: displayName,
    byCategory: function (category) { return TYPES.filter(function (t) { return t.category === category; }); },
    supports: function (id, capability) {
      var t = BY_ID[id];
      if (!t) return false;
      return !!(t.supports && t.supports[capability]);
    },
    normalizeQuestionType: normalizeQuestionType,
    validate: function (id) {
      var t = BY_ID[id];
      if (!t) return { valid: false, errors: ['未知题型 ID: ' + id] };
      return { valid: validationErrors.length === 0, errors: validateType(t) };
    },
    validationErrors: validationErrors
  };

  global.QuestionTypeRegistry = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
