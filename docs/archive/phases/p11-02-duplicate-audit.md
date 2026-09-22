# P11-02 重复题全链路审计（只读）

> 范围：`practice.html → PracticeBridge → PracticeSession → GenerationAPI → POL.orchestrate → executeInline → Strategy → Generator → RetryLoop → SemanticQuestion → Presentation`
> 方法：静态追踪 + Node 浏览器等价环境实证探针（未改任何生产代码）。
> 结论先行：**Identity 体系唯一可靠（无需人工决策）；Batch/Recovery 去重已正确；跨代去重在 POL 激活路径存在确定性丢失（F-DUP-1，已实证）；刷新场景需产品语义确认（F-DUP-2）。**

---

## 1. 现有 Identity 体系（P11-02-02 结论）

| 键 | 生产者 | 用途 | 是否写入 seenKeys |
|---|---|---|---|
| `questionFingerprint`（语义指纹 v2） | `duplicate-validator.buildQuestionFingerprint`（唯一实现） | **权威去重键**：batch 内 / 同一练习 / 跨代 | 是 |
| `canonicalKey`（题面数字/运算符归一） | `duplicate-validator`（诊断） | 仅 info 字段/诊断 | 否（注释明确） |
| `mathFingerprint`（去 KP 的数学内容） | `duplicate-validator` | 同一份练习内「跨 KP 同数学」判重（Map<mathKey, kp>，同 KP 不判） | 独立 Map |

- **无多套 identity 并存冲突**；无复杂 Hash/Fingerprint Service。P11-02-02 无需人工决策（问题②不适用）。
- RetryLoop 在指纹缺失时调用同一 `buildQuestionFingerprint` 补齐（`retry-loop.js:103/176`），无第二算法。

## 2. 去重状态流（现状）

```text
PracticeBridge._session._seenKeys（跨代累积，仅内存；recordGeneration 从成功题目累积）
   ↓ Bridge.start 新会话：sessionConfig.previousGeneration = { generationId, fingerprints }
PracticeSession.start：genOptions.previousSeenKeys = previousGeneration.fingerprints
   ↓ GenerationAPI.generate(req, genOptions)
POL.orchestrate(request, options=含 previousSeenKeys, deps)
   ↓ ✗ 丢失点（F-DUP-1）
cell execute：options.previousSeenKeys = acc.seenKeys（POL 内新建空 Set）
   ↓ executeInline：globalSeenKeys = new Set(options.previousSeenKeys) ∪ 本代
validation-pipeline / duplicate-validator（seenKeys 事务化）→ RetryLoop（重复→丢弃→补位）
   ↓ POL runCells：acc.seenKeys 累积本代指纹（跨 cell / Recovery 互斥）
   ↓ 结果返回；Bridge.recordGeneration 把成功题指纹累积入 session._seenKeys
```

## 3. 发现清单

### F-DUP-1（High，已实证 → 已修复）：POL 覆盖父级 `previousSeenKeys` → 跨代去重在 POL 激活路径失效

- `practice-orchestrator.js:495`：`runCells(p.kpTypeMatrix || [], new Set())` — 初始 seenKeys 为空集，未以 `options.previousSeenKeys` 播种。
- `practice-orchestrator.js:453`：cell 执行时 `assignOpts(options, { ..., previousSeenKeys: acc.seenKeys })` — 用 POL 内部空集**覆盖**了 session 注入的全历史指纹。
- 实证（Node 等价环境）：修复前父级 `previousSeenKeys` 含历史指纹，cell 收到的 Set `prevHas=false`；修复后 `prevHas=true`。
- 影响：**页内「重新生成」在 POL 激活路径（有显式 KP + 题型）不与上一代互斥** → 用户感知的重复题。非 POL 路径（无题型/池模式）不受影响（api.js:337 正确消费）。
- **修复（P11-02 已执行）**：`runCells` 初始集以 `new Set(options.previousSeenKeys)` 播种；其余累积/Recovery 逻辑不变。
- 端到端判别（小空间 KP `math-g1-down-u01-k002`）：修复前 batch2 复用唯一题；修复后 batch2 = 0 题、overlap = 0（空间耗尽不复用）。

