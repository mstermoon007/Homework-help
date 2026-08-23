# 四年级竞赛 C8 最值与逻辑推理 — 完成概览

## 交付内容
- **新增插件** `plugins/math-competition-c8-logic.js`：竞赛 C8 模块，grades `[4,5,6]`，category `statistics`，3 个子题型：
  - `extreme` 最值问题：定和求最大积（`floor(S/2)*ceil(S/2)`）；给定数字组成最大/最小数（最小数需把 0 换离首位避免前导零）。
  - `drawer` 抽屉原理：`⌈N/M⌉`（保证 N>M ⇒ 答案≥2）。
  - `logic` 逻辑推理：比较链排位（保序链问最值端）+ 唯一真话推理（p 指认 q、q/r 否认 ⇒ r 做的）。
- **扩展校验器** `dev/verify-competition.js`：新增 `checkExtreme` / `checkDrawer` / `checkLogic`（均不套用插件闭式，从题面反解独立重算），并登记到 `CHECKERS`（竞赛独立求解器现共 36 个）。
- **registry.js**：新增 C8 真实条目；占位 `moduleIds` 由 `['C8','C9']` 收窄为 `['C9']`。
- **knowledge-bank.js（四年级 C8 块）**：`c8-extreme / c8-drawer / c8-logic` 的 `pluginId` 由占位改为 `math-competition-c8-logic`。
- **sw.js**：`v59 → v60`（新增被缓存文件）。

## 过程中修复的两个缺陷
1. **`_PU.shuffle` 不原地修改**：旧写法 `var x=arr.slice(); _PU.shuffle(x);` 实际 x 不变，导致输出空间塌缩、题面大量重复。改为 `var x = _PU.shuffle(arr.slice());`。
2. **比较链校验误判**：初版按「直接计算边数」找最值，遇到传递链（如「甲比丙快，乙比甲快」）时顶端只统计到 1 条边而漏判。改为**传递闭包（可达性）**求全序后的最值端。

## 验证结果（全绿）
| 工具 | 结果 |
|------|------|
| `verify-competition.js --only C8` | 12 组抽样全通过；连续 5 次稳定性抽样均无随机失败 |
| `verify-competition.js`（全量 C1–C8） | 8 插件 / 132 组抽样全通过（答案正确、解唯一、题面无重复） |
| `verify-knowledge-bank.js --g4 --g5 --g6` | ✅（仅 C9 仍指占位，符合预期） |
| `regression-check.js` | 118/118 组合全 100 分（含 math-comprehensive 四/五/六年级） |
| `verify-setup.js` | KB 部分 ✅；唯一 ❌ 为 `_template.js 包含 plugin 对象`（模板约定检查，与本次无关、预先存在，未改动） |

## 待办
- Task #50：C9 竞赛综合聚合插件（聚合 C1–C8 按 weight 混编；KB 四年级 C9 改真实；完成后移除占位）。
- Task #51：C9 落地后全量验证 + 清理占位插件。
- 观察项：math-comprehensive 按 `id.startsWith('math-')` 过滤，会包含 `math-competition-*` 竞赛插件（C1–C8 均如此）与综合练习混排——既有设计，本次未改动，待确认是否需排除竞赛模块。
