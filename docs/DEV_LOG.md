# 项目开发日志（Dev Log）

> 版本演进完整记录。格式参照 Keep a Changelog，版本号遵循语义化版本（大版本.功能.修复）。
> 每个大版本的完整变更以 Git 标签为锚点（`git log V2.1..V3.0` 可查看全部提交）。
> 当前文档是整理后的统一开发日志，替代根目录 `CHANGELOG.md`、各内存/总结文档中的历史记录部分，
> 以及 V4.0.2 起并入的各一次性工作报告（架构里程碑 / 迁移审计 / 债务扫描）。

---

## [V4.2.1] — 2026-09-04

本版本主题：**打印紧凑化 Bug Fix（Issue #1，Frozen Core 授权）+ 知识点契约对齐 + 工具栏大服务层集中管理随包**。

### Bug Fix：打印排版浪费空间且存在多余卡片样式（双路径不一致）— Issue #1 `[Frozen Core Fix]`
- **Bug 编号**：GitHub Issue #1（`[Bug Fix][Frozen Core]` → `[Frozen Core Fix]` 批准，§6.5 流程完整走完 P0–P4）。
- **根因**：打印两路径（语义题 `PRINT_QCSS` / DOM 克隆 `buildPrintHtml`）各自硬编码卡片框（border/radius/background）、gap、padding，且数值漂移（12/10 vs 14/12）；「试卷纸」上呈现「屏幕卡片感」，版面浪费约 1/3；题号圆形徽标与作答虚线未按题型区分。
- **修复点**：
  - P1.1 `shared/print.js` `PRINT_QCSS`：去卡片化（删 border/radius/background）、@page 10mm 8mm、gap 8px 6px、题干 15px/1.5、题号回归正文色、作答区 20px——单卡高 89→60px（-32%）。
  - P1.2 克隆路径网格 gap 与语义路径统一（8px 6px）。
  - P1.3 令牌收敛：`--card-padding-print: 6px 8px`、`--grid-gap-print: 8px 6px`（tokens.css 单一来源）；`buildPrintQcss()` 构建时读令牌（打印自含文档带兜底），克隆路径内联 `var(--grid-gap-print,8px 6px)`——消除硬编码双源。
  - P2.1/2.2 `presentation/renderer.js`+`html-renderer.js`：`density` 透传并落地为 `question-card compact` 类（仅 class，RenderResult 契约不变）——约定（print=compact）与实现自此一致。
  - P2.3 `components.css`：`.question-card.compact` 用途注释校准（仅服务屏幕紧凑；打印不经本类）。
  - P3.1 打印端题号去圆形徽标（克隆路径 `.print-shell .num` 覆盖；屏幕徽标保留）。
  - P3.2 作答虚线题型自适应：纯口算/填空卷去线（间距分隔），含书写类（apply/word/open/draw…）保留；`options.answerRule` 可显式覆盖。
  - P3.3 `:has` 短卡（无图）放行跨页拆分，提高页底密度；不支持 `:has` 环境自动退化为整卡 avoid。
- **验证方式**：`node --test tests/presentation/renderer.test.js`（28 用例，含 P2 新增 3 断言）· `verify:presentation-runtime` · `verify:ui-boundary` · `verify:golden` 11/11 · `verify:snapshot` 漂移 0（屏幕 normal 零回归）· `npm test` 全绿 · `verify:m3` 168 全绿 · 无头 Chrome 打印样张（口算/应用题/凑十法/综合）目检。

### 知识点驱动随包变更（项目所有者指示）
- `shared/knowledge-math.js`：一年级 53 条补全 `concept / operations / factualContent / common_errors / graphicType`，并规范化 `applicable_question_types`（§6.4 数据扩展口径，零接口变更）。
- **测试口径联动**：`tests/strategy/question-type-allocation.test.js` 中 make-ten 由单题型改为 calc+fill 双题型（均分+余数优先 calc），新增 count=11 用例；**已知边界**：分配步不消费 coefficient（均分），若需权重分配属后续能力项。
- `practice.html` + `shared/pages.css`：工具栏样式集中管理（内联 → 大服务层 CSS，视觉等价）、快速模式占比分项胶囊换行流 + 可改填题量（守恒腾挪）；顶栏导航改左上角悬浮返回胶囊。
- `assets/poster-*.png` 入库（.gitignore 例外），首页海报引用生效。
- 冻结核心基线重锚（90 文件）：`dev/frozen-core-baseline.json`；重锚前备份 `.bak`（SHA1 7f48235…）。
- 标签沿革：`v4.2.0`（已发布，指向 5c9637e）→ 本次修复发布为 **`v4.2.1`**。

---

## [V4.1.0] — 2026-09-04

本版本主题：**四层架构归类整合（UI 显示 / 生成引擎 / 知识库 / 大服务）+ 关联层收敛与生产链路修复**。

