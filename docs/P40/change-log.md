# P40 Change Log（最新在上，append-only）

> 六字段口径：标题行（任务号+日期）/ modified / deleted / reason / tests / risk

> **编号勘误（P40-NUM-FIX，2026-10-13）**：早期执行期为「D10 分数约分」「D18 小数竖式」两条验收后债务修复复用了前置任务号 `P40-Q-15`/`P40-Q-16`，与 2026-10-12 的前置任务（Q-15=R22 无障碍、Q-16=死令牌清理）冲突。现按时间序规范化：
> - 前置任务 **P40-Q-15**（R22 无障碍，10-12）/ **P40-Q-16**（死令牌清理，10-12）保持原号；
> - 验证工具订正 **P40-Q-17**（R9 口径，10-13）保持原号；
> - 债务修复 **P40-Q-18**（D10 分数乘整数约分，10-13）/ **P40-Q-19**（D18 小数尾式竖式，10-13）为本次勘误新号。
> 同步更新：本文件两条 10-13 条目、任务书执行状态、测试文件名（p40-q18-\*/p40-q19-\*）、生成器源码注释（shape.js/decimal.js）。

---

## P40-FINAL | 2026-10-13（两役收口 + 00-BASELINE 对齐 + 日志收口 + 全量门禁）

- **modified**: `docs/00-BASELINE.md`（**数字对齐现网**：Tests 表 测试文件 71→**89** / 用例 762→**864** / PASS 864；测试目录分布 `generation` 28→42、`orchestration` 22→23、`validator` 3→4、`semantic` 1→3；门禁链第 4 语法 299→**323** 文件、第 5 `npm test` 762→**864**；Performance `npm test` 762→864 用例；Relations 节追加「概念族模型（P40 战役二）」冻结段——族表 SSOT / `{familyId,stageOrder}` 375 回填 / R-REL-03 38 边 evolution / 跨族投影不落盘 / 54 处 needs-review）；`docs/P40/change-log.md`（**日志收口**：补录 `T-02`/`T-03`/`T-04`/`T-05`/`T-06`/`T-07`/`T-09`/`T-10`/`T-11` 九条缺失的六字段条目，使战役二 `T-01..T-14` 条目齐全，含本 FINAL 共 15 条）；`tests/semantic/p40-t02-t07-foundation.test.js`（**新建 6 断言**：T-02 族表/序、T-03 副本自检、T-04 evolution、T-05 capability 回填、T-06 跨族投影、T-07 难度递进）；`docs/P40/P40-TASK-BOOK.md`（头部执行状态补 P40-FINAL 收口）
- **deleted**: 无
- **reason**: 任务书 §4 定义 `P40-FINAL（两役收口 + 00-BASELINE 更新 + 日志收口 + 全量 30/0/1）`。收口三处缺口：①**日志收口**——change-log append-only 缺 9 条 `T` 任务六字段条目（违反任务书「任何修改 → … → `docs/P40/change-log.md` 追加六字段」纪律，早期执行期仅内联交叉引用，未独立登记）→ 逐条补录；②**基线对齐**——`00-BASELINE.md` 残留 P39 时点数字（762 用例 / 71 文件 / 299 语法），与现网 864/89/323 漂移 → 按门禁实测对齐；③**测试覆盖**——`T-02~T-07` 此前仅由派生器内联断言 + `T-12` 回归基线间接覆盖，无独立测试文件 → 新增地基验收测试补齐。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js` **6/6**；`npm test` **864/864**（858 + 地基测试 6）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；20. Doc 历史数字扫描 PASS）。**机判面全部收口；战役一/二人工签收仍待用户完成。**
- **risk**: 低——纯文档对齐 + 新增只读测试；零生产代码 / KBL 数据改动（基线数字均以现网门禁实测为准，非臆造）；`00-BASELINE.md` 为 docs/ 非 archive，已过 20. Doc 门禁。**挂账（不变）**：Q-14 163 题人工评审、T-14 三主线链路图人工签收、T-07 54 处难度倒挂人工裁决、T-06 族间投影环观察、T-08 20 题抽样评审。

---

## P40-DOC-ALIGN | 2026-10-13（指令④：项目前后信息对齐——任务书状态头 / README 版本）

- **modified**: `docs/P40/P40-TASK-BOOK.md`（L7 执行状态头：战役二由「执行中」→「S0-S3 全 14 任务执行完毕，机判全过，关闭待用户人工签收」；补战役二完成清单 + needs-review 挂账 4 项）；`README.md`（版本信息「当前版本 5.0.1」→ **5.2.0**（与 `VERSION`/`package.json`/`shared/catalog/version.js`/`docs/00-BASELINE.md`/`docs/CHANGELOG.md` 一致）；版本变更说明补 V5.2.0（P34~P39 收口，2026-10-12）/ V5.1.0（P30/P31/P32 收口，2026-10-08）两条，置于 V5.0.1 之上；版本号语义化说明行补 5.1.0/5.2.0；生成时间 2026-09-29 → 2026-10-13）
- **deleted**: 无
- **reason**: 用户指令④「对齐项目前后信息」。核查发现唯一版本漂移在 README（其余 5 处权威源均为 5.2.0）；P40 任务书状态头滞留于「战役二执行中」，而实际 S0-S3 全任务已完成且门禁全绿 → 以新内容直接覆盖旧状态（不做第二层保留）。
- **tests**: `node scripts/sync-sw-version.js` PASS（`hw-help-5.2.0` == APP_VERSION 5.2.0）；`node dev/p28/check-doc-consistency.js` PASS（非 archive 文档零历史数字命中）；无测试断言 README 版本（已核 `grep -rn README tests/` 仅 P37-02 注释引用 archive README）→ README 改动为纯文档零测试影响；全量门禁见 P40-T-14 条目（858/858、30/0/1）。
- **risk**: 低——纯文档（任务书状态头 + README 版本说明）；不触 KBL/生产代码/测试；版本以 `VERSION` 为 SSOT，README 追平不改权威源。

---

## P40-Q-19 | 2026-10-13（D18 收口：小数尾式竖式接线真缺口子集 + 分桶裁决登记）

- **modified**: `shared/generator/generators/decimal.js`（buildQuestion 尾式接线：qt∈{calc,apply} + sub∈{addsub,mult,word} + 题面尾式正则命中 + 小数操作数守卫 → `Arith.verticalPlan(Arith.gradeOfKp(pkp(plan)), a, b, op)` → mul/dec 双向 descriptor（dec-mul→subtype 'mul'、dec-addsub→subtype 'dec' + op 透传，均 trimDec 字符串 params + maskResult:true 防泄题，镜像 arithmetic.js Q-06 契约）；div/估算/低于年级/两步/解析失败一律 fail-closed 不挂图）；`tests/generation/p40-q16-decimal-vertical-wiring.test.js`（新建 7 断言：派发链 / mul-g5 calc 图文一致+遮蔽+渲染 / dec-g4 calc 含负结果减法 fail-closed 分支 / apply 尾式同契约 / div fail-closed / below-grade fail-closed / fill-choice 不挂图）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b --write 显式重冻 1570/1570，8 行 newlyWired 获图）
- **deleted**: dev/p40/_q15-q16-verify.js、dev/p40/out/_q15-q16-verify.out（Q-18/Q-19 联合取证探针，取证完毕物理删除；判据：D10 160-seed 零违例 + D18 1570 行零违例结论已折入 tests/generation/p40-q18/p40-q19 两条定向测试，临时脚本不留壳）
- **reason**: 用户指令「请优先处理 D10 和 D18 的修复」。Q-14 验收 §5 D18：竖式未配 61 行=D4~D7 之和。本次修复**真缺口子集 8 行**（newlyWired 与 BEFORE 一一对应）：apply 加法 3 行（g4-down-u06 k001/k002/k004：2.8+2.6 / 2.7+2.5 / 1.5+1.4 → calculation/dec）；乘法 5 行（g5-up-u02 k001/k002/k003/k005 apply：1.3×1.3 / 1.2×9 / 3×1.8 / 2.9×1.4 + k005 calc：1.6×9 → calculation/mul）。**分桶裁决登记**：dec-div 7 行 fail-closed（svg-calculation.dec 仅支持 '+'/'−'，扩除法渲染能力=D4 挂账不越界）；below-grade 4 行 fail-closed 正确（dec-mul 需 g≥5、dec-addsub 需 g≥4）；负结果减法 fail-closed（arithmetic-core.js verticalPlan L634 既有裁决：a<b 减法超纲不配竖式，测试首跑坐实后按裁决收窄而非改生产代码）；全局 4 条未约分（g3-up-u08-k001 choice 3/6 份计数、k002 calc/choice 3/9 分数单位、g5-down-u06-k002 fill 5/20 通分目标）均为口径内正确形态，不修不立债。
- **tests**: 定向 `node --test tests/generation/p40-q19-decimal-vertical-wiring.test.js` 7/7；`npm test` **843/843**（834 基线 + 9 新增含 Q-18）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（首跑 29/1/1 仅 6b FAIL 符合预期 → `check-generation-matrix-freeze.js --write` 重冻 1570/1570 复跑全绿；6g 泄露门禁 PASS 零白名单新增；16/17 bundle source==bundle + 确定性 PASS）
- **risk**: 低——wiring 仅 calc/apply 两消费面，fill/choice 零影响；descriptor 契约镜像 Q-06 既有先例；Z1-Z4 零夺权（仅按题面既有算式配图，不自决题型/数量/难度）；改 shared/generator 生产代码已重建 strategy-engine.bundle.js（16/17 门禁 PASS 为证）；6b 重冻 8 行新增与 6a 基线零冲突。

---

## P40-Q-18 | 2026-10-13（D10 收口：分数乘整数答案约分全路径覆盖）

- **modified**: `shared/generator/generators/shape.js`（makeFractionTimesIntegerQuestion 答案 SSOT 约分化：辗转相除求 gg；rawFrac 保留原始积（judge 主张对照材料 + 约分句前项）；sNum/sDen/fracStr/带分数/整数三形态答案化简；simpNote 约分句仅原始积未最简时注入解析；choice 候选项 simpFrac 逐个约分判重入池（防 R11 双正确项，池恒 4 项）；judge 解析保持原始积形态；图形 params total=den/part=num 题设份计数不动）；`tests/generation/p40-q18-fraction-times-integer-simplify.test.js`（新建 2 断言：selector 5 行路由 match 全 1 + 全 seed 面 5 题型×4 难度×4 变体=80 行零违例）
- **deleted**: 无（探针并入 Q-19 条目删除）
- **reason**: 用户指令「请优先处理 D10 和 D18 的修复」。Q-14 验收 §5 D10/#151：分数乘整数答案约分仅 6b 冻结面 seed 口径成立（Q-07 挂账⑥），全 seed 面 160 行扫描 31 例未约分直出（如 3/4×2=6/4、解析无约分句）。修复口径=课标「计算结果能约分的要约分」答案 SSOT 化；约分不改值（同值断言 (w·d+n)·rawDen=rawNum·d）；rawFrac 保留原始积使 judge 主张与图形份计数（total=den/part=num）不受约分漂移；约分句双向口径（未最简必含「约分得 〈最简积〉」、已最简必不含）。
- **tests**: 定向 `node --test tests/generation/p40-q18-fraction-times-integer-simplify.test.js` 2/2（路由 + 80 seed 全面：kind=fraction-times-integer / 无 data.operation / 答案最简+同值 / 约分句正反向 / judge 原始积在场 / choice 4 选项按值互异+correctIndex 对位 / geometry/segment 渲染 SUCCESS）；`npm test` **843/843**；`node dev/check-all.js` 30/0/1（同 Q-19 联合门禁）
- **risk**: 低——单 maker 内部约分收敛，KP/题型/难度决策零改动；k001 行答案/解析形态变化属修复预期（随 6b 重冻）；judge 布尔主张不变；choice 判重逻辑收紧不缩减覆盖率（池恒 4 项实证）。

---

## P40-Q-14 | 2026-10-13（质量验收：复评 163 题 23 维 + 复现题 21 行核验 + R23 抽查 + 全量门禁 + Q-12 残留探针清理）

- **modified**: `docs/P40/p40-q14-acceptance.md`（新建验收报告：§0 七项结论表 / §1 23 维基线→复评提升对比 / §2 复现题 21 行逐条核验（16 修复 + 5 登记维持）/ §3 R23 跨题一致性抽查 / §4 门禁证据 / §5 战役一债务登记 D1-D28 / §6 证据留档与回显异常处置记录）；`dev/p40/out/q01-evidence.json` + `q01-review.md`（Q-01 脚本复跑再生：163 题证据 + 人工评审清单，untracked 运行证据）；`dev/p40/out/q02-evidence.json` + `q02-summary.json`（Q-02 脚本复跑再生：1570 全量盘点）
- **deleted**: dev/p40/_q12-probe.js、dev/p40/_q12-contract.js、dev/p40/out/_q12-probe-out.txt（Q-12 期未登记残留探针，取证完毕物理删除；判据：取证结论已折入 tests/generation/p40-q13-context.test.js L1 层，零生产消费者）
- **reason**: 用户指令「阅读P40开发中战役一遗留的债务、断链、未判定、挂起等待、专项未修等问题。然后再执行战役一的Q-14 验收」。验收口径=任务书 §1.2 七项：①复现题集全量重评 21 行 → **16 修复 + 5 登记维持**（#7 needs-review、#110 残留、#125 geometry 无图裁决维持、#151 新登记 D10、R4 竖式缺口待修）；②G1-G6×7 人工评审清单再生（163 题 ≥140 要求，待用户签收）；③R23 抽查 38 组同 KP 零冲突 + 3 基线组复证；④check-all 30/0/1；⑤1570 重跑 genErr=0 零 fake/placeholder/fallback；⑥6g 泄露门禁 PASS；⑦矩阵冻结复核复跑零污染（git 60 项均既有登记，dev/p40/out/ untracked）。**23 维复评提升**：R9 数值合理性 FAIL 1→0（#1 G1 数域失守修复实证）；图形覆盖 649→663（竖式 0→14）；分数配图 16→17、通分/约分解析 8→10；npm test 827→834。**债务登记 D1-D28**（详验收报告 §5）：D1 分数族 T2 graphicRole 80 行 null、D2 #7 KP 无迷思剖面、D3 141 条 needs-review、D4-D7 竖式缺口（小数除 4/分数加减 2/div judge/百分数乘）、D8 异分母减法结构缺口、D9 异分母 apply 两量和可超 1、D10 分数乘整数约分未全路径覆盖（#151 新登记——Q-07 挂账⑥「全部 simp 约分」仅 6b 冻结面 seed 口径成立，q01 抽样面/运行时任意 seed 仍现 6/4 未化简）、D11 R9 负结果采样观察项、D12 makeByItem 8 builder choice why 素材工程、D13 shape.js L347/L387 裸 choice、D14 judge/geometry 四步模板只收 angle/area 族、D15 choice 干扰项迷思溯源扩面、D16 同族图文错配 61 行、D17 apply quantity-correspondence 扩覆盖、D18 竖式应配未配 61 行、D19-D22 money/gate 观察项（context.seed-only/g1 同池/g5-6 空回退/DATA_FILES 三处同步纪律）、D23 R23 geometry 无图反例裁决维持、D24 SHAPE_FEATURES 超纲清单 8 项、D25 rc=[mixed] 21 例、D26 _q12-* 探针残留（本次清理）、D27/D28 人工评审程序项（各题型抽样 20 题签收）
- **tests**: `node dev/p40/q01-quality-baseline.js` 复跑 163 题 genErr=0（R9 FAIL 1→0、R19 逐字节一致、R20 0 FAIL）；`node dev/p40/q02-graphic-inventory.js` 复跑 1570 genErr=0；`npm test` **834/834**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；6a PASS；6g PASS；6b/6c/6e 只读复核零漂移；报告落盘后终验再跑一次兑现 §4「验收前后各一次」）
- **risk**: 低——零生产代码改动（验收任务仅复评 + 登记 + 探针清理）；375/98/373/1570 与 7 题型/难度公式零改动；D1-D28 挂账逐项留档不扩散修复（P30 红线 9）。**判定：机判面七项全部通过；战役一关闭待用户完成 ② 人工评审签收（清单 dev/p40/out/q01-review.md，163 题）**

---

## P40-Q-13 | 2026-10-13（生成器消费：断桥修复 + grade 形态失配真断链 + 门禁清单对齐）

- **modified**: `shared/knowledge/runtime/knowledge-loader.js`（源侧补 context-library 两处挂点：运行时数据清单 + 装载字段 contextLibrary——此前仅手改产物，重建即丢）；`shared/knowledge/runtime/knowledge-api.js`（KNOWLEDGE 导出对象补 `contextLibrary: Query.contextLibrary`——PUBLIC_API 白名单桥按导出对象成员过滤暴露，缺成员即断桥根因）；`shared/knowledge/runtime/knowledge-runtime.js`（`node dev/build-knowledge-runtime.js` 重建，产物=源五挂点齐全）；`shared/generator/core/semantic-parameters.js`（getContextData grade 剥 'g' 前缀 `/^g(\d+)$/i` 转数字——修复 `Number('g5')=NaN` 使语料 grades 过滤全灭的真断链）；`tools/kbl/validate.js`（V5 DATA_FILES + 'teaching/context-library.json'，与 build.js DATA_RELS 对齐）；`dev/verify-kbl-runtime.js`（rels 同步 + 'teaching/context-library.json'）；`tools/kbl/build.js` 重跑（rootHash 重建 e282295a… + shared/knowledge 副本同步）；`shared/engine/strategy-engine.bundle.js`（59 modules）+ `shared/engine/presentation-engine.bundle.js`（24 inlined）（重建）；`kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`（派生器重跑重冻）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b --write 重冻 1570/1570）；6c/6e 矩阵重冻；`tests/generation/p40-q13-context.test.js`（新建 7 断言）
- **deleted**: dev/p40/_q13-bridge-probe.js、_q13-structure-probe.js、_q13-evidence-probe.js、_q13-registry-probe.js、_q13-money-probe.js、_q13-rmb-probe.js（六探针）+ dev/p40/out/_q13-*.txt 23 个落盘取证文件（取证完毕物理删除；判据：断桥 scenes=10/moneyEntries=2/全 confirmed、grade 投影逐档 g2 3 场景/g3 4 场景/g5 4 场景+空回退、money 12 KP 仅 g1 三 rmb KP 消费叙事、同 seed 有/无语料对比 90/90 变化）
- **reason**: 用户指令「按这个方案冻结语料库并进入 Q-13」（任务书 Q-CONTEXT 阶段：application/money 按 KP capability×grade 选取情境模板 + 数量关系与情境类型匹配校验 + 情境多样性可量化 + 6g 白名单按新增 token 增补后通过）。取证证据链三处缺陷：①断桥——K.contextLibrary 返回 null，根因 KNOWLEDGE 导出对象缺 contextLibrary 成员致白名单桥不暴露（loader 源亦缺挂点）；②真断链——KP grade='g5'（字符串）vs 语料 grades:[5,6]（数字数组），Number('g5')=NaN 使场景过滤全灭；③门禁清单漂移——validate.js/verify-kbl-runtime.js 的 DATA_FILES 清单缺 'teaching/context-library.json'（Q-12 只改 build.js 侧漏校验侧），rootHash 恒 mismatch。**裁决记录**：①money-measurement 12 KP 中仅 g1 三个 rmb KP（kind=rmb）消费 moneyApp 叙事（buy/change/total 三 op 桶全覆盖 + {a}/{b} 槽零残留），length/area/mass 正确失配回退；②relation×场景匹配校验实证：g3-g5 全 KP × nr.max=100 扫描 SHOP/TRAVEL 双向零混入（行程叙事必须是路程语义 ✓）；③L5 R20 同 seed 双跑逐字节一致；④6g 泄露门禁 PASS 零白名单新增
- **tests**: 定向 `node --test tests/generation/p40-q13-context.test.js` 7/7（L1 语料权威 schemaVersion/全 confirmed/11 relation 对齐；L2 resolve 投影逐档 + moneyEntries 空回退；L3 同 seed 有/无语料对比叙事生效 ≥60/90 + bare 面保持 + apply/choice 叙事形态；L4 money 三 op + 槽零残留 + length 失配守卫；L5 互斥扫描 + R20 回放）；`npm test` **834/834**（827 基线 + 7 新增）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP / 31 项**（#15 无 Chrome SKIP 属正常；6b 重冻后只读复核 git diff=0；16/17 bundle 确定性 PASS；6g PASS）
- **risk**: 低——语料消费只读（context.seed 驱动叙事选取，不改 KP/题型/数量/难度决策，Z1-Z4 零夺权）；6b 63 行重冻全部为 g1 down choice/apply（语料叙事影响面，答案/难度零变化）。**挂账登记**：①money 生成器只吃 context.seed 不吃 plan.seed（既有行为，观察项）；②g1 三个 rmb KP 同池（叙事 op 驱动不分 KP）；③g5-6 无 money 语料（moneyEntries 空回退，设计如此）；④gate 清单三处（build/validate/verify-runtime）此后必须同步增改

---

## P40-Q-12 | 2026-10-13（情境语料库冻结：R17 常识边界 T2 产物 + 消费接口铺设）

- **modified**: `kbl/teaching/context-library.json`（冻结 SSOT：schemaVersion=p40-context.1，10 场景 51 叙事格（shop-low/shop-mid/shop-high/travel-mid/travel-high/plant-low/plant-mid/stat-mid/stat-high/work-high × relation 双形态 apply/brief）+ moneyApp 2 条目 12 格（money-shop-low/money-shop-mid × buy/change/total × apply/brief），全 reviewStatus=confirmed，11 relation 与 application.js PROBLEM_TEMPLATES 逐字对齐）；`tools/kbl/build.js`（emit teaching/context-library.json + DATA_RELS 清单加项）；`shared/knowledge/teaching/context-library.json`（镜像）；`shared/knowledge/knowledge-contract.js`（PUBLIC_API + contextLibrary）+ `shared/knowledge/runtime/knowledge-contract.js` / `knowledge-query.js`（Query.contextLibrary L112-114/149）/ `knowledge-context.js`（intentFor 同款只读代理 L313-317 + 导出 L356）；`shared/generator/core/semantic-parameters.js`（getContextData L162-197 + resolve contextScenes 投影 L417-419）；`shared/generator/generators/application.js`（formatTemplate 第 3 参 narrative 选取 L403-422）；`shared/generator/generators/money.js`（moneyPool L462-477 + `prompt = prompt || 硬编码` 回退）
- **deleted**: 无
- **reason**: 用户显式指令「按这个方案冻结语料库并进入 Q-13」——R17 常识边界裁决收口：情境语料库为 T2 派生链产物经用户评审冻结（reviewStatus=confirmed，非 AI 手编）；消费口 = KBL Runtime Query.contextLibrary → SP.resolve contextScenes → application/money 生成器，零运行时 LLM/零网络依赖
- **tests**: 语料结构验证（schemaVersion/51 格双形态/12 money 格/11 relation 契约对齐）并入 Q-13 定向 L1 层 7/7；镜像一致性经 tools/kbl/build.js emit 同步
- **risk**: 低——纯 T2 数据冻结 + 只读接口铺设；375/98/373/1570 与 7 题型/难度公式零改动；题面文案变化统一由 Q-13 派生器重跑 + 6b 重冻承载

---

## P40-Q-11 | 2026-10-13（解析引用 KBL definition：definition 只读投影 + 6 builder 定义连接位逐字化）

- **modified**: `shared/generator/core/semantic-parameters.js`（resolve() 增 definition 只读投影：facts.concept 且 concept!==name 时透出，否则 null——runtime 镜像 semantic.concept 即 kbl/canonical definition 逐字发射（emit-canonical L71 def=k.definition），name 兜底形态（definition 缺失退化）置 null 防名称冒充定义，P40-Q-05 miscons 同构零新读取口/零契约改动/零数据写入）；`shared/generator/generators/concept-meaning.js`（6 处定义连接位：新增 defOf(plan)/citeDef(def) 两助手（末尾无句读补句号）；①makeAngleChoice 依据定义逐字引用替代手写「角的定义是…」；②makeAngleJudge 统一「判断依据：〈依据〉。〈结论〉」模板——定义项（顶点两条边/定义全文）逐字引用、性质项（边长角大小）既有教学句保留；③makeAngleGeometry「依据：角的大小只与两边张开的程度有关…」分步化；④makeAreaFill 依据定义逐字引用替代「叫作面积」手写编造尾巴；⑤makeAreaChoice 前缀逐字引用；⑥makeAreaJudge 同②模板——黑板面项（定义应用）/平方米与米项（面积单位 vs 长度单位）/定义项逐字引用；⑦makeAreaGeometry 分步化；全部仅解析文案，题面/答案/难度/题型零改动，回退态（definition null）保持既有诚实形态不编造）；`shared/engine/strategy-engine.bundle.js`（重建，semantic-parameters + concept-meaning 入包）+ `shared/engine/presentation-engine.bundle.js`（重建 24 inlined）；`tests/generation/p40-q11-definition.test.js`（新建 5 断言）
- **deleted**: dev/p40/_q11-probe.js、dev/p40/_q11-probe2.js（临时取证探针取证完毕物理删除；判据：4 A 类 KP（倍的认识/分数的意义/角的认识/面积的认识）runtime concept === canonical definition 逐字成立且 ≠ name（conceptEqDef:true ×4）、makeByItem 8 builder choice 裸句「正确选项是 X」现状确认、手写「就是角」「叫作面积」「叫做它们的面积」非逐字确认）
- **reason**: 用户指令「执行 Q-11」（任务书 Q-EXPLAIN 阶段 L115：解析可引用 KP canonical definition 经 intentFor/knowledge 只读口，验收=引用文本与 definition 逐字一致防编造 + 无新增数据写入）。取证证据链：definition 数据链 canonical knowledge.json → emit-canonical L71 def=k.definition||k.name → runtime semantic.concept 逐字镜像；resolve() 已加载 facts.concept 故投影零额外读取。**裁决记录**：①choice 统一收窄为「定义连接位分步化」——angle/area choice 获「依据定义：」逐字引用前缀，makeByItem 8 builder choice 裸句「正确选项是 X」的 why 素材工程登记挂账不机械扫（L1100 通用抽取对纯文本 stem 产生「支出 5 元记作 −5，这个数读作 = 负五」式病句，extractSupport 仅对运算符+数字素材有效，P30 红线 9 + P34-14 诚实退化先例）；②judge 性质项（边长/角大小）非定义应用不逐字引用，保留既有教学句（定义=陈述性知识，性质=规律性知识，二者不混）；③shape.js L347/L387 裸 choice 形态属同类登记不顺手修（P30 红线 9）；④definition 缺失/name 兜底形态 → null 回退既有形态（不编造，防「面积的认识」名称被冒充为定义文本）
- **tests**: 定向 `node --test tests/generation/p40-q11-definition.test.js` 5/5（L1 resolve 投影：真实 KP definition === T3 semantic.concept 逐字 + ≠ name + name 兜底/缺失守卫；L2 judge 全 item 30-seed 扫描判断依据模板 + 定义项逐字原文 + 无编造尾巴负断言、choice/fill/geometry 依据定义前缀 + 逐字引用 + 答案一致；L3 definition 缺失回退不编造 + makeByItem 8 builder choice 裸句不回归负断言；L4 R20 机判回放 gradeUserAnswer true/null 无 false + 悬垂标点 + 非复述）；`npm test` 827/827（822 基线 + 5 新增）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；16/17 bundle 确定性 PASS；6g 泄露门禁 PASS 零白名单新增——角/面积 definition 无数字 token；6b 零重冻——解析不入 questionFingerprint 实证矩阵零漂移）
- **risk**: 低——definition 投影只读（resolve 内 derived，无 KBL/teaching 写入，T2 派生器不需重跑）；生成面变化仅限 angle/area KP（math-g3-up-u07-k002、math-g3-down-u04-k001 等 A 类）解析文案，题面/答案/难度/KP/题型集合零改动（375/98/373/1570 不变，6a/6c/6d 零影响）。**挂账登记**：①makeByItem 8 builder choice why 素材工程（需逐 builder 教学素材设计，通用抽取已证伪）；②shape.js L347/L387 裸 choice 形态；③choice 干扰项迷思溯源驱动（既有挂账维持）；④judge/geometry 四步模板只收 angle/area 族，其余 KP 无 definition 应用位保持现状

---

## P40-Q-10 | 2026-10-13（explanationQuality 维：quality-scorer 七维化 + 四判据评分）

- **modified**: `shared/validator/quality-scorer.js`（① WEIGHTS 七维化：新增 explanationQuality 0.10，原六维等比 ×0.9（correctness 0.225 / knowledgeAlignment 0.18 / difficultyAlignment 0.135 / structuralValidity 0.135 / renderability 0.135 / uniqueness 0.09），合计仍 1.0；② scoreExplanationQuality 四判据等权（各 0.25）：非空（sq.answer.explanation，schema defaultAnswer 单源）+ 非复述 + 含分步标记（四步词/序号圈/第N步/因果-顺序连接/法则依据/演算等式 STEP_MARK_RE）+ 答案一致（规范化子串匹配，全角等号/负号统一）；③ 复述判定含算式补全豁免——题面以等号收尾且尾巴恰为答案属 Q-09 calc 演算完成形态非复述，旧复述模板「题面 + (所以/因此)?答案是X 纯答案陈述」与题面截断照抄判复述；④ scoreQuestion 挂 ⑦ 维 breakdown，加权总分循环自动纳入）；`shared/engine/presentation-engine.bundle.js`（重建 24 inlined，quality-scorer 入包副本同步）；`tests/validator/p40-q10-explanation-quality.test.js`（新建 9 断言）
- **deleted**: 无
- **reason**: 用户指令「执行 Q-10 图形推理与几何综合深化」（任务书 Q-EXPLAIN 阶段）。取证证据链：scorer 唯一生产消费方 presentation-engine.js L160 `Quality.scoreBatch`（qualitySummary 出口），bundle L779 已内联须重建；explanation 单源 schema defaultAnswer（L235）；scorer 既有测试面为零。**裁决记录**：①判据②复述判定须豁免算式补全形态——Q-09 calc「3 + 5 = 8」是演算完成非复述（题面等号收尾 + 尾巴恰为答案），旧复述模板签名是「题面+(所以)?答案是X」；②四判据独立等权，单判据失分 0.75 不清零（任务书四判据并列的最小忠实读法）；③choice 简短解析「正确选项是 X」因无分步标记判 0.75 属诚实扣分，与 Q-09 裁决②「choice 不扩面」一致，留 Q-11 统一
- **tests**: 定向 `node --test tests/validator/p40-q10-explanation-quality.test.js` 9/9（权重契约七维合计 1.0、四判据正负路径 7 例、真实生成面 36 题加权契约 + 分布档位 + 零分行负断言 + 均值 ≥0.75）；`npm test` 822/822（813 基线 + 9 新增）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；16/17 bundle 确定性 PASS——重建后 source==bundle hash 一致；6a/6b/6g 零影响——scorer 不入生成链，题目产出零变化）
- **risk**: 低——scorer 仅消费 sq 既有字段（answer.explanation / prompt / answer.value）零反向写入；权重调整改变 total 数值分布但不改变任何门禁通过条件（全库 grep 无 scorer WEIGHTS 硬编码消费方，strategy DIM_WEIGHTS 为异构模块）。**P40-Q-14 对比留证**（96 题采样：concept-meaning 8 子主题 × 4 题型 × 3 题，scoreBatch total avg 0.675 / min 0.593 / max 0.708；explanationQuality avg 0.938——72 行 1.0 + 24 行 0.75，0.75 行全部为 choice 简短解析无分步标记；采样 sq 无 knowledgePoint 字段致 knowledgeAlignment 0.000 为探针假象，生产 SemanticQuestion 该字段非空）。**挂账登记**：①choice 解析分步化留 Q-11（既有）；②评分分布进 P40-Q-14 验收对比（本条目已留基线）

---

## P40-Q-09 | 2026-10-13（图形推理深化：解析四步化 + fill 正序化 + 单位口径收口）

- **modified**: `shared/generator/generators/concept-meaning.js`（makeByItem 尾部解析重写，8 个 builder（number-concept/negative-number/multdiv-relation/algebra-letter/number-theory/make-ten/bracket-order/stepwise-format）统一生效：复述模板「题面，答案是 X」升级为结构化解析——calc「expr = answer(+概念结论)」逐步演算、fill「expr(= exprAns)，所以答案是 X」演算+归因、apply 四步「题意：… 列式：…，计算：…。答：X(+概念结论)」；素材单源题面内嵌参考式（extractSupport 抽取，运算符+数字双校验防残句）与 item.answer 概念结论；负数结果 /[-−]?\d+/ 接纳（#137/#140/#146）；无算式素材诚实退化「答案是 X」裸句（P34-14 不引题外信息）；choice 提前 return 分支不动）；`shared/generator/generators/fraction.js`（calcItem why 法则句由整替换改「法则 → 演算」闭环：explain = why + expr + ' = ' + 结果 + '。'，7 处调用点全部获得演算尾，修复 #142 解析冒号后空截断；hint 前缀形态不变）；`shared/generator/generators/reasoning.js`（fill 题面机制级修复：8 类谜题（drawer/extreme×3/chicken-rabbit×3/tree-planting/find-defect/handshake/optimization×3/logic 年龄+盒子）全部 builder 级 fillP 正序合规素材（builder 级真分工，P30-GEN-06 先例），seq 与说谎引语（P32-AS-16E）两特例保留；fill 分支消费 fillP；HSK 表扩 fp 槽三变体（握手/单循环赛/连线段计数词各自归位）；apply/choice 分支零改动）；`shared/generator/generators/money.js`（makeRMBCalculationQuestion 零结果单位口径：answerFen=0 →「0+操作数单位」（aFen≥100→元、≥10→角、否则分），修复「5角−5角=0分」混用（#19，R8 用户裁决并入 Q-09）；calcWhy 同步；choice distractor 正数域不撞零结果实证无需改动）；`shared/generator/generators/stats.js`（CLK_CALC 3 条 + TC_CALC 4 条补 e 教学解析（同 CLK_OPTS/CLK_FILL 形态：大格×小格/分针 1 大格 5 分/时针 1 大格 1 时/1 时=60 分/1 分=60 秒），calc 行 nativeExpl 接通消除 null 兜底（#24））；`kbl/teaching/variation-profiles.json` + `kbl/teaching/misconception-profiles.json`（派生器重跑重冻：reasoning fill 题面变化触发）；`shared/engine/strategy-engine.bundle.js`（59 modules）+ `shared/engine/presentation-engine.bundle.js`（24 inlined）（重建）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（--write 重冻）；`docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.{json,md}`（--write 重冻，机器字段 1228/8/334 与 Q-03 既有登记口径逐行一致）；`tests/generation/p40-q09-explain.test.js`（新建 7 断言）
- **deleted**: `shared/generator/generators/reasoning.js` 内 splitClauses 函数 + fill 子句倒序重组兜底分支（fillP 全类型覆盖后不可达，物理删除不留壳；倒序「设问先行条件后置」+切分器碎裂引语/顿号是 R13 #131/#162 的根因机制，随修复退场）
- **reason**: 用户指令「执行 Q-09 图形推理深化」（任务书 Q-EXPLAIN 阶段）+ R8 #19 用户裁决并入。取证证据链：R6 复述 10+1+2 例根因 concept-meaning makeByItem 复述模板；#142 根因 calcItem why 整替换丢演算；#131/#162 根因 splitClauses 切分碎裂+倒序设问先行（机制缺陷非个案，8 类型全修，正序直换方案被 6e SAME_CORE_THRESHOLD=0.85 实测推演否决——与 apply 3-gram 必撞）；#19 根因 formatRMB(0) 落「0分」；#24 根因 CLK_CALC/TC_CALC 无 e 字段。**裁决记录**：①judge「判断依据引用 KP definition」与 geometry「图形特征→公式→代入」四步模板 Q-09 不扩面（基线复现集无案例，P30 红线 9 顺手扩面禁令；judge definition 通道留 Q-11 统一）；②choice 解析不扩面（Q-03 已改）；③R16 分步支架由解析承载，hint 维持 6g L4 hint=0 红线不变；④choice 干扰项迷思溯源驱动留后续任务
- **tests**: 定向 `node --test tests/generation/p40-q09-explain.test.js` 7/7（四步结构+悬垂标点+非复述负断言、fraction 法则接演算 #142 回归、reasoning fill 空位唯一+非设问先行+#162 精确锚+说谎引语特例保留、apply/choice 不回归、money 零结果单位含解析同步、stats e 字段非空非抄题、R20 机判回放 254 行 calc/fill 必 true 全行无 false）；`npm test` 813/813；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；6b 重冻 PASS；6e 重冻 format 债 8 行与 Q-03 既有登记逐行一致零增减；6g 泄露门禁 PASS 零白名单新增；16/17 bundle 确定性 PASS）
- **risk**: 低——reasoning fill 题面全部变化（派生器重跑与 6b 重冻已执行）但答案/题型/难度零变化；concept-meaning/fraction/stats 解析变化不入 questionFingerprint（6b 实证）；money 零结果行答案「0分→0角/0元」已入重冻；375/98/373/1570 与 6a/6c/6d 零影响。**挂账登记**：①judge/geometry 四步模板与 choice 解析统一留 Q-11；②choice 干扰项迷思溯源驱动留后续任务；③Q-EXPLAIN 验收「各题型抽样 20 题人工评审通过率 ≥90%」待用户抽样评审（门禁证据已就绪：定向测试 + 6a 全量零 fake/零 genErr + 6g PASS）

---

## P40-Q-08 | 2026-10-13（图文配合打磨：R3 错配四 KP 修复 + symmetry-grid 子类型 + geometry 守卫回退）

- **modified**: `shared/generator/generators/shape.js`（① k002 补全轴对称：nums 6 条 + judgeGraphic 全部改挂 symmetry-grid 描述符（对称轴格网，格网只画原侧关键点防泄题），THEME_LABELS 补图形名标签；② k004 设计图案：nums 3 条 rotationDemo（deg 90/60/180 与题设一致）+ scenes 3 条 rotationDemo/translationDemo/reflectionDemo 变换演示族（apply 三变换轮换 seen≥2）+ judgeGraphic，unitPx=25 对齐 judge/apply evidence 锚（choice/fill/geometry 锚无 unitPx，nums 保持 34）；③ k005 周长与面积：scenes g 槽 + judgeGraphic 配 rectangle/square quantity-correspondence/area-measure，labelSides/unit 复述题设；④ geometry 守卫回退 `if (noGraphic)`——视图 3 KP geometry 行维持纯文字（P38 冻结判例 + T2 intent.graphicRole=null/allowedRepresentations 不含 graphic，实测放行 view-cards 即校验拒 NON_RETRYABLE 归零；k001 R3-D 判定为扫描误报合规无图））；`shared/svg/svg-geometry.js`（symmetry-grid kebab 别名注册，view-cards 同款机制不新增渲染器）；`kbl/teaching/evidence-rules.json`（k002 五行定向更新，方案 A 用户签批：subtype rectangle→symmetry-grid ×5、labelSides 锚→unitPx=25 锚 ×4（judge 行原 unitPx=25 保留）；schemaVersion p26-evidence.3 不变、无 shared 镜像、无指纹字段）；`shared/engine/strategy-engine.bundle.js` + `shared/engine/presentation-engine.bundle.js`（重建）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（--write 重冻，3 行 geometry evidence DIFF：k005/k002/k004）；6e maker 分工矩阵冻结产物（--write 重冻，机器字段 1228/8/334 不变仅 evidence 快照漂移）；`tests/generation/p40-q08-graphic-alignment.test.js`（新建 6 断言：渲染契约/k002 五题型/k004 变换族/k005/图文一致/evidence 锚对账含 labelSides 负断言）
- **deleted**: dev/p40/_q08-mismatch-scan.js、dev/p40/_q08-evidence-check.js、dev/p40/out/_q08-mismatch.json（临时探针取证完毕物理删除；判据：1570 行 genErr=0、665 图形经 svg-registry+plugins 真实渲染全 SUCCESS 零 UNSUPPORTED、错配 75→61、余 61 行全属挂账 KP 清单、R3-D×3 为三视图 KP geometry 行合规无图）
- **reason**: 用户指令「进入 Q-08 图文配合打磨」+ 方案 A 裁决（T2 evidence 锚定向更新，P34-H1 先例：派生管线保守跳过不覆盖既有行，定向更新唯一可行路径）。四 KP（k005/k001/k002/k004）修复清 14 行错配；同族 61 行错配挂账不机械扩修（P30 红线 9）；apply 扩覆盖挂账维持
- **tests**: 定向 `node --test tests/generation/p40-q08-graphic-alignment.test.js` 6/6、`tests/generation/p28-hollow-shape-themed.test.js` 14/14（守卫回退恢复 P28-HOLLOW 冻结契约）；`npm test` 806/806；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（6b/6e 重冻后全绿，6g 泄露门禁 PASS 零白名单新增，16/17 bundle 确定性 PASS）
- **risk**: 低——仅 shape.js 主题素材描述符与 k002 锚行改动，题面/答案/难度/KP/题型集合零改动（375/98/373/1570 不变）；6g 复核守卫/描述符变化未改 rng 泄露面。**挂账登记**：同族错配 61 行（g5-down-u05-k001/k002/k003×15、g3-down 家族×20、g5-up-u06-k004/5/6、g5-up-u08-k003/4、g6-up-u04-k004 等）待后续任务裁决逐个走流程；apply quantity-correspondence 扩覆盖挂账维持

---

## P40-Q-07 | 2026-10-13（分数表达深化：异分母分数竖式接线 + 解析通分步骤；事①挂账，用户批准路 C）

- **modified**: `shared/generator/generators/fraction.js`（① addsub-diff × calc 挂课标分数竖式描述符 `{type:'calculation', subtype:'frac', role:'calculation-support', params:{a,b,c,d,op,options:{resultBox:true}}}`——SVGCalculation.frac 既有 L452 实现首次获得生产消费者，结果留白框 '?' 防泄题与 segment 遮蔽同口径，validator isVerticalSupportGraphic（type+role 判定）自动豁免 representation/graphicRole 两门零改动；② addsub-diff calc/choice/apply 解析由口号（「先通分化成同分母分数，再按同分母加法计算：」）升级为具体通分步骤（最小公倍数 → 两分数同倍转换 → 同分母相加 → 可约分时补「约分得」），素材单源 s2 变量（c1/c2/cnum），P34-14 不引题外信息原则；③ calcItem 增可选第 5 参 graphic 透传（其余 8 处调用零影响）；④ buildQuestion 按 typed.graphic → data.graphic 携带（与 Q-06 arithmetic/decimal 同形态））；`shared/engine/strategy-engine.bundle.js`（重建 858234B，新代码入包实证）；`tests/generation/p40-q07-fraction.test.js`（新建 6 断言：frac 直渲留白/约分/fail-closed 契约、异分母 calc 描述符五元组+图文一致+渲染 SUCCESS+防泄题、choice/apply 解析步骤、同分母回归、约分句覆盖）
- **deleted**: dev/p40/_q07-*.js 临时取证探针 3 个（含伪输出通道污染文件 _q07-final.js，判据留存本条目）；dev/p40 保留 q01-quality-baseline.js / q02-graphic-inventory.js 既有脚本
- **reason**: 用户指令执行 Q-07。取证证据链：①Q-02 盘点分数题 127 行配图率 12.6%、解析含通分/约分仅 8/127；②20 个分数 KP × 4 题型 intent 行 graphicRole 全 null（80/80）——意图层从未授权分数题配图；③SVGCalculation.frac 完整实现（resultBox 留白默认、负结果抛错 fail-closed）生产消费 0 行，Q-06 挂账②；④svg-registry L120-137 calculation 适配器已支持 frac (a,b,c,d,op) 参数形态，派发链接收端就绪。**用户裁决两项**：事①（part-whole/线段图覆盖分数意义类）采路 C 挂账——T2 graphicRole 机械决策表扩展属数据层缺口（AI 不得自行修改裁决表），Generator 绕过 intent 挂图违反 P38 意图驱动闸门先例，待显式指令另立项（含渲染形态裁决：svg-fraction 补实现 vs 复用 segment，注意 graphic-renderer 派发表声明的 svg-fraction.js 文件不存在属声明悬空）；事②采最小范围——异分母 × calc × 意图无图行（intent 全 null → !wantsG 恒真，与 Q-06 定稿口径一致），同分母课标口算不挂、choice/apply 不挂（不机械扩修）
- **tests**: 定向 `node --test tests/generation/p40-q07-fraction.test.js` 6/6（直渲契约、描述符五元组+图文一致+防泄题、解析步骤、同分母回归、约分句）；`npm test` 800/800（794 基线 + 6 新增）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；6g 泄露门禁 PASS——解析新增通分数字未触发未登记命中、白名单零新增；6b 冻结矩阵 PASS——解析不入 questionFingerprint、竖式挂图不改指纹，产出零 DIFF；16/17 bundle 确定性 PASS）
- **risk**: 低——①竖式仅接管 addsub-diff × calc 缺口行，其余 9 个子类型 × 4 题型路径行为逐位不变（同分母回归断言实证）；②解析文案变化不入指纹（6b PASS 实证），variation/misconception 派生器无需重跑（题面/答案零改动）；③6g 白名单零新增零降标；④d1|lcm 时解析出现「5/6 = 5/6」恒等句为正确通分表述（教学可接受，不修）。**挂账登记**：⑤事① T2 graphicRole 推导规则缺口（80 行全 null，待显式立项）；⑥#151 复现题在 6b 冻结面不可复现（矩阵唯一 2/4× 形态为倒数题答案恒 1，fraction.js 全部答案已经 simp 约分，盘点面与冻结面 seed 口径差异所致，现状已闭环）；⑦addsub-diff apply 情境两量和可超 1（如 1/2+3/5=11/10 > 整条路，R9/R17 情境真实性采样缺口，生成器侧与 Q-06 挂账⑤同族，登记不顺手修）；⑧diffDenomAdd 仅产加法结构，异分母减法结构缺口（任务书「异分母加减」的减法半边，扩结构属需求扩展待裁决）

---

## P40-Q-06 | 2026-10-13（课标笔算竖式接线，方案 A：20 行 + judge，用户批准）

- **modified**: `shared/generator/core/arithmetic-core.js`（① verticalPlan 课标竖式判定：整数加减 g2 起两位及以上、乘 g3 起两位、除 g3 起、小数 g4 起；负操作数 fail-closed；② 减法负结果（sub 且 a<b）fail-closed 返 null——课标小学段未学负数，竖式不为其背书，撤图走既有纯文字路径；③ errorResultOf 单源（no-carry/no-borrow 错误得数 + 撞车防护）供 judge 假命题与 distractor 共用；④ gradeOfKp 解析失败返 0 fail-closed）；`shared/generator/generators/arithmetic.js`（calc else 分支 vPlan 块：两数单步 + verticalPlan 达标 → calculation descriptor（maskResult:true）；**定稿口径 `vPlan && !wantsG`**——竖式仅接管 intent 无图授权行，wantsG=true 行走原 diagram 路径行为不变）；`shared/generator/generators/decimal.js`（列式计算 addsub/mult 两数单步挂竖式；addsub-mix 三步/div（小数除能力缺口挂账）/word 情境/mult-estimate 估算不配；解析失败 fail-closed 不挂图）；`shared/generator/core/type-contract.js`（finishJudge 消费 errorResultOf 单源：judge 错误竖式 shown=图内错误得数、真命题撤遮蔽显真值；div/撞车（errV===真值）fail-closed 撤图）；`shared/validator/kp-semantic-validator.js`（isVerticalSupportGraphic 模块级 helper：type=calculation 且 role=calculation-support 判为计算支撑图，豁免 representation 门（allowedRepresentations 不含 graphic）与 graphicRole null 门两处拦截——课标竖式非意图示意图，防泄题由 maskResult 与 6g 承担）；`shared/svg/svg-calculation.js`（maskResult 遮蔽渲染：结果行 '?'、真值不进任何 text 节点；judge 错误得数 shown 形态；小数操作数数位对齐补点占位）；`dev/build-strategy-bundle.js`（stripComments 改字符串感知剥离——svg-calculation/type-contract 首次经依赖链入 bundle，朴素行注释正则截断 xmlns URL 字符串、只删块注释又让行注释 canonical ID 残留触发 kbl-uniqueness 误报，改为字符串/模板串内 // 保留、真注释删除）；`kbl/teaching/variation-profiles.json`（representation 硬轴重冻：dev/p27/derive-variation-profiles.js 重跑，A 类 KP 313/ALLOW 1323 行/representationPresent 655——decimal.js 全局挂图分支使 g5-u02-k003×calc 硬轴漂移）；`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建，16/17 确定性通过）；`dev/p40/q02-graphic-inventory.js`（opCount 分数口径修正：a/b 分数线替换数字占位不参与运算符计数——原「1/4 + 2/4」计 3 步致 L49 分数分支死代码、分数应配行漏盘，修正后应配 62→75）；`shared/generator/core/semantic-parameters.js`（**P40-Q-05 遗漏补记**：misconception-profiles 只读投影 getMiscons/projectMiscons——经 KnowledgeContext.misconceptionsFor 单一入口、文件兜底 loadTeaching，轻量形态仅透出 errorType/basis/feedback，Q-05 迷思桥数据侧）
- **deleted**: dev/p40/_q06-*.js/.out 临时探针 14 个（seed7 扫描/bundle ID 定位/6f 计数/链路追踪取证完毕后清理，判据留存本条目）
- **reason**: Q-02 盘点证据：calc 竖式应配 61 行命中 0（含 judge），课标笔算形态全断链。用户批准方案 A（20 行：整数加减 12 + 小数加减 4 + 小数乘 4，外加 judge 错误竖式）。落地过程三段：① validator 双门拦截（representation 门 + graphicRole null 门共用 KP_SEMANTIC_INTENT_ALIGNMENT 错误码，候选拒绝表现为 KP exhausted）→ isVerticalSupportGraphic 单点豁免；② kbl-uniqueness FAIL（bundle 注释残留 canonical ID x4）→ stripComments 字符串感知重写，否决 KNOWN_FINDINGS 登记路径（空表登记=掩盖）；③ 6f FAIL（g6-up-u02-k003/k004×judge 全候选被拒，FAILED 10）→ git diff 定根因为 vPlan 绕过 wantsG 全局生效把非目标行（intent 已授权 diagram）改判竖式 → 定稿 `vPlan && !wantsG` 恢复 wantsG 路径行为与 Q-06 前完全一致。另：负结果题（g4-u06-k002 seed11 产 1.1−1.2）致 svg-calculation 抛异常 → verticalPlan 负结果 fail-closed（R9 数值合理性采样缺口挂账生成器侧不顺手修）
- **tests**: 定向 `node --test tests/generation/p40-q06-vertical.test.js` 9/9（verticalPlan 判定矩阵含负结果 fail-closed、errorResultOf 单源、真实生成 descriptor 契约+渲染 SUCCESS+逐行防泄题+图文一致、finishJudge 三态、judge 行回归）；`npm test` 794/794；6b 冻结矩阵 1570/1570 零 DIFF（竖式挂图不改 questionFingerprint）；6e drift 硬违例 0、maker-matrix PASS；6g 泄露门禁 PASS（L2 渲染 663 全 SUCCESS 零断链、text 26 命中全登记、白名单零新增）；6f 失败分类 Layer A 1570/1570 PASS、Layer B FAILED=0（修复前 k003/k004 FAILED 10）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常）；盘点复盘 1570 行 genErr=0（竖式应配 75 命中 13 未配 62——盘点为 Q-SCAN 期非冻结 seed 参考面，与 6b 冻结面 seed 口径不同致 wantsG/形态分布不同，生产竖式判据以定向测试+6b 冻结面为准）
- **risk**: 低——竖式仅接管 wantsG=false 缺口行，wantsG 路径行为逐位不变（6f 实跑 FAILED=0 佐证）；负结果 fail-closed 仅撤图不改题面（走既有纯文字路径）；6g 白名单零新增零降标；variation-profiles 重冻仅 representation 硬轴口径（题面文案零改动）；盘点脚本 opCount 修正为只读证据工具口径修复不影响生产。挂账（后续任务处置，不在本条目展开）：①小数除竖式 4 行（decimal div 能力缺口）②分数加减竖式 2 行③div judge 错误竖式④百分数乘竖式⑤R9 采样缺口负结果题（生成器采样侧）⑥盘点面竖式 hit 的 wantsG 分桶细化（如需精确缺口账再立项）

