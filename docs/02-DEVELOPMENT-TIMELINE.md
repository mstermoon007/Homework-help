# 02-DEVELOPMENT-TIMELINE — 开发时间轴

> 状态：FROZEN（只读；时间轴是文档有效性的唯一判断依据）
> 本文档回答：项目是如何一步一步走到现在的。
> 历史细节见 `archive/`（ARCHIVED，不得作为当前开发依据）。

---

## T0｜基础架构阶段 — ARCHIVED

基础页面 / 数学生成系统 / KnowledgeBank / Generator / Strategy / Practice / Presentation。
历史架构，不再作为当前设计依据。

## T1｜KBL 数据治理 — FROZEN

KnowledgeBank → KBL Runtime：598 KP / 128 Units / 1293 Relations / 639 Allow mappings；
Canonical ID `{subject}-{grade}-{book}-u{nn}-k{nnn}`。旧 KnowledgeBank 架构文档 SUPERSEDED。

## T2｜难度系统收口 — FROZEN

唯一 Difficulty Core（`shared/catalog/difficulty.js`）+ 静态七维目录。其他层只读取/协调/传递。

## T3｜POL 编排层 — FROZEN

Request → Range Resolution → KP×QT Cell → Quota → Count Planning → Difficulty Coordination → Generation Plan。
POL 只负责编排/数量/Cell/Quota/难度协调；不负责 Render/Print/SVG/教育策略决策/Generator 选择。

## T4｜七类题型统一（P0-11-A）— FROZEN

SSOT：`shared/knowledge/question-type-registry.js`。Registry→Request→POL→Strategy→Selector→Generator→Validator→Presentation→Practice 全链 7/7 覆盖；第二套 canonical = 0；oral 归一 calc。12 文件修改，真实七类生成 PASS。

## T5｜GAP-4 + P0-05 FINAL — FROZEN

Generation Plan Executor 唯一化（`shared/generation/api.js`；`generation-engine.js` 降级薄代理）。
KBL → KnowledgeContext → KP×QT → Strategy → Generation Requirements → Selector → Generator 教育属性转换闭环。
Selector 为 Generator 选择唯一权威。`npm run verify` 5/5、语法 0 错误、七类真实生成 PASS。

## T6｜P0-09 全链唯一决策验证 — FROZEN

五个唯一性（KnowledgeContext / Strategy / Executor / Selector / Difficulty Formula）复跑验证 PASS；
Question→knowledgeId→KP、Question→canonical QT、Question→Requirements→Generator 追溯成立；UI 层 SSOT 零私有匹配。

## T7｜P0-11-B 产品回归 — FROZEN

练习全流程（进入→年级→知识点→题型→数量→难度→生成→做题→提交→批改→查看答案→错题重做→打印）
+ 12 类异常场景 = 13/13 PASS（浏览器）；重复题 Node 三项（同轮/跨轮/降级如实）PASS。
题量控制 8 用例 40 断言 PASS（10d 断言假设曾修正后通过）。

## T8｜P0-12 二级/三级 UI 控制审计 — FROZEN

select.html / practice.html 参数传递正确、无私有题型决策；B2 四项 PASS；
第 6 步补测（select 空选区「开始练习」）PASS：空态提示、不崩溃、降级路径正确（2026-09-18 23:34）。

## T9｜P0-13 项目清理 — FROZEN

删除 `generation-engine.js` 9 项死导出（仅保留 `generate` 薄代理）；5 个零引用文件定性
（`generation-core.js` = 测试资产保留；2 个架构依赖保留；不误删）。
收口补齐（2026-09-19）：package.json 失效脚本引用 55→0；重建 `dev/check-syntax.js` 语法门禁（209/0）；
pre-commit / run-all-checks.sh / ci.yml 门禁链接到现存脚本；修复测试 C8（capacity-map 过期缓存依赖 → canonical KP 固定池）。
最终门禁：verify 5/5 + syntax 209/0 + npm test 239/239 + lint 0 + 4 项 E2E PASS。

## T10｜最终冻结 Clean Product Baseline — FROZEN（2026-09-19）

- 全链唯一：KBL→KnowledgeContext→KP×QT→Strategy→Requirements→Plan→Executor→Selector→Generator→Validator→Presentation→Practice。
- 冻结范围：KBL / QuestionType / Difficulty / POL / Requirements / Plan / Executor / Selector / Generator / Validator / Presentation / Practice / Print / UI。
- 遗留问题（TRACKED）：capacity-map.json 历史缓存过期（生产 typeCaps 无界，recovery 兜底，行为以回归为准）；knowledge-point.js / knowledge-ontology.js 历史断链（0 生产依赖，ARCHIVED）。
- 实际修改文件（冻结收口轮）：`package.json`、`dev/check-syntax.js`（新）、`scripts/pre-commit.sh`、`scripts/run-all-checks.sh`、`.github/workflows/ci.yml`、`tests/orchestration/p11-01-coverage-quota.test.js`、`docs/*`（四类核心文档 + archive/）。
- 结论：**PASS，全项冻结，进入维护模式。**

## T11｜P24 产品化一致性收口 — FROZEN（2026-09-19）

依据产品化审计（CORE PASS / PRODUCTIZATION NOT FINAL，8 项：3 P0 / 4 P1 / 1 P2）逐项核验修复，不重新设计架构：

