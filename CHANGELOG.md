# 更新日志（CHANGELOG）

本文件记录 Homework Help 的版本演进。格式参照 Keep a Changelog，版本号遵循
语义化版本（大版本.功能.修复）；每个大版本的完整变更以 Git 标签为锚点
（`git log V2.1..V3.0` 可查看全部提交）。

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

## [V3.3.0] — 2026-08-29

本版本主题：**二年级数学体系重做**（知识库 + 专项插件 + 期末模拟卷）。

### 新增
- **二年级知识库重做**：`shared/knowledge-math.js` grade:2 重构为 12 模块 / 81 知识点（口算、竖式、脱式、填空、连线、看图列式、操作、判断、选择、解决问题、数据统计、逻辑推理），编号统一三段式 `g2-{module}-{slug}`；`shared/knowledge-slug-map.js` 新增 81 条 slug，并重生成 `knowledge/` 二年级详情页（旧 13 个孤儿页经 `--clean` 清理）。
- **二年级专项插件（6 个）**：`math-g2-judge`（M11 判断）、`math-g2-choice`（M12 选择）、`math-g2-matching`（M5 连线）、`math-g2-column`（M2 竖式）、`math-g2-mixed`（M3 脱式）、`math-g2-picture-equations`（M7 看图列式），统一注册至 `plugins/registry.js`；操作题（M6）/找规律（M4）复用 `math-g1-operation` / `math-patterns`。
- **综合练习·期末模拟卷（exam 子类型）**：`math-comprehensive` 新增 10 大题模板（口算/填空/判断/选择/竖式/脱式/看图列式/解决问题/操作/数据统计，满分按各题分值累加）；`practice.html` 组卷方式选 exam 时隐藏难度面板并按分值判分；`math-types.html` 新增二年级「期末模拟卷」入口。
- **Service Worker 缓存优先 + 资源版本指纹 + 部署工作流**（本版本版本号升至 3.3.0，此前未在 CHANGELOG 记录）。

### 修复
- **二年级综合练习组卷崩溃**：`math-unit-convert` / `math-geometry` / `math-logic-reasoning` 补齐二年级题型 builder（长度/质量/时间单位换算、角度分类、组合/握手/排序推理），`math-g1-operation` grades 补 2，使 grade-2 综合练习正常组卷。

## [V3.1.2] — 2026-08-28

### 修复
- **练习页（三级页）脚本解析错误**：移除 `check()` 中多余的孤立 `}`，修复整段内联脚本无法解析、导致所有练习页打不开的问题。

### 清理
- **移除自适应难度模块 `App.Adaptive`**：模块本体与 `Adaptive` 导出、各插件及文档中的相关引用（含自适应评测/存储逻辑）全部清理，综合练习自适应统计改为空桩；基础用户难度（1–10）与 `App.Difficulty` 保留。
- **题型页空/错状态接入 `App.UIState`**：`math-types.html` / `subject-types.html` 加载失败改用 `App.UIState.bannerHtml`、空学科态改用 `emptyHtml`，统一错误横幅与空状态样式。
- **工具栏数字型设置样式统一**：数字输入型设置（如口算「难度＝最大数」）渲染为独立 `.group.type-sub-group` 行，移除 `.set-num` 嵌套写法；删除 `toolbar.css` 中 `.adaptive-hint` 等失效样式。

## [V3.1.1] — 2026-08-28

### 优化
- **练习页工具栏布局重构**：五个操作按钮迁移至页面右侧，按功能亲密度分三行（第一行「生成练习题」独立成行；第二行「检查答案」+「显示答案」；第三行「打印页面」+「刷新重置」），行间距 12px；按钮文字统一 14px / 加粗 / 居中。
- **左侧设置区三层纵向堆叠**：题型 / 题量 / 难度自上而下排列，层间距与右侧操作行一致（12px）；三层标题统一 14px 加粗同色，内容（题型名、数字选项）13px 加粗形成从属层级；题型超宽自动折行且第二行与首个题型内容左对齐，换行仅增加左侧层高、不挤压右侧面板。
- **主页「问题反馈」入口**：由悬浮胶囊玻璃按钮改为右上角固定定位的深灰（`#555`）纯文字链接。