### 项目整理：四层架构归类（物理稳定 + 逻辑清单）
- 采纳用户分层口径：**UI 层（显示）/ 生成层（题目生成核心引擎）/ 知识点库（基层数据核心）/ 大服务层（信息传递 · 项目控制 · 外围样式 · 打印等外围控制）**，除 UI/生成/知识外**全归大服务层**。
- **`architecture/layers.json`**（新增）：权威四层机器清单，逐文件归类：
  - `UI`：页面 + 渲染宿主 + `sw.js`;
  - `GENERATION`：引擎壳 / 语义 / 生成器 / 服务接口 / 呈现渲染 / SVG / 题型插件（`sub` 7 组）;
  - `KNOWLEDGE`：知识库 + 本体 + 字库 + 映射;
  - `SERVICE`：关联/策略/校验/能力/学习者/基础/状态IO/目录/CSS（`sub` 9 组）。
- **`dev/check-architecture-layers.js`**（新增）+ `npm run verify:layers`：校验 JSON 结构、登记文件存在性、**覆盖率**（`shared/`+`plugins/`+根 `.js/.css` 共 255 文件全部已归类）。
- **`docs/ARCHITECTURE_LAYERS.md`**（新增）：人类可读四层映射 + 硬红线 + 物理不移动原因（`common.js` 自推导注入同目录 6 子模块、预编译 bundle 内嵌 `shared/` 模块 id、sw.js/门禁/测试硬编 `shared/` 路径）。
- **为何不物理移动**：深度排查确认 `shared/` 为紧密耦合模块根，无安全孤立可移文件；采用「物理稳定 + 逻辑清单」。

### 生产链路修复（P0）
- **`shared/practice-session.js`**（冻结授权 Bug Fix P0-1）：`start()` 依赖加载改为回退 `global.GenerationEngine`，消除浏览器会话 `start()` 同步 TypeError（不再依赖未加载的 `generation/api.js`）。
- **`practice.html`**（P0-2）：补 `checkBtn` 点击绑定（`bindEvents()` 内）。
- **`shared/semantic-question.js`**（P0-3，非冻结）：答案映射 `hasOwnProperty + !=null` 保留 `false/0/''`；`normalizeSemanticQuestion` 补 `options`/`data` 映射与 `correctIndex` 推导。
- **`shared/presentation-engine.js`**（冻结授权 Bug Fix P0-4）：`generateQuestions` 门禁改为「仅拦截零可用输出」，修复 R28-3 回归。
- **图形校验误报修复（次级）**：`normalizeSemanticQuestion` 不再用空壳 `{type:null}` 兜底、不再把真实描述符洗成 `custom/rawSvg`——无图形→`null`（validator skip）、有描述符→保留、原始 svg→`custom`；4 场景探针全对，消除 `GRAPHIC_TYPE_UNREGISTERED` 误判。

### 关联层收敛（B1–B5）
- 删除死代码 `buildInstruction` / `sessionConfigFromInstruction` / `start()` 的 `__profile/__orchestrated/__partitions` 遗留路径（全仓零外部调用）。
- **`computeResult`** 删除结构不一致的本地降级，无条件委托 `PluginUtil.computeResult`（统一 `{score:百分比, results:boolean[]}` 语义，杜绝「全部误判正确」）。
- **`asmGenerateFromSelection`** 收敛冗余 `newSession`（其后 `start()` 会重建覆盖）。
- **print 路径**改走关联层唯一入口 `PracticeBridge.start`（携带 `onStartFeedback`），`printFile()` 兼容聚合会话（无 `.print()` 时回退 DOM 整卷打印）；`applySessionFeedback` 回写真实 `practiceSession` 供打印。

### UI 层清理（U1–U3）
- 删 `ASM_SMART` / `asmState.smartSeeded`（死数据）、空 `resize` 监听、3 处恒真三元（`deriveTypeName()/state/ensureLegacyPlugins` 直接引用）。

### 门禁重锚与清理
- **`dev/check-ui-boundary.js`**：统一生成入口断言 `practiceSession.start(` → **`PracticeBridge.start(`**（B5 收敛后 UI 不再直调 `new PracticeSession().start()`）。
- **`dev/check-practice-page.js`**：入口断言同步 `PracticeBridge.start(`；`PLUGIN_REGISTRY` 放宽为「URL `plugin=` 路由的索引读取，非出题」——清掉既有的 1 项假阳性（8/9→9/9）。
- **删除冗余审计/一次性脚本**：`verify-competition.js`、`verify-g5-competition.js`、`competition-report.js`、`concurrency-check.js`、`performance-budget.js`（均未入 `package.json`、无实时入边，残留引用为注释/历史归档）。
- **`dev/verify-pages.js`**：修正 `math/chinese/english/subject-types.html` 为纯重定向桩的陈旧期望（`PAGE_DEPS`/`CRITICAL_DOM`/`ENTRY_SCRIPTS`），并纳入 chinese/english → 123/123。
- **`dev/frozen-core-baseline.json`**：按授权 Bug Fix 重锚基线（90 文件）；本会话仅含 P0-1/P0-4 两处冻结编辑，其余为基线(09-02)之后既存漂移。

### 验证（全绿）
- 四层架构门禁 PASS（255 文件全归类）· verify-pages 123/123 · UI-boundary 6/6 · practice-page 9/9 · presentation-runtime PASS ·
  engine 测试 8/8 · frozen-core 完整 · syntax 418 文件 0 错 · lint 无违规 · architecture-rules ERROR 0/WARNING 8（既存）·
  regression 137 组合/288 边界全满分 · verify:m2 PASS · sync-sw-version PASS。

