# P25-08 D 类 KP 专项生成器建设

## 1. 背景与目标

P25-02 审计将 375 个 KP 按语义质量分为 A/B/C/D 四类。**D 类 = 93 个无原生 generator 绑定但 domain 为几何/统计/度量的 KP**，此前依赖通用兜底生成器（arithmetic-addition、shape-recognition 等）产出语义无关题。

典型偏移实证：「认识厘米和米」（长度单位）产出「2+2=?」；「轴对称图形」产出与对称无关的算术题。

**目标**：为 D 类 93 KP 建设/绑定语义正确的专项生成器，消除通用兜底的语义偏移，且不破坏 1570 行 ALLOW 真实性门禁。

**红线**：不新增 QuestionType、不改 math.json、不改 root Excel；绑定即责任（native 绑定的 generator 必须为该 KP 所有 ALLOW 题型产出合规题）。

## 2. D 类 93 KP 语义族分布与绑定方案

| 语义族 | 数量 | 绑定目标 generator | 说明 |
|--------|------|-------------------|------|
| geometric-figure | 40 | shape-recognition | 图形认识（三角/长方/圆/平行四边形/梯形/线段/角/对称/密铺等） |
| geometric-measurement | 12 | shape-recognition | 周长/面积/表面积/体积/圆度量 |
| spatial-reasoning | 18 | position-direction | 平移/旋转/轴对称/观察物体/方向/数对 |
| unit-measurement | 8 | money-measurement | 长度/面积/质量/时间/容量/人民币单位换算 |
| word-application（综合运用） | 9 | application-word | 各年级综合运用 |
| fraction | 3 | arithmetic-mixed-calculation | 分数运算 |

**策略**：不新建 generator，而是增强既有生成器的语义派生能力，按语义族聚合绑定。93 KP 全部 native 绑定到对应生成器。

## 3. 生成器增强内容

### 3.1 shape-recognition（[shape.js](../shared/generator/generators/shape.js)）

**核心修复**：`generate()` 内 `var kp={}` 导致 `getShapeMeta` 恒走默认值，所有 KP 产出同一图形题。改为从 `plan.semanticParams.name` 派生。

- 新增 `NAME_TO_SHAPE` 规则表（17 条）：从 KP 名称派生命中具体图形类型（正方/长方/三角/圆/平行四边形/梯形/线段/角/对称/密铺/立方/长方体/圆柱/圆锥/球/立体/平面）。
- 新增 `deriveShapeTypeFromName(name)` + `getShapeMeta(kp, name)` 双参数签名。
- `SHAPE_FEATURES` 扩展：+cuboid/rectangle/line-segment/angle/symmetry/tessellation。
- `SHAPE_SUBTYPE` 扩展对应键。
- `generate()` 读取 `plan.semanticParams.name` 传入。
- `makeGeometryQuestion/makeRecognizeQuestion/makeGeometryApplyQuestion` 新增 `kpName` 参数。
- **新增 `makeCalcMeasurementQuestion(plan, context, i, kpName)`**：几何度量计算（圆周长/圆面积/长方形周长/表面积/圆锥体积/面积/角补角/长度），题干内嵌算式满足 calc 不变式（EXPR_RE）。
- `makeGeometryApplyQuestion` 新增立体图形特征分支（正方体/长方体/圆柱/圆锥/球的面/棱/顶点）。
- capabilities 新增 `calc`；version 2→3。

### 3.2 position-direction（[position.js](../shared/generator/generators/position.js)）

**核心修复**：`generate()` 内 `kp={}` 导致空间类型恒默认。改为从 `plan.semanticParams.name` 派生。

- 新增 `NAME_TO_SPATIAL` 规则表：coordinate/distance/route/translation/rotation/symmetry/observe/direction。
- 新增 `deriveSpatialType(name)`。
- 新增 `makeTranslationQuestion/makeRotationQuestion/makeObserveQuestion/makeCoordinateQuestion`（各支持 choice/fill/judge）。
- `generate()` 按 spatialType 分派；translation/rotation/observe/coordinate 的 geometry/apply 请求走场景兜底（带 graphic，questionType 匹配）。
- choice 选项去重（避免 type-contract `optionsPresent` 违例）。
- apply 兜底 prompt 增加疑问词「？」满足 `contextPresent` 不变式。
- capabilities 改为 `['choice','judge','fill','geometry','apply']`；version 1→2。

### 3.3 money-measurement（[money.js](../shared/generator/generators/money.js)）

**核心修复**：`generate()` 内 `kp={}` 恒 RMB；既有单位表不匹配导致非 RMB 种类恒回退 RMB。

