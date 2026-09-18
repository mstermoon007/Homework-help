# 人工数据需求汇总（Human Data Requests）

> 一次性汇总当前全部需要人工提供/决策的事项。每项均给出：需要什么、为什么、影响面、交付格式、完成后系统侧动作。
> 配套数据文件位于 `docs/human-data-requests/`。

---

## H1｜P13-05：243 个生成映射缺口（需原始 Excel sheet 4）

| 项 | 内容 |
|---|---|
| **需要** | 原始生成映射资料（Excel sheet 4 或等价权威源）：canonical KP → capability → generator 绑定 |
| **为什么** | 243/598 KP 无 allow 绑定（170 有行但 permission=missing；73 无映射行）→ 这些 KP 无法生成或退化 |
| **影响** | 生成覆盖率、知识页「可练题型」真实性、F-TYPE-2 修复后的类型分布 |
| **数据文件** | `mapping-gap-243.csv`（kp_id, grade, category, rows, allow_rows, declared_types） |
| **格式** | 每行：kp_id, capability, generator_id（或明确标注「合法无绑定」） |
| **禁止** | AI 猜 generator、批量默认绑定、改 Generator 逻辑、绕过 Scope Contract |
| **完成后动作** | `kbl:import` → rootHash 变更 → 重新验证（KBL VERIFY / Strategy / Binding / Scope / Golden） |

## H2｜P13-06：G1 基础数据缺失（32 KP，需业务确认策略）

| 项 | 内容 |
|---|---|
| **需要** | 对确实缺失字段给出策略：① 合法为空（生成侧跳过并 WARN）② 提供原始值 ③ 保持缺失 |
| **为什么** | seedDifficulty 31 / cognitiveLevel 31 / type 32 / maxSteps 32 / numberRange 11 缺失；经对照原始迁移数据 **全部确实缺失**（raw 亦为 null） |
| **影响** | 难度标注展示、能力推导、生成参数（当前由 Difficulty Authority/默认逻辑兜底，未阻塞生成） |
| **数据文件** | `g1-missing-fields.csv`（kp_id, grade, missing_fields） |
| **禁止** | 缺失 → 默认值；用最终难度公式反向写入基础数据 |
| **完成后动作** | 若补齐：KBL 数据变更 + rootHash 更新 + 重新验证；若保持缺失：在生成侧登记 WARN 策略 |

## H3｜P13-07：58 个非发布 KP 最终产品状态（需产品决策）

| 项 | 内容 |
|---|---|
| **需要** | 每个 KP 的最终状态：`published` / `knowledge-only` / `hidden` / `pending-data` |
| **为什么** | 当前 58 个 KP 为 draft 且不可选（25 deprecated-draft / 31 active-draft / 2 inactive-draft），状态未最终定义 |
| **影响** | 知识页是否生成、是否进入 selectable（当前已隔离，不影响主路径） |
| **数据文件** | `non-publishable-58.csv`（kp_id, grade, status, publication, unit, name） |
| **完成后动作** | 更新 KBL status/publication → 重建知识页（`build:knowledge-pages`）→ 验证 540/598 计数 |

## H4｜F-TYPE-2：Frozen 归一化表修复授权（需授权决策）

| 项 | 内容 |
|---|---|
| **需要** | 授权修复 Frozen Core 题型归一化：① `RECOGNIZE_KEYWORDS` 不再返回 geometry（返回 null/calc）；② 删除 `factor-multiple/factor/all → geometry` 错别名；③ `capability-model` 改为 `type` 优先（rawType 仅补充） |
| **为什么** | 76~79/598 KP（13%）capability supported 与声明题型不一致 → 多题型请求单题型产出（F-TYPE-2）、越界丢弃（F-TYPE-1） |
| **影响面** | 题型分布、生成覆盖率、知识页可练题型；修复后需全量回归（Golden/Strategy/598 KP/E2E） |
| **数据文件** | `f-type-2-affected-kps.csv`（kp_id, grade, declared, raw_type, supported） |
| **备选** | 若暂不授权 Frozen 修复：随 H1 的映射数据修复 + POL 侧仅按 ALLOW 分配（降噪不治本） |
| **禁止** | POL/UI 层伪造题型多样性；绕过 Scope 守卫 |

## H5｜可选产品决策（低优先）

| # | 项 | 说明 |
|---|---|---|
| 1 | adaptive/learnerProfile UI 启用 | 学习画像能力已在 API 层打通（cell 上下文 P10-3/P11-00），UI 未提供 profile；启用需产品定义数据来源 |
| 2 | favicon.ico | 当前 404（cosmetic）；如需品牌图标请提供 favicon 资源 |
| 3 | 低容量 KP 产品策略 | 95 个 KP 容量 ≤2（GENERATOR_LIMITED 46 / EXPECTED_LIMITED 49）；PARTIAL 为正确语义，是否需 UI 提示文案产品确认 |

---

## 汇总表

| # | 事项 | 类型 | 阻塞发布 | 提供方 |
|---|---|---|---|---|
| H1 | 243 映射缺口 Excel | 数据 | 否（不阻塞，阻塞生成质量） | 内容/数据 |
| H2 | G1 缺失字段策略 | 业务确认 | 否 | 业务 |
| H3 | 58 KP 状态 | 产品决策 | 否 | 产品 |
| H4 | F-TYPE-2 Frozen 修复授权 | 授权 | 否 | 项目负责人 |
| H5 | adaptive/favicon/低容量文案 | 可选 | 否 | 产品 |
