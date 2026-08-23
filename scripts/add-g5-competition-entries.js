// scripts/add-g5-competition-entries.js
// 将五年级竞赛模块 C1~C9 重建为 79 个新语义 slug 条目（全部 status:'placeholder'，指向通用占位插件）。
// 依据：docs/g5-competition-knowledge-map.md。替换原有 33 个旧 slug 条目（删旧留新）。
// 用法：node scripts/add-g5-competition-entries.js
'use strict';

const fs = require('fs');
const path = require('path');

const KB_FILE = path.join(__dirname, '..', 'shared', 'knowledge-bank.js');
const KB = require(KB_FILE);

const PLACEHOLDER = 'math-competition-placeholder';
const W = 1;
const ST = 'placeholder';
const P = PLACEHOLDER;

// ============ 79 个知识点数据（id, name, type, description, example, difficulty, prerequisites, related）============
const ENTRIES = {
  C1: [
    ['g5-c1-digit-puzzle-vertical', '竖式谜', 'vertical', '在加减乘除竖式的 □ 中填数字使竖式成立，练习位值与进位借位推理。', '在 □ 中填数字使竖式成立：3□＋□5＝88。', 3, ['g4-c1-c1-vertical'], ['g5-c1-digit-puzzle-horizontal']],
    ['g5-c1-digit-puzzle-horizontal', '横式谜', 'horizontal', '在等式 □ 中填入合适的数或运算符号，使等式成立。', '在 □ 填数字使等式成立：□×3＋4＝25。', 3, ['g4-c1-c1-horizontal'], ['g5-c1-digit-puzzle-vertical', 'g5-c1-digit-puzzle-symbol']],
    ['g5-c1-digit-puzzle-symbol', '字母符号代表数', 'symbol', '用图形或字母代表数字，通过等式关系推出各符号代表的数（位值原理）。', '已知 a×b＝18，a＋b＝9（a＞b），求 a、b。', 4, ['g4-c1-c1-symbol'], ['g5-c1-digit-puzzle-vertical', 'g5-c2-place-value']],
    ['g5-c1-number-array-closed', '封闭型数阵', 'array-closed', '将数填入封闭图形（三角形、四边形）的各交点上，使每条边上的和相等。', '把 1~6 填入六边形每条边的 3 个点，使每条边的和相等。', 4, ['g4-c1-c1-array'], ['g5-c1-number-array-radial']],
    ['g5-c1-number-array-radial', '辐射型数阵', 'array-radial', '将数填入辐射型数阵，使各条线上的和相等，确定中心数与配对数。', '把 1~7 填入辐射型数阵，使每条线上的三数和相等。', 4, ['g4-c1-c1-array'], ['g5-c1-number-array-closed', 'g5-c1-number-array-composite']],
    ['g5-c1-number-array-composite', '复合型数阵', 'array-composite', '综合封闭型与辐射型的复合数阵，多条件约束下填数求最优解。', '复合数阵中确定使各线和相等的最小中心数。', 5, ['g4-c1-c1-array'], ['g5-c1-number-array-closed', 'g5-c1-magic-square-3']],
    ['g5-c1-magic-square-3', '三阶幻方', 'magic3', '将 1~9 填入 3×3 方格，使每行、每列、两条对角线的和相等（＝15）。', '补全三阶幻方，使每行每列对角线和为 15。', 3, ['g4-c1-c1-magic'], ['g5-c1-number-array-composite', 'g5-c1-magic-square-4']],
    ['g5-c1-magic-square-4', '四阶幻方初步', 'magic4', '将连续自然数填入 4×4 方格构成幻方，认识幻和与构造方法。', '将 1~16 填入 4×4 方格，使每行每列对角线和相等。', 4, ['g4-c1-c1-magic'], ['g5-c1-magic-square-3']]
  ],
  C2: [
    ['g5-c2-divisibility', '整除特征', 'divisibility', '掌握 2、3、5、9 等常见整数的整除特征，快速判断整除性。', '判断 12345 能否被 3 整除。', 3, ['g4-c2-c2-divisible'], ['g5-c2-gcd-lcm', 'g5-c2-factor-count-sum']],
    ['g5-c2-parity-analysis', '奇偶分析', 'parity', '利用奇偶性（奇＋奇＝偶等）推理运算结果或锁定答案范围。', '三个连续自然数之积是奇数还是偶数？', 4, ['g4-c2-c2-parity'], ['g5-c2-remainder-congruence']],
    ['g5-c2-prime-composite', '质数与合数', 'prime', '认识质数与合数，掌握 100 以内质数表与判断方法。', '判断 91 是质数还是合数。', 3, ['g4-c2-c2-prime'], ['g5-c2-prime-factorization']],
    ['g5-c2-prime-factorization', '分解质因数', 'prime-factor', '用短除法把合数分解为质因数乘积（如 60＝2²×3×5）。', '分解质因数：72＝？', 3, ['g4-c2-c2-prime'], ['g5-c2-factor-count-sum', 'g5-c2-gcd-lcm', 'g5-c2-perfect-square']],
    ['g5-c2-factor-count-sum', '因数个数与因数和', 'factor-count', '由标准分解式求因数个数（指数＋1 连乘）与因数和公式。', '72 有多少个因数？', 4, ['g4-c2-c2-factor'], ['g5-c2-perfect-square', 'g5-c2-number-theory-extreme']],
    ['g5-c2-gcd-lcm', '最大公因数与最小公倍数', 'gcd-lcm', '用短除法 / 分解质因数求最大公因数与最小公倍数。', '求 24 和 36 的最大公因数与最小公倍数。', 3, ['g4-c2-c2-factor'], ['g5-c2-divisibility']],
    ['g5-c2-remainder-congruence', '余数与同余', 'remainder', '带余除法与同余概念，解「除以某数余几」类问题。', '一个数除以 7 余 3、除以 9 余 3，最小是几？', 4, ['g4-c2-c2-remainder'], ['g5-c2-parity-analysis', 'g5-c2-number-theory-extreme']],
    ['g5-c2-place-value', '位值原理', 'place', '利用数字所在数位的值（位值）进行推理与代换。', '一个两位数，十位与个位互换后比原数大 18，求原数。', 4, ['g4-c2-c2-place'], ['g5-c1-digit-puzzle-symbol']],
    ['g5-c2-perfect-square', '完全平方数', 'perfect-square', '识别完全平方数，利用质因数指数均为偶数判断。', '判断 144 是完全平方数吗？', 4, ['g4-c2-c2-factor'], ['g5-c2-prime-factorization', 'g5-c2-number-theory-extreme']],
    ['g5-c2-number-theory-extreme', '数论最值', 'nt-extreme', '综合数论知识求最大 / 最小值（如因数个数、和一定积最大等）。', 'n 恰有 6 个因数且 n 最小，求 n。', 5, ['g4-c2-c2-factor'], ['g5-c2-perfect-square', 'g5-c9-diophantine-equation']]
  ],
  C3: [
    ['g5-c3-addition-principle', '加法原理', 'add-principle', '分类完成一件事，方法数＝各类方法数之和。', '从书架任取一本书，语文 5 本数学 3 本，共几种取法？', 3, ['g4-c3-c3-am'], ['g5-c3-multiplication-principle']],
    ['g5-c3-multiplication-principle', '乘法原理', 'mult-principle', '分步完成一件事，方法数＝各步方法数之积。', '穿 3 件上衣 ×2 条裤子，共几种搭配？', 3, ['g4-c3-c3-am'], ['g5-c3-addition-principle', 'g5-c3-permutation']],
    ['g5-c3-permutation', '排列数', 'permutation', '从 n 个不同元素取出 m 个按顺序排列，方法数＝P(n,m)。', '3 人站成一排，有几种站法？', 4, ['g4-c3-c3-perm'], ['g5-c3-combination', 'g5-c3-bundling-method']],
    ['g5-c3-combination', '组合数', 'combination', '从 n 个不同元素取出 m 个不分顺序成组，方法数＝C(n,m)。', '从 5 人中选 2 人组成小组，有几种选法？', 4, ['g4-c3-c3-perm'], ['g5-c3-permutation', 'g5-c3-stars-bars']],
    ['g5-c3-enumeration-counting', '枚举计数', 'enumeration', '有序列举所有可能，做到不重不漏（分类讨论）。', '用 1、2、3 组成无重复数字的两位数有几种？', 3, ['g4-c3-c3-enum'], ['g5-c9-chicken-rabbit']],
    ['g5-c3-bundling-method', '捆绑法', 'bundling', '要求某些元素相邻时，把它们看作一个整体（捆绑）再排列。', '甲乙相邻排成一排（共 4 人），有几种排法？', 4, ['g4-c3-c3-perm'], ['g5-c3-insertion-method']],
    ['g5-c3-insertion-method', '插空法', 'insertion', '要求某些元素不相邻时，先排其余元素再用空位插空。', '4 男 2 女，女生不相邻，有几种排法？', 4, ['g4-c3-c3-perm'], ['g5-c3-bundling-method']],
    ['g5-c3-stars-bars', '隔板法', 'stars-bars', '将 n 个相同物品分给 k 个不同对象（每份至少一个），用隔板隔开计数。', '把 5 个相同苹果分给 3 个小朋友，每人至少 1 个，有几种分法？', 5, ['g4-c3-c3-perm'], ['g5-c3-combination', 'g5-c9-diophantine-equation']],
    ['g5-c3-pigeonhole-principle', '抽屉原理', 'pigeonhole', 'n＋1 个物体放 n 个抽屉必有一个至少 2 个，并推广至更一般形式。', '13 人中必有两个生日在同一个月，为什么？', 4, ['g4-c3-c3-worst'], ['g5-c3-worst-case-principle']],
    ['g5-c3-worst-case-principle', '最不利原则', 'worst-case', '考虑最坏情况（尽量平均 / 不利）再＋1，保证结论成立。', '袋中有红黄蓝球各 5 个，至少取几个保证有两球同色？', 4, ['g4-c3-c3-worst'], ['g5-c3-pigeonhole-principle']]
  ],
  C4: [
    ['g5-c4-area-basic', '基本面积公式', 'area-basic', '熟练三角形、平行四边形、梯形等基本面积公式与底高对应。', '底 8 高 5 的三角形面积＝？', 3, ['g4-c4-c4-pa'], ['g5-c4-equal-area-transform']],
    ['g5-c4-equal-area-transform', '等积变形', 'equal-area', '利用同底等高（等底等高）变换面积关系解题。', '等底等高的三角形面积一定相等，据此求面积。', 4, ['g4-c4-c4-cutfill'], ['g5-c4-half-model', 'g5-c4-bird-head-model']],
    ['g5-c4-bird-head-model', '鸟头模型', 'bird-head', '两个三角形有一角相等或互补，面积比等于夹该角两边乘积之比。', '三角形 ABC 中 AD:DB＝2:3，AE:EC＝1:4，求 S△ADE:S△ABC。', 4, ['g4-c4-c4-pa'], ['g5-c4-butterfly-model', 'g5-c4-half-model']],
    ['g5-c4-butterfly-model', '蝴蝶模型', 'butterfly', '梯形 / 任意四边形对角线分出的面积关系（蝴蝶定理）。', '梯形中两对角线分出的上下三角形面积之积＝左右面积之积。', 4, ['g4-c4-c4-pa'], ['g5-c4-swallow-tail-model', 'g5-c4-bird-head-model']],
    ['g5-c4-swallow-tail-model', '燕尾模型', 'swallow-tail', '三角形内一点连线分割，利用面积比与线段比互推（燕尾定理）。', '由燕尾定理求面积比或线段比。', 5, ['g4-c4-c4-pa'], ['g5-c4-butterfly-model', 'g5-c4-half-model']],
    ['g5-c4-half-model', '一半模型', 'half', '利用「面积一半」模型（如平行四边形中三角形占一半）求面积。', '平行四边形内任取一点连到四顶点，中间三角形占总面积多少？', 4, ['g4-c4-c4-pa'], ['g5-c4-bird-head-model']],
    ['g5-c4-circle-sector', '圆与扇形', 'circle', '圆周长 / 面积与扇形弧长 / 面积公式，及组合图形应用。', 'r＝3 的圆面积＝？（π 取 3.14）', 3, ['g4-c4-c4-pa'], ['g5-c4-angle-calculation']],
    ['g5-c4-solid-geometry', '立体图形表面积与体积', 'solid', '长方体、正方体、圆柱、圆锥的表面积与体积计算。', '棱长 3 的正方体体积＝？', 4, ['g4-c4-c4-solid'], ['g5-c4-painted-cube']],
    ['g5-c4-painted-cube', '表面涂色问题', 'painted-cube', '正方体表面涂色后切分，分类计数三面 / 两面 / 一面 / 无色小正方体。', '3×3×3 涂色后切开，一面涂色的有几个？', 4, ['g4-c4-c4-solid'], ['g5-c4-solid-geometry']],
    ['g5-c4-pythagorean-theorem', '勾股定理', 'pythagorean', '直角三角形两直角边平方和等于斜边平方（a²＋b²＝c²）。', '直角边 3、4，斜边＝？', 4, ['g4-c4-c4-pa'], ['g5-c4-lattice-area', 'g5-c4-angle-calculation']],
    ['g5-c4-lattice-area', '格点面积', 'lattice', '在方格纸上用割补 / 公式求格点多边形面积。', '数格子求格点多边形面积。', 3, ['g4-c4-c4-pa'], ['g5-c4-pythagorean-theorem']],
    ['g5-c4-angle-calculation', '角度计算', 'angle', '利用三角形内角和、角平分线、外角等关系求角度。', '三角形两角为 40°、70°，第三角＝？', 3, ['g4-c4-c4-angle'], ['g5-c4-circle-sector']]
  ],
  C5: [
    ['g5-c5-basic-motion', '基本行程', 'basic', '路程＝速度×时间三者互求，注意单位统一。', '速度 5 米/秒走 20 秒，路程＝？', 3, ['g4-c5-c5-basic'], ['g5-c5-meet-problem', 'g5-c5-chase-problem']],
    ['g5-c5-meet-problem', '相遇问题', 'meet', '相向而行，相遇时间＝路程和÷速度和。', '相距 120 米，速度和 12 米/秒，几秒相遇？', 3, ['g4-c5-c5-meet'], ['g5-c5-chase-problem', 'g5-c5-circular-track']],
    ['g5-c5-chase-problem', '追及问题', 'chase', '同向而行，追及时间＝路程差÷速度差。', '速度差 3 米/秒、路程差 60 米，几秒追上？', 4, ['g4-c5-c5-chase'], ['g5-c5-meet-problem', 'g5-c5-clock-problem']],
    ['g5-c5-train-bridge', '火车过桥', 'train', '过桥 / 隧道总路程＝桥长＋车长。', '车长 100 米过 300 米桥，速度 20 米/秒，需几秒？', 4, ['g4-c5-c5-train'], ['g5-c5-boat-stream']],
    ['g5-c5-boat-stream', '流水行船', 'boat', '顺水速＝船速＋水速，逆水速＝船速−水速。', '船速 10 水速 2，顺水速度＝？', 4, ['g4-c5-c5-river'], ['g5-c5-circular-track']],
    ['g5-c5-circular-track', '环形跑道', 'circular', '环形跑道相遇 / 追及，考虑同向与反向。', '环形跑道 400 米，同向速度差下追及一圈的时间。', 4, ['g4-c5-c5-meet'], ['g5-c5-meet-problem', 'g5-c5-ratio-motion']],
    ['g5-c5-clock-problem', '时钟问题', 'clock', '时针分针视为追及运动（分针 6°/分，时针 0.5°/分）。', '3 点后时针分针首次重合是几分钟后？', 4, ['g4-c5-c5-chase'], ['g5-c5-circular-track']],
    ['g5-c5-average-speed', '平均速度', 'avg-speed', '平均速度＝总路程÷总时间（≠速度求平均）。', '去 4 米/秒回 6 米/秒，全程平均速度＝？', 4, ['g4-c5-c5-basic'], ['g5-c5-ratio-motion']],
    ['g5-c5-ratio-motion', '比例行程', 'ratio', '利用速度比＝时间反比等比例关系解行程。', '时间比 3:2，速度比＝？', 5, ['g4-c5-c5-basic'], ['g5-c5-average-speed', 'g5-c9-fraction-percent-application']]
  ],
  C6: [
    ['g5-c6-work-problem', '工程问题', 'work', '把总工作量看作单位 1，效率＝1÷时间，合作效率＝效率和。', '甲 6 天完成、乙 3 天完成，合作几天完成？', 4, ['g3-m4-g3-fraction'], ['g5-c6-concentration-problem', 'g5-c5-basic-motion']],
    ['g5-c6-concentration-problem', '浓度问题', 'concentration', '溶质 / 溶液 / 浓度关系，混合后浓度＝溶质总量÷溶液总量。', '10% 盐水 200g，加多少水变 5%？', 4, ['g3-m4-g3-fraction'], ['g5-c6-work-problem', 'g5-c9-fraction-percent-application']]
  ],
  C7: [
    ['g5-c7-extract-common-factor', '提取公因数', 'extract-factor', '提取相同因数，逆用乘法分配律简化计算。', '3.5×4＋3.5×6＝？', 3, ['g4-m3-g4-mix-dist'], ['g5-c7-rounding-calc', 'g5-c7-fraction-splitting']],
    ['g5-c7-rounding-calc', '凑整巧算', 'rounding', '把数凑成整十整百再计算（如 99＋57＝100＋56）。', '用凑整法计算 98＋57。', 3, ['g4-m3-g4-mix-order'], ['g5-c7-extract-common-factor']],
    ['g5-c7-fraction-splitting', '分数裂项', 'frac-split', '把分数拆成两分数之差，相邻项相消（裂项相消）。', '1/2＋1/6＋1/12＋…＋1/90＝？', 4, ['g3-m4-g3-fraction'], ['g5-c7-integer-splitting', 'g5-c7-complex-fraction']],
    ['g5-c7-integer-splitting', '整数裂项', 'int-split', '把整数 / 整数积拆项相消（差分形式）。', '1×2＋2×3＋…＋9×10＝？', 4, ['g4-m3-g4-mix-dist'], ['g5-c7-fraction-splitting']],
    ['g5-c7-arithmetic-series', '等差数列', 'series', '等差数列通项与求和：末项＝首项＋(n−1)d，和＝(首＋末)×n÷2。', '求 1＋3＋5＋…＋19。', 3, ['g1-m4-patterns'], ['g5-c9-periodic-problem']],
    ['g5-c7-recurring-decimal-frac', '循环小数化分数', 'recurring', '循环小数化分数：纯循环 / 混循环的分子分母规则。', '0.3（3 循环）＝？', 3, ['g3-m4-g3-decimal'], ['g5-c7-complex-fraction']],
    ['g5-c7-define-operation', '定义新运算', 'define-op', '按新定义运算规则代入计算（如 a*b＝a×b−a＋b）。', '定义 a*b＝a×b＋a＋b，求 2*3。', 3, ['g4-m3-g4-mix-order'], ['g5-c7-estimate-bounds']],
    ['g5-c7-compare-size', '比较大小', 'compare', '分数 / 小数 / 算式比较大小：通分、交叉相乘或估算。', '比较 5/8 与 3/5 的大小。', 3, ['g3-m4-g3-fraction'], ['g5-c7-estimate-bounds']],
    ['g5-c7-estimate-bounds', '估算与放缩', 'estimate', '用估值与放缩确定范围，用于比较与证明。', '估计若干真分数之和的范围。', 4, ['g4-m12-g4-choice-est'], ['g5-c7-complex-fraction', 'g5-c7-compare-size']],
    ['g5-c7-complex-fraction', '繁分数化简', 'complex-frac', '多层分数的化简：从最内层逐层通分，除以分数乘其倒数。', '化简 1/(1＋1/2)。', 4, ['g3-m4-g3-fraction'], ['g5-c7-fraction-splitting', 'g5-c7-recurring-decimal-frac']]
  ],
  C8: [
    ['g5-c8-extremum-problem', '最值问题', 'extremum', '求最大 / 最小值：和一定积最大、差越小积越大等。', '两数和为 10，积最大是多少？', 4, ['g4-c8-c8-extreme'], ['g5-c2-number-theory-extreme', 'g5-c3-worst-case-principle']],
    ['g5-c8-logic-inference', '逻辑推理', 'logic', '列表法、假设法、排除法综合多个条件推理。', '甲乙丙三人中只有一人说真话，推理谁是作案者。', 4, ['g4-c8-c8-logic'], ['g5-c9-inclusion-exclusion']],
    ['g5-c8-winning-strategy', '必胜策略', 'winning', '对策论：找制胜点与必胜策略（对称、取余等）。', '取石子游戏（每次 1~3 颗，取最后一颗胜），先手必胜策略？', 5, ['g4-c8-c8-logic'], ['g5-c3-pigeonhole-principle', 'g5-c8-extremum-problem']]
  ],
  C9: [
    ['g5-c9-sum-diff-problem', '和差倍问题', 'sum-diff', '已知和与差（或倍）求各数：大数＝(和＋差)÷2。', '两数和 30 差 6，各是几？', 3, ['g4-m8-g4-word-div'], ['g5-c9-age-problem', 'g5-c9-chicken-rabbit']],
    ['g5-c9-age-problem', '年龄问题', 'age', '年龄差不变，利用差倍关系求各年龄。', '父 35 岁子 5 岁，几年后父亲年龄是子的 3 倍？', 4, ['g4-m8-g4-word-div'], ['g5-c9-sum-diff-problem']],
    ['g5-c9-profit-loss-problem', '盈亏问题', 'profit-loss', '两种分配方案盈亏相抵，求人数与总数。', '每人 5 个多 3 个，每人 7 个少 5 个，共几人？', 4, ['g4-m8-g4-word-div'], ['g5-c9-chicken-rabbit', 'g5-c9-average-problem']],
    ['g5-c9-chicken-rabbit', '鸡兔同笼', 'chicken-rabbit', '已知头数与脚数求鸡兔数（假设法）。', '笼中共 35 头 94 脚，鸡兔各几只？', 4, ['g4-m8-g4-word-cr'], ['g5-c9-sum-diff-problem', 'g5-c9-profit-loss-problem']],
    ['g5-c9-average-problem', '平均数问题', 'average', '总数÷份数＝平均数，移多补少思想。', '三个数和为 60，平均数＝？', 3, ['g4-m8-g4-word-avg'], ['g5-c9-profit-loss-problem']],
    ['g5-c9-planting-problem', '植树问题', 'planting', '两端都栽 / 只栽一端 / 两端不栽时棵数与间隔数关系。', '100 米每隔 5 米种一棵（两端都栽），种几棵？', 3, ['g1-m4-patterns'], ['g5-c9-phalanx-problem']],
    ['g5-c9-phalanx-problem', '方阵问题', 'phalanx', '实心 / 空心方阵：每层边数差 2，实心总数＝边数²。', '5×5 实心方阵共多少人？', 4, ['g4-m8-g4-word-div'], ['g5-c9-planting-problem']],
    ['g5-c9-periodic-problem', '周期问题', 'periodic', '找周期与余数，确定第 n 个 / 某位置的状态。', '红黄蓝循环排列，第 20 个是什么颜色？', 3, ['g1-m4-patterns'], ['g5-c7-arithmetic-series']],
    ['g5-c9-grass-problem', '牛吃草问题', 'grass', '草每天匀速生长，牛吃草与生长量共同变化（总量＝原有＋生长）。', '牛吃草问题中求原有草量或可养牛头数。', 5, [], ['g5-c6-work-problem', 'g5-c9-fraction-percent-application']],
    ['g5-c9-fraction-percent-application', '分数百分数应用题', 'frac-percent', '求一个数的几分之几 / 百分之几，已知部分求整体，及增减变化。', '一件衣服原价 100 元打八折后多少元？', 4, ['g3-m4-g3-fraction'], ['g5-c6-work-problem', 'g5-c6-concentration-problem', 'g5-c5-ratio-motion']],
    ['g5-c9-economics-problem', '经济问题', 'economics', '进价 / 售价 / 利润 / 利润率与折扣关系。', '进价 80 售价 100，利润率＝？', 4, ['g3-m4-g3-fraction'], ['g5-c9-fraction-percent-application', 'g5-c9-equation-linear-1']],
    ['g5-c9-inclusion-exclusion', '容斥原理', 'inclusion-exclusion', '两集合 / 三集合容斥：总数＝A∪B＝A＋B−A∩B。', '喜欢数学 30 人、语文 25 人、两科都喜 10 人，至少喜一科几人？', 5, ['g4-c3-c3-enum'], ['g5-c3-addition-principle', 'g5-c8-logic-inference']],
    ['g5-c9-equation-linear-1', '一元一次方程（工具）', 'eq1', '设未知数列一元一次方程并求解（工具知识点）。', '解方程 2x＋3＝11。', 3, ['g4-m4-g4-fill-op'], ['g5-c9-equation-linear-2', 'g5-c5-ratio-motion']],
    ['g5-c9-equation-linear-2', '二元一次方程组（工具）', 'eq2', '消元法（代入 / 加减）解二元一次方程组（工具知识点）。', '解方程组 x＋y＝5，x−y＝1。', 4, ['g4-m4-g4-fill-op'], ['g5-c9-diophantine-equation']],
    ['g5-c9-diophantine-equation', '不定方程整数解（C9/C2）', 'diophantine', '不定方程的整数解（枚举试解 / 整除分析），用于数论最值（与 C2 共用）。', '求 2x＋3y＝11 的正整数解。', 5, ['g4-m4-g4-fill-op'], ['g5-c2-number-theory-extreme', 'g5-c3-stars-bars']]
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

// ============ 主流程 ============
function main() {
  // 备份
  const bak = path.join(__dirname, '..', 'archive', 'knowledge-bank-pre-g5comp-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.js');
  fs.copyFileSync(KB_FILE, bak);

  // 构造 79 个知识点对象
  const byModule = {};
  Object.keys(ENTRIES).forEach(mid => {
    byModule[mid] = ENTRIES[mid].map(r => ({
      id: r[0], name: r[1], pluginId: P, weight: W, type: r[2],
      description: r[3], example: r[4], difficulty: r[5],
      prerequisites: r[6], related: r[7], status: ST
    }));
  });

  // 修改五年级：删旧 C 模块，追加新 C1~C9（M 模块顺序保留）
  const g5 = KB.find(e => e.grade === 5);
  g5.modules = g5.modules.filter(m => !/^C/.test(m.moduleId));
  Object.keys(byModule).forEach(mid => g5.modules.push({ moduleId: mid, knowledgePoints: byModule[mid] }));

  let total = 0;
  Object.keys(byModule).forEach(mid => total += byModule[mid].length);
  console.log('五年级竞赛新条目数:', total);

  // 序列化 + 拼接回文件（保留 IIFE 与辅助函数）
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
  const newArray = 'var KnowledgeBank = [\n' + KB.map(serGrade).join(',\n') + '\n  ];';
  fs.writeFileSync(KB_FILE, src.slice(0, arrStart) + newArray + src.slice(semi + 1), 'utf8');
  console.log('已写回', KB_FILE);
}

main();
