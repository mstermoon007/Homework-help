// scripts/build-migration-final.js
// 人工审查后的最终映射表生成器。
// 读取知识库与 slug 字典，应用：
//  1) 跨年级同主题 slug 归一化（SLUG_NORM）
//  2) 人工前置(prerequisiteSuggestion)/关联(relatedSuggestion)规则（RULES）
//  3) difficulty：M=1；C 模块按年级 3/4/5（同主题跨年级递增）
// 输出 migration-map-final.csv（迁移唯一依据），不修改任何源文件。
'use strict';

const fs = require('fs');
const path = require('path');

const KB = require('../shared/knowledge-bank.js');
const SLUGS = require('../shared/knowledge-slug-map.js');

// 跨年级同主题知识点 → 统一基础 slug（原 id 已在知识库中跨年级重复的 C 模块天然一致，无需处理）
const SLUG_NORM = {
  'compose-4': 'compose-digit',         // 数的组成与数位（g2 ≡ g1）
  'wp-solve': 'solve-problems',         // 解决问题（g2 ≡ g1）
  'g6-fill-unit-convert': 'unit-convert', // 单位换算（g6 ≡ g2）
  'g5-judge-rotate': 'motion',          // 图形的运动（g5 ≡ g2）
  'g5-choice-rotate': 'motion',
  'g4-reason-logic': 'logic-reasoning', // 逻辑推理（g4/g5 ≡ g2）
  'g5-reason-logic': 'logic-reasoning',
  'g4-judge-stats': 'stats',            // 统计（g4/g5 判断、选择同主题）
  'g5-judge-stats': 'stats',
  'g5-choice-stats': 'stats'
};

