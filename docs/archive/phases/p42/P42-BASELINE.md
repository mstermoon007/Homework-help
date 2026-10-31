# P42-0 质量基线与缺陷样本库

> 审计日期：2026-10-14  
> 版本：5.2.0 (`b65e83d`)  
> 分支：`main`  
> 审计约束：只读、不修改生产源码/KBL/构建产物、不部署服务器

---

## 1. 现状清单

| 项目 | 实测值 | 来源/备注 |
|---|---|---|
| 规范题型数 | 7 | `shared/knowledge/question-type-registry.js:34-56` (calc, fill, choice, judge, geometry, classify, apply) |
| 别名映射 | 78+ 条 | 同文件 `CANONICAL_ALIASES` (59-136) |
| AnswerMode 枚举 | 5 | `shared/schemas/semantic-question.schema.js:31` (input, choice, multi, none, read-aloud) |
| SemanticQuestion 必填字段 | 9 | schema 校验：id, knowledgePoint, content, question, answer, questionType, metadata, prompt, version |
| 生成器数 | 23 (registry) / 17 可执行 | `generator-registry.js:22-160` + `generators/index.js` |
| ALLOW 矩阵规模 | 1570 行 | `kbl/mappings/generation-contract/math.json` (375 KP × 7 类，全部 ALLOW) |
| 实际产出验证 | 1570/1570 | `dev/check-allow-generation.js` 实跑生成 |
| 验证器数量 | 12 | `validation-pipeline.js` 4 层，含 answer-validator、difficulty-integrity 等 |
| 真独立重算路径 | 1 | 仅 `answer-validator.computeExpectedAnswer` 对 calc/fill 纯算式 |
| 完整门禁链 | 33 项 | `check-all`：32 PASS / 1 SKIP (browser E2E 无 Chrome) |

---

## 2. 正确性审计结论（1570 题全量实跑，deterministic seed `p42|kp|qt|d3`）

### 2.1 结构/Schema/契约层 — **零缺陷**
- Schema 校验、KpSemantic、TypeContract、DifficultyIntegrity：1570/1570 全 PASS
- 生成/选项/图形/干扰项结构：零错误

### 2.2 答案正确性（数学重算）— **发现真实缺陷 18 例**
- 仅 `calc`/`fill`/`apply` 中**数值答案且解释中含完整等式**的 457 例可脚本自检
- **18 例解释内等式与其右值不符**（见 P42-DEFECT-REGISTER P42-001~018）
  - 典型：`20 ÷ 3 = 6`（应 6.67）、`5 + 8 = 39`（应 13）、`1/3 = 5`（应 0.33）、`2 ÷ 10 = 20`（应 0.2）
- 616 例无可解析等式（含 G1 几何计数、RMB 加减、近似数、分数性质叙述、词题）— **覆盖缺口**
- word problems / geometry / classify / choice 选项真值：**无任何自动重算**

### 2.3 选择题 / 判断题结构 — **零结构缺陷**
- 1570 题：choice 答案在选项内、无重复选项、无多正解；judge 答案全布尔、expectedResult 与 answer.value 逻辑一致
- 注：9 例 `judge_inconsistent` 为误报（对比布尔与数值导致），人工核实后排除

### 2.4 非数值/开放式答案 — **5 例显式占位**
- `"举例合理即可"` × 3（G1/G4 几何认识类），`"如自行车车架...利用三角形稳定性"` × 1（G4 apply），其 1 例近义表达 — **人工判断范围**

---

## 3. 教学目标匹配审计

| 问题类别 | 计数 | 说明 | 证据 |
|---|---|---|---|
| **单位超出 KP 显式范围** | 3 | G2「认识厘米和米」出现「千米/毫米」换算 | `money.js:262-281` 从整族选单位，无 KP 白名单 |
| **Apply 仅问“后一个”但答案含“前一个+后一个”** | 1 | `concept-meaning.js:802-804` apply 模板与 stem/answer 不一致 | `math-g1-down-u03-k005` |
| **Prompt 跨 KP 复用** | 64 组 | 同一题面服务 2–9 个不同 KP（跨年级/题型） | 如「下面哪个算式等于 4？」跨 5 KP |
| **Apply 非数值答案** | 192 | 全为 `concept-meaning` apply 产出（含定义背诵、举例、比较） | 规范，非缺陷，但无法数学验证 |

