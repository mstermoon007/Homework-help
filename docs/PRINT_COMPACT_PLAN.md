# 打印排版紧凑化 · AI 编程开发详细步骤（设计文档）

> 目标：解决「生成题目 → 排版打印 → 页面美观合理、不浪费空间」的矛盾——打印稿去卡片化、以缩小空间为准、删除多余题目卡样式。
> 范围：仅设计，不执行。本文档给出从「授权」到「落地」的完整 AI 编程开发步骤。
> 配套上一份《SPIRAL_IMPROVEMENT_PLAN.md》互不影响，二者各自独立提交。

---

## 0. 关键事实（动手前必读）

### 0.1 打印有两条路径，样式各自维护（双源，已漂移）

| 路径 | 入口 | 样式来源 | 现状关键值 |
|---|---|---|---|
| 旧路径（DOM 克隆） | `Print.open` / `Print.preview` | 克隆 `#problemsArea` + 原页 CSS + 内联覆写 | 网格 `gap:14px 12px`（print.js L166-171 内联）；卡 padding `var(--card-padding-print)`（print.js L204） |
| 新路径（题目数组直渲） | `Print.openFromQuestions` / `previewFromQuestions` | 自含 `PRINT_QCSS`（print.js L398-414） | 卡 `border:1px #dbe3f0 + radius:10 + bg:#fff`、padding `14px 14px 10px`、`gap:12px 10px`、题面 `16px/1.7`、作答区 `min-h 28/24px` |

两条路径间距、内边距取值不一致（gap 14/12 vs 12/10；padding 10/12 vs 14/14/10），存在双源漂移。

### 0.2 三个「死配置/未启用」现状（设计利用点）

1. `renderOptions.density='compact'` 已声明为 print 默认（render-options.js L20），但**无任何代码消费**——HTMLRenderer/renderer 均未读取 density。
2. `.question-card.compact` 类在 components.css L629 定义完整（padding 8/10、字号 14、scene 120×80、gap 8），但 practice.html **从未给卡片加该类**。
3. `--grid-gap-print: 14px 12px`（tokens.css L141）定义后无人引用；print.js 硬编码同值。

### 0.3 治理红线（重要更正）

**本方案所有改动文件均属 Frozen Core（DEVELOPMENT.md §6.1），无「零风险免授权」路径：**

- M0：`shared/tokens.css`、`shared/components.css`、`shared/pages.css`、`shared/base.css`、`shared/states.css`、`shared/toolbar.css`、`shared/subjects.css`
- M7：`shared/presentation/*`（renderer / html-renderer / render-options / render-result / legacy-svg-adapter / svg-registry）、`shared/print.js`

即：**上一轮「一档纯 CSS 覆写零风险」的说法不成立，特此更正。** 任何一档改动都会触发 `verify:frozen-core` 门禁（对比 `dev/frozen-core-baseline.json` 哈希），必须先走 §6.5 变更申请流程，改动后重锚基线。

### 0.4 浏览器运行时加载方式（决定是否需要重编 bundle）

practice.html 通过**独立 `<script>` 标签**加载打印相关模块（L276 `shared/print.js`、L309-325 `render-options.js / render-result.js / html-renderer.js / renderer.js`），**并非经 bundle 加载**。因此：

- 修改 `print.js` / `html-renderer.js` / `render-options.js` / `renderer.js` **无需重编 `presentation-engine.bundle.js`**；
- 但仍建议改动后跑一次 `npm run build:presentation && npm run verify:presentation-runtime` 作一致性兜底。

---

## 1. 总体阶段（P0–P4）

```
P0 前置门：Frozen Core 变更申请（必须先完成，否则一票否决）
  └→ P1 档一·必做：打印去卡片化 + 间距收紧（纯样式）
      └→ P2 档二·建议做：density 生效 + 职责分离（小代码改动）
          └→ P3 档三·可选：题号/作答线/分页微调
              └→ P4 收尾：基线重锚 + 文档 + 全量门禁 + 打样验收
```