// 规则：key = "grade|oldId"，value = 引用数组。
// 引用写法：同年级用 oldId；跨年级用 "g<grade>.<oldId>"。
const PREREQ = {
  // ---------- 一年级 ----------
  '1|make-ten': [], '1|make-ten-ping': ['make-ten'], '1|make-ten-po': ['make-ten'],
  '1|addsub-20': ['count', 'compose-digit'],
  '1|count': [], '1|compose-digit': ['count'], '1|compare': ['count', 'compose-digit'],
  '1|clock-hour': ['count'], '1|patterns': ['count'], '1|money': ['count', 'addsub-20'],
  '1|solid-shapes': [], '1|flat-shapes': ['solid-shapes'], '1|shape-compose': ['flat-shapes'], '1|position': [],
  '1|picture-equations': ['addsub-20'],
  '1|chain-mixed': ['addsub-20'], '1|solve-problems': ['addsub-20'],
  '1|classify': [], '1|stats-table': ['classify'], '1|pictograph': ['classify', 'stats-table'],
  // ---------- 二年级 ----------
  '2|addsub-100': ['g1.addsub-20'], '2|muldiv': ['g1.addsub-20'], '2|remainder': ['muldiv'], '2|mixed': ['addsub-100', 'muldiv'],
  '2|readwrite': ['g1.compose-digit'], '2|compose-4': ['g1.compose-digit'], '2|approx': ['readwrite'],
  '2|unit-convert': ['g1.count'], '2|fill-unit': ['unit-convert'],
  '2|shapes-2': ['g1.flat-shapes'], '2|angles': ['shapes-2'], '2|motion': ['shapes-2'], '2|grid': ['shapes-2'],
  '2|wp-solve': ['g1.solve-problems', 'addsub-100'],
  '2|data-tally': ['g1.classify'], '2|data-question': ['data-tally'],
  '2|logic-reasoning': ['g1.patterns'], '2|sudoku3': ['logic-reasoning'],
  // ---------- 三年级 ----------
  '3|g3-add-sub-wan': ['g2.addsub-100'], '3|g3-mul-multi1': ['g2.muldiv'], '3|g3-div1': ['g2.muldiv', 'g2.remainder'],
  '3|g3-mul-2digit': ['g3-mul-multi1'],
  '3|g3-fraction': ['g2.muldiv', 'g2.remainder'], '3|g3-decimal': ['g2.addsub-100'],
  '3|g3-time': ['g1.clock-hour'], '3|g3-year-month': ['g3-time'], '3|g3-measure': ['g2.unit-convert'],
  '3|g3-perimeter': ['g2.shapes-2'], '3|g3-area': ['g3-perimeter'], '3|g3-position': ['g1.position'],
  '3|g3-times': ['g2.muldiv'],
  '3|g3-stats-table': ['g2.data-tally'],
  '3|g3-combination': ['g2.logic-reasoning'], '3|g3-set': ['g3-combination'],
  // ---------- 四年级 ----------
  '4|g4-oral-big': ['g3.g3-add-sub-wan'], '4|g4-oral-mul3x1': ['g3.g3-mul-multi1'], '4|g4-oral-mul2t': ['g3.g3-mul-2digit'],
  '4|g4-oral-divt': ['g3.g3-div1'], '4|g4-oral-dec': ['g3.g3-decimal'], '4|g4-oral-law': ['g3.g3-add-sub-wan'],
  '4|g4-v-mul3x2': ['g3.g3-mul-2digit'], '4|g4-v-mulzero': ['g4-v-mul3x2'], '4|g4-v-div2': ['g3.g3-div1'],
  '4|g4-v-div2q': ['g4-v-div2'], '4|g4-v-dec': ['g4-oral-dec'],
  '4|g4-mix-order': ['g2.mixed'], '4|g4-mix-addlaw': ['g4-mix-order'], '4|g4-mix-mullaw': ['g4-mix-order'],
  '4|g4-mix-dist': ['g4-mix-mullaw'], '4|g4-mix-dec': ['g4-oral-dec'],
  '4|g4-fill-bignum': ['g2.readwrite', 'g2.compose-4'], '4|g4-fill-hectare': ['g3.g3-area', 'g3.g3-measure'],
  '4|g4-fill-line': ['g2.shapes-2'], '4|g4-fill-angle': ['g2.angles'], '4|g4-fill-quad': ['g4-fill-line', 'g4-fill-angle'],
  '4|g4-fill-op': ['g2.mixed'], '4|g4-fill-quotient': ['g4-v-div2'], '4|g4-fill-dec': ['g3.g3-decimal'],
  '4|g4-fill-tri': ['g4-fill-line', 'g4-fill-angle'], '4|g4-fill-avg': ['g4-v-div2', 'g3.g3-stats-table'],
  '4|g4-match-read': ['g4-fill-bignum'], '4|g4-match-angle': ['g4-fill-angle'], '4|g4-match-shape': ['g4-fill-quad'],
  '4|g4-match-law': ['g4-mix-addlaw'], '4|g4-match-decfrac': ['g3.g3-fraction', 'g3.g3-decimal'],
  '4|g4-draw-protractor': ['g4-fill-angle'], '4|g4-draw-para': ['g4-fill-line'], '4|g4-draw-grid': ['g4-fill-quad'],
  '4|g4-draw-view': ['g2.shapes-2'], '4|g4-draw-sym': ['g2.motion'], '4|g4-draw-move': ['g2.motion'],
  '4|g4-pic-segment': ['g3.g3-times'], '4|g4-pic-brace': ['g1.picture-equations'], '4|g4-pic-speed': ['g4-oral-mul3x1'],
  '4|g4-pic-dec': ['g4-oral-dec'],
  '4|g4-word-big': ['g4-fill-bignum'], '4|g4-word-speed': ['g4-v-mul3x2'], '4|g4-word-div': ['g4-v-div2'],
  '4|g4-word-price': ['g4-v-mul3x2'], '4|g4-word-area': ['g4-fill-hectare'], '4|g4-word-opt': ['g4-word-div'],
  '4|g4-word-cr': ['g4-v-mul3x2'], '4|g4-word-dec': ['g4-v-dec'], '4|g4-word-avg': ['g4-fill-avg'],
  '4|g4-stats-bar': ['g3.g3-stats-table'], '4|g4-stats-double': ['g4-stats-bar'], '4|g4-stats-avg': ['g4-fill-avg'],
  '4|g4-reason-opt': ['g4-word-opt'], '4|g4-reason-cr': ['g4-word-cr'], '4|g4-reason-logic': ['g2.logic-reasoning'],
  '4|g4-judge-read': ['g4-fill-bignum'], '4|g4-judge-law': ['g4-mix-addlaw'], '4|g4-judge-angle': ['g4-fill-angle'],
  '4|g4-judge-line': ['g4-fill-line'], '4|g4-judge-quotient': ['g4-fill-quotient'], '4|g4-judge-dec': ['g4-fill-dec'],
  '4|g4-judge-tri': ['g4-fill-tri'], '4|g4-judge-stats': ['g4-stats-bar'],
  '4|g4-choice-big': ['g4-fill-bignum'], '4|g4-choice-est': ['g4-v-mul3x2'], '4|g4-choice-angle': ['g4-fill-angle'],
  '4|g4-choice-shape': ['g4-fill-quad'], '4|g4-choice-dec': ['g4-fill-dec'], '4|g4-choice-law': ['g4-mix-addlaw'],
  // 四年级竞赛（以本年级基础模块为前置）
  '4|c1-vertical': ['g4-v-mul3x2', 'g4-v-div2'], '4|c1-horizontal': ['g4-mix-order'], '4|c1-symbol': ['g4-fill-op'],
  '4|c1-array': ['g4-mix-addlaw'], '4|c1-magic': ['c1-array'],
  '4|c2-parity': ['g2.addsub-100'], '4|c2-divisible': ['g2.muldiv'], '4|c2-prime': ['g2.muldiv'],
  '4|c2-factor': ['g2.muldiv'], '4|c2-remainder': ['g3.g3-div1'], '4|c2-place': ['g2.readwrite'],
  '4|c3-enum': ['g2.logic-reasoning'], '4|c3-am': ['g3.g3-combination'], '4|c3-perm': ['c3-am'],
  '4|c3-geomcount': ['g2.shapes-2'], '4|c3-worst': ['c3-enum'],
  '4|c4-pa': ['g3.g3-area'], '4|c4-cutfill': ['c4-pa'], '4|c4-angle': ['g4-fill-angle'], '4|c4-count': ['g2.shapes-2'],
  '4|c4-transform': ['g2.motion'], '4|c4-solid': ['g2.shapes-2'],
  '4|c5-basic': ['g4-word-speed'], '4|c5-meet': ['c5-basic'], '4|c5-chase': ['c5-basic'], '4|c5-train': ['c5-basic'],
  '4|c5-river': ['c5-basic'],
  '4|c8-extreme': ['g4-reason-logic'], '4|c8-drawer': ['g4-reason-logic'], '4|c8-logic': ['g4-reason-logic'],
  '4|c9-integrated': [], '4|c9-misc': [], '4|c9-mock': [],
  // ---------- 五年级 ----------
  '5|g5-oral-decmul': ['g4.g4-oral-dec'], '5|g5-oral-decdiv': ['g4.g4-v-div2'], '5|g5-oral-fracadd': ['g3.g3-fraction'],
  '5|g5-oral-equ': ['g4.g4-fill-op'], '5|g5-oral-fm': ['g2.muldiv'],
  '5|g5-v-decmul': ['g4.g4-v-mul3x2'], '5|g5-v-divint': ['g4.g4-v-div2'], '5|g5-v-ddivdec': ['g5-v-divint'],
  '5|g5-v-repeating': ['g5-v-ddivdec'],
  '5|g5-mix-decmixed': ['g4.g4-mix-order'], '5|g5-mix-fracmixed': ['g5-oral-fracadd'],
  '5|g5-mix-decsimple': ['g4.g4-mix-addlaw'], '5|g5-mix-fracsimple': ['g5-mix-fracmixed'],
  '5|g5-fill-decloc': ['g4.g4-fill-dec'], '5|g5-fill-deccmp': ['g5-fill-decloc'], '5|g5-fill-prodrule': ['g4.g4-v-mul3x2'],
  '5|g5-fill-repeating': ['g5-v-repeating'], '5|g5-fill-equation': ['g4.g4-fill-op'], '5|g5-fill-fm': ['g2.muldiv'],
  '5|g5-fill-prime': ['g5-fill-fm'], '5|g5-fill-fracmean': ['g3.g3-fraction'], '5|g5-fill-fracprop': ['g5-fill-fracmean'],
  '5|g5-fill-fracdec': ['g5-fill-fracprop'], '5|g5-fill-coord': ['g2.grid'], '5|g5-fill-area': ['g3.g3-area'],
  '5|g5-fill-solid': ['g2.shapes-2'], '5|g5-fill-rotate': ['g2.motion'], '5|g5-fill-possible': ['g2.logic-reasoning'],
  '5|g5-fill-linechart': ['g4.g4-stats-bar'],
  '5|g5-match-areaf': ['g5-fill-area'], '5|g5-match-solid': ['g5-fill-solid'], '5|g5-match-possib': ['g5-fill-possible'],
  '5|g5-match-equ': ['g5-fill-equation'], '5|g5-match-fracdec': ['g5-fill-fracdec'],
  '5|g5-draw-rotate': ['g5-fill-rotate'], '5|g5-draw-observe': ['g4.g4-draw-view'], '5|g5-draw-height': ['g5-fill-area'],
  '5|g5-draw-sym': ['g4.g4-draw-sym'], '5|g5-draw-coord': ['g5-fill-coord'], '5|g5-draw-net': ['g5-fill-solid'],
  '5|g5-pic-balance': ['g5-fill-equation'], '5|g5-pic-area': ['g5-fill-area'], '5|g5-pic-segment': ['g4.g4-pic-segment'],
  '5|g5-pic-tree': ['g3.g3-times'],
  '5|g5-word-decmul': ['g5-v-decmul'], '5|g5-word-decdiv': ['g5-v-divint'], '5|g5-word-equ': ['g5-fill-equation'],
  '5|g5-word-fm': ['g5-fill-fm'], '5|g5-word-frac': ['g5-fill-fracmean'], '5|g5-word-area': ['g5-fill-area'],
  '5|g5-word-solid': ['g5-fill-solid'], '5|g5-word-possib': ['g5-fill-possible'], '5|g5-word-linechart': ['g5-fill-linechart'],
  '5|g5-word-tree': ['g5-pic-tree'], '5|g5-word-defect': ['g5-word-decdiv'],
  '5|g5-stats-possib': ['g5-fill-possible'], '5|g5-stats-line1': ['g5-fill-linechart'], '5|g5-stats-line2': ['g5-stats-line1'],
  '5|g5-reason-tree3': ['g5-word-tree'], '5|g5-reason-defect': ['g5-word-defect'], '5|g5-reason-logic': ['g4.g4-reason-logic'],
  '5|g5-reason-seq': ['g1.patterns'],
  '5|g5-judge-decmul': ['g5-v-decmul'], '5|g5-judge-equ': ['g5-fill-equation'], '5|g5-judge-fm': ['g5-fill-fm'],
  '5|g5-judge-frac': ['g5-fill-fracmean'], '5|g5-judge-area': ['g5-fill-area'], '5|g5-judge-solid': ['g5-fill-solid'],
  '5|g5-judge-rotate': ['g5-fill-rotate'], '5|g5-judge-possib': ['g5-fill-possible'], '5|g5-judge-stats': ['g5-fill-linechart'],
  '5|g5-choice-decmul': ['g5-v-decmul'], '5|g5-choice-equ': ['g5-fill-equation'], '5|g5-choice-fm': ['g5-fill-fm'],
  '5|g5-choice-frac': ['g5-fill-fracmean'], '5|g5-choice-area': ['g5-fill-area'], '5|g5-choice-solid': ['g5-fill-solid'],
  '5|g5-choice-rotate': ['g5-fill-rotate'], '5|g5-choice-possib': ['g5-fill-possible'], '5|g5-choice-stats': ['g5-fill-linechart'],
  // 五年级竞赛（同主题以上一/本年级基础为前置）
  '5|c1-vertical': ['g4.c1-vertical'], '5|c1-horizontal': ['g4.c1-horizontal'], '5|c1-symbol': ['g4.c1-symbol'],
  '5|c1-array': ['g4.c1-array'], '5|c1-magic': ['c1-array'],
  '5|c2-parity': ['g4.c2-parity'], '5|c2-divisible': ['g4.c2-divisible'], '5|c2-prime': ['g4.c2-prime'],
  '5|c2-factor': ['g4.c2-factor'], '5|c2-remainder': ['g4.c2-remainder'], '5|c2-place': ['g4.c2-place'],
  '5|c3-enum': ['g4.c3-enum'], '5|c3-am': ['g4.c3-am'], '5|c3-perm': ['c3-am'], '5|c3-geomcount': ['g4.c3-geomcount'],
  '5|c3-worst': ['c3-enum'],
  '5|c5-basic': ['g4.c5-basic'], '5|c5-meet': ['c5-basic'], '5|c5-chase': ['c5-basic'], '5|c5-train': ['c5-basic'],
  '5|c5-river': ['c5-basic'],
  '5|c4-pa': ['g4.c4-pa'], '5|c4-cutfill': ['c4-pa'], '5|c4-angle': ['g4.c4-angle'], '5|c4-count': ['g4.c4-count'],
  '5|c4-transform': ['g4.c4-transform'], '5|c4-solid': ['g4.c4-solid'],
  '5|c6-work': ['g5.g5-word-decdiv'], '5|c6-concentration': ['g5.g5-word-decdiv'],
  '5|c7-telescope': ['g5.g5-mix-fracsimple'], '5|c7-complex': ['g5.g5-mix-fracmixed'],
  '5|c7-clever': ['g5.g5-mix-fracsimple'], '5|c7-pattern': ['g5.g5-reason-seq'],
  '5|c8-extreme': ['g4.c8-extreme'], '5|c8-drawer': ['g4.c8-drawer'], '5|c8-logic': ['g4.c8-logic'],
  // ---------- 六年级 ----------
  '6|g6-oral-frac-mult-int': ['g5.g5-oral-fracadd'], '6|g6-oral-frac-mult-frac': ['g6-oral-frac-mult-int'],
  '6|g6-oral-frac-div-int': ['g5.g5-oral-fracadd'], '6|g6-oral-frac-div-frac': ['g6-oral-frac-div-int'],
  '6|g6-oral-dec-perc': ['g5.g5-fill-decloc'], '6|g6-oral-ratio-simp': ['g5.g5-v-divint'], '6|g6-oral-neg-add-sub': ['g6-fill-negative'],
  '6|g6-calc-dec-mult': ['g5.g5-v-decmul'], '6|g6-calc-dec-div': ['g5.g5-v-ddivdec'],
  '6|g6-calc-frac-mult-div': ['g6-oral-frac-mult-frac'], '6|g6-calc-solve-proportion': ['g6-fill-ratio'],
  '6|g6-mixed-frac-order': ['g6-calc-frac-mult-div'], '6|g6-mixed-frac-simple': ['g5.g5-mix-fracsimple'],
  '6|g6-mixed-solve-equation': ['g5.g5-word-equ'],
  '6|g6-fill-negative': ['g5.g5-fill-decloc'], '6|g6-fill-percent': ['g6-oral-dec-perc'], '6|g6-fill-ratio': ['g6-oral-ratio-simp'],
  '6|g6-fill-circle': ['g5.g5-fill-area'], '6|g6-fill-cylinder-cone': ['g5.g5-fill-solid'], '6|g6-fill-pie-chart': ['g5.g5-stats-line1'],
  '6|g6-fill-unit-convert': ['g2.unit-convert'],
  '6|g6-match-proportion': ['g6-fill-ratio'], '6|g6-match-formula': ['g6-fill-circle'], '6|g6-match-chart': ['g6-fill-pie-chart'],
  '6|g6-op-circle': ['g6-fill-circle'], '6|g6-op-symmetry': ['g5.g5-draw-sym'], '6|g6-op-rotate-scale': ['g5.g5-draw-rotate'],
  '6|g6-op-position': ['g5.g5-fill-coord'],
  '6|g6-pic-frac-line': ['g6-app-frac-mult'], '6|g6-pic-pie-chart': ['g6-fill-pie-chart'], '6|g6-pic-scale': ['g6-fill-ratio'],
  '6|g6-app-frac-mult': ['g6-oral-frac-mult-frac'], '6|g6-app-frac-div': ['g6-oral-frac-div-frac'],
  '6|g6-app-percent-discount': ['g6-fill-percent'], '6|g6-app-ratio-prop': ['g6-fill-ratio'],
  '6|g6-app-circle': ['g6-fill-circle'], '6|g6-app-cyl-cone': ['g6-fill-cylinder-cone'],
  '6|g6-app-travel-work': ['g6-app-frac-div'], '6|g6-app-pigeonhole': ['g5.g5-reason-tree3'],
  '6|g6-stat-pie-chart': ['g6-fill-pie-chart'], '6|g6-stat-possibility': ['g5.g5-stats-possib'],
  '6|g6-reason-number-shape': ['g5.g5-reason-seq'], '6|g6-reason-pigeonhole': ['g6-app-pigeonhole'],
  '6|g6-judge-circle': ['g6-fill-circle'], '6|g6-judge-cyl-cone': ['g6-fill-cylinder-cone'],
  '6|g6-judge-negative': ['g6-fill-negative'], '6|g6-judge-percent-ratio': ['g6-fill-percent'], '6|g6-judge-chart': ['g6-fill-pie-chart'],
  '6|g6-choice-negative': ['g6-fill-negative'], '6|g6-choice-percent': ['g6-fill-percent'], '6|g6-choice-circle': ['g6-fill-circle'],
  '6|g6-choice-cyl-cone': ['g6-fill-cylinder-cone'], '6|g6-choice-chart': ['g6-fill-pie-chart'],
  // 六年级竞赛
  '6|c1-vertical': ['g5.c1-vertical'], '6|c1-horizontal': ['g5.c1-horizontal'], '6|c1-symbol': ['g5.c1-symbol'],
  '6|c1-array': ['g5.c1-array'], '6|c1-magic': ['c1-array'],
  '6|c2-parity': ['g5.c2-parity'], '6|c2-divisible': ['g5.c2-divisible'], '6|c2-prime': ['g5.c2-prime'],
  '6|c2-factor': ['g5.c2-factor'], '6|c2-remainder': ['g5.c2-remainder'], '6|c2-place': ['g5.c2-place'],
  '6|c3-enum': ['g5.c3-enum'], '6|c3-am': ['g5.c3-am'], '6|c3-perm': ['c3-am'], '6|c3-geomcount': ['g5.c3-geomcount'],
  '6|c3-worst': ['c3-enum'],
  '6|c5-basic': ['g5.c5-basic'], '6|c5-meet': ['c5-basic'], '6|c5-chase': ['c5-basic'], '6|c5-train': ['c5-basic'],
  '6|c5-river': ['c5-basic'],
  '6|c4-pa': ['g5.c4-pa'], '6|c4-cutfill': ['c4-pa'], '6|c4-angle': ['g5.c4-angle'], '6|c4-count': ['g5.c4-count'],
  '6|c4-transform': ['g5.c4-transform'], '6|c4-solid': ['g5.c4-solid'],
  '6|c6-work': ['g5.c6-work'], '6|c6-concentration': ['g5.c6-concentration'],
  '6|c7-telescope': ['g5.c7-telescope'], '6|c7-complex': ['g5.c7-complex'], '6|c7-clever': ['g5.c7-clever'],
  '6|c7-pattern': ['g5.c7-pattern'],
  '6|c8-extreme': ['g5.c8-extreme'], '6|c8-drawer': ['g5.c8-drawer'], '6|c8-logic': ['g5.c8-logic']
};

