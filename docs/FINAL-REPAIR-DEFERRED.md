# FINAL-REPAIR-DEFERRED — 延后问题清单

> 禁止范围扩张（FINAL-03）：AI 每次只处理当前任务。
> 发现的非阻塞问题记录于此，**不立即扩展任务**。
> 本专项结束前，所有 P0/P1 和产品发布阻塞问题必须清零；不得无限追加 P2/P3。

---

## 1. 登记规则

| 字段 | 说明 |
|---|---|
| ID | `DEF-NNN` 递增 |
| 优先级 | P0（阻塞发布）/ P1（重要）/ P2（改进）/ P3（可选） |
| 发现于 | 在哪个 FINAL 任务中发现 |
| 问题描述 | 一句话 |
| 根因/位置 | 文件:行 或 模块 |
| 是否阻塞当前任务 | 否（否则应立即修，不进此清单） |
| 状态 | OPEN / ACCEPTED / FIXED / WONTFIX |
| 处理任务 | 后续负责的 FINAL-XX 编号（未分配留空） |

> **判定规则**：如果直接阻塞当前任务 → 立即修；如果不阻塞 → 记录到此清单，不立即扩展。

---

## 2. 延后清单

| ID | 优先级 | 发现于 | 问题描述 | 位置 | 阻塞当前 | 状态 | 处理任务 |
|---|---|---|---|---|---|---|---|
| DEF-001 | P1 | FINAL-31 | W5：application.js / classification / counting / picture-equation 四生成器未消费 plan.semanticParams（141 对语义行维持 WARN：题面无 data.semanticEvidence 声明，warn 态早退零验证） | shared/generator/generators/{application,classification,counting,picture-equation}.js + generator/core/semantic-evidence.js CONSUMING_GENERATORS 表 | 否 | FIXED | FINAL-32 |
| DEF-002 | P1 | FINAL-31 | W6：checkSemanticEvidence 对 warn 态（有规则行未声明）早退零验证，不评测 required/forbidden——WARN 池实质未过语义门禁 | shared/validator/kp-semantic-validator.js checkSemanticEvidence | 否 | FIXED | FINAL-32 |
| DEF-003 | P2 | FINAL-31 | W9：misconception 覆盖 858 对 (KP,QT) 但无真实实现（无误选项注入/无错因反馈闭环），仅元数据声明 | kbl/teaching/misconceptions 相关 + 生成链 | 否 | OPEN | 待分配（FINAL-32 范围外：错题教学闭环，与本任务「出题链消费」不直接相关） |
| DEF-004 | P2 | FINAL-31 | W1/W2：375 KP 全量缺 learningTargets/cognitiveTargets 数据（0/375），teaching target/cognitive target 维度空转 | kbl（KBL 教学语义数据治理，P25-02 范畴） | 否 | OPEN | 待分配（FINAL-32 范围外：P25-02 人工治理，schema E05 红线禁止 AI 伪造 NEEDS_REVIEW 字段） |
| DEF-005 | P2 | FINAL-31 | P26 derive 脚本按单一 seed 产物回填精确值断言（无稳定性过滤），是 31a/31e 规则行 flaky 的源头；重跑 derive 会回填已被剔除/转 fieldPresent 的断言 | dev/p25/derive-evidence-candidates.js + apply-evidence-candidates.js | 否 | OPEN | 待分配（FINAL-32 范围外：P2 工具链，本任务按 FINAL-31a/31e 先例直接对齐规则，未动 derive 脚本） |
| DEF-006 | P2 | FINAL-32 | picture-equation variant dispatch 按 KP 名关键词分派（线段/大括号/看图列/天平/数阵/...），KP 真名（如「加减法的意义和各部分间的关系」「根据可能性大小进行推测」）不含关键词→落 generic 分支缺 calc 公式→TypeContract drop→0 题；当前靠 fallback `'看图列式'` 自身命中 '看图列' 隐式进 brace 分支承载，真缺陷未修 | shared/generator/generators/picture-equation.js makePictureEquationQuestion variant 分派 | 否 | OPEN | 待分配（FINAL-32a 回退名源改动保 freeze 稳定，variant dispatch 真缺陷另行治理） |

> 2026-09-23 FINAL-31 登记：DEF-001~005 均为归因中发现的非阻塞语义完备性问题，用户明确决策本轮仅修 P0 真缺陷与规则修复（31a/31b/31c/31d/31e），W5/W6 消费链与验证路径留后续 FINAL-XX。
>
> 2026-09-23 FINAL-32 登记：本任务闭合 DEF-001（4 个 W5 生成器接入 CONSUMING_GENERATORS + KP 语义过滤）与 DEF-002（接入后消费链生成器恒声明 data.semanticEvidence，validator check#7 不再 warn 早退，转入 PASS/FAIL 评测；归因脚本端态 PASS=921/WARN=0/FAIL=0 三轮稳定）。DEF-003/004/005 明确不在本任务范围（理由见上表）。DEF-006 是 FINAL-32a 回退时发现的 variant dispatch 真缺陷（P2，不阻塞发布）。
>
> 2026-09-23 FINAL-32d 登记：闭合 Question Intent（qt-intent.json → semanticParams.intent.trainsWhat）消费链。原 intent 字段被解析到 semanticParams 但未被消费（生成器不读 intent；FINAL-22 后 buildExplainability.semanticTarget 恒走 kp.module 兜底）。FINAL-32d 在 Generator 层 wrapGenerator 单点 + api.js Node 侧直载 qt-intent.json 双路径把 trainsWhat 注入 sq.semanticTarget，闭合 qt-intent.json → trainsWhat → SemanticQuestion.semanticTarget 消费链。whyThisType/differentiation/driftRisk/legitimacy 为解释性/审计字段，不进入题目结构（符合元数据定位），不在本次范围。端态归因 PASS=921/WARN=0/FAIL=0 稳定，npm test 534/534，check-all 25/0/1 SKIP，freeze 只读 git diff=0。

---

## 3. 清零要求

- 本专项结束前：所有 **P0 / P1** 与产品发布阻塞问题必须清零（状态 = FIXED 或 WONTFIX 并附理由）。
- P2 / P3 不得无限追加；每条必须有明确的"是否阻塞发布"判定。
- 清零后此清单可保留为历史记录，但 OPEN 项须为 0。