**执行顺序硬约束**：P0 未批准前不做 P1–P3；P1 完成后才可进入 P2（避免同时在两条路径上改打印样式导致 diff 纠缠）；P3 为可选，可跳过。

---

## 2. P0 前置门 · Frozen Core 变更申请（全部阶段的准入条件）

**目的**：本方案所有改动落在冻结核心上，必须先按 DEVELOPMENT.md §6.5 取得授权。

| 步骤 | 动作 | 产出/标准 |
|---|---|---|
| P0.1 | 提交 Issue：标记 `[Bug Fix][Frozen Core]` | Issue 标题示例：《打印排版浪费空间且存在多余卡片样式（双路径不一致）》。正文含：复现（生成任意口算/应用题 → 打印预览）、预期 vs 实际（预期紧凑试卷式；实际卡片框+大间距+浪费版面）、影响范围（print.js / presentation / M0 CSS） |
| P0.2 | 评估：是否确为 Bug、可否在外层解决 | 结论应写：属打印缺陷（版面浪费），且无冻结层之外的可达表面（§6.4 扩展机制均不覆盖打印样式），必须进入冻结层最小改动 |
| P0.3 | 批准：打 `[Frozen Core Fix]` 标签 | 未批准则停在此处，不进入 P1 |
| P0.4 | 备份基线 | `cp dev/frozen-core-baseline.json dev/frozen-core-baseline.json.bak`（回滚用） |

**验收**：Issue 已带 `[Frozen Core Fix]` 标签；基线备份存在。

---

## 3. P1 档一 · 必做：打印去卡片化 + 间距收紧（纯样式，改动面最小）

> 原则：**打印稿不追求「屏幕卡片感」，回归「练习单/试卷感」**。屏幕端保持卡片（美观、交互态需要），打印端去框、去阴影、缩间距。

### P1.1 新路径 `PRINT_QCSS` 精简（print.js L398-414）

| 选择器 | 现值 | 建议值 | 说明 |
|---|---|---|---|
| `@page` margin | `12mm 10mm` | `10mm 8mm` | 每页净增版面（makeTen 路由 8/8 保持不变） |
| `.ps-title` | `20px / margin-bottom 14px` | `18px / 8px` | 标题占版收窄 |
| `.questions-grid` gap | `12px 10px` | `8px 6px` | 行/列间距收紧 |
| `.question-card` | `border:1px #dbe3f0; border-radius:10px; padding:14px 14px 10px; background:#fff;` | 删 border/radius/background；`padding:6px 8px` | **去卡片化核心**：纸张上无框无底，靠间距分隔 |
| `.question-stem` | `16px / line-height:1.7` | `15px / line-height:1.5` | 行高收紧，短题干不再撑高 |
| `.question-stem .num` | `min-width:20px; color:#5b8def` | `min-width:18px; color:#1A1B1C` | 题号回归正文色，去品牌色 |
| `.question-graphic` | `margin:8px 0 6px` | `margin:6px 0 4px` | 图形区边距收紧 |
| `.question-answer` | `margin-top:10px; min-height:24px;` | `margin-top:6px; min-height:20px;` | 作答区收窄（仍够手写） |
| `.question-answer-print` | `min-height:28px` | `min-height:20px` | 同上 |

**验证**：`node --test tests/presentation/renderer.test.js`（不涉及但作基线确认）；用 `Print.buildFromQuestions` 重建样例目检单卡高度（预计 ~91px → ~60px，-34%）。

### P1.2 旧路径统一（DOM 克隆打印）

| 文件:行 | 现值 | 建议值 |
|---|---|---|
| print.js L166-171（网格内联 cssText） | `gap:14px 12px` | `gap:8px 6px` |
| print.js L204（.print-shell .question-card 兜底） | `padding: var(--card-padding-print)` | 保持引用，值由 P1.3 收敛 |
| pages.css L151-155（@media print 卡 padding） | `var(--card-padding-print)` | 保持引用 |

**目标**：新/旧两条路径最终落到**同一组紧凑值**，消除双源漂移。

