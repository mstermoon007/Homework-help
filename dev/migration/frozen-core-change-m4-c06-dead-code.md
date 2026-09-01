# M4-C06 FROZEN_CORE_CHANGE 报告 — 幻影 require 路径修复（死代码清理配套）

> 授权变更类型：C06 无效代码清理（P-010 phantom require 修复）。
> 生效提交：待定（本批次提交）。
> 门禁证据：presentation-runtime PASS；`npm test` PASS（含 219 SVG）；`verify:m4` PASS（60 pass/0 fail）；
> `test:regression` PASS 1074 / FAIL 0 / PLAN_ERROR 0；各 M7 手工门禁 PASS；frozen-core 93/93 重锚。

## 1. 变更原因

C04/C05 死代码审计（`dead-code-audit.json`）记录 P-010：`shared/presentation-engine.js:180,204`
的 `require('../render.js')` 为幻影引用——该相对路径从 `shared/` 解析到项目根 `render.js`（不存在），
被 `global.PluginUtil` 守卫遮蔽，导致 Node 环境（未注入 PluginUtil 全局时）直调
`renderQuestions`/`checkAnswers` 会抛 `MODULE_NOT_FOUND`。

实际文件为 `shared/render.js`（存在且导出 renderCard/renderGrid/defaultCheck），
正确相对路径为 `require('./render.js')`。

## 2. 变更内容（冻结文件 1 个）

### 2.1 `shared/presentation-engine.js`
- `renderQuestions`（原 180 行）与 `checkAnswers`（原 204 行）：`require('../render.js')` → `require('./render.js')`。
- 修复后 Node 直调两个函数均正常（已验证：renderQuestions 产出 HTML 字符串、checkAnswers 返回分数结构）。

### 2.2 配套重建（非冻结）
- `shared/presentation-engine.bundle.js`：重建（inlined 6 / delegated 89），
  `./render.js` 归一化为 `shared/render.js`，委托 strategy bundle 已注册的 `__defs["shared/render.js"]`（4152 行）。

## 3. 非冻结配套（dev / 文档）

- `practice.html`：物理删除死代码块 `buildGenerationRequest`/`generateViaEngine`/`doGenerate`/`sqToLegacyQuestion`
  （never invoked；live 入口统一为 `practiceSession.start()`）。
- `docs/seo-monitoring.md`：移除对不存在 `scripts/enrich-knowledge-bank.js` 的引用（P-011）。
- 门禁对齐（断言 live 入口而非死符号）：`dev/check-m7-final.js` R16、`dev/check-practice-page.js`、
  `dev/check-ui-boundary.js` [A]、`dev/check-p6-render-print.js` [1] → 断言 `practiceSession.start()`。
- `dev/migration/audit-completion-report.md` / `dev/migration/dead-code-audit.json`：标记 P-010/P-011/DEAD-001 已解决。
- `dev/migration/m1-m4-old-debt-scan.md`：新增 5.7 C06 清理记录。

## 4. 影响面与回归

| 项 | 结果 |
|----|------|
| presentation-runtime（C01/C02 浏览器运行时 + E2E） | PASS |
| `npm test`（含 verify-svg 219 SVG） | PASS |
| `npm run verify` | PASS（7/7） |
| `npm run verify:m4` | PASS（60 pass / 0 fail） |
| `npm run test:regression` | PASS 1074 / FAIL 0 / PLAN_ERROR 0 |
| check-practice-page / check-ui-boundary / check-p6-render-print / check-m7-final | PASS（R36 既有失败除外） |

- 既有失败（非本次引入）：`check-architecture-final.js` R36「Generator has no Renderer dependency (graphic-renderer.js)」。

## 5. 基线重锚

以上 1 个冻结文件（`shared/presentation-engine.js`）为核心授权修复，基线已重锚（93/93）。