const RELATED = {
  // ---------- 一年级 ----------
  '1|make-ten': ['make-ten-ping', 'make-ten-po', 'addsub-20', 'compose-digit'],
  '1|make-ten-ping': ['make-ten', 'make-ten-po'], '1|make-ten-po': ['make-ten', 'make-ten-ping'],
  '1|addsub-20': ['make-ten', 'picture-equations', 'chain-mixed', 'solve-problems'],
  '1|count': ['compose-digit', 'compare'], '1|compose-digit': ['count', 'compare', 'addsub-20'],
  '1|compare': ['compose-digit', 'addsub-20'], '1|clock-hour': ['count', 'g3.g3-time'],
  '1|patterns': ['g2.logic-reasoning'], '1|money': ['addsub-20', 'compare'],
  '1|solid-shapes': ['flat-shapes', 'position'], '1|flat-shapes': ['solid-shapes', 'shape-compose'],
  '1|shape-compose': ['flat-shapes', 'solid-shapes'], '1|position': ['flat-shapes'],
  '1|picture-equations': ['addsub-20', 'chain-mixed', 'solve-problems'],
  '1|chain-mixed': ['addsub-20', 'solve-problems', 'picture-equations'],
  '1|solve-problems': ['addsub-20', 'chain-mixed', 'g2.wp-solve'],
  '1|classify': ['stats-table', 'pictograph'], '1|stats-table': ['classify', 'pictograph'],
  '1|pictograph': ['stats-table', 'g2.data-tally'],
  // ---------- 二年级 ----------
  '2|addsub-100': ['mixed', 'muldiv', 'g1.addsub-20'], '2|muldiv': ['addsub-100', 'mixed', 'remainder'],
  '2|remainder': ['muldiv', 'mixed', 'g3.g3-div1'], '2|mixed': ['addsub-100', 'muldiv', 'g3.g3-mul-multi1'],
  '2|readwrite': ['compose-4', 'approx', 'g4.g4-fill-bignum'], '2|compose-4': ['readwrite', 'g1.compose-digit'],
  '2|approx': ['readwrite'], '2|unit-convert': ['fill-unit', 'g3.g3-measure', 'g6.g6-fill-unit-convert'],
  '2|fill-unit': ['unit-convert'],
  '2|shapes-2': ['angles', 'motion', 'grid'], '2|angles': ['shapes-2', 'grid', 'g4.g4-fill-angle'],
  '2|motion': ['grid', 'g4.g4-draw-move', 'g4.g4-draw-sym', 'g5.g5-draw-rotate'], '2|grid': ['shapes-2', 'angles'],
  '2|wp-solve': ['muldiv', 'mixed', 'g1.solve-problems'],
  '2|data-tally': ['data-question', 'g3.g3-stats-table'], '2|data-question': ['data-tally'],
  '2|logic-reasoning': ['sudoku3', 'g4.g4-reason-logic', 'g5.g5-reason-seq'], '2|sudoku3': ['logic-reasoning'],
  // ---------- 三年级 ----------
  '3|g3-add-sub-wan': ['g3-mul-multi1', 'g3-mul-2digit', 'g4.g4-oral-big'],
  '3|g3-mul-multi1': ['g3-mul-2digit', 'g3-div1'], '3|g3-div1': ['g3-mul-multi1', 'g4.g4-v-div2'],
  '3|g3-mul-2digit': ['g3-mul-multi1', 'g4.g4-v-mul3x2'],
  '3|g3-fraction': ['g3-decimal', 'g5.g5-fill-fracmean', 'g4.g4-match-decfrac'], '3|g3-decimal': ['g3-fraction', 'g4.g4-fill-dec'],
  '3|g3-time': ['g3-year-month'], '3|g3-year-month': ['g3-time'], '3|g3-measure': ['g2.fill-unit', 'g4.g4-fill-hectare'],
  '3|g3-perimeter': ['g3-area', 'g4.c4-pa'], '3|g3-area': ['g3-perimeter', 'g5.g5-fill-area'],
  '3|g3-position': ['g6.g6-op-position'],
  '3|g3-times': ['g3-mul-multi1', 'g4.g4-pic-segment'],
  '3|g3-stats-table': ['g4.g4-stats-bar', 'g4.g4-stats-double'],
  '3|g3-combination': ['g3-set', 'g4.c3-am'], '3|g3-set': ['g3-combination'],
  // ---------- 四年级 ----------
  '4|g4-oral-big': ['g4-oral-mul3x1', 'g4-oral-divt', 'g4-fill-bignum'],
  '4|g4-oral-mul3x1': ['g4-oral-mul2t', 'g4-v-mul3x2'], '4|g4-oral-mul2t': ['g4-oral-mul3x1', 'g4-oral-mul3x1'],
  '4|g4-oral-divt': ['g4-v-div2', 'g4-oral-mul2t'], '4|g4-oral-dec': ['g4-v-dec', 'g4-mix-dec', 'g4-fill-dec'],
  '4|g4-oral-law': ['g4-mix-addlaw', 'g4-mix-mullaw', 'g4-mix-dist'],
  '4|g4-v-mul3x2': ['g4-v-mulzero', 'g4-word-speed', 'g4-choice-est'], '4|g4-v-mulzero': ['g4-v-mul3x2', 'g4-fill-quotient'],
  '4|g4-v-div2': ['g4-v-div2q', 'g4-word-div'], '4|g4-v-div2q': ['g4-v-div2'],
  '4|g4-v-dec': ['g4-oral-dec', 'g4-mix-dec', 'g4-word-dec'],
  '4|g4-mix-order': ['g4-mix-addlaw', 'g4-mix-mullaw', 'g4-fill-op'],
  '4|g4-mix-addlaw': ['g4-mix-mullaw', 'g4-match-law', 'g4-judge-law'],
  '4|g4-mix-mullaw': ['g4-mix-dist', 'g4-match-law'], '4|g4-mix-dist': ['g4-mix-mullaw', 'g4-choice-law'],
  '4|g4-mix-dec': ['g4-v-dec', 'g4-word-dec'],
  '4|g4-fill-bignum': ['g4-match-read', 'g4-judge-read', 'g4-choice-big', 'g4-word-big'],
  '4|g4-fill-hectare': ['g4-word-area', 'g3.g3-area'], '4|g4-fill-line': ['g4-draw-para', 'g4-judge-line', 'g4-draw-grid'],
  '4|g4-fill-angle': ['g4-draw-protractor', 'g4-match-angle', 'g4-choice-angle', 'g4-judge-angle'],
  '4|g4-fill-quad': ['g4-draw-grid', 'g4-match-shape', 'g4-choice-shape'],
  '4|g4-fill-op': ['g4-mix-order', 'g4-oral-law'],
  '4|g4-fill-quotient': ['g4-judge-quotient', 'g4-v-div2q'],
  '4|g4-fill-dec': ['g4-v-dec', 'g4-choice-dec', 'g4-judge-dec', 'g4-match-decfrac'],
  '4|g4-fill-tri': ['g4-judge-tri', 'g4-choice-shape', 'g4-match-shape'],
  '4|g4-fill-avg': ['g4-stats-avg', 'g4-word-avg', 'g4-stats-bar'],
  '4|g4-match-read': ['g4-fill-bignum', 'g4-judge-read'], '4|g4-match-angle': ['g4-fill-angle', 'g4-draw-protractor'],
  '4|g4-match-shape': ['g4-fill-quad', 'g4-fill-tri', 'g4-choice-shape'],
  '4|g4-match-law': ['g4-mix-addlaw', 'g4-mix-mullaw', 'g4-judge-law'],
  '4|g4-match-decfrac': ['g4-fill-dec', 'g5.g5-match-fracdec'],
  '4|g4-draw-protractor': ['g4-fill-angle', 'g4-match-angle'], '4|g4-draw-para': ['g4-fill-line', 'g4-draw-grid'],
  '4|g4-draw-grid': ['g4-fill-quad', 'g4-draw-para'], '4|g4-draw-view': ['g5.g5-draw-observe', 'g6.g6-op-position'],
  '4|g4-draw-sym': ['g5.g5-draw-sym', 'g4-draw-move'], '4|g4-draw-move': ['g5.g5-draw-rotate', 'g4-draw-sym'],
  '4|g4-pic-segment': ['g4-word-big', 'g4-pic-brace', 'g5.g5-pic-segment'], '4|g4-pic-brace': ['g4-word-div', 'g4-pic-segment'],
  '4|g4-pic-speed': ['g4-word-speed', 'c5-basic'], '4|g4-pic-dec': ['g4-word-dec'],
  '4|g4-word-big': ['g4-fill-bignum', 'g4-pic-segment'], '4|g4-word-speed': ['g4-pic-speed', 'c5-basic', 'c5-meet'],
  '4|g4-word-div': ['g4-word-price', 'g4-word-speed', 'g4-pic-brace'],
  '4|g4-word-price': ['g4-word-div', 'g4-word-speed'], '4|g4-word-area': ['g4-fill-hectare'],
  '4|g4-word-opt': ['g4-reason-opt', 'g4-word-cr', 'c8-extreme'],
  '4|g4-word-cr': ['g4-reason-cr', 'g4-word-opt'],
  '4|g4-word-dec': ['g4-pic-dec', 'g4-v-dec', 'g4-mix-dec'],
  '4|g4-word-avg': ['g4-stats-avg', 'g4-fill-avg'],
  '4|g4-stats-bar': ['g4-stats-double', 'g4-word-avg', 'g5.g5-stats-line1'],
  '4|g4-stats-double': ['g4-stats-bar', 'g5.g5-stats-line2'],
  '4|g4-stats-avg': ['g4-word-avg', 'g4-fill-avg', 'g4-stats-bar'],
  '4|g4-reason-opt': ['g4-word-opt', 'c8-extreme', 'g4-reason-cr'],
  '4|g4-reason-cr': ['g4-word-cr', 'g4-reason-opt'],
  '4|g4-reason-logic': ['g5.g5-reason-logic', 'g5.g5-reason-seq', 'g2.logic-reasoning'],
  '4|g4-judge-read': ['g4-fill-bignum', 'g4-match-read', 'g4-choice-big'],
  '4|g4-judge-law': ['g4-mix-addlaw', 'g4-match-law', 'g4-choice-law'],
  '4|g4-judge-angle': ['g4-fill-angle', 'g4-choice-angle'],
  '4|g4-judge-line': ['g4-fill-line', 'g4-draw-para'],
  '4|g4-judge-quotient': ['g4-fill-quotient', 'g4-v-div2q'],
  '4|g4-judge-dec': ['g4-fill-dec', 'g4-choice-dec'],
  '4|g4-judge-tri': ['g4-fill-tri', 'g4-choice-shape'],
  '4|g4-judge-stats': ['g4-stats-bar', 'g4-stats-avg', 'g5.g5-judge-stats'],
  '4|g4-choice-big': ['g4-fill-bignum', 'g4-judge-read'],
  '4|g4-choice-est': ['g4-v-mul3x2', 'g4-v-div2'],
  '4|g4-choice-angle': ['g4-fill-angle', 'g4-judge-angle'],
  '4|g4-choice-shape': ['g4-fill-quad', 'g4-fill-tri', 'g4-match-shape'],
  '4|g4-choice-dec': ['g4-fill-dec', 'g4-judge-dec'],
  '4|g4-choice-law': ['g4-mix-addlaw', 'g4-mix-dist', 'g4-judge-law'],
  // 四年级竞赛
  '4|c1-vertical': ['c1-horizontal', 'c2-place', 'g4-v-mul3x2'],
  '4|c1-horizontal': ['c1-vertical', 'c1-symbol', 'g4-mix-order'],
  '4|c1-symbol': ['c2-place', 'c1-horizontal', 'g2.logic-reasoning'],
  '4|c1-array': ['c1-magic', 'c1-symbol'], '4|c1-magic': ['c1-array'],
  '4|c2-parity': ['c2-divisible', 'c2-remainder', 'g4-mix-order'],
  '4|c2-divisible': ['c2-factor', 'c2-prime'], '4|c2-prime': ['c2-factor', 'c2-divisible', 'g5.g5-fill-prime'],
  '4|c2-factor': ['c2-prime', 'c2-divisible'], '4|c2-remainder': ['c2-divisible', 'c2-factor', 'g3.g3-div1'],
  '4|c2-place': ['c1-symbol', 'g2.readwrite', 'g4-fill-bignum'],
  '4|c3-enum': ['c3-am', 'c3-worst', 'g2.logic-reasoning'],
  '4|c3-am': ['c3-perm', 'c3-enum', 'g3.g3-combination'],
  '4|c3-perm': ['c3-am', 'c3-worst'],
  '4|c3-geomcount': ['c4-count', 'c3-enum', 'g2.shapes-2'],
  '4|c3-worst': ['c3-enum', 'c8-drawer'],
  '4|c4-pa': ['c4-cutfill', 'g3.g3-area', 'g3.g3-perimeter'],
  '4|c4-cutfill': ['c4-pa', 'g5.g5-fill-area'],
  '4|c4-angle': ['c4-pa', 'c4-count', 'g4-fill-angle'],
  '4|c4-count': ['c3-geomcount', 'c4-angle'],
  '4|c4-transform': ['g4-draw-sym', 'g4-draw-move', 'g5.g5-draw-rotate'],
  '4|c4-solid': ['g5.g5-fill-solid', 'g5.g5-draw-net'],
  '4|c5-basic': ['c5-meet', 'c5-chase', 'g4-word-speed'],
  '4|c5-meet': ['c5-chase', 'c5-train', 'c5-basic'],
  '4|c5-chase': ['c5-meet', 'c5-train', 'c5-basic'],
  '4|c5-train': ['c5-meet', 'c5-river', 'c5-basic'],
  '4|c5-river': ['c5-meet', 'c5-basic'],
  '4|c8-extreme': ['c8-drawer', 'g4-reason-opt', 'c3-worst'],
  '4|c8-drawer': ['c8-logic', 'c3-worst', 'g4-reason-logic'],
  '4|c8-logic': ['c8-drawer', 'g5.g5-reason-logic', 'g4-reason-logic'],
  '4|c9-integrated': [], '4|c9-misc': [], '4|c9-mock': [],
  // ---------- 五年级 ----------
  '5|g5-oral-decmul': ['g5-v-decmul', 'g5-word-decmul'], '5|g5-oral-decdiv': ['g5-v-divint', 'g5-word-decdiv'],
  '5|g5-oral-fracadd': ['g5-mix-fracmixed', 'g5-word-frac'], '5|g5-oral-equ': ['g5-fill-equation', 'g5-word-equ'],
  '5|g5-oral-fm': ['g5-fill-fm', 'g5-fill-prime'],
  '5|g5-v-decmul': ['g5-oral-decmul', 'g5-word-decmul', 'g5-judge-decmul'],
  '5|g5-v-divint': ['g5-oral-decdiv', 'g5-v-ddivdec', 'g5-word-decdiv'],
  '5|g5-v-ddivdec': ['g5-v-divint', 'g5-fill-repeating'],
  '5|g5-v-repeating': ['g5-fill-repeating', 'g5-v-ddivdec'],
  '5|g5-mix-decmixed': ['g5-mix-decsimple', 'g5-oral-decmul'],
  '5|g5-mix-fracmixed': ['g5-mix-fracsimple', 'g5-oral-fracadd'],
  '5|g5-mix-decsimple': ['g5-mix-fracsimple', 'g5-mix-decmixed'],
  '5|g5-mix-fracsimple': ['g5-mix-fracmixed', 'g5-mix-decsimple'],
  '5|g5-fill-decloc': ['g5-fill-deccmp', 'g5-oral-decmul'], '5|g5-fill-deccmp': ['g5-fill-decloc'],
  '5|g5-fill-prodrule': ['g5-fill-fm', 'g5-v-decmul'],
  '5|g5-fill-repeating': ['g5-v-repeating', 'g5-v-ddivdec'],
  '5|g5-fill-equation': ['g5-word-equ', 'g5-match-equ', 'g5-pic-balance'],
  '5|g5-fill-fm': ['g5-fill-prime', 'g5-judge-fm', 'g5-word-fm', 'g5-oral-fm'],
  '5|g5-fill-prime': ['g5-fill-fm', 'c2-prime', 'g5-judge-fm'],
  '5|g5-fill-fracmean': ['g5-fill-fracprop', 'g5-word-frac', 'g3.g3-fraction'],
  '5|g5-fill-fracprop': ['g5-fill-fracmean', 'g5-fill-fracdec'],
  '5|g5-fill-fracdec': ['g5-match-fracdec', 'g5-fill-fracprop'],
  '5|g5-fill-coord': ['g5-draw-coord', 'g6.g6-op-position'],
  '5|g5-fill-area': ['g5-match-areaf', 'g5-draw-height', 'g5-word-area'],
  '5|g5-fill-solid': ['g5-match-solid', 'g5-draw-net', 'g5-word-solid', 'g6.g6-fill-cylinder-cone'],
  '5|g5-fill-rotate': ['g5-draw-rotate', 'g5-judge-rotate', 'g5-choice-rotate'],
  '5|g5-fill-possible': ['g5-stats-possib', 'g5-word-possib', 'g5-match-possib'],
  '5|g5-fill-linechart': ['g5-stats-line1', 'g5-word-linechart', 'g5-stats-line2'],
  '5|g5-match-areaf': ['g5-fill-area', 'g5-draw-height'], '5|g5-match-solid': ['g5-fill-solid', 'g5-draw-net'],
  '5|g5-match-possib': ['g5-fill-possible', 'g5-stats-possib'], '5|g5-match-equ': ['g5-fill-equation', 'g5-word-equ'],
  '5|g5-match-fracdec': ['g5-fill-fracdec', 'g4.g4-match-decfrac'],
  '5|g5-draw-rotate': ['g5-fill-rotate', 'g5-draw-sym', 'g5-judge-rotate'],
  '5|g5-draw-observe': ['g4.g4-draw-view', 'g5-draw-net'],
  '5|g5-draw-height': ['g5-fill-area', 'g5-match-areaf', 'g5-word-area'],
  '5|g5-draw-sym': ['g5-draw-rotate', 'g4.g4-draw-sym'],
  '5|g5-draw-coord': ['g5-fill-coord', 'g6.g6-op-position'],
  '5|g5-draw-net': ['g5-fill-solid', 'g5-match-solid', 'g6.g6-fill-cylinder-cone'],
  '5|g5-pic-balance': ['g5-word-equ', 'g5-fill-equation'], '5|g5-pic-area': ['g5-word-area', 'g5-fill-area'],
  '5|g5-pic-segment': ['g5-word-decmul', 'g4.g4-pic-segment'],
  '5|g5-pic-tree': ['g5-word-tree', 'g5-reason-tree3'],
  '5|g5-word-decmul': ['g5-v-decmul', 'g5-word-decdiv', 'g5-oral-decmul'],
  '5|g5-word-decdiv': ['g5-word-decmul', 'g5-v-divint'],
  '5|g5-word-equ': ['g5-fill-equation', 'g5-pic-balance', 'g6.g6-mixed-solve-equation'],
  '5|g5-word-fm': ['g5-fill-fm', 'g5-word-frac'],
  '5|g5-word-frac': ['g5-fill-fracmean', 'g5-word-fm', 'g5-oral-fracadd'],
  '5|g5-word-area': ['g5-fill-area', 'g5-pic-area', 'g5-word-solid'],
  '5|g5-word-solid': ['g5-fill-solid', 'g5-word-area', 'g6.g6-app-cyl-cone'],
  '5|g5-word-possib': ['g5-fill-possible', 'g5-stats-possib'],
  '5|g5-word-linechart': ['g5-fill-linechart', 'g5-stats-line1'],
  '5|g5-word-tree': ['g5-pic-tree', 'g5-reason-tree3', 'g5-word-fm'],
  '5|g5-word-defect': ['g5-reason-defect', 'g5-word-decdiv'],
  '5|g5-stats-possib': ['g5-word-possib', 'g6.g6-stat-possibility', 'g5-fill-possible'],
  '5|g5-stats-line1': ['g5-stats-line2', 'g5-word-linechart', 'g5-fill-linechart'],
  '5|g5-stats-line2': ['g5-stats-line1', 'g6.g6-stat-pie-chart'],
  '5|g5-reason-tree3': ['g5-word-tree', 'g5-reason-seq', 'g5-pic-tree'],
  '5|g5-reason-defect': ['g5-word-defect', 'g5-reason-seq'],
  '5|g5-reason-logic': ['g4.g4-reason-logic', 'g5-reason-seq', 'g5-reason-tree3'],
  '5|g5-reason-seq': ['g5-reason-logic', 'g6.g6-reason-number-shape'],
  '5|g5-judge-decmul': ['g5-choice-decmul', 'g5-v-decmul'], '5|g5-judge-equ': ['g5-choice-equ', 'g5-fill-equation'],
  '5|g5-judge-fm': ['g5-choice-fm', 'g5-fill-fm'], '5|g5-judge-frac': ['g5-choice-frac', 'g5-fill-fracmean'],
  '5|g5-judge-area': ['g5-choice-area', 'g5-fill-area'], '5|g5-judge-solid': ['g5-choice-solid', 'g5-fill-solid'],
  '5|g5-judge-rotate': ['g5-choice-rotate', 'g5-draw-rotate', 'g5-fill-rotate'],
  '5|g5-judge-possib': ['g5-choice-possib', 'g5-fill-possible'], '5|g5-judge-stats': ['g5-choice-stats', 'g4.g4-judge-stats'],
  '5|g5-choice-decmul': ['g5-judge-decmul', 'g5-v-decmul'], '5|g5-choice-equ': ['g5-judge-equ', 'g5-fill-equation'],
  '5|g5-choice-fm': ['g5-judge-fm', 'g5-fill-fm'], '5|g5-choice-frac': ['g5-judge-frac', 'g5-fill-fracmean'],
  '5|g5-choice-area': ['g5-judge-area', 'g5-fill-area'], '5|g5-choice-solid': ['g5-judge-solid', 'g5-fill-solid'],
  '5|g5-choice-rotate': ['g5-judge-rotate', 'g5-draw-rotate', 'g5-fill-rotate'],
  '5|g5-choice-possib': ['g5-judge-possib', 'g5-fill-possible'], '5|g5-choice-stats': ['g5-judge-stats', 'g4.g4-judge-stats'],
  // 五年级竞赛
  '5|c1-vertical': ['c1-horizontal', 'c2-place'], '5|c1-horizontal': ['c1-vertical', 'c1-symbol'],
  '5|c1-symbol': ['c2-place', 'c1-horizontal'], '5|c1-array': ['c1-magic', 'c1-symbol'], '5|c1-magic': ['c1-array'],
  '5|c2-parity': ['c2-divisible', 'c2-remainder'], '5|c2-divisible': ['c2-factor', 'c2-prime'],
  '5|c2-prime': ['c2-factor', 'c2-divisible'], '5|c2-factor': ['c2-prime', 'c2-divisible'],
  '5|c2-remainder': ['c2-divisible', 'c2-factor'], '5|c2-place': ['c1-symbol', 'g5.g5-fill-decloc'],
  '5|c3-enum': ['c3-am', 'c3-worst'], '5|c3-am': ['c3-perm', 'c3-enum'], '5|c3-perm': ['c3-am', 'c3-worst'],
  '5|c3-geomcount': ['c4-count', 'c3-enum'], '5|c3-worst': ['c3-enum', 'g5-reason-tree3'],
  '5|c5-basic': ['c5-meet', 'c5-chase', 'g5-word-decmul'], '5|c5-meet': ['c5-chase', 'c5-train'],
  '5|c5-chase': ['c5-meet', 'c5-train'], '5|c5-train': ['c5-meet', 'c5-river'], '5|c5-river': ['c5-meet'],
  '5|c4-pa': ['c4-cutfill', 'g5-fill-area'], '5|c4-cutfill': ['c4-pa', 'g5-fill-area'],
  '5|c4-angle': ['c4-pa', 'c4-count'], '5|c4-count': ['c3-geomcount', 'c4-angle'],
  '5|c4-transform': ['g5-draw-rotate', 'g5-draw-sym'], '5|c4-solid': ['g5-fill-solid', 'g5-draw-net'],
  '5|c6-work': ['c6-concentration', 'g6.g6-app-travel-work', 'c5-basic'],
  '5|c6-concentration': ['c6-work', 'c7-clever', 'g5-word-frac'],
  '5|c7-telescope': ['c7-complex', 'c7-clever'], '5|c7-complex': ['c7-telescope', 'c7-clever'],
  '5|c7-clever': ['c7-telescope', 'c7-complex'], '5|c7-pattern': ['c7-telescope', 'g5-reason-seq'],
  '5|c8-extreme': ['c8-drawer', 'g5-reason-seq'], '5|c8-drawer': ['c8-logic', 'c3-worst'],
  '5|c8-logic': ['c8-drawer', 'g5-reason-logic'],
  // ---------- 六年级 ----------
  '6|g6-oral-frac-mult-int': ['g6-oral-frac-mult-frac', 'g6-app-frac-mult'],
  '6|g6-oral-frac-mult-frac': ['g6-oral-frac-mult-int', 'g6-calc-frac-mult-div'],
  '6|g6-oral-frac-div-int': ['g6-oral-frac-div-frac', 'g6-app-frac-div'],
  '6|g6-oral-frac-div-frac': ['g6-oral-frac-div-int', 'g6-app-frac-div'],
  '6|g6-oral-dec-perc': ['g6-fill-percent', 'g6-choice-percent'],
  '6|g6-oral-ratio-simp': ['g6-fill-ratio', 'g6-match-proportion'],
  '6|g6-oral-neg-add-sub': ['g6-fill-negative', 'g6-judge-negative'],
  '6|g6-calc-dec-mult': ['g6-calc-dec-div', 'g5.g5-v-decmul'], '6|g6-calc-dec-div': ['g6-calc-dec-mult', 'g5.g5-v-ddivdec'],
  '6|g6-calc-frac-mult-div': ['g6-mixed-frac-order', 'g6-oral-frac-mult-frac'],
  '6|g6-calc-solve-proportion': ['g6-app-ratio-prop', 'g6-fill-ratio'],
  '6|g6-mixed-frac-order': ['g6-mixed-frac-simple', 'g6-calc-frac-mult-div'],
  '6|g6-mixed-frac-simple': ['g6-mixed-frac-order', 'g5.g5-mix-fracsimple'],
  '6|g6-mixed-solve-equation': ['g6-calc-solve-proportion', 'g5.g5-word-equ'],
  '6|g6-fill-negative': ['g6-oral-neg-add-sub', 'g6-judge-negative', 'g6-choice-negative'],
  '6|g6-fill-percent': ['g6-app-percent-discount', 'g6-choice-percent', 'g6-judge-percent-ratio'],
  '6|g6-fill-ratio': ['g6-app-ratio-prop', 'g6-match-proportion', 'g6-calc-solve-proportion'],
  '6|g6-fill-circle': ['g6-op-circle', 'g6-app-circle', 'g6-judge-circle'],
  '6|g6-fill-cylinder-cone': ['g6-app-cyl-cone', 'g6-judge-cyl-cone', 'g6-choice-cyl-cone'],
  '6|g6-fill-pie-chart': ['g6-stat-pie-chart', 'g6-pic-pie-chart', 'g6-match-chart'],
  '6|g6-fill-unit-convert': ['g2.unit-convert', 'g6-app-ratio-prop'],
  '6|g6-match-proportion': ['g6-fill-ratio', 'g6-app-ratio-prop'],
  '6|g6-match-formula': ['g6-fill-circle', 'g6-fill-cylinder-cone'],
  '6|g6-match-chart': ['g6-fill-pie-chart', 'g6-stat-pie-chart'],
  '6|g6-op-circle': ['g6-fill-circle', 'g6-op-rotate-scale'],
  '6|g6-op-symmetry': ['g6-op-rotate-scale', 'g5.g5-draw-sym'],
  '6|g6-op-rotate-scale': ['g6-op-circle', 'g6-op-position'],
  '6|g6-op-position': ['g6-pic-scale', 'g5.g5-fill-coord'],
  '6|g6-pic-frac-line': ['g6-app-frac-mult', 'g6-app-frac-div'],
  '6|g6-pic-pie-chart': ['g6-stat-pie-chart', 'g6-fill-pie-chart'],
  '6|g6-pic-scale': ['g6-app-ratio-prop', 'g6-op-position'],
  '6|g6-app-frac-mult': ['g6-app-frac-div', 'g6-pic-frac-line', 'g6-oral-frac-mult-frac'],
  '6|g6-app-frac-div': ['g6-app-frac-mult', 'g6-pic-frac-line', 'g6-app-travel-work'],
  '6|g6-app-percent-discount': ['g6-fill-percent', 'g6-choice-percent'],
  '6|g6-app-ratio-prop': ['g6-fill-ratio', 'g6-pic-scale', 'g6-match-proportion'],
  '6|g6-app-circle': ['g6-fill-circle', 'g6-op-circle', 'g6-choice-circle'],
  '6|g6-app-cyl-cone': ['g6-fill-cylinder-cone', 'g6-choice-cyl-cone', 'g5.g5-word-solid'],
  '6|g6-app-travel-work': ['g4.c5-meet', 'g5.c6-work', 'g6-app-frac-div'],
  '6|g6-app-pigeonhole': ['g6-reason-pigeonhole', 'g5.g5-reason-tree3'],
  '6|g6-stat-pie-chart': ['g6-pic-pie-chart', 'g6-match-chart', 'g6-fill-pie-chart'],
  '6|g6-stat-possibility': ['g5.g5-stats-possib', 'g5.g5-word-possib'],
  '6|g6-reason-number-shape': ['g6-reason-pigeonhole', 'g5.g5-reason-seq'],
  '6|g6-reason-pigeonhole': ['g6-app-pigeonhole', 'c3-worst'],
  '6|g6-judge-circle': ['g6-choice-circle', 'g6-fill-circle'], '6|g6-judge-cyl-cone': ['g6-choice-cyl-cone', 'g6-fill-cylinder-cone'],
  '6|g6-judge-negative': ['g6-choice-negative', 'g6-fill-negative'],
  '6|g6-judge-percent-ratio': ['g6-choice-percent', 'g6-fill-percent'],
  '6|g6-judge-chart': ['g6-choice-chart', 'g6-fill-pie-chart'],
  '6|g6-choice-negative': ['g6-judge-negative', 'g6-fill-negative'],
  '6|g6-choice-percent': ['g6-judge-percent-ratio', 'g6-fill-percent'],
  '6|g6-choice-circle': ['g6-judge-circle', 'g6-fill-circle'],
  '6|g6-choice-cyl-cone': ['g6-judge-cyl-cone', 'g6-fill-cylinder-cone'],
  '6|g6-choice-chart': ['g6-judge-chart', 'g6-fill-pie-chart'],
  // 六年级竞赛
  '6|c1-vertical': ['c1-horizontal', 'c2-place'], '6|c1-horizontal': ['c1-vertical', 'c1-symbol'],
  '6|c1-symbol': ['c2-place', 'c1-horizontal'], '6|c1-array': ['c1-magic', 'c1-symbol'], '6|c1-magic': ['c1-array'],
  '6|c2-parity': ['c2-divisible', 'c2-remainder'], '6|c2-divisible': ['c2-factor', 'c2-prime'],
  '6|c2-prime': ['c2-factor', 'c2-divisible'], '6|c2-factor': ['c2-prime', 'c2-divisible'],
  '6|c2-remainder': ['c2-divisible', 'c2-factor'], '6|c2-place': ['c1-symbol', 'g6-fill-ratio'],
  '6|c3-enum': ['c3-am', 'c3-worst'], '6|c3-am': ['c3-perm', 'c3-enum'], '6|c3-perm': ['c3-am', 'c3-worst'],
  '6|c3-geomcount': ['c4-count', 'c3-enum'], '6|c3-worst': ['c3-enum', 'g6-reason-pigeonhole'],
  '6|c5-basic': ['c5-meet', 'c5-chase', 'g6-app-travel-work'], '6|c5-meet': ['c5-chase', 'c5-train'],
  '6|c5-chase': ['c5-meet', 'c5-train'], '6|c5-train': ['c5-meet', 'c5-river'], '6|c5-river': ['c5-meet'],
  '6|c4-pa': ['c4-cutfill', 'g6-fill-circle'], '6|c4-cutfill': ['c4-pa', 'g6-fill-circle'],
  '6|c4-angle': ['c4-pa', 'c4-count'], '6|c4-count': ['c3-geomcount', 'c4-angle'],
  '6|c4-transform': ['g6-op-rotate-scale', 'g6-op-symmetry'], '6|c4-solid': ['g6-fill-cylinder-cone', 'g6-fill-circle'],
  '6|c6-work': ['c6-concentration', 'g6-app-travel-work', 'c5-basic'],
  '6|c6-concentration': ['c6-work', 'c7-clever', 'g6-app-percent-discount'],
  '6|c7-telescope': ['c7-complex', 'c7-clever'], '6|c7-complex': ['c7-telescope', 'c7-clever'],
  '6|c7-clever': ['c7-telescope', 'c7-complex'], '6|c7-pattern': ['c7-telescope', 'g6-reason-number-shape'],
  '6|c8-extreme': ['c8-drawer', 'g6-reason-number-shape'], '6|c8-drawer': ['c8-logic', 'c3-worst', 'g6-reason-pigeonhole'],
  '6|c8-logic': ['c8-drawer', 'g6-reason-pigeonhole']
};

