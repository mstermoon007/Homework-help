# P31 任务书 · 题目显示层统一排版收口（页面排版整改优化）

> 状态：**已立项，待阶段一执行**（2026-10-04 用户批准）
> 规则：`.trae/rules/p31-layout-rules.md` ｜ 日志：`docs/P31/change-log.md`
> 编号：P31-01 … P31-10（数字）。阶段过门须用户确认。
> 上游方案：用户 2026-10-04《题目显示层统一收口》方案（经代码核实后采纳，本任务书为其修正版，冲突以本文件为准）。

---

## 1. 战役目标

建立唯一排版决策中心 `shared/presentation/layout.js`，统一输出 QuestionLayoutPlan；
screen（practice 页，即 A4 预览）与 print（打印两路径）消费同一份 plan，emergency 是唯一异常安全输出；
CSS 只负责表现，SVG 只负责绘图，practice.html 不再拥有题目排版逻辑与第二套渲染器。

**题目内容决定排版，排版中心统一决定，显示出口只负责执行。**

## 2. 立项前已核实的现状证据（2026-10-04）

| # | 位置 | 事实 |
|---|---|---|
| E1 | `shared/core/core.js` L230-371 | `PluginUtil.layout`：`spanForLength` 纯字符阈值（L≥50 通栏 / 26≤L<50 跨2列）；`estimateCardWidth`/`calcOptimalCols`（中位卡宽→1-4 列）；`fitColumns` 渲染后二次改 DOM；`gridColumnsFromDom`/`applySpanning` 从克隆 DOM 重新度量文本（第二套度量） |
| E2 | `shared/presentation/html-renderer.js` L72-95, L178-244 | 卡片已是字符串渲染；span/density 经 options 透传；选项容器 `.question-options` **无档位模式**；renderGrid 写 `--grid-cols` |
| E3 | `shared/presentation/print.js` L143-256, L301-388 | 克隆链（PRINT_QCSS + DOM 重度量）与直渲链（renderAll + spans 预算）两条路径；PRINT_QCSS 含题号圆徽章等与屏幕重复的规则 |
| E4 | `practice.html` L762-767, L813, L854-883, L1210-1264 | `renderGeneric` 第二渲染器（错题本/重做 raw 题集常规路径，含重复 judge 模板）；finalizeRender 调 fitColumns；updateCountTip 硬编码打印间距 `'8px 6px'`/`'6px 8px'` |
| E5 | `shared/styles/components.css` L518-547、`pages.css` L104-160、`practice.html` L109-127 | 题号圆徽章三处各定义；`.q-text font-weight:800`；卡片 radius 10px；pages.css 与 PRINT_QCSS 打印规则有重复 |
| E6 | `shared/engine/practice-session.js` L292-319 | print() 再次调用 calcOptimalCols |
| E7 | `tests/presentation/renderer.test.js` L450, L486-493 | 直接断言 50/26 阈值——换模型时随复现证据重写为决策表契约 |
| E8 | 架构 | Presentation SSOT = `shared/presentation/`（docs/01-ARCHITECTURE.md §2）；硬红线 #4 Presentation→Generator 禁止；bundle 门禁 16/17 |

特殊形态（全程保持）：`meta.exam`（非网格直挂、跳过 fitColumns）、`meta.columns`（固定列数、span 强制 1）、`.comprehensive-grid`。

## 3. 已锁定决策（用户 2026-10-04 批准）

1. 编号 P31-01…10，档案 `docs/P31/`；P31-A~D 字母记录留 P30 日志不改写。
2. 出口口径：**screen / print 两模式 + emergency 一条应急路径**（不建 preview 渲染器）。
3. 排版中心物理落位 `shared/presentation/layout.js`；从 core.js 物理迁出，**不留 `PluginUtil.layout` 别名**。
4. renderGeneric 先转正（raw 题集走 PresentationRenderer），再设唯一 emergency 入口（并入 html-renderer.js）。
5. 题号统一为 **「1.」纯文本**（去圆形徽章，DOM 中 `.num` 文本内容不变，仅改视觉）。
6. LayoutPlan 不进 SemanticQuestion / RenderResult 契约。

## 4. 冻结范围（不允许做）

- KBL / KnowledgeContext / POL / Strategy / Generator / Validator / SemanticQuestion / Difficulty：题型 7 类、难度公式、375/98/373/1570、题面与答案文案一律不动。
- SVG renderer、SVGSanitizer、GraphicDescriptor 结构：只读消费既有 size/role。
- 一级/二级/三级页面：按钮文字/颜色/位置/链接/行为、科目年级知识点题型选择、开始练习/打印/返回/批改、跳转关系、首页。
- exam / 固定列 / comprehensive-grid 三形态行为。

---

## 5. 任务清单

### 阶段一 · P31-SCAN 只读取证

#### P31-01 题目显示现状扫描与排版逻辑清点
- 产出（登记于任务执行记录，不新建多余文档）：
  1. E1-E6 的完整调用图（谁在什么时机调 columns/span/fitColumns/打印）。
  2. plan 字段-消费者矩阵：每个候选字段（density/span/stem/graphic/options/break）列出 screen/print 消费点。
  3. 误排复现题库：经 1570 真实链取样，至少 6 条——带图短题未展开、长选项误 compact、纯算式短题、多空多步题、几何带图题、长应用题；记录 KP/题型/seed。
  4. renderGeneric 触发路径核实：错题本、重做/原始题集各入口的数据形态（Legacy Question 字段面）与答案收集/批改绑定要求。
  5. exam / meta.columns / comprehensive-grid 三形态渲染路径登记。
- 禁改：一切生产代码。
- 过门：五份证据齐备，用户确认后进阶段二。

#### P31-01 执行记录（五份证据，2026-10-04，纯只读；探针为一次性内联 Node，未落文件）

**证据① 排版决策完整调用图（时机/调用方）**

| 决策 | 实现位置 | 调用时机与调用方 |
|---|---|---|
| 字符长度 L | core.js `renderLen`（`coreText`+图+8/scene+10/combine-inp+8） | screen：fitColumns；print：直渲链 spanForLength；均在渲染后/渲染前度量 |
| span | core.js `spanForLength(L,base)`（≥50→`1 / -1`；26–49→`span min(2,base)`；否则 null） | screen：fitColumns 事后写内联 gridColumn；print 克隆链 `applySpanning` 从克隆 DOM 重度量；print 直渲链 buildFromQuestions 预算 |
| columns | core.js `calcOptimalCols`（meta.columns 优先；否则中位 estimateCardWidth→1..4，718px） | practice.html finalizeRender(fitColumns)；practice-session.print；print.js 直渲链；api.js renderQuestions |
| 事后改 DOM | core.js `fitColumns/gridColumnsFromDom`（选择器 `.questions-grid,.q-grid,.comprehensive-grid`） | screen 每次渲染后；打印克隆链 beforeClone |
| 网格列数 CSS | html-renderer.renderGrid 写 `--grid-cols`（钳 1..6，默认 3） | renderAll；与 fitColumns 并存（双决策点） |
| 打印第二套规则 | print.js cloneCss L230-256 / buildPrintQcss L331-353（题号圆徽章、page-break、间距硬编码） | 克隆链 / 直渲链各自维护 |
| 第二渲染器 | practice.html L854-883 `renderGeneric`（重复 judge 模板/eqM/.q-grid cols-N） | lastSemantic.html 缺失时（错题本/重做入口） |
| 第二间距源 | practice.html L1230 updateCountTip 硬编码 `8px 6px`/`6px 8px` | 每次渲染更新计数提示 |

**证据② plan 字段-消费者矩阵（screen / print 现状挂点）**

