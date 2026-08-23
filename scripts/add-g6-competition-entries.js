// scripts/add-g6-competition-entries.js
// 将六年级竞赛模块 C1~C9 重建为 89 个新语义 slug 条目（全部 status:'placeholder'，指向通用占位插件）。
// 依据：docs 六年级竞赛模块映射表（与五年级 slug 同构，难度递增，prerequisites 指向五年级同 slug）。
// 替换原有旧 slug 条目（删旧留新），后续逐题型激活（同五年级流程）。
// 用法：node scripts/add-g6-competition-entries.js
'use strict';

const fs = require('fs');
const path = require('path');

const KB_FILE = path.join(__dirname, '..', 'shared', 'knowledge-bank.js');
const KB = require(KB_FILE);

const PLACEHOLDER = 'math-competition-placeholder';
const W = 1;
const ST = 'placeholder';
const P = PLACEHOLDER;

// ============ 89 个知识点（baseSlug, name, type, description, example, difficulty, prereqs(g5), related(同模块)）============
const ENTRIES = {
  C1: [
    ['digit-puzzle-vertical', '竖式谜（乘除法深化）', 'vertical', '乘除法竖式中填缺失数字，进退位更复杂，需位值分列推理。', '三位数 × 一位数竖式中补全 □ 使竖式成立。', 3, ['g5-c1-digit-puzzle-vertical'], ['g6-c1-digit-puzzle-horizontal']],
    ['digit-puzzle-horizontal', '横式谜（括号与运算符号）', 'horizontal', '填运算符号与括号使等式成立，需要枚举与估算结合。', '在 5 5 5 5 之间填符号（可加括号）使结果等于 10。', 3, ['g5-c1-digit-puzzle-horizontal'], ['g6-c1-digit-puzzle-symbol']],
    ['digit-puzzle-symbol', '字母符号代表数（多位数）', 'symbol', '多位数字母算式（如 ABC×D），利用进位链与首位不为零推理。', 'ABC×A＝DDA 型字母竖式求各字母。', 4, ['g5-c1-digit-puzzle-symbol'], ['g6-c1-digit-puzzle-vertical']],
    ['number-array-closed', '封闭型数阵（复杂图形）', 'array-closed', '多边形数阵边和相等，重叠格重复次数增多，用总和配平。', '把 1~8 填入四边形数阵使每边三数和相等。', 4, ['g5-c1-number-array-closed'], ['g6-c1-number-array-radial']],
    ['number-array-radial', '辐射型数阵（重复数策略）', 'array-radial', '辐射数阵中心数多次重复，先定中心再分配外围。', '中心数重复 4 次的辐射数阵每线和相等。', 4, ['g5-c1-number-array-radial'], ['g6-c1-number-array-composite']],
    ['number-array-composite', '复合型数阵', 'array-composite', '封闭与辐射叠加的复合数阵，多约束联立求解。', '复合数阵中同时满足边和与线和相等。', 5, ['g5-c1-number-array-composite'], ['g6-c1-number-array-closed']],
    ['magic-square-3', '三阶幻方（性质与应用）', 'magic3', '巩固洛书结构：幻和 15、中心 5、对角互补等性质的灵活应用。', '已知三阶幻方部分格子，利用性质快速补全。', 3, ['g5-c1-magic-square-3'], ['g6-c1-magic-square-4']],
    ['magic-square-4', '四阶幻方（补全与性质）', 'magic4', '四阶幻方幻和 34 与对称交换构造，补全含缺格的幻方。', '四阶幻方中由行列性质确定缺格数字。', 4, ['g5-c1-magic-square-4'], ['g6-c1-magic-square-3']]
  ],
  C2: [
    ['divisibility', '整除特征（7、11、13 综合）', 'divisibility', '掌握 7（截尾）、11（奇偶位差）、13 综合整除判定。', '判断 2774 能否被 7 或 11 整除。', 3, ['g5-c2-divisibility'], ['g6-c2-modulo-arithmetic']],
    ['parity-analysis', '奇偶分析（构造与证明）', 'parity', '利用奇偶性进行存在性论证与反证（如±号配平）。', '证明 ±1±2±…±n 的和不可能为奇数。', 4, ['g5-c2-parity-analysis'], ['g6-c2-divisibility']],
    ['prime-factorization', '分解质因数（大数）', 'prime-factor', '较大合数的标准分解（短除 / 试除优化）。', '分解 2025 的质因数。', 3, ['g5-c2-prime-factorization'], ['g6-c2-factor-count-sum']],
    ['factor-count-sum', '因数个数与因数和（逆用）', 'factor-count', '逆用公式：由因数个数/和反推原数的结构。', '恰有 12 个因数的最小自然数是多少？', 4, ['g5-c2-factor-count-sum'], ['g6-c2-prime-factorization']],
    ['gcd-lcm', '最大公因数与最小公倍数（应用）', 'gcd-lcm', 'gcd/lcm 在周期重合、切割分组等场景的综合应用。', '两数的积是 864，gcd 是 12，求 lcm。', 3, ['g5-c2-gcd-lcm'], ['g6-c2-prime-factorization']],
    ['remainder-congruence', '同余方程与剩余定理', 'remainder', '同余方程求解与中国剩余定理（逐步满足法）。', 'x≡2(mod 3)，x≡3(mod 5)，求最小 x。', 5, ['g5-c2-remainder-congruence'], ['g6-c2-modulo-arithmetic']],
    ['place-value', '位值原理（多位数）', 'place', '多位数的位值拆分与数字调整（插入/交换/删除数字）。', '六位数 □1999□ 能被 45 整除，求原数。', 4, ['g5-c2-place-value'], ['g6-c2-divisibility']],
    ['perfect-square', '完全平方数性质（个位、模3/4）', 'perfect-square', '完全平方数个位限制与 mod3/mod4 特征用于排除与构造。', '相邻两整数之积不可能是完全平方数。', 4, ['g5-c2-perfect-square'], ['g6-c2-prime-factorization']],
    ['number-theory-extreme', '数论最值（整除与余数）', 'nt-extreme', '带余除式 A=qa+r 结构下的最大最小与计数。', '被 11 除余 4 的三位数共有多少个？', 5, ['g5-c2-number-theory-extreme'], ['g6-c2-remainder-congruence']],
    ['diophantine-equation', '不定方程整数解（含参数）', 'diophantine', '二元一次不定方程的整数解组数与参数讨论。', '7x＋11y＝263 有多少组正整数解？', 5, ['g5-c9-diophantine-equation'], ['g6-c2-remainder-congruence']],
    ['modulo-arithmetic', '模运算与周期（大指数）', 'modulo', '幂的末位与余数周期（如 a^b 的个位、mod m 周期）。', '2^2024 的个位数字是几？', 5, ['g5-c2-remainder-congruence'], ['g6-c2-remainder-congruence']]
  ],
  C3: [
    ['addition-principle', '加法原理（复杂分类）', 'add-principle', '多标准交叉分类时不重不漏地分类相加。', '一位数、两位数中含有数字 1 的数共几个？', 3, ['g5-c3-addition-principle'], ['g6-c3-multiplication-principle']],
    ['multiplication-principle', '乘法原理（多步骤）', 'mult-principle', '多步骤、有依赖条件的分步计数。', '用 0~9 组成无重复数字的三位偶数有几个？', 3, ['g5-c3-multiplication-principle'], ['g6-c3-permutation']],
    ['permutation', '排列（含限制条件）', 'permutation', '带限制（相邻/特定位置/数字约束）的排列。', '6 人排队，甲不在两端且乙在甲左边，几种排法？', 4, ['g5-c3-permutation'], ['g6-c3-combination']],
    ['combination', '组合（含分组问题）', 'combination', '均匀/非均匀分组与分配的组合计算。', '9 人分三组做实验，各组 3 人，几种分法？', 4, ['g5-c3-combination'], ['g6-c3-permutation']],
    ['enumeration-counting', '枚举计数（有序技巧）', 'enumeration', '有序枚举与树形图技巧，避免遗漏重复。', '用 1~5 组成各位递增的三位数有几个？', 3, ['g5-c3-enumeration-counting'], ['g6-c3-recursion-counting']],
    ['bundling-method', '捆绑法（多组相邻）', 'bundling', '多元素整体捆绑（内部再排列）的计数。', '三对舞伴排成一排且每对相邻，几种排法？', 4, ['g5-c3-bundling-method'], ['g6-c3-insertion-method']],
    ['insertion-method', '插空法（多组不相邻）', 'insertion', '先排不受限元素再插空保证不相邻。', '5 男 3 女排队女生互不相邻，几种排法？', 4, ['g5-c3-insertion-method'], ['g6-c3-bundling-method']],
    ['stars-bars', '隔板法（允许空）', 'stars-bars', '允许空盒时先借后还转化为正整数解。', '20 个苹果分给 4 人（可为空）几种分法？', 5, ['g5-c3-stars-bars'], ['g6-c2-diophantine-equation']],
    ['pigeonhole-principle', '抽屉原理（构造抽屉）', 'pigeonhole', '自造抽屉（按余数/状态分类）解决覆盖性问题。', '任意 5 个整数中必有两数之差是 4 的倍数。', 4, ['g5-c3-pigeonhole-principle'], ['g6-c3-worst-case-principle']],
    ['worst-case-principle', '最不利原则（复杂保证）', 'worst-case', '多层最不利叠加下保证结论的最少取数。', '四种花色牌各 13 张，至少取几张保证有同花色 5 张？', 4, ['g5-c3-worst-case-principle'], ['g6-c3-pigeonhole-principle']],
    ['inclusion-exclusion', '容斥原理（三集合）', 'inclusion-exclusion', '三集合容斥公式及变形（知并求交等）。', '|A∪B∪C|＝20，两两交集与全集给定时求三者都参加人数。', 5, ['g5-c9-inclusion-exclusion'], ['g6-c3-recursion-counting']],
    ['recursion-counting', '递推计数（斐波那契、爬楼梯）', 'recursion', '由小规模递推到大规模（爬楼梯、铺砖、传信）。', '上 10 级台阶每次跨 1 或 2 级，几种走法？', 5, ['g5-c3-enumeration-counting'], ['g6-c3-enumeration-counting']],
    ['derangement', '错排问题（初步）', 'derangement', '全部错位的排列数 D(n)：0,1,2,9,44,265…', '4 人互赠礼物全部拿错有几种方式？', 5, ['g5-c3-permutation'], ['g6-c3-inclusion-exclusion']],
    ['geometry-counting', '几何计数（三角形、矩形综合）', 'geometry-count', '网格长方形/正方形与组合图形的计数公式应用。', '3×5 方格网中长方形（含正方形）共几个？', 5, ['g5-c3-enumeration-counting'], ['g6-c3-recursion-counting']]
  ],
  C4: [
    ['area-basic', '基本面积（组合图形）', 'area-basic', '组合图形分割/添补求面积。', 'L 形组合图形的面积。', 3, ['g5-c4-area-basic'], ['g6-c4-equal-area-transform']],
    ['equal-area-transform', '等积变形（复杂平行线）', 'equal-area', '借助平行线多次转换三角形面积。', '平行线间蝶形面积相等的运用。', 4, ['g5-c4-equal-area-transform'], ['g6-c4-half-model']],
    ['bird-head-model', '鸟头模型（多比例）', 'bird-head', '多个鸟头模型串联的比例传递。', '两次共角比例求最终面积比。', 4, ['g5-c4-bird-head-model'], ['g6-c4-butterfly-model']],
    ['butterfly-model', '蝴蝶模型（任意四边形与梯形）', 'butterfly', '任意四边形与梯形中蝴蝶定理综合运用。', '由三块面积求第四块。', 4, ['g5-c4-butterfly-model'], ['g6-c4-swallow-tail-model']],
    ['swallow-tail-model', '燕尾模型（多组比例）', 'swallow-tail', '多组燕尾比例联立解面积比。', '三角形内两点连线分割的比例链。', 5, ['g5-c4-swallow-tail-model'], ['g6-c4-half-model']],
    ['half-model', '一半模型（复杂分割）', 'half', '复杂分割下一半模型的识别与叠加。', '平行四边形内多点连线的阴影占比。', 4, ['g5-c4-half-model'], ['g6-c4-bird-head-model']],
    ['circle-sector', '圆与扇形（组合、阴影面积）', 'circle', '圆弧组合图形的加减求阴影面积。', '正方形内内接圆剩余部分面积。', 4, ['g5-c4-circle-sector'], ['g6-c4-circle-angle']],
    ['solid-geometry', '立体图形（表面积、体积、切割）', 'solid', '立体切割/拼接后的表面积体积变化。', '正方体切一刀后表面积增加多少。', 4, ['g5-c4-solid-geometry'], ['g6-c4-solid-rotation']],
    ['painted-cube', '表面涂色问题（非正方体）', 'painted-cube', '长方体涂色切割的分类计数。', 'a×b×c 长方体涂色后各面涂色块数。', 4, ['g5-c4-painted-cube'], ['g6-c4-solid-geometry']],
    ['pythagorean-theorem', '勾股定理（逆定理与应用）', 'pythagorean', '勾股定理及其逆定理判定直角、折线最短。', '判定 6、8、10 与折叠最短问题。', 4, ['g5-c4-pythagorean-theorem'], ['g6-c4-lattice-area']],
    ['lattice-area', '格点面积（皮克定理应用）', 'lattice', '皮克定理在复杂格点多边形中的应用。', '内部 5 点边界 8 点的多边形面积。', 4, ['g5-c4-lattice-area'], ['g6-c4-angle-calculation']],
    ['angle-calculation', '角度计算（多边形、平行线）', 'angle', '多边形内角外角与平行线角度综合。', '五边形中已知四角求第五角。', 3, ['g5-c4-angle-calculation'], ['g6-c4-circle-angle']],
    ['circle-angle', '圆角度（圆心角、圆周角）', 'circle-angle', '圆周角定理：同弧圆周角为圆心角一半；直径所对圆周角 90°。', '圆心角 60° 所对弧的圆周角度数。', 4, ['g5-c4-circle-sector'], ['g6-c4-solid-rotation']],
    ['solid-rotation', '旋转体（圆柱、圆锥）', 'solid-rotation', '平面图形旋转成圆柱/圆锥后的体积表面积。', '长方形绕一边旋转一周所得圆柱体积。', 5, ['g5-c4-solid-geometry'], ['g6-c4-circle-angle']]
  ],
  C5: [
    ['basic-motion', '基本行程（比例关系）', 'basic', 's=vt 三量比例关系的熟练运用。', '速度比不变时路程比的计算。', 3, ['g5-c5-basic-motion'], ['g6-c5-meet-problem']],
    ['meet-problem', '相遇问题（多次相遇）', 'meet', '两端出发多次相遇的路程倍数规律。', '第二次相遇共行三个全程的应用。', 4, ['g5-c5-meet-problem'], ['g6-c5-chase-problem']],
    ['chase-problem', '追及问题（复杂追及）', 'chase', '多人/变速情形下的追及分析。', '环形道上三人追逐的相遇次数。', 4, ['g5-c5-chase-problem'], ['g6-c5-interval-departure']],
    ['train-bridge', '火车过桥（错车、超车）', 'train', '火车过桥、两车错车超车的路程合成。', '两列车错车所需时间。', 4, ['g5-c5-train-bridge'], ['g6-c5-boat-stream']],
    ['boat-stream', '流水行船（往返、水速变化）', 'boat', '顺逆水往返与平均速度、水速影响。', '往返全程平均速度与静水速度的关系。', 4, ['g5-c5-boat-stream'], ['g6-c5-ratio-motion']],
    ['circular-track', '环形跑道（多次相遇与追及）', 'circular', '环形多次相遇追及的圈数差分析。', '同地反向出发第 n 次相遇的路程。', 4, ['g5-c5-circular-track'], ['g6-c5-clock-problem']],
    ['clock-problem', '时钟问题（夹角、重合、对称）', 'clock', '时针分针夹角、重合与成直线时刻。', '2 点到 3 点之间时针分针重合时刻。', 4, ['g5-c5-clock-problem'], ['g6-c5-average-speed']],
    ['average-speed', '平均速度（分段与全程）', 'avg-speed', '分段行程的平均速度（调和平均思想）。', '前半程 v1 后半程 v2 的全程平均速度。', 4, ['g5-c5-average-speed'], ['g6-c5-ratio-motion']],
    ['ratio-motion', '比例行程（正反比综合）', 'ratio', '时间一定路程比＝速度比等比例推演。', '按速度比分程距离。', 5, ['g5-c5-ratio-motion'], ['g6-c5-interval-departure']],
    ['interval-departure', '发车间隔问题', 'interval-departure', '公交发车间隔与相遇/追上频率（2t₁t₂/(t₁+t₂) 等）。', '对面来车与背后超车间隔推算车速或间隔。', 5, ['g5-c5-meet-problem'], ['g6-c5-pick-up-problem']],
    ['pick-up-problem', '接送问题（往返接送）', 'pick-up', '一车载多队轮流接送同时到达的乘车比例。', '乘车路程占全程比例＝车速/(车速+人速)。', 5, ['g5-c5-meet-problem'], ['g6-c5-interval-departure']]
  ],
  C6: [
    ['work-problem', '工程问题（合作、休息、变速）', 'work', '合作中途休息、交替工作与效率变化的工程量核算。', '甲乙交替工作何时完成。', 4, ['g5-c6-work-problem'], ['g6-c6-concentration-problem']],
    ['concentration-problem', '浓度问题（混合、十字交叉）', 'concentration', '多次混合与十字交叉法求浓度比。', '两种浓度盐水混合的比例十字交叉。', 4, ['g5-c6-concentration-problem'], ['g6-c6-work-problem']]
  ],
  C7: [
    ['extract-common-factor', '提取公因数（复杂式子）', 'extract-factor', '复杂结构中的公因数提取与合并。', '3.6×31.4＋43.9×6.4 的巧算。', 3, ['g5-c7-extract-common-factor'], ['g6-c7-rounding-calc']],
    ['rounding-calc', '凑整巧算（分数小数）', 'rounding', '分数小数混合凑整。', '0.25×32×1.25 的速算。', 3, ['g5-c7-rounding-calc'], ['g6-c7-extract-common-factor']],
    ['fraction-splitting', '分数裂项（多级裂项）', 'frac-split', '多级/变式裂项相消求和。', '1/(2×4)＋1/(4×6)＋… 型求和。', 4, ['g5-c7-fraction-splitting'], ['g6-c7-integer-splitting']],
    ['integer-splitting', '整数裂项（高阶）', 'int-split', '高阶乘积和的裂项（平方差结构）。', '1×2×3＋2×3×4＋… 的裂项求和。', 4, ['g5-c7-integer-splitting'], ['g6-c7-fraction-splitting']],
    ['arithmetic-series', '等差数列（求和与项数应用）', 'series', '项数、公差、和之间的互求应用。', '某等差数列前 n 项和与项数互求。', 3, ['g5-c7-arithmetic-series'], ['g6-c7-sequence-sum']],
    ['recurring-decimal-frac', '循环小数化分数（混循环）', 'recurring', '混循环小数化分数的分子分母规则。', '0.2Ḟ3（23 循环）化分数。', 3, ['g5-c7-recurring-decimal-frac'], ['g6-c7-compare-size']],
    ['define-operation', '定义新运算（复杂规则）', 'define-op', '嵌套/复合的新运算求值与解方程。', 'a*b=a(b+1)，已知 3*x＝18 求 x。', 4, ['g5-c7-define-operation'], ['g6-c7-compare-size']],
    ['compare-size', '比较大小（放缩法）', 'compare', '放缩与中介基准比较复杂式子大小。', '比较 45/46 与 98/99 的大小。', 4, ['g5-c7-compare-size'], ['g6-c7-estimate-bounds']],
    ['estimate-bounds', '估算与放缩（精确整数部分）', 'estimate', '确定繁杂算式的整数部分。', '求 S=1/21+1/22+…+1/30 的整数部分。', 4, ['g5-c7-estimate-bounds'], ['g6-c7-complex-fraction']],
    ['complex-fraction', '繁分数化简（多层）', 'complex-frac', '多层繁分数逐层化简。', '三层繁分数的化简求值。', 4, ['g5-c7-complex-fraction'], ['g6-c7-fraction-splitting']],
    ['sequence-sum', '数列求和（平方和、立方和）', 'sequence-sum', 'Σi²=n(n+1)(2n+1)/6 与 Σi³=[n(n+1)/2]² 的应用。', '1²+2²+…+15² 等公式求和。', 5, ['g5-c7-arithmetic-series'], ['g6-c7-integer-splitting']]
  ],
  C8: [
    ['extremum-problem', '最值问题（均值、乘积最大）', 'extremum', '均值不等式思想与约束下的最值构造。', '和定条件下积最大的整数分配。', 4, ['g5-c8-extremum-problem'], ['g6-c8-winning-strategy']],
    ['logic-inference', '逻辑推理（多条件、表格法）', 'logic', '多条件组合的表格化排除推理。', '五人对号入座类表格推理题。', 4, ['g5-c8-logic-inference'], ['g6-c8-winning-strategy']],
    ['winning-strategy', '必胜策略（取石子、对称）', 'winning', '取石子博弈与对称策略的组合分析。', '双堆取石子的必胜策略。', 5, ['g5-c8-winning-strategy'], ['g6-c8-optimization']],
    ['optimization', '统筹优化（烙饼、排队、过桥）', 'optimization', '统筹安排最短时间（烙饼锅容量、排队顺序、多人过桥）。', '四人过桥手电筒问题的最短时间。', 4, ['g5-c8-extremum-problem'], ['g6-c8-extremum-problem']]
  ],
  C9: [
    ['sum-diff-problem', '和差倍问题（复杂线段图）', 'sum-diff', '多对象和差倍的线段图分析。', '三个量的和差倍联立。', 3, ['g5-c9-sum-diff-problem'], ['g6-c9-age-problem']],
    ['age-problem', '年龄问题（列表方程）', 'age', '列表追踪多年份年龄倍数关系。', '列表法解几年前/几年后的倍数。', 4, ['g5-c9-age-problem'], ['g6-c9-sum-diff-problem']],
    ['profit-loss-problem', '盈亏问题（复杂分配）', 'profit-loss', '两种方案盈亏相抵的推广形式。', '三次分配方案的转化。', 4, ['g5-c9-profit-loss-problem'], ['g6-c9-average-problem']],
    ['chicken-rabbit', '鸡兔同笼（变形：倒扣、得分）', 'chicken-rabbit', '倒扣得分、答对答错等变形假设法。', '竞赛计分规则下的答对题数。', 4, ['g5-c9-chicken-rabbit'], ['g6-c9-average-problem']],
    ['average-problem', '平均数（移多补少、加权）', 'average', '加权平均与移多补少思想。', '两组人数不同的平均合并。', 3, ['g5-c9-average-problem'], ['g6-c9-periodic-problem']],
    ['planting-problem', '植树问题（封闭与不封闭综合）', 'planting', '封闭/单侧/双侧栽树的综合应用。', '圆形水池边栽树的棵数。', 3, ['g5-c9-planting-problem'], ['g6-c9-phalanx-problem']],
    ['phalanx-problem', '方阵问题（空心、实心）', 'phalanx', '空心方阵层数与总数的换算。', '空心方阵已知外层求总人数。', 4, ['g5-c9-phalanx-problem'], ['g6-c9-planting-problem']],
    ['periodic-problem', '周期问题（复杂周期）', 'periodic', '多事物交错的大周期分析。', '日期与星期对应的周期推算。', 3, ['g5-c9-periodic-problem'], ['g6-c9-grass-problem']],
    ['grass-problem', '牛吃草问题（多块草地）', 'grass', '不同面积草地的牛吃草换算。', '甲草地吃 12 天乙草地吃 20 天求第三块。', 5, ['g5-c9-grass-problem'], ['g6-c9-fraction-percent-application']],
    ['fraction-percent-application', '分数百分数应用题（综合）', 'frac-percent', '多步分数百分数的综合应用。', '涨价又打折后的价格变化率。', 4, ['g5-c9-fraction-percent-application'], ['g6-c9-economics-problem']],
    ['economics-problem', '经济问题（折扣、利润最大化）', 'economics', '折扣利润综合与最优定价初步。', '不同折扣方案利润比较。', 4, ['g5-c9-economics-problem'], ['g6-c9-fraction-percent-application']],
    ['equation-linear-1', '一元一次方程（应用题）', 'eq1', '设未知数列方程解应用题。', '行程/工程类列方程求解。', 3, ['g5-c9-equation-linear-1'], ['g6-c9-equation-linear-2']],
    ['equation-linear-2', '二元一次方程组（应用题）', 'eq2', '设两个未知数列方程组解应用题。', '鸡兔同笼方程组建模。', 4, ['g5-c9-equation-linear-2'], ['g6-c2-diophantine-equation']],
    ['ratio-application', '比例应用题（按比例分配、正反比例）', 'ratio', '按比例分配与正反比例的判定和应用。', '按 3:5 分配奖金或反比例分工。', 5, ['g5-c5-ratio-motion'], ['g6-c9-mixture-problem']],
    ['mixture-problem', '混合问题（平均价、合金）', 'mixture', '平均价与合金成分的混合计算。', '两种糖果混合后的平均价。', 5, ['g5-c6-concentration-problem'], ['g6-c9-ratio-application']]
  ]
};

