# 迁移关闭审计 — 完成报告（最终交付）

**Migr to Closure Audit — Completion Report (Final)**
- 审计类型：仅读（READ-ONLY）— 未改动任何业务代码 / gate / 测试 / 文件
- 审计范围：`/Users/zhanggaozhang/Code/Homework Help`
- 完成日期：2026-09-01
- 对应需求：R-A07..R-A11（本轮完成的只读关闭审计子项）
- 实时运行入口：`practice.html:461 PracticeSession.start()`
- HEAD 提交：`135ca55 chore: release v4.0.0 - Frozen Core architecture complete`

---

## 1. 审计目标与完成情况（Progress）

| # | 审计维度 | 需求 | 状态 | 备注 |
|---|---------|------|------|------|
| 1 | 迁移调用图（实时链路 + 依赖决策） | R-A07 | ✅ 完成 | `migration-call-graph.json` |
| 2 | 决策权归属（KP/题型/难度） | R-A08 | ✅ 完成 | `decision-authority-audit.json` |
| 3 | 生成器边界合规 | R-A09 | ✅ 完成 | `generator-boundary-audit.json` |
| 4 | 遗留生命周期（runtime vs gate） | R-A10 | ✅ 完成 | `legacy-lifecycle-audit.json` |
| 5 | 死代码 / 幻影引用 | R-A11 | ✅ 完成 | `dead-code-audit.json` |
| 6 | 运行入口 / 浏览器链路完整性 | R-A07 | ✅ 完成 | `runtime-entry-audit.json`（含 P0-001） |
| 7 | 冻结核与 HEAD 锚定 | — | ✅ 完成 | 本会话验证：P-012 dirty-worktree 锚定 |
| 8 | 随机/种子 + 校验器来源 | — | ✅ 完成 | 本会话验证：`context.seed` / `PE.generateQuestions` |
| 9 | 汇总报告 | — | ✅ 完成 | 本文件 + `migration-closure-summary.json` |

审计的所有待办项已完结。仅读约束始终满足：运行了既有 gate/脚本、读取/检索源码，未执行任何修改操作。

---

## 2. 重要结论（与进度）摘要

本会话在本体上补齐了此前子代理报告中「未决 / 仅记录」的关键项，并**首次以主源证据确认了两条高影响结论**：

### 2.1 P0-001 — 浏览器实时运行链路静默断裂（新确认，主源验证）
- `practice.html` 的 `<script>` 清单（161–203）**未加载 `shared/presentation-engine.js`**。
- `shared/presentation-engine.js` 仅用 `module.exports` 导出，**从不注册 `window.PresentationEngine`**（grep 零命中）；`strategy-engine.bundle.js` 也未内嵌它。
- 浏览器内 `GenerationEngine.getPresentationEngine()` → `ensure()`：`global.PresentationEngine` 未定义、浏览器 `require` 不可用 → 返回 `null`。
- `runPlans()` 第 198 行 `if (!PE) return null` → **每个 plan 被静默跳过**，`generate()` 无报错地以 `questions:[]` 结束。
- 影响：实时 UI（`PracticeSession.start()`）出题为空，Node 端 `npm test`/`verify` 因走 `require` 而完全检测不到。

### 2.2 P-012 — 冻结核基线锚定在「脏工作树」而非已提交 HEAD（新确认，主源验证）
- `git diff` 显示 `shared/presentation/renderer.js`（**冻结文件**）、`practice.html`、`shared/generator/graphic-renderer.js`（非冻结）存在**未提交修改**。
- `check-frozen-core` 通过 93/93，仅因为 `dev/frozen-core-baseline.json` 从当前工作树重新生成、吸收了上述未提交改动。
- 即「冻结核 93 文件无变更」的断言**不锚定于已发布的 HEAD `135ca55`**，属于 provenance 风险。

### 2.3 更正两条此前子代理的过度/不足判断
- `capability-resolver` 由「DEV_ONLY」更正为 **ACTIVE_RUNTIME**：经 `strategy-engine.bundle.js` 打包在浏览器中可用，只是无独立的 `window.CapabilityResolver` 全局。
- 随机/校验器来源确认：`arithmetic.js` 用确定性 `context.seed`（29/91 行 `seedFor`）；校验器委托在 `PE.generateQuestions(plan,{skipValidation})`（即受 P0-001 影响的未加载模块）。

---

## 3. Gate 矩阵（只读实测）

