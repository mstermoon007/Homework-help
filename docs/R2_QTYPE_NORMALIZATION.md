# R2 题型规范化映射草案

> 依据：`docs/AI_REFACTOR_PLAN.html` R2「改写 G2-G6 + cn/en 非 canonical 题型为 canonical（保留 rawType 审计字段）」；
> 授权：Q5（按语义归类出草案）；Q4 已定 `picture→calc`；SSOT 原则：`question-type-registry` 为真源，registry 显式别名语义合理即采用，启发式/悬空/误判经覆盖表纠偏。

**统计**：非 canonical 326 种 / 525 实例（全库 574 KP、614 题型值）。

| 原值 | 实例 | canonical | 判定来源 | 依据 | 示例 KP |
|---|---|---|---|---|---|
| mix | 18 | calc | registry:explicit | registry 别名 | math-g3-m4-g3-measure（测量） |
| angle | 8 | geometry | registry:explicit | registry 别名 | math-g2-m4-angle-basic（角的基本组成） |
| operate | 7 | oral | registry:explicit | registry 别名 | math-g1-m6-solid-shape（立体图形特征） |
| circle | 7 | geometry | registry:explicit | registry 别名 | math-g5-c4-circle-sector（圆与扇形） |
| remainder | 6 | calc | registry:explicit | registry 别名 | math-g2-m1-remainder-oral（有余数除法口算） |
| mixed | 6 | calc | registry:explicit | registry 别名 | math-g2-m1-mixed-addsub（加减混合运算） |
| solid | 6 | geometry | registry:explicit | registry 别名 | math-g2-m6-solid-shape（认识图形） |
| logic | 6 | apply | 覆盖 | 逻辑推理=应用类 | math-g2-m10-logic-reasoning（简单逻辑推理） |
| compare | 5 | recognize | registry:explicit | registry 别名 | math-g2-m3-compare-simple（比较算式大小） |
| add | 4 | calc | registry:explicit | registry 别名 | math-g2-m1-add-100（100以内加法） |
| sub | 4 | calc | registry:explicit | registry 别名 | math-g2-m1-sub-100（100以内减法） |
| mult | 4 | calc | registry:explicit | registry 别名 | math-g2-m1-mult-table（表内乘法） |
| clock | 4 | recognize | 覆盖 | 时间认读=认识类（非几何） | math-g2-m4-clock-read（时间认读） |
| factor-multiple | 4 | apply | 覆盖 | 因数倍数特征判断=数论应用（非几何） | math-g5-m1-g5-oral-fm（因数倍数特征快速判断） |
| possibility | 4 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-possible（可能性描述） |
| pigeonhole | 4 | apply | registry:explicit | registry 别名 | math-g5-c3-pigeonhole-principle（抽屉原理） |
| combination | 3 | apply | 覆盖 | 搭配/排列组合=应用 | math-g2-m10-combination（搭配（排列组合）） |
| read | 3 | recognize | registry:explicit | registry 别名 | math-g3-m4-g3-decimal（小数的初步认识） |
| average | 3 | apply | 覆盖 | 平均数=统计应用（非几何） | math-g4-m4-g4-fill-avg（平均数） |
| symmetry | 3 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-sym（画轴对称图形） |
| chicken-rabbit | 3 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-cr（鸡兔同笼） |
| dec | 3 | calc | registry:explicit | registry 别名 | math-g4-m11-g4-judge-dec（小数性质） |
| stats | 3 | apply | registry:explicit | registry 别名 | math-g4-m11-stats（统计） |
| horizontal | 3 | apply | registry:explicit | registry 别名 | math-g4-c1-c1-horizontal（横式数字谜） |
| symbol | 3 | apply | registry:explicit | registry 别名 | math-g4-c1-c1-symbol（符号代表数） |
| parity | 3 | apply | 覆盖 | 奇偶性与运算规律=数论应用 | math-g4-c2-c2-parity（奇偶性与运算规律） |
| place | 3 | apply | 覆盖 | 位值原理=数论应用 | math-g4-c2-c2-place（位值原理） |
| basic | 3 | apply | 覆盖 | 基本行程=应用（非几何） | math-g4-c5-c5-basic（基本行程） |
| meet | 3 | apply | 覆盖 | 相遇问题=应用（非几何） | math-g4-c5-c5-meet（相遇问题） |
| chase | 3 | apply | 覆盖 | 追及问题=应用（非几何） | math-g4-c5-c5-chase（追及问题） |
| train | 3 | apply | 覆盖 | 火车过桥=应用（非几何） | math-g4-c5-c5-train（火车过桥） |
| ratio | 3 | apply | registry:explicit | registry 别名 | math-g5-c5-ratio-motion（比例行程） |
| inclusion-exclusion | 3 | apply | registry:explicit | registry 别名 | math-g5-c9-inclusion-exclusion（容斥原理） |
| negative | 3 | calc | registry:explicit | registry 别名 | math-g6-m4-g6-fill-negative（负数的意义与读写） |
| pie-chart | 3 | apply | 覆盖 | 扇形统计图=统计应用 | math-g6-m4-g6-fill-pie-chart（扇形统计图的特点） |
| chart | 3 | apply | registry:explicit | registry 别名 | math-g6-m5-g6-match-chart（统计图类型与特点配对） |
| cyl-cone | 3 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-cyl-cone（圆柱圆锥体积与表面积应用） |
| div | 2 | calc | registry:explicit | registry 别名 | math-g2-m1-div-table（表内除法） |
| addsub | 2 | calc | registry:explicit | registry 别名 | math-g2-m1-addsub-1000（整百整千数加减） |
| multdiv | 2 | calc | registry:explicit | registry 别名 | math-g2-m3-multdiv-mixed（乘除混合脱式） |
| length | 2 | recognize | registry:explicit | registry 别名 | math-g2-m4-length-unit（长度单位换算） |
| mass | 2 | recognize | registry:explicit | registry 别名 | math-g2-m4-mass-unit（质量单位换算） |
| shape | 2 | geometry | registry:explicit | registry 别名 | math-g2-m5-match-shape（图形与名称连线） |
| div-partitive | 2 | calc | 覆盖 | 看图列除法（等分）=计算 | math-g2-m7-pic-div（看图列除法（等分）） |
| div-quotative | 2 | calc | 覆盖 | 看图列除法（包含）=计算 | math-g2-m7-pic-div-include（看图列除法（包含）） |
| order | 2 | recognize | registry:explicit | registry 别名 | math-g2-m10-order（排队问题） |
| dec-simple | 2 | calc | registry:explicit | registry 别名 | math-g4-m3-g4-mix-dec（小数加减简便计算） |
| line-ray | 2 | geometry | registry:explicit | registry 别名 | math-g4-m4-g4-fill-line（线段、射线、直线） |
| triangle | 2 | geometry | registry:explicit | registry 别名 | math-g4-m4-g4-fill-tri（三角形） |
| segment-multiple | 2 | apply | 覆盖 | 线段图列式（倍数）=应用 | math-g4-m7-g4-pic-segment（线段图列式（倍数问题）） |
| law | 2 | judge | 覆盖 | 运算律判断题=判断 | math-g4-m11-g4-judge-law（运算律） |
| vertical | 2 | calc | registry:explicit | registry 别名 | math-g4-c1-c1-vertical（竖式数字谜） |
| prime | 2 | recognize | registry:explicit | registry 别名 | math-g4-c2-c2-prime（质数与合数） |
| frac-simple | 2 | calc | registry:explicit | registry 别名 | math-g5-m3-g5-mix-fracsimple（运算律推广到分数简便计算） |
| frac-decimal | 2 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-fracdec（分数与小数的互化） |
| area-formula | 2 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-area（多边形面积公式） |
| equation | 2 | apply | registry:explicit | registry 别名 | math-g5-m11-g5-judge-equ（方程概念） |
| fraction | 2 | apply | registry:explicit | registry 别名 | math-g5-m11-g5-judge-frac（分数的意义与性质） |
| area | 2 | apply | registry:explicit | registry 别名 | math-g5-m11-g5-judge-area（多边形面积） |
| rotation | 2 | apply | registry:explicit | registry 别名 | math-g5-m11-motion（图形的运动） |
| divisibility | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-divisibility（整除特征） |
| prime-factor | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-prime-factorization（分解质因数） |
| factor-count | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-factor-count-sum（因数个数与因数和） |
| gcd-lcm | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-gcd-lcm（最大公因数与最小公倍数） |
| perfect-square | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-perfect-square（完全平方数） |
| nt-extreme | 2 | apply | registry:explicit | registry 别名 | math-g5-c2-number-theory-extreme（数论最值） |
| add-principle | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-addition-principle（加法原理） |
| mult-principle | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-multiplication-principle（乘法原理） |
| permutation | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-permutation（排列数） |
| enumeration | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-enumeration-counting（枚举计数） |
| bundling | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-bundling-method（捆绑法） |
| insertion | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-insertion-method（插空法） |
| stars-bars | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-stars-bars（隔板法） |
| worst-case | 2 | apply | registry:explicit | registry 别名 | math-g5-c3-worst-case-principle（最不利原则） |
| area-basic | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-area-basic（基本面积公式） |
| equal-area | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-equal-area-transform（等积变形） |
| bird-head | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-bird-head-model（鸟头模型） |
| butterfly | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-butterfly-model（蝴蝶模型） |
| swallow-tail | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-swallow-tail-model（燕尾模型） |
| half | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-half-model（一半模型） |
| painted-cube | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-painted-cube（表面涂色问题） |
| pythagorean | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-pythagorean-theorem（勾股定理） |
| lattice | 2 | apply | registry:explicit | registry 别名 | math-g5-c4-lattice-area（格点面积） |
| boat | 2 | apply | registry:explicit | registry 别名 | math-g5-c5-boat-stream（流水行船） |
| circular | 2 | apply | registry:explicit | registry 别名 | math-g5-c5-circular-track（环形跑道） |
| work | 2 | apply | registry:explicit | registry 别名 | math-g5-c6-work-problem（工程问题） |
| concentration | 2 | apply | registry:explicit | registry 别名 | math-g5-c6-concentration-problem（浓度问题） |
| extract-factor | 2 | calc | 覆盖 | 提取公因数巧算=计算 | math-g5-c7-extract-common-factor（提取公因数） |
| rounding | 2 | calc | registry:explicit | registry 别名 | math-g5-c7-rounding-calc（凑整巧算） |
| frac-split | 2 | calc | registry:explicit | registry 别名 | math-g5-c7-fraction-splitting（分数裂项） |
| int-split | 2 | calc | registry:explicit | registry 别名 | math-g5-c7-integer-splitting（整数裂项） |
| series | 2 | apply | registry:explicit | registry 别名 | math-g5-c7-arithmetic-series（等差数列） |
| recurring | 2 | apply | registry:explicit | registry 别名 | math-g5-c7-recurring-decimal-frac（循环小数化分数） |
| define-op | 2 | apply | registry:explicit | registry 别名 | math-g5-c7-define-operation（定义新运算） |
| estimate | 2 | calc | registry:explicit | registry 别名 | math-g5-c7-estimate-bounds（估算与放缩） |
| complex-frac | 2 | apply | registry:explicit | registry 别名 | math-g5-c7-complex-fraction（繁分数化简） |
| extremum | 2 | apply | registry:explicit | registry 别名 | math-g5-c8-extremum-problem（最值问题） |
| winning | 2 | apply | registry:explicit | registry 别名 | math-g5-c8-winning-strategy（必胜策略） |
| sum-diff | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-sum-diff-problem（和差倍问题） |
| age | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-age-problem（年龄问题） |
| profit-loss | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-profit-loss-problem（盈亏问题） |
| planting | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-planting-problem（植树问题） |
| phalanx | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-phalanx-problem（方阵问题） |
| periodic | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-periodic-problem（周期问题） |
| grass | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-grass-problem（牛吃草问题） |
| frac-percent | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-fraction-percent-application（分数百分数应用题） |
| economics | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-economics-problem（经济问题） |
| eq1 | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-equation-linear-1（一元一次方程（工具）） |
| eq2 | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-equation-linear-2（二元一次方程组（工具）） |
| diophantine | 2 | apply | registry:explicit | registry 别名 | math-g5-c9-diophantine-equation（不定方程整数解（C9/C2）） |
| percent | 2 | apply | registry:explicit | registry 别名 | math-g6-m4-g6-fill-percent（百分数的意义、互化与折扣） |
| competition | 2 | apply | registry:explicit | registry 别名 | math-g6-c1-number-puzzle-competition（竞赛级数字谜综合） |
| all | 2 | recognize | 覆盖 | 字母认读=认识类（非几何） | en-g3-e1-letter-recognition（字母认读） |
| relation | 1 | calc | 覆盖 | 乘除法关系口算=计算 | math-g2-m1-muldiv-relation（乘除法关系口算） |
| chain-add | 1 | calc | registry:explicit | registry 别名 | math-g2-m2-chain-add-col（连加竖式） |
| chain-sub | 1 | calc | registry:explicit | registry 别名 | math-g2-m2-chain-sub-col（连减竖式） |
| bracket | 1 | calc | registry:explicit | registry 别名 | math-g2-m3-mixed-bracket（带括号混合运算） |
| chain | 1 | calc | registry:explicit | registry 别名 | math-g2-m3-chain-addsub（连加连减脱式） |
| operator | 1 | calc | 覆盖 | 填运算符号=计算 | math-g2-m3-fill-operator（填运算符号） |
| readwrite | 1 | recognize | registry:explicit | registry 别名 | math-g2-m4-read-10000（万以内数的读写） |
| compose | 1 | fill | 覆盖 | 数的组成=填空 | math-g2-m4-compose-10000（万以内数的组成） |
| digit | 1 | recognize | registry:explicit | registry 别名 | math-g2-m4-digit-order（数位顺序） |
| approx | 1 | recognize | registry:explicit | registry 别名 | math-g2-m4-approx-number（近似数） |
| time | 1 | recognize | registry:explicit | registry 别名 | math-g2-m4-time-unit（时间单位换算） |
| fill-length | 1 | fill | registry:explicit | registry 别名 | math-g2-m4-fill-length（填合适长度单位） |
| fill-mass | 1 | fill | registry:explicit | registry 别名 | math-g2-m4-fill-mass（填合适质量单位） |
| fill-time | 1 | fill | registry:explicit | registry 别名 | math-g2-m4-fill-time（填合适时间单位） |
| pattern | 1 | recognize | registry:explicit | registry 别名 | math-g2-m4-number-pattern（数字规律） |
| mult-meaning | 1 | fill | 覆盖 | 乘法意义填空=填空 | math-g2-m4-multiplication-meaning（乘法意义填空） |
| div-meaning | 1 | fill | 覆盖 | 除法意义填空=填空 | math-g2-m4-division-meaning（除法意义填空） |
| unit | 1 | recognize | registry:explicit | registry 别名 | math-g2-m5-match-unit（单位与物品连线） |
| motion | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-motion（图形运动） |
| grid | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-grid-draw（方格纸画图） |
| draw-line | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-draw-line（画指定长度线段） |
| draw-angle | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-draw-angle（画指定角） |
| clock-draw | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-clock-draw（钟面画时间） |
| measure | 1 | geometry | registry:explicit | registry 别名 | math-g2-m6-measure（测量线段） |
| two-step | 1 | apply | 覆盖 | 两步混合应用=应用 | math-g2-m8-two-step（两步混合运算应用） |
| money | 1 | apply | 覆盖 | 人民币购物=应用 | math-g2-m8-money（人民币购物问题） |
| extra | 1 | apply | 覆盖 | 多余条件问题=应用 | math-g2-m8-extra-condition（含多余条件问题） |
| tally | 1 | apply | 覆盖 | 数据收集（正字法）=统计应用 | math-g2-m9-data-tally（数据收集（正字法）） |
| question | 1 | apply | 覆盖 | 统计回答问题=应用 | math-g2-m9-data-question（统计回答问题） |
| sudoku | 1 | apply | 覆盖 | 数独=逻辑应用 | math-g2-m10-sudoku3（3×3数独） |
| handshake | 1 | apply | 覆盖 | 握手问题=组合应用 | math-g2-m10-handshake（握手问题） |
| multi1 | 1 | calc | 覆盖 | 多位数乘一位数=计算 | math-g3-m1-g3-mul-multi1（多位数乘一位数） |
| div1 | 1 | calc | 覆盖 | 除数是一位数的除法=计算 | math-g3-m1-g3-div1（除数是一位数的除法） |
| twodigit | 1 | calc | 覆盖 | 两位数乘两位数=计算 | math-g3-m1-g3-mul-2digit（两位数乘两位数） |
| shard | 1 | recognize | registry:explicit | registry 别名 | math-g3-m4-g3-fraction（分数的初步认识） |
| clockFace | 1 | recognize | 覆盖 | 时、分、秒认读=认识类 | math-g3-m4-g3-time（时、分、秒） |
| ym | 1 | recognize | registry:explicit | registry 别名 | math-g3-m4-g3-year-month（年、月、日） |
| perimeter | 1 | geometry | registry:explicit | registry 别名 | math-g3-m6-g3-perimeter（长方形正方形的周长） |
| rect | 1 | geometry | registry:explicit | registry 别名 | math-g3-m6-g3-area（面积） |
| compass | 1 | geometry | registry:explicit | registry 别名 | math-g3-m6-g3-position（位置与方向） |
| multiTable | 1 | apply | 覆盖 | 复式统计表=统计应用（非计算） | math-g3-m9-g3-stats-table（复式统计表） |
| dress | 1 | apply | 覆盖 | 搭配问题=应用 | math-g3-m10-g3-combination（搭配问题） |
| set | 1 | apply | 覆盖 | 集合思想=应用 | math-g3-m10-g3-set（集合思想） |
| big-addsub | 1 | calc | registry:explicit | registry 别名 | math-g4-m1-g4-oral-big（大数加减口算） |
| mul3x1 | 1 | calc | registry:explicit | registry 别名 | math-g4-m1-g4-oral-mul3x1（三位数乘一位数口算） |
| mul2tens | 1 | calc | registry:explicit | registry 别名 | math-g4-m1-g4-oral-mul2t（两位数乘整十数口算） |
| div-tens | 1 | calc | registry:explicit | registry 别名 | math-g4-m1-g4-oral-divt（除数是整十数的口算） |
| dec-addsub | 1 | calc | registry:explicit | registry 别名 | math-g4-m1-g4-oral-dec（小数加减法口算） |
| law-oral | 1 | oral | registry:explicit | registry 别名 | math-g4-m1-g4-oral-law（运用运算律简便口算） |
| mul3x2 | 1 | calc | registry:explicit | registry 别名 | math-g4-m2-g4-v-mul3x2（三位数乘两位数） |
| mul-zero | 1 | calc | registry:explicit | registry 别名 | math-g4-m2-g4-v-mulzero（因数中间或末尾有 0 的乘法） |
| div-2digit | 1 | calc | registry:explicit | registry 别名 | math-g4-m2-g4-v-div2（除数是两位数的除法） |
| div-2quotient | 1 | calc | registry:explicit | registry 别名 | math-g4-m2-g4-v-div2q（商是两位数的除法） |
| dec-vertical | 1 | calc | registry:explicit | registry 别名 | math-g4-m2-g4-v-dec（小数加减法竖式） |
| add-law | 1 | calc | registry:explicit | registry 别名 | math-g4-m3-g4-mix-addlaw（加法运算律简便计算） |
| mul-law | 1 | calc | registry:explicit | registry 别名 | math-g4-m3-g4-mix-mullaw（乘法运算律简便计算） |
| dist-law | 1 | calc | registry:explicit | registry 别名 | math-g4-m3-g4-mix-dist（乘法分配律简便计算） |
| big-num | 1 | recognize | 覆盖 | 大数的认识=概念认识（非计算） | math-g4-m4-g4-fill-bignum（大数的认识） |
| hectare | 1 | recognize | 覆盖 | 公顷平方千米=单位认识（非几何） | math-g4-m4-g4-fill-hectare（公顷和平方千米） |
| angle-metric | 1 | geometry | registry:explicit | registry 别名 | math-g4-m4-g4-fill-angle（角的度量与分类） |
| quad | 1 | geometry | registry:explicit | registry 别名 | math-g4-m4-g4-fill-quad（平行四边形和梯形） |
| op-meaning | 1 | recognize | 覆盖 | 四则运算意义=概念认识（非几何） | math-g4-m4-g4-fill-op（四则运算的意义与关系、0 的运算） |
| quotient-law | 1 | calc | 覆盖 | 商不变规律=计算规律（非几何） | math-g4-m4-g4-fill-quotient（商不变规律） |
| decimal | 1 | calc | registry:explicit | registry 别名 | math-g4-m4-g4-fill-dec（小数） |
| angle-degree | 1 | geometry | registry:explicit | registry 别名 | math-g4-m5-g4-match-angle（角与度数连线） |
| shape-feature | 1 | geometry | registry:explicit | registry 别名 | math-g4-m5-g4-match-shape（图形与特征连线） |
| law-formula | 1 | choice | 覆盖 | 运算律字母式连线=连线选择 | math-g4-m5-g4-match-law（运算律与字母表达式连线） |
| dec-frac | 1 | choice | 覆盖 | 小数分数连线=连线选择 | math-g4-m5-g4-match-decfrac（小数与分数连线） |
| protractor | 1 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-protractor（用量角器量角、画角） |
| parallel-perp | 1 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-para（画平行线、垂线） |
| grid-quad | 1 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-grid（在方格纸上画平行四边形、梯形） |
| observe | 1 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-view（观察物体） |
| translate | 1 | geometry | registry:explicit | registry 别名 | math-g4-m6-g4-draw-move（图形平移） |
| brace-addsub | 1 | calc | 覆盖 | 大括号图列式=计算 | math-g4-m7-g4-pic-brace（大括号图列式（加减）） |
| speed-distance | 1 | apply | registry:explicit | registry 别名 | math-g4-m7-g4-pic-speed（速度时间路程图） |
| dec-scene | 1 | apply | registry:explicit | registry 别名 | math-g4-m7-g4-pic-dec（小数加减情境图） |
| big-app | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-big（大数应用） |
| mul-travel | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-speed（乘法问题（速度×时间=路程）） |
| div-share | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-div（除法问题（总量÷份数=每份数）） |
| price-qty | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-price（单价、数量、总价问题） |
| area-hectare | 1 | apply | 覆盖 | 面积问题（公顷）=应用 | math-g4-m8-g4-word-area（面积问题（公顷/平方千米）） |
| optimize | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-opt（优化问题） |
| dec-pay | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-dec（小数加减问题） |
| avg-score | 1 | apply | registry:explicit | registry 别名 | math-g4-m8-g4-word-avg（平均数问题） |
| bar-chart | 1 | apply | 覆盖 | 条形统计图=统计应用 | math-g4-m9-g4-stats-bar（条形统计图（1 格表示多个单位）） |
| double-bar | 1 | apply | 覆盖 | 复式条形统计图=统计应用 | math-g4-m9-g4-stats-double（复式条形统计图） |
| avg-stats | 1 | apply | 覆盖 | 平均数统计=应用 | math-g4-m9-g4-stats-avg（平均数与统计） |
| pancake | 1 | apply | registry:explicit | registry 别名 | math-g4-m10-g4-reason-opt（优化问题（沏茶、烙饼）） |
| assume | 1 | apply | registry:explicit | registry 别名 | math-g4-m10-g4-reason-cr（鸡兔同笼（假设法）） |
| quotient | 1 | apply | registry:explicit | registry 别名 | math-g4-m11-g4-judge-quotient（商不变规律） |
| big-compare | 1 | recognize | registry:explicit | registry 别名 | math-g4-m12-g4-choice-big（大数比较） |
| est-muldiv | 1 | calc | registry:explicit | registry 别名 | math-g4-m12-g4-choice-est（乘除法估算） |
| dec-meaning | 1 | recognize | 覆盖 | 小数意义=概念认识（非计算） | math-g4-m12-g4-choice-dec（小数意义） |
| array | 1 | apply | registry:explicit | registry 别名 | math-g4-c1-c1-array（数阵图） |
| magic | 1 | apply | registry:explicit | registry 别名 | math-g4-c1-c1-magic（幻方） |
| divisible | 1 | recognize | registry:explicit | registry 别名 | math-g4-c2-c2-divisible（整除特征（2/3/5/9）） |
| factor | 1 | recognize | registry:explicit | registry 别名 | math-g4-c2-c2-factor（因数与倍数） |
| enum | 1 | apply | 覆盖 | 枚举法=计数应用 | math-g4-c3-c3-enum（枚举法） |
| am | 1 | apply | 覆盖 | 加法乘法原理=计数应用 | math-g4-c3-c3-am（加法与乘法原理） |
| perm | 1 | apply | 覆盖 | 排列组合初步=计数应用 | math-g4-c3-c3-perm（排列组合初步） |
| geomcount | 1 | geometry | registry:heuristic | registry 别名 | math-g4-c3-c3-geomcount（几何计数） |
| worst | 1 | apply | 覆盖 | 最不利原则=应用 | math-g4-c3-c3-worst（最不利原则） |
| pa | 1 | geometry | 覆盖 | 周长与面积=几何 | math-g4-c4-c4-pa（周长与面积） |
| cutfill | 1 | fill | registry:explicit | registry 别名 | math-g4-c4-c4-cutfill（割补法） |
| count | 1 | geometry | 覆盖 | 图形计数=几何 | math-g4-c4-c4-count（图形计数） |
| transform | 1 | geometry | registry:explicit | registry 别名 | math-g4-c4-c4-transform（平移旋转与对称） |
| river | 1 | apply | 覆盖 | 流水行船=应用（非几何） | math-g4-c5-c5-river（流水行船） |
| extreme | 1 | apply | 覆盖 | 最值问题=应用（非几何） | math-g4-c8-c8-extreme（最值问题） |
| drawer | 1 | apply | 覆盖 | 抽屉原理=应用（非几何） | math-g4-c8-c8-drawer（抽屉原理） |
| integrated | 1 | apply | 覆盖 | 综合应用题=应用（非几何） | math-g4-c9-c9-integrated（综合应用题） |
| misc | 1 | apply | 覆盖 | 杂题选讲=应用（非几何） | math-g4-c9-c9-misc（杂题选讲（统筹/操作）） |
| mock | 1 | open | 覆盖 | 模拟竞赛卷=开放综合卷 | math-g4-c9-c9-mock（模拟竞赛卷） |
| dec-mul-oral | 1 | oral | registry:explicit | registry 别名 | math-g5-m1-g5-oral-decmul（小数乘法口算） |
| dec-div-oral | 1 | oral | registry:explicit | registry 别名 | math-g5-m1-g5-oral-decdiv（小数除法口算） |
| frac-addsub-oral | 1 | oral | registry:explicit | registry 别名 | math-g5-m1-g5-oral-fracadd（同分母分数加减法口算） |
| equation-oral | 1 | oral | registry:explicit | registry 别名 | math-g5-m1-g5-oral-equ（简易方程口算） |
| dec-mul-vertical | 1 | apply | registry:explicit | registry 别名 | math-g5-m2-g5-v-decmul（小数乘法竖式） |
| dec-div-int | 1 | apply | registry:explicit | registry 别名 | math-g5-m2-g5-v-divint（除数是整数的小数除法竖式） |
| dec-div-dec | 1 | apply | registry:explicit | registry 别名 | math-g5-m2-g5-v-ddivdec（除数是小数的小数除法竖式） |
| repeating-dec | 1 | apply | registry:explicit | registry 别名 | math-g5-m2-g5-v-repeating（循环小数竖式表示） |
| dec-mixed | 1 | calc | registry:explicit | registry 别名 | math-g5-m3-g5-mix-decmixed（小数四则混合运算） |
| frac-mixed | 1 | calc | registry:explicit | registry 别名 | math-g5-m3-g5-mix-fracmixed（分数加减混合运算） |
| dec-place | 1 | calc | registry:explicit | registry 别名 | math-g5-m4-g5-fill-decloc（小数的计数单位与数位） |
| dec-compare | 1 | calc | registry:explicit | registry 别名 | math-g5-m4-g5-fill-deccmp（小数大小比较） |
| product-rule | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-prodrule（积的变化规律） |
| repeating-note | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-repeating（循环小数与简便记法） |
| equation-prop | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-equation（方程概念与等式的性质） |
| prime-composite | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-prime（质数与合数） |
| frac-meaning | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-fracmean（分数的意义与分数单位） |
| frac-property | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-fracprop（分数的基本性质（约分、通分）） |
| coordinate | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-coord（数对的含义） |
| solid-formula | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-solid（长方体正方体特征与公式） |
| rotation-elem | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-rotate（旋转三要素） |
| linechart-feature | 1 | apply | registry:explicit | registry 别名 | math-g5-m4-g5-fill-linechart（折线统计图特点） |
| solid-feature | 1 | apply | registry:explicit | registry 别名 | math-g5-m5-g5-match-solid（立体图形特征连线） |
| possibility-desc | 1 | apply | registry:explicit | registry 别名 | math-g5-m5-g5-match-possib（事件与可能性描述连线） |
| equation-solve | 1 | apply | registry:explicit | registry 别名 | math-g5-m5-g5-match-equ（方程与解连线） |
| rotation-draw | 1 | apply | registry:explicit | registry 别名 | math-g5-m6-g5-draw-rotate（画旋转后的图形） |
| observe-3d | 1 | apply | registry:explicit | registry 别名 | math-g5-m6-g5-draw-observe（观察物体（三）） |
| polygon-height | 1 | apply | registry:explicit | registry 别名 | math-g5-m6-g5-draw-height（画多边形的高） |
| coordinate-plot | 1 | apply | registry:explicit | registry 别名 | math-g5-m6-g5-draw-coord（用数对表示位置） |
| solid-net | 1 | apply | registry:explicit | registry 别名 | math-g5-m6-g5-draw-net（长方体展开图） |
| balance-equation | 1 | apply | registry:explicit | registry 别名 | math-g5-m7-g5-pic-balance（天平平衡图（列方程）） |
| area-picture | 1 | apply | registry:explicit | registry 别名 | math-g5-m7-g5-pic-area（多边形面积图） |
| tree-planting | 1 | apply | registry:explicit | registry 别名 | math-g5-m7-g5-pic-tree（植树问题示意图） |
| dec-mul-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-decmul（小数乘法应用题） |
| dec-div-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-decdiv（小数除法应用题（进一法、去尾法）） |
| equation-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-equ（列方程解决问题） |
| factor-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-fm（因数与倍数简单应用） |
| frac-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-frac（分数加减法应用题） |
| area-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-area（多边形面积应用题） |
| solid-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-solid（长方体正方体应用题） |
| possibility-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-possib（可能性问题） |
| linechart-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-linechart（折线统计图分析） |
| tree-app | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-tree（植树问题） |
| defective | 1 | apply | registry:explicit | registry 别名 | math-g5-m8-g5-word-defect（找次品） |
| possibility-compare | 1 | apply | registry:explicit | registry 别名 | math-g5-m9-g5-stats-possib（可能性大小比较） |
| linechart-single | 1 | apply | registry:explicit | registry 别名 | math-g5-m9-g5-stats-line1（单式折线统计图） |
| linechart-double | 1 | apply | registry:explicit | registry 别名 | math-g5-m9-g5-stats-line2（复式折线统计图） |
| tree-three | 1 | apply | registry:explicit | registry 别名 | math-g5-m10-g5-reason-tree3（植树问题（三种情况）） |
| defective-scale | 1 | apply | registry:explicit | registry 别名 | math-g5-m10-g5-reason-defect（找次品（天平称量）） |
| sequence | 1 | apply | registry:explicit | registry 别名 | math-g5-m10-g5-reason-seq（数字推理） |
| array-closed | 1 | apply | 覆盖 | 封闭型数阵=应用 | math-g5-c1-number-array-closed（封闭型数阵） |
| array-radial | 1 | apply | 覆盖 | 辐射型数阵=应用 | math-g5-c1-number-array-radial（辐射型数阵） |
| array-composite | 1 | apply | 覆盖 | 复合型数阵=应用 | math-g5-c1-number-array-composite（复合型数阵） |
| magic3 | 1 | apply | 覆盖 | 三阶幻方=应用 | math-g5-c1-magic-square-3（三阶幻方） |
| magic4 | 1 | apply | 覆盖 | 四阶幻方=应用 | math-g5-c1-magic-square-4（四阶幻方初步） |
| avg-speed | 1 | apply | registry:explicit | registry 别名 | math-g5-c5-average-speed（平均速度） |
| frac-mult-int | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-frac-mult-int（分数乘整数） |
| frac-mult-frac | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-frac-mult-frac（分数乘分数） |
| frac-div-int | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-frac-div-int（分数除以整数） |
| frac-div-frac | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-frac-div-frac（一个数除以分数） |
| dec-perc | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-dec-perc（小数与百分数互化） |
| ratio-simp | 1 | apply | registry:explicit | registry 别名 | math-g6-m1-g6-oral-ratio-simp（求比值与化简比） |
| neg-add-sub | 1 | calc | registry:explicit | registry 别名 | math-g6-m1-g6-oral-neg-add-sub（负数加减） |
| dec-mult | 1 | calc | registry:explicit | registry 别名 | math-g6-m2-g6-calc-dec-mult（小数乘法笔算） |
| dec-div | 1 | calc | registry:explicit | registry 别名 | math-g6-m2-g6-calc-dec-div（小数除法笔算） |
| frac-mult-div | 1 | apply | registry:explicit | registry 别名 | math-g6-m2-g6-calc-frac-mult-div（分数乘除笔算） |
| solve-proportion | 1 | apply | registry:explicit | registry 别名 | math-g6-m2-g6-calc-solve-proportion（解比例） |
| frac-order | 1 | apply | registry:explicit | registry 别名 | math-g6-m3-g6-mixed-frac-order（分数四则混合运算） |
| solve-equation | 1 | apply | registry:explicit | registry 别名 | math-g6-m3-g6-mixed-solve-equation（解方程（含分数系数）） |
| cylinder-cone | 1 | apply | registry:explicit | registry 别名 | math-g6-m4-g6-fill-cylinder-cone（圆柱侧面积、表面积、体积与圆锥体积） |
| unit-convert | 1 | recognize | 覆盖 | 单位换算=认识/换算 | math-g6-m4-unit-convert（单位换算） |
| proportion | 1 | apply | registry:explicit | registry 别名 | math-g6-m5-g6-match-proportion（正比例与反比例判断） |
| formula | 1 | apply | registry:explicit | registry 别名 | math-g6-m5-g6-match-formula（图形与公式配对） |
| rotate-scale | 1 | apply | registry:explicit | registry 别名 | math-g6-m6-g6-op-rotate-scale（图形旋转与放大缩小） |
| position | 1 | geometry | registry:explicit | registry 别名 | math-g6-m6-g6-op-position（用方向和距离确定位置） |
| frac-line | 1 | calc | registry:explicit | registry 别名 | math-g6-m7-g6-pic-frac-line（分数应用题线段图） |
| scale | 1 | apply | registry:explicit | registry 别名 | math-g6-m7-g6-pic-scale（比例尺图） |
| frac-mult | 1 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-frac-mult（求一个数的几分之几是多少（分数乘法）） |
| frac-div | 1 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-frac-div（已知一个数的几分之几求这个数（分数除法）） |
| percent-discount | 1 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-percent-discount（折扣、成数、税率、利率百分数应用） |
| ratio-prop | 1 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-ratio-prop（比和比例的应用（比例尺、按比例分配、用比例解）） |
| travel-work | 1 | apply | registry:explicit | registry 别名 | math-g6-m8-g6-app-travel-work（行程、工程问题（分数除法应用）） |
| number-shape | 1 | apply | registry:explicit | registry 别名 | math-g6-m10-g6-reason-number-shape（数与形规律（连续奇数求和、图形规律）） |
| percent-ratio | 1 | apply | registry:explicit | registry 别名 | math-g6-m11-g6-judge-percent-ratio（百分数与比的性质） |
| vertical-multi | 1 | calc | registry:explicit | registry 别名 | math-g6-c1-vertical-multidigit（多位数竖式数字谜） |
| carry-complex | 1 | calc | registry:explicit | registry 别名 | math-g6-c1-vertical-carry-complex（复杂进位竖式谜） |
| magic-adv | 1 | apply | registry:explicit | registry 别名 | math-g6-c1-magic-square-adv（幻方进阶） |
| array-adv | 1 | apply | registry:explicit | registry 别名 | math-g6-c1-number-array（数阵图进阶） |
| digit-reason | 1 | apply | 覆盖 | 数字推理综合=应用 | math-g6-c1-digit-reasoning（数字推理综合） |
| modulo | 1 | apply | registry:explicit | registry 别名 | math-g6-c2-modulo-arithmetic（模运算与周期（大指数）） |
| recursion | 1 | apply | registry:explicit | registry 别名 | math-g6-c3-recursion-counting（递推计数（斐波那契、爬楼梯）） |
| derangement | 1 | apply | registry:explicit | registry 别名 | math-g6-c3-derangement（错排问题（初步）） |
| geometry-count | 1 | geometry | registry:explicit | registry 别名 | math-g6-c3-geometry-counting（几何计数（三角形、矩形综合）） |
| circle-angle | 1 | geometry | registry:explicit | registry 别名 | math-g6-c4-circle-angle（圆角度（圆心角、圆周角）） |
| solid-rotation | 1 | geometry | registry:explicit | registry 别名 | math-g6-c4-solid-rotation（旋转体（圆柱、圆锥）） |
| journey-complex | 1 | apply | registry:explicit | registry 别名 | math-g6-c5-journey-complex（行程综合） |
| interval-departure | 1 | apply | 覆盖 | 发车间隔问题=应用（非几何） | math-g6-c5-interval-departure（发车间隔问题） |
| pick-up | 1 | apply | 覆盖 | 接送问题=应用（非几何） | math-g6-c5-pick-up-problem（接送问题（往返接送）） |
| sequence-sum | 1 | apply | registry:explicit | registry 别名 | math-g6-c7-sequence-sum（数列求和（平方和、立方和）） |
| optimization | 1 | apply | registry:explicit | registry 别名 | math-g6-c8-optimization（统筹优化（烙饼、排队、过桥）） |
| mixture | 1 | apply | 覆盖 | 混合问题=应用（非几何） | math-g6-c9-mixture-problem（混合问题（平均价、合金）） |

