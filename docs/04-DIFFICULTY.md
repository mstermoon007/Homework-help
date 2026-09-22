# 04-DIFFICULTY — 难度权威链

> 状态：FROZEN
> 涵盖：P28-13（难度最终收口）/ P28-14（Difficulty Provenance）

## 1. 唯一权威链

```
Static Difficulty
        ↓
DifficultyOrchestrator
        ↓
Difficulty
        ↓
Difficulty Parameters
        ↓
Strategy
        ↓
Generator
```

SSOT：`shared/catalog/difficulty.js`（唯一难度公式）+ `difficulty-static.js`（静态七维目录）。

## 2. 收口结论（P28-13）

| 检查 | 唯一定义位置 |
|---|---|
| `diffLevel(` | `shared/catalog/core/core.js` |
| `resolveStaticDifficulty(` | `shared/strategy/static-difficulty.js` |
| `resolveTargetDifficulty(` | `shared/strategy/target-difficulty.js` |

- 定义集外 0 处重复权威 function 定义
- 无第二套 level 计算
- 无 Generator 自算 difficulty
- 无 Strategy 自算 difficulty

## 3. Difficulty Provenance（P28-14）

每一道题可解释"为什么是这个难度"，四维全部由同一权威链回答：

| 维 | 来源 |
|---|---|
| D1 source | `resolveStaticDifficulty`（唯一产出点） |
| D2 base | `resolveStaticDifficulty.level` 输出 |
| D3 requested | `plan.difficulty`（编排层携带，不自算） |
| D4 final | Generator 回显 `plan.difficulty`（`sq.difficulty`），`applyEffective` 唯一合成 |

不新增第三套难度算法。目标是可解释，不是新系统。

## 4. Generator 难度约束（P28-10 Z3）

难度是经 Generation Requirements 下发的**已声明参数**，Generator 只回显 `plan.difficulty`，不得计算/改写。
