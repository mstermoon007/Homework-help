# P25-07 七题型教育契约（Type Contracts）

> 状态：完成 ｜ 分支：`01page-report` ｜ 前置：P25-06（60e450c）
> 红线遵守：不新增 QuestionType、不改 math.json、不改 root Excel（SHA256 由 Q10 门禁守护）

## 1. 背景与钩子

P25-SEMANTIC-EVIDENCE §5 记录了既存缺陷：**percent-calc 捕获 choice 产「列式计算」贴标签**——题型标签与交付形态脱节。全量实证审计（371 条违例）表明这不是孤例，而是**题型无契约**的系统性问题：任何生成器可以对任意题型贴标签，产出「无算式 calc / 无选项 choice / 非布尔 judge / 无空位 fill / 无情境 apply」。

P25-07 建立**声明制教育契约**：每个规范题型声明交付形态不变式（机器可判定），生成管道单点收口保证，验证器独立复核，审计脚本全量阻断。

## 2. 契约三类产物

| 层 | 产物 | 职责 |
|---|---|---|
| SSOT | `kbl/teaching/type-contracts.json`（schemaVersion p25-07.1） | 7 题型 × {教育定位 goal、结构不变式 invariants、禁则 boundaries、转换能力 conversion}；8 个 invariantKinds 定义 |
| 执行层 | `shared/generator/core/type-contract.js` | `CONTRACT_MAP` 不变式判定 + `FORM_BOUND` + convertible finisher + `enforce` fail-closed 收口 |
| 验证层 | `kp-semantic-validator.js` 第 9 检查 `checkTypeContract` | 逐题独立复核，违例 → `KP_TYPE_CONTRACT`（ERROR） |
| 审计层 | `dev/p25/audit-type-contract.js` | A：JSON↔code 对齐断言（防漂移）；B：全量 ALLOW 复扫 0 违例阻断 |

### 2.1 七题型契约速览

| 题型 | 不变式 | conversion | 落实机制 |
|---|---|---|---|
| calc 计算题 | expressionPresent（可求值算式 / data.operation / 空位等式） | **form-bound** | selector 声明门：候选必须声明 calc |
| fill 填空题 | blankPresent | convertible | finisher 追加空位 |
| choice 选择题 | optionsPresent + answerInOptions | convertible | finisher：索引约定归一 / 数值重建 / 序列置换 |
| judge 判断题 | booleanAnswer | convertible | finisher 数值±1 / 余数 / 序列命题化 |
| geometry 操作作图题 | graphicOrInstruction | **form-bound** | selector 声明门 |
| classify 分类整理题 | groupStructure | **form-bound** | selector 声明门 |
| apply 解决问题 | contextPresent | convertible | finisher 情境包装 |

**form-bound（calc/geometry/classify）**：题型形态与内容绑定，不可由其它形态机械转换——selector 候选阶段直接排除未声明该题型的生成器（native kp 绑定不豁免）。**convertible（choice/judge/fill/apply）**：结构可由语义基底机械转换——`wrapGenerator` 单点 `TypeContract.enforce` finish，不可转换 → drop（fail-closed），trace 写入 `metadata.typeContract`。

## 3. 源修 vs finisher 自动：371 条违例分工定案

- **fill 111 / choice 数值与序列 87 / apply 39 / judge 25**：finisher 机械转换覆盖，无需源修。
- **必须源修**：
  - `stats.js`（judge 2 / calc 2 / choice 8）：`data` 声明上移；bar-chart||chart-read **共用分支**（末尾 else READ_Q 为死代码）加 choice（真实读数选项）/judge（真值 ±1 命题）/calc（「最多−最少」差值列式）适配；`answer` boolean 不再被 `String()` 串化；`answerMode` 按 choiceForm/judgeForm 分派。
  - `reasoning.js`（calc 1 / choice 5 / fill 5）：chicken-rabbit 三变体补 `choicePool`（4 项『鸡X只，兔Y只』）；logic LGV==1 答案单值化；choice 形态 return 分支；顺手修 `rabb0` 可能产生 0 只鸡的下界。
  - `counting.js`（calc 1）／`picture-equation.js`（calc 4）：题干内嵌算式（搭配乘法 / 大括号加法）。
  - `percent.js`（calc 5）：5 个 maker 全部加 calc 分支——互化走 `=（ ）%` 空位等式、折扣/利率/达标线/增减走 `列式：a × b% = ？` 形态。
  - `semantic-relations.js`（calc 2）：makeScaleCalc / makePropCalc 题干嵌算式。
  - `shape.js`（choice 14）：classification 选项改中文名（消 undefined/null 选项）；`getShapeMeta` legacyType 缺失回退 `'flat'`。
  - `generator-registry.js`：reasoning 摘 calc（推理问答题形态，不承载 form-bound）；code-recognition 摘 recognize（normList 归一后即 geometry，编码题无图形表征，(g4-up-u01-k002, geometry) 由 shape-recognition 承载）；**shape-recognition 摘 `oral`**（见 §4.1）。

## 4. 实证期两大根因（allow-gen 修复链）

### 4.1 历史 token 归一产生伪 calc 声明（140 行失败）

`generator-registry.normList` 将 manifest 历史 token 归一为规范 7 类（oral→calc / recognize→geometry）。shape-recognition 历史上声明过 `oral`，归一后**实际 claim 了 calc**——但它无列式形态。P25-07 将其 version 升 2（选项修复留痕）后，tie-break 翻转使其赢得全部无 kp 绑定 calc 行 → 产出 0 题 → 140 行 FAIL。

**修法**（符合「binding implies responsibility」）：摘除 `oral` 伪声明。这同时是 P25-07 的语义修正：未声明 form-bound 题型的生成器不得因历史 token 假性入候选。

### 4.2 裸值答案（4 行失败）

application-word 的 choice/judge 产出 `answer` 为**裸 string/boolean**（索引约定 `"0"` / 布尔 `false`），未按 `{ value, acceptable }` 对象形态——`enforce` 入口新增裸值归一（boolean 保型不串化），choice 数值选项经 finishChoice ① 归一为值约定字符串选项。

### 4.3 P17-15 Q2 前提变更留痕

`math-g2-down-u01-k001`（钟面）×calc 在 P17-1 审计「真实容量=1」，根因是旧 stats calc 产出与条目种子无关的同一道题、被去重削减为 1。P25-07 stats calc 收敛为差值列式后按条目种子出题，**真实容量提升至 ≥3**（37−21 / 58−24 / 60−34 三题互异合规）——Q2 改为断言 SUCCESS + 3 题互异，短产如实上报不变量由 Q3（geometry PARTIAL）继续覆盖。

## 5. 工程事实

- **bundle 内联分布**：generator-registry / selector / type-contract / validator 内联于 **strategy bundle**（presentation 委托 71 模块）——改这些源码后必须 `build:strategy` + `build:presentation` 双重建，否则 Node 直连（源码路径）与 allow-gen（bundle 路径）结论分裂。
- type-contract.js 为**纯代码模块**（无 kbl/ 数据），可安全内联——第 9 检查在 Node 与 bundle 环境同效（与 evidence / intent-relations 的 bundle-skip 策略不同）。
- 直连 `node -e` 无 KC → `SemanticParameters.attachToPlan` 返回 null → percent/semantic-relations 直连 generate 返回 `[]` 是既有 fail-closed 行为，非缺陷。

## 6. 门禁结果

| 门禁 | 结果 |
|---|---|
| npm test | **380/380**（新增 p25-07 21 用例；P17-15 Q2 前提变更留痕） |
| verify（M0） | 5/5 PASS |
| allow-gen | **1570/1570** |
| audit-type-contract | A 对齐 PASS（7 题型/8 不变式）+ B 复扫 1570 题 **0 违例** |
| verify:syntax | 238 文件 / 0 错误 |
| check-lint | 0 违规 |
| families --check | PASS（375 KP / 15 族） |

## 7. 交付物清单

- 数据：`kbl/teaching/type-contracts.json`（新增）
- 执行层：`shared/generator/core/type-contract.js`（新增）
- selector：`shared/generator/generator-selector.js`（form-bound 声明门 + enforce 单点收口）
- 生成器源修：stats / reasoning / counting / picture-equation / percent / semantic-relations / shape / generator-registry（8 文件）
- 验证器：`shared/validator/kp-semantic-validator.js`（第 9 检查）
- schema：`shared/schemas/semantic-question.schema.js`（`KP_TYPE_CONTRACT` 错误码）
- 审计：`dev/p25/audit-type-contract.js`（新增）
- 测试：`tests/generator/p25-07-type-contracts.test.js`（新增，21 用例）
- 测试留痕：`tests/orchestration/p17-15-quantity-closure.test.js`（Q2 前提变更）

## 8. 下一步

计划本体 P25-08（未开始）。Stage1（03-05 意图与证据）+ P25-06（语义参数消费）+ P25-07（题型契约）后，生成质量门禁链为：语义族 → 语义参数 → 意图×证据一致 → **题型契约不变式** → KP 语义验证 9 检查 → allow-gen 真实性。