---

## P40-Q-05B | 2026-10-13（#1 数域失守修复，并入 Q-SEM 缺陷修复）

- **modified**: `shared/generator/generators/arithmetic.js`（#1 封闭数域结果域守卫——纯加减法结构生成后按 genRange 判结果域（structInRange：answer∈[min,max]），越界即重采样（rng 顺序推进、确定性保持，guard<12）；乘除/混合不适用封闭数域直接放行；12 次仍越界且末运算符为 + 时钳制末操作数 = max−前缀和（≥1 才生效，否则保留交由 validator 判定））；`dev/p32/check-answer-leak.js`（AS-18 WHITELIST 新登记 1 条：math-g1-up-u01-k002/fill token「1」B-OPERAND——守卫改变该行 rng 消耗路径后产出「1 + ____ + 1 = 3」，答案 token 以操作数身份在题面非答案复述，与同 KP 既有「3」登记同族；条数注释 167→174 订正，实测 173→174）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（--write 重冻 10 行：math-g1-down-u04-k001 fill / u04-k002 fill / u05-k001 fill+choice+apply / u06-k001 calc+apply / math-g1-up-u01-k002 calc+fill+apply，全部为 G1 纯加减 KP 越界修复组合）；`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建，16/17 确定性通过）
- **deleted**: 无
- **reason**: 用户指令 #1 并入 Q-SEM（Q-17 R9 方案 A 口径全量实测暴露 10 行越界，163 抽样面只见 #1 一例，全量实为 10 行）。根因：操作数在 numberRange 内不代表结果在（91+26=117>numMax=100）。守卫口径三点：①仅纯加减法判结果域（乘除/混合结果域不封闭）；②越界重采样而非钳制优先（保 rng 确定性）；③钳制只对尾加法且 ≥1 才生效。6g 首跑 FAIL 为口径内新形态命中（答案 token「1」以操作数身份出现在题面，B-OPERAND 既有裁决族），按 AS-18 四元组登记非降标
- **tests**: 定向 `node --test tests/generation/p40-q05-misconception-distractors.test.js` 6/6（含 #1 回归断言：seed `p40q01|math-g1-down-u04-k002|apply|d3|a` 答案 ≤100）；6b DIFF 10 行 --write 重冻后只读复核 git diff=0；派生器重跑无回归；`npm test` 785/785；`node dev/check-all.js` 首跑 29 PASS / 1 FAIL / 1 SKIP（6g L1 未登记 1）→ 白名单登记后 **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常）
- **risk**: 低——守卫仅作用于纯加减法结构生成路径；重采样改变 rng 消耗路径致 10 行产出变化（全部为越界→入域修复，题面教学语义不变）；6g 登记 1 条为既有 B-OPERAND 裁决族形态非新泄露面；375/98/373/1570 与 6a/6e 零影响（check-all 实证）