| 候选字段 | screen 现状消费 | print 现状消费 | 缺口（P31-04/05/07 须补） |
|---|---|---|---|
| columns | renderGrid 写 `--grid-cols`；fitColumns 事后改写 | 克隆 cssText 重设 / 直渲 renderAll columns | 删事后改写，渲染前定值、两链同源 |
| item.span | html-renderer span 白名单类（已透传） | spans 预算 + applySpanning 重度量 | 删 applySpanning；span 同源 |
| density | html-renderer 已发 `compact` 类，**components.css 零规则消费** | 零 | 字段上线当批必须补 CSS 与断言，否则不加 |
| stem inline/block | 零 | 零 | 真实信号已有：response.layout=`inline-after-equals`（93 题样本 32 题）→ inline |
| graphic 档位 | `.question-graphic` 仅居中/max-width，无尺寸档 | 同 | 描述符**无顶层 size 字段**，档位只能由 type+role+subtype+params 确定性映射（见证据③） |
| options 档位 | `.question-options` 仅 flex-wrap，无档位 | option-print/screen 仅换标签形态 | 真实分布仅支持 inline / two-column（见证据③决策项） |
| break auto/keep | 零 | 直渲 `:not(:has(.question-graphic))` 雏形；克隆链一律 avoid | 由 plan 驱动，compact auto / expanded keep |

另登记零消费类：`.style-*`（html-renderer 已发，全 styles 零规则）、`.compact`（同上）——P31-07 必须给出真实消费者，不提前加字段。

**证据③ 真实链误排复现题库（共取样 516 题：134+37+252+93；PracticeSession 真实生成，seed 固定可重放）**

| 桶 | 条数 | 复现题（KP / 题型 / seed=20261004，count=6/8） | 现输出 | 期望（决策表方向） |
|---|---|---|---|---|
| A 带图短题被压 span1 | 5+ | g1 `math-g1-down-u01-k001` fill L23「请写出该图形的名称： ____」；choice L20「下列哪个是三角形的特征？」；geometry L23「观察图中的图形，写出它的名称。」；geometry L24 | span1，与纯算式同档 | 有图→expanded，按图档位，break=keep |
| B geometry L<50 不通栏 | 17/23 | 同 KP geometry L29「平面图形认识：先说一说它是谁，再写出名称。」L29「……看一看，图中画的是什么图形？」 | L26-49 仅 span2，<26 span1 | geometry 一律 expanded/full |
| F calc/fill 被长度拉宽 | 12 | g2 `math-g2-down-u01-k001` calc L51 通栏「钟面结构：…整个钟面总共有多少个小格？列式：12 × …」；L42 span2「…列式：6 × 5 = ？」；L44 span2「(5 − 2) × 1 = ？」；g5 `math-g5-down-u02-k001` calc L61 通栏「…7 × 8 = 56（也可看作 56 ÷ 7 = 8）。」 | span2/通栏，网格参差 | 单作答行题→compact span1；长度不驱动 calc/fill 跨列 |
| G 表达式选项无两列档 | 17（4–7 字选项） | g1 `math-g1-down-u02-k001` choice seed=20261004：「15 − 14｜15 − 13｜15 − 12｜15 − 11」4×7 字，flex-wrap 任折 | 单列卡内任意折行 | options=two-column |
| H inline 作答无信号消费 | 32/93 | apply/fill 样本 response.layout=`inline-after-equals`（如「列式：6 × 5 = ？」） | 该字段零消费 | stem=inline、compact 信号源 |
| I 图形档位信号现状 | 140/252 带图 | 签名：number-position 网格 73、quantity-correspondence 几何 42（rectangle/square/triangle/circle/cylinder 参数各异）、calculation-support brace 16；**顶层 size 全缺**，params 内 width/height/gridSize/r 等确定性可分档 | +8/+10 字符，不分大小 | brace→small；几何对应图→medium；网格/立体→large（P31-03 登记映射表） |

**未获证据的候选信号（按「无证据不加字段」处理）**：选项最长 11 字、≥8 字仅 1 例 → `options=single-column` 本轮不做，枚举仅 inline｜two-column；多输入题 0 例（answerText/response.inputs 全为单输入，多空在题干中）→ 不以「多空」作 expanded 触发，expanded 仅由图/geometry/story/长应用驱动。apply 长度桶 <26:11 / 26–49:31 / ≥50:13。

**证据④ renderGeneric 触发路径与数据形态**：错题本/重做的 raw 题集为 `RenderFormat.toRenderableQuestions` 的 Legacy 形态（q/text/answer/inputType/options/check/svg/knowledgePointId/difficulty），且每条带 **`__semantic:sq` 原始 SQ 引用**——P31-06 转正可直接经此取完整结构字段。答案收集/批改/计时绑定 practice.html 既有 DOM 契约（data-index/radio 同组/回车），P31-06 为最高风险项须真实 Chrome 回归。

**证据⑤ 三形态核实（与原方案「必须保持」的口径澄清，需过门确认）**：

- `meta.exam`：全库零生产写入方，仅 practice.html L778/784/813 读取（防御性死分支）。
- `meta.columns`：无生产设置方（api/orchestrator 的 options.columns 不写入 set.meta），固定列模式当前不可达。
- `.comprehensive-grid`：全库仅 core.js L293 一处选择器，无任何生产方输出该类。
- 另：`openWrongBook`（practice-session）生产零调用。

处置建议：CORE/WIRE **不为三形态新建特殊路径**（既有读取分支保持不动、不投入），四项统一登记为 **P31-10 死代码候选**，删除时按规则 §5 走三方印证。任务书 §4「三形态行为冻结」据此解释为「不改变现状、不新增兼容」。

### 阶段二 · P31-CORE 排版中心

#### P31-02 唯一排版 SSOT 物理落位（只搬家，行为零变化）
- modified：新建 `shared/presentation/layout.js`（Layout IIFE 整体迁入，Node 导出 + 全局 `QuestionLayout`）；删 `shared/core/core.js` 中 Layout 实现与 `PluginUtil.layout` 挂载（L416）；改址 `practice.html`（3 处调用 + 脚本加载顺序）、`print.js` resolveLayout、`practice-session.js`、`tests/presentation/renderer.test.js` 引用；同步 `dev/build-presentation-bundle.js` 内联模块清单。
- deleted：core.js 内排版代码（物理删除，无 re-export/别名）。
- 验收：50/26 阈值与搬家前完全一致；npm test 全过；重建 bundle 过 16/17；真实 Chrome 打印首页排版与改前同页（截图对比）。
- 风险：浏览器脚本加载顺序——layout.js 必须先于 print.js/practice 内联脚本就绪。

##### P31-02 执行记录（2026-10-06，只搬家、行为零变化）

- modified：
  - 新建 `shared/presentation/layout.js`（UMD：浏览器挂 `window.QuestionLayout`，Node `module.exports`）。8 个函数（coreText/renderLen/spanForLength/estimateCardWidth/calcOptimalCols/fitColumns/gridColumnsFromDom/applySpanning）与 core.js 旧实现**函数体逐字一致**（脚本化括号配平比对 8/8 IDENT），常量 GAP=12/CN_W=14/EN_W=9、阈值 50/26 不变。
  - `shared/core/core.js`：物理删除 Layout IIFE（原 L202-372）、`global.PluginUtil.layout = Layout` 挂载、module.exports 中 `Layout` 项；原位留迁出指引注释，**无别名无 re-export**。
  - `practice.html`：`DEFERRED_SCRIPTS` 首位插入 layout.js（async=false 保序，先于 print.js/渲染器；首屏 render 与 redoWrong 均在 ensureDeferredReady 门控后）；3 处调用改 `QuestionLayout.*`（fitColumns / renderGeneric calcOptimalCols / updateCountTip calcOptimalCols）+ 注释改址。
  - `shared/presentation/print.js`：resolveLayout 改为 `window.QuestionLayout → require('./layout.js') → globalThis.QuestionLayout`；克隆链两处调用改走解析结果（layout 缺失回退 3 列/不跨列，与旧极端路径等价）；头部与直渲链注释改址。
  - `shared/engine/practice-session.js`：新增 resolveLayout()（全局优先 + Node require 兜底），print() 列数改走它。
  - `tests/presentation/renderer.test.js`：Layout 引用改指新模块（阈值断言原样保留，P31-03 再随决策表重写）。
  - 注释/文档改址：`html-renderer.js`、`renderer.js`、`components.css` L569、`docs/06-PRESENTATION.md` SSOT 表。
