# 小学练习本｜审计日志（AUDIT-LOG）

> 唯一审计台账（append-only）。执行指令见 `docs/maintenance/PROJECT-AUDIT-INSTRUCTIONS.md`。
> 每次审计在文末追加一条统一格式报告；不新建第二套台账。

---

# 小学练习本综合审计报告

审计日期：2026-10-13
当前版本 / Git Commit：5.2.0 / `5779805`（工作区含本次审计修复，未提交）

### 1. 总体结果

- PASS：22
- FAIL：3（已修复 3 项：P1×1、P2×1、P3×1）；另 1 项历史缺陷已复现修复
- BLOCKED：2（服务器 nginx 配置/日志/磁盘：无 SSH；CI Chromium 环境）
- NOT TESTED：2（首屏性能实测；服务器日志轮转现状）

明细（关键项）：版本四方一致 PASS；本地/Git/线上字节一致 PASS；门禁 31/31 PASS（含真实浏览器 E2E）；`npm test` 865/865 PASS；KBL 375/98/373/1570 PASS；Generator 23 PASS；Sitemap 382 PASS；知识页 0 漂移 PASS；隐私（零外传）PASS；SW 版本 PASS；`StrategyConfig` 未定义 FAIL→已修复；隔离目录文档漂移 FAIL→已修复；`registry-facade` 死三元 FAIL→已修复；线上 HSTS 缺失 FAIL（未修复，BLOCKED）。

### 2. 必须修复

**P1｜含义：competition 模式难度合成抛 ReferenceError（生产可达）**
- 问题：`mode:'competition'` 且未显式给难度时，合成难度路径抛 `ReferenceError: StrategyConfig is not defined`，导致该模式生成链路中断。
- 根因：`shared/strategy/difficulty-strategy.js` 内联 `GRADE_DIFFICULTY_ANCHORS`（原 strategy-config.js，FINAL-16）时漏改标识符，误写 `StrategyConfig.difficultyAnchorOf`；全仓无 `StrategyConfig` 定义。
- 修改文件：`shared/strategy/difficulty-strategy.js`、`shared/engine/strategy-engine.bundle.js`（重建）。
- 修复内容：两处 `StrategyConfig.difficultyAnchorOf(...)` → 本地 `difficultyAnchorOf(...)`（同一文件已定义）；重建 strategy bundle。
- 验证结果：复现脚本由 `ReferenceError` → 正常返回（G1 base=3 → composed=2，受 G1 锚点上沿 2 约束）；新增回归用例；`npm test` 865/865；`check-all` 31/0/0。

**P2｜含义：FROZEN 文档与 SSOT 冲突（SEO/AI 隔离目录口径错误）**
- 问题：`docs/00-BASELINE.md` 与 `docs/09-WEB-AI.md` 将隔离六目录写作 `history/ debug/ archive/ admin/ test/ staging/`，与真实 SSOT（`robots.txt` + `dev/p28/check-seo-ai-history-isolation.js` 的 `archive/ migration/ audit-results/ .trae/ test/ dev/`）不符。
- 根因：P28-34 设计文案未随实现落地目录更新；门禁只校验代码、doc 门禁只校验数字 token，故长期未暴露。
- 修改文件：`docs/00-BASELINE.md`、`docs/09-WEB-AI.md`。
- 修复内容：两处目录清单与 robots 行改为真实六目录。
- 验证结果：`check-all` 第 20 项 Doc 扫描 PASS；`check-seo-ai-history-isolation` PASS。

**P3｜含义：`shared/generator/registry-facade.js` 无效三元表达式**
- 问题：`BaseRecords = (typeof require === 'function') ? null : null;` 两分支同值，为死语句。
- 根因：历史重构残留。
- 修改文件：`shared/generator/registry-facade.js`。
- 修复内容：等价简化为 `BaseRecords = null;`（零行为变化）。
- 验证结果：`check-all` 第 21/22 项（死代码/Legacy）PASS。