---

## P40-Q-05 | 2026-10-13

- **modified**: `shared/generator/core/semantic-parameters.js`（新增 getMiscons/projectMiscons——T2 misconception-profiles 只读投影，P30-31 misconceptionsFor 同构：KC 单一入口 + Node loadTeaching 兜底；resolve 返回增 `miscons` 轻量形态 {errorType, basis, feedback}[]，KP 错误谱 951 slots 全量透出不按题型过滤——filter 责任在消费方干扰项桥）；`shared/generator/generators/arithmetic.js`（buildDistractorExpressions 迷思桥：概念混淆/符号错误→运算符共轭互换（+↔−、×↔÷）、口诀混淆→乘/除数错位（±1）、计算错误/步骤错误→off-by-one 升级溯源；返回 {exprs, provenance}；choice 分支写 `data.distractors=[{expr, errorType, source}]`，source∈{misconception, adjacent-fallback}）；`shared/generator/generators/concept-meaning.js`（finishChoice 增可选 provenance 参数——去重/截断剔除同步过滤保证溯源 expr ⊆ data.options，既有调用零影响；makeTimesChoice 迷思桥：口诀混淆→倍数错位乘式 base×(times±1)、概念混淆→倍除混淆 base÷times（可整除时）、其余雏形诚实降级——**#28 复现题修复实证**：seed `p40q01|math-g2-down-u03-k005|choice|d3|a` 干扰项由「8−4/2−9 乘减混淆雏形」升级为「8×3/8×5 口诀错位（迷思溯源）+8+4（诚实降级）」）；`tests/generation/p40-q05-misconception-distractors.test.js`（新建 5 断言：miscons 投影读信号 + 无剖面 KP 空态 + 有 slots KP 溯源产出 + 诚实降级 + 溯源⊆选项一致性）；`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（派生器重跑）
- **deleted**: 无
- **reason**: 用户指令执行 Q-05（misconception 驱动干扰项）。取证发现 T2 素材与 choice 消费面存在数据事实：①R15 复现题 #7 的 KP（math-g1-down-u04-k002）**无迷思剖面**（313/375 有 slots，该 KP 连 variation-profiles 均为空）——按 P30 §3 规则 3 语义字段不存在→诚实空态，禁 AI 编造；②#28 的 KP slots 中可构造 errorType（口诀混淆/计算错误）不触发 choice（triggerPattern 仅 calc/fill）——桥接口径采用 KP 错误谱全集（干扰项模拟学生在该 KP 的真实错误，不受响应文案触发面约束），#28 因此获得迷思驱动。calc/judge 共用迷思素材以同源 slots 承载：judge 的 data.misconception（P34-02）与 choice 溯源读同一 T2 剖面。#7 登记 needs-review（KP 无迷思剖面，R15 修复需派生器扩面/人工数据回流，非 Q-SEM 代码任务）；choice 概念选择型干扰项（非 times/求值型）其余 builder 雏形为同类挂账
- **tests**: 定向 `node --test tests/generation/p40-q05-misconception-distractors.test.js` 5/5（双证据全达成）；#28 复现题同 seed 验证实证（干扰项带口诀混淆溯源）；`npm test` 782/782；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；6b 只读复核一致（choice 干扰项属 data.options，不在题面/答案冻结指纹内，产出未变）；派生器重跑无回归
- **risk**: 低——①miscons 投影全量透出（951 slots×3 字段轻量形态），消费方仅两处干扰项桥；②arithmetic 迷思桥改动扰动策略优先级：迷思策略先于 deltas，可能改变部分 choice 行的干扰项组合（题面/答案/正确项不变，6b 复核一致实证）；③finishChoice provenance 过滤保证溯源⊆选项，判分契约零影响；④#7/概念选择型其余 builder 挂账为 T2 数据缺口（needs-review），待派生器扩面或人工数据回流