## [V3.0] — 2026-08-24

大版本主题：**难度系统 v2 全量落地**（结构复杂度参数化 + 知识点级自适应）、
**CSS 设计令牌收口**、**知识库编号体系与校验机制定型**。

### 新增

- **难度解析层** `shared/difficulty.js`（`App.Difficulty`）：
  - `difficultyToStructure`：难度 1–10 → 五档结构（步数/括号/乘除/符号交替/多层括号），
    `complexityScore` 全档严格单调；
  - `createProfile` / `consumeProfile` / `consume`：插件统一难度消费入口，
    自带 `level` 分档的插件自动识别（hasOwnLevel，通用难度不叠加）。
- **知识点标注体系**：Question 可选字段 `knowledgePointId` / `difficulty`
  （用于知识点关联与难度说明）；18 个插件完成统一消费迁移并标注
  （一~三年级基础插件全覆盖 + 口算/竖式 4 插件），竞赛类保留自身难度基线（6–10）。
- **综合练习自适应组卷**：按 KP 统计薄弱加权（<0.7 ×1.5）、极薄弱降档、
  薄弱前置注入 2 题/上限 ⌈count×30%⌉。
- **SVG 生成器层**：`shared/svg-core/geometry/calculation/make-ten.js`
  （平面图形+标注/立体图/变换演示、四则竖式含进借位与错误模式、凑十平十破十三行图解）。
- **站点页面**：FAQ 页、学科类型页（subject-types.html）、SEO 文件
  （sitemap.xml / robots.txt / llms.txt）。
- **测试矩阵**：test-difficulty（步骤6/7 回归块）、test-difficulty-structure（34 断言）、
  test-adaptive（23）、test-adaptive-e2e（14）、test-comprehensive-adaptive（13）、
  SVG 四件套测试 + verify-svg。

### 变更

- **知识库编号体系**：知识点 ID 全面迁移三段式 `g{grade}-{moduleIdLower}-{baseSlug}`
  （旧 ID 仅存 archive/migration-20260823）；五年级 C1–C9 竞赛插件全实现，
  六年级竞赛覆盖率 85%→100%。
- **样式架构**：拆分 tokens/base/components/toolbar/pages 五层 CSS（@layer 锁序）；
  页面与插件内联样式主题色全量迁移 tokens.css 变量（约 340 处，批次1–3）；
  新增令牌 `--brand-bg` / `--soft-bg` / `--line-strong`；
  index.html 移除自定义 :root 接入全局令牌；工具栏独立 toolbar.css。
- **随机数规范**：全仓运行时零 `Math.random()` 直调（crypto 优先统一熵源），
  洗牌统一 `PluginUtil.shuffle`（Fisher-Yates）；poolFill 改用 randInt。
- **Service Worker**：CORE 预缓存补齐 FAQ/学科类型页/SVG 模块/difficulty.js，
  缓存版本 v61→v64。

### 校验与工具链

- **零依赖提交门禁**：版本化 pre-commit 钩子 + GitHub Actions CI（npm test 三件套：
  verify-setup + verify-knowledge-bank + regression-check 124 组合满分回归）。
- **verify-knowledge-bank 第8条**：插件声明 ↔ 知识库双向对齐校验（违规非零退出阻断）。
- **test-difficulty 修复**：dedupe 键补 `q.q` 字段消除配对/口算类重复误报；
  数值均值断言大样本化抗抖动（连续 8 轮稳定通过）。
- 死代码归档：knowledge-slug-map 等 → `archive/dead-code-20260823/`（运行时零引用）；
  check-duplicates 变量遮蔽修复。

## [V2.1] — 2026-08-15

设计令牌统一主题、工具栏独立 CSS、卡片紧凑化与打印左对齐。

## [更早]

见 Git 历史（V2.0 及之前为站点初版与插件体系搭建阶段）。
