# P25-06 Generator 硬编码审计与 representation-conflict 清理

状态：**本体已完成（审计 → 裁决 → 语义参数链路治理 → 裁决撤销）**
日期：2026-09-19
前置：P25-03（意图矩阵，旗标输入）、P25-04/05（证据与意图门禁）

> 本文档前 5 节为 P25-06 **审计阶段**（只读列账 + 4 条教学裁决）的原始记录；
> 第 8 节起为 **P25-06 本体执行**：建立 GenerationParameters 语义参数消费链路、
> 治理 H1/H2/H3 全部列账债务、补齐 4 KP 参数化生成器并撤销裁决，
> 运行时有效能力 **1566 → 1570 恢复全量**。

## 1. 目标与范围

BASELINE §5 点名「percent 尾缀分派是事实上的 KP 硬编码，列入 P25-06 审计项」；
P25-03 遗留 4 行 `representation-conflict` 旗标，文档标注为「P25-06/07 治理输入」。

审计阶段范围（人工拍板）：
- **只读审计**：可复跑脚本盘点 Generator 侧 4 类硬编码，不改路由行为；
- **死代码清理**：删除 selector 中引用未定义变量、一旦误调用即 ReferenceError 的坏死函数；
- **4 行冲突同步清理**：证据核实后以「教学裁决覆盖层」在运行时禁止 4 个图形表征 KP 的 calc。

本体阶段（见 §8）：percent 尾缀分派治理、selector pluginId 子串判定迁移、371 条 legacy ID
清理、4 KP 参数化生成器与裁决撤销——原列账三项后续债务已全部归零。

## 2. 审计脚本

`node dev/p25/audit-generator-hardcode.js`（只读）。审计阶段债务列账不阻断；
**本体后改为零容忍门禁**：H1/H2/H3 任一复现或 A1/A2/A3 断言失败即 exit 1，
H4 正当 override 仅登记不阻断。

| 类别 | 模式 | 发现 |
|------|------|------|
| H1 尾缀分派 | `kpId.slice(-3)` 等尾缀推导行为 | 1 处：percent.js:215（k001–k006 maker 分派，未知尾缀静默退回 k001）|
| H2 STALE KP 清单 | generator 内 `knowledgePoints` 用了不在 canonical 375 的 ID | **17 个文件 / 371 条**，全部为旧 legacy 体系（math-gN-mN- / c1–c9 竞赛 ID），native binding 永不命中，仅靠 capability 兜底 |
| H3 pluginId 子串猜语义 | `pluginId.indexOf('c3-'/'money'/'competition')` 等 | 19 个谓词，**全部零调用**（selector 重构遗留死区）|
| H4 显式 ID override | resolver 按完整 KP ID 指定语义 profile | 1 处（dec-mult，有注释声明正当性，ID 实测存在）|

一致性断言：
- A1 resolver 教学裁决代码表与 `kbl/teaching/teaching-denials.json` SSOT 集合一致（防漂移）；
- A2 selector 坏死函数已清除。

## 3. representation-conflict 4 行清理

### 3.1 证据（2026-09-19 PracticeSession 实测，calc 实际产出）

| KP | 名称 | calc 实生成 | 判定 |
|----|------|------------|------|
| math-g1-down-u06-k002 | 图形表述数量关系（借画图理解加减关系）| `47 + 62 = ?` | 通用双加兜底，语义无关 |
| math-g2-down-u02-k005 | 周期问题（有余数除法找图形规律）| `5 ÷ 1 + 12 = ?` | 通用混式兜底 |
| math-g6-down-u04-k007 | 图形的放大与缩小（按比变换）| `7 + 28 = ?` | 通用加法兜底 |
| math-g6-down-u04-k008 | 正反比例解决问题 | `83 + 10 + 65 = ?` | 通用三连加兜底（且 analyze 超 calc 认知区间，三旗标）|