- **P24-01（P0）知识页 + sitemap 重建**：`build-knowledge-pages.js` 重建 375 个 KP 页（剪除旧页 326）；sitemap 381 URL（5 静态 + 376 知识）。KBL 375 = 页面 375 = sitemap 375。
- **P24-02（P0）ALLOW 真实性**：探针实测 1570 个 KBL ALLOW 映射，15 个 calc 对真实生成 0 题，根因为 15 个 canonical KP 误绑 `generator:shape-recognition`（只产图形兜底题）。修复：4 个二上除法 KP 重绑 arithmetic-division、4 个四上/五上/六下乘法 KP 重绑 arithmetic-multiplication（含 g5-up-u02-k002 经 `CANONICAL_KP_OVERRIDES` 注入 `dec-mult` 专用结构）；新增 `generator:percent-calc`（六上百分数 6 KP，意义/互化/折扣/利率/达标线/增减幅 6 子类型按 KP 尾缀分派）；shape-recognition 解绑 15 KP。新增正式门禁 `dev/check-allow-generation.js`（`npm run verify:allow-gen`），接入 run-all-checks.sh 与 CI。修复后 1570/1570 PASS。
- **P24-03（P0）Capacity Map 重建**：`scan-capacity.js --refresh` → 375 keys / 1570 ALLOW 全重叠 / 0 stale / 0 missing；分级 HIGH 333 / MEDIUM 4 / LOW 11 / VERY_LOW 27（全部 GENERATOR_LIMITED）。T10 遗留项关闭。
- **P24-04（P1）UI bug ×3**：select.html 快速模式「分类整理题」`sort` 失效键改为 `classify`；教师模式取消选择误用 `splice(kid,1)` 改为 `splice(idx,1)`；浏览器回归时发现并修复阻断性缺陷（T10 基线已存在）：`shared/request/request-normalize.js` 顶层裸 `require` 在浏览器经典脚本环境抛 ReferenceError，致 `RequestNormalize` 整模块未挂载、select.html 三个开始链接始终退化为裸 `practice.html`（所选年级/KP/题型全丢失）——改为跨环境守卫（Node require / 浏览器用 bundle 挂载的 `window.QuestionTypeRegistry`）。浏览器实测：快速模式分类整理题 → 20/20 classify 排序题；教师模式 A/B 选中取消不错位、href 含正确 kps。
- **P24-05（P1/P2）发布治理**：版本三方冲突统一为 5.0.0（VERSION / package.json / version.js / SW CACHE / index.html 兜底 / README / CI 注释）；语法门禁补入 plugins、feedback（209→218 文件）；README 竞赛口径由「C1–C9 已上线」改为「入口预留，竞赛知识点未纳入 2025 人教版 KBL 发布包」（375 KP 中竞赛 KP = 0）。
- 纪律：Compatibility Bridge（knowledge-compat.js）与旧 require 断链维持 TECH-DEBT 登记不改；selector 评分架构不改（choice 对算术绑定 KP 的既有 input 兜底模式为全产品既有行为）。
- 最终门禁：check:sw-version ✅ + lint 0 + syntax 218/0 + npm test 239/239 + verify 5/5 + verify:allow-gen 1570/1570。
- 主要修改文件：`dev/build-knowledge-pages.js` 产物 375 页、`scripts/generate-sitemap.js` 产物、`select.html`、`shared/request/request-normalize.js`、`shared/generator/generator-registry.js`、`shared/generator/generators/index.js`、`shared/generator/generators/percent.js`（新）、`shared/generator/core/kp-arithmetic-semantics.js`、`shared/engine/*.bundle.js`（重建）、`shared/capacity/capacity-map.json`（重建）、`dev/check-allow-generation.js`（新）、`dev/check-syntax.js`、`VERSION`、`package.json`、`shared/catalog/version.js`、`sw.js`、`index.html`、`README.md`、`scripts/run-all-checks.sh`、`scripts/pre-commit.sh`、`.github/workflows/ci.yml`、`docs/00、02、03`。

---

## 冻结报告汇总（阶段十 final report 格式）

| 项 | 内容 |
| --- | --- |
| 阶段 | T10 最终冻结 |
| 目标 | 建立 Clean Product Baseline，验证全链唯一性 + 产品回归 + UI 审计 + 清理收口 |
| 实际修改 | 见 T9/T10 修改文件列表 |
| 验证 | verify 5/5；syntax 209/0；npm test 239/239；lint 0；E2E 4 项 PASS；浏览器回归 13/13 |
| 判定 | PASS |
| 遗留问题 | 3 项 TRACKED（见 00 基线 §6） |
| 是否冻结 | 是 |
| 下一阶段 | 维护模式（见 03-CURRENT-TASK） |

| 项 | 内容（T11 / P24 修订） |
| --- | --- |
| 阶段 | T11 P24 产品化一致性收口 |
| 目标 | 依据产品化审计修复 8 项（3 P0 / 4 P1 / 1 P2），达成「375=375=375、1570 ALLOW=1570 真实生成、版本统一 5.0.0」 |
| 验证 | sw-version ✅；lint 0；syntax 218/0；npm test 239/239；verify 5/5；verify:allow-gen 1570/1570；capacity 375/1570/0/0 |
| 判定 | PASS |
| 遗留问题 | 2 项 TRACKED（见 00 基线 §6；capacity 过期项已关闭） |
| 是否冻结 | 是 |
| 下一阶段 | 维护模式（见 03-CURRENT-TASK） |