### 版本号
- `4.0.4 → 4.1.0`（`package.json`、`shared/version.js`、`sw.js`、`index.html` 回退常量、`dev/test-sw-cache-upgrade.js` 同步）。

---

## [V4.0.4] — 2026-09-03

本版本主题：**凑十法 SVG 升级为教材标准连线图（Frozen Core 授权优化）**。

### 背景
用户提供教材标准凑十法参考图（AI 导出 SVG）：顶行算式 + 答案框、拆分弧线 + 双拆分框、
凑十折线 + "10" 标注、汇总括线 + 答案回连线。原实现（`shared/svg-make-ten.js`）为
4 行文字算式逐步展示，与教材标准图式不符。

### 变更
- **`shared/svg-make-ten.js`**（M7 冻结文件，本次为授权优化）：
  新增 `renderMakeTenFigure(a, b, opts)`，`makeTen()` 改为输出标准教材连线图——
  ① 顶行 `a + b = [答案]`（答案红色填入答案框）；② b 经二次贝塞尔弧线下接两小框
  （c1 凑整蓝 / c2 剩余橙）；③ a 折线下行接左框竖引线，线下标注 "10"（蓝）；
  ④ 括线自 10 接入右框 + 底部 "+" + 答案框回连线（10+c2=答案）。
  布局以 22px 字号为基准按 `k=fs/22` 缩放，`fontSize/width/animate/printMode/title`
  选项与 `mt-step` 四步淡入动画、`prefers-reduced-motion` 降级、打印静态约定全部保留。
  平十 `pingTen` / 破十 `poTen` 维持原步骤行式渲染，API 与无效输入返回 null 契约不变。
- **`dev/test-svg-make-ten.js`**：凑十断言由文字算式内容（"5 = 1 + 4"）更新为
  标准图结构断言（3 矩形 / 3 折线 / 1 弧线 / 顶行原式 / 拆分框数字 / 10 标注 / 答案填框）。
- **`dev/frozen-core-baseline.json`**：仅外科式更新 `shared/svg-make-ten.js` 条目
  （hash 54232568→872ead43）；其余 14 处既有漂移（生成层重构提交 df6b720 未重锚）保持可见，未被吞并。

### 验证
- `node dev/test-svg-make-ten.js`：30/30 断言通过（含无效输入 null、批量组合、NaN 泄漏检查）。
- `node dev/verify-svg.js`：219 个 SVG 结构校验通过（含 animate/printMode 语义 6 项）。
- `node dev/check-renderer-coverage.js`：0 missing renderers。
- `node --test tests/presentation/renderer.test.js tests/generator/graphic-renderer.test.js`：29 pass / 0 fail。
- `npm run check-lint`：无违规（颜色复用文件内既有令牌常量）。
- 视觉验收：8+4 与参考图逐元素对齐（浏览器对比页核对）。
- 影响面确认：golden/snapshot/renderer 测试仅断言结构（svg 存在性），knowledge 静态页
  不内嵌该 SVG，`sw.js` 预缓存将于下次发版随 APP_VERSION 自增整体失效。

---

### 补记 · 关联层外围控制层 + 三级页 UI 统一（2026-09-03，首份结构文档并入）

#### 背景
用户要求以「只改关联层」落地一套**外围控制层**：在不改 UI 层、不改题目生成层的前提下，
把「数量 count / 难度 difficulty / 知识点 knowledgePoints / 知识点驱动生成（每知识点题量）」全链路统一驱动。
审计发现：`PracticeSession`（M7 冻结）构造函数与 `_buildGenerationRequest` 只消费单个 `count`+
`difficulty`+`knowledgePointIds`+`questionType`+`adaptive`+`learnerProfile`+`titleType`，
**忽略 `kpAllocation` / `mode` / `subtype` / `pluginIds`** —— 即此前「每知识点数量填空」只是 UI 建好、
生成层却忽略的占位消息，并非实际生效。

#### 变更（全部落在关联层 `shared/practice-bridge.js`，未触 UI 与生成层）
- **新增外围控制层 `ControlService`**（`Object.freeze`，作为独立命名空间 **`PracticeBridge.control`**）：
  - `resolveCount` / `countProfile`：数量裁剪 1–50，默认 **20**，预置 20/30/50/自定义；
  - `resolveDifficulty`：难度裁剪 1–10，默认 **1**；
  - `extractKnowledgePoints` / `hasPerKpAllocation` / `kpAllocationPartitions`：归一化
    `knowledgePointId` / `knowledgePoints` / 每-KP 配额 `kpAllocation`；
  - `plan(ui)`：产出一份**执行计划** `{ profile, mode, partitions }`：
    - `mode='single'` → 单次 `count`+`knowledgePoints[]` 直发生成层；
    - `mode='orchestrated'` → 有每-KP 配额（多个知识点）时按**知识点驱动生成**：
      对每个知识点按其配额并发建 `PracticeSession.start()`（每 KP 单 `count`），再**合并为一个题目集**，
      `submit()` 走聚合会话 shim 对合并题集统一批改——不改生成层即可兑现「每知识点数量」。
  - `sessionConfig` / `mergedTitle`：指令→生成层配置翻译、合并标题（「二年级数学 · 口算+竖式（20题）」）。