4 KP 均含 `graphic` 表征而 calc 题型 `supports.graphic=false`；无原生语义生成器，
兜底题与 KP 教学语义无关。同 KP 的 fill/apply/choice/geometry 保留（本批只裁决 calc）。

### 3.2 机制：教学裁决覆盖层（不改 canonical 事实）

canonical ALLOW 由 `tools/kbl/derive-kbl.js` 从 root Excel 机械派生，工具约束明确
「不产生第二人工知识源」——故**不修改 mappings.json / generation-contract**（仍 1570 行），
而在其上叠加教学裁决：

1. **裁决 SSOT** [teaching-denials.json](../../kbl/teaching/teaching-denials.json)：
   4 条 `{knowledgeId, questionType:calc, kind:execution-gap, reason, evidence, retainedTypes}`，
   记录裁决人/批次/证据；
2. **运行时执行点** [capability-resolver.js](../../shared/capability/capability-resolver.js)：
   `TEACHING_DENIALS` ID 引用表（不内嵌 canonical 载荷，同 generator-registry knowledgePoints 先例），
   两个决策入口同源覆盖——
   - `resolveFinal`：矩阵 ALLOW/DEGRADE 命中裁决 → **FORBID** + `source.teachingDenial='P25-06'`
     + `confidence='teaching-denied'`（复用 FORBID 全部既有行为，避免新枚举漏接）；
   - `getCapabilities`：被 deny 题型从能力列表剔除（strategy Step3 选题型不再选 calc）；
3. 传导链路（无需额外接线）：
   `resolveFinal → buildEligibility 归 skip → POL 不规划`；
   `check-allow-generation` 按 `matrix==='ALLOW'` 动态枚举 → 自动只验剩余对数；
   前端 select 页能力视图同源（strategy bundle 内联 resolver）。

裁决语义是 `execution-gap`（执行缺口，非教学永久错误）：意图描述 P25-03 可成立，
但当前无原生生成器；待专项语义生成器补齐后由人工撤销裁决即可恢复。

### 3.3 端到端行为

- 显式请求 4 KP 的 calc：denial 前静默产出兜底题；denial 后 **fail-fast**
  「该配置下没有可生成的题目」；
- 4 KP 的 fill 等仍正常生成（测试冻结）。

## 4. 死代码清理

[generator-selector.js](../../shared/generator/generator-selector.js)：
- 删除 `hasShapeSemantics(kp){ return g.id === ... }`（函数体引用未定义变量 `g`，
  被下文同名正确函数覆盖，属潜在 ReferenceError 死代码）；
- 删除相邻无调用的 `isC9Family(g)`。
- 其余 18 个零调用谓词（H3）本步不扩大删除，审计脚本列账。

## 5. 关键工程发现

1. **`canUseQuestionType` 全仓零调用**（knowledge-policy/runtime/api 三处定义转发，无消费方）
   ——它不是 ALLOW 运行时闸门；真正闸门是 `capability-resolver.resolveFinal`（R04 矩阵）。
2. **resolver 双决策入口必须同改**：buildEligibility 走 resolveFinal；
   strategy Step3 走 getCapabilities（经 capabilityModel）。只改一处会决策分叉。
3. **Node/浏览器同源于 bundle**：capability-resolver 依赖的 ontology 经 bundle shim 解析，
   Node 侧实际也走 strategy bundle 内联副本——改 resolver 源后必须 `build:strategy`
   （本步两个 bundle 均已重建，git diff 复跑为空）。
4. **uniqueness 门禁扩展**：其 bundle 扫描本就剥离 `knowledgePoints:[...]` 合法 ID 引用；
   本步为 `TEACHING_DENIALS` 表增加同款剥离（纯 ID 引用、无数据载荷，SSOT 在 kbl/teaching）。

## 6. 验证（审计阶段，2026-09-19）

| 门禁 | 结果 |
|------|------|
| npm test | **302/302**（新增 p25-06 共 33 用例）|
| verify | 5/5 |
| syntax | 230 文件 / 0；lint 0 |
| kbl-uniqueness | PASS（known 0/new 0）|
| verify:allow-gen | **1566/1566**（1570 − 4 教学裁决行；脚本动态枚举无硬编码）|
| hardcode audit | 断言 A1/A2 PASS，债务 38 项列账 |