---

## P40-Q-04 | 2026-10-13

- **modified**: `shared/generator/generators/shape.js`（SHAPE_FEATURES.rectangle/square 第 3 项特征「对角线相等」/「对角线相等且互相垂直平分」→「有4条边」/「有4个角」——P34-01 同型年级适切修复：features 直接作为 judge 真命题/choice 正确项出给学生，对角线类结论性特征对 G1 直观认识超纲；新特征为边/角计数句，与 FALSE_FEATURE_POOL 假计数句真值互斥、与既有特征不冗余）；`tests/generation/p40-q04-grade-adaptation.test.js`（新建：#17 复现回归 + G1 平面图形认识 judge/choice 100 seed 全扫 + 立体图形初识主题化路径防波及）；`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（派生器重跑）
- **deleted**: 无
- **reason**: 用户指令执行 Q-04。**口径修正**：qt-intent.json 的 cognitiveLevel 实测 0/1570 行非空（T2 未派生该字段），且基线报告 §G2 已裁决「cognitiveLevel 仅难度加分，维持现状」——cognitiveLevel 驱动题型形态无数据前提且与 G2 裁决冲突，按裁决不做，Q-04 范围收窄为 R18 年级适配。#17 根因：math-g1-down-u01-k001（平面图形认识）无 SHAPE_THEME 条目，judge 走通用 makeFeatureQuestion 全池随机选特征命中「对角线相等」。R2 认知匹配随 Q-03 R1 修复闭环（基线标注「空壳题干致认知目标无从体现（随 R1 修复）」）。6b 冻结矩阵复核完全一致（git diff=0）：judge 真命题特征经 rng.pick 抽取，冻结 seed 未命中第 3 项，产出未变，无需重冻
- **tests**: 定向 `node --test tests/generation/p40-q04-grade-adaptation.test.js` 3/3；`npm test` 779/779；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；6b 只读复核 PASS（一致性成立：冻结 seed 的 rng 采样未命中被替换特征项）；6e 不涉及（maker 分工未变化，仍为 makeFeatureQuestion/makeRecognitionQuestion）
- **risk**: 低——features 第 3 项替换在全部年级均为数学真命题（边/角计数），高年级诊断性略降（真命题更基础）但假命题诊断由 FALSE_FEATURE_POOL 承担，教学风险可忽略。**登记同类潜在超纲清单（无复现题，按「登记不顺手修」纪律挂账）**：SHAPE_FEATURES 第 3 项中 circle「周长=2πr」（G6+）、triangle「内角和180度」（G4+）、cylinder「侧面展开是长方形」/cone「侧面展开是扇形」（G3+/G6+）、sphere「任意剖面是圆」（初中）、solid「有长宽高」（G5）、symmetry「对应点到对称轴距离相等」（G5+）、tessellation「可重复单元」——均存在被通用 makeFeatureQuestion/makeRecognitionQuestion 出给低年级 KP 的同类风险，待 R18 扩面任务或各 KP 主题化（SHAPE_THEME 补条目）时统一处置