**P3｜含义：线上 HSTS 响应头缺失（对比 P28 FINAL-133 已闭合记录属回归）【未修复·BLOCKED】**
- 问题：`https://home.modouyu.top/` 响应无 `Strict-Transport-Security`（亦无 X-Content-Type-Options / X-Frame-Options / CSP / Referrer-Policy）。P28 记录 FINAL-133 曾加 `max-age=300` 并验证在；`server_tokens off` 仍在（Server 仅 `nginx`）。
- 根因：疑似站点 server 块（sites-available/home.modouyu.top）在后续部署中被替换，丢失 `add_header` 行；全局 http 块（server_tokens）未受影响。
- 修改文件：无（仓库不含 nginx 配置）。
- 修复内容：需服务器侧恢复 `add_header Strict-Transport-Security "max-age=300" always;`（建议同时加 nosniff/X-Frame-Options）。
- 验证结果：无法验证——无 SSH 权限，标记 BLOCKED，待授权。

### 3. 架构与优化空间

- 架构优化：分层（KBL→KnowledgeContext→POL→Strategy→Generator→Validator→SemanticQuestion→Presentation→SVG）与跨层禁令经门禁实测无违规；**未发现值得实施的结构性架构优化**。UI→PracticeBridge→PracticeSession→GenerationAPI 的额外的 UI 中介层为有意设计（多入口/最新生成胜出/反馈钩子），不建议改。
- 核心链路优化：请求组装在 bridge(`sessionConfig`) 与 session(`_buildGenerationRequest`) 各有一份字段映射；`knowledgePointIds/knowledgePointId/knowledgePoints/kp` 四字段在 4 处各自解析——属**有意兼容适配**，收敛需动冻结边界，暂缓。
- 模块优化：`generation/api.js` 直读 `kbl/teaching/qt-intent.json` 是 `dev/p30/check-intent-authority.js` A3b **显式断言的两读取点之一**，非缺陷，**不建议改**。
- 性能与维护成本优化：`strategy-engine.js`（1362 行）兼请求校验与规划引擎，为最大耦合点；`shared/state/logger.js` 的 `remote`/`file` transport 无调用方（死能力，默认仅 console）；`version.js` 的 `BUILD_DATE=new Date()` 使 Node require 非确定。以上收益≤风险，暂缓。
- 已实施：P1 `StrategyConfig` 修复；P2 文档口径对齐；P3 死三元清理；（附带）测试数 864→865 的当前口径同步（00-BASELINE / 10-TEST-CI / check-doc-consistency desc）。
- 暂缓（O2）：`strategy-engine.js` 拆分 request-schema；gcd/`MODE_ALIAS`/常量表/标题格式/KP-id 解析的 helper 收敛。
- 不建议实施：bridge/session 合并；intent 读取点合并（会破 A3b 门禁）；为行数减少而拆/并模块。

### 4. 清理记录

- 删除的无效代码：`registry-facade.js` 无效三元（P3）；无其他死码（门禁 21/22 PASS）。
- 删除的冗余文件：无。
- 保留的兼容代码及原因：UI 中介层、legacy KP 字段别名、`RenderFormat` legacy DTO、`computeActualDifficulty` 启发式——均为文档化有意设计，保留。
- 文档更正：隔离目录口径 2 处；当前测试计数 3 处（865）。

### 5. 回归测试

- 数学生成：`check-all` 6a 1570 ALLOW 真实生成 PASS；6b/6c/6d/6e/6f/6g PASS。
- 答题与批改：单判分权威（answer-validator→core/check）门禁 PASS；浏览器 E2E 步骤 2/3/4/5+6 PASS。
- 预览与打印：浏览器 E2E 步骤 9 打印 PASS（弹窗 1 / print 1 / cards≥produced）；步骤 7 重生成、8 刷新 PASS。
- 知识库与难度：M0（kbl-validate/runtime/uniqueness/access/dir）+ 9a/9b 难度权威/溯源 PASS；知识页漂移 0 PASS。
- 安全与隐私：门禁 12 Security PASS；logger `remote` 无调用方→零外传；无第三方脚本；`eval/Function` 0 命中。
- 离线与缓存：SW 版本一致（`hw-help-5.2.0`）PASS；bundle 确定性 16/17 PASS。
- 构建与线上验证：知识页 `--check` 0 写/0 剪；sitemap 382 逐条 PASS；线上 VERSION=5.2.0；`index/select/practice.html` 字节与本地一致；HTTP→HTTPS 301；证书有效（至 2026-12-24）；dev/tests/kbl/package.json 均 404；/stats 404。
- 全量：`npm test` **865/865**（15 套件/89 文件）；`check-all` **31 PASS / 0 FAIL / 0 SKIP**（含真实 Chrome E2E 9 步）。