- **`start()` 接入控制层**：先 `ControlService.plan()` 决定 single 直发 / orchestrated 编排；反馈契约不变
  （成功仍 `{ ok, questions, html, meta, session, instruction }`，失败 `{ ok:false, error:{code,message} }`）。
- **UI 三级页统一（practice/select/index）**：题量 chip 改为 20/30/50/自定义（删 10、默认 20，自定义同框直填数字）；
  难度初始 `3→1` 全链路（`state.difficulty`、HTML input、`parseUrlParams` 兜底）；教师模式
  `mode=teacher` 渲染为「每知识点数量填空」（横向 flex-wrap `.kp-ratio-flow`/`.kp-blank`），quick 模式维持权重占比±按钮；
  `parseUrlParams` 补 `mode` 字段、新增 `isTeacherMode`；删除死代码 `openWrongBook()`、
  冗余 `state.kps`/`var ensureKB`、孤儿 `typeGroup/difficultyGroup/kpGroup` 等；页脚图标统一彩色双层蓝盾、
  nav logo 统一透明图层（object-fit contain、去背景渐变/圆角、`select.html` 加 `text-decoration:none`）。

#### 验证
- 单元自测（node 伪层）：count 兜底20/自定义37/越界999→20、难度默认1/5→5；plan single 与 orchestrated 均正确；
  编排建 2 个每-KP 会话（a=12, b=8）、合并 20 题、聚合 `submit()` 返回 score/total；单次直发 config 正确透传。
- CI：`dev/check-ui-boundary.js` **6/6**、`dev/check-practice-page.js` **8/9**（唯 FAIL「无 Plugin 调用」为既有假阳性，
  正则命中 `PLUGIN_REGISTRY`，本次未新增）；`node --check shared/practice-bridge.js` OK。
- headless 冒烟：practice.html 正常加载 `PracticeBridge` 并渲染生成按钮。
- **分层约束确认**：`shared/practice-session.js`（生成层）git diff 无改动；practice.html（UI）在本次外围控制层
  工作**未修改**（UI 变更均在上一轮界面统一任务完成）。

#### 文档
- 新增 **`docs/PROJECT_STRUCTURE.md`**（项目结构文档）：目录 + 三层功能架构（UI→关联层→生成层）+ 各目录/文件速查。
- `docs/DEVELOPMENT.md`：§3 目录结构补 `PROJECT_STRUCTURE.md` 与三层架构一行、新增 §4.7 关联层与外围控制层。
- `README.md`：项目结构注释与文档导航补 `PROJECT_STRUCTURE.md` 引用。

---

## [V4.0.3] — 2026-09-02

本版本主题：**知识库语义字段补填 + 生成管线体检修复**。

### 背景
污染扫描发现全库 574 KP 的语义字段（operations / factualContent）缺失：
canonical 层 operations 仅 221/574 覆盖、factualContent 仅 22/574；
`verify-knowledge-bank.js` 直接检测扁平 KP 字段，报 574×2 条「缺失」WARNING。

### 变更
- **`shared/ontology-operation-map.js`**：为 51 个缺口插件新增 operations 映射
  （题型类：fill/judge/choice/matching/operation/reason/calc 按生成行为归 canonical 操作；
  竞赛类：C1 数字谜/C2 数论/C3 计数/C4 几何/C5 行程/C7 组合/C8 逻辑/C9 综合按主题归类；
  全部 `confidence:'medium'`、`evidence:'plugin-name'`，遵循既有治理规范）。
- **`shared/ontology-factual-map.js`**：扩充 7 个主题的教学事实
  （math-clock 时间单位、math-time-date 年月日、math-shapes/math-geometry 图形分类、
  math-area 面积公式、math-combination-set 排列组合；含 evidence/confidence 分级）。
- **`dev/verify-knowledge-bank.js`**：`operations`/`factualContent` 判定改为走 canonical
  归一结果（`Ontology.normalize`），与 `check-factual-content` / `check-operation-ontology`
  同口径（Normalizer 为唯一权威归一层），消除对扁平字段缺失的重复误报。

### 结果
- canonical operations 覆盖 **571/574（99.5%）**，剩余 3 个为 cn/en 无插件占位
  （`alphabet-order`/`pinyin-review`/`word-spelling`，`status:'placeholder'`，诚实留空不伪造）。
- canonical factualContent 覆盖 22→**39**，其余按治理规范留空（低置信不伪造）。
- `verify-knowledge-bank` WARNING **1685→1075**（-610 条 operations/factualContent 误报）。
- 全量 `npm test` 通过；Frozen Core 基线无变更（3 个改动文件均非冻结文件）。

### 生成管线体检修复（2026-09-02）
对题目生成链（practice.html → PracticeSession → GenerationEngine → Strategy/Comprehensive → Generator → Retry → Validator → Renderer）扫描后修复两处：