---

## P40-Q-03 | 2026-10-13

- **modified**: `shared/validator/kp-semantic-validator.js`（checkIntentAlignment 新增第 5 维 constructs 对齐——读 intent.requiredConstructs 机器约束，题目 data.operation 经既有 normalizeOp 归一后按宽松兼容规则判定：op∈rc ∨ rc含mixed ∨ op=mixed∧rc≥2四则 → pass，其余 SEVERITY.ERROR；rc 空/题目无 operation → skip）；`shared/generator/generators/concept-meaning.js`（buildNumberConceptItem「1-5数的认识」补 choice 专用题面「排队报数，小明前面有 X 人，小明报几？」；「数位」分支补 choice「有一个数是 N（t 个十和 o 个一），数字 t 在哪一位上？」+ fill「t 个十和 o 个一，t×10+o = ____」+ fillAnswer=String(num0) 分型答案；buildNegativeItem 读写分支补 choice「支出 5 元记作 −5，这个数读作什么？」——三处均消灭 choice 回退空壳「{首段语境}，下面哪个选项正确？」）；`shared/generator/generators/reasoning.js`（choice else 分支去尾问句正则 `[^。！？]*[？?]$` 对无句读整句题面会把条件连同问句删空 → condChoice 空时回退「rewordCond(原句) + 正确选项是哪一个？」，与 seq 分支同型）；`tests/generation/p40-q03-required-constructs.test.js`（新建：构念闸门合成输入 6 断言 + R1 复现题 #8/#85/#88/#143/#161 真实生成链回归 5 断言）；`shared/engine/strategy-engine.bundle.js`、`shared/engine/presentation-engine.bundle.js`（重建，16/17 确定性通过）；`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`、`docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}`（--write 重冻，10 行受影响组合全部为本次修复直接组合：数位分支双 KP fill+choice ×2、负数读写双 KP choice ×2、1-5数 choice ×1、鸽巢三 KP choice ×3）；`kbl/teaching/variation-profiles.json`、`kbl/teaching/misconception-profiles.json`（题面文案改动触发派生器重跑，313 KP/1323 行剖面再生）
- **deleted**: `dev/p40/tmp-rc-audit.js`（临时吻合率审计脚本：全量 1570 实测 requiredConstructs vs data.operation——枚举命名错位归一后真缺口仅 23 例且全部为 rc=[mixed] 宽构念（21 例）/mixed 命名类（2 例），宽松规则 325/325 全绿，取证完毕即删）
- **reason**: 用户 2026-10-13 指令进入 Q-SEM 阶段（Q-SCAN 已过门）。Q-03 双线：①G1 缺口接通——requiredConstructs 投影已在（semantic-parameters L327）但生产零消费，闸门挂入既有 Intent Alignment 第 5 维（P30-15 同型），全量实测确认 ERROR 上线零真实 FAIL；②R1 复现题修复——五例根因全归一为「builder 缺题型专用字段/正则删空条件」，choice 空壳模板与 fill 错位分支不再被触发。#110（calc 答案语义偏移）为 P34-05 泄露裁决形态（calc 求积式规避 L1 泄露，题面已含构念陈述「积的因数就是这两个乘数」），登记残留不强修，R1 修复率 5/6=83%≥80% 达标；21 例 rc=[mixed] 单步题为「综合运用本册知识」类 KP 派生口径宽构念（非运算越界），按宽松规则 pass，登记弱缺口留派生器口径细化
- **tests**: 定向 `node --test tests/generation/p40-q03-required-constructs.test.js` 11/11（构念闸门双证据：合成违例 FAIL+合规 pass+归一+mixed 双向+skip；复现题 5 例题面断言全过）；`npm test` 776/776；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；6b/6e/GENERATOR-MATRIX 重冻后只读复核一致；全量 1570 宽松口径审计 0 FAIL
- **risk**: 中低——validator 新增 ERROR 级闸门（风险已由 1570 全量实测压平：568 非空行 325 检查行全绿，243 行无 operation 按既有 SEM-GATE 契约 skip）；8 行 format 债务（reasoning choice 换词通道）为 6e 既有登记口径；题面文案改动触发派生器/矩阵重冻已全部执行；#110 与 21 例 mixed 弱缺口已留痕待后续任务裁决

---

## P40-Q-17 | 2026-10-13

