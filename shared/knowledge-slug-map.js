// shared/knowledge-slug-map.js
/**
 * 知识点 slug 字典（{grade}-{slug} → 知识点 ID）
 *
 * 三年级内 refactor（V3.1.3）后，一年级数学 8 模块 / 46 知识点全部登记于此。
 * slug = 知识点 ID 去除 subject+grade+module 前缀后的语义片段；
 * 键格式 '{grade}-{slug}'，值 = shared/knowledge-math.js 中的完整知识点 ID。
 * 与 knowledge-math.js 保持一一对应；无重复键。
 */
(function(global) {
  const KNOWLEDGE_SLUGS = {
    '1-add-total': 'math-g1-m8-add-total',
    '1-addsub-10': 'math-g1-m1-addsub-10',
    '1-addsub-100': 'math-g1-m1-addsub-100',
    '1-addsub-5': 'math-g1-m1-addsub-5',
    '1-adjacent-number': 'math-g1-m4-adjacent-number',
    '1-brace-question': 'math-g1-m7-brace-question',
    '1-carry-add-20': 'math-g1-m1-carry-add-20',
    '1-classify': 'math-g1-m9-classify',
    '1-clock-approx': 'math-g1-m4-clock-approx',
    '1-clock-read': 'math-g1-m4-clock-read',
    '1-compare-less': 'math-g1-m8-compare-less',
    '1-compare-more': 'math-g1-m8-compare-more',
    '1-compare-number': 'math-g1-m4-compare-number',
    '1-compose-number': 'math-g1-m4-compose-number',
    '1-count-graph': 'math-g1-m6-count-graph',
    '1-digit-place': 'math-g1-m4-digit-place',
    '1-division-table': 'math-g1-m13-division-table',
    '1-draw-shape': 'math-g1-m6-draw-shape',
    '1-exclude-extra': 'math-g1-m8-exclude-extra',
    '1-fill-blank': 'math-g1-m13-fill-blank',
    '1-flat-shape': 'math-g1-m6-flat-shape',
    '1-make-ten': 'math-g1-m0-make-ten',
    '1-make-ten-ping': 'math-g1-m0-make-ten-ping',
    '1-make-ten-po': 'math-g1-m0-make-ten-po',
    '1-mixed-chain': 'math-g1-m1-mixed-chain',
    '1-multiplication-table': 'math-g1-m13-multiplication-table',
    '1-num-fill-unknown': 'math-g1-m4-num-fill-unknown',
    '1-number-chart': 'math-g1-m4-number-chart',
    '1-number-pattern': 'math-g1-m4-number-pattern',
    '1-pictograph': 'math-g1-m9-pictograph',
    '1-picture-add': 'math-g1-m7-picture-add',
    '1-picture-mixed': 'math-g1-m7-picture-mixed',
    '1-picture-sub': 'math-g1-m7-picture-sub',
    '1-position': 'math-g1-m6-position',
    '1-retreat-sub-20': 'math-g1-m1-retreat-sub-20',
    '1-rmb-calc': 'math-g1-m4-rmb-calc',
    '1-rmb-shopping': 'math-g1-m8-rmb-shopping',
    '1-rmb-unit': 'math-g1-m4-rmb-unit',
    '1-shape-combine': 'math-g1-m6-shape-combine',
    '1-solid-shape': 'math-g1-m6-solid-shape',
    '1-split-number': 'math-g1-m4-split-number',
    '1-stats-table': 'math-g1-m9-stats-table',
    '1-sub-part': 'math-g1-m8-sub-part',
    '1-sub-remain': 'math-g1-m8-sub-remain',
    '1-two-digit-add': 'math-g1-m1-two-digit-add',
    '1-two-step': 'math-g1-m8-two-step',
  };
  global.KNOWLEDGE_SLUGS = KNOWLEDGE_SLUGS;
  if (typeof module !== 'undefined') module.exports = KNOWLEDGE_SLUGS;
})(typeof window !== 'undefined' ? window : global);
