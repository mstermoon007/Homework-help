# P28-Question-Type-Closure — 旧题型令牌收口审计

| 项 | 值 |
|---|---|
| 任务 | P28-07 题型最终收口：规范 7 类（calc/fill/choice/judge/geometry/classify/apply）；旧令牌（oral/recognize/open）只存在于 normalizeQuestionType，不得进入生产能力声明 |
| 执行日期 | 2026-09-20 |
| 判定规则 | Registry=7、Strategy=7、Generator capability=canonical、Validator=canonical、Presentation=canonical；`oral/recognize/open` 在生产代码中出现的位置必须属于 normalize 层或非题型命名空间 |

## 1. 五面审计结论

| 面 | 约束 | 结论 |
|---|---|---|
| **Registry**（question-type-registry） | TYPES 恰为 7 类 | ✅ 本就 7 类；别名/关键字/heuristic 全部收敛在 `normalizeQuestionType` 及其别名表中 |
| **Strategy** | 题型集=7 | ✅ `VALID_QUESTION_TYPES = Registry.all()`（7）；question-type-strategy 经 `Registry.has`/`normalizeQuestionType`；question-style-strategy 的 STYLE_REGISTRY 为 canonical 7 |
| **Generator capability** | 能力声明=canonical | ✅ 本次收口核心（见 §2）；31 生成器 `records()` 全部 canonical |
| **Validator** | 题型集=canonical | ✅ TypeContract `CONTRACT_MAP` 恰为 7；kp-semantic-validator 校验 allowed 列表（canonical） |
| **Presentation** | 题型集=canonical | ✅ 无旧令牌；仅透传 `sq.questionType` |

生成器运行时边界：`generator-selector.js` `wrapGenerator` 现为**唯一生成器边界归一单点**——任何旧令牌在进入具体 generator 前被 `normalizeQuestionType` 归一为规范 7 类，旧令牌不得再作为生成器分支或能力输入（见 §2.3）。

## 2. 整改明细（本任务已执行）

### 2.1 生成器能力声明去旧令牌（Generator 能力面）
`shared/generator/generator-registry.js` `CORE_RECORDS` 能力/题型数组改为 canonical，去重后与 `normList` 既有归一输出**逐字一致**（零运行时行为差）：

| 生成器 | 声明变更 |
|---|---|
| arithmetic-addition/subtraction/multiplication/division/mixed-calculation（×5） | `['oral','calc','fill','apply']` → `['calc','fill','apply']` |
| selection-fill / choice / judge（×3） | 去 `recognize`、`oral` → `['…','geometry','calc','apply']` |
| complex-calc | `['calc','fill','oral']` → `['calc','fill']` |
| shape-recognition | 去 `recognize` → `['choice','judge','fill','calc','geometry','apply']` |
| application-word | 去 `oral`、`open` → `['apply','fill','choice','judge','calc']` |
| c9-comprehensive | 去 `open` → `['apply','calc']` |
| composite | 去 `oral` → `['calc','judge','fill','apply']` |

同步校准：
- `shared/generator/generators/c9-comprehensive.js` spec：`['apply','calc','open']` → `['apply','calc']`（文件级能力声明与会注册表对齐）。
- `shared/generator/registry-facade.js` 示例注释：`questionType:'oral'` → `questionType:'calc'`。
- `CORE_RECORDS` 注册注释重写：声明一律 canonical，历史令牌只经 `normalizeQuestionType` 归一。

### 2.2 生成器内旧令牌分支清除（normalize 层外零令牌）
- `shared/generator/generators/application.js`：删除 `if (qt === 'open')` 竞赛开放模板分支。该分支仅对**绕过归一**的原始 `open` 单元生效（生产链 request→strategy→POL 均归一为 `apply`），且无任何测试覆盖；开放题语义按设计「competition 为模式/标签，落点归 apply」由规范 apply 路径承载。
- `shared/generator/generators/shape.js`：删除 `else if (qt === 'recognize')` 分支及 `questionType:'recognize'` 的 `makeRecognizeQuestion`（非规范输出，原先靠 enforce「非规范题型不约束」放行）。认读形几何题由规范 `geometry` 分支 (`makeGeometryQuestion`) 承载。

### 2.3 生成器边界归一单点
`shared/generator/generator-selector.js` `wrapGenerator`：在 `SemanticParameters.attachToPlan` 之前对 `plan.questionTypeId` 调一次 `QuestionTypeRegistry.normalizeQuestionType(…, {allowHeuristic:false})`，使下游 `generate` 一律消费 canonical 7 类。旧令牌从此只存在于：
1. `question-type-registry.js` 的 `normalizeQuestionType` 别名表/关键字；
2. 各入口把它们交给 `normalizeQuestionType` 的那一次调用（request-normalize / strategy-request / capability-resolver / question-style-strategy / generator-selector / wrapGenerator）。

## 3. 保留项与理由（令牌所在但非生产能力声明）

| # | 位置 | 命名空间 | 理由 |
|---|---|---|---|
| 3.1 | `shared/knowledge/question-type-registry.js` | normalize SSOT | `CANONICAL_ALIASES` / `GEOMETRY_KEYWORDS` / `RECOGNIZE_KEYWORDS` 即 `normalizeQuestionType` 本体；`get/has/supports` 对其只读解析；`LEGACY_DISPLAY_NAMES` 为深链展示名表（非能力） |
| 3.2 | `shared/knowledge/question-type-registry.js` / `shared/strategy/cognitive-strategy.js` / `question-plan.js:17` / `difficulty-integrity-validator.js:91` | 认知层级 | `recognize` 属 Bloom 认知层级（recall/recognize/understand/…），与题型同名但不同命名空间，registry `COGNITIVE_LEVELS` 权威定义 |
| 3.3 | `shared/strategy/question-plan.js:138` | 样式 | `VALID_STYLES` 含 `open`＝开放表达样式（question-style-strategy 文档样式族），非题型声明 |
| 3.4 | `shared/catalog/difficulty.js` / `difficulty-static.js` | 难度插件类型 | `oral/recognize/open` 为难度权威 pluginType 词汇（`'oral':'operate'`），非题型能力声明；受 `tests/difficulty/difficulty-static-weights.test.js` 约束 |
| 3.5 | `shared/catalog/catalog-utils.js:185` | 渲染标签 | 模块卡题型中文标签表（`'oral':'口算'`），纯 UI 展示 |
| 3.6 | `shared/generator/generator-registry.js:39/107` | 历史注释 | 「摘除 oral/recognize」历史决策注记，非运行码 |

## 4. 验证（全绿）

| 门禁 | 结果 |
|---|---|
| `npm test` | 480 / 480 PASS |
| `npm run verify` | 8 / 8 PASS |
| `node dev/p28/check-cross-layer.js` | PASS（新增违规边 0） |
| `npm run verify:syntax` | 270 文件 / 0 错误 |
| `npm run verify:allow-gen` | 1570 / 1570 PASS |
| `node dev/check-kbl-uniqueness.js` | PASS（known 0 / new 0） |

构建：`npm run build:strategy`（modules 67 / shims 7）、`npm run build:presentation`（inlined 24 / delegated 74）。产物 `shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`。

冻结不变量：`kbl/` manifest `rootHash` 未触碰；Registry 31 生成器 `records()` 输出在收口前后逐字一致。