| Gate | 退出码 | 基线是否准确 | 归属 |
|------|-------|-------------|------|
| `npm test` | 0 | — | 通过 |
| `npm run verify` | 0（7/7） | — | 通过 |
| `npm run verify:m4` | **1** | 基线不准确 | 已证明在 HEAD `135ca55` 即失败（非回归） |
| `npm run verify-svg` | 0 | — | 通过 |
| `npm run test:regression` | **1** | 基线不准确 | 已证明在 HEAD 即失败；PASS214/FAIL818/PLAN_ERROR774，从未绿 |
| `npm run check-duplicates` | 0 | — | 通过 |
| `npm run check-frozen-core` | 0（93/93） | 有 P-012 锚定问题 | 仅在脏工作树基线内自洽 |

结论：声称的基线不准确；`verify:m4` 与 `test:regression` 均为 HEAD 级既有失败（非本会话回归）。

---

## 4. 十项审计问题 — 终答

| # | 问题 | 终答 |
|---|------|------|
| Q1 | 是否存在单一实时运行入口且浏览器链路完整？ | **否** — P0-001 浏览器链路静默断裂 |
| Q2 | 次级/遗留决策中心是否在实时链路中失活？ | 大体是（`generateViaEngine` 死代码、次级难度被 `difficultyParams==null` 守卫）；受 P0-001 遮蔽 |
| Q3 | 生成引擎是否遵循单一决策权（策略层）？ | 实时链路是；难度存在双居（策略为主，遗留静态中心休眠） |
| Q4 | 冻结核文件是否有漂移？ | 相对基线条目无漂移，但基线锚定脏工作树（P-012） |
| Q5 | 冻结文件内是否存在契约/适配器失配（M4-R02）？ | **是（HEAD 级既有）** — `legacy-plugin-adapter.js:189`（`svg:` 禁用键 + `answerMode:'choice'`）→ `verify:m4` 失败 |
| Q6 | 回归是否绿（M4-R16）？ | **否（HEAD 级既有）** — 从未绿 |
| Q7 | 声称的基准门是否如实？ | **否** — 基线不准确 |
| Q8 | 幻影/死引用是否为非运行时？ | 是（LOW）— `../render.js`、`enrich-knowledge-bank.js`，0 运行时幻影引用 |
| Q9 | 随机/种子/校验器/图源变更是否隔离到冻结/已知文件？ | 部分 — 随机确定性、校验器归入未加载模块；图源变更未锚定 HEAD（P-012） |
| Q10 | 声称的 READY 基线是否可复现？ | **否** — 无法支持 READY_FOR_MIGRATION_FREEZE |

---

## 5. 最终裁决（Verdict）

# **NOT_READY（不可冻结）**

### 阻断项（BLOCKERS — 冻结前必须解决）
1. **P0-001** 浏览器实时生成链路静默返回空题集。
2. **M4-R02** `verify:m4` 失败（冻结适配器/契约失配，HEAD 级既有）。
3. **M4-R16** `test:regression` 从未绿（HEAD 级既有）。
4. **P-012** 冻结核基线未锚定干净 HEAD（provenance）。

### 遗留债务（KNOWN_DEBT）
- 次级/休眠遗留难度中心（`difficulty.js`/`difficulty-static.js`）仍由 practice.html:162-163 加载。
- capability-resolver 打包可用但无独立全局。
- 难度决策双居（策略主 + 遗留静态）。

### 低危 / 误报（LOW / FALSE_POSITIVE）
- ~~P-010 幻影 `require('../render.js')`（PRESENTATION-ENGINE 180/204，被 PluginUtil 守卫遮蔽）~~ → **已修复**（C06 清理：改为 `./render.js`，Node 直调 renderQuestions/checkAnswers 恢复可用）。
- ~~P-011 `docs/seo-monitoring.md:21` 指向不存在的 `scripts/enrich-knowledge-bank.js`~~ → **已删除**（C06 清理）。
- ~~`generateViaEngine()`（practice.html:376/388/403）为死代码/遗留代码~~ → **已物理删除**（C06 清理：连同 `buildGenerationRequest`/`doGenerate`/`sqToLegacyQuestion`，live 入口统一为 `practiceSession.start()`）。

---

## 6. 推进建议（后续冻结前步骤，非本次执行）
- (a) 将 `presentation-engine.js`（及 `svg-core.js`/`plugins/svg-*.js`）接入浏览器运行时，解除 P0-001；
- (b) 处理 `verify:m4` 适配器/契约失配与 `test:regression`；
- (c) 提交并重新锚定冻结基线到干净的 HEAD，关闭 P-012。

---

## 7. 交付工件（交付于 `dev/migration/`）
- `migration-closure-report.md`（主报告）
- `migration-closure-summary.json`（汇总）
- `migration-call-graph.json`
- `runtime-entry-audit.json`
- `decision-authority-audit.json`
- `generator-boundary-audit.json`
- `legacy-lifecycle-audit.json`
- `dead-code-audit.json`

> 本审计为仅读。未对任何业务代码、gate、测试或文件实施修改。审计至此结束。
