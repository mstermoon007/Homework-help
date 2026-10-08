# FINAL-REPAIR-DEFERRED — 延后问题清单

> ⚠️ **历史清单（FINAL 期），非当前待办。** 仅作追溯；当前状态以 [00-BASELINE.md](00-BASELINE.md) 为准，后续任务与变更登记见 [P28/change-log.md](P28/change-log.md)。本清单条目不得凭旧记忆直接重开，重开前须以当前源码/测试重新验证。
>
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
| DEF-007 | P2 | FINAL-130 | 生产域名 home.modouyu.top 仅监听 80（HTTP 明文），未配置 443/SSL；非安全上下文下 navigator.serviceWorker 不可用，产品 Service Worker 离线能力在正式域名不生效（localhost 除外） | 服务器 nginx 配置（非仓库源码） | 否 | FIXED | FINAL-131（2026-09-25：Let's Encrypt 证书 + nginx 443 + HTTP 301 跳转 + 自动续期演练通过 + 浏览器确认 SW 注册） |
| DEF-008 | P3 | FINAL-132 | 服务器加固批 2 项：①HSTS 头 ②401/404 默认错误页与 Server 响应头暴露 nginx 版本号（server_tokens on） | 服务器 nginx 配置（非仓库源码） | 否 | FIXED | ①FINAL-133（HSTS max-age=300 起步）+ ②FINAL-135（nginx.conf http 块 server_tokens off：Server 头与错误页均仅余 nginx，版本/Ubuntu 字符串 0 泄露，4 入口 3 错误页实测）均 VERIFIED。遗留增强（非本 DEF 范围）：HSTS 提长 86400→31536000 与 includeSubDomains/preload 评估，未来另开任务 |
| DEF-009 | P2 | P28-UI-PRACTICE-LAYOUT-01 | 应用题（application 生成器，calc 题型亦消费）题卡上附加无教学信息的空虚线矩形：`makeGraphicForApplication` 对全部模板无差别返回 geometry/rectangle（180×90、#eef3fb 底、stroke-dasharray 6 4、无标签无文字），非真正数量关系线段图；视觉上即题卡中央的大虚线空框，屏幕与打印均出现 | shared/generator/generators/application.js:343-357 makeGraphicForApplication | 否 | FIXED | P28-DEF009-APPLY-GRAPHIC（2026-09-27）：①删除 makeGraphicForApplication 及唯一调用，题面条件由文字承载；②三份派生数据同步治理（evidence-rules 108 行剔除 864 条 data.graphic 断言、variation-profiles 108 行剔除 graphic 路径并补 24 行 unknown-not-observed flag、misconception-profiles 裁剪 73 个证据归零 representation slot，971→898）；③冻结矩阵快照不含 graphic 字段、prompt/answer 不变，只读复核 git diff=0 无需 --write；④HEAD 对照实验证实漂移门禁 8 处 representation 空矩形漂移全部消除；⑤局部测试 24/24 + check-all 28/0/0。真线段图属新功能，不做 |
| DEF-010 | P2 | P28-DEF009-APPLY-GRAPHIC | 漂移门禁 dev/p27/check-variation-drift.js 4 行 context.present 预存在漂移：math-g2-up-u07-k001×fill/choice（reasoning，true→false）与 math-g4-up-u06-k002/k003×fill（application，false→true）；HEAD 对照实验同向同行，与 data.graphic 剔除无关（context 轴只看题面汉字占比，门禁无种子、模板/数字随机使占比跨 0.5 阈值抖动）；门禁不在 check-all 接线中，不阻塞。P28-GEN-SHAPE-FLAT-SAMPLE-01 增补：flat 取样族行的 representation.paths 亦属无种子抖动类（图形子类型按条目种子取样），单测已对 8 抽样行钉定行级种子并同步重 derive 剖面，全量门禁比对仍无种子 | dev/p27/check-variation-drift.js（无种子抽样）+ 上述 4 行剖面 | 否 | FIXED | P28-DEF012-014-SHAPE-01（2026-09-28：derive 与门禁统一钉定行级种子 'p27-drift\|<kp>\|<qt>'，剖面全量重 derive，门禁复验 1299 行 0 硬违例 0 软报告，flaky 根因消除） |
| DEF-011 | P3 | P28-GEN-SHAPE-FLAT-SAMPLE-01 | generateGraphicParams 缺 trapezoid 参数分支：名称含「梯形」的 KP（legacyType='trapezoid'，SHAPE_SUBTYPE 已映射）参数生成落入 default 兜底画长方形，图形与答案「梯形」不一致；与 flat 族硬映射 rectangle 同源但独立（flat 取样域 5 种不含梯形，本任务未触及该路径） | shared/generator/generators/shape.js generateGraphicParams switch（缺 case 'trapezoid'；渲染端 svg-geometry.js trapezoid{topBase,bottomBase,height} 已注册） | 否 | FIXED | P28-DEF011-SHAPE-01（2026-09-29：补 case 'trapezoid' 参数分支 topBase=1<bottomBase=2、height 1~2、≤2cm、showHeight:false 不标直角；2 个梯形 KP（math-g4-up-u05-k003、math-g5-up-u06-k003）派生归位 trapezoid；evidence-rules 10 行 subtype 值断言 rectangle→trapezoid；实测 geometry 观察题画梯形答「梯形」；容量图 --refresh 回填；冻结矩阵 --write 重建 FAIL=0 只读 git diff=0；check-all 连续两遍 28 PASS） |
| DEF-012 | P3 | P28-GEN-SHAPE-FLAT-SAMPLE-01 | shape.js NAME_TO_SHAPE 正则顺序缺陷：/圆/（索引 3）先于 /圆柱/(12)、/圆锥/(13)，名称含「圆柱/圆锥」的 KP（如「圆柱的认识」「圆柱的表面积」）被派生为 circle 而非 cylinder/cone——geometry 观察题画圆且答案「圆」，与 KP 教学语义不符；预存在问题（改动前画长方形答「圆」，本任务 circle 分支落地后改为画圆答「圆」，视觉更一致但答案仍错），非本任务引入 | shared/generator/generators/shape.js NAME_TO_SHAPE 数组顺序（/圆柱//圆锥/ 需提前于 /圆/） | 否 | FIXED | P28-DEF012-014-SHAPE-01（2026-09-28：/圆柱//圆锥/ 提前于 /圆/，5 个 g6-down-u03 KP 派生归位 cylinder/cone；实测 geometry 题画圆柱/圆锥且答案「圆柱/圆锥」；evidence-rules 该 5 KP 行第5轮已仅余 unit/unitPx 断言天然兼容；冻结矩阵 --write 重建 FAIL=0 两遍只读 git diff=0） |
| DEF-013 | P3 | P28-GEN-SHAPE-FLAT-SAMPLE-01 | 容量缓存 shared/capacity/capacity-map.json 对 flat 取样族 KP 的行未随取样多样化回填（如 math-g1-down-u01-k001 现 geometry=1/fill=1/choice=1/judge=4/apply=8，VERY_LOW，GENERATOR_LIMITED，generatedAt 2026-09-26 早于本任务取样改动）：Node 侧编排按容量图封顶 typeCounts，单 KP×单题型会话仅出 1 题（浏览器端无 fs → 容量 Infinity 不封顶，产品页实测 5 题呈现五形不受影响）；「多种平面图形取样」在同会话的多样性仅在 Node 侧编排路径被预算封顶压制（跨会话/重新生成仍按种子变化；GenerationCore 直连实测 10 计划产 5 题互异、5 形状×5 题干全覆盖）。预存在机制（9-22 教训：--refresh 只能降不能升，回填需临时抬高封顶→真实生成实测→回填） | shared/capacity/capacity-map.json（缓存）+ dev/scan-capacity.js（扫描器只降不升）+ Node 侧编排容量封顶消费点 | 否 | FIXED | P28-DEF012-014-SHAPE-01（2026-09-28：scan-capacity --refresh 全量实测重扫（375 KP），g1-down-u01-k001 geometry 1→5、judge 4→7；Node 侧 PracticeSession 单 KP×geometry 实测产 5 题且五形全覆盖，封顶压制解除） |
| DEF-014 | P3 | P28-GEN-SHAPE-FLAT-SAMPLE-01 | variation-profiles.json 取样族行（flat 派生 KP×各题型）的 representation 轴为单次观测投影：图形子类型/参数现按条目种子从 FLAT_FAMILY 五形取样，单种子剖面的 paths/values 仅代表被抽中形状，不表征族域；本任务已将单测抽样的 8 行按行级种子 'p27-drift|<kp>|<qt>' 钉定重 derive（tests/generator/p27-variation-profile.test.js 同种子复验，硬轴比对确定性恢复），其余取样族行仍为旧恒-rectangle 时代剖面（无消费方比对，不阻塞）；schema 级治理需家族感知表征（representation 轴记录族域而非单形状） | kbl/teaching/variation-profiles.json（取样族行）+ dev/p27/derive-variation-profiles.js（无种子派生） | 否 | FIXED | P28-DEF012-014-SHAPE-01（2026-09-28：derive 与漂移门禁统一钉定行级种子约定并写入 builtFrom.sampling.seed，剖面 1299 行全量重 derive；漂移门禁 0 硬违例 0 软报告。注：representation 轴 paths 为字段名集合不含形状值，家族感知值域表征未做，如需另开任务） |
| DEF-015 | P3 | P28-DEF012-014-SHAPE-01 | NAME_TO_SHAPE 同类顺序缺陷（DEF-012 同源）：/正方/（索引 0）先于 /立方/，/长方/（索引 1）先于 /长.*体\|长方体/，名称含「正方体/长方体」的 KP 被派生为 square/rectangle 而非 cube/cuboid——math-g3-up-u01-k003 观察正方体、math-g5-down-u03-k001 长方体的特征、k002 正方体的特征、g5-down-u09-k001/k002 正方体涂色系共 5 KP 受影响（geometry 观察题画平面方形答「正方形/长方形」，与立体图形教学语义不符） | shared/generator/generators/shape.js NAME_TO_SHAPE 数组顺序 | 否 | FIXED | P28-DEF015-SHAPE-01（2026-09-28：/正方体\|立方/ 与 /长.*体\|长方体/ 提前至数组首位；5 KP 实测派生归位 cube/cuboid，答案「正方体/长方体」；evidence-rules 21 行值断言对齐 42 处（subtype/shapeName）；容量图 --refresh 回填；冻结矩阵 --write 重建 FAIL=0 只读 git diff=0；check-all 连续两遍 28 PASS） |

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
