# Homework Help · 小学练习本

一个**完全免费、无广告、无弹窗**的网页练习工具，专为家长辅导孩子学习设计。

数学支持**一年级至六年级**，基础知识点全覆盖，并已上线**竞赛模块 C1–C9**（数字谜、数论、行程工程、巧算、综合应用等，4–6 年级）。题型紧贴人教版教材和常见练习册。只需选好年级、题量，点击按钮即可自动生成练习题，并支持在线作答、即时批改、错题纠正与打印输出。

---

## ✨ 核心特点

- 🆓 **永久免费** — 无任何收费项目，无需注册登录
- 🚫 **纯净体验** — 无广告、无弹窗、无诱导分享，专注学习本身
- 📚 **教材同步** — 题型基于人教版教材与主流练习册设计，数学覆盖一至六年级
- 🎲 **智能出题** — 基于统一随机熵源（`crypto` 优先）随机生成题目，每次练习都不重样
- ✅ **即时批改** — 一键检查答案，每题标对错，给出得分、正确率与鼓励语，错题直接展示正确答案
- 👀 **答案显隐** — 可随时显示或隐藏标准答案，方便自查或作为题卡使用
- ⏱️ **自动计时** — 题目生成后自动开始计时，提交答案时停止，帮助掌握做题速度
- 🖨️ **纯净打印** — 打印时自动隐藏所有按钮和无关元素，仅保留题目，生成 A4 友好的练习卷
- 🔒 **隐私安全** — 纯前端运行，无需服务器，题目和孩子作答数据不上传
- 📱 **离线可用** — Service Worker 缓存，安装后支持离线访问，跨页面插件缓存复用

---

## 🧩 内容覆盖

### 数学（1-6 年级 · 基础知识点覆盖率 100%，竞赛 C1–C9 已上线）

| 年级 | 覆盖知识点 |
|------|-----------|
| 一年级 | 数数与顺序、数的组成与数位、比大小、20 以内加减法、连加连减、凑十法、认识钟表、找规律、看图列式、认识图形、分类与统计、认识人民币 等 |
| 二年级 | 表内乘除法、100 以内加减混合、长度单位换算、认识时间、图形与几何、数据收集与整理、简单推理与数独 等 |
| 三年级 | 万以内加减法、多位数乘一位数、两位数乘两位数、除数是一位数的除法、**分数的初步认识**、**小数的初步认识**、**面积**、**复式统计表**、时间与日期、方向与位置、搭配与集合 等 |
| 四年级 | 大数的认识、公顷与平方千米、线段射线直线与角的度量、平行四边形与梯形、三位数乘两位数、除数是两位数的除法、四则运算与运算定律、**鸡兔同笼**、条形统计图、优化问题 等 |
| 五年级 | **小数乘除法**、**简易方程**、多边形的面积、位置、可能性、**因数与倍数**、长方体与正方体、**分数的意义与加减法**、折线统计图、找次品 等 |
| 六年级 | **分数乘除法**、**比与按比分配**、**百分数**、**圆**、**负数**、**圆柱与圆锥**、**比例**、扇形统计图、数与形、鸽巢问题 等 |
| 竞赛 4–6 年级 | **C1 竖式/数字谜**、**C2 数论**（奇偶/质因数/最大公因数与最小公倍数/余数同余）、**C5-C6 行程与工程**（相遇追及/火车流水/工程浓度）、**C7 巧算**（提取公因数/凑整/裂项）、**C9 综合应用**（和差倍/年龄/盈亏/鸡兔/植树/方阵/周期/牛吃草/经济/比例） |

> 题目由 23 个语义专用生成器按知识点路由产出：综合练习按知识库中各知识点的 weight 加权抽题，重点知识点出题更多，贴近教材结构；标准答案经引擎自批改闭环校验（错误答案 0）。

---

## 🚀 快速开始

### 在线使用
访问 GitHub Pages 或任意静态服务器地址即可直接使用。

### 本地运行
项目为纯静态网页，无需构建工具或后端环境。

