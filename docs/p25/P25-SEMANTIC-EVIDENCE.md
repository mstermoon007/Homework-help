# P25-04 Semantic Evidence 体系（声明制证据验证）

状态：已完成（本报告随实现同批提交）
日期：2026-09-19
前置：P25-03（意图矩阵 + AI 验证流程）、抽查闭环、trainsWhat 系统性修复

## 1. 目标

把「生成成功 ≠ 知识点正确」的验证从抽查升级为门禁：题目必须**按题声明**其体现的
语义关系，验证器对照证据规则逐条断言——声明制（非字符串匹配题面），可溯源。

## 2. 机制三件套

### 2.1 Generator 侧结构化声明
`sq.data.semanticEvidence = { relations: [...], constructs: [...] }`
- 由 maker 按题声明语义关系（如 `times-compare`、`unit-one`、`equal-partition`）。
- 仅规则行（KP×calc/fill）要求声明；其余题型可省（验证为 skip）。

### 2.2 证据规则数据 `kbl/teaching/evidence-rules.json`
- 覆盖 A 类 4 代表 KP 中**实际存在 ALLOW 的 calc/fill 行**，共 6 行：
  - math-g2-down-u03-k003 倍的认识 × calc/fill
  - math-g5-down-u04-k001 分数的意义 × calc/fill
  - math-g3-up-u07-k002 角的认识 × fill（无 calc ALLOW）
  - math-g3-down-u04-k001 面积的认识 × fill（无 calc ALLOW）
- 断言 kind 仅四种：`field`(path,value) / `fieldNot` / `relation` / `relationNot`。
- 每行 `kblAnchor` 字段记录 KBL 语义事实出处（semantic.concept / operations）。

### 2.3 验证器第 7 检查 `checkSemanticEvidence`
- 落位：shared/validator/kp-semantic-validator.js validateKpSemantics 主入口；
  新增错误码 `KP_SEMANTIC_EVIDENCE`（semantic-question.schema.js）。
- 四态（result.semanticEvidence 与 checks.semanticEvidence 同值）：
  | 态 | 条件 | 影响 |
  |----|------|------|
  | skip | 该 KP×题型 无规则 | 不干预（默认态，375−4 KP 全部走此态）|
  | warn | 有规则但题面未声明 | 仅 WARNING（过渡期，不阻断 allow-gen 管线）|
  | pass | 声明齐 + required 全满足 + forbidden 无命中 | — |
  | fail | required 缺失或 forbidden 命中 | SEVERITY.ERROR，detail.missing / detail.forbiddenHits 可溯源 |
- **未放宽既有 6 检查**（kpIdentity/questionType/operation/numeric/structure/content 原样）。

## 3. 关键工程决策

### 3.1 4 代表 KP 专属生成器 `generator:concept-meaning`
设计前提「4 KP 的 generator（registry 查绑定）」在运行时**不成立**：4 KP 无原生绑定，
被泛型兜底产出错误语义题（探针实证）：
- 倍的认识 ×calc → `generator:arithmetic-addition` 出「8 + 8 + 3 = ?」（加法冒充倍）
- 分数的意义 ×fill → `generator:code-recognition` 出「学号编码」题（编码冒充分数）

处置沿用 P24-02 percent.js 先例：新建 `shared/generator/generators/concept-meaning.js`
（1 个 generator，4 KP 分 maker），CORE_RECORDS 增 1 条 native 绑定。

**题型覆盖约束（重要）**：selector 中 kp=1 胜出不分题型（percent-calc 捕获 choice 并产出
「列式计算」贴 choice 标签为既存实证）。因此 native 绑定必须覆盖 4 KP 的**全部 ALLOW
题型**（18 行：倍/分数×calc,fill,apply,choice；角/面积×fill,apply,choice,geometry,judge），
否则相应 ALLOW 行 0 产出会破坏 verify:allow-gen 1570 门禁。make 返回空数组不会回退到
其他候选（u07-k001×calc 失败路径实证），绑定即责任。

### 3.2 证据规则加载 = 计算路径 require（防 bundle 内联）
- dev 门禁链走 strategy-engine.bundle.js（`dev/_bundle-env.js` 挂全局）。
- build-strategy-bundle.js 的静态正则会把**相对路径字面量 require** 的文件内联进 bundle；
  evidence-rules.json 的规则键是 canonical KP id，一旦内联即触发 check-kbl-uniqueness
  「bundle 内嵌 canonical 数据」。
- 处置：validator 内 `require('../../' + 'kbl/' + 'teaching/' + 'evidence-rules.json')`
  计算路径——构建期正则不匹配（不内联），Node 直载正常读取，浏览器运行时 `__req`
  未注册该 id 抛错被捕获 → 规则表空 → 全部 skip（证据门禁为 Node 侧/dev 门禁职责）。

### 3.3 KP 分派防唯一性门禁
concept-meaning.js 源码不裸写 canonical KP 字面量：解析 plan.knowledgePointId 的
「年级-单元-序号」组合键（g2-u03-k003 / g5-u04-k001 / g3-u07-k002 / g3-u04-k001）查
KP_MAKERS，与 percent.js 尾缀手法同源；绑定清单唯一真值源仍在 registry 的
`knowledgePoints: [...]`（门禁白名单形态）。

## 4. 验证与门禁（全绿）

| 门禁 | 结果 |
|------|------|
| npm test | 259/259（新增 10 用例：skip/pass/warn/fail ×四态、规则数据完整性、绑定与 selector 首选、ALLOW 全覆盖不变式、端到端规则行 PASS、端到端全 ALLOW 行生成）|
| npm run verify | 5/5 |
| verify:syntax | 227 文件 / 0 |
| check-lint | 0 |
| check:sw-version | hw-help-5.0.0 一致 |
| verify:allow-gen | 1570/1570（4 KP 18 行改由 concept-meaning 承载）|
| scan-capacity --refresh | capacity-map 重建（registry 变更后必跑）|
| check-kbl-uniqueness | bundle 无内嵌 canonical 数据（计算路径 require 未内联）|

运行时实证（重建 bundle 后冒烟）：18/18 行路由至 generator:concept-meaning，题型/KP
一致；6 规则行证据 pass，其余 12 行 skip。

## 5. 边界与后续

- WARN 过渡态：若有规则行被未声明生成器承载（当前不存在——规则行全部由
  concept-meaning 承载且 PASS），该态保留给未来规则扩展期使用。
- 规则行仅 calc/fill：choice/apply/judge/geometry 的证据化属 P25 Stage2 深化
  （P25-06/07 生成与验证深化顺延扩展），不在本步承诺内。
- percent-calc 捕获 choice 产「列式计算」贴标签的既存缺陷已实证记录，留待
  P25-07 题型边界专项处理（未在本步放宽或修改）。
