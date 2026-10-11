# P39 变更日志（死代码清理战役）

> 战役性质：P37/P38 收口后用户指令「清理最近决策产生的无效死代码」——rawType 死链全链清零
> （P37-02 F-TYPE-2 修复③的直接后续：rawType 语义死亡 → 消费链 + 数据字段物理删除）。
> 铁律：三方印证后物理删除不留壳；断言随证据重写为防双轨负断言；重建 bundle + 全量门禁。
> 日志 append-only，六字段，最新在上。

---

## P39-01 · rawType 死链全链清零 + capability-model 死符号清理（2026-10-12）

- **modified**：
  - `shared/capability/capability-model.js`：删未用变量 `TYPES`、未用参数 `qtMeta`、未用参数 `qtypeId`（inferDifficultyRange 单参化）；`pushQt(q.type || q.rawType)` → `pushQt(q.type)`；注释更新为「rawType 全链清零」口径。
  - `shared/strategy/question-type-strategy.js`：`getDefaultFromKP` 中 `qts[i].rawType || qts[i].type` → `qts[i].type`。
  - `shared/strategy/static-difficulty.js`：`q.type || q.rawType` → `q.type`。
  - `shared/orchestration/knowledge-context.js`：`projectQuestionTypes` 输出对象删 `rawType` 派生字段。
  - `tools/kbl/emit-canonical.js`：assessment.questionTypes 投影删 `rawType: null` 数据字段（T1 派生器）。
  - `tests/orchestration/p37-02-f-type-alias.test.js`：P37-02 ③ 组两个测试重写为 P39-01 防双轨负断言（rawType 不参与解析 / type 缺失不兜底 / 5 文件代码模式零引用）。
  - `shared/engine/strategy-engine.bundle.js`：重建（57 modules，16/17 确定性 PASS）。
  - `shared/knowledge/teaching/misconception-profiles.json`：**历史镜像漂移修正**（非本轮行为变化）——kbl/teaching 源（SSOT）= 917 slots，HEAD 的 shared 副本 = 923（P32 期 46490ec 起未随源重冻，漂移 +6 个 axis=representation slot）；本轮 `kbl:derive` 的 build.js 镜像将副本拉回源真值（-6 slot：概念混淆×3 + 格式错误×3，droppedByAxisEvidence 707→713）。三方对账：kbl源==工作区 true，kbl源==HEAD false。
- **deleted**：T1 数据 `rawType` 键——kbl/canonical 与 shared/knowledge/data/math/g1~g6 全部 assessment.questionTypes 元素的 `rawType: null`（1570/1570 行）经 `npm run kbl:derive` 重建清零；rootHash 更新（af40e17a… → 82c59dfe…）。
- **reason**：用户指令「清理最近决策产生的无效死代码」。取证链：P37-02 裁决「已归一化 type 是题型唯一权威」→ rawType 失去存在理由；实测 canonical + 运行时 6 年级 assessment.questionTypes 共 1570 行 rawType **全部为 null**（零非空值），全部消费方（capability-model / question-type-strategy / static-difficulty / knowledge-context 输出）中 rawType 表达式行为恒等 type——纯冗余死链。capability-model 三死符号为 P37-02 登记不修的任务外存量，本轮转正清理。
- **tests**：定向 `tests/orchestration/p37-02-f-type-alias.test.js` 8/8（含 3 个新 P39-01 负断言）；`npm test` **758/758**；`node dev/check-all.js` **30 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b/6e 矩阵、6g 泄露、16/17 bundle 确定性全过——证明行为零变化）；基线对账 375/98/373/1570 不变；门禁 21/22 死代码与 Legacy 矩阵 PASS。
- **risk**：① 行为零变化由 6a/6b/6e 与 758 测试证明，但 canonical rootHash 变化（合法：T1 派生器修改 + 同源重跑确定性一致）；② strategyView 视图少 rawType 字段，全库消费方已同步清零（防双轨断言封死复活路径）；③ 未 git commit。

---
