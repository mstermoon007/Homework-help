# 五年级竞赛知识点模块映射表（g5-competition-knowledge-map）

> 状态：**已写入知识库（2026-08-23）**。本文档为设计依据，79 个知识点已写入
> `shared/knowledge-bank.js` 五年级 C1~C9 模块（全部 `status: 'placeholder'`，指向通用占位插件
> `math-competition-placeholder`）；前置已指向现有低年级（四年级旧 slug / 三年级基础点）。
> 原五年级 33 个旧 slug 条目已删除（删旧留新），六年级竞赛前置已同步改指四年级同主题点。
> 各知识点按开发进度逐步激活。

## 命名约定

- **知识点 ID**：`g{grade}-{moduleIdLower}-{slug}`，如 `g5-c1-digit-puzzle-vertical`。
- **slug**：语义化英文片段，小写 + 连字符；**同主题跨年级共用同一 slug**（四年级沿用同 slug）。
- 前置/关联引用：`g4-{slug}` 表示该 slug 的四年级版本；`{slug}` 表示本模块（五年级）内或跨模块五年级点。
- 难度：基础计算类 **3**、模型类 **4**、综合类 **5**；同一 slug 五年级难度不低于四年级（四年级竞赛基线为 3）。

## 一、模块映射总览（C1~C9）

| 竞赛模块 | 模块名称 | 知识点数量（slug 明细） | 对应之前 M 模块 |
| --- | --- | --- | --- |
| C1 | 数字谜与数阵图 | 8 | M2 部分 + M6 部分 |
| C2 | 数论 | 10 | M2 |
| C3 | 组合计数 | 10 | M6 核心 |
| C4 | 几何模型 | 12 | M3 |
| C5 | 行程问题 | 9 | M5 |
| C6 | 工程与浓度 | 2 | M4 部分 |
| C7 | 分数与巧算 | 10 | M1 |
| C8 | 最值与逻辑推理 | 3 | M6 部分 |
| C9 | 竞赛综合 | 15 | M4 大部分 + M7 |

> 注：方程与代数作为**工具**知识点放入 C9 综合模块；不定方程同时出现在 C2 数论最值中（`diophantine-equation`，C9/C2）。
> **计数说明**：C9 模块总览按「对应 M 模块」口径记为 11，但 slug 明细完整枚举为 **15**（含 6 个新增），本文档以 slug 明细为准，差额待确认。

## 二、知识点明细表

### C1 数字谜与数阵图（8）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `digit-puzzle-vertical` | 竖式谜 | 是 | 3 | g4-digit-puzzle-vertical | digit-puzzle-horizontal |
| `digit-puzzle-horizontal` | 横式谜 | 是 | 3 | g4-digit-puzzle-horizontal | digit-puzzle-vertical |
| `digit-puzzle-symbol` | 字母符号代表数 | 是 | 4 | g4-digit-puzzle-symbol | c2-place-value |
| `number-array-closed` | 封闭型数阵 | 是 | 4 | g4-number-array-closed | number-array-radial |
| `number-array-radial` | 辐射型数阵 | 是 | 4 | g4-number-array-radial | number-array-closed |
| `number-array-composite` | 复合型数阵 | 新增 | 5 | number-array-closed, number-array-radial | magic-square-3 |
| `magic-square-3` | 三阶幻方 | 是 | 3 | g4-magic-square-3 | number-array-composite |
| `magic-square-4` | 四阶幻方初步 | 新增 | 4 | magic-square-3 | c2-factor-count-sum |