### P1.3 令牌收敛（tokens.css L138-141）

| 令牌 | 现值 | 建议值 |
|---|---|---|
| `--card-padding-print` | `10px 12px` | `6px 8px`（与 P1.1 一致） |
| `--grid-gap-print` | `14px 12px`（无人引用） | **删除**，或改值 `8px 6px` 并让 print.js/pages.css 真正引用它（推荐后者：消除硬编码） |

### P1.4 文件清单与门禁

**改动文件**（全部 Frozen Core）：`shared/print.js`、`shared/tokens.css`、`shared/pages.css`（P1.2 若引用 token 则无需改 pages.css 逻辑值）。

**跑门禁**（改动后，P4 重锚基线前预期 `verify:frozen-core` 红）：

```
npm run build:presentation
npm run verify:presentation-runtime
node dev/check-p6-render-print.js      # P6 打印统一门禁：确认仍走 PresentationRenderer
npm run verify-pages
npm run verify:practice-page
npm run test:node                      # presentation 单测
```

**验收**：新/旧两路径打印预览：无卡片框/阴影/底色；单卡高下降约 1/3；同题量页数减少约 1/3 或同页题量 +45~50%（估算口径：A4 竖版、3 列、96dpi）。

---

## 4. P2 档二 · 建议做：让 `density` 真正生效 + 职责分离（小代码改动）

> 目的：把「紧凑」从死配置变成真实行为，并固化「屏幕卡片 / 打印练习单」双排版原则。P1 已让打印值紧凑；P2 让**约定（contract）与实现一致**，防止未来再漂移。

### P2.1 renderer.js 透传 density（renderer.js L60-62）

- 现值：`HTMLRenderer.render(sq, i, { mode: ro.mode, graphic: svg })`
- 建议：`HTMLRenderer.render(sq, i, { mode: ro.mode, graphic: svg, density: ro.density })`
- 约束：不改变 RenderResult 契约（density 只影响 HTML 输出，不进入 result 元数据）。

### P2.2 html-renderer.js 按 density 输出 compact 类（html-renderer.js L120）

- 现值：`<div class="question-card" data-index=...>`
- 建议：`density==='compact'` 时输出 `<div class="question-card compact" ...>`，否则维持现状。
- 约束：仅追加 class，不改卡内结构，保证 Node/浏览器输出一致。

### P2.3 components.css `.question-card.compact` 校准（components.css L629-656）

- 该类已存在（padding 8/10、--q-text-size 14、scene 120×80、gap 8）。
- 校准点：与 P1.1 打印值保持语义一致（若打印走 PRINT_QCSS 则此处仅服务屏幕紧凑场景，二者可独立，但注释需写明各自用途）。
- 不新增卡片框——compact 保持无框。

### P2.4 新增单测（tests/presentation/renderer.test.js）

- 断言 1：`HTMLRenderer.render(sq, 0, { density: 'compact' })` 输出包含 `class="question-card compact"`。
- 断言 2：`density` 缺省（normal）不输出 compact 类（回归：屏幕不受影响）。
- 断言 3：`renderOptions.normalize({}, 'print').density === 'compact'`（已有，保留）。

### P2.5 门禁

```
node --test tests/presentation/renderer.test.js
npm run verify:presentation-runtime
npm run verify:ui-boundary
npm run test:node
```

**验收**：compact 类随 density 出现；屏幕 normal 模式渲染结果与改动前完全一致（用 verify:golden / verify:snapshot 兜底）。

---

## 5. P3 档三 · 可选：微调

### P3.1 题号去圆形徽标（components.css L539-546 / PRINT_QCSS num）

- 现值：22px 圆形品牌底色徽标。
- 建议：普通 `min-width:18px` 数字，省横向空间、省墨。
- 注意：屏幕端若仍要徽标，仅改 PRINT_QCSS；若统一，改 components.css `.num` 会影响屏幕，需回归屏幕视觉。

### P3.2 作答区横线可选项（PRINT_QCSS `.question-answer`）

