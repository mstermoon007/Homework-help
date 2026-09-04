# 项目结构文档（Project Structure）

> 本文档描述 **Homework Help** 仓库的目录与关键文件布局，是了解项目"哪里放什么"的速查索引。
> **四层逻辑归类（UI / 生成 / 知识 / 大服务）见 [ARCHITECTURE_LAYERS.md](ARCHITECTURE_LAYERS.md)，权威机器清单为 `architecture/layers.json`。**
> 架构与分层说明见 [DEVELOPMENT.md](DEVELOPMENT.md) §1/§3/§4；版本演进见 [DEV_LOG.md](DEV_LOG.md)。

---

## 0. 三层功能架构（一次印象）

```
UI 层（页面/交互）
   select.html · practice.html · subject/math/chinese/english-types.html · index.html · faq.html
        │  （只调 PracticeBridge 公开入口，不直接 new PracticeSession / GenerationEngine）
        ▼
关联层（Bridge / Coordinator）—— shared/practice-bridge.js
   统一出口 PracticeBridge（start / submit / newSession / onStartFeedback / onSubmitFeedback）
   外围控制层 PracticeBridge.control（ControlService·服务模式）：
       集中解析 数量 count · 难度 difficulty · 知识点 / 每知识点配额 kpAllocation，
       产出执行计划：single（单次直发）或 orchestrated（按知识点逐个生成并合并 = 知识点驱动生成）
       单次直发时构造 PracticeSession；编排式不修改生成层，仅并发调用其既有 start() 并合并。
        │  把 UI 意图翻译为生成层配置（count/difficulty/knowledgePointId(s)/questionType/adaptive/...）
        ▼
生成层（Frozen Core，M1–M7 引擎）
   PracticeSession · GenerationEngine · StrategyEngine · Generator/Retry/Validator · PresentationRenderer
   只消费：subject/grade/count/difficulty/knowledgePointId/knowledgePointIds/questionType/adaptive/...
   忽略：mode / subtype / pluginIds / kpAllocation（每知识点配额由关联层控制层编排补偿）
```

**分层约束（硬红线）**：
- 生成层（Frozen Core）禁止修改，仅允许授权 Bug Fix（见 DEVELOPMENT.md §6）。
- UI 层不得直连生成层；唯一入口是 `GenerationEngine.generate()`（`dev/check-ui-boundary.js` 门禁）。
- 关联层（practice-bridge.js）是 UI ↔ 生成层之间的翻译与编排枢纽，负责归一化指令与反馈。

---

## 1. 根目录

| 文件 | 作用 |
|------|------|
| `index.html` | 首页：双海报、科目/年级选择、一键开始、JSON-LD SEO |
| `subject-types.html` | 学科总入口 / 统一题型选择页 |
| `math-types.html` | 数学题型选择页（按模块 M0–M13/C1–C9 分组） |
| `chinese-types.html` | 语文类型页（重定向桩 → subject-types.html） |
| `english-types.html` | 英语类型页（重定向桩 → subject-types.html） |
| `practice.html` | **核心练习页**（统一宿主：生成/批改/打印/错题本/显示答案/计时/进度优化） |
| `faq.html` | 常见问题 |
| `sw.js` | Service Worker 离线缓存（缓存名随 APP_VERSION 同步） |
| `pinyin-bank.js` | 拼音词库（~79KB，语文插件数据源） |
| `package.json` | npm 脚本（校验/测试门禁、脚本生成），无 npm 依赖 |
| `README.md` | 功能说明（用户向） |
| `robots.txt` / `sitemap.xml` / `llms.txt` / `CNAME` | 站点可见性与部署配置 |

## 2. `shared/` — 唯一公共来源（single source of truth）

> 所有页面与插件引用 `shared/` 下的资源；根目录不再存在公共版 common/print。
> 逻辑四层归属（体现「UI 显示 / 生成引擎 / 知识库 / 大服务」）见 [ARCHITECTURE_LAYERS.md](ARCHITECTURE_LAYERS.md)。