### C2 数论（10）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `divisibility` | 整除特征 | 是 | 3 | g4-divisibility | gcd-lcm, factor-count-sum |
| `parity-analysis` | 奇偶分析 | 是 | 4 | g4-parity-analysis | remainder-congruence |
| `prime-composite` | 质数与合数 | 是 | 3 | g4-prime-composite | prime-factorization |
| `prime-factorization` | 分解质因数 | 是 | 3 | prime-composite | factor-count-sum, gcd-lcm, perfect-square |
| `factor-count-sum` | 因数个数与因数和 | 是 | 4 | prime-factorization | perfect-square, number-theory-extreme |
| `gcd-lcm` | 最大公因数与最小公倍数 | 是 | 3 | g4-gcd-lcm, prime-factorization | divisibility |
| `remainder-congruence` | 余数与同余 | 是 | 4 | g4-remainder-congruence, divisibility | parity-analysis, number-theory-extreme |
| `place-value` | 位值原理 | 是 | 4 | g4-place-value | c1-digit-puzzle-symbol |
| `perfect-square` | 完全平方数 | 新增 | 4 | prime-factorization, factor-count-sum | number-theory-extreme |
| `number-theory-extreme` | 数论最值 | 新增 | 5 | perfect-square, factor-count-sum | c9-diophantine-equation, remainder-congruence |

### C3 组合计数（10）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `addition-principle` | 加法原理 | 是 | 3 | g4-addition-principle | multiplication-principle |
| `multiplication-principle` | 乘法原理 | 是 | 3 | g4-multiplication-principle | addition-principle, permutation |
| `permutation` | 排列数 | 是 | 4 | g4-permutation, multiplication-principle | combination |
| `combination` | 组合数 | 是 | 4 | g4-combination, permutation | permutation, stars-bars |
| `enumeration-counting` | 枚举计数 | 是 | 3 | g4-enumeration-counting | c9-chicken-rabbit |
| `bundling-method` | 捆绑法 | 新增 | 4 | permutation | insertion-method |
| `insertion-method` | 插空法 | 新增 | 4 | permutation | bundling-method |
| `stars-bars` | 隔板法 | 新增 | 5 | combination | combination, c9-diophantine-equation |
| `pigeonhole-principle` | 抽屉原理 | 是 | 4 | g4-pigeonhole-principle, worst-case-principle | worst-case-principle |
| `worst-case-principle` | 最不利原则 | 是 | 4 | g4-worst-case-principle | pigeonhole-principle |

### C4 几何模型（12）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `area-basic` | 基本面积公式 | 是 | 3 | g4-area-basic | equal-area-transform |
| `equal-area-transform` | 等积变形 | 是 | 4 | g4-equal-area-transform, area-basic | half-model, bird-head-model |
| `bird-head-model` | 鸟头模型 | 新增 | 4 | area-basic, equal-area-transform | butterfly-model, half-model |
| `butterfly-model` | 蝴蝶模型 | 新增 | 4 | area-basic, equal-area-transform | swallow-tail-model, bird-head-model |
| `swallow-tail-model` | 燕尾模型 | 新增 | 5 | equal-area-transform, butterfly-model | butterfly-model, half-model |
| `half-model` | 一半模型 | 新增 | 4 | area-basic, equal-area-transform | bird-head-model |
| `circle-sector` | 圆与扇形 | 新增 | 3 | area-basic | angle-calculation |
| `solid-geometry` | 立体图形表面积与体积 | 是 | 4 | g4-solid-geometry | painted-cube |
| `painted-cube` | 表面涂色问题 | 是 | 4 | g4-painted-cube, solid-geometry | solid-geometry |
| `pythagorean-theorem` | 勾股定理 | 新增 | 4 | area-basic | lattice-area, angle-calculation |
| `lattice-area` | 格点面积 | 新增 | 3 | area-basic | pythagorean-theorem |
| `angle-calculation` | 角度计算 | 是 | 3 | g4-angle-calculation | circle-sector |