- deleted：core.js 内全部排版实现（~171 行）。
- tests：
  - 新旧实现对拍：21 组题干样本 × 3 索引下 coreText/renderLen/estimateCardWidth 全等；spanForLength 7×4 组全等；calcOptimalCols 0–25 题 × 4 宽度 + 固定列模式全等；U+303F 边界字符全等。
  - `node --test tests/presentation/*.test.js`：**130/130 PASS**。
  - `npm test`：**654/654 PASS / 0 FAIL**（test() 声明数与 HEAD 均 554，断言数 654 与基线一致，未增删用例）。
  - `node dev/build-presentation-bundle.js`：inlined 25；**bundle 与 HEAD 逐字节一致**（layout.js 不经 bundle 模块图，浏览器走 DEFERRED_SCRIPTS）；check-all 16/17 PASS。
  - `node dev/check-all.js`：**29 PASS / 0 FAIL / 1 SKIP**（第 15 项无 CHROME_BIN 时 SKIP，同基线）。
  - 真实 Chrome 9 步 E2E（CHROME_BIN 本机 Chrome）：步骤 1-6、8、9 全 ok（含「9 打印」printedCards=10/produced=10、打印弹窗与 print 调用各 1、无 JS error）；**步骤 7「请求参数保持」失败——git stash 回 HEAD 干净基线同一步骤同样失败，确认为 P31-02 之前既存问题**（比较两次生成请求 JSON 不一致，与排版无关），按红线 #9 只登记不顺手修。
- 结论：搬家前后屏/打排版行为零变化（8 函数逐字一致 + 全量测试 + 打印 E2E 同结果）；layout.js 已就位为 P31-03 plan() 决策表的唯一演进点。

#### P31-03 统一 QuestionLayoutPlan + 结构特征驱动
- modified：`layout.js` 新增 `plan(questions, ctx)` 纯函数与决策表常量表；新增 `tests/presentation/layout-plan.test.js`。
- deleted：`spanForLength` 50/26 单阈值（被决策表取代）；renderer.test.js L486-493 旧阈值断言**重写**（非删除）为决策表契约。
- 决策表（最小版，可在复现证据支持下微调，微调必须登记）：

  | 结构信号（既有字段） | density | span | 其他 |
  |---|---|---|---|
  | calc/fill/judge，题干短，无图，单输入，无选项或短选项 | compact | 1 | options=inline，break=auto |
  | choice/classify/apply 中等题干，中选项 | standard | 1（窄宽可 2） | options=two-column，break=auto |
  | 长选项（最长项超阈值） | standard | 1/2 | options=single-column |
  | 有 graphic（role=question-object 或 size≥medium）、geometry | expanded | full | graphic 按 size，break=keep |
  | 多空/多步/style=story、长应用题 | expanded | full | stem=block，break=keep |

- 规则：字符长度仅为信号之一；任何信号缺失按 `null/默认档 + 证据登记`，禁止猜数据。
- 过门：P31-01 每条复现题在 plan 单测中有对应断言；fitColumns 等旧 DOM 函数暂保留（P31-04/05 删）。

##### P31-03 执行记录（2026-10-06，结构特征决策表落地）

- 实际决策表（对草案的两处裁剪，依据用户过门拍板：single-column 无证据不做、多输入题 0 例不触发）：

  | 决策顺序 | 结构信号 | density | span | 其他 |
  |---|---|---|---|---|
  | ① | questionType=geometry，或 graphicGear∈{medium,large} | expanded | full | break=keep |
  | ② | style=story，或 apply 且 L≥50 | expanded | full | break=keep |
  | ③ | choice/classify | standard | L≥50 full / L≥26 span2(≤columns) / 否则 1 | options：n≥3 且最长项≥6 字 → two-column，否则 inline |
  | ④ | calc/fill/judge | compact | **恒 1**（长度永不驱动跨列，F 桶纠正） | options 同上；stem：response.layout=inline-after-equals → inline |
  | ⑤ | apply 短题 / 未知·Legacy DTO | standard | 保留长度档 50 full / 26 span2 / 1（直渲打印契约不变） | — |

  - graphicGear（描述符无顶层 size，I 桶映射）：diagram（brace/calculation-support）→ small；role=number-position / params.gridSize / 立体 subtype（cylinder/cone/sphere/cuboid）/ r+height → large；其余 type=geometry → medium；legacy render 出 `<svg` → medium；无图 none。
  - options 枚举仅 `inline｜two-column`（≥8 字选项全库仅 1 例，single-column 档不做）；optionMeta 兼容 options/distractors/data.options/data.distractors，对象项取 label||value。
  - plan(questions, ctx)：questions 接受数组或 {questions, meta}；ctx={mode, availWidth(缺省 718), columns, fixed}；meta.columns 即固定列模式强制 span1；输出 {columns, items[{index,density,span,stem,graphic,options,break}]}，纯函数、无 DOM。
- modified：layout.js（新增 plan/itemFor/spanToCss/graphicGear/optionMeta + 5 常量；fitColumns 与 print.buildFromQuestions 改消费 plan；spanForLength 降为 applySpanning 内部函数并移出导出）；print.js（buildFromQuestions 调 plan + spanToCss）；新建 tests/presentation/layout-plan.test.js（16 用例）；renderer.test.js 旧阈值断言重写；practice.html 注释、docs/06 SSOT 表行更新。
- deleted：spanForLength 公开导出（函数体 P31-05 随克隆链物理删除）；草案表中 single-column 档与多空触发 expanded（无证据，经用户拍板不做）。
- tests：layout-plan 16/16（含 seed=20261004 真实链重放：g1 geometry 全 expanded/full、g2 calc L≥42 样本全 compact/span1、g1 choice 出现 two-column）；presentation 146/146；npm test **670/670**（基线 654 +16）；bundle 重建与改前**逐字节一致**；check-all **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b 矩阵冻结均 PASS——题目内容零影响实跑证明）；真实 Chrome E2E 1-6/8/9 全过（打印 10/10、零 JS error），step7 既存失败同 P31-02 登记、无新增回归。
- 结论：P31-01 六桶（A/B/F/G/H/I）在决策表中逐条有真实信号与对应断言；字符长度降级为标准档/未知 DTO 信号。density/stem/options/graphic/break 五字段中目前仅 span 被生产 HTML 消费，其余字段消费者在 P31-04/07 接线（规则要求每个字段在当批任务内有真实消费者——各字段均在 layout-plan 契约测试中锁定产出，HTML 消费随 WIRE/VISUAL 分批接通，不断言未产出的消费）。
- 遗留：fitColumns 仍渲染后改 DOM（P31-04 删）；克隆链 gridColumnsFromDom/applySpanning 仍旧长度度量（P31-05 删，过渡期 geometry 等新档位在克隆链可能不一致）；expanded 视觉达标在 P31-07/08 Chrome 取证。

### 阶段三 · P31-WIRE 出口接线

#### P31-04 Screen/HTML 统一消费 plan，删除渲染后二次排版
- modified：`renderer.js` renderAll 先算 plan 并透传每 item；`html-renderer.js` render/renderGrid 消费 columns/span/density/stem/options/graphic 模式（class 白名单，沿用 P28-23 校验口径）；选项容器输出 mode 类；`practice.html` finalizeRender 删除主链 fitColumns 与事后 gridColumn/justifySelf 改写。
- deleted：主链 DOM 事后排版；html-renderer 内**纯视觉目的**的题型分支（语义渲染分支如 judge 控件保留）。
- 保持：exam 非网格直挂；固定列 span 1；分批 8 个插入的渐进揭示机制。
- 测试：renderer.test.js 增加「plan 字段真实被 HTML 消费」断言（类名/data 属性）；门禁 10/12。

##### P31-04 执行记录（2026-10-06，渲染期接线 + 主链事后排版物理删除）

