/**
 * shared/generator/generator-registry.js — M4-R03 Generator Registry
 *
 * 只读、纯数据的 Generator 注册表。仅保存声明：
 *   Generator ID / subject / capabilities / supported question types /
 *   supported knowledge points / version
 *
 * 禁止保存执行函数源码（运行时 Gate 校验：所有记录必须 JSON 可序列化）。
 *
 * 查询关系（KnowledgePoint → Capability → Generator）：
 *   forKnowledgePoint(kpId)     → 服务该 KP 的 Generator 列表
 *   forQuestionType(qtId)       → 具备该题型的 Generator 列表
 *   resolveChain(kpId)          → { kp, capabilityQuestionTypes, generators }
 */
'use strict';

// MATH-14：legacy 插件轨道已删除。注册表仅保留 native core Generator，
// 不再合并 generator-capability-registry 的 legacy 记录（无 fallback 宿主）。

// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
var CORE_RECORDS = [
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g2-m2-add-col', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec', 'math-g4-m3-g4-mix-addlaw', 'math-g6-m1-g6-oral-neg-add-sub'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g2-m2-sub-col', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g2-m1-mult-table', 'math-g2-m2-mult-col', 'math-g2-m4-multiplication-meaning', 'math-g2-m7-pic-mult', 'math-g2-m8-mult-total', 'math-g2-m5-match-multdiv', 'math-g3-m1-g3-mul-multi1', 'math-g4-m1-g4-oral-mul3x1', 'math-g4-m1-g4-oral-mul2t', 'math-g4-m1-g4-oral-law', 'math-g4-m3-g4-mix-mullaw', 'math-g5-m1-g5-oral-decmul', 'math-g6-m2-g6-calc-dec-mult'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m13-division-table', 'math-g2-m1-div-table', 'math-g2-m1-muldiv-relation', 'math-g2-m2-div-col', 'math-g2-m2-remainder-col', 'math-g2-m1-remainder-oral', 'math-g2-m4-division-meaning', 'math-g2-m7-pic-div', 'math-g2-m7-pic-div-include', 'math-g2-m8-div-partitive', 'math-g2-m8-div-quotative', 'math-g3-m1-g3-div1', 'math-g4-c2-c2-divisible', 'math-g4-m1-g4-oral-divt', 'math-g5-m1-g5-oral-decdiv', 'math-g4-m2-g4-v-div2', 'math-g4-m2-g4-v-div2q', 'math-g4-m8-g4-word-div'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['fill', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g1-m13-division-table', 'math-g1-m13-fill-blank', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-cutfill', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-solid', 'math-g4-c4-c4-count'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['choice', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m12-choice-mixed', 'math-g1-m5-match-calc', 'math-g1-m5-match-shape', 'math-g1-m5-match-rmb', 'math-g2-m12-choice-mixed'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['judge', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m0-make-ten-cushi', 'math-g1-m11-judge-mixed', 'math-g2-m11-judge-mixed'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill', 'oral'], questionTypes: ['calc', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m1-mixed-chain', 'math-g2-m1-mixed-addsub', 'math-g2-m1-mixed-multdiv', 'math-g2-m3-chain-addsub', 'math-g2-m3-multdiv-mixed', 'math-g2-m3-mixed-no-bracket', 'math-g2-m3-mixed-bracket', 'math-g1-m4-num-fill-unknown', 'math-g2-m3-fill-operator', 'math-g2-m2-chain-add-col', 'math-g2-m2-chain-sub-col', 'math-g2-m2-mixed-col'],
    scope: 'core', version: 1, supportsComposite: false },

  // P0-04 Step 15-20: 新增形状/位置/金钱/应用题 Generator
  { id: 'generator:shape-recognition', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    knowledgePoints: ['math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-count-graph', 'math-g1-m6-shape-combine', 'math-g1-m6-draw-shape', 'math-g1-m5-match-shape', 'math-g2-m5-match-shape', 'math-g2-m6-solid-shape', 'math-g2-m6-motion', 'math-g4-m5-g4-match-shape', 'math-g4-m6-g4-draw-sym', 'math-g4-m6-g4-draw-move', 'math-g4-c4-c4-count', 'math-g4-c4-c4-solid', 'math-g5-m4-g5-fill-solid', 'math-g5-m5-g5-match-areaf', 'math-g5-m5-g5-match-solid', 'math-g5-m6-g5-draw-rotate', 'math-g5-m6-g5-draw-sym', 'math-g5-m6-g5-draw-coord', 'math-g5-m8-g5-word-solid', 'math-g5-m11-g5-judge-solid', 'math-g5-m12-g5-choice-solid', 'math-g5-m12-motion', 'math-g5-c4-solid-geometry', 'math-g6-m5-g6-match-formula', 'math-g6-m6-g6-op-rotate-scale', 'math-g6-m6-g6-op-position', 'math-g6-m10-g6-reason-number-shape', 'math-g6-c4-area-basic', 'math-g6-c4-solid-geometry', 'math-g2-m4-angle-basic', 'math-g2-m5-match-angle', 'math-g2-m6-angle-recognize', 'math-g2-m6-grid-draw', 'math-g2-m6-draw-line', 'math-g2-m6-draw-angle', 'math-g2-m6-clock-draw', 'math-g2-m6-measure', 'math-g3-m6-g3-perimeter', 'math-g3-m6-g3-area', 'math-g3-m6-g3-position', 'math-g4-m4-g4-fill-line', 'math-g4-m4-g4-fill-angle', 'math-g4-m4-g4-fill-quad', 'math-g4-m4-g4-fill-tri', 'math-g4-m5-g4-match-angle', 'math-g4-m6-g4-draw-protractor', 'math-g4-m6-g4-draw-para', 'math-g4-m6-g4-draw-grid', 'math-g4-m6-g4-draw-view', 'math-g4-m11-g4-judge-angle', 'math-g4-m11-g4-judge-line', 'math-g4-m11-g4-judge-tri', 'math-g4-m12-g4-choice-angle', 'math-g4-m12-g4-choice-shape', 'math-g4-c3-c3-geomcount', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-angle', 'math-g4-c4-c4-transform', 'math-g5-c4-circle-sector', 'math-g5-c4-angle-calculation', 'math-g6-m4-g6-fill-circle', 'math-g6-m6-g6-op-circle', 'math-g6-m6-g6-op-symmetry', 'math-g6-m8-g6-app-circle', 'math-g6-m11-g6-judge-circle', 'math-g6-m12-g6-choice-circle', 'math-g6-c3-geometry-counting', 'math-g6-c4-circle-sector', 'math-g6-c4-angle-calculation', 'math-g6-c4-circle-angle', 'math-g6-c4-solid-rotation', 'math-g5-m4-g5-fill-coord', 'math-g5-m4-g5-fill-area', 'math-g5-m4-g5-fill-rotate', 'math-g5-m6-g5-draw-observe', 'math-g5-m6-g5-draw-height', 'math-g5-m6-g5-draw-net', 'math-g5-m7-g5-pic-area', 'math-g5-m8-g5-word-area', 'math-g5-m11-g5-judge-area', 'math-g5-m11-motion', 'math-g5-m12-g5-choice-area', 'math-g5-c4-area-basic', 'math-g5-c4-equal-area-transform', 'math-g5-c4-bird-head-model', 'math-g5-c4-butterfly-model', 'math-g5-c4-swallow-tail-model', 'math-g5-c4-half-model', 'math-g5-c4-painted-cube', 'math-g5-c4-pythagorean-theorem', 'math-g5-c4-lattice-area', 'math-g6-m4-g6-fill-cylinder-cone', 'math-g6-m8-g6-app-cyl-cone', 'math-g6-m11-g6-judge-cyl-cone', 'math-g6-m12-g6-choice-cyl-cone', 'math-g6-c4-equal-area-transform', 'math-g6-c4-bird-head-model', 'math-g6-c4-butterfly-model', 'math-g6-c4-swallow-tail-model', 'math-g6-c4-half-model', 'math-g6-c4-painted-cube', 'math-g6-c4-pythagorean-theorem', 'math-g6-c4-lattice-area'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:position-direction', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral'], questionTypes: ['choice', 'judge', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m6-position', 'math-g3-m6-g3-position', 'math-g5-m6-g5-draw-coord', 'math-g6-m6-g6-op-position'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:money-measurement', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'], questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    knowledgePoints: ['math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m5-match-rmb', 'math-g1-m8-rmb-shopping', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-pa'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:application-word', subject: 'math', capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'], questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    knowledgePoints: ['math-g1-m8-rmb-shopping', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-m8-g4-word-div', 'math-g5-m8-g5-word-solid', 'math-g6-c4-area-basic', 'math-g6-c4-solid-geometry', 'math-g6-m10-g6-reason-number-shape'],
    scope: 'core', version: 1, supportsComposite: false },

  // P0-07 Step 32: Composite Generator（仅三种模式，supportsComposite=true）
  { id: 'generator:counting', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g3-m10-g3-combination', 'math-g3-m10-g3-set', 'math-g4-c3-c3-enum', 'math-g4-c3-c3-am', 'math-g4-c3-c3-perm', 'math-g4-c3-c3-worst', 'math-g5-c3-addition-principle', 'math-g5-c3-multiplication-principle', 'math-g5-c3-permutation', 'math-g5-c3-combination', 'math-g5-c3-enumeration-counting', 'math-g5-c3-bundling-method', 'math-g5-c3-insertion-method', 'math-g5-c3-stars-bars', 'math-g5-c3-pigeonhole-principle', 'math-g5-c3-worst-case-principle', 'math-g6-c3-addition-principle', 'math-g6-c3-multiplication-principle', 'math-g6-c3-permutation', 'math-g6-c3-combination', 'math-g6-c3-enumeration-counting', 'math-g6-c3-bundling-method', 'math-g6-c3-insertion-method', 'math-g6-c3-stars-bars', 'math-g6-c3-pigeonhole-principle', 'math-g6-c3-worst-case-principle', 'math-g6-c3-inclusion-exclusion', 'math-g6-c3-recursion-counting', 'math-g6-c3-derangement'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:reasoning', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m10-logic-reasoning', 'math-g2-m10-sudoku3', 'math-g2-m10-combination', 'math-g2-m10-handshake', 'math-g4-m10-g4-reason-opt', 'math-g4-m10-g4-reason-cr', 'math-g4-m10-logic-reasoning', 'math-g4-c8-c8-extreme', 'math-g4-c8-c8-drawer', 'math-g4-c8-c8-logic', 'math-g5-m10-g5-reason-tree3', 'math-g5-m10-g5-reason-defect', 'math-g5-m10-logic-reasoning', 'math-g5-m10-g5-reason-seq', 'math-g5-c8-extremum-problem', 'math-g5-c8-logic-inference', 'math-g5-c8-winning-strategy', 'math-g6-m10-g6-reason-pigeonhole', 'math-g6-c8-extremum-problem', 'math-g6-c8-logic-inference', 'math-g6-c8-winning-strategy', 'math-g6-c8-optimization'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:stats', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m9-data-tally', 'math-g2-m9-data-question', 'math-g3-m9-g3-stats-table', 'math-g4-m9-g4-stats-bar', 'math-g4-m9-g4-stats-double', 'math-g4-m9-g4-stats-avg', 'math-g4-m11-stats', 'math-g5-m4-g5-fill-linechart', 'math-g5-m8-g5-word-linechart', 'math-g5-m9-g5-stats-possib', 'math-g5-m9-g5-stats-line1', 'math-g5-m9-g5-stats-line2', 'math-g5-m11-stats', 'math-g5-m12-stats', 'math-g6-m4-g6-fill-pie-chart', 'math-g6-m5-g6-match-chart', 'math-g6-m7-g6-pic-pie-chart', 'math-g6-m9-g6-stat-pie-chart', 'math-g6-m9-g6-stat-possibility', 'math-g6-m11-g6-judge-chart', 'math-g6-m12-g6-choice-chart'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:picture-equation', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m7-pic-mixed', 'math-g4-m7-g4-pic-segment', 'math-g4-m7-g4-pic-brace', 'math-g4-m7-g4-pic-speed', 'math-g4-m7-g4-pic-dec', 'math-g4-c1-c1-array', 'math-g4-c1-c1-magic', 'math-g5-m7-g5-pic-balance', 'math-g5-m7-g5-pic-segment', 'math-g5-m7-g5-pic-tree', 'math-g5-c1-number-array-closed', 'math-g5-c1-number-array-radial', 'math-g5-c1-number-array-composite', 'math-g5-c1-magic-square-3', 'math-g5-c1-magic-square-4', 'math-g6-m7-g6-pic-frac-line', 'math-g6-m7-g6-pic-scale', 'math-g6-c1-magic-square-adv', 'math-g6-c1-number-array'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c1-number-puzzle', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c1-c1-vertical', 'math-g4-c1-c1-horizontal', 'math-g4-c1-c1-symbol', 'math-g5-c1-digit-puzzle-vertical', 'math-g5-c1-digit-puzzle-horizontal', 'math-g5-c1-digit-puzzle-symbol', 'math-g6-c1-vertical-multidigit', 'math-g6-c1-vertical-carry-complex', 'math-g6-c1-horizontal-puzzle', 'math-g6-c1-symbol-number', 'math-g6-c1-digit-reasoning', 'math-g6-c1-number-puzzle-competition'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c2-number-theory', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c2-c2-parity', 'math-g4-c2-c2-remainder', 'math-g4-c2-c2-place', 'math-g5-c2-divisibility', 'math-g5-c2-parity-analysis', 'math-g5-c2-prime-factorization', 'math-g5-c2-factor-count-sum', 'math-g5-c2-gcd-lcm', 'math-g5-c2-remainder-congruence', 'math-g5-c2-place-value', 'math-g5-c2-perfect-square', 'math-g5-c2-number-theory-extreme', 'math-g6-c2-divisibility', 'math-g6-c2-parity-analysis', 'math-g6-c2-prime-factorization', 'math-g6-c2-factor-count-sum', 'math-g6-c2-gcd-lcm', 'math-g6-c2-remainder-congruence', 'math-g6-c2-place-value', 'math-g6-c2-perfect-square', 'math-g6-c2-number-theory-extreme', 'math-g6-c2-diophantine-equation', 'math-g6-c2-modulo-arithmetic'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c5-c6-journey-engineering', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c5-c5-basic', 'math-g4-c5-c5-meet', 'math-g4-c5-c5-chase', 'math-g4-c5-c5-train', 'math-g4-c5-c5-river', 'math-g5-c5-basic-motion', 'math-g5-c5-meet-problem', 'math-g5-c5-chase-problem', 'math-g5-c5-train-bridge', 'math-g5-c5-boat-stream', 'math-g5-c5-circular-track', 'math-g5-c5-average-speed', 'math-g5-c5-ratio-motion', 'math-g5-c6-work-problem', 'math-g5-c6-concentration-problem', 'math-g6-c5-basic', 'math-g6-c5-meet', 'math-g6-c5-chase', 'math-g6-c5-train-bridge', 'math-g6-c5-boat-stream', 'math-g6-c5-ring-runway', 'math-g6-c5-journey-complex', 'math-g6-c5-competition', 'math-g6-c5-interval-departure', 'math-g6-c5-pick-up-problem', 'math-g6-c6-work-problem', 'math-g6-c6-concentration-problem'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c7-clever-calc', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g5-c7-extract-common-factor', 'math-g5-c7-rounding-calc', 'math-g5-c7-fraction-splitting', 'math-g5-c7-integer-splitting', 'math-g5-c7-arithmetic-series', 'math-g5-c7-recurring-decimal-frac', 'math-g5-c7-define-operation', 'math-g5-c7-estimate-bounds', 'math-g5-c7-complex-fraction', 'math-g6-c7-extract-common-factor', 'math-g6-c7-rounding-calc', 'math-g6-c7-fraction-splitting', 'math-g6-c7-integer-splitting', 'math-g6-c7-arithmetic-series', 'math-g6-c7-recurring-decimal-frac', 'math-g6-c7-define-operation', 'math-g6-c7-estimate-bounds', 'math-g6-c7-complex-fraction', 'math-g6-c7-sequence-sum'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c9-comprehensive', subject: 'math', capabilities: ['apply', 'calc', 'open'], questionTypes: ['apply', 'calc', 'open'],
    knowledgePoints: ['math-g4-c9-c9-integrated', 'math-g4-c9-c9-misc', 'math-g4-c9-c9-mock', 'math-g5-c9-sum-diff-problem', 'math-g5-c9-age-problem', 'math-g5-c9-profit-loss-problem', 'math-g5-c9-chicken-rabbit', 'math-g5-c9-average-problem', 'math-g5-c9-planting-problem', 'math-g5-c9-phalanx-problem', 'math-g5-c9-periodic-problem', 'math-g5-c9-grass-problem', 'math-g5-c9-fraction-percent-application', 'math-g5-c9-economics-problem', 'math-g5-c9-inclusion-exclusion', 'math-g5-c9-equation-linear-1', 'math-g5-c9-equation-linear-2', 'math-g5-c9-diophantine-equation', 'math-g6-c9-sum-diff-problem', 'math-g6-c9-age-problem', 'math-g6-c9-profit-loss-problem', 'math-g6-c9-chicken-rabbit', 'math-g6-c9-average-problem', 'math-g6-c9-planting-problem', 'math-g6-c9-phalanx-problem', 'math-g6-c9-periodic-problem', 'math-g6-c9-grass-problem', 'math-g6-c9-fraction-percent-application', 'math-g6-c9-economics-problem', 'math-g6-c9-equation-linear-1', 'math-g6-c9-equation-linear-2', 'math-g6-c9-inclusion-exclusion', 'math-g6-c9-ratio-application', 'math-g6-c9-mixture-problem'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:composite', subject: 'math', capabilities: ['calc', 'judge', 'fill', 'apply', 'oral'], questionTypes: ['calc', 'judge', 'fill', 'apply', 'oral'],
    knowledgePoints: [
      'math-g1-m1-addsub-10', 'math-g1-m0-make-ten', 'math-g1-m0-make-ten-cushi', 'math-g1-m1-addsub-5', 'math-g1-m11-judge-mixed',
      'math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m5-match-rmb', 'math-g1-m8-rmb-shopping',
      'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-pa',
      'math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-shape-combine', 'math-g2-m6-solid-shape', 'math-g4-c4-c4-solid', 'math-g5-c4-solid-geometry', 'math-g6-c4-solid-geometry'
    ],
    scope: 'core', version: 1, supportsComposite: true },

  // V2.1 专项语义生成器（新教材补录 KP 的专用逻辑，native 绑定保证语义正确路由）
  { id: 'generator:code-recognition', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'recognize'], questionTypes: ['fill', 'choice', 'judge', 'recognize'],
    knowledgePoints: ['math-g3-m10-g3-code'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:equivalent-reasoning', subject: 'math', capabilities: ['fill', 'choice', 'apply'], questionTypes: ['fill', 'choice', 'apply'],
    knowledgePoints: ['math-g3-m8-g3-equivalent'],
    scope: 'core', version: 2, supportsComposite: false }
];