```bash
# 克隆仓库
git clone https://github.com/mstermoon007/Homework-help.git

# 进入目录
cd Homework-help

# 直接打开 index.html，或使用本地服务器（推荐）
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

直接双击 `index.html` 也能运行，但推荐使用本地服务器以启用 Service Worker 离线缓存等能力。

---

## 🛠️ 技术栈

| 类别       | 技术                     |
|------------|--------------------------|
| 前端       | 原生 HTML/CSS/JavaScript（零第三方依赖，经典 `<script>` 加载） |
| 题目生成   | **native 生成引擎 V2.1**：知识点（549 个）→ 策略引擎 → 语义路由（23 个专用生成器 + 硬阻断）→ 语义题 → HTML/SVG 渲染；种子化随机可复现 |
| 知识点库   | `shared/knowledge-bank.js` + `shared/knowledge-math.js`（只读数据源，基础 M0–M12 + 竞赛 C1–C9） |
| 教学图形   | 图形描述符 → SVG 注册表分派（时钟/面积/分数/统计/几何/竖式/凑十等） |
| 离线缓存   | Service Worker（`sw.js`）按 APP_VERSION 预缓存，支持离线访问 |
| 质量保障   | Golden 自答案自批改（15 case 错误答案 0）、549/549 知识点覆盖、Frozen Core 基线、node:test 274 用例 |
| 打印优化   | 打印专用样式（去卡片化/紧凑密度）+ `@media print`，A4 友好 |

---

## 📁 项目结构

```
Homework-help/
├── index.html              # 首页：科目/年级选择 + 一键开始（JSON-LD SEO）
├── select.html             # 统一题型选择页（科目/年级/知识点三维选择）
├── subject-types.html      # 转发桩 → select.html（保旧链接）
├── math-types.html         # 转发桩 → select.html?subject=math
├── practice.html           # 统一练习页（生成/作答/批改/打印/错题本/计时）
├── faq.html / contact.html # 常见问题 / 问题反馈
├── sw.js                   # Service Worker 离线缓存
├── 技术文档--基础.md        # 引擎技术文档（架构/模块/契约/规范/门禁/决策）
├── 设计文档.md              # 设计计划与 UI 层设计说明
├── shared/                 # 唯一公共来源（single source of truth）+ Frozen Core
│   ├── common.js / core.js # 聚合入口 + PluginUtil（crypto 随机/标准化）/ normalizeAns
│   ├── render.js / check.js / print.js        # 题卡渲染 / 批改 / 打印路由
│   ├── practice-bridge.js / practice-session.js / generation-engine.js  # 关联层/会话/生成入口
│   ├── knowledge-bank.js / knowledge-math.js  # 549 个数学知识点（只读）
│   ├── strategy/           # 策略引擎（难度→数域/步数/算符约束）
│   ├── generator/          # 路由（selector/registry）+ generators/（23 个生成器）+ core/
│   ├── presentation/       # render-format / html-renderer / svg-registry
│   ├── validator/ learner/ # 验证管线 / 学习者模型
│   ├── svg-core.js / svg-calculation.js / svg-geometry.js / svg-make-ten.js / svg-templates.js  # 教学 SVG
│   └── tokens.css / base.css / components.css / states.css / toolbar.css / pages.css / subjects.css  # 分层样式令牌
├── plugins/                # 6 个教学图形 SVG 插件（clock/area/fraction/data-stats/draw/competition）
├── knowledge/              # 400+ 生成的 SEO 知识点静态页
├── architecture/layers.json# 权威四层架构机器清单
├── dev/                    # 校验/门禁/lint/bundle 脚本
├── scripts/                # 代码生成（knowledge 页/sitemap/JSON-LD/SW 版本同步）
├── test/ + tests/          # node:test 单元/契约测试（274 用例）
└── docs/                   # 文档：DEV_LOG.md（开发日志）
```

---

## 🧑‍💻 开发与贡献

- 📘 [技术文档--基础.md](技术文档--基础.md)：引擎架构、四层归类、运行时模块、知识库契约、开发规范、Frozen Core、质量门禁与设计决策（ADR）。
- 📐 [设计文档.md](设计文档.md)：设计目标与已落地设计计划、UI 层设计说明（页面流程、练习页、视觉令牌、打印、离线、SEO）。
- 📝 [docs/DEV_LOG.md](docs/DEV_LOG.md)：版本演进与开发日志流水。

常用开发命令：

```bash
npm run build:strategy      # 改 shared/ 源后重建策略 bundle
npm run verify:m4           # 生成器契约/注册表/覆盖（549 KP）/题型管线（583 QT）
npm run verify:golden       # 标准答案自批改（错误答案 0）
npm test                    # 硬门禁（SW 版本/对比度/知识库/难度锚点/SVG/lint）
npm run verify:frozen-core  # Frozen Core 基线校验
npm run generate:knowledge  # 知识库静态页增量再生成
```

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源，您可以自由使用、修改和分发，但请保留原作者信息。

---

**特别提醒**：学习本身需要父母的陪伴和引导，工具只是辅助。请合理安排使用时间，保护孩子视力。