### F-DUP-2（Medium，产品语义已确认 A → 已实现最小跨批记忆）：刷新/重载后无跨批记忆

- 去重状态存于 `PracticeBridge._session._seenKeys`（内存）；`PracticeSession` 无持久化。
- **决策（用户确认 A：尽量避开上一批）**：`PracticeBridge` 增加 sessionStorage 最小跨批记忆（`hh-practice-seenkeys-v1`，FIFO 上限 800，隐私模式/配额异常静默跳过）；刷新（同标签页）后仍与上一批互斥。
- 边界：仅浏览器、仅当前标签页；服务端/多用户不受影响；空间不足 → PARTIAL/FAILED，不复用旧题。

### F-DUP-3（Low → 已修复）：注释漂移

- `api.js:328-329` 注释称 `previousSeenKeys` 由「PracticeBridge._seenKeysAccum」注入；实际为 `session._seenKeys`。
- **修复**：注释更新为实际链路（PracticeSession.previousGeneration.fingerprints + P11-02 sessionStorage 记忆）。

## 4. 已正确的部分（无需改动）

- **Batch 内**：validation-pipeline 共享 seenKeys 事务化 + duplicate-validator 权威判定 + RetryLoop 丢弃/补位（`retry-loop.js:87-91/183-297`）。
- **跨轮/Recovery**：POL `acc.seenKeys` 跨 cell 与 Recovery 轮次传递（`previousSeenKeys: acc.seenKeys`），Recovery 不是「新开一次生成」。
- **有界性**：RetryLoop「3 轮零新增」终止；POL `MAX_RECOVERY_ROUNDS=3` + 无进展终止（P11-01 C7/C8 已验证）。
- **重复 ≠ 容量**：重复候选耗尽 → Retry → Recovery → PARTIAL；不会死循环、不会伪造成功（P11-01 §17 已验证）。

## 5. 测试映射（P11-02-08，已实现 10/10）

| 用例 | 机制 | 结果 |
|---|---|---|
| D1 Batch 内 20 题唯一 | duplicate-validator + retry-loop | PASS |
| D2 多 KP 唯一 | seenKeys/mathSeenKeys | PASS |
| D3 多 Type 唯一 | 指纹含 type 维度 | PASS |
| D4 oral→calc 别名不产生重复 cell | request-normalize 去重 | PASS |
| D5 Retry 丢弃重复 + 新题补位仍满足预算 | POL 聚合过滤 + 候选补位 | PASS |
| D6/D7 Recovery 跨轮/多轮 Union 唯一且有界 | POL acc.seenKeys | PASS |
| D8 候选耗尽 → PARTIAL/FAILED 不死循环 | retry+recovery 有界 | PASS |
| D9 重新生成尽量避开上一批（大空间 overlap=0；小空间零复用） | F-DUP-1 修复 + A 语义 | PASS |
| D10 全链 finalCount = unique(final).length | 端到端（真实 API） | PASS |

## 6. 人工确认结果

1. **问题①**：已确认 **A（尽量避开上一批）** → 已实现 F-DUP-1 修复 + sessionStorage 最小跨批记忆。
2. 问题②：无需确认 — `questionFingerprint` v2 已是唯一可靠权威键，未新增签名算法。

## 7. 实际改动（已执行）

```text
practice-orchestrator.js：runCells 初始 seenKeys 以 options.previousSeenKeys 播种（F-DUP-1）
practice-bridge.js：sessionStorage 最小跨批记忆（load/persist，FIFO 800，异常静默；F-DUP-2/A）
api.js：注释同步（F-DUP-3）
tests/orchestration/p11-02-duplicate-contract.test.js：D1–D10（10 用例）
未新增：Dedup Service / Manager / Registry / 新 Gate；Frozen Core 语义未改
```