### C5 行程问题（9）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `basic-motion` | 基本行程 | 是 | 3 | g4-basic-motion | meet-problem, chase-problem |
| `meet-problem` | 相遇问题 | 是 | 3 | g4-meet-problem, basic-motion | chase-problem |
| `chase-problem` | 追及问题 | 是 | 4 | g4-chase-problem, basic-motion | meet-problem, circular-track |
| `train-bridge` | 火车过桥 | 是 | 4 | g4-train-bridge, basic-motion | boat-stream |
| `boat-stream` | 流水行船 | 是 | 4 | g4-boat-stream, basic-motion | circular-track |
| `circular-track` | 环形跑道 | 新增 | 4 | meet-problem, chase-problem | ratio-motion |
| `clock-problem` | 时钟问题 | 新增 | 4 | chase-problem, basic-motion | circular-track |
| `average-speed` | 平均速度 | 新增 | 4 | basic-motion | ratio-motion |
| `ratio-motion` | 比例行程 | 新增 | 5 | average-speed, c9-equation-linear-1 | circular-track, c9-fraction-percent-application |

### C6 工程与浓度（2）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `work-problem` | 工程问题 | 是 | 4 | g4-work-problem, c9-fraction-percent-application | concentration-problem, c5-basic-motion |
| `concentration-problem` | 浓度问题 | 是 | 4 | g4-concentration-problem, c9-fraction-percent-application | work-problem |

### C7 分数与巧算（10）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `extract-common-factor` | 提取公因数 | 是 | 3 | g4-extract-common-factor | rounding-calc, fraction-splitting |
| `rounding-calc` | 凑整巧算 | 是 | 3 | g4-rounding-calc | extract-common-factor |
| `fraction-splitting` | 分数裂项 | 是 | 4 | g4-fraction-splitting, extract-common-factor | integer-splitting, complex-fraction |
| `integer-splitting` | 整数裂项 | 新增 | 4 | extract-common-factor | fraction-splitting |
| `arithmetic-series` | 等差数列 | 是 | 3 | g4-arithmetic-series | c9-periodic-problem |
| `recurring-decimal-frac` | 循环小数化分数 | 新增 | 3 | c9-fraction-percent-application | complex-fraction |
| `define-operation` | 定义新运算 | 是 | 3 | g4-define-operation | estimate-bounds |
| `compare-size` | 比较大小 | 是 | 3 | g4-compare-size | estimate-bounds |
| `estimate-bounds` | 估算与放缩 | 新增 | 4 | compare-size, define-operation | complex-fraction |
| `complex-fraction` | 繁分数化简 | 新增 | 4 | fraction-splitting, recurring-decimal-frac | fraction-splitting |

### C8 最值与逻辑推理（3）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `extremum-problem` | 最值问题 | 是 | 4 | g4-extremum-problem | c2-number-theory-extreme, c3-worst-case-principle |
| `logic-inference` | 逻辑推理 | 是 | 4 | g4-logic-inference | c9-inclusion-exclusion |
| `winning-strategy` | 必胜策略 | 新增 | 5 | extremum-problem, logic-inference | c3-pigeonhole-principle |

### C9 竞赛综合（15）