### 6. 发布结论

- 是否允许发布：**可以**（现网 5.2.0 与本地/仓库字节一致；本次修复经全量门禁 31/0/0 验证）。建议将本次修复纳入一次维护提交并走既定白名单打包流程。
- 发布版本 / Commit：5.2.0；基线 `5779805`，本次修复提交哈希待用户确认后生成。
- 发布验证：门禁 31/0/0 + 浏览器 E2E 9/9 + 线上字节比对。
- 回滚方式：`git revert` 本次提交；或恢复服务器上一稳定发布 tar 并原子切换（既有流程）。
- 未解决问题：线上 HSTS/安全响应头缺失（P3，BLOCKED，待服务器授权）；CI Chromium 环境（BLOCKED，本机已用 Chrome 补跑）；首屏性能实测（NOT TESTED）。

---

## 备注（执行环境）

- `check-all` 第 15 项浏览器 E2E：无 `CHROME_BIN` 时 SKIP；本次以 `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` 实跑 PASS。首次冷启动曾出现 `DevToolsActivePort` 15s 超时（脚本等待窗口偏短），重试即过——属测试夹具健壮性（O3），非产品缺陷。
- 审计修复清单（未提交）：`shared/strategy/difficulty-strategy.js`、`shared/engine/strategy-engine.bundle.js`、`shared/generator/registry-facade.js`、`tests/orchestration/difficulty-anchor.test.js`、`docs/00-BASELINE.md`、`docs/09-WEB-AI.md`、`docs/10-TEST-CI.md`、`dev/p28/check-doc-consistency.js`。

---

# 小学练习本 P41「稳定性优先」审计报告

审计日期：2026-10-14
当前版本 / Git Commit：5.2.0 / `5779805`（工作区含本次审计修复，未提交）
依据：`docs/maintenance/P41-REPORT.md`（本战役汇总）；用户在 P41-C 拍板**选项 C**。
范围：P41-0 → A → B → C → D → E → F；**不改架构、不部署服务器、不覆盖受保护文件**。

### 1. 总体结果

- PASS：A（A1/A2 修复 + A3 审计）、B（B1/B2 修复 + B3 稳定化）、C（选项 C 落地）、D（跨层契约测试）、E（关系研究）全部完成。
- FAIL：0。已修复确认缺陷 2 项（A1、A2），另有 1 项测试夹具不确定性问题（B3）稳定化。
- BLOCKED：1（Browser E2E：本机无 Chrome/Chromium）；服务器侧 HSTS（沿用 2026-10-13 记录，未在本战役复测）。
- NOT TESTED：首屏性能实测（沿用上次）。

明细（关键项）：`npm test` 894/894 PASS；`check-all` **32 PASS / 0 FAIL / 1 SKIP / 33 项**（#15 无 Chrome SKIP）；FINAL-91 只读快照 PASS；Bundle 16/17 PASS（`source==bundle`）；生成矩阵冻结 6a/6b PASS（1570 ALLOW）；KBL 血缘/质量门禁并入门禁链 PASS；难度 9a/9b PASS；文档一致性 20 PASS（26 文档）；LLM 19 PASS。

### 2. 必须修复（本战役）

