# F-TYPE-2 根因审计：多题型请求单题型产出（只读）

> 触发：P13-08 抽检（6 题型全选 × 6 年级 × 难度 1/5/10）发现每 KP 实际只产出 1 种题型。
> 结论：**根因在 Frozen Core 的题型归一化表（question-type-registry）+ capability-model 的 rawType 优先推导**；
> KBL 数据（每 KP 单一声明题型）与 POL capability 视图（DEGRADE-all）放大症状。**未修改任何代码**。
>
> **P16-14 收口状态（2026-09-15）：已收口**
> canonical 由释义派生规范 7 类题型（`assessment.questionTypes[].type`），未注入会触发 R1/R2 的
> 语义子类型 rawType token；故新数据面下 `声明题型 ⊆ capability supported` 实测 **0/375 错型**、
> rawType 值域为空 → R1/R2 触发面已消除（数据层修复，未触碰 Frozen Core）。
> 回归防线：`dev/check-f-type-2.js`（F1-F5）已挂入 `kbl:verify / npm test`，防未来数据或归一表改动
> 重新引入错型（含 rawType 一旦出现即不得命中 RECOGNIZE→geometry 启发式）。

---

## 1. 症状链（实测）

```text
请求：6 题型全选 × 1 KP
  ↓ POL：capability 视图矩阵对 5 个非声明题型判 DEGRADE（可生成）
  ↓ POL 为每个请求题型分配 cell（6 cells）
  ↓ Strategy：requestedTypes ∩ supportedTypes = ∅ → 回退 supportedTypes
  ↓ supportedTypes 错误（例：apply KP → [geometry]；calc KP → [geometry]）
  ↓ 6 个 cell 全部退化为同 1 种题型（geometry/calc/fill）
  ↓ POL Scope 守卫：若该题型 ∉ selectedTypes → 丢弃（F-TYPE-1 场景，最终 FAILED/PARTIAL）
```

实测样本（strategyView → capability supported）：

| KP | 声明题型 | rawType | capability supported | 结果 |
|---|---|---|---|---|
| math-g1-advance-u03-k001 | fill | fill | fill | ✅ 一致 |
| math-g2-down-u02-k001 | calc | div-quotative | calc | ✅ 一致 |
| math-g3-down-u04-k001 | **calc** | twodigit | **geometry** | ❌ 错型 |
| math-g5-down-u02-k002 | **apply** | factor-multiple | **geometry** | ❌ 错型 |

## 2. 根因（Frozen Core）

### R1：`question-type-registry.normalizeQuestionType` 启发式/别名误映射

```text
RECOGNIZE_KEYWORDS = ['read','number','count','tally','enum','classify','table','picto','set',
  'place','digit','composite','shard','ym','relation','operator','readwrite','approx','length',
  'mass','time','pattern','meaning','unit','convert','order','compare','parity',...]
  → 命中即返回 'geometry'（正常应返回 calc/apply 或 null）

CANONICAL_ALIASES 显式错项：'factor-multiple':'geometry'、factor:'geometry'、all:'geometry'
```

实测：`normalize('twodigit')=geometry`（含 'digit'）、`normalize('tally')=geometry`（显式词）、
`normalize('relation')=geometry`、`normalize('factor-multiple')=geometry`；无命中时默认回退 `calc`。

### R2：`capability-model.resolveCapability` 以 `rawType` 优先

```text
pushQt(q.rawType || q.type)   // canonical 的 rawType 是语义子类型（twodigit/tally/factor-multiple）
  → 归一失败/误映射 → 声明的 type（calc/apply）从未进入 supportedTypes
generation.capabilities 补充：cap.id（calculation/contextual/multi-step）非 registry 题型 id → 跳过
```

### R3：数据与视图放大

- KBL 每 KP 仅声明 1 种题型（`assessment.questionTypes` 单条）；
- POL capability 视图对非声明题型统一判 DEGRADE（不 FORBID）→ 为 6 种请求题型都分配 cell。

## 3. 影响量化（598 KP 全量）

```text
声明题型 ∉ capability supported：76~79 KP（约 13%）
受影响结果：
  ① 6 题型全选 → 单题型产出（内容结构单一，F-TYPE-2）
  ② 请求题型不含错映射类型 → POL Scope 守卫丢弃 → FAILED/PARTIAL（F-TYPE-1 的 FAILED 案例）
  ③ 知识页“可练题型”与真实产出不一致
清单：docs/human-data-requests/f-type-2-affected-kps.csv
```

## 4. 修复方案（需授权，三选一或组合）

| 方案 | 改动 | 影响 | 风险 |
|---|---|---|---|
| A｜数据修复 | KBL 侧规范 rawType/声明题型；映射表补 allow 行 | 不触 Frozen；rootHash 变更 | 需原始 Excel（P13-05） |
| B｜Frozen 授权修复（推荐最小） | ① `normalizeQuestionType`：RECOGNIZE_KEYWORDS 不再返回 geometry（返回 null 或 calc）；删除 `factor-multiple/factor/all→geometry` 错别名 ② `capability-model`：`pushQt(q.type)` 优先（rawType 仅作 subtype 补充） | 修正 76~79 KP 的 supported；题型分布恢复 | 触 Frozen 需重锚 + 全量回归；归一化表为全局共享 |
| C｜POL 侧降噪（不治本） | capability 视图 DEGRADE 不参与预算分配（只 ALLOW 分配） | 减少无效 cell；不改变单题型产出 | 不解决 supported 错型 |

- **禁止**：在 POL/UI 层伪造题型多样性；绕过 Scope 守卫。
- 建议顺序：**B（授权修复 + 回归）** 为主，A 随 P13-05 Excel 补齐，C 可选。

## 5. 相关契约

- P10-2 Scope Contract（cell ∈ selectedTypes；生成不重解释范围）
- P11-03 Scope 守卫（越界丢弃 + outOfScopeDropped 记账）
- P14 Release Freeze：F-TYPE-1 / F-TYPE-2 均登记为数据/授权项，不阻塞当前发布