- **#1 冗余验证**：`presentation-engine.js` 对同一批 SemanticQuestion 在 RetryLoop 验证后，又重复执行 `runPipelineBatch` 两次（第 105 与 133 行、结果恒同）。已改为在批量验证步骤一次性产出结果，第 5 步质量评分直接复用，消除整批重复验证开销。
- **#2 seed 缺失告警**：legacy 生成器（94 个插件）产出的题目不带 `seed`，导致 `attachMeta`（`if sq.seed != null` 跳过）与 `normalizeSemanticQuestion` 幂等短路（因 `metadata.generator` 已存在）双重失效，`metadata.seed` 恒为 null，运行时持续输出 `[Logger] questionValidation 缺少字段: seed`。已在 `retry-loop.js` 两处 normalize 前补 `metadata.seed = seed`（Promise 与同步双分支），`sq.seed` 与 `metadata.seed` 现保持一致。
- **核验 #3 metrics.js 非死代码**：为「生产埋点 + 开发诊断」设计（浏览器随 presentation-engine.bundle.js 运行、仅内存计数、经 `dev/check-metrics.js` 手动查看），确认保留。
- 全量 `npm test` EXIT=0；两处改动文件属 Frozen Core 范围，按 Bug Fix 流程**重锚基线至 93/93 一致**；`strategy-engine.bundle.js` / `presentation-engine.bundle.js` 已用官方构建脚本重建（`build:strategy` / `build:presentation`）。

---

## [V4.0.2] — 2026-09-02

本版本主题：**文档二次整合——参考文档与工作报告全部并入三份核心文档**。

### 文档体系最终形态（docs/ 仅保留三份）
- `docs/DEV_LOG.md`（本文件，开发日志 + 历史报告归档索引）
- `docs/DEVELOPMENT.md`（最新开发状态，已并入 API 速查/知识库结构/插件上手/冻结红线/SEO）
- `README.md`（功能说明，已并入文档导航）

### 并入 DEVELOPMENT.md 的内容
- **工具 API 速查**（原 `docs/API.md`）：PluginUtil 随机数/难度/工厂、SVGGenerators、SubjectUtils、令牌要点 → §10。
- **知识库结构**（原 `docs/knowledge-base.md`）：ID 四段式规范、模块目录 M0–M12/C1–C9/N1–N8/E1–E6、
  prerequisites/related 规则、插件↔KP 声明、覆盖校验 → §4.2。
- **插件快速上手**（原 `docs/PLUGIN_QUICKSTART.md`）：new-plugin 脚手架参数、generateQuestions 最小实现、
  difficultyParams 消费、本地预览、linter R1–R4 → §5.7。
- **AI 开发红线**（原 `docs/AI_DEV_GUIDE.md`）：架构 30 秒版、修改禁区 8 条、标准开发流程 → §5/§4。
- **Frozen Core 保护规范**（原 `docs/FROZEN_CORE.md`）：冻结范围 M0–M7 全文件清单、禁止事项、
  唯一例外（Bug Fix）条件、变更申请流程、扩展机制、基线重锚 → §6。
- **机器可见性与 SEO 运维**（原 `docs/seo-monitoring.md`）：robots/llms/sitemap/JSON-LD 配置与复核 → §11。
- **M1–M4 债务扫描结论**（原 `dev/migration/m1-m4-old-debt-scan.md`）：P0 关闭确认、
  74/482 迁移进度、契约合规问题清单 → §8。

### 并入 DEV_LOG.md 的内容（历史摘要）
- **知识库 ID 迁移审计**（原 `docs/migration-report.md`，2026-08-23）：356 KP 三段式迁移，见 §附录 A。
- **M0–M3 架构里程碑**（原 `docs/architecture/*.md`）：M0 只读审计/架构规则、M1 本体 schema、
  M2 能力契约、M3 策略引擎 final 报告，见 §附录 B。
- **M4 迁移与回归治理**（原 `dev/migration/*.md`）：closure 审计 NOT_READY → C04/C05 回归根因修复
  （3738 全量矩阵）/ C06 死代码清理 / R24–R27 native 迁移批次，见 §附录 C。
- **五年级竞赛映射设计依据**（原 `docs/g5-competition-knowledge-map.md`）：79 知识点设计表已写入知识库，见 §附录 D。

### 删除文件
- `docs/API.md`、`docs/knowledge-base.md`、`docs/PLUGIN_QUICKSTART.md`、`docs/AI_DEV_GUIDE.md`、
  `docs/FROZEN_CORE.md`、`docs/seo-monitoring.md`、`docs/migration-report.md`、
  `docs/g5-competition-knowledge-map.md`、`docs/CONTRIBUTING.md`、`docs/README.md`。
- `docs/architecture/`（9 个里程碑报告）与 `dev/migration/`（14 个审计/报告文件 + 9 个审计 JSON）。
- `dev/fingerprint-report.md`（`dev/plugin-fingerprint.js` 可再生成）。
- 保留：`plugins/CONTRACT.md`（插件核心契约，运行时不依赖文档体系）。

### 参考更新与基线重锚
- `scripts/new-plugin.js`、`scripts/add-g5-competition-entries.js`、`shared/module-catalog.js`、
  `shared/generator/core/kp-arithmetic-semantics.js` 中对已删文档的引用全部改指 DEV_LOG/DEVELOPMENT。
- Frozen Core 变更（2 处，均为注释级文档引用更新，无行为变化）：`shared/module-catalog.js`、
  `shared/generator/core/kp-arithmetic-semantics.js` → `node dev/check-frozen-core.js --baseline` 重锚基线。

