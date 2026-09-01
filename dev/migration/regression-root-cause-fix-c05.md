# C05 — M4-R16 Regression Minimal Fix

> 前置：C04 已完成（见 `regression-root-cause.md`）。
> 原则：1 Root Cause → 1 Minimal Patch → Targeted Test → Regression。
> 门禁目标：`npm run test:regression` = PASS（FAIL=0 且 PLAN_ERROR=0）。

## 根因（承接 C04 RC-PLAN-01）

C04 将 774 个 PLAN_ERROR 归为单一根因 RC-PLAN-01（`KP 不支持该题型: <QT>`）。
C05 深挖出该根因的**真实机制**：

**回归矩阵用「插件级能力并集」构造逐 KP 的规划用例。**

- `dev/test-generator-regression.js` 的 legacy 轨道使用
  `generator-capability-registry` 的 `rec.questionTypes`（该插件全部 KP 的能力并集）
  作为每个采样 KP 的候选题型。但单个 KP 只支持并集的子集
  （例如 `math-g1-m1-addsub-5` 实际仅 `calc`，矩阵却对其试 `recognize`）。
  → `StrategyEngine.plan()` 第 4 步按 per-KP 能力正确拒绝 → 记为 PLAN_ERROR。
- native 轨道同样：`sampleKpByCap[cap]` 取「首个声明该能力的插件首个 KP」，
  未校验该 KP 是否真支持该能力（如 `math-g4-m1-g4-oral-big` 仅 `calc`，却被用作 `oral` 样本）。

**结论**：这不是产品缺陷（plan builder 拒绝行为正确），而是测试矩阵构造缺陷——
矩阵测试了「不可能构造 plan」的伪用例。验证：全部 774 个 PLAN_ERROR 均为
`kpActualQTs` 不含该 QT（`all PLAN_ERROR have KP lacking the QT: true`，缺失 KP=0）。

## C05-01：1 Root Cause → 1 Minimal Patch

唯一改动文件：`dev/test-generator-regression.js`（测试基础设施，非产品代码）。

- 新增 `kpQuestionTypes(kpId)` 辅助：解析单 KP 实际支持的题型
  （与 `StrategyEngine.plan` 第 4 步同源 `CapabilityResolver.getCapabilities`）。
- **legacy 轨道**：每个采样 KP 的候选题型改为
  `该 KP 实际能力 ∩ 插件声明能力`，仅测试可构造的 KP×QT 组合。
- **native 轨道**：`sampleKpByCap` 改为遍历插件 KP，挑**首个真正支持该能力**的 KP
  （删除原先 `knowledgePoints[0]` 的盲目采样）。

## C05-03：全量验证（每次修改后）

| 检查 | 结果 |
|------|------|
| `npm run test:regression` | **PASS 1074 / FAIL 0 / PLAN_ERROR 0** |
| `npm test`（含 verify-svg 219 SVG） | PASS |
| `npm run verify` | PASS（7/7） |
| `npm run verify:m4` | PASS（60 pass / 0 fail） |
| `node dev/check-frozen-core.js --check` | 93/93 无变更 |
| `node dev/check-generator-migration.js …g6-oral,g6-calc` | PASS |

矩阵变化：1806 cases（PASS 1032 / PLAN_ERROR 774）→ 1074 cases（PASS 1074）。
PASS 数上升 42（native 轨道原先的 42 个伪 PLAN_ERROR 因样本校正转为真实 PASS）；
legacy 原 1032 PASS 全部保留（仅剔除不可构造用例），FAIL 保持 0。

> **C05 后续（全量枚举升级）**：删除 `MAX_KP_SAMPLE=2`/`MAX_QT_SAMPLE=2` 采样上限，
> legacy 全量枚举 556 KP × per-KP QT × 难度 × seed，native 全量枚举 9 生成器 × 注册 KP × per-KP QT。
> 矩阵 **3738 cases（PASS 3738 / FAIL 0 / PLAN_ERROR 0）**。
> 全量覆盖暴露 1 个真实校验缺口：`math-g1-m4-num-fill-unknown` 逆向填空
> （`a + □ = total` / `□ − b = r` 等）在 SP.answerIsCorrect 下误判 false → 已扩展
> `semantic-parse.fillOperandUnknown` 解方程校验（a/□ op b/□ = total），非跳过/白名单。
> 详见 `m1-m4-old-debt-scan.md` 5.8。

## C05-04：禁止方式核验

- ❌ 未降低 threshold / 未增加 skip / 未增加 whitelist / 未增加 expected failure
- ❌ 未修改测试预期 / 未隐藏 error / 未 catch 后返回空数组
- ✅ 回归真实变绿：PASS 1074 全部为真实生成用例，PLAN_ERROR 由「伪用例清零」实现
  （矩阵只测 per-KP 可构造组合，与产品 plan builder 语义一致）

## C05 Gate — 最终结论

| 指标 | 结果 |
|------|------|
| `npm run test:regression` | **PASS** |
| FAIL | **0** |
| PLAN_ERROR | **0** |
