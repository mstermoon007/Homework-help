# G1 SVG 模板整理（题型固定样式 → SVG 渲染族）

> 整理日期：2026-09-05 ｜ 关联实现：`shared/svg-templates.js`、`shared/strategy/question-style-strategy.js`
>
> 目标：让「知识点 + 题型」有**确定性固定样式**——样式管骨架（题型呈现），复杂度管内容深度（难度档），二者解耦，生成层统筹注入。

## 1. 固定样式注册表（M3-13，question-style-strategy.js）

| 题型 (canonical) | 固定样式 style | SVG 模板族 | 说明 |
|---|---|---|---|
| calc / oral | `calc` | `svg-calculation` | 计算式（横式/竖式：加、减、乘、除、小数、分数） |
| fill | `fill` | `svg-calculation` | 算式留空 / 数轴填数 |
| choice | `choice` | `svg-choice` | 选项卡（A/B/C/D 选择支，渲染层 options 渲染） |
| judge | `judge` | `svg-judge` | 判断陈述（对/错，渲染层语句渲染） |
| apply | `story` | `svg-story` | 图文应用（生活场景 + 条件陈述） |
| geometry | `shape` | `svg-geometry` | 图形操作（立体/平面图形、连线配对、拼摆） |
| recognize | `choice` | `svg-choice` | 认读识别（归入选项卡样式） |
| open | `open` | `svg-open` | 开放表达（自由作答区） |

**类别修正**（同一题型在不同知识点类别下微调骨架）：

| 知识点类别 | 题型 | 修正后样式 | 原因 |
|---|---|---|---|
| geometry | calc | `shape` | 几何类出计算 → 图形计算 |
| measurement | apply | `story` | 度量类应用 → 图文应用（含单位） |

## 2. SVG 模板实现族（svg-*.js，挂载 global.SVGGenerators）

| 模板族 | 全局路径 | 能力 |
|---|---|---|
| svg-calculation | `SVGGenerators.math.calculation` | add / sub / mul / div / dec / frac |
| svg-geometry | `SVGGenerators.math.geometry` | 图形操作、连线 |
| svg-make-ten | `SVGGenerators.math.makeTen` | 凑十法拆分（20 以内进位加法） |
| svg-choice / svg-judge / svg-story / svg-open | 渲染层直接渲染 | 选项卡 / 判断陈述 / 图文应用 / 开放作答 |

`shared/svg-templates.js` 统一登记「style → 模板族」并校验模板族 ready 状态（`SVGTemplates.templateForStyle(style)` / `listTemplates()`）。

## 3. 复杂度统筹（M3-14，complexity-strategy.js）

| 有效难度 | 复杂度档 tier | rangeBoost | multiStep | mixLevel | 行为 |
|---|---|---|---|---|---|
| 1-3 | `simple` 基础 | 0 | 否 | 0 | 小范围、单步（简单化） |
| 4-7 | `standard` 标准 | 1 | 是 | 1 | 中范围、多步、进位退位（默认基准） |
| 8-10 | `complex` 进阶 | 2 | 是 | 2 | 大范围、混合运算（复杂化） |

**螺旋微调**：难度 6+ 且螺旋档 ≥5 → 升为 complex；难度 ≤4 且螺旋档 ≤2 → 降为 simple。

## 4. 生成层统筹注入（strategy-engine.plan）

每个 QuestionPlan 携带：

```js
plan.style        // calc/fill/choice/judge/story/shape/open（固定样式）
plan.svgTemplate  // svg-calculation/svg-choice/svg-judge/svg-story/svg-geometry/svg-open
plan.complexity   // { tier, label, rangeBoost, multiStep, mixLevel, spiralAdjusted }
```

渲染层据此选择 SVG 模板族 + 内容复杂度；生成器据 `constraints`（含难度派生数值范围/步数）产出符合档位的题目。

## 5. 快速模式 7 类题型 → 数据驱动匹配（不再锁定模块）

| UI 题型 | 能力匹配（applicable_question_types） | 类别域回退 | G1 计数（全部/上册/下册） |
|---|---|---|---|
| 计算题 | calc, oral | — | 23 / 11 / 10 |
| 填空题 | fill | — | 25 / 10 / 7 |
| 选择题 | choice | — | 18 / 4 / 5 |
| 判断题 | judge | — | 2 / 1 / 0 |
| 操作/作图题 | geometry | category=geometry | 7 / 2 / 3 |
| 分类整理题 | —（2026 教材归二上） | — | 0 / 0 / 0 |
| 解决问题/应用题 | apply | — | 12 / 6 / 5 |

> 分类整理题在一年级无对应知识点（2026 人教版分类与整理在二上），卡片显示 0 并置灰，点击不产生 kps（防 0 题）。