### 文档体系最终形态
- `docs/` 仅保留三份核心文档：`DEV_LOG.md`（开发日志 + 历史报告索引）、`DEVELOPMENT.md`（最新开发状态），
  根目录 `README.md`（功能说明）。

### 版本
- 版本号统一由 `4.0.1` 提升至 `4.0.2`（`shared/version.js`、`package.json`、`sw.js`、`index.html` 回退常量、`dev/test-sw-cache-upgrade.js` 同步）。

---

## [V4.0.1] — 2026-09-02

本版本主题：**文档体系整合 + CI 修复 + 死代码清理**。

### 文档体系整合
- 将散落在根目录与 `docs/` 的文档统一整合为三份核心文档：
  - `docs/DEV_LOG.md`（本文件，项目开发日志，整合全部版本历史）
  - `docs/DEVELOPMENT.md`（项目开发文档，仅保留最新项目状态）
  - `README.md`（项目 readme，功能说明，随项目更新）
- 旧文档归档至 `archive/docs-2026-09/`。

### 修复
- **P0 / CI 工作流 YAML 缩进错误**：`.github/workflows/ci.yml` 第 18 行 `uses:`
  与 `- name:` 平级缩进（6 空格），导致 GitHub Actions 严格解析失败、整套 CI 门禁失效。
  已修正为正确缩进（8 空格），YAML 校验通过。
- **P1 / practice.html 重复声明死代码**：`boot()` 内两处重复的 `var ensureKB` 声明，
  第二处（直接打印 `return` 分支之后）为不可达冗余代码。已删除冗余块，仅保留单一声明。

### 版本
- 版本号统一由 `4.0.0` 提升至 `4.0.1`（`shared/version.js`、`package.json`、`sw.js` 同步）。

---

## [V4.0.0] — 2026-09-01

大版本主题：**V1 引擎治理确认 + 版本体系全面对齐**。

本版本为「V1 引擎」（知识点驱动的 M0–M7 分层架构：Ontology → Capability →
Strategy → Generator/Selector → Validator → Learner → Presentation）的治理里程碑，
确认以当前 Frozen Core 双引擎架构为唯一生成主链，不再引入 V2 引擎。

### 冻结核心覆盖补全
- **冻结基线 70 → 93 个文件**：将已打包进 `shared/strategy-engine.bundle.js` 的
  V1 引擎运行时文件全部纳入 `FROZEN_CORE` 保护门禁，含 `shared/strategy/*` 全部策略文件、
  `shared/generator/core/rng.js`、`core/arithmetic-core.js`、`core/kp-complex-semantics.js`、
  `migration-switch.js`、`semantic-question-bridge.js`、`shared/validator/kp-validator.js`。
- **清除 FROZEN_CORE 清单重复条目**，使基线「当前文件数 == 基线文件数」（此前因
  M2/M4、M3/M7 重叠列项造成计数虚高，现一一对应）。

### 版本对齐（全面提升至 4.0.0）
- `shared/version.js` `APP_VERSION`、`package.json` `version`、`sw.js` `CACHE`
  统一升至 `4.0.0`（`scripts/sync-sw-version.js` 校验通过）。
- `index.html` / `grade.html` 版本回退常量 `'3.1.0'` → `'4.0.0'`；
  `dev/test-sw-cache-upgrade.js` 测试回退默认值同步。
- `CHANGELOG.md` 补记 V4.0.0 条目。

---

## [V3.3.0] — 2026-08-29

本版本主题：**二年级数学体系重做**（知识库 + 专项插件 + 期末模拟卷）。

### 新增
- **二年级知识库重做**：`shared/knowledge-math.js` grade:2 重构为 12 模块 / 81 知识点（口算、竖式、脱式、填空、连线、看图列式、操作、判断、选择、解决问题、数据统计、逻辑推理），编号统一三段式 `g2-{module}-{slug}`；`shared/knowledge-slug-map.js` 新增 81 条 slug，并重生成 `knowledge/` 二年级详情页（旧 13 个孤儿页经 `--clean` 清理）。
- **二年级专项插件（6 个）**：`math-g2-judge`（M11 判断）、`math-g2-choice`（M12 选择）、`math-g2-matching`（M5 连线）、`math-g2-column`（M2 竖式）、`math-g2-mixed`（M3 脱式）、`math-g2-picture-equations`（M7 看图列式），统一注册至 `plugins/registry.js`；操作题（M6）/找规律（M4）复用 `math-g1-operation` / `math-patterns`。
- **综合练习·期末模拟卷（exam 子类型）**：`math-comprehensive` 新增 10 大题模板（口算/填空/判断/选择/竖式/脱式/看图列式/解决问题/操作/数据统计，满分按各题分值累加）；`practice.html` 组卷方式选 exam 时隐藏难度面板并按分值判分；`math-types.html` 新增二年级「期末模拟卷」入口。
- **Service Worker 缓存优先 + 资源版本指纹 + 部署工作流**（本版本版本号升至 3.3.0）。