---

**待定项**：无

## 数据结构：题型优化知识点结构的扩展空间预留

规范化后 `applicable_question_types` 元素结构（对齐一年级实例 `{ type, coefficient }`，加审计字段）：

```js
// 规范化后（G2-G6 + cn/en 统一到一年级口径）
{ type: 'calc',      // canonical 9 类：calc/fill/choice/judge/apply/open/geometry/recognize/oral（operate 等为 registry 别名，归一 oral）
  coefficient: 1,   // 题型配比权重（保留原值）
  rawType: 'mix' }  // 审计字段：改写前的原始细粒度题型值（仅非 canonical 时写入）
```

**为后续「题型优化知识点结构」预留的空间**（本阶段只落 rawType，不额外造字段）：

1. **细粒度信息不丢失**：`rawType` 完整保留改写前值（如 `mix`/`chase`/`bar-chart`），未来若要按题型细分知识点（如"行程-追及"专项配置），可从 `rawType` 无损重建细粒度层，无需回滚数据。
2. **元素为开放对象**：只改写 `type` 并追加 `rawType`，不删除、不覆盖任何既有字段（当前仅 `type`/`coefficient`）；后续如需为某题型加 `subtype`/`difficultyRange`/`numberRange` 等题型级参数，直接追加字段即可，不破坏既有消费方。
3. **规范字段名与校验同源**：canonical 枚举以 `question-type-registry` 为唯一真源（R1 已闭环 schema==registry），未来题型扩展只需改 registry，数据层与校验层自动对齐。
4. **一年级为基准口径**：G1 已按 `{ type: canonical, coefficient }` 规范化（如 `math-g1-m0-make-ten` → `[{type:"calc",coefficient:1},{type:"fill",coefficient:0.6}]`），本次改写使 G2-G6 + cn/en 与一年级口径完全一致。

**应用方式**（r2-qtype-normalize-apply.js）：遍历 knowledge-*.js 全部 KP，将 `applicable_question_types[].type` 按上表改写为 canonical，非 canonical 值写入元素级 `rawType`（审计），随后 verify:m1/m2 + check-type-ssot + check-regression 全量验证；Frozen Core 改动前先归档备份。