function buildRecords() {
  // MATH-14：legacy 轨道已删除，注册表仅含 native core Generator。
  // （历史上曾合并 generator-capability-registry 的 legacy 插件记录，已移除。）
  return CORE_RECORDS.slice();
}

var _records = null;
var _kpCache = null;      // M11-R02: kpId -> generators[]
var _qtCache = null;      // M11-R02: qtId -> generators[]

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function invalidateCaches() {
  _kpCache = null;
  _qtCache = null;
}

function get(id) {
  for (var i = 0; i < records().length; i++) {
    if (records()[i].id === id) return records()[i];
  }
  return null;
}

function all() {
  return records().slice();
}

function forKnowledgePoint(kpId) {
  if (!_kpCache) _kpCache = {};
  if (_kpCache[kpId]) return _kpCache[kpId];
  var result = records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
  return (_kpCache[kpId] = result);
}

function forQuestionType(qtId) {
  if (!_qtCache) _qtCache = {};
  if (_qtCache[qtId]) return _qtCache[qtId];
  var result = records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
  return (_qtCache[qtId] = result);
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require('../knowledge-point.js');
  var Resolver = require('../capability-resolver.js');
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var capabilityQuestionTypes = Resolver.getCapabilities(kp).questionTypes || [];
  return {
    knowledgePointId: kpId,
    capabilityQuestionTypes: capabilityQuestionTypes,
    generators: forKnowledgePoint(kpId).map(function (r) { return r.id; })
  };
}