### 修复
- **二年级综合练习组卷崩溃**：`math-unit-convert` / `math-geometry` / `math-logic-reasoning` 补齐二年级题型 builder（长度/质量/时间单位换算、角度分类、组合/握手/排序推理），`math-g1-operation` grades 补 2，使 grade-2 综合练习正常组卷。

---

## [V3.1.2] — 2026-08-28

### 修复
- **练习页（三级页）脚本解析错误**：移除 `check()` 中多余的孤立 `}`，修复整段内联脚本无法解析、导致所有练习页打不开的问题。

### 清理
- **移除自适应难度模块 `App.Adaptive`**：模块本体与 `Adaptive` 导出、各插件及文档中的相关引用（含自适应评测/存储逻辑）全部清理，综合练习自适应统计改为空桩；基础用户难度（1–10）与 `App.Difficulty` 保留。
- **题型页空/错状态接入 `App.UIState`**：`math-types.html` / `subject-types.html` 加载失败改用 `App.UIState.bannerHtml`、空学科态改用 `emptyHtml`，统一错误横幅与空状态样式。
- **工具栏数字型设置样式统一**：数字输入型设置渲染为独立 `.group.type-sub-group` 行，移除 `.set-num` 嵌套写法；删除 `toolbar.css` 中 `.adaptive-hint` 等失效样式。

---

## [V3.1.1] — 2026-08-28

### 优化
- **练习页工具栏布局重构**：五个操作按钮迁移至页面右侧，按功能亲密度分三行（「生成练习题」独立成行、「检查答案」+「显示答案」、「打印页面」+「刷新重置」），行间距 12px。
- **左侧设置区三层纵向堆叠**：题型 / 题量 / 难度自上而下排列，层间距与右侧操作行一致。
- **主页「问题反馈」入口**：由悬浮胶囊玻璃按钮改为右上角固定定位的深灰（`#555`）纯文字链接。

---

## [V3.0] — 2026-08-24

大版本主题：**难度系统 v2 全量落地**（结构复杂度参数化 + 知识点级自适应）、
**CSS 设计令牌收口**、**知识库编号体系与校验机制定型**。

### 新增
- **难度解析层** `shared/difficulty.js`（`App.Difficulty`）：
  - `difficultyToStructure`：难度 1–10 → 五档结构（步数/括号/乘除/符号交替/多层括号），
    `complexityScore` 全档严格单调；
  - `createProfile` / `consumeProfile` / `consume`：插件统一难度消费入口。
- **知识点标注体系**：Question 可选字段 `knowledgePointId` / `difficulty`；18 个插件完成统一消费迁移并标注。
- **综合练习自适应组卷**：按 KP 统计薄弱加权。
- **SVG 生成器层**：`shared/svg-core/geometry/calculation/make-ten.js`。
- **站点页面**：FAQ 页、学科类型页（subject-types.html）、SEO 文件（sitemap.xml / robots.txt / llms.txt）。
- **测试矩阵**：test-difficulty、test-difficulty-structure、test-adaptive 等系列。

### 变更
- **知识库编号体系**：知识点 ID 全面迁移三段式 `g{grade}-{moduleIdLower}-{baseSlug}`；五年级 C1–C9 竞赛插件全实现，六年级竞赛覆盖率 85%→100%。
- **样式架构**：拆分 tokens/base/components/toolbar/pages 五层 CSS（@layer 锁序）；内联主题色全量迁移 tokens.css 变量（约 340 处）。
- **随机数规范**：全仓运行时零 `Math.random()` 直调。
- **Service Worker**：CORE 预缓存补齐，缓存版本 v61→v64。

### 校验与工具链
- **零依赖提交门禁**：版本化 pre-commit 钩子 + GitHub Actions CI。
- **verify-knowledge-bank 第8条**：插件声明 ↔ 知识库双向对齐校验。
- 死代码归档：knowledge-slug-map 等 → `archive/dead-code-20260823/`。

---

## [V2.1] — 2026-08-15

设计令牌统一主题、工具栏独立 CSS、卡片紧凑化与打印左对齐。

---

## [更早 / V2.0 及之前]

见 Git 历史（站点初版与插件体系搭建阶段）。

---

## 附录：历史文档索引

本次文档整合（V4.0.1/V4.0.2）归档的旧文档（`archive/docs-2026-09/`）：

| 原文件 | 类型 | 归档去向 / 去向说明 |
|--------|------|---------------------|
| 根 `CHANGELOG.md` | 版本历史 | 已整合入本文件（DEV_LOG.md） |
| 根 `PROJECT_SUMMARY.md` | 项目总结 | 最新状态并入 DEVELOPMENT.md |
| 根 `MEMORY.md` | 项目状态备忘 | 状态并入 DEVELOPMENT.md |
| 根 `overview.md` | 审查报告 | 归档保留（一次性审查历史） |
| 根 `FEATURE_STATUS.md` | 功能状态 | 状态并入 DEVELOPMENT.md |
| 根 `CONTRIBUTING.md` | 贡献指南 | 规范并入 DEVELOPMENT.md |
| `docs/API.md` | API 参考 | 并入 DEVELOPMENT.md §10 |
| `docs/knowledge-base.md` | 知识库参考 | 并入 DEVELOPMENT.md §4.2 |
| `docs/PLUGIN_QUICKSTART.md` | 插件上手 | 并入 DEVELOPMENT.md §5.7 |
| `docs/AI_DEV_GUIDE.md` | AI 红线 | 并入 DEVELOPMENT.md §5 |
| `docs/FROZEN_CORE.md` | 冻结规范 | 并入 DEVELOPMENT.md §6 |
| `docs/seo-monitoring.md` | SEO 运维 | 并入 DEVELOPMENT.md §11 |
| `docs/migration-report.md` | 迁移审计 | 摘要见下附录 A |
| `docs/g5-competition-knowledge-map.md` | 设计依据 | 摘要见下附录 D |
| `docs/architecture/*.md` | M0–M3 里程碑报告 | 摘要见下附录 B |
| `dev/migration/*.md` | M4 审计/债务报告 | 摘要见下附录 C |
| `dev/fingerprint-report.md` | 生成产物 | 由 dev/plugin-fingerprint.js 再生成 |