## 7. 后续债务（审计阶段列账 → 本体已全部治理，见 §8）

- ~~H1 percent 尾缀分派 → 语义参数 subTopic 机械派生 + fail-closed~~ **已治（§8.2）**；
- ~~H2 17 文件 / 371 条 legacy STALE ID → 清空，绑定 SSOT 归 generator-registry~~ **已治（§8.3）**；
- ~~H3 19 个零调用 pluginId 子串谓词 → 整体移除~~ **已治（§8.4）**；
- H4 1 处显式 ID override（dec-mult）经评审正当，保留并由审计持续登记。

---

# P25-06 本体执行：GenerationParameters 语义参数消费链路

状态：已完成（2026-09-19）；运行时有效能力 **1570/1570**。

## 8. 链路设计

消费链路（单向，无自决）：

```
SemanticProfile（kbl/teaching/semantic-families.json + KBL name/concept）
  → QuestionIntent（kbl/teaching/qt-intent.json，题型意图）
  → GenerationParameters（shared/generator/core/semantic-parameters.js，运行时 read model）
  → Selector 选定生成器后 attachToPlan(plan) 注入 plan.semanticParams
  → Generator 只读 params.subTopic 分派 maker，无参数/无 maker 一律返回 []（fail-closed）
```

关键约束：

1. **SSOT 在 KBL**：subTopic 不由任何 KP ID 形态推导，而是按
   「语义族收窄 + KBL name/concept 关键词」的 14 条顺序敏感机械规则派生
   （`SUBTOPIC_RULES`），每条命中输出证据 `{rule, family, field, matched}`。
   规则对 bundle 降级环境（无 teaching JSON）双环境等价，由审计 A3 对全部
   14 个绑定 KP 逐条断言。
2. **取数单入口**：模块不直接 require 知识层文件（kbl-access/kbl-uniqueness 门禁），
   KP 事实只从运行时单入口 `global.KnowledgeContext`（orchestration API，
   背后即 `App.KNOWLEDGE`）读取；`kbl/teaching/*.json` 用拆分字符串计算路径 require
   防 bundle 内联，取不到即降级。
3. **注入单点**：selector `wrapGenerator` 在 `gen.generate` 前统一
   `attachToPlan(plan)`（浅拷贝，不改写入参；与 retry-loop 的
   `Object.assign({}, plan)` 兼容），presentation-engine / generation-core
   两入口都经 instantiate，天然单点。
4. **Generator 红线不变**：不自决 questionType/count/difficulty，
   不做 KP ID 尾缀/子串猜测。

14 个绑定 KP 的派生结果（审计/测试冻结）：

| 生成器 | KP | subTopic |
|--------|----|----------|
| generator:percent-calc | math-g6-up-u05-k001…k006 | percent-of / percent-conversion / percent-discount / percent-interest / percent-target-rate / percent-change |
| generator:concept-meaning | 倍/角/面积/分数的认识 4 KP | times-concept / angle-concept / area-concept / fraction-meaning |
| generator:semantic-relations | 4 个图形表征 KP（见 §9） | pictorial-additive-relation / periodic-pattern / scale-transform / proportion-application |

## 8.2 H1 治理：尾缀分派 → subTopic 语义分派

- [percent.js](../../shared/generator/generators/percent.js)：删除 `slice(-3)` 键
  '001'–'006' 的 `SUBTYPE_MAKERS` 与 `subtypeMaker`，改为 6 个语义键；
- [concept-meaning.js](../../shared/generator/generators/concept-meaning.js)：删除
  年级-单元-序号正则 `KP_KEY_RE/kpMakerKey`，改为 4 subTopic × 题型行的语义分派；
- 两者统一 `paramsOf(plan)`（优先 `plan.semanticParams`，缺省即时 resolve 兜底）
  + **fail-closed：无 maker 返回 []**，禁止静默退回旧 '001' 兜底。