- modified：
  - `shared/presentation/renderer.js`：renderAll 渲染前先调 `QuestionLayout.plan(list, {mode, availWidth, columns, fixed})`，每题档位经 extra 透传 render→html-renderer：`span=spanToCss(pi.span)`、`layoutDensity/stem/optionsMode/graphicGear`；renderGrid 列数改取 `plan.columns`。**契约保持**：调用方显式 `spans[i]` 优先于 plan.span（print 直渲链零变化）；`fixed:true` 时不输出列跨（P28-UI-PRINT-WYSIWYG-01 固定列契约，print.js 同步透传 fixed）；档位仅出 HTML class，不进 RenderResult 契约。
  - `shared/presentation/html-renderer.js`：新增 4 条档位 class 白名单（P28-23 口径）：`density-{compact|standard|expanded}`、`stem-{inline|block}`（卡类）、`options-{inline|two-column}`（选项容器 mode 类）、`graphic-{small|medium|large}`（.question-graphic 容器，none 不输出容器类）；白名单外一律不进 class（注入断言覆盖）。renderGrid 容器 inline style 增 `grid-auto-flow:row dense`（接替 fitColumns 网格回填语义；`.q-grid` CSS 规则消费 `--grid-cols` 不变）。
  - `shared/presentation/print.js`：buildFromQuestions 向 renderAll 透传 `fixed`；两处克隆链注释改址（applySpanning 待 P31-05 删）。
  - `practice.html`：finalizeRender 物理删除 `QuestionLayout.fitColumns(area, set, a4PrintableWidthPx('math'))`（主链渲染后零 DOM 改写）；排版注释更新。a4PrintableWidthPx 保留（updateCountTip 估算推荐题量仍消费）。
  - `shared/presentation/layout.js`：**物理删除 fitColumns**（函数+导出，零消费者）及相关注释；gridColumnsFromDom/applySpanning 暂存注释更新（P31-05 删）。
  - `tests/presentation/renderer.test.js`：新增 4 条消费断言（renderAll 档位/span/容器列数进成品 HTML；graphic-* 类 + 白名单外拒绝；renderGrid dense；fitColumns 导出已删）。
  - `docs/06-PRESENTATION.md`：屏显列数口径行更新为渲染期 plan 决策。
