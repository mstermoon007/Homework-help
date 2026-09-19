# P25-06 Generator 硬编码审计与 representation-conflict 清理

状态：已完成
日期：2026-09-19
前置：P25-03（意图矩阵，旗标输入）、P25-04/05（证据与意图门禁）

## 1. 目标与范围

BASELINE §5 点名「percent 尾缀分派是事实上的 KP 硬编码，列入 P25-06 审计项」；
P25-03 遗留 4 行 `representation-conflict` 旗标，文档标注为「P25-06/07 治理输入」。

本步范围（人工拍板）：
- **只读审计**：可复跑脚本盘点 Generator 侧 4 类硬编码，不改路由行为；
- **死代码清理**：删除 selector 中引用未定义变量、一旦误调用即 ReferenceError 的坏死函数；
- **4 行冲突同步清理**：证据核实后以「教学裁决覆盖层」在运行时禁止 4 个图形表征 KP 的 calc。

不在本步：percent 尾缀分派治理、selector pluginId 子串判定迁移、371 条 legacy ID 清理
（影响 selector 路由，列入后续专项，本步只列账）。

## 2. 审计脚本

`node dev/p25/audit-generator-hardcode.js`（只读；债务列账不阻断，一致性断言失败才 exit 1）。

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

## 6. 验证（全绿）

| 门禁 | 结果 |
|------|------|
| npm test | **302/302**（新增 p25-06 共 33 用例）|
| verify | 5/5 |
| syntax | 230 文件 / 0；lint 0 |
| kbl-uniqueness | PASS（known 0/new 0）|
| verify:allow-gen | **1566/1566**（1570 − 4 教学裁决行；脚本动态枚举无硬编码）|
| hardcode audit | 断言 A1/A2 PASS，债务 38 项列账 |

## 7. 后续债务（本步列账未治）

- H1 percent 尾缀分派 → 显式 KP→subtype 映射（外置 kbl/teaching，未知 KP fail-fast）；
- H2 17 文件 / 371 条 legacy STALE ID → 确认旧 generator 族去留后删除或重绑 canonical ID；
- H3 19 个零调用 pluginId 子串谓词 → 死代码区整体移除或迁移至 KBL semantic 字段判定。
