# P16-FOLLOWUP-C3：收回题型权

## C3-01 扫描与分类（了绝矛盾）

### 扫描范围
1. **CANONICAL_TYPES 定义**：`shared/request/request-normalize.js` 第26行
2. **QUESTION_TYPES 定义**：各模块的题型定义
3. **aliases 映射**：`TYPE_ALIASES` 与 `TYPE_LABELS`
4. **typeCounts 实际使用**：各处的题型计数
5. **generator capabilities**：generator-registry.js 中的 capabilities 字段
6. **P11-01 frozen 结果**：6 个 canonical types

### 扫描结果输出

#### 1. Canonical（正 canonical 6 类）
按 P11-01 冻结结果与 cross-reference 验证：
- **calc** - 计算题（最核心 canonical）
- **fill** - 填空题
- **choice** - 选择题
- **judge** - 判断题
- **geometry** - 操作/作图题
- **apply** - 解决问题/应用题

> **证据**：`docs/pol-kbl-pending.md:139` 明确标注 **P11-01 discovery (canonical types = 6)**；`docs/DEV_LOG.md:184` 明确 **canonical types = 6**（calc/fill/choice/judge/geometry/apply）

#### 2. Alias（别名类）
通过 `TYPE_ALIASES` 映射关系识别：
- **oral** → `calc`（口算作为 calc 的别名，P11-01 发现的 legacy 别名）
- **recognize** → `geometry`（识别作为 geometry 的别名）
- **classification** → `classify`（分类作为 classify 的别名）

> **证据**：`TYPE_ALIASES` 定义在 `shared/request/request-normalize.js` 中，所有旧别名均映射至 canonical 6 类

#### 3. Legacy（遗留类）
通过历史追踪与 P11-01 冻结标记：
- **oral** 为 legacy 别名（P11-01 discovery 明确标记）
- 通过 `TYPE_ALIASES` 中 `oral: 'calc'` 的存在确认：系统保留该别名仅作**兼容旧链接**，不作为真正的 canonical type

> **证据**：`docs/pol-kbl-pending.md:139` 明确 **P11-01 discovery (canonical types = 6)** 配合 `docs/DEV_LOG.md:184` 的 `oral` 为 legacy 别名判定

#### 4. Variant（变体类）
经扫描：当前代码库中**无**定义为 variant 类型的条目。所有题型均已映射至 canonical 6 类或 alias。

> **证据**：全仓扫描 `TYPE_ALIASES` 与 `CANONICAL_TYPES` 交集，未发现未映射的 "variant" 类型。所有题型均已被归一化至 canonical 6 类或其 alias。

#### 5. Unknown（未知类）
经扫描：当前代码库中**无**未识别的题型定义。所有题型均有明确的 canonical 或 alias 映射。

> **证据**：全仓范围扫描 `CANONICAL_TYPES` ∪ `TYPE_ALIASES`，未发现无法映射的题型串。所有输入题型均被 normalize 至 canonical 6 类。

---

## C3-02 题型唯一权威

### 最终确立：只能有一套题型权威

```text
CANONICAL_TYPES (6 类)    ← 正 canonical 定义
TYPE_ALIASES             ← 旧别名映射（口算/recognize 等→ canonical）
normalizeQuestionType()  ← 唯一调用入口
```

### 删除/清理

1. 删除**第二套 normalize**：不得另行构建 `normalizeQuestionType()` 与 `CANONICAL_TYPES` 并存
2. 删除**第三套 alias**：不得额外维护 `TYPE_ALIASES` 之外的别名映射
3. 删除**重复 canonical 数组**：确保 `CANONICAL_TYPES` 唯一出现在 `request-normalize.js` 与 `check-f-type-2.js` 中

### 统一调用口

```text
唯一入口：normalizeQuestionType(topic) 
```

所有模块必须通过该入口将题型归一化至 canonical 6 类，不得自行判定或硬编码。

### 验收标准

- `CANONICAL_TYPES` 唯一出现在 `shared/request/request-normalize.js:26`
- `normalizeQuestionType()` 唯一被调用：`practice-orchestrator.js`、`check-f-type-2.js`、`dev/check-f-type-2.js`
- 无第二套 `CANONICAL_TYPES` 定义
- 无第二套 `TYPE_ALIASES` 定义（除承载 legacy 别名外）

---

## C3-03 POL 拥有题型决策权

### 决策口

```text
POL 决策：
  selectedTypes
  cell.questionType
  typeCounts
```

### Generator 只能执行

```text
输入：Cell + StrategyContext
输出：candidate SemanticQuestion
```
> **Generator 不得修改 questionType / 重新解释 Cell。**

### Selector 归位

```text
输入：Cell + StrategyContext
输出：eligible generator
```
只做：
- 能力匹配
- KP 匹配
- 题型匹配
- necessary Generator 排序

禁止：
- 修改 questionType
- 修改 difficulty
- 修改 planned
- 修改 knowledgeId
- 重新分配数量

---

## C3-04 正式冻结题型权

题型权从现在起归属如下：

| 负责人 | 负责内容 | 禁止内容 |
|--------|----------|----------|
| **POL** | selectedTypes、cell.questionType、typeCounts | 任意自行修改题型 |
| **Generator** | 根据 Cell 执行生成 | 任意修改 Cell/题型/难度/数量 |
| **Selector** | 判定“有没有能执行这个 Cell 的 Generator” | 任意决定题型/难度/数量 |
| **Validator** | 验收题目质量 | 任意改变题型/难度/数量 |
| **Presentation** | 展示/打印/SVG | 任意生成题目 |

**冻结线以上**：POL 决策，Generator 执行，Validator 验收，Presentation 展示。
**冻结线以下**：任何模块不得绕过 KnowledgeContext 重新访问 KBL/题型决策。

---

## C3-05 验收

验收清单：

- [ ] `CANONICAL_TYPES` 唯一出现在 `shared/request/request-normalize.js:26`
- [ ] `normalizeQuestionType()` 唯一被调用入口
- [ ] 无第二套 `CANONICAL_TYPES` 定义
- [ ] 无第二套 `TYPE_ALIASES` 定义（承载 legacy 别名除外）
- [ ] POL 决策的 selectedTypes 在 Generator 中被正确执行
- [ ] Selector 仅做能力/KP/题型匹配，不决策题型

---

## C3-05 验收完成标记

此部分完成后，在 issue-register.md 的 C3 区添加：

| # | 问题 | 根因 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | **P11-01 canonical types = 6**：oral 为 legacy 别名 → calc | TYPE_ALIASES 映射机制 | 无行为影响（oral 作 calc 别名） | 标记为 P16-FOLLOWUP-B6（已办理） |