| slug | 知识点名称 | 与四年级共用 | 难度 | 前置（prerequisites） | 关联（related） |
| --- | --- | --- | --- | --- | --- |
| `sum-diff-problem` | 和差倍问题 | 是 | 3 | g4-sum-diff-problem | age-problem, chicken-rabbit |
| `age-problem` | 年龄问题 | 是 | 4 | sum-diff-problem | profit-loss-problem |
| `profit-loss-problem` | 盈亏问题 | 是 | 4 | g4-profit-loss-problem | chicken-rabbit, average-problem |
| `chicken-rabbit` | 鸡兔同笼 | 是 | 4 | g4-chicken-rabbit, sum-diff-problem | profit-loss-problem |
| `average-problem` | 平均数问题 | 是 | 3 | g4-average-problem | profit-loss-problem |
| `planting-problem` | 植树问题 | 是 | 3 | g4-planting-problem | phalanx-problem, periodic-problem |
| `phalanx-problem` | 方阵问题 | 是 | 4 | planting-problem | grass-problem |
| `periodic-problem` | 周期问题 | 是 | 3 | g4-periodic-problem | c7-arithmetic-series |
| `grass-problem` | 牛吃草问题 | 新增 | 5 | work-problem, fraction-percent-application | phalanx-problem |
| `fraction-percent-application` | 分数百分数应用题 | 是 | 4 | g4-fraction-percent-application | c6-work-problem, c6-concentration-problem, c5-ratio-motion |
| `economics-problem` | 经济问题 | 新增 | 4 | fraction-percent-application, profit-loss-problem | equation-linear-1 |
| `inclusion-exclusion` | 容斥原理 | 新增 | 5 | c3-addition-principle, c3-enumeration-counting | c8-logic-inference |
| `equation-linear-1` | 一元一次方程（工具） | 新增 | 3 | g5 基础模块 M4 方程（g5-m4-g5-fill-equation） | equation-linear-2, c5-ratio-motion, economics-problem |
| `equation-linear-2` | 二元一次方程组（工具） | 新增 | 4 | equation-linear-1 | diophantine-equation |
| `diophantine-equation` | 不定方程整数解（C9/C2） | 新增 | 5 | equation-linear-2, c2-number-theory-extreme, c3-stars-bars | c2-number-theory-extreme, equation-linear-2 |

## 三、新增 slug 清单（四年级未涉及，共 29 个）

| 模块 | 新增 slug |
| --- | --- |
| C1 | `number-array-composite`, `magic-square-4` |
| C2 | `perfect-square`, `number-theory-extreme` |
| C3 | `bundling-method`, `insertion-method`, `stars-bars` |
| C4 | `bird-head-model`, `butterfly-model`, `swallow-tail-model`, `half-model`, `circle-sector`, `pythagorean-theorem`, `lattice-area` |
| C5 | `circular-track`, `clock-problem`, `average-speed`, `ratio-motion` |
| C6 | —（2 个均与四年级共用） |
| C7 | `integer-splitting`, `recurring-decimal-frac`, `estimate-bounds`, `complex-fraction` |
| C8 | `winning-strategy` |
| C9 | `grass-problem`, `economics-problem`, `inclusion-exclusion`, `equation-linear-1`, `equation-linear-2`, `diophantine-equation` |

> 注：`diophantine-equation` 同时挂在 C9（综合）与 C2（数论最值）下，计数时计入一次。

## 四、跨年级共用说明

- 表中「与四年级共用 = 是」的知识点，五年级与四年级使用**同一 slug**，仅 `g{grade}` 前缀不同
  （如 `g4-c1-digit-puzzle-vertical` 与 `g5-c1-digit-puzzle-vertical`）。
- 五年级对应难度 **≥ 四年级难度**（四年级竞赛基线 3），不降级。
- **依赖项**：当前四年级竞赛库仍使用旧 slug（如 `c1-vertical`），需在后续步骤中把四年级
  竞赛 slug 统一为新语义 slug，才能与五年级「共用 slug」口径一致。

## 五、待确认 / 后续步骤

1. **C9 计数**：已按 slug 明细 **15** 写入知识库（模块总览的「对应 M 模块」口径 11 仅为粗略分类，不影响条目数）。
2. **四年级 slug 统一**：仍待进行。当前四年级竞赛仍是旧 slug（`c1-vertical` 等），五年级新语义 slug 与其不同；
   需迁移四年级 C1~C9 slug（含 `shared/knowledge-slug-map.js`、详情页、插件 `knowledgePoints`）后，五年级共用 slug 口径才完全一致。
3. **插件开发**：按 `docs/coverage` 提示逐个开发 C1~C9 插件（如先「竖式谜」），实现后将对应知识点 `status` 置为 `active` 并指定真实 pluginId。
4. **页面再生成**：修改知识库后运行 `node scripts/generate-knowledge-pages.js` 刷新详情页；已随本次写入执行。