**P41-A1｜含义：`checkQuestionType` 题型字段口径错误，生产题恒 no-op（校验失效）**
- 问题：`SemanticQuestion` 工厂写入 `sq.questionType`，但 `checkQuestionType` 只读 `sq.questionTypeId`，导致生产题目「题型是否在 KP 允许范围」检查恒不触发。
- 根因：与同类检查（`checkSemanticEvidence`/`checkTypeContract`/`checkIntentAlignment`）字段口径不一致的历史遗漏。
- 修改文件：`shared/validator/kp-semantic-validator.js`、`shared/engine/presentation-engine.bundle.js`（重建）。
- 修复内容：`var qt = sq.questionType || sq.questionTypeId || null;`，错误字段改 `questionType`，`generationCapabilities` 加 `|| []` 防御。
- 验证结果：新增 8 回归用例；生成矩阵冻结 1570/1570 PASS；`npm test` 894/894。

**P41-A2｜含义：`attachMeta` 异常路径抛 `ReferenceError`（潜在生产崩溃）**
- 问题：`if (!arr) return sq;` 中标识符 `sq` 未定义（形参为 `sqs`）。
- 根因：变量名笔误。
- 修改文件：`shared/generator/generator-selector.js`、`shared/engine/strategy-engine.bundle.js`（重建）。
- 修复内容：`return sqs;`。
- 验证结果：新增 4 边界回归用例；`npm test` 894/894。

**P41-B1｜含义：rootHash 无单一权威（两处各算，易漂移）**
- 修改文件：新增 `tools/kbl/root-hash.js`；接入 `tools/kbl/build.js`、`dev/p30/check-kbl-lineage.js`、`dev/check-kbl-quality.js`、`dev/check-all.js`。
- 修复内容：集中 `DATA_RELS`(13 文件) + `computeRootHash`；血缘 L6a `[3df605b9f42b vs 3df605b9f42b]` PASS。
- 验证结果：新增 5 用例；血缘/质量门禁入链 PASS。

**P41-B2｜含义：知识页 `--check` 非真实漂移检测（只报不判）**
- 修改文件：`dev/build-knowledge-pages.js`（导出 `runCheck` 等 + `require.main` 守卫 + 退出码）。
- 修复内容：真实只读漂移检测（缺页/无 kbgen/内容漂移/索引漂移/孤儿页），当前漂移 0。
- 验证结果：新增 4 用例（含正文篡改负例）；`dev/p28/check-kbl-ai-boundary.js` 检查 B PASS。

**P41-B3｜含义：随机分布卡方用例非确定（偶发 flaky）**
- 修改文件：`tests/source/random-distribution.test.js`。
- 修复内容：±10% 用例注入 `mulberry32(42)`；新增非阻塞真随机冒烟。
- 验证结果：连续 3 次通过。

**P41-F 签收前 5 点复验（补充发现并修复 2 处真实缺口）**
- 反例有效性：A2 用例在旧实现下抛 `ReferenceError: sq is not defined`；A1 用例在旧实现（仅读 `questionTypeId`）下 3 条负例失败——均为真实反例。
- 缺口①（rootHash 非单一权威）：`tools/kbl/validate.js`、`dev/verify-kbl-runtime.js` 仍各自硬编码 13 文件清单（内容当今相同但属漂移源）→ 迁移到 `tools/kbl/root-hash.js`（新增 `computeFileHashes/entriesFrom`）。修复后全仓仅 root-hash.js 定义清单；`validate`/`verify-kbl-runtime`/`lineage`/`quality` 复算一致 `3df605b9…`。
- 缺口②（知识页正文漂移漏检）：`--check` 原仅比对页面内嵌 `kbgen:hash`（KBL 投影指纹），实测「正文篡改且指纹保留」漏检；已改为 KP 页全量内容比对（与索引页一致）。实测篡改正文 → `--check` exit 1「内容漂移」、AI 边界门禁 FAIL；只读性保持（knowledge/ 前后 hash 一致）。
- 选项 C 零变更：两表命名互斥、取值未变；375 KP 与 rootHash 未变；公式仅含历史标识符修复。
- 题型契约未扩范围：canonical 运行时实测恒为 7；`read-aloud` 仅 answerMode；新增真实 `PracticeSession` 运行链路用例。
- Chrome E2E 分类：无 Chrome → exit 2 SKIP（不冒充 PASS）；`REQUIRE_BROWSER_E2E=1` 无 Chrome → exit 1 FAIL（实测）；发布前须在含 Chrome 环境补跑。

