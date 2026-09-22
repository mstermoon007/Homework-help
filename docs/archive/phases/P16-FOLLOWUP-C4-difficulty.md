# P16-FOLLOWUP-C4：难度权冻结

## C4-01 唯一公式

### shared/catalog/difficulty.js 为唯一公式权威

**职责**：把「用户基础难度(1-10) + 自适应调整量 delta + 插件选项」解析为 DifficultyProfile，并给出数值缩放（steps/allowBracket/allowMultDiv）与结构复杂度参数。

**不得修改**：
- `TIERS` 分级表（1–2 / 3–4 / 5–6 / 7–8 / 9–10 的 steps/bracket/multDiv/nested 结构）
- `difficultyToStructure(level)` 公式（level 1–10 → steps/bracket/multDiv/nested）
- `diffLevel` / `diffScale` / `diffMax` 等 core 依赖

**仅可读取**：
- `tierOf(level)` 返回当前级别的结构分档
- `difficultyToStructure(level)` 返回结构参数（steps/bracket/multDiv/nested）

### 禁止任何二次创建

- 不得另行定义 `steps / bracket / multDiv / nested` 的新分级表
- 不得在其他模块自行实现 `difficultyToStructure` 等价函数
- 不得在 `difficulty-orchestrator.js` 中自行计算 steps/bracket/multDiv

---

## C4-02 difficulty-orchestrator.js

### 职责缩小为

**编排层难度参数域（DifficultyContext）的整理与携带**。

**严格禁止**：
- 计算难度
- 调用 `Difficulty.paramsFor` / `DifficultyStatic.paramsForKnowledgePoint`
- 复制 `DELTA_RULES` / 权重表 / 难度档位公式
- 出现 `1 + 9 * ...` 此类人工干预公式

**仅执行**：
- 输入参数规范化（将用户输入的 number/string/{requested,min,max,tolerance,source} 结构化）
- 困难上下文（DifficultyContext）结构化输出
  - `requested`：用户显式难度（1-10 整数）或 null
  - `base` 该 KP 的静态基础难度（由 strategy static-difficulty 产出；接入前为 null）
  - `target` 最终难度目标 = requested override base（requested 有值取 requested，否则取 base）
  - `min/max` 用户给出的难度上下限约束（null = 不限）
  - `tolerance` 容差（>=0，仅编排约束，不参与计算）
  - `source` 'user' | 'auto' | 'static'

---

## C4-02 POL 负责难度规划

POL 负责：

```text
用户难度
  → normalize（normalizeDifficultyParam）
  → target difficulty
  → capacity
  → Cell.difficulty
```

**具体流程**：
1. `practice-orchestrator.js:234-236` `DO.normalizeDifficultyInput({difficulty, scope})` — DifficultyOrchestrator 归一
2. `practice-orchestrator.js:243` 用户显式难度 → `Math.min(10, Math.max(1, Math.round(...)))`（POL 侧 round+clamp 归一）
3. `practice-orchestrator.js:245-248` `DO.resolveContext(diffParam, null)` → DifficultyContext
4. `practice-orchestrator.js:118-137` `capacityByType(kpIds, capMap, difficulty)` — 难度→容量桶对齐（P0-02）
5. `practice-orchestrator.js:367-368` 计划 `difficulty / difficultyContext` 下发
6. `practice-orchestrator.js:455` cellReq `difficulty: genReq.difficulty`—— 随 cell 传递

### 禁止

- POL不得自行构造 difficulty 结构参数（必须由 difficulty.js 提供结构）
- POL不得直接使用 `1 + 9 * ...` 此类人工干预公式

---

## C4-03 清理重复预测

重点检查：

```text
predictDifficulty
target-difficulty.js
difficulty-orchestrator.js
difficulty.js
shared/catalog/difficulty.js
```

最终：

```text
difficulty.js = 公式权威
POL = 规划权限
Strategy = 消费者
```

**任何重复计算逻辑删除**。

---

## C4-02 实际已确认状态

| 组件 | 状态 | 备注 |
|------|------|------|
| `shared/catalog/difficulty.js` | **唯一公式权威** | 5段结构分档（1–10），已冻结 |
| `shared/orchestration/difficulty-orchestrator.js` | **编排层搬运工** | 仅参数搬运，禁止计算难度 |
| `shared/strategy/target-difficulty.js` | **Target规则** | v1 明确规则，plugin不可自行判断 |
| `practice-orchestrator.js` | **POL 负责** | user难度→normalize→target→Cell.difficulty |
| `shared/strategy/target-difficulty.js` | **规则实现** | 3种形态（用户显式/静态/自适应） |

---

## C4-03 冻结确认

- **difficulty.js** 公式不得修改
- **difficulty-orchestrator.js** 仅做参数搬运，不计算难度
- **POL** 负责难度规划（用户难度→normalize→target→Cell.difficulty）
- **Strategy** 只能消费 difficulty，不能重新定义
- **不得有** 任何重复的难度计算公式

进入 C5：Strategy 归位。