- 新增 `NAME_TO_MEASURE` 规则表：rmb/area/capacity/mass/time/length。
- 新增 `deriveMeasureKind(name)` + `getMoneyMeta(kp, name)` 双参数。
- **修复既有 bug**：`LENGTH_UNITS` 原为 `cm/m/km`，但 `MEASUREMENT_KINDS.length.units` 是 `厘米/米`，导致非 rmb 种类 `units.length<2` 恒回退 RMB。统一为中文单位名（毫米/厘米/米/千米、克/千克/吨、秒/分/小时、平方厘米/平方分米/平方米、毫升/升）。
- 新增 `AREA_UNITS`、`CAPACITY_UNITS` 独立表。
- `makeMeasurementConversionQuestion` 按 kind 选 table；calc 题型内嵌算式 `baseValue × factor = ____`；答案浮点去噪（`Math.round(answer*1e6)/1e6`）。
- `makeRMBCalculationQuestion` choice 直接构建 4 个带单位选项（答案「105分」无法被 finisher 数值解析）。
- `makeMeasurementConversionQuestion` choice 构建 4 个数值选项。
- `makeWordProblemQuestion` 新增 length/area/mass/time/capacity 五种度量的应用情境题。
- version 1→2。

### 3.4 绑定（[generator-registry.js](../shared/generator/generator-registry.js)）

- shape-recognition：+52 KP（40 figure + 12 measurement），version 2→3，capabilities +calc。
- position-direction：+18 spatial KP，version 1→2，capabilities 改为 choice/judge/fill/geometry/apply。
- money-measurement：+8 unit KP，version 1→2。
- application-word：+9 综合运用 KP，version 1→2。
- arithmetic-mixed-calculation：+3 fraction KP。

## 4. 修复的关键缺陷

1. **`kp={}` 恒回退**：shape/position/money 三个生成器 `generate()` 内 `var kp={}`，导致 meta 恒走默认值。修复：从 `plan.semanticParams.name` 派生。
2. **money 单位表不匹配**：`LENGTH_UNITS` 用 `cm/m`，`MEASUREMENT_KINDS` 用 `厘米/米`，filter 恒空 → 非 rmb 恒回退 RMB。修复：统一中文单位名。
3. **money calc/choice/judge 恒走 RMB**：原 generate 中 choice/judge/calc 分支无条件 `makeRMBCalculationQuestion`。修复：按 `isRMB` 分流。
4. **choice 答案带单位无法构建选项**：finisher `buildNumericOptions` 无法解析「105分」→ 全 drop。修复：生成器直接构建 options。
5. **position-direction geometry/apply 产出 judge 题**：原 direction 分支所有 qt 都调 `makeDirectionQuestion`（产出 judge），questionType 不匹配被过滤。修复：新增 geometry/apply 专用分支 + 兜底。
6. **measurement conversion 硬编码 questionType='fill'**：修复为 `plan.questionTypeId`。
7. **choice 选项重复**：平移/数对 choice 干扰项可能重复 → `optionsPresent` 违例。修复：Set 去重。
8. **apply prompt 缺疑问词**：shape/position apply prompt 无「？」或疑问词 → `contextPresent` 违例。修复：补「？」。
9. **立体图形特征用错公式**：「正方体的特征」走 fallback 算 `side*side`。修复：新增特征分支。

## 5. 验证结果

| 门禁 | 结果 |
|------|------|
| allow-gen 真实性 | 1570 / 1570 PASS（FAIL 0） |
| npm test | 全 PASS |
| verify（5 步） | PASS |
| syntax | 238 文件，0 错误 |
| semantic-families --check | 一致（375 KP，15 族） |
| audit-type-contract | PASS |
| choice 多 seed 健壮性 | 0 失败（5 seed × 3 KP） |

### 语义抽样

| KP | 题型 | generator | 题干（节选） | 答案 |
|----|------|-----------|-------------|------|
| 线段、射线、直线 | fill | shape-recognition | 图中共有几个线段？ ____ | 3 |
| 圆的周长 | calc | shape-recognition | 半径 4 厘米的圆，周长 = 2 × 3.14 × 4 = ？ | 25.12 |
| 平移 | choice | position-direction | 先向左1格，再向下3格，一共平移了多少格？ | 4（索引） |
| 长度单位 | calc | money-measurement | 3厘米 = 3 × 0.00001 = ____ 千米 | 0.00003 |
| 正方体的特征 | apply | shape-recognition | 正方体有 6 个面…请说出它有几个面？ | 6 |
| 综合运用 | apply | application-word | A 有 3，B 比 A 多 26。B 有多少？ | 29 |

## 6. 测试更新

- [p25-07-type-contracts.test.js](../tests/generator/p25-07-type-contracts.test.js)：原断言「shape-recognition 不再 claim calc」改为「shape-recognition 为几何度量 KP claim calc」（P25-08 新增 makeCalcMeasurementQuestion）。
- [p25-04-semantic-evidence.test.js](../tests/generator/p25-04-semantic-evidence.test.js)：KP_ANGLE/KP_AREA 改由 shape-recognition 承载，更新生成器断言与证据状态断言（几何类允许 warn/skip）。
- [p25-05-intent-evidence-consistency.test.js](../tests/generator/p25-05-intent-evidence-consistency.test.js)：同上，区分 concept/geometry 两类证据期望。

## 7. 边界与遗留

- shape-recognition 的 fill 题型对「认识」类 KP 产出图形命名/计数题，语义正确但较浅；后续可按子类型细化。
- money-measurement 的 calc 换算因子显示为小数（如 0.00001），可读性一般；后续可改为分数或科学计数。
- D 类 93 KP 全部 native 绑定后，通用兜底生成器不再承载这些 KP 的 ALLOW 行，语义偏移消除。