### 3. 架构与决策空间

- **P41-C 难度权威冲突**：KBL 375 KP `seedDifficulty` 与 Q6 派生校验包络 375/375（100%）匹配，生产 `GRADE_DIFFICULTY_ANCHORS`(R5) 仅 237/375（63.2%）。**用户决定：选项 C（双表并存 + 显式命名）**——保留两套有意区分的权威，不改难度公式、不改 KBL 数据，仅命名澄清 + 测试解耦。记录：`docs/maintenance/P41-C-difficulty-anchor-decision.md`。
- **P41-A3 题型谓词统一化**：四处谓词（Schema / QTR / 工厂 / Contract）语义有差异，统一化触及打包源与 bundle 重建 → **推迟**，由 P41-D 契约测试冻结现状。事实：`read-aloud` 为 `answerMode`，非规范题型；规范题型 7 类。
- 架构：9 层单向链与 12 模块边界经门禁实测无违规，**未发现值得实施的结构性架构优化**。

### 4. 清理记录

- 删除的无效代码/文件：无（未删测试、未放宽校验）。
- 保留的兼容代码及原因：legacy 题型别名、`read-aloud` 工厂兼容、两套难度锚点表——均文档化有意设计。

### 5. 回归测试

- 数学生成：6a 1570 ALLOW / 6b 矩阵冻结 / 6c-6g PASS。
- 难度：9a 权威链唯一 / 9b 溯源 PASS；新增 P41-C 解耦用例。
- 知识库：M0 + 血缘 + 数据质量 + 知识页漂移 0 + AI 边界 PASS。
- 安全与隐私：12 Security PASS；答案防泄露 6g PASS。
- 构建确定性：bundle 16/17 PASS；FINAL-91 只读快照 PASS。
- 全量：`npm test` **894/894**（16 套件/93 文件）；`check-all` **32 PASS / 0 FAIL / 1 SKIP / 33 项**。

### 6. 发布结论

- 是否允许发布：**GO**（全部已确认缺陷闭合；门禁恢复可信；难度权威冲突经拍板冻结；零架构变更、零服务器部署）。
- 发布版本 / Commit：5.2.0；基线 `5779805`，本战役修复提交哈希待用户确认后生成。
- 回滚方式：`git revert` 本次提交。
- 未解决问题：Browser E2E（BLOCKED，本机无 Chrome；发布政策要求发布前须通过，须在含 Chrome 环境补验）；线上 HSTS（BLOCKED，待服务器授权）；题型谓词统一化（暂缓）。`docs/DESIGN-REPORT.md` 当前态计数已对齐（894/16/93、Syntax 328、门禁 33 项）。

### 备注（执行环境）

- `check-all` 第 15 项浏览器 E2E 本次 **SKIP**（未设 `CHROME_BIN`；本机无 chrome 在 PATH）。设 `CHROME_BIN` 可达 33 PASS。
- 打包注记：`shared/*` 若被打包，源改动须重建 bundle。本战役 A1→presentation bundle、A2/C→strategy bundle，已重建并 16 项校验 `source==bundle` PASS。strategy bundle 将注释转为同数空行；presentation bundle 保留注释文本。
- P41 修复清单（未提交）：`shared/validator/kp-semantic-validator.js`、`shared/generator/generator-selector.js`、`shared/strategy/difficulty-strategy.js`、`dev/difficulty-anchor-table.js`、`shared/engine/{strategy,presentation}-engine.bundle.js`、`tools/kbl/build.js`、`tools/kbl/root-hash.js`(新)、`dev/p30/check-kbl-lineage.js`、`dev/check-kbl-quality.js`、`dev/check-all.js`、`dev/build-knowledge-pages.js`、`tests/{generation,source,validator,orchestration}/…`、`docs/00-BASELINE.md`、`docs/10-TEST-CI.md`、`docs/maintenance/P41-*.md`(新)。