---

## 附录 A：知识库 ID 迁移审计摘要（2026-08-23）

- 356 个知识点 ID 从旧命名统一迁移为三段式 `g{grade}-{moduleIdLower}-{baseSlug}`；
  旧 ID 跨年级重复（竞赛如 `c1-vertical`）、不带模块信息，无法全局唯一。
- 迁移范围：知识库本体、`knowledge/` 详情页（356 详情+76 模块+1 索引）、49 个插件 knowledgePoints、
  207 处头部注释、文档与 llms.txt。
- 验证：ID 格式 0 违规 / 全局唯一 0 重复 / 悬空引用 0 / 高年级前置 0 / 详情页 433 文件 0 断链；
  回归 118 组合满分、综合练习无占位内容。完整映射表归档 `archive/migration-20260823/`。

## 附录 B：M0–M3 架构里程碑摘要

- **M0（只读审计 + 架构护栏）**：确认纯前端无构建形态；建立职责边界规则（UI 不决策题目结构、
  KB 不生成、Strategy 不渲染、Generator 不碰 DOM、Renderer 不评难度、Learner 不回写 KB、
  禁新增 Math.random）；静态检查 `dev/check-architecture-rules.js`（R1–R5）。
- **M1（本体/KB schema）**：Legacy KP → Canonical Knowledge Ontology 统一 schema
  （identity/source/semantics/structure/cognition/presentation/numeric/context/errors）+ Normalizer/Validator/覆盖报告。
- **M2（能力/生成器契约）**：generator-contract/registry/selector/mode + retry-loop + legacy-plugin-adapter，
  六类生成器契约与能力模型（`capability-*.js`）。
- **M3（策略引擎）**：`StrategyEngine.plan(request)` 唯一入口，7 步固定顺序
  （QuestionType → CognitiveLevel → Difficulty → Structure → SpiralLevel → Context → Count）、
  11 项 StrategyValidator、LegacyAdapter 纯映射到旧插件。M3 结束标志 M0–M3 Gate 全冻结。

> 各阶段详情曾存 `docs/architecture/*.md`；当前唯一权威架构描述为 DEVELOPMENT.md §1/§4/§6。

## 附录 C：M4 迁移与回归治理摘要

- **Closure 审计（2026-09-01）**：A07–A11 只读审计结论 `NOT_READY`——P0-001（浏览器链路静默空集）、
  M4-R02（adapter 契约失配）、M4-R16（回归从未绿）、P-012（基线锚脏工作树）。
- **C04/C05 回归根因**：774 个 PLAN_ERROR 归因 RC-PLAN-01 =「矩阵用插件级能力并集构造逐 KP 用例」的测试构造缺陷；
  最小补丁改为 per-KP 能力解析 → 回归从采样 1074 升级全量枚举 **3738 cases（FAIL 0 / PLAN_ERROR 0）**，
  并补 `fillOperandUnknown` 逆向填空校验缺口。
- **C06 死代码清理**：删除 `generateViaEngine`/`buildGenerationRequest`/`doGenerate`/`sqToLegacyQuestion`，
  修复 phantom `require('../render.js')`，live 入口统一 `practiceSession.start()`。
- **R24–R27 native 迁移批次**：扩展 `SPECIAL_ORAL_PROFILE` 至 12 kind（整十除法/小数/运算律/负数），
  迁移 KP 70→74（全库 556），每批 FULL-EQ + 回归 + verify:m4 + 基线重锚。
- **债务现状**：阻塞型债务全部关闭；存留为迁移剩余（482 KP legacy）+ 契约合规观察项，见 DEVELOPMENT.md §8。

## 附录 D：五年级竞赛知识点映射摘要（设计依据，2026-08-23）

- 79 个 C1–C9 知识点（全部 `status:'placeholder'` 指向 `math-competition-placeholder`）已写入知识库；
  33 个旧 slug 删除，六年级竞赛前置改指四年级同主题点。
- 命名：同主题跨年级共用 slug（`g5-c1-digit-puzzle-vertical`）；难度 基础 3 / 模型 4 / 综合 5。
- 后续遗留：四年级 C1–C9 slug 仍为旧语义（`c1-vertical`），需统一迁移后「共用 slug」口径才完全一致。
- 完整 79 项映射表曾存 `docs/g5-competition-knowledge-map.md`（现归入本附录引用）。