/**
 * M4-R12 知识点绑定迁移：KnowledgePoint → Capabilities → Generator Registry。
 *
 * 在 Canonical KP 上注入：
 *   capabilities     —— 该 KP 能由哪些能力生成（Generator Registry 推导，覆盖类型级 capability）
 *   legacyPluginId   —— 迁移兼容字段（保留原 pluginId 引用，逐步淘汰）
 *
 * 不修改 KnowledgeBank / 插件；只读增强返回同一对象（浅注入）。
 */
function enhanceKp(kp) {
  if (!kp || typeof kp !== 'object' || !kp.id) return kp;

  var generators = forKnowledgePoint(kp.id);
  var capabilities = [];
  generators.forEach(function (g) {
    (g.capabilities || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
    // 核心 Generator 的语义能力（scope=core 无 KP 绑定，由题型/能力反查补充）
    (g.questionTypes || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
  });

  // 无 Generator 直接绑定该 KP 时，回退解析链（CapabilityResolver 的能力集）
  if (capabilities.length === 0) {
    var Resolver = require('../capability-resolver.js');
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  // MATH-14：legacy 轨道已删，不再注入 legacyPluginId。
  return kp;
}

module.exports = {
  records: records,
  get: get,
  all: all,
  forKnowledgePoint: forKnowledgePoint,
  forQuestionType: forQuestionType,
  forSubject: forSubject,
  resolveChain: resolveChain,
  enhanceKp: enhanceKp,
  invalidateCaches: invalidateCaches
};