- **modified**: `dev/p40/q01-quality-baseline.js`（R9 判定口径两轮订正：第一轮 max→numMax（P30-14 双轨：max=难度等级/numMax=数值上限）；第二轮按用户批准方案 A 细分——numMax=null→n/a、非纯加减法（ops 含乘/除或空）→n/a、仅纯加减法按「N 以内加减法」封闭数域判结果域）；`docs/P40/p40-q-baseline.md`（§2 R9 行/§4 L1 汇总行/过门判据核对/§7 改写为缺口处置登记表）；`docs/P40/P40-TASK-BOOK.md`（附录 A 四行处置标注：#88→Q-SEM、#19→Q-09、#1→Q-SEM、G6 4 例伪影销账）
- **deleted**: `dev/p40/tmp-probe-nr.js`（临时探针：验证 percent 生成路径 pickStep 行为，取证完毕即删）
- **reason**: 用户 2026-10-13 裁决链——初裁「G6 百分数 4 例独立修补走 KBL 派生链」→ 取证推翻前提（三方证据：derive-kbl.js L50-51 P30-14 双轨注释、emit-canonical.js L83 仅 numMax!=null 透出 generation.numberRange、percent.js L47-54 pickStep 区间无交集显式回退为设计——T1 派生数据无缺陷，4 例为扫描 harness 误用难度等级当数值上限的口径伪影）→ 用户改批「修扫描工具口径」并批准 #1 并入 Q-SEM → 第二轮重跑新暴露乘法/组合 4 例伪影（numMax 语义为算子域非结果域）→ 用户批准方案 A（R9 脚本判定限纯加减法封闭域）。缺口处置结论：G6 4 例销账、#49/#69/#70/#71 销账、#1（真越界）并入 Q-SEM、#88 并入 Q-SEM、#19 并入 Q-09
- **tests**: Q-01 重跑 genErr=0，R9 最终 **n/a 156 / pass 6 / FAIL 1**（#1，已登记并入 Q-SEM），无伪影；npm test 765/765；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；零生产代码/零 KBL 改动，6a/6b/6e/派生器零影响
- **risk**: 低——dev 扫描工具口径订正 + 文档订正；基线报告 R9 结论由「5 例缺口」修正为「1 例真越界（Q-SEM 承载）+ 8 例伪影甄别销账」，修正过程全程留痕可追溯；Q-SCAN 过门判据不受影响（缺口量化仍成立），待用户确认后进 Q-SEM（P40-Q-03/04/05，含 #1/#88 生成器修复）

---

## P40-Q-01 / P40-Q-02 | 2026-10-12

- **modified**: `docs/P40/p40-q-baseline.md`（新建，Q-SCAN 交付物：23 维基线 + G4 定量 + R8/R11 缺口修补建议）；`docs/P40/P40-TASK-BOOK.md`（头部执行状态转「已启动，战役一先行」；新增附录 A 复现题登记 21 行）；`dev/p40/q01-quality-baseline.js`、`dev/p40/q02-graphic-inventory.js`（新建，只读扫描工具，6b 同口径确定性 seed，Q-14 复评复用）；`docs/P40-PREP.md` → `docs/archive/phases/P40-PREP.md`（INIT 遗留归档）
- **deleted**: 无（归档为移动，非删除）
- **reason**: 用户 2026-10-12 显式指令「直接启动P40修复，大方向先战役一」。Q-SCAN 阶段（只读，无生产代码改动）：Q-01 按 grade×domain×questionType 95 非空层比例抽样 163 题（≥120）真实生成逐维评分；Q-02 全量 1570 行生成盘点图形消费。核心结论：L1/L2 存量门禁复证通过（R7 0 FAIL/R10 163过/R19 逐字节一致/R20 0 FAIL+8 家长检查）；R9 缺口 5 例（G6 百分数 KP numberRange=100 与基数 1000–1500 模板级矛盾 + G1 应用题 117 越界）；R11 缺口 6 例（含 #88 答案-题面错配）；L3 最大短板为 R4 竖式应配 61 行命中 0、R5 分数配图 12.6%、R1 空壳题干模板缺陷、R6 复述类解析 ≥10 例、R13 语序错乱 2 例；G4 定量化：SVGCalculation 6 API 零生产消费、svgTemplate 死信号（无描述符 calc 题 0 个 svg）；G3 实证：choice 干扰项无迷思溯源。R8/R11 缺口修补建议 3 项待用户裁决（任务书纪律：未经显式指令不开工）
- **tests**: npm test 765/765；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；扫描脚本两轮运行 genErr=0（163×2 + 1570），Q-01 二次生成 163/163 逐字节一致；零生产代码改动，6a/6b/6e/派生器零影响
- **risk**: 低——纯只读扫描 + 文档/开发脚本新增；dev/p40/out/ 证据文件属运行产物不属 docs 冗余；Q-SCAN 过门判据已满足，待用户确认后进 Q-SEM（P40-Q-03/04/05）

---

## P40-T-14 | 2026-10-13

