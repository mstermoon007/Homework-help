# P13 内容与数据治理报告

> 范围：Knowledge Entry / 深链 / canonical 题型 / Capacity Map / 生成映射缺口 / G1 基础数据 / 58 KP 状态 / 内容抽检。
> 原则：只做技术可确定性治理；需要原始数据或产品决策的项输出人工清单，不猜、不默认填充。

---

## P13-01 Knowledge Entry 全量治理 ✅

```text
selectable KP 540 ↔ 知识页 540（1:1，0 缺失/0 多余）
链接 404 = 0；legacy 链接 = 0；空页/缺标题 = 0；缺 CTA = 0
sitemap 546 条全部存在；知识页全部在 sitemap
```

## P13-02 Knowledge → Practice E2E ✅

| 年级 | 深链 KP | 结果 |
|---|---|---|
| G1 | math-g1-advance-u01-k001 | SUCCESS 20 题 |
| G2 | math-g2-down-u01-k001 | PARTIAL 3 题（真实空间） |
| G3 | math-g3-down-u02-k001 | SUCCESS 20 题 |
| G4 | math-g4-down-u01-k001 | SUCCESS 20 题 |
| G5 | math-g5-down-u01-k001 | PARTIAL 16 题（真实空间） |
| G6 | math-g6-down-u01-k001 | SUCCESS 20 题 |

- 使用知识页真实 CTA（`../practice.html?subject=math&grade=N&kps={canonicalId}`）；
- request.kps = 深链 KP；产出题目 KP = 深链 KP；0 JS error。

## P13-03 Canonical Type 清理 ✅

- `select.html QUICK_TYPE_DEFS`：`types:['calc','oral']` → `['calc']`（oral 为 legacy 别名，归一为 calc）。
- 回归：verify:type-module-consistency 6/6、verify:practice-page 9/9、orchestration 58/58。

## P13-04 Capacity Map 数据治理 ✅

- 根因：`capacity-map.json` 键为 legacy KP id（canonical 命中 0/112）→ POL 规划层容量封顶惰性。
- 修复：
  1. `capacity-inventory.bootstrap()` 支持浏览器等价全局（`dev/_bundle-env.js`），扫描 CLI 在 Node 可运行；
  2. `scan()` 增加 `kpIds` 过滤；`getCapacityMap()` 透传 `count/kpIds/difficulties`；
  3. 新增 `dev/build-capacity-map.js`（dev-only）以 canonical KP 全量重建。
- 重建结果：**598/598 canonical 命中**；tiers = HIGH 388 / VERY_LOW 94 / LOW 71 / MEDIUM 44 / ZERO 1；耗时 58s（count=128）。
- 生效验证：小容量 KP（geometry 3）→ `planned=3 CAPACITY_LIMITED`；T6 计划 typeCaps 正确。
- 回归：P11-03 R3/R7 场景按容量真实语义修正（KP 选容量充足者；R7 冻结 Recovery ≤3 轮语义）→ 58/58；`npm test` PASS。
- KBL rootHash **未变**（capacity-map 为派生缓存，非知识事实）。

## P13-05 Generation Mapping GAP（243）⏸ 需原始数据

| 分类 | 数量 | 说明 |
|---|---|---|
| 有 ≥1 allow 绑定 | 355 KP | 正常 |
| 有映射行但全部 `permission=missing` | 170 KP | 需原始 Excel 判定「合法无绑定 / 需修复」 |
| 无映射行 | 73 KP | 需原始 Excel 补齐 |
| **缺口合计** | **243 KP** | — |

- 人工资料：**Excel sheet 4（原始生成映射）** → `kbl:import` → rootHash 变更 → 重新验证。
- 禁止：AI 猜 generator、批量默认绑定、改 Generator 逻辑、绕过 Scope Contract。

## P13-06 G1 基础数据治理 ⏸ 需业务确认

| 字段 | 缺失 | 分类（对照 `migration/raw/kps.json`） |
|---|---|---|
| `difficultyAnnotation.seedDifficulty` | 31 | **确实缺失**（raw 亦为 null） |
| `difficultyAnnotation.cognitiveLevel` | 31 | **确实缺失** |
| `type`（顶层） | 32 | **确实缺失** |
| `generation.maxSteps` | 32 | **确实缺失** |
| `generation.numberRange` | 11 | **确实缺失** |

- 缺失集合高度重叠（集中于 u07/u09/u10 等单元）。
- 禁止：缺失 → 默认值；禁止用最终难度公式反向写入基础数据。
- 人工资料：业务确认「合法为空 / 补齐原始值 / 保持缺失（生成侧跳过并 WARN）」。

## P13-07 58 Non-Publishable KP ⏸ 需产品决策

| 状态/发布 | 数量 |
|---|---|
| deprecated / draft | 25 |
| active / draft | 31 |
| inactive / draft | 2 |

- 需产品决定最终状态：`published / knowledge-only / hidden / pending-data`。
- 当前行为：不产知识页、不进 selectable（540）→ 已隔离，不影响产品路径。

## P13-08 生成内容质量抽检 ✅（含发现）

- 矩阵：6 年级 × 代表 KP × 6 题型全选 × difficulty 1/5/10 = 18 次真实生成。
- 结果：**18/18 SUCCESS，12/12 产出**；kp/type/difficulty/prompt/answer 基础字段 0 问题；outOfScope=0。
- **发现 F-TYPE-2**：请求 6 题型全选时，每个 KP 实际只产出 1 种题型（G1 fill / G2 calc / G3-G5 geometry / G6 calc）——
  题型结构由冻结 Strategy/Generator 选择主导，用户请求的题型组合未反映到产出分布。
  → 绑定/能力数据治理项（P13-05）与生成语义项（P11-07/P13-08 后续）。

## P13-09 收口

```text
Knowledge Entry 0 404 / 0 legacy / 0 空页 / sitemap 一致     ✅
Knowledge → Practice G1–G6 深链                              ✅
Canonical Type 统一（oral 别名清理）                          ✅
Capacity Map canonical 重建（598/598，规划层容量生效）        ✅
Mapping GAP 243 分类完成（等原始 Excel）                      ⏸
G1 缺失字段分类完成（等业务确认）                             ⏸
58 KP 状态清单完成（等产品决策）                              ⏸
内容抽检完成（18/18；F-TYPE-2 登记）                          ✅
```