// ============ 序列化（与迁移脚本同款，保证整库确定性输出）============
function jsStr(v) { return JSON.stringify(String(v == null ? '' : v)); }
function serPoint(p) {
  const props = [
    '              id: ' + jsStr(p.id),
    '              name: ' + jsStr(p.name),
    '              pluginId: ' + jsStr(p.pluginId),
    '              weight: ' + p.weight,
    '              type: ' + jsStr(p.type),
    '              description: ' + jsStr(p.description),
    '              example: ' + jsStr(p.example),
    '              prerequisites: ' + JSON.stringify(p.prerequisites),
    '              related: ' + JSON.stringify(p.related),
    '              difficulty: ' + p.difficulty,
    '              status: ' + jsStr(p.status)
  ];
  return '            {\n' + props.join(',\n') + '\n            }';
}
function serModule(m) {
  const points = m.knowledgePoints.map(serPoint);
  return '        {\n' +
    '          moduleId: ' + jsStr(m.moduleId) + ',\n' +
    '          knowledgePoints: [\n' + points.join(',\n') + '\n' +
    '          ]\n' +
    '        }';
}
function serGrade(g) {
  const modules = g.modules.map(serModule);
  return '    // ========== 年级' + g.grade + ' ==========\n' +
    '    {\n' +
    '      grade: ' + g.grade + ',\n' +
    '      modules: [\n' + modules.join(',\n') + '\n' +
    '      ]\n' +
    '    }';
}