// ---------- 通用 ----------
function difficultyFor(grade, moduleId) {
  if (/^C/i.test(moduleId)) {
    if (grade === 4) return 3;
    if (grade === 5) return 4;
    if (grade === 6) return 5;
    return 3;
  }
  return 1;
}

function csvEscape(v) {
  if (v == null) v = '';
  v = String(v);
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

// ---------- 构建最终 newId 查找表 ----------
const newIdByKey = {};      // "grade|oldId" -> newId
const meta = {};            // "grade|oldId" -> {grade, moduleId, oldId, baseSlug, name, ...}
KB.forEach(function (g) {
  g.modules.forEach(function (m) {
    m.knowledgePoints.forEach(function (p) {
      const key = g.grade + '|' + p.id;
      const baseSlug = SLUG_NORM[p.id] || p.id;
      const slugVal = (SLUGS[g.grade + '-' + p.id] ? g.grade + '-' + baseSlug : g.grade + '-' + baseSlug);
      const newId = 'g' + g.grade + '-' + m.moduleId.toLowerCase() + '-' + baseSlug;
      newIdByKey[key] = newId;
      meta[key] = {
        grade: g.grade, moduleId: m.moduleId, oldId: p.id, baseSlug: baseSlug,
        slug: g.grade + '-' + baseSlug, name: p.name, pluginId: p.pluginId,
        description: p.description || '', example: p.example || ''
      };
    });
  });
});

// ---------- 解析引用 ----------
function resolveRef(ref, curGrade) {
  if (ref == null) return null;
  const s = String(ref);
  const m = /^g(\d)\.(.+)$/.exec(s);
  if (m) return newIdByKey[m[1] + '|' + m[2]] || null;
  return newIdByKey[curGrade + '|' + s] || null;
}

// ---------- 生成 CSV ----------
const HEADER = [
  'oldId', 'newId', 'grade', 'moduleId', 'slug', 'name',
  'description', 'example', 'prerequisiteSuggestion', 'relatedSuggestion',
  'difficulty', 'status'
];
const rows = [HEADER];
const dangling = [];
let noRule = 0;

KB.forEach(function (g) {
  g.modules.forEach(function (m) {
    m.knowledgePoints.forEach(function (p) {
      const key = g.grade + '|' + p.id;
      const k = meta[key];
      const preRefs = PREREQ[key] || [];
      const relRefs = RELATED[key] || [];
      if (!PREREQ[key] && !RELATED[key]) noRule++;
      preRefs.forEach(function (r) {
        if (!resolveRef(r, g.grade)) dangling.push('PREREQ ' + key + ' -> ' + r);
      });
      relRefs.forEach(function (r) {
        if (!resolveRef(r, g.grade)) dangling.push('RELATED ' + key + ' -> ' + r);
      });
      const pre = preRefs.map(function (r) { return resolveRef(r, g.grade); }).filter(Boolean).join('|');
      const rel = relRefs.map(function (r) { return resolveRef(r, g.grade); }).filter(Boolean).join('|');
      const isPlaceholder = /placeholder/i.test(p.pluginId);
      rows.push([
        p.id, newIdByKey[key], g.grade, m.moduleId, k.slug, p.name || '',
        k.description, k.example, pre, rel,
        difficultyFor(g.grade, m.moduleId), isPlaceholder ? 'placeholder' : 'active'
      ]);
    });
  });
});

const csv = rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'migration-map-final.csv'), csv, 'utf8');

console.log('已写入 migration-map-final.csv');
console.log('数据行数:', rows.length - 1);
console.log('缺少规则的知识点数(应=356-占位3=353):', noRule);
console.log('悬空引用总数:', dangling.length);
dangling.forEach(function (d) { console.log('  ' + d); });