- **modified**: `dev/p40/t14-mainline-audit.js`（新建：三主线全链抽查）、`dev/p40/out/t14-mainline-audit.json` + `t14-mainline-audit.md`（新建：链路图 + 证据）；`docs/P40/P40-TASK-BOOK.md`（头部执行状态：战役二 S0-S3 全任务完成，待用户签收）
- **deleted**: 无
- **reason**: 任务书 S3 §2.3 P40-T-14 验收。三主线：加法（`fam_addsub` 26 KP）/ 分数（`fam_fraction` 30 KP）/ 面积（`fam_measure` 24 KP），G1→G6 全链逐 KP 抽查五维：① familyId 一致（全成员 conceptFamily.id === 族）；② stageOrder 递增（族内唯一、沿链严格递增）；③ 难度不倒挂（validateFamilyDifficultyMonotonic，违规登记 needs-review 挂人工，不自动改数——T-07 口径）；④ 解释衔接（有同族前序者经 resolve().upstream 获承上启下桥接，前序须同族）；⑤ 组合合规（主线的跨族前置组合经 validateCrossFamilyPrerequisite 判定可满足）。**结论**：结构三维 + 组合合规 **全过**（加法组合 5/5、分数 5/5、面积 3/3 可满足；衔接 22/26、28/30、22/24 有同族前序）；难度倒挂三主线合计 **13 处**（加法 7 / 分数 2 / 面积 4）登记 needs-review，与 T-07 全库 54 处口径一致（属既有 seedDifficulty 事实，非本战役引入）。
- **tests**: `node dev/p40/t14-mainline-audit.js` 三主线结构/组合 PASS；全量门禁 **`npm test` 858/858**、`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；6a/6b/6e 复跑零漂移；16/17 bundle 确定性 PASS；20 Doc PASS）。**用户签收后战役二关闭。**
- **risk**: 低——纯只读抽查 + 证据留档，零生产代码/数据改动；难度倒挂为登记项（T-07 已挂人工），不在本任务自动改数。**挂账**：①三主线难度倒挂 13 处待人工裁决（合并入 T-07 全库 needs-review 清单）；②全链人工评审（链路图 `t14-mainline-audit.md`）待用户签收。

---

## P40-T-13 | 2026-10-13

- **modified**: `docs/02-KBL.md`（§4 写方白名单表补全 P33 后新增 7 脚本并声明与 `check-kbl-ai-boundary` `KBL_WRITER_WHITELIST` 一一对账；新增「产物↔派生器↔消费方对账表」；新增 §7「概念族/序规则/evolution 口径（P40-T-13 冻结声明，E8）」固化 R-FAM-01..04 + 变更重跑流程 + 公开契约冻结 + 已知观察项；新增 §8「版本迁移挂账（E7）」）；`tests/semantic/p40-t13-kbl-doc-alignment.test.js`（新建 2 断言：§4 白名单↔门禁白名单一一对账、§7 冻结声明齐备）
- **deleted**: 无
- **reason**: 任务书 S3 §2.3 P40-T-13（E7/E8）。①`docs/02-KBL.md` §4 原「P25 教学语义派生」为泛化行，缺 `derive-bc-evidence-rules.js` 及 6 个 P25 派生器——补全为 17 行显式表，与门禁白名单逐条对账（消除「文档漂移」风险）；②冻结声明以命名常量（`CONCEPT_FAMILIES`/`EXTRA_FAMILIES`/`computeStageOrders`/内联 evolution 判定）为 SSOT，规定变更须走派生器重跑+重冻，禁止手改产物；③E7 多版本 Excel 共存明确挂账（属基线扩容另立项，未经指令不开工）。
- **tests**: 定向 `node --test tests/semantic/p40-t13-kbl-doc-alignment.test.js` 2/2；`node dev/p28/check-doc-consistency.js` PASS（非 archive 文档零历史数字命中）；全量门禁见 T-14 条目。
- **risk**: 低——纯文档补全 + 冻结声明入档；`check-kbl-ai-boundary` 白名单本身未改（17 项既有），文档仅追平；冻结声明不改变现有派生行为。

---

## P40-T-12 | 2026-10-13

- **modified**: `dev/p40/t12-regression-baseline.js`（新建：七项回归基线校验 + 快照归档）、`dev/p40/out/t12-regression-baseline.json`（新建：验收证据快照）；`tools/kbl/derive-relations.js`（`module.exports` 追加 `validateEvolution` + `reportCrossFamily` 导出——供 T-12 复用，纯导出无行为变更）
- **deleted**: 无
- **reason**: 任务书 S3 §2.3 P40-T-12（E6，基线即验收标准）。七项：① 38 边 evolution 覆盖率 100%（op∈闭集、fromStageOrder<toStageOrder）；② 同族 stageOrder 无重复（0）无年级倒挂（0）；③ familyId 375/375；④ 跨族前置无环——**权威判据=canonical 373 前置边 KP 级 DAG 无环 + evolution 图无环（validateEvolution 通过）**，T-06 族投影环为 primary-family 折叠产物（共享单元多族归属）登记观察、非数据违规；⑤ qt-intent 重放逐字节一致（重跑 `derive-qt-intent.js` 前后 SHA256 不变，1570 零重冻）；⑥ 6a 复跑 FAIL=0；⑦ 快照归档。
- **tests**: `node dev/p40/t12-regression-baseline.js` **七项全过**：① evolution 38/38 bad=0｜② 族 22 dup=0 inv=0｜③ familyId 375/375｜④ DAG=true ev=true（族投影环=true 观察）｜⑤ qt-intent 零重冻｜⑥ 6a FAIL=0；快照 `dev/p40/out/t12-regression-baseline.json`。全量门禁见 T-14 条目。
- **risk**: 低——T-12 脚本仅只读校验 + 证据落盘（写 `dev/p40/out/`，不触 KBL）；`derive-relations.js` 仅加导出无逻辑变更（重放 hash 稳定由 17 门禁复证）。**观察项**：T-06 族间环（`fam_multiply⇄fam_divide` 等）待人工确认是否需在 T-06 报表口径中改进（当前登记 needs-review 不改数）。

---

## P40-T-01 | 2026-10-13

- **modified**: `dev/p25/derive-qt-intent.js`（同文件内将五问推导命令式分支收敛为**声明式决策表**，行为等价：① `WHY_MATCH_RULES`——whyThisType 五条题型选取证据（认知匹配/表征支持/数值表征/范畴对应/情境支持）由 `when(ctx)` 谓词 + `text(ctx)` 产出声明；② `DIFF_DIM_RULES`——differentiation 五维差异（范畴/干扰项/情境/图形/认知跨度）声明；③ `ALLOWED_REP_RULES`——assessment.allowedRepresentations 两条纳入规则声明；④ `GRAPHIC_ROLE_RULES`——graphicRole 三级决策（geometry×geometry×concept→auxiliary / geometry×geometry→carrier / 其余→auxiliary）声明；⑤ 新增 `evalTable`/`firstMatch` 两个表求值原语。判定谓词与产出文本逐字保留，表仅重组既有 if 分支）
- **deleted**: 无
- **reason**: 任务书 S0 §2.3 P40-T-01「`derive-qt-intent.js` 推导规则收敛为声明式决策表（同文件内重组织，行为等价）」。目的：把散落在 `deriveRow` 内的硬编码 if 链外化为可独立审计的命名规则表（与 T-02 族表/排序五规则同纪律——规则以命名常量存在，可独立审计），为后续维护提供单一可读决策面，零语义变更。
- **tests**: 重放逐字节一致取证：改前 `kbl/teaching/qt-intent.json`/`P25-KP-QT-INTENT.md` 快照 → 重构后重跑 `node dev/p25/derive-qt-intent.js` → `diff` 三产物**逐字节一致**（qt-intent.json / P25-KP-QT-INTENT.md / qt-intent-sample.xlsx）；计数不变 `1570/1570；confirmed=169 ai-verified=1401 needs-review=0`；旗标不变 `{"representation-conflict":4}`；三产物 `git status` 相对 HEAD 零漂移。全量门禁见战役二 T-14 收口条目。
- **risk**: 低——纯同文件重构，零输出语义变更（逐字节一致为证）；`derive-qt-intent.js` 为 P25 dev-time 派生器，不入 `npm run kbl:derive` 链、不入运行时；qt-intent.json/运行时投影 rootHash 不变。

---

## P40-T-02 | 2026-10-13

- **modified**: `tools/kbl/derive-relations.js`（**族表声明化 SSOT**：`CONCEPT_FAMILIES` 11 主干族〔familyId/name/stages 有序阶段表〔grade/book/unitName 片段〕/ops 演化 op 数组〕+ `EXTRA_FAMILIES` 14 扩展族 + `FAMILY_RULES` 优先级 regex 归类表〔首条命中〕+ `familyMembership`/`classifyFamily`【一 KP 可多族归属，主族=首条】+ `computeStageOrders`〔族内按 grade → book〔up<down〕→ unitOrdinal → knowledgeNo 全序，分配 1..n 无并列〕+ `validateFamilyTable`〔重复 familyId / 同名多族 / ops 与 stages 长度不符 / 非法 op 一律抛错〕）；`tools/kbl/derive-kbl.js`（require 单一 SSOT，按 `computeStageOrders` 回填 `conceptFamily`）；`tools/kbl/emit-canonical.js`（透出 conceptFamily）；`shared/knowledge/data/.../knowledge-points.json`（T3 镜像同步）
- **deleted**: 无
- **reason**: 任务书 S0 §2.3 P40-T-02（E1 族定义完备性 / E2 stageOrder 全序性）。族定义三规则 + stageOrder 排序五规则固化为命名常量（可独立审计），**族表 SSOT 落于 `derive-relations.js`**（R-REL-03 概念主干链的天然声明位），由 `derive-kbl.js` require 复用，避免双份族定义漂移。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-02 用例）6/6 内含：`validateFamilyTable` 通过；11 主干 + 14 扩展；`computeStageOrders` 覆盖 375 KP、族内 stageOrder 唯一；`classifyFamily` 全 KP 有归类。373 条逐条不变由 T-12 基线复证；全量 `npm test` 858/858。
- **risk**: 低——族表为关系派生的纯增量声明（R-REL-03 链本已存在，仅补 familyId/stageOrder 元数据）；加字段不增边，Relations 计数 373 不变；派生器内联 `validateFamilyTable` 保证非法族表在 `kbl:derive` 即 FAIL（check-all 2. KBL 复证）。

---

## P40-T-03 | 2026-10-13

- **modified**: `tools/kbl/build.js`（新增 `assertTeachingMirrorInSync()` 并挂入 build 步骤 2b：在 emit 覆盖镜像**之前**，对 `MIRRORED` 清单〔`misconception-profiles.json` / `context-library.json`〕比对 `kbl/teaching` ↔ `shared/knowledge/teaching`，JSON 规范化后不等即 `throw('[T-03 副本漂移] ...')`；不新建独立门禁文件，随 `kbl:build` 生效）
- **deleted**: 无
- **reason**: 任务书 S0 §2.3 P40-T-03。防 T2 教学语义副本（源 `kbl/teaching` → 运行时分发 `shared/knowledge/teaching`）被手改而绕过派生器造成「镜像漂移双轨」。仅原样镜像产物参与比对；投影类（qt-intent→qt-intent-runtime）与 dev-only 源不在清单。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-03 用例）断言两副本 JSON 逐字节一致（等价于守卫不变量；不等则该守卫在 `kbl:build` 抛错拦截）；`node dev/check-all.js` 2. KBL（含 `kbl:build`）PASS。
- **risk**: 低——守卫为只读比对，零产出变更；`kbl:build` 正常链下镜像一致即通过；人为制造漂移将被 build 步骤 2b 拦截 FAIL（`throw` 语义），恢复一致后 PASS。

---

## P40-T-04 | 2026-10-13

- **modified**: `tools/kbl/derive-relations.js`（**R-REL-03 概念主干链 38 边追加 `evolution{familyId, fromStageOrder, toStageOrder, op}`**：op 取族表声明 `fam.ops[i-1]`∈{`extend_number`|`increase_complexity`|`abstract_up`|`inverse`}；新增内联 `validateEvolution`〔同族 stageOrder 严格递增 + 年级不倒置 + 演化子图 Kahn 无环〕，在写盘前调用）；`kbl/relations/math/relations.json` + `kbl/canonical/relations.json`（38 边 evolution 落盘）；`shared/knowledge/relations/math/relations.json`（T3 镜像）；`tools/kbl/emit-canonical.js`（透出 evolution）
- **deleted**: 无
- **reason**: 任务书 S1 §2.3 P40-T-04（E3 跨族前置无环 / E4 evolution 字段完整性）。op 取族表声明（T-02 的 `ops`），使演化语义与族阶段表同源、可审计。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-04 用例）：38/38 边 evolution 合法（op∈闭集、`toStageOrder>fromStageOrder`、familyId 属主干族）、`validateEvolution` 无环通过。op 分布：`increase_complexity` 25 / `extend_number` 7 / `abstract_up` 5 / `inverse` 1。边数仍 373；重跑确定性由 17. Determinism 门禁复证。
- **risk**: 低——仅给既有 38 条 R-REL-03 边补元数据（不增边）；内联 `validateEvolution` 在 `kbl:derive` 即拦截非法演化（check-all 2. KBL 复证）；`inferred/reviewStatus` 口径不变。

---

## P40-T-05 | 2026-10-13

- **modified**: `kbl/canonical/capability.json`（**375/375 回填 `familyId` + `stageOrder`**）；`kbl/manifest/manifest.json`（rootHash 重算回填）；`kbl/data/math/*/knowledge-points.json` + `shared/knowledge/data/math/*/knowledge-points.json`（conceptFamily 落数据 + T3 镜像）；`tools/kbl/derive-kbl.js` / `tools/kbl/emit-canonical.js`（派生回填链）
- **deleted**: 无
- **reason**: 任务书 S1 §2.3 P40-T-05。capability 作为难度/族消费的单一权威，需携带族归属与阶段序，供 T-07/T-09/T-11 只读消费。**加字段不增边**：只回填 capability 字段，不动 Relations 计数。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-05 用例）：capability 375 行、familyId+stageOrder 覆盖 375/375、`manifest.rootHash` 为 64 位十六进制；`tests/generation/p40-t11-family-contract.test.js` 断言 `get(id).semantic.conceptFamily` 覆盖 375/375。四数 375/98/**373**/1570 不变（T-12 基线）；rootHash 合法新值 `3df605b9…`；T3 镜像同步由 T-03 自检复证。
- **risk**: 低——纯字段回填 + 重算哈希，`kbl:derive → emit-canonical → build → build:knowledge` 全链重建，17. Determinism 复跑 hash 稳定为证。

---

## P40-T-06 | 2026-10-13

- **modified**: `tools/kbl/derive-relations.js`（新增并导出 `reportCrossFamily(relations, knowledge)`：从既有 373 条 `prerequisite` 边聚合族间关系〔`source.familyId≠target.familyId`〕→ `familyEdges` 计数 + 族间图 Kahn 无环 + 年级倒挂检测；**纯校验不落盘**，违规挂 needs-review 不自动改数；在 `kbl:derive` 内联调用产报告）
- **deleted**: 无
- **reason**: 任务书 S1 §2.3 P40-T-06（E3）。跨族前置投影**零新增产物文件**（字段裁决 `prereqFamily[]` 不落盘，运行时聚合），为 T-10 组合校验提供口径。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-06 用例）：族内 303 / 跨族 70 条（= 373 全边）、族间边 61 条、返回无环标志、KP 级前置图无环；T-12 基线 `crossFamily` 项复证。**观察项**：族投影环（`fam_multiply⇄fam_divide` 等，primary-family 折叠产物〔共享单元如「7～9的表内乘、除法」多族归属〕）登记 needs-review，不改数。
- **risk**: 低——纯只读聚合 + 控制台报告，零落盘；族投影环为归类口径的已知观察项（KP 级 DAG 与 evolution 图均无环，权威判据成立），挂人工。

---

## P40-T-07 | 2026-10-13

- **modified**: `shared/validator/difficulty-integrity-validator.js`（新增并导出 `validateFamilyDifficultyMonotonic(rows)`：按 familyId 分组、stageOrder 排序，断言靠后者 `seedDifficulty ≥` 前序，违规登记 `needsReview`〔含 `difficultyDelta`，现算不落盘〕）；`dev/p40/t07-family-difficulty-scan.js` + `dev/p40/out/t07-family-difficulty.json`（**现网 375 行扫描证据**：22 族、54 处倒挂）
- **deleted**: 无
- **reason**: 任务书 S2 §2.3 P40-T-07。族内难度递进校验上线；**倒挂登记 needs-review 挂人工，不自动改数**（属既有 seedDifficulty 事实）。
- **tests**: 定向 `node --test tests/semantic/p40-t02-t07-foundation.test.js`（T-07 用例）：现网 `checked=375`、`violations=54`、`valid=false`，与扫描产物 `t07-family-difficulty.json` 一致；合成倒挂（stageOrder 2 diff<link>3）可被判出。逐族分布（addsub 7 / shape 8 / integer 1 / review 2 / relation 2 / statistics 4 / multiply 3 / divide 2 / direction 3 / measure 4 / problem_solving 4 / observation 1 / operation_law 1 / fraction 2 / motion 3 / decimal 3 / number_algebra 3 / negative 1）。T-14 三主线复算同口径（13 处）。
- **risk**: 低——新增校验器为纯函数 + 扫描脚本写 `dev/p40/out/`（不触 KBL）；54 处倒挂为登记项（合入人工裁决清单），零生产代码/数据改动。**挂账**：54 处倒挂待人工裁决。

---

## P40-T-09 | 2026-10-13

- **modified**: `shared/strategy/adaptive-strategy.js`（新增并导出 `orderByStageOrder(items, opts)`：按 `(familyId, stageOrder)` 稳定排序（familyId 升序 → stageOrder 升序 → 原序兜底），`opts.getKp(id)->{familyId,stageOrder}`；**无 getKp 时原样返回**，保持生产既有顺序）
- **deleted**: 无
- **reason**: 任务书 S2 §2.3 P40-T-09「策略感知（含防跳阶出题）」——learner 巩固/拓展序列按 stageOrder 排序，**只读消费**：不改数量/题型/难度/KP 选择（Z1-Z4 决策权仍归既有链）。
- **tests**: 定向 `node --test tests/orchestration/p40-t09-sequence-order.test.js` 2/2（同族按 stageOrder 递增排序；无 getKp 时原样返回 = 生产行为不变）。Z1-Z4 不夺权由 6d. Generation（四轴不夺权）门禁复证。
- **risk**: 低——新函数未被默认路径调用（接线由消费方按需传入 getKp），缺省即恒等；纯排序不改集合。

---

## P40-T-10 | 2026-10-13

- **modified**: `shared/validator/composite-validator.js`（新增并导出 `validateCrossFamilyPrerequisite(kpIds, opts)`：跨族（familyId 不同）KP 对须存在 `prerequisite` 边可达〔`relationsFor` 只读消费〕，否则记 `missing` 使组合被拒；**无解析器时 skipped 保持生产行为**）
- **deleted**: 无
- **reason**: 任务书 S2 §2.3 P40-T-10「跨族组合校验」——composite 生成器组合多个 KP 时校验族间前置已满足。**零新数据**：复用既有 373 `prerequisite` 边 + T-06 投影口径，经运行时公开口 `relationsFor` 只读消费。
- **tests**: 定向 `node --test tests/generation/p40-t10-composite-cross-family.test.js` 3/3（含未满足跨族前置的组合被拒）；现网组合题扫描随门禁复跑。`shared/orchestration/knowledge-context.js` 新增 `relationsFor(id,direction)` 只读通道（含 evolution 透出）。
- **risk**: 低——校验器为可选传入（无解析器即跳过），不改既有 combine 决策；只读消费关系边，零落盘。

---

## P40-T-11 | 2026-10-13

- **modified**: `tests/generation/p40-t11-family-contract.test.js`（新建：契约测试冻结 familyId/stageOrder/evolution 经既有公开口只读可及）；`shared/orchestration/knowledge-context.js`（`relationsFor` 只读通道透出 `{outgoing,incoming}` 含 evolution——与 T-08/T-10 共用同一接线）
- **deleted**: 无
- **reason**: 任务书 S2 §2.3 P40-T-11「消费⑤⑥ 数据就绪透出」：familyId/stageOrder 经 knowledge-contract **既有公开口**（`get().semantic.conceptFamily` / `relationsFor`）只读可及，为掌握度按族聚合（⑤）与错答族归因（⑦）提供数据通道；**不新增 PUBLIC_API**，UI 展示不实施（P31 冻结二级页面，挂账）。
- **tests**: 定向 `node --test tests/generation/p40-t11-family-contract.test.js` 3/3：① `get(id).semantic.conceptFamily` 覆盖 375/375（`{id,stageOrder}`）；② `relationsFor` 透出 evolution（38/38）；③ PUBLIC_API 仍 13 项、未新增族相关方法、既有口（get/relationsFor/intentFor/contextLibrary/misconceptionsFor）保留。
- **risk**: 低——无新增生产 API（白名单冻结不变）；仅消费 T-05 已回填的数据字段；UI 展示挂账（P31 冻结）。

---

## P40-T-08 | 2026-10-13

- **modified**: `shared/generator/core/semantic-parameters.js`（① 新增 `getUpstream(kpId)`：取 KP 前置入边中同 `conceptFamily` 且 `stageOrder` 最大者为承上启下锚，name/definition 逐字取自 canonical（`semantic.concept` 镜像），无同族前序→null；② resolve() 返回增 `upstream` 字段（只读投影，零写入）；③ 新增并导出 `composeExplanation({upstream,name,current})` 三段模板——「我们之前学过〈前序名〉（前序定义要点）。把〈前序名〉和〈本课名〉结合起来看：」+ current，无前序/同名原样返回 current）；`shared/generator/generators/concept-meaning.js`（generate 内于 `VariationApply.applyToAll` 之后、`SemanticEvidence.attachAll` 之前，对 `params.upstream` 存在者套桥接句——仅改解析文案，题面/答案/难度/题型零改动）；`shared/engine/strategy-engine.bundle.js` + `shared/engine/presentation-engine.bundle.js`（重建，source==bundle）；`tests/generation/p40-t08-explanation-bridge.test.js`（新建 5 断言）；`tests/generation/p40-q11-definition.test.js`（L2 两断言增 `stripBridge` 剥离可选桥接前缀后再校验冻结的「判断依据：/依据定义：」契约——桥接句逐字引前序不改变本题定义引用契约）；`dev/p40/t08-explanation-samples.js` + `dev/p40/out/t08-explanation-samples.md`（新建：20 题抽样，跨族，逐题对照 canonical 前序名/定义要点，人工评审证据）
- **deleted**: 无
- **reason**: 任务书 §2.3 消费② P40-T-08「解释承上启下三段模板」。设计要点：①引用文本逐字来自 canonical（前序 KP name + `semantic.concept` 定义要点），禁编造——definition 缺失或等于 name 时仅引用名称不硬凑；②无同族前序不硬加（`getUpstream` 返回 null 时解析保持既有形态），诚实退化；③upstream 判定完全走既有 373 prerequisite 边 + capability `familyId`/`stageOrder`（T-04/T-05 产物），零新增数据源/零新 PUBLIC_API。**冲突裁决**：桥接句会前置到所有有同族前序 KP 的 concept-meaning 解析，与战役一 Q-11「解析以『判断依据：/依据定义：』开头」冻结断言冲突——裁决为 T-08 显式变更解释模板，Q-11 断言剥离可选桥接前缀后校验本题定义引用契约（契约本身不变），并登记本条目。
- **tests**: 定向 `node --test tests/generation/p40-t08-explanation-bridge.test.js` 5/5（composeExplanation 逐字含/不含定义、无前序不硬加（缺失/同名/空参）、resolve().upstream 全库逐字取自 canonical ≥20 例、端到端解析前置桥接句逐字引 canonical 前序）；Q-11 定向 7/7（含剥离桥接后 L2 契约）；`npm test` **851/851**（843 基线 + T-08 5 新增 + 战役二 T-09/T-10/T-11 新增）；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（#15 无 Chrome SKIP 属正常；16/17 bundle source==bundle + 确定性 PASS；6a/6b/6e 矩阵零漂移——解析文案不入 questionFingerprint；6g 答案泄露门禁 PASS）
- **risk**: 中低——生成面变化限 concept-meaning 覆盖的 KP（angle/area 等）解析文案，题面/答案/难度/KP/题型集合零改动（375/98/373/1570 不变）；`getUpstream` 每次 resolve 触发既定 relations 查询（纯内存，无 I/O 放大）；改 shared/generator 生产代码已重建 strategy/presentation bundle（16/17 为证）。**挂账登记**：①仅 concept-meaning 消费 upstream，其余生成器承上启下留后续按需扩面（P30 红线 9 不顺手扩）；②20 题人工评审（`dev/p40/out/t08-explanation-samples.md`）待用户签收。

---

## P40-Q-16 | 2026-10-12

- **modified**: `shared/styles/tokens.css`（删除 8 个零消费死令牌：`--math-secondary/--math-accent`、`--cn-primary/secondary/accent`、`--en-primary/secondary/accent`；订正同块注释——「cn/en 色板为通用强调色（math 插件作为补充配色引用）」指向的消费者已不存在，改为声明 `--math-primary` 为唯一在用科目色）；`docs/P40/P40-TASK-BOOK.md`（§1.2 附带登记行销账 + 头部执行状态行增补③）
- **deleted**: `shared/styles/tokens.css` 内 8 个令牌声明（物理删除不留壳，无别名/无兼容层）
- **reason**: 用户 2026-10-12 显式指令「按方案 B 执行，清理全部 8 个死令牌并订正注释」。R22（P40-Q-15）对比度审计登记的 `--en-*` 清理候选，经分析扩围为同块 8 个死令牌（cn 色板与 math-secondary/accent 同为零消费），三方印证成立：①全库 grep 零 var() 消费、JS 零字符串拼接引用、plugins/ 现存 6 文件均为 SVG 生成器 JS 无 CSS；②门禁 21（check-dead-code 15 项）/22（check-legacy-matrix 5 项）PASS——现网通过即无门禁断言其存在；③测试面零引用。历史注释失真根因：DEV_LOG L1898 记载的「math 插件复用 var(--en-primary)」所指科目 CSS 已在 P33 清理中移除。
- **tests**: npm test 765/765；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；改后残留扫描：生产代码零命中（剩余命中仅 change-log/任务书登记文本与 archive 档案，档案按 P28 判例不动）；CSS 不入 JS bundle 无需重建；未触题面/答案/文案，派生器与 6b/6e 矩阵零影响
- **risk**: 低——纯删除零消费声明，渲染路径（屏/打/直渲）均不读这些值；P31 屏/打 token 纪律不受影响（4 个屏打 token 未触碰）；archive 历史档案保留原文不改写

---

## P40-INIT-C | 2026-10-12

- **modified**: `docs/P40/P40-TASK-BOOK.md`（头部新增「执行状态」标记：P40 挂起尚未启动，已完成项=立项文档三连（INIT/INIT-A/INIT-B 含 8 字段裁决 3 采纳 5 不落盘）+ 前置任务 P40-Q-15（R22 无障碍，唯一已实施生产代码任务）；战役一 Q-SCAN 起、战役二 S0 起全部任务待用户显式启动指令）
- **deleted**: 无
- **reason**: 用户 2026-10-12 指令「处理R22，且处理外部提案 8 字段 → 裁决 3 收 5 不落盘，在P40中的任务指令。暂时不启动P40」。核实两项均已在前序登记中落地：R22 已由 P40-Q-15 实施完毕（svg-registry `<title>` 注入 / tokens.css 对比度 / 6g L2 口径 / svg-contract 3 断言 / 30-0-1 全绿），8 字段裁决已固化于任务书 §2.2 并被 T-04/T-06/T-07 引用——本次仅将「暂时不启动」固化为任务书头部执行状态标记，防止执行期误启动。
- **tests**: 无（纯文档修订，无代码改动）
- **risk**: 低——状态标记不改变任何任务定义、门禁口径与基线数字；未启动即无生产影响。遗留：`--en-*` 死令牌族清理候选维持挂账（不顺手修）。

---

## P40-INIT-B | 2026-10-12

- **modified**: `docs/P40/P40-TASK-BOOK.md`（§2.2 核心决策重写：evolution 采用 familyId + 新增 9 行字段裁决表；§2.3 整体重写为 S0 地基/S1 存储/S2 消费/S3 验收共 14 任务结构，含 E1-E8 维度映射与各任务出口判据；§2.4 新增 composite 定向测试局部门禁；§4 战役二执行顺序更新为 S0-S3；§6 验收矩阵新增「族结构 E1-E8」行）
- **deleted**: 无
- **reason**: 用户 2026-10-12 显式指令「阅读以下分析，完善战役二的维度」。外部评估提案逐项裁决：①evolution 字段——familyId/stageOrder/op 采纳落边；stageKey/stageKey 类稳定键不采纳（kid 即稳定键）；gradeFrom/gradeTo 不落盘（年级可由 unit 关系确定性查出）；difficultyDelta/prereqFamily[] 不落盘（派生数据运行时现算，防第二事实源）；confidence/evidence 不落盘（确定性派生无置信度语义，溯源由派生器规则版本承载）；frozen 不落盘（T1 全量冻结已由 rootHash 指纹承载，族级冻结标记无消费者属过度设计）。②族定义三规则（E1）与 stageOrder 排序五规则（E2）落 S0 地基任务。③消费面 3→6：难度递进校验、解释三段模板（upstream/bridge/current 逐字来自 canonical）、策略感知（防跳阶并入）、composite 跨族组合校验（纯校验不落盘）、学生模型映射与诊断归因降为「数据就绪透出+UI 挂账」（UI 属 P31 冻结二级页面）。④E7 版本迁移挂账（多版本 Excel 共存属基线扩容另立项）。⑤明确不采纳 AI 排序提示词方案——族内序为确定性规则派生（grade→volume→unit_no→教材行序），不引入运行时 LLM，与 P28/P30 数据纪律一致。
- **tests**: 无（纯文档修订，无代码改动）
- **risk**: 低——任务书为计划文档，375/98/373/1570 基线零影响；关键防扩散纪律：新增字段均受「派生数据不落盘、一个语义一个 SSOT」约束，消费面⑤⑥不做 UI 改动（P31 冻结），E7 多版本迁移需另立项未经用户指令不开工。

---

## P40-Q-15 | 2026-10-12

- **modified**: `shared/presentation/svg-registry.js`（render() 单点注入 `<title>` 可访问名：A11Y_TYPE/ROLE_LABELS 固定枚举，role 优先 type 回退，不含数值语义；A11Y 标签枚举对外暴露）；`shared/styles/tokens.css`（`--toolbar-btn-ghost-ink` #5a5adf→#5050d9，13px 正文对比度 4.50:1 临界→5.19:1，仅改色不动布局）；`dev/p32/check-answer-leak.js`（6g L2 口径：`<title>` 从可见文本扫描剥离（无障碍元数据非题面材料），但逐一校验 ∈ A11Y 注册枚举，非注册标签=新泄露形态 FAIL——门禁不放松）；`shared/engine/presentation-engine.bundle.js`（重建，svg-registry 入 bundle）；`tests/presentation/svg-contract.test.js`（+3 条 P40-Q-15 断言：注入/role 优先/renderFor 不注入/title 无数字/title 唯一）；`docs/P40/P40-TASK-BOOK.md`（R22 行转正 + 前置任务登记）
- **deleted**: 无
- **reason**: 用户 2026-10-12 显式指令「按这个方案来，先处理 R22 无障碍性」（任务书待裁决项转正，先于 Q-SCAN 执行）。技术要点：①Sanitizer 白名单本已含 title/desc/aria-label（P28-23 既有设计），安全边界零改动；②title 只取描述符 type/role 固定枚举中文名，无任何数值/参数→结构性防泄题；③6g L2 首跑命中「角度度量图」含 token「角」——裁决为元数据≠可见题面材料，剥离扫描并以枚举校验替代白名单登记（避免污染可见文本白名单）。
- **tests**: npm test 765/765；`node dev/check-all.js` 30 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome SKIP 属正常）；6g 单跑 PASS（649 图渲染 SUCCESS 649/未登记 0，title 校验生效）；对比度 22 组实测 20 PASS＋2 临界（1 组修正确认 5.19，1 组为死令牌 --en-primary 4.36，全库零消费者已登记清理候选）
- **risk**: 低——SVG 字符串新增 `<title>`（读屏可访问名，视觉零变化）；枚举映射为唯一 SSOT 且经 6g 校验，未来新增 role/type 须同步 A11Y 映射否则 6g FAIL（有意设计的防漏闸）；--en-* 死令牌族处置遗留待后续清理任务

---

## P40-INIT-A | 2026-10-12

- **modified**: `docs/P40/P40-TASK-BOOK.md`（§1.1 质量维度体系由六维扩展为五层 23 维 R1-R23；Q-01/Q-04/Q-05/Q-08/Q-09/Q-12/Q-14 任务范围与验收口径同步；§6 验收矩阵更新）
- **deleted**: 无
- **reason**: 用户 2026-10-12 显式指令「战役一考虑维度是否还需要提升」，提供五层 23 维框架（L1 内容正确/L2 结构完整/L3 表达规范/L4 教学适切/L5 工程可用）。采纳并逐维映射承载方：存量门禁承载（R7/R9/R10/R19）、P40 任务承载（R12/R15→Q-05，R13/R16/R20→Q-09，R14→Q-08，R17→Q-12，R18→Q-04，R21→T-DECL）、待用户裁决（R22 无障碍性触碰 P31 冻结布局与 SVG 文字语义边界，默认不做；R8/R11 缺口待 Q-01 实测后决定是否立修补任务）。
- **tests**: 无（纯文档修订，无代码改动）
- **risk**: 低——23 维中 9 维为存量门禁复证、11 维挂既有 P40 任务、3 维为待裁决项；关键防扩散纪律：待裁决项未经用户显式指令不得开工（防顺手扩维违反「禁止无限扩展」）。

---

## P40-INIT | 2026-10-12

- **modified**: `docs/P40/P40-TASK-BOOK.md`（新建，战役任务书）；`docs/P40/change-log.md`（新建，本文件）
- **deleted**: 无（`docs/P40-PREP.md` 归档事项待 P40-Q-01 启动时随指令执行：§一折入战役二阶段一，§二已由 P39-06~08 完成）
- **reason**: 用户 2026-10-12 显式指令「创建一个完整的P40维护方案，包含单题内容质量、子父知识点包含深化两大战役。特别是单题质量需要深度提升，达到大模型产出的水准含图文配合、图片使用、竖式、分数等」。任务书将 P40-PREP §一（KBL 派生器声明化重构）折入战役二阶段一；战役二采用「加字段不增边」设计（R-REL-03 38 边追加 evolution 属性 + capability 加 conceptFamily）保证 375/98/373/1570 基线不变。
- **tests**: 无（纯文档立项，无代码改动）
- **risk**: 低——任务书为计划文档；关键设计裁决（不重标 R-REL-03、竖式复用 svg-calculation、情境语料走开发期 LLM+人工评审）已在 §2.2/§1.1/§5 固化，执行期须逐阶段过门禁并经用户确认。