### 2.1 关联层（本次外围控制层所在）
| 文件 | 作用 |
|------|------|
| `practice-bridge.js` | **关联层**：`PracticeBridge`（start/submit/newSession/onStartFeedback/onSubmitFeedback）+ 新增强制服务命名空间 `PracticeBridge.control`（ControlService），集中解析数量/难度/知识点/每知识点配额并编排知识点驱动生成 |

### 2.2 统一入口 / 运行时
| 文件 | 作用 |
|------|------|
| `common.js` | 聚合入口 + `PluginUtil`（随机/标准化/工厂/renderCard） |
| `core.js` | 运行时核心：crypto 随机、布局、路由 |
| `plugin-loader.js` | 插件加载器 + SW 注册 |
| `render.js` | 渲染工厂（createPlugin/createMathPlugin/createChinesePlugin/createEnglishPlugin/renderCard） |
| `check.js` / `ui-state.js` / `storage.js` | 批改 / 状态 / 本地持久化 |
| `difficulty.js` + `difficulty-static.js` | 难度系统（1–10 → 结构五档 + 自适应；static 为休眠基线） |
| `version.js` | 单一版本源（APP_VERSION / CACHE_VERSION） |

### 2.3 知识库系统（M1）
| 文件 | 作用 |
|------|------|
| `knowledge-bank.js` + `knowledge-{math,cn,en}.js` | 知识点库分片（数学/语文/英语） |
| `knowledge-ontology*.js` | 本体 schema / 归一化 / 校验（canonical 归一层） |
| `knowledge-point.js` / `knowledge-error.js` / `knowledge-operation.js` / `knowledge-factual.js` | 知识点模型与语义字段 |
| `module-catalog.js` | 模块目录（M0–M12、C1–C9、N1–N8、E1–E6） |
| `capability-{model,matrix,resolver}.js` + `capability-contract.js` + `capability-scan-context.js` | 能力模型与解析 |

### 2.4 生成引擎（M2–M7，Frozen Core）
| 路径 | 作用 |
|------|------|
| `generation-engine.js` | 统一生成入口（M4–M7 引擎装配） |
| `practice-session.js` | 生成会话（start/submit），只消费 count/difficulty/knowledgePointId(s)/adaptive 等 |
| `strategy/` + `strategy-engine.bundle.js` | 策略引擎（M3，计划 request） |
| `generator/` | 生成器契约/注册/选择/retry/legacy-adapter + `generators/` 实现 |
| `presentation/` + `presentation-engine.bundle.js` | 渲染器（M7，SemanticQuestion → HTML） |
| `learner/` | 学习者模型（M6，掌握度/错因/反馈） |
| `validator/` | 验证管线（M5） |
| `semantic-question.js` / `question-id.js` / `question-type-registry.js` | 语义题/题号/题型注册 |

### 2.5 SVG 生成器 / 样式（M7）
| 文件 | 作用 |
|------|------|
| `svg-{core,calculation,geometry,make-ten,chinese,english}.js` | SVG 生成器（凑十图、竖式、几何、田字格/拼音、四线三格） |
| `tokens.css` / `base.css` / `components.css` / `toolbar.css` / `pages.css` / `states.css` / `subjects.css` | 分层样式（@layer 锁序 tokens→base→components→toolbar→pages） |

## 3. `plugins/` — 题型插件
| 路径 | 作用 |
|------|------|
| `registry.js` | 插件注册表（约 95 条，id/name/subject/grades/moduleIds 映射） |
| `CONTRACT.md` | 插件核心契约（运行时不依赖文档体系） |
| `_template.js` | 新插件开发样板 |
| `math-*.js` / `chinese-*.js` / `english-*.js` | 各科目题型插件 |
| `math-comprehensive.js` | 综合练习（组卷/期末考试卷） |
| `math-competition-*.js` | 竞赛模块 C1–C9 专项（按年级/主题） |
| `competition/` | 竞赛判题子模块 |

