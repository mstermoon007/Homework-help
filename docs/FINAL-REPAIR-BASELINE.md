# FINAL-REPAIR-BASELINE

> 本文件是 FINAL 专项的**唯一事实基线**。AI 每次开始任务前必须读取此文件。
>
> 所有数据均由当前仓库实际状态采集（2026-09-22），非历史记忆。

## 基本信息

| 项 | 值 |
|---|---|
| **Version** | `5.0.0`（package.json） |
| **KBL catalog** | `math-v1.0.0` |
| **KBL package** | `kbl-math-2026-09-16` |
| **KBL hash** | `18a21dfba5ce951e5024dca74ad92cbeb11c43156e5aa203d3dadc7c70c7704b` |
| **KBL snapshot** | `kbl-math-v1.0.0-18a21dfb` |

## 数据资产

| 项 | 值 |
|---|---|
| **KP** | 375 |
| **Units** | 98 |
| **Relations** | 0 |
| **Mappings** | 1570 ALLOW |
| **QuestionTypes** | 7（calc / fill / choice / judge / geometry / classify / apply） |
| **Generators** | 24 源文件（31 注册实例） |

## 测试

| 项 | 值 |
|---|---|
| **Test files** | 58 |
| **Test count** | 534（100% PASS，0 FAIL） |
| **Test suites** | 9 |

## 教育语义

| 项 | 值 |
|---|---|
| **GENERATION_PASS** | 0 |
| **SEMANTIC_PASS** | 7 |
| **SEMANTIC_WARN** | 914 |
| **SEMANTIC_FAIL** | 0（A-class FAIL = 0） |
| **A-class 合计** | 921 PASS / 0 FAIL |

## 构建产物

| 项 | 值 | SHA-256 |
|---|---|---|
| `strategy-engine.bundle.js` | 约 552 KB | `ea290591…` |
| `presentation-engine.bundle.js` | 约 146 KB | `5047b044…` |

## 门禁状态

| 域 | 状态 |
|---|---|
| **check-all** | 26 PASS / 0 FAIL |
| **Security** | PASS（0 eval / 0 new Function / innerHTML 全 esc / SVG Sanitizer / print CSP） |
| **Crawler** | PASS（Sitemap 381 URL / AI Agent 抓取 375/375） |
| **AI** | PASS（LLM 可读体检） |
| **Difficulty** | PASS（权威链唯一 / 无二次计算） |
| **SVG** | PASS（contract + Sanitizer 25/25 / 无静默失败） |
| **Presentation** | PASS（单一 Renderer / legacy 隔离） |
| **Learner** | PASS（状态链完整：error-model → learner-model → learner-storage → practice-result → result-collector） |
| **Browser E2E** | PASS（并发契约 + 生成链） |
| **Dead Code** | PASS |
| **Legacy** | PASS |

## Git 状态

| 项 | 值 |
|---|---|
| **Branch** | `01page-report` |
| **Head** | `367147f` docs(P28-54): 固化 P28 后 AI 编程规则 |
| **Working tree** | clean |

## 已确认完成（不再修改）

以下内容经当前仓库实际验证通过，已冻结：

- KBL 数据（375 KP / 98 Units / 0 Relations / 1570 mappings）
- 7 题型定义（calc / fill / choice / judge / geometry / classify / apply）
- 生成链全链路（1570/1570 Generate→Validate→SemanticQuestion→Render）
- 难度权威链（唯一 / 无二次计算）
- SVG contract + Sanitizer
- Validator（安全表达式 / 无 new Function）
- 单一生产 Renderer
- Learner 状态链（五模块）
- Web 元数据（Sitemap / Robots / Canonical / AI-readable）
- Security（0 uncontrolled dynamic execution / 0 unvalidated HTML / 0 unvalidated SVG）
- CI（本地 = CI，`npm run check-all`）
- Docs（唯一 CURRENT BASELINE）

## 已确认删除

- `shared/presentation/render.js`（P28-45 删除，legacy renderer 已隔离）
- `shared/semantic/semantic-question-bridge.js`（P28-45 删除）
- dev/p25-p27 生成报表 JSON（可由 check-all 重生成）

## 本专项明确不再修改

- 架构层级（`docs/01-ARCHITECTURE.md` 冻结表）
- 知识点数据（KBL 已冻结）
- 题型定义（7 类已冻结）
- 契约接口（type-contract / generation-contract / knowledge-contract / generator-contract）
- Bundle 构建流程（build:presentation / build:strategy）

---

> **FINAL-00 唯一事实基线**：本文件是 FINAL 专项的唯一有效信息来源。旧聊天记录、旧审计报告、旧截图、旧统计数字、旧 AI 记忆均视为历史信息，除非当前源码验证后仍然存在，否则不得重新执行。