---

## 4. 难度链路一致性

| 检查项 | 结果 | 备注 |
|---|---|---|
| 生产声明难度 ∈ 1–10 | 全部通过 | `difficulty-validator` |
| 声明 `difficulty` 与 `difficultyParams.level` 一致 | 全部通过 | 0 mismatch |
| `difficulty-integrity-validator` 结构/螺旋/认知一致性 | 1570/1570 PASS | 定义级一致 |
| **定义级 → 实例级一致性（生成后复核）** | **无门禁** | 仅定义级 gate 9a/9b；实例级未纳入 check-all |

> 链路：`request.difficulty`(1/6) → `DifficultyContext.target` → `resolveTargetDifficulty.static/composed/effective` → `resolveComposedDifficulty(base+mAdj+qAdj+cAdj)` → `GRADE_DIFFICULTY_ANCHORS`(anchor-top) → `plan.difficulty` → `sq.difficulty`/`sq.difficultyParams`。详见 `difficulty-strategy.js`、`target-difficulty.js`、`strategy-engine.js`。

---

## 5. 样本与覆盖分析（可复现种子：`p42|<kp>|<qt>|d3`）

| 维度 | 可自动验证 | 依赖人工 / 无法验证 |
|---|---|---|
| R7 数学正确性 | 457/1570 (29%) — 仅 calc/fill/apply 且解释含完整等式 | 1113 题（几何计数、词题、近似数、分数性质叙述、开放式、无等式） |
| R8 单位一致性 | 1570/1570 — 提示/答案/图形单位 | 3 例 KP 名称未显式含单位但题目使用（G2 千米/毫米） |
| R9 数值合理性(加减封闭域) | 部分 | 需 `numberRange.numMax` 且仅 +−；乘除/组合/分数不可判 |
| R10 结构完整性 | 1570/1570 | schema+kpSem+TC 全通过 |
| R11 答案唯一性(choice) | 375/375 PASS | classify/其他需人工 |
| R19 可复现性 | 1570/1570 (每 37 个抽检 1) | 全 pass |
| R20 可评分性 | 1570/1570 | gradeUserAnswer 自对回放 pass；仅验自洽非真值 |

---

## 6. 已知工具/覆盖缺口

1. **无端到端数学真值门禁** — `answer-validator` 仅 calc/fill 简单算式；apply/word/geometry/choice 选项真值无重算。
2. **Golden dataset 信任生成器** — `kbl/teaching/golden-questions.json` 直接存生成器产出，未经独立重算。
3. **KP 本质参与度无自动验证** — 现有 `kp-semantic-validator` 仅检查 KP ID/类型/算子/数值/结构/关键词出现，不验证“目标 KP 必须参与解题”。
4. **难度实例级复核缺失** — 9a/9b 仅防第二套公式；`difficulty-integrity-validator` 是 advisory (Layer 3 required:false)，未在 check-all 强制。
5. **Browser E2E (Gate 15) BLOCKED** — 无 Chrome/Chromium；CI 需 `REQUIRE_BROWSER_E2E=1` + `CHROME_BIN`。

---

## 7. P42 后续实施顺序建议

| 阶段 | 目标 | 说明 |
|---|---|---|
| **P42-1** | 扩展 `answer-validator` 重算覆盖面 + 增加真值门禁 | 最小改动：新增 word-problem/geometry/choice 真值检查器；接入 check-all（建议先 advisory 再 required） |
| **P42-2** | 教学目标本质参与度检查器 | 需设计“KP 必用性”判定规则（如：解释必须引用目标 KP 核心概念/运算），先做静态规则 |
| **P42-3** | 实例级难度一致性强制门禁 | 将 `difficulty-integrity-validator` 升为 required（或新增专用 gate），清理现存 inversion |

> **不建议在 P42-0 之后立即修复** — 本基线仅供签收。所有修复需新立项、反例+最小修改+回归测试，遵循 P41 纪律。