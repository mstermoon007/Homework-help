# 更新日志（CHANGELOG）

本文件记录 Homework Help 的版本演进。格式参照 Keep a Changelog，版本号遵循
语义化版本（大版本.功能.修复）；每个大版本的完整变更以 Git 标签为锚点
（`git log V2.1..V3.0` 可查看全部提交）。

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
- **Adaptive v2**（`App.Adaptive`）：知识点粒度主键 `(subject:grade:pluginId[:kpId])`、
  难度加权正确率（Σ答对难度/Σ全部难度）、EMA 平滑、基于 (emaRate,lastRate) 的新调整规则、
  `getPrerequisiteStatus` 前置状态查询；v1 数据自动迁移。
- **知识点标注体系**：Question 可选字段 `knowledgePointId` / `difficulty`，
  practice.html 批改后经 `recordSession` 采集；18 个插件完成统一消费迁移并标注
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