## 4. `knowledge/` — 生成的 SEO 静态页
- `shared/knowledge-*.js` 的数据经 `scripts/generate-knowledge-pages.js` 生成 600+ 知识点详情页。
- 生成产物不统一提交策略（见 DEVELOPMENT.md §8）。

## 5. `dev/` — 校验 / 指纹 / lint / verify（质量门禁）
| 文件 | 作用 |
|------|------|
| `check-ui-boundary.js` | UI→Engine 边界门禁（UI 唯一生成入口 = GenerationEngine.generate） |
| `check-practice-page.js` | practice.html 职责门禁（9/9，统一入口 = PracticeBridge.start） |
| `check-frozen-core.js` + `frozen-core-baseline.json` | Frozen Core 漂移门禁（90 文件 + 基线） |
| `check-architecture-layers.js` | 四层架构归类门禁（`npm run verify:layers`，255 文件全归类） |
| `verify-pages.js` | 页面完整性门禁（各页依赖/关键DOM/入口脚本，123/123） |
| `check-architecture-rules.js` | M0 架构护栏（职责边界 R1–R5） |
| `lint-check.js` / `check-lint` | 插件 linter（R1 禁 Math.random / R2 禁硬编码颜色 / ...） |
| `verify-knowledge-bank.js` | 知识库结构与双向对齐校验 |
| `check-metrics.js` / `plugin-fingerprint.js` | 埋点查看 / 插件指纹监控 |
| `verify-svg.js` / `check-renderer-coverage.js` | SVG 结构 / 渲染覆盖 |
| `*.test.js` / `test-*.js` | Node 校验脚本 |

## 6. `scripts/` — 生成 / 同步脚本
| 文件 | 作用 |
|------|------|
| `generate-knowledge-pages.js` | 知识库静态页生成（哈希增量） |
| `inject-schema.js` | 核心页 JSON-LD 注入 |
| `generate-sitemap.js` | sitemap.xml 生成 |
| `new-plugin.js` | 新插件脚手架（10 分钟上手） |
| `add-g5-competition-entries.js` | 五年级竞赛条目生成 |
| `sync-sw-version.js` | SW 缓存版本同步校验 |
| `pre-commit.sh` / `githooks/` | 本地/版本化提交门禁 |

## 7. 测试
| 路径 | 作用 |
|------|------|
| `test/` | Node 测试（plugins / unit）+ 遗留 HTML 测试运行器 |
| `tests/` | 更细分的 Node 测试（presentation、generator、svg 等） |

## 8. 文档
| 文件 | 作用 |
|------|------|
| `docs/DEV_LOG.md` | 项目开发日志（版本演进 + 历史报告索引） |
| `docs/DEVELOPMENT.md` | 最新开发状态（架构、规范、Frozen Core、API 速查、SEO） |
| `docs/ARCHITECTURE_LAYERS.md` | **四层架构归类**（UI/生成/知识库/大服务）人类可读映射 + 红线 |
| `docs/PROJECT_STRUCTURE.md` | **本文档**（目录与关键文件布局） |
| `architecture/layers.json` | **权威四层机器清单**（`npm run verify:layers` 校验） |
| `README.md` | 功能说明（用户向）+ 文档导航 |
| `.workbuddy/memory/` | 开发助手内存（按日期，工作会话备忘） |

## 9. 其他
| 路径 | 作用 |
|------|------|
| `.github/workflows/ci.yml` | CI（push/PR 跑完整校验套件，Node 20） |
| `.gitignore` / `LICENSE` / `CNAME` | 忽略规则 / MIT 许可 / 部署域名 |
| `archive/` | 历史归档（死代码 / 迁移备份 / docs-2026-09） |
| `feedback/` | 问题反馈 |

---

> **核心不变，边界可扩。稳定是最大的功能。**