## 8.3 H2 治理：371 条 legacy STALE ID 清零

17 个 generator 文件（c1/c2/c5-c6/c7/c9、reasoning、picture-equation、counting、
stats、position、composite、money、complex、application、shape、semantic-special、
classify）删除全部 `XXX_KPS` legacy 常量与 `spec.knowledgePoints || [legacy...]`
fallback，统一为 `|| []`；**绑定 SSOT 收敛到
[generator-registry.js](../../shared/generator/generator-registry.js) CORE_RECORDS**
（注册表已是路由打分的唯一绑定来源，常量零调用、native binding 永不命中）。
审计 H2 扫描 generators/ 全目录，发现任何不在 canonical 375 的具体 ID 即 FAIL。

## 8.4 H3 治理：selector 子串谓词整体移除

[generator-selector.js](../../shared/generator/generator-selector.js) 删除全部
19 个零调用谓词（14 个 `is*Family` + `has*Semantics` 区域）、ArithSem/ComplexSem
require 与死变量；语义判定不再以 `pluginId.indexOf(...)` 字符串约定承载。
审计 A2 对任何 `function has*Semantics(...) / is*Family(...)` 形态零容忍。

## 9. 4 KP 参数化生成器与裁决撤销

新建 [semantic-relations.js](../../shared/generator/generators/semantic-relations.js)
（id `generator:semantic-relations`）：4 subTopic × 5 题型（calc/fill/apply/
choice/geometry）= 20 个参数化 maker，命题范围：

- pictorial-additive-relation：条线图/部分整体一步加减（barModel 标记，ops add/sub）；
- periodic-pattern：`k÷n` 余数定图形（ops div，data 带 periodLength/remainder）；
- scale-transform：放大 k:1 / 缩小 1:k（orig 保证为 k 倍数，ops 不声明）；
- proportion-application：正比例归一与反比例（rows2Choices 保证整除）。

全部 Rng seeded、choice 走 finishChoice、20 项经 kp-semantic-validator 0 ERROR。
注册表新增 1 条 CORE_RECORD（绑定 4 KP、5 题型）；同时把
math-g2-down-u02-k005 从 arithmetic-division 绑定移除（有余数除法只是周期判定工具，
同 kp 多生成器同分时注册表顺序决定胜出，必须摘除）。

裁决撤销（留痕不抹账）：

- [capability-resolver.js](../../shared/capability/capability-resolver.js)
  `TEACHING_DENIALS = {}`（ACTIVE 空表；isTeachingDenied/listTeachingDenials 机制保留）；
- [teaching-denials.json](../../kbl/teaching/teaching-denials.json) 4 行保留并标
  `"status":"revoked"`，各带 `resolution{revokedAt, revokedBy, replacedBy:
  "generator:semantic-relations", verification}`；
- 审计 A1 改为「resolver ACTIVE 表 ↔ JSON 中 status≠revoked 行」集合一致
  （当前空 ↔ 0 条 active，revoked 4 条永久留痕）。

## 10. 本体验证（全绿，2026-09-19）

| 门禁 | 结果 |
|------|------|
| npm test | **359/359**（含重写 p25-06-teaching-denials 与新增 p25-06-semantic-params 共 74 用例）|
| npm run verify | 5/5（含 kbl-access / kbl-uniqueness：新模块零越权）|
| verify:allow-gen | **1570/1570**（4 条 calc 恢复且真实生成，无硬编码）|
| verify:syntax | 235 文件 / 0；check-lint 0 |
| derive-semantic-families --check | PASS（375 KP / 15 族）|
| hardcode audit | **H1=0 H2=0 H3=0，H4=1（正当登记）；A1/A2/A3 PASS** |

红线复核：未新增 QuestionType、未改 math.json、未改 root Excel；
teaching JSON 未被 bundle 内联；selector/registry/generators 改动后已重建
strategy bundle（63 modules / 7 shims）。