- 现值：`border-bottom:1px dashed #b9c6de`（手写定位用）。
- 建议：口算/纯填空题型可去掉 dashed 线，由 grid 间距分隔；应用题保留横线（书写需要）。可通过 `PRINT_ROUTES` 增 flag 或按 pageType 注入不同 QCSS。

### P3.3 分页优化（PRINT_QCSS `.question-card`）

- 现值：`page-break-inside:avoid` 对所有卡生效，大图卡可能造成页底大片留白。
- 建议：对短卡（无 `.question-graphic` 且题干单行）放行 `page-break-inside:auto`，让页底密度更高。可用 CSS 选择器 `.question-card:not(:has(.question-graphic))` 或 JS 按卡高阈值加类（JS 改动更可控，但属 P2 之后再做）。

**验收**：目检数页打印稿，页底无大片白；口算页无作答线仍清晰。

---

## 6. P4 收尾

| 步骤 | 动作 |
|---|---|
| P4.1 | 重锚基线：`node dev/check-frozen-core.js --baseline`（授权改动后的标准收尾，DEVELOPMENT.md §6.5 第 6 步） |
| P4.2 | 全量门禁：`npm test` + `verify:frozen-core` + `verify:m3` + `verify:layers` + `verify-pages` + `verify:practice-page` 全绿 |
| P4.3 | 变更记录：`docs/DEV_LOG.md` 记录 Bug 编号、根因、修复点、验证方式（§6.3 要求） |
| P4.4 | 浏览器打样验收：真实打印预览（或导出 PDF）抽查口算/应用题/凑十法/综合练习各一份，确认紧凑且不截断 |

---

## 7. 影响面与风险登记

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | 所有改动在 Frozen Core，未授权即改会挂 `verify:frozen-core` | 高 | P0 申请未批准不进入 P1；改动后必须 P4.1 重锚基线 |
| R2 | 旧/新两路径值若未统一，出现「预览一种、打印另一种」 | 中 | P1.2/P1.3 强制收敛到同一组令牌 |
| R3 | 去卡片框后题与题之间无视觉分隔，长题干可能粘连 | 中 | 用 gap 8×6 保证最小分隔；P3.3 分页优化兜底 |
| R4 | 作答区 min-height 20px 可能偏小（低年级手写） | 低 | 保留 20px 起步，打样若不适再调 22px；口算 vs 应用题可分开设值 |
| R5 | 重编 presentation bundle 引起哈希漂移 | 低 | 浏览器走源文件直载，无需重编；仅跑 build:presentation 作兜底验证，不提交 bundle 变更除非必要 |

---

## 8. 门禁速查（package.json 实测）

| 命令 | 用途 |
|---|---|
| `npm run verify:frozen-core` | Frozen Core 哈希对比（改动未重锚前预期红） |
| `node dev/check-p6-render-print.js` | P6 打印统一门禁（Renderer 唯一出口） |
| `npm run verify:presentation-runtime` | 展示层运行时一致性 |
| `npm run build:presentation` | 重编展示 bundle（本次通常不需要） |
| `npm run verify-pages` / `verify:practice-page` | 页面职责门禁 |
| `npm run test:node` | node --test（presentation 等单测） |
| `npm test` | 全量门禁（含 check-frozen-core --check） |
| `node dev/check-frozen-core.js --baseline` | 授权改动后重锚基线 |

---

## 9. 工作纪律

1. **四大架构不动**：UI / 核心策略引擎 / 知识库 / 大服务层边界不变；本次仅动 M0 样式与 M7 打印/展示层，且走 Frozen Core 授权流程。
2. **最小改动**：只改打印/展示相关样式与契约消费，不带入无关重构。
3. **每步独立提交**：P0/P1/P2/P3 各一个 commit，P4 收尾一个 commit，禁止跨步合并。
4. **只改点名范围**：不调整屏幕端卡片默认外观（除非 P3.1 明示统一）。
5. **物理不移动文件**：沿用架构文档已论证的「物理稳定 + 逻辑清单」原则。