function main() {
  const bak = path.join(__dirname, '..', 'archive', 'knowledge-bank-pre-g6comp-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.js');
  fs.copyFileSync(KB_FILE, bak);

  const byModule = {};
  let total = 0;
  Object.keys(ENTRIES).forEach(mid => {
    byModule[mid] = ENTRIES[mid].map(r => ({
      id: 'g6-' + mid.toLowerCase() + '-' + r[0], name: r[1], pluginId: P, weight: W, type: r[2],
      description: r[3], example: r[4], difficulty: r[5],
      prerequisites: r[6], related: r[7], status: ST
    }));
    total += ENTRIES[mid].length;
  });

  const g6 = KB.find(e => e.grade === 6);
  if (!g6) throw new Error('未找到六年级条目');
  g6.modules = g6.modules.filter(m => !/^C/.test(m.moduleId));
  Object.keys(byModule).forEach(mid => g6.modules.push({ moduleId: mid, knowledgePoints: byModule[mid] }));
  console.log('六年级竞赛新条目数:', total);

  const src = fs.readFileSync(KB_FILE, 'utf8');
  const marker = 'var KnowledgeBank = [';
  const arrStart = src.indexOf(marker);
  let depth = 0, quote = null, j = arrStart + marker.indexOf('[');
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) { if (c === '\\') { j++; continue; } if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '/' && src[j + 1] === '/') { while (j < src.length && src[j] !== '\n') j++; continue; }
    if (c === '/' && src[j + 1] === '*') { j += 2; while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) j++; j++; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') { depth--; if (depth === 0) break; }
  }
  const semi = src.indexOf(';', j);
  if (depth !== 0 || semi === -1) throw new Error('数组边界定位失败');
  fs.writeFileSync(KB_FILE, src.slice(0, arrStart) + 'var KnowledgeBank = [\n' + KB.map(serGrade).join(',\n') + '\n  ];' + src.slice(semi + 1), 'utf8');
  console.log('已写回', KB_FILE);
}

main();