- deleted：`fitColumns`（layout.js 函数与导出整体删除，practice.html 唯一调用点同步删除）；主链渲染后二次排版（事后 gridColumn/justifySelf/gridTemplateColumns 改写）。
- tests：presentation 定向 **150/150 PASS**（146+4）；`npm test` **674/674 PASS / 0 FAIL**（670+4）；重建 presentation bundle **与改前逐字节一致**（renderer/html-renderer/print/layout 均走 DEFERRED 不进 bundle 图）；`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a/6b PASS）；真实 Chrome 9 步 E2E：1-6/8/9 全过（打印 10/10、零 JS error），step7「请求参数保持」既存失败同形（首次运行 exit 2 为 Chrome DevToolsActivePort 启动抖动，重试即复现常规结果）。
- 结论：plan 五字段中 density/stem/options 已由 html-renderer 以 class 真实输出（CSS 消费在 P31-07/08），graphic 档位类随 .question-graphic 容器输出，span 内联注入（既有）；屏幕列数唯一来源 = renderGrid 注入 `--grid-cols`（plan.columns），主链渲染后不再改 DOM。html-renderer 未删纯视觉题型分支——现有题型分支（judge 控件、inline-after-equals、print 留空）均为**语义/形态分支**，非纯视觉，按任务书「语义渲染分支保留」口径不动。
- 遗留：克隆链 gridColumnsFromDom/applySpanning（P31-05 物理删除并统一 plan）；density-*/stem-*/options-*/graphic-* 的 CSS 消费（P31-07/08）；`practice.html` renderGeneric 第二渲染器（P31-06）。

#### P31-05 Print 双路径统一消费同一 plan + 分页
- modified：题集渲染时缓存 plan（按题集对象/指纹，页面与 PracticeSession 可取）；克隆链与直渲链均从缓存取 columns/span/break；print.js 只保留 A4、页边距、字号、行高、打印色、page-break；`updateCountTip` 间距改读 Print.LAYOUT/tokens。
- deleted：`gridColumnsFromDom`、`applySpanning`（克隆 DOM 二次度量，物理删除）；PRINT_QCSS 中列数/跨列决策与重复题卡规则。
- 分页：compact `break-inside:auto` 连续排；standard/expanded `break-inside:avoid`，expanded（题干+图+选项+作答区）最高优先不跨页。
- 验收：真实 Chrome 打印 G1/G3/G5 样卷——不拆题、图不溢出、不横向溢出；屏幕 718px 与打印逐题列数/span 一致。

##### P31-05 执行记录（2026-10-06，已过门禁待用户确认）

**① plan 缓存（layout.js）**：新增 `planFor(questions, ctx)`——WeakMap 按题集对象引用 + 决策面指纹 `mode|availWidth|columns|fixed|meta.columns`；同题集对象 + 同决策面返回同一结果对象。消费者与证据：
| 消费点 | 键 | 证据 |
|---|---|---|
| renderer.renderAll（渲染期写入） | `{mode: ro.mode, availWidth, columns, fixed}` | 定向测试「renderAll 经 planFor 取数」 |
| print.buildFromQuestions（直渲链） | `{mode:'print', availWidth:718, columns, fixed}` | planFor 与 plan 输出同值断言；E2E step9 |
| practice-session.print()（克隆链列数） | `{mode:'print', availWidth:718}`（exerciseSet 对象） | planFor 缓存命中测试；克隆链 opts.columns |
| practice.html updateCountTip（推荐题量列数） | `{mode:'print', availWidth:718}`（主链 lastSemantic.questions / 回落 exerciseSet） | 与打印链同键同值 |

**② 克隆链零二次度量**：`buildPrintHtml` grids 循环重写——列数优先级 = 源 DOM 内联 `--grid-cols`（renderAll/renderGrid 渲染期产物）> `.q-grid cols-N` 类（renderGeneric 降级链）> options.columns > 3；每卡 `grid-column` 随克隆 cssText 保留，不再重算。**物理删除**：`gridColumnsFromDom`、`applySpanning`（layout.js 函数+导出）、`spanForLength`（失去最后消费者）、`PRINT_ROUTES`（math.beforeClone 列数覆写）与 `options.pageType`（practice-session/practice.html 三处调用同步删）。

**③ 分页决策表（PRINT_QCSS + html-renderer 内联）**：
- `.density-compact { page-break-inside:auto }`（连续排）；`.density-standard/.density-expanded { avoid }`（不拆卡）；无档位卡（fixed 模式/克隆链降级产物）兜底整卡 avoid。
- expanded 最高优先：渲染期 `plan.break='keep'` → html-renderer 卡内联 `page-break-inside:avoid;break-inside:avoid`（白名单：仅 'keep' 输出，'auto'/缺省/敌意串不进 style）。
- 删无差别 avoid 与 P3.3 `:not(:has(.question-graphic))` 兜底（由三档取代，测试断言 `:has(` 不回归）。

**④ updateCountTip 单一间距源**：`PRINT_GAP`/`PRINT_CARD_PAD` 删硬编码 `'8px 6px'`/`'6px 8px'`，改读 `Print.tokenVal()`（新导出，cssTokenVal 公开：浏览器 getComputedStyle tokens.css 真值 / Node 契约兜底字面量）；列数改经 planFor。

**⑤ 测试**：presentation 定向 **156/156**（+6）；`npm test` **680/680**；presentation bundle 重建 hash 不变（bac0423c…，改动文件不在 bundle 图）；`check-all` **29 PASS / 0 FAIL / 1 SKIP**；真实 Chrome E2E 1-6/8/9 全过（step9 打印 10/10），step7「请求参数保持」既存失败同形。

**⑥ G1/G3/G5 样卷打印验收（一次性 /tmp 探针，真实 PracticeSession 生成链）**：

| 卷 | 题数 | 屏(718)打逐题一致 | columns | density 分布 | expanded 内联 avoid | 三档 CSS | Chrome 出 PDF |
|---|---:|---|---:|---|---|---|---|
| G1 | 14 | ✓ | 1 | compact 3 / expanded 11 | ✓ | ✓ | ✓ 156KB |
| G3 | 15 | ✓ | 1 | compact 3 / standard 3 / expanded 9 | ✓ | ✓ | ✓ 163KB |
| G5 | 15 | ✓ | 1 | compact 3 / standard 3 / expanded 9 | ✓ | ✓ | ✓ 179KB |

取证：`/tmp/p31-g1.pdf`、`/tmp/p31-g3.pdf`、`/tmp/p31-g5.pdf`（headless `--print-to-pdf`，真实分页渲染，供目测「不拆题/图不溢出/不横向溢出」）。G1 无 classify ALLOW KP（KCV 矩阵数据事实，如实缺省未编造）。columns=1 为 plan 决策表对长题集合（中位卡宽超 718px）的合法输出，非回归。

#### P31-06 fallback 并入统一显示链
- modified：错题本/重做 raw 题集改走 `PresentationRenderer.renderAll`（Legacy 兼容契约）；在 `html-renderer.js` 内新增唯一 `renderEmergency(q,i)`（单列、题号+纯文本题干+标准作答 input，无图时文本占位）；主链 try/catch 仅在渲染异常时启用它；plan 自身异常回退安全单列 plan（columns=1, 全 compact）。
- deleted：`practice.html` `renderGeneric` 整个函数及重复 judge 模板。
- 测试（新增/扩展）：①正常；②SVG 失败（status≠SUCCESS）题目仍完整显示；③Renderer 异常 → emergency；④plan 异常 → 安全单列。**安全降级只有一个入口**，禁止 catch→''。
- 风险（本战役最高）：错题本/重做绑定链须真实浏览器回归（答案收集、radio 同组、回车批改、焦点、计时）。

##### P31-06 执行记录（2026-10-06）

- modified：
  - `shared/presentation/html-renderer.js`：新增唯一应急渲染 `renderEmergency(q,index)`（+内部 `emergencyPromptOf`，题干字段面与 layout.coreText 同源：prompt/content.prompt/question.prompt/stem/q/text/question 字符串），契约=单列普通卡+题号+纯文本题干+标准作答 input（data-index 保障答案收集/批改绑定）；原题带图形描述符时输出文本占位「（图示略）」，SVG 一律不渲染；加入 API 导出。
  - `shared/presentation/renderer.js`：renderAll 内 ①`planFor` 包 try/catch，异常 → 新增 `safeSingleColumnPlan(n)`（columns=1、items 全 compact/block/none/inline/auto），排版决策失败不阻断渲染；②单题 `render` 包 try/catch，异常 → `RenderResult.create(q, HTMLRenderer.renderEmergency(q,i), '')` 唯一应急出口，禁 catch→''；头注释补 P31-06 契约行。
  - `practice.html`：lastSemantic.html 缺失分支改调新增 `renderRawSetHtml(set)`——raw 题集（RenderFormat Legacy DTO）经 `q.__semantic` 取原始 SQ（缺引用极端数据回落原对象）走 `PresentationRenderer.renderAll(qs,{mode:'screen'},{availWidth:a4PrintableWidthPx()})`；P3-R04 注释更新。
  - `tests/presentation/renderer.test.js`：+4 用例（①Legacy DTO __semantic 经 renderAll 正常渲染：三卡/data-index 连续/choice 真实 radio/judge 同组 radio name=qN value=true；②未知 graphic type → _gfxStatus≠SUCCESS 且题干/作答完整、无 svg 注入不吞题；③monkey-patch HTMLRenderer.render 抛错 → 应急卡无 question-options、纯文本题干、每题一个标准 answer-inp、data-index 保留、产物非空；④monkey-patch planFor 抛错 → --grid-cols:1、无跨列、全 compact、渲染不中断）。
- deleted：`practice.html` `renderGeneric` 整函数（含重复 judge 模板、`=`尾缀正则内联识别、q-grid cols-N 手拼、calcOptimalCols 直调）——物理删除无残留。
- reason: P31-05 过门经用户确认后继续阶段三 WIRE 收口。raw 题集转正后错题本/重做与主链共用唯一渲染链（plan 档位类/列跨/分页随 renderAll 注入，重做轮排版质量与生成轮同源）；html-renderer `promptOf` 只认 SQ 字段面，故页面经 `__semantic` 引用取 SQ 渲染（P31-01 证据④口径）；choice/judge 在重做轮首次获得与主链一致的控件（旧 renderGeneric choice 退化为文本框）。应急与安全单列均收在 presentation 层唯一入口，页面零兜底拼接。
- tests: ①presentation 定向 **160/160**（156+4）；②`npm test` **684/684 / 0 FAIL**（680+4）；③重建 presentation bundle（html-renderer/renderer 不在 bundle 图，产物与改前逐字节一致），check-all 16/17 PASS；④`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 真实生成、6b 矩阵冻结 PASS，基线 375/98/373/1570 零变动）；⑤真实 Chrome 9 步 E2E：1-6/8/9 全过（step9 打印 10/10、零 JS error），step7「请求参数保持」HEAD 既存失败同形（P31-02 起已登记，stash 回 HEAD 复现同败，非本任务引入）；⑥**错题本/重做真实 Chrome 回归**（本任务最高风险项，http.server 真机走查，选择器排除 #printMeasure 克隆污染）：生成 20 题（focus 落首输入框、计时走）→ 全错批改 0/20 → 错题重做 → 网格 `.questions-grid.q-grid.cols-2` 20 卡、data-index 0..19 连续无重复、空题干 0、首卡带 `density-expanded stem-block style-shape` + `grid-column:1 / -1;page-break-inside:avoid`（plan 档位在重做轮真实生效，旧 renderGeneric 产不出）→ 回车批改报「当前状态不允许提交」→ **git stash 回 HEAD 对照复现同败**（详见登记项）。
- risk: ①**登记（HEAD 既存断链，非本任务引入）**：重做轮回车批改必报「批改出错 当前状态不允许提交」——`practice.html check() → PracticeBridge.submit() → _session.submit()`，首轮批改后 session 停在 CHECKED，`redoWrong()` 只复位页面状态不复位/不新建 PracticeSession；stash 回 HEAD（renderGeneric 仍在）真机复现同败，A/B 证据齐。属 P30 类断链（practice-session/bridge），P31 禁改边界内不顺手修，待用户裁决另立任务。②重做轮 choice/judge radio 同组互斥为浏览器原生行为，本轮取样集无选择/判断题入错题，radio 结构契约由 Node 用例①（name=qN 同组/value=true|false）+ 主链 E2E step5+6（7 题型全出现）双覆盖；③粗粒度 DOM 统计（`#problemsArea .question-card`）会被 updateCountTip 的 #printMeasure 克隆卡污染（HEAD 起既存），登记给后续排查参考；④未 git commit。

### 阶段四 · P31-VISUAL 视觉收口

#### P31-07 SVG/选项/作答区排版接线
- modified：plan.graphic 只读 descriptor 的 size/role → `.question-graphic` 尺寸/居中类；选项三档 mode 类落 CSS；作答框 96×32 屏幕保持、打印缩放走 token。
- 禁：改 SVG renderer / Sanitizer / descriptor；新增 Presentation→Generator 调用边（GraphicRenderer 门面现状不动）。
- 测试：门禁 11 SVG 契约全过；带图题在三档 density 下的类名断言。

##### P31-07 执行记录（2026-10-06）

- modified：
  - `shared/styles/tokens.css`：新增 5 token——`--graphic-w-small:120px`（diagram brace/支撑示意图）/`--graphic-w-medium:220px`（平面几何）/`--graphic-w-large:360px`（number-position 网格/立体，expanded 通栏卡内居中）；`--answer-w-print:72px`、`--answer-h-print:30px`（打印 inline 空白盒）。
  - `shared/styles/components.css`：`.question-graphic svg` 加 `display:block;margin:0 auto`（档位下稳定居中）+ 三条档位规则 `.graphic-small/medium/large svg { max-width:var(--graphic-w-*) }`（无档位类保持 100% 上限）；`.question-options.options-two-column` → `display:grid;grid-template-columns:repeat(2,minmax(0,1fr))`（inline 档继承既有 flex 流式，不写空规则）。屏幕 `.answer-inp` 96×32 原值不动。
  - `shared/presentation/print.js`：`PRINT_TOKEN_DEFAULTS` 同步 5 token（Node/无样式回落，值锁定与 tokens.css 同源）；PRINT_QCSS 直渲文档同步图形三档（cssTokenVal 拼字面量，直渲文档不引 tokens.css）、svg 居中、`.options-two-column` 两列网格（与 components.css 同规则字面）；`.answer-inp-inline` 72/30 硬编码改走 `--answer-w-print/--answer-h-print`。
  - `tests/presentation/renderer.test.js`：头部补 require `svg-diagram.js`（diagram brace 真实渲染前置）；+5 用例（见 tests）。
- deleted：无。
- reason: P31-06 过门经用户确认后进入阶段四 VISUAL。P31-04 渲染期已注入 graphic-*/options-* 类但 CSS 零消费（P31-01 字段-消费者矩阵登记的缺口），本任务接通唯一消费者链：尺寸唯一真相 tokens.css，components.css（屏幕）与 PRINT_QCSS（打印直渲）同规则；克隆链复制页面 stylesheet 自然继承。**口径取舍（依 P31-03 过门锁定，不另行解释）**：任务书字面「选项三档」与 P31-01 证据③/P31-03 决策冲突——≥8 字选项全库仅 1 例，single-column 不做，枚举仅 inline｜two-column，CSS 只接两档（html-renderer 白名单也只输出两档）。未改 SVG renderer/Sanitizer/GraphicRenderer 门面/descriptor 结构（红线遵守）；density-* 屏幕视觉（字号/间距）与 stem-* 留 P31-08 视觉微调（density 真实消费者：打印分页三档 P31-05 已接通；stem 消费在 html-renderer 的 eq-answer 结构分支）。
- tests: ①presentation 定向 **165/165**（160+5）：三档 density 带图类名共存（真实 SUCCESS 描述符：calc/choice+diagram brace→compact/standard+small，fill+square→expanded+medium，geometry+cylinder→expanded+large）；components.css 消费者存在性（三档 svg 规则+var token、two-column grid、屏幕 96×32 保持正则）；tokens.css 5 定义；Print.tokenVal 5 兜底同源；Print.buildFromQuestions 直渲文档含三档 max-width 字面量+两列规则+inline 72×30。②`npm test` **689/689 / 0 FAIL**（684+5）；③重建 presentation bundle，check-all 16/17 PASS（hash 一致：print.js 不在 bundle 图）；④`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（11 SVG 契约、12 security PASS；6a/6b 1570 零影响）；⑤真实 Chrome 9 步 E2E：1-6/8/9 全过，step7「请求参数保持」既存失败同形；⑥**Chrome 目测取证**（一次性 /tmp 探针，真实 PracticeSession 链 128 题取样：g4 `math-g4-down-u01-k001` picture-equation 定向补 small 桶——diagram 唯一绑定 KP（generator-registry 核实）；g1/g3 geometry large/medium；g1/g2 choice two-column；g1 calc compact 对照）：屏幕 718px `/tmp/p31-07-screen.png`——large 立体图≈360px 上限居中、medium 几何 220px、small brace 120px 克制、算式选项 A B/C D 整齐两列、calc compact inline 框；A4 `/tmp/p31-07-print.pdf` 首页转图 `/tmp/p31-07-print-page.png`——三档分级与屏幕同源、去卡片虚线分隔正常。
- risk: ①尺寸取值（120/220/360）为视觉微调初值，P31-09 G1-G6×7 题型矩阵目测时可调（只动 token，不碰规则）；②graphic-small 真实生产者仅 picture-equation（g4-down-u01-k001，apply/calc）与 stats.js（统计 KP），低年级常规卷不可见——非死代码（1570 真实链有产出，128 题取样 brace SUCCESS 12 例），档位规则属正式接线；③探针另观察到 g1 geometry 取样中「看线段图：第一条线段表示 7…」题 NO-DESC（q.graphic/q.data.graphic 均缺，241 题混合取样时 38 题无描述符）——属 P30 类语义断链候选，本任务只登记不顺手修；④未 git commit。

#### P31-08 CSS 与 practice.html 样式物理清理 + 视觉微调
- 视觉目标（微调，非重设计）：
  - 题号：三处圆徽章 → 统一「1.」纯文本（屏幕浅深色以 tokens 为准，打印同形）。
  - 卡片：padding 12-16px、弱边框、radius 6-8px、阴影取消或极弱、无复杂 hover；打印 padding 6px 8px、边框进一步弱化。
  - 题干：17px、font-weight normal/medium、line-height 1.6（删全局 800 粗体）。
- 归位：网格规则只在 pages.css（`--grid-cols` 由 plan 注入，保留 <480px 单列）；题卡视觉只在 components.css；尺寸/间距/字体只在 tokens.css（`--q-grid-gap`、`--card-padding-screen/print` 等）；practice.html 题目组件内联样式清零（仅留宿主/进度等页面专属）；打印规则唯一地（pages.css @media print 与 PRINT_QCSS 去重）。
- 禁：任何按钮/导航/首页/二三级页面样式改动。
- 验收：屏幕 + A4 打印目测对照本任务书；门禁 10。

##### P31-08 执行记录（2026-10-06）

- modified：
  - `shared/styles/tokens.css`：+4 视觉 token——`--card-radius:8px`（任务书 6-8px）、`--stem-size:17px`、`--stem-line-height:1.6`、`--stem-weight:600`（normal/medium 取 medium；打印纸张 15px 不经此 token）。
  - `shared/styles/components.css`：①`.question-card` border-radius 10px→`var(--card-radius)`；②圆徽章块（22×22/50%/brand-bg/800）替换为唯一纯文本规则 `.question-card .num{display:inline-block;min-width:1.6em;font-weight:var(--stem-weight);color:var(--ink)}` + `.num::after{content:'.'}`（句号纯视觉，.num DOM 文本仍为纯数字，html-renderer/emergency 契约零改动）；③`.question-stem` 15px/1.5/600→三值全走 token；删重复的 `.question-stem .num`（800/#1A1B1C）；④新增 `@media screen` 块承接自 practice.html 迁入的 `.question-answer{border-bottom:none}` 与 `.answer-inp{border-style:solid;border-width:1.5px}`（media 边界原样保持，打印克隆在 print media 不命中）；⑤新增批改反馈规则（fb-line/fb-explain/fb-mis + `.question-card.correct/.wrong .feedback` ok/bad 类驱动）。
  - `shared/styles/pages.css`：`.q-grid{gap:14px}` 与综合练习段 `.questions-grid{gap:18px 25px}` 两处网格声明归并为唯一规则 `.questions-grid,.q-grid{display:grid;gap:var(--grid-gap-screen);grid-template-columns:repeat(var(--grid-cols,1),minmax(0,1fr));margin:15px 0}`；两处 <480px 单列断点合并为一（含 q-badge 窄屏转内联）；删 `#problemsArea … .question-card{text-align:left!important;padding:…!important}` 覆写（基础规则已承担）。
  - `shared/presentation/print.js`：克隆链 cloneCss 圆徽章覆盖**整条删除**（components.css 纯文本规则随页面样式复制自然继承，屏打同形）；PRINT_QCSS 直渲链 `.question-stem .num` 22×22 灰底圆徽章替换为自持字面量纯文本规则 + `::after{content:'.'}`（直渲文档不引 components.css）；打印题干 15px/1.5/600 纸张口径保持不动。
  - `practice.html`：`@media screen` 题目组件内联段 4 组（question-answer 去线/answer-inp 实线/.num 灰底圆徽章/feedback fb-*）物理清零并留迁移注释；markQuestions 两处 `fb.style.color` 渲染后内联删除（卡 correct/wrong 类驱动）。
  - `tests/presentation/renderer.test.js`：+6 用例（见 tests）。
- deleted：①`.q-text` 死规则整块（renderGeneric P31-06 物理删除后 grep 全库 js/html 零生产方，死代码门禁 21 同批 PASS 三方印证）；②圆徽章视觉 3 处（components 屏幕块、print.js 克隆链整行、PRINT_QCSS 直渲块）；③`.question-stem .num` 重复题号规则；④pages.css 裸网格声明 1 处 + 重复 480 断点 1 处 + 题卡 !important 覆写 1 处；⑤practice.html 题目内联 CSS 4 组 + JS 内联 2 处。
- reason: P31-07 过门经用户确认后继续阶段四 VISUAL。任务书视觉目标（题号纯文本「N.」/卡 padding 12-16 弱边框 radius 6-8 无阴影/题干 17px normal-medium 1.6 删 800）+ 三表职责归位（网格只在 pages、题卡视觉只在 components、尺寸字体只在 tokens、practice.html 题目内联清零、打印规则去重）。句号经 ::after 纯视觉生成，遵守锁定决策「DOM 中 .num 文本内容不变」。卡片现状本无 box-shadow/hover（grep 印证），「阴影取消」零改动即达标；打印去卡片化（padding 6px 8px、无边框）P31-05 起即如此，未动。未碰任何按钮/导航/首页/二三级页面样式；未碰 SVG/题型/难度/题面。
- tests: ①presentation 定向 **171/171**（165+6：4 token 定义；圆徽章在所有 .num 规则块物理消失断言（无 50%/background/22px）+::after 句号+q-text 死规则零残留+题干三 token 无 800；@media screen 迁入两规则+反馈三行+correct/wrong 类驱动+96×32 保持；pages 网格归并/无裸声明/480 仅 1 处/无 !important 覆写；print.js 源码无徽章+直渲文档实证纯文本/::after/题干 15px 保持；practice.html 四选择器与 fb.style.color 清零+DOM `.num` 纯数字无句号契约）；②`npm test` **695/695 / 0 FAIL**（689+6）；③重建 presentation bundle，16/17 PASS（hash 一致：print.js 不在 bundle 图，CSS/HTML 不入 bundle）；④`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（门禁 10 renderer、21 dead-code、22 legacy 全 PASS；6a/6b 1570 零影响）；⑤真实 Chrome 9 步 E2E：1-6/8/9 全过（step9 克隆链打印含新题号零 JS error），step7 既存失败同形；⑥**Chrome 目测取证**（复用 P31-07 真实链 128 题探针重生成 `/tmp/p31-08-screen.html`/`-print.html`，三档图形/两列选项/compact 对照样本不变）：屏幕 `/tmp/p31-08-screen.png`——「1.」…「11.」纯文本题号（两位题号 min-width 对齐）、圆徽章全消失、题干 17px/1.6 medium 不再粗黑、卡片 8px 圆角弱边框无阴影、作答框实线无下划线、图形三档与选项两列保持；A4 `/tmp/p31-08-print.pdf`（首页转图 p31-08-print-page.png）——题号屏打同形纯文本、题干保持 15px 纸张口径、虚线分隔与图形档位保持。
- risk: ①综合练习（math-comprehensive）`.questions-grid` 间距 18px 25px→14px（归并后统一 token），属任务书许可微调，P31-09 G 矩阵目测时复核，若该页确需更宽间距应作为页面专属规则留在 pages.css（不再恢复网格重复声明）；②题卡 !important 覆写删除以「唯一生产方 html-renderer/emergency 不写内联 text-align/padding」为证据（spanStyle 仅注入 --grid-cols/grid-column/break），若遗留旁路产出内联居中卡会回归——E2E step5+6 七题型与错题重做（P31-06 真机取证）均过；③题干屏幕 15→17px 为任务书指定值，打印 15px 系 P31-05 锁定纸张口径、本轮刻意不跟随；④未 git commit。

### 阶段五 · P31-ACCEPT 验收冻结

#### P31-09 真实题目验收矩阵
- G1-G6 每年级抽 7 题型真实生成，按下表覆盖（短/中/长按题干与选项结构取）：

  | 题型 | 短 | 中 | 长 | 带 SVG | 打印 |
  |---|---:|---:|---:|---:|---:|
  | calc | ✓ | | | | ✓ |
  | fill | ✓ | ✓ | | | ✓ |
  | choice | ✓ | ✓ | ✓ | | ✓ |
  | judge | ✓ | | | | ✓ |
  | geometry | | ✓ | ✓ | ✓ | ✓ |
  | classify | | ✓ | ✓ | | ✓ |
  | apply | | ✓ | ✓ | 可有 | ✓ |

- 每题查：题号/题干/选项/作答区/SVG/间距/列数/分页；screen（718px）/print/emergency 三路径内容一致；错题本/重做专项回归；真实 Chrome 出 PDF 取证。

##### P31-09 执行记录（2026-10-06，零代码改动，纯验收取证；探针/产物在 /tmp/p31-09 不落仓库）

- **矩阵覆盖**（真实 PracticeSession 链，seed=20261009，每 KP count=8、每题型轮转 ≤8 个 ALLOW KP；短/中/长按 Layout.renderLen SSOT 信号分桶 <26 / 26–49 / ≥50）：合计 **63 题**（G1=8 / G2=10 / G3=11 / G4=12 / G5=12 / G6=10）：

  | 级 | calc | fill | choice | judge | geometry | classify | apply |
  |---|---|---|---|---|---|---|---|
  | G1 | 短 | 短中 | 短 | — | 中长 | — | 中长 |
  | G2 | 短 | 短中 | 短中 | 短 | 中长 | 长 | 中 |
  | G3 | 短 | 短中 | 短中 | 短 | 中长 | 长 | 中长 |
  | G4 | 短 | 短中 | 短中长 | 短 | 中长 | 长 | 中长 |
  | G5 | 短 | 短中 | 短中长 | 短 | 中长 | 长 | 中长 |
  | G6 | 短 | 短中 | 短中 | 短 | 中长 | — | 中长 |

- **缺口登记 13 条（如实登记不编造，P30 数据铁律）**：G1 judge 与 G1/G6 classify 无 ALLOW KP；classify「中」桶 G2–G5 均缺（classify 题干结构恒长，真实链无 26–49 样本）；choice「长」桶 G1/G2/G3/G6 缺、choice「中」G1 缺；apply「长」G2 缺。全部为真实链长度桶/资格事实，非渲染缺陷。
- **三路径逐题断言：FAILS=0**（63 题 × 8 项 + 三路径一致性，探针 /tmp/p31-09-accept.js）：①题号 .num 纯数字=位置+1、data-index 连续（screen/emergency 双路径）；②题干 screen==print 归一逐字相等，emergency 同源（inline-after-equals 题屏端去「= ?」尾缀呈前缀关系，符合 P31-06 契约）；③choice 选项文本 screen==print 相等 + radio 同组 name=qN + two-column 类随 plan；judge 双 radio /「正确（　）错误（　）」；④作答区三路径齐备（emergency 标准 input.data-index）；⑤SVG：SUCCESS 样本屏打 **同串** + graphic-small/medium/large 档位类随 plan + emergency「（图示略）」不渲染 SVG；⑥density 类==plan.items；⑦列跨内联==plan（span1 同样内联 `grid-column:span 1`，P31-04 起白名单既定行为，171 定向测试佐证）；⑧--grid-cols==plan.columns（1..4）、expanded 内联 `page-break-inside:avoid`（break:keep）、print 文档分页三档 CSS（compact auto / standard avoid / expanded avoid）在位。
- **SVG/描述符登记**：geometry/apply 带描述符样本全部 SUCCESS 屏打同串；**2 条 NO-DESC**（G1 geometry 长「看线段图…」、G2 geometry 中）——q.graphic/q.data.graphic 缺失，P30 类断链候选，只登记不顺手修（与 P31-07 探针登记同源）。
- **Chrome 取证**（/tmp/p31-09/）：G1–G6 screen 截图 ×6（718px 真实 tokens/components/pages 三 CSS：题号「N.」纯文本、题干 17px/1.6、卡 8px 圆角弱边框、图形三档分级、选项两列、judge 双按钮）+ print PDF ×6（`--no-pdf-header-footer`，sips 首页转图：屏打同形题号、15px 纸张题干、去卡片虚线分隔、图形三档/两列/judge 判断区/inline 空白盒）+ emergency 合页截图 ×1（G1–G6 全部应急卡：单列、纯文本题干、（图示略）、标准输入框、无 SVG 无选项容器）。
- **错题本/重做专项回归（Node 级，/tmp/p31-09-redo.js，镜像 practice.html renderRawSetHtml P31-06 转正链）：FAILS=0**——raw DTO `__semantic` 引用 12/12 齐全；重做轮 HTML 与生成轮**逐字节一致**（同源转正）；错题子集（5 题）data-index 0..4 连续重排；choice radio 同组 name=qN、judge 双 radio（重做轮定向集各验一轮）；density-*/style-* 档位类重做轮真实存在。重做轮回车批改「状态不允许提交」为 HEAD 既存断链（P31-06 登记，practice-session/bridge 层），不属渲染路径，维持待用户裁决。
- **门禁**：`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（5 npm test 695、6a 1570 真实生成 + 6b 矩阵冻结=基线零变动、10/11/12/21/22、16/17 bundle 确定性全 PASS；375/98/373/1570 零变动）。另带 CHROME_BIN 实跑第 15 项：**8.5/9 步过、零 JS error**，step7「请求参数保持」既存失败同形（P31-02 起 risk 字段登记：非本战役引入，疑似两次请求 seed/画像差异，另行立项），其余步骤含打印 10/10 全过。
- risk: ①本任务零代码改动，无回归面；②矩阵 13 条长度桶缺口与 2 条 NO-DESC 为数据面事实，供 P31-10 收口及后续战役裁决；③探针 span1 断言初版口径错误（误期 span1 无内联列跨）已按真实白名单行为修正，生产代码无任何改动；④未 git commit。

#### P31-10 物理清理 + 重冻 + 最终门禁
- 死符号/死 CSS 类三方印证后物理删除（check-dead-code=门禁21、check-legacy=22、检索）；重建 presentation bundle（如受影响含 strategy bundle）过 16/17；
- `npm test`（用例数变化在日志如实记录）→ 6a/6b 证明 1570 题目内容零影响 → `node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP（CI 30/0/0）**；
- docs/P31/change-log.md 收口；不自动 git commit。

##### P31-10 执行记录（2026-10-06，P31 战役收口任务）

- modified：
  - `shared/presentation/layout.js`：`calcOptimalCols` 删 `set.meta.columns` 优先行；`plan()` 删 meta 提取与 `meta.columns` 列数/fixed 表达式（`ctx.fixed`/`ctx.columns` 显式能力保留）；`planFingerprint` 删 meta 第 5 项（恒 ''，缓存命中语义不变）；注释同步。
  - `shared/presentation/html-renderer.js`：删 `style-*` 固定样式类输出 3 行（含 P28-23 白名单注入行）；sq.style 字段保留（strategy 层 SSOT 不在 P31 范围）。
  - `shared/engine/practice-session.js`：**物理删除 `openWrongBook` 整方法**（全库零调用三方印证）；连带删除 StorageManager 依赖声明（唯一消费者即 openWrongBook）与头注释行；`print()` 删 `meta.columns` fixedCols 读取（openFromQuestions 简化为仅 title，克隆链 cols 直取 planFor）。
  - `practice.html`：finalizeRender 删 `meta.exam` 死分支（三分支归二，meta.exam 全库零写入方）；`updateCountTip` 删 fixedCols 读取；2 处注释更新（style-* → plan 档位类）。
  - `shared/styles/pages.css`：**物理删除期末模拟卷死 CSS 13 行**（`.exam-paper`/`.exam-part`/`.exam-part-title`/`.exam-part-items`/`.q-wrap`——meta.exam 死形态配套，全库 js/html 零类名引用三方印证）。
  - `tests/presentation/layout-plan.test.js`（2 用例随证据改口径：meta.columns 断言删，ctx.columns/ctx.fixed 断言保留）、`tests/presentation/renderer.test.js`（1 断言改：对象形态列数==数组形态动态列数）。用例数 695 不变。
- deleted：`openWrongBook`；`meta.exam` 读取分支 + 期末卷死 CSS；`meta.columns` 数据面三处读取（layout/practice-session/practice.html）；`style-*` 类输出；StorageManager 依赖声明。**无 shim/别名/兼容层。**
- 登记（不删，范围外）：`ResultCollector`/`LearnerStorage`/`PracticeResult`/`PresentationRenderer` 四个依赖声明为 **HEAD 既存零引用**（git show HEAD 对照印证，非本次引入；engine 层 learner/result 链，P31 授权范围外，留后续裁决）；`.comprehensive-grid` 已在 P31-02/05 迁移与克隆链删除中物理消失（本轮全库零匹配，无动作）。
- 三方印证方式：全库 grep（生产+测试+页面）+ 门禁 21 check-dead-code + 门禁 22 check-legacy + npm test 全过。
- tests：①presentation 定向 **171/171**；②`npm test` **695/695 / 0 FAIL**（用例数与 P31-08 持平：仅口径改写未增删用例）；③重建 presentation bundle（layout.js 在 bundle 图内，25 内联模块），**16/17 PASS**（hash 一致）；④`node dev/check-all.js` **29 PASS / 0 FAIL / 1 SKIP**（6a 1570 + 6b 冻结 PASS=题目内容零影响；375/98/373/1570 零变动；10/11/12/21/22 全 PASS）；⑤真实 Chrome 9 步 E2E：**1-6/8/9 全过**（step8 reload「请求参数保持」=true 证明 print 链简化无回归；step9 打印 10/10），step7 既存失败同形（P31-02 起登记）；⑥错题重做渲染回归：核心断言全过（重做轮与生成轮逐字节一致/data-index 重排/choice·judge 控件/density 档位），探针 style-* 断言转负为本次删除预期结果。
- risk: ①渲染产物 class 变化（style-* 移除）属任务书授权的死 CSS 类删除，屏打视觉零变化（三表本无对应规则）；②practice-session 四个既存死依赖声明已登记未删，如需清理属 engine 层独立任务；③未 git commit。

---

## 8. 战役收口（P31-FINAL，2026-10-06）

- P31-01…10 十任务全部过门；`docs/P31/change-log.md` 收口。
- 最终态：排版唯一决策中心 `shared/presentation/layout.js`（plan/planFor/itemFor 决策表），screen/print 两模式 + renderEmergency 唯一应急出口；practice.html 零第二渲染器、零题目排版逻辑、零题目内联样式；CSS 三表职责归位；题号「N.」纯文本三处同形。
- 门禁终态：**29 PASS / 0 FAIL / 1 SKIP**（本机无 Chrome 口径；CI 30/0/0），375/98/373/1570 基线全程零变动。

---

## 6. 门禁索引（`node dev/check-all.js`，30 项）

P31 高频相关：5 npm test ｜ 6a 1570 真实生成 ｜ 6b 矩阵冻结 ｜ 10 Presentation renderer ｜ 11 SVG 契约 ｜ 12 Security（HTML 注入面）｜ 15 真实 Chrome E2E ｜ 16/17 bundle 确定性 ｜ 21 dead-code ｜ 22 legacy。

## 7. P31 红线（摘要，全文见 `.trae/rules/p31-layout-rules.md` §7）

不碰生成链与页面功能；不建第二套引擎/不留 shim 别名；不建题型专用 layout/CSS；CSS 不反推列数、SVG 不定布局；契约不扩字段；不降测试标准；emergency 只做最小安全输出、禁 catch→''；exam/固定列保持；不无限审计；改完必重建 bundle + 过门 + 记日志。
