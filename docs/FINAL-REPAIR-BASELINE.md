# FINAL-REPAIR-BASELINE — 最终修复事实锁

> **AI 每次开始任务前必须读取此文件。**
> 本文只记录当前真实状态，所有数值均于 **2026-09-22** 从仓库实际源码采集（FINAL-00 优先级：①源码 ②root Excel ③package.json/VERSION ④测试结果 ⑤生成结果 ⑥docs/00-BASELINE.md ⑦专项任务书）。
> 旧聊天/旧审计/旧 P13–P28 报告/旧截图/旧数字/旧 AI 记忆一律视为历史信息，除非当前源码验证后仍然存在，否则不得重新执行。

---

## 0. 采集方法（可复现）

```bash
# 版本（三方一致）
cat VERSION ; node -p "require('./package.json').version" ; grep "APP_VERSION" shared/catalog/version.js ; grep "const CACHE" sw.js

# KBL / Unit / Mapping / Relation 计数
node -e "const k=require('./kbl/canonical/knowledge.json');console.log('KP',k.knowledge.length,'count',k.count)"
node -e "const c=require('./kbl/canonical/course.json');console.log('Units',c.course.reduce((s,e)=>s+e.unitCount,0))"
node -e "const m=require('./kbl/canonical/mappings.json');console.log('Mappings',m.mappings.length,'ALLOW',m.mappings.filter(x=>x.allow!==false).length)"
node -e "const r=require('./kbl/canonical/relations.json');console.log('Relations',r.relations.length)"

# 哈希
shasum -a 256 kbl/canonical/*.json
shasum -a 256 shared/engine/*.bundle.js

# 生成器 / 题型 / sitemap
grep -c "id: 'generator:" shared/generator/generator-registry.js
grep -c "<loc>" sitemap.xml

# 全量门禁
npm test
npm run check-all
```

---

## 1. Version

| 项 | 值 | SSOT |
|---|---|---|
| 版本号 | **5.0.0** | `VERSION` = `package.json.version` = `shared/catalog/version.js APP_VERSION` |
| SW 缓存名 | `hw-help-5.0.0` | `sw.js` `const CACHE` |
| 三方一致 | ✓ | `scripts/sync-sw-version.js`（check-all #1 PASS） |

---

## 2. KBL hash（SHA256）

> 主 KBL 哈希取 `kbl/canonical/knowledge.json`；并列出全部 canonical 文件哈希以供交叉核验。
> 哈希由 `shasum -a 256` 产出，可再生。

| 文件 | SHA256 |
|---|---|
| `kbl/canonical/knowledge.json` | `cf5f0062353fed1fe94eb9a889305d6002d684529921f358748ccf2b277c5401` |
| `kbl/canonical/course.json` | `316d1d34a2093388e1490675ec0c9d913f5c33f4cfdd173c9454f172711429e5` |
| `kbl/canonical/mappings.json` | `88534f878e1c8593d1c494c8a6c11e34ce9101e89397bccef81d58150594a2f8` |
| `kbl/canonical/relations.json` | `2d2e14aed5c1c15f82328860421a1782376a57384fe8929a4b5e7ce9a736e142` |
| `kbl/canonical/capability.json` | `ec70ef7676970a2430ca99482b801815af26f7988d191c5fab666a619942a1a2` |

---

## 3. KP / Units / Relations / Mappings

| 项 | 值 | SSOT |
|---|---|---|
| KP（知识点） | **375** | `kbl/canonical/knowledge.json`（`knowledge[]`=375，`count`=375） |
| Units | **98** | `kbl/canonical/course.json`（12 个学科-年级-册条目，`unitCount` 之和 = 6+8+8+7+9+8+9+10+9+11+7+6 = 98） |
| Relations | **0** | `kbl/canonical/relations.json`（`relations[]`=0） |
| Mappings ALLOW | **1570** | `kbl/canonical/mappings.json`（`mappings[]`=1570，全部 allow） |

---

## 4. QuestionTypes

| 项 | 值 | SSOT |
|---|---|---|
| Canonical 题型 | **7** | `shared/knowledge/question-type-registry.js` `TYPES[]` |
| 列表 | `calc` / `fill` / `choice` / `judge` / `geometry` / `classify` / `apply` | 同上 |

---

## 5. Generators

| 项 | 值 | SSOT |
|---|---|---|
| Generator 总数 | **31** | `shared/generator/generator-registry.js`（`id: 'generator:` 计数 = 31） |
| PRODUCTION | **21** | 同上 |
| PRODUCTION-COMBINE-ONLY | **1**（`generator:composite`） | 同上 |
| DORMANT-CONTRACT-CARRIER | **2**（`selection-choice` / `selection-judge`） | 同上 |
| DORMANT-NO-BINDING | **7** | 同上 |

---

## 6. Production Generators

**21** 个 PRODUCTION Generator（`shared/generator/generator-registry.js`，scope=core 且有 KP 绑定）。Generator 文件 24 个（`shared/generator/generators/*.js`）。

---

## 7. Tests

| 项 | 值 | SSOT |
|---|---|---|
| 测试用例 | **534** | `npm test`（`node --test "tests/**/*.test.js"`） |
| PASS | **534** | 同上 |
| FAIL | **0** | 同上 |
| 套件 | 9 | 同上 |
| 测试文件 | 58 | `tests/**/*.test.js` |

---

## 8. Education PASS/WARN/FAIL

| 项 | 值 | SSOT |
|---|---|---|
| 教育语义生成 | **PASS** | `npm run verify:education` / check-all #7 |
| 覆盖率报告 | **PASS** | check-all #8 |
| 金题集校验 | **PASS** | check-all #9 |

---

## 9. Bundle hash（SHA256）

| 文件 | SHA256 |
|---|---|
| `shared/engine/strategy-engine.bundle.js` | `ea290591d44814bf0c4bca893b686823d45988c7784f82258ce71d9336b1595f` |
| `shared/engine/presentation-engine.bundle.js` | `5047b0445b219867fca0f8de591e2afbc76c46fbb4b37910d3d9bcf364013345` |

---

## 10. SVG

| 项 | 值 | SSOT |
|---|---|---|
| SVG 契约 + Sanitizer | **PASS** | check-all #12 |
| 测试 | `tests/presentation/svg-contract.test.js` + `svg-contract-full.test.js`（P28-26/27 契约） | `npm test` 内全 PASS |

---

## 11. Validator

| 项 | 值 | SSOT |
|---|---|---|
| AnswerValidator | **PASS**（Tokenizer→Parser→AST→Safe Evaluator，无动态执行） | `shared/validator/answer-validator.js` / check-all #13 |
| 测试 | `tests/validator/` 全 PASS | `npm test` |

---

## 12. Browser E2E

| 项 | 值 | SSOT |
|---|---|---|
| 并发契约 + 生成链 | **PASS** | check-all #17 |

> 浏览器 E2E 当前以"并发契约 + 生成链"静态契约校验形式存在（check-all #17 PASS）。完整路径 E2E（首页→学科→年级；快速→题型→KP→生成；教师→KP A→KP B→取消→A→练习；打印；Service Worker 离线）见 FINAL-REPAIR-STATUS.md 的 PENDING 项。

---

## 13. Sitemap

| 项 | 值 | SSOT |
|---|---|---|
| URL 总数 | **381** | `sitemap.xml`（`<loc>` 计数 = 381） |
| 组成 | 5 公共页 + 375 KP 页 + 1 索引页 | 同上 |
| 逐 URL 保证 | HTTP 200 / 无 redirect / 文件存在 / canonical 一致 | check-all #14 PASS |

---

## 14. Security

| 项 | 值 | SSOT |
|---|---|---|
| `eval(`/`new Function(` | 生产代码 **0 命中** | check-all #13 |
| AnswerValidator | 无动态执行 | 同上 |
| HTML 安全边界 | 题目文本/答案/解析/SVG 全经安全渲染管线 | `shared/presentation/` |
| SVG 安全 | SVGSanitizer 处理；禁止 raw SVG 入 DOM | `shared/svg/` |
| KBL 写保护 | 唯一可写方 = 离线派生白名单 | check-all #2（AI 边界） |
| 总结果 | **PASS** | check-all #13 |

---

## 15. Performance

| 项 | 值 | SSOT |
|---|---|---|
| 零运行时依赖 | 纯前端静态站，`package.json` 无 `dependencies` | `package.json` |
| `npm test` 耗时 | ~6s（534 用例，实测 5781ms） | `npm test` |
| `npm run check-all` | 26 PASS / 0 FAIL | `dev/check-all.js` |

---

## 16. Git status

| 项 | 值 |
|---|---|
| HEAD | `3cf88a2842ed632b21b0713d1f1a3df33722c41e`（`3cf88a2 chore: 更新 P28 生成矩阵归档快照`） |
| 工作树 | 2 个已修改文件：`tests/presentation/svg-contract.test.js`、`tests/presentation/svg-contract-full.test.js`（FINAL-10 修复绝对路径，已 VERIFIED） |
| 未跟踪 | 0（新文档创建后将出现在工作树，提交前由用户确认） |

---

## 17. check-all 汇总（2026-09-22）

```
合计：26 PASS / 0 FAIL / 26 项
 1  Version      (SW 版本一致)              PASS
 2  KBL          (M0 聚合门禁)              PASS
    KBL          (AI 边界 + 页面漂移)        PASS
 3  Lint         (静态质量)                 PASS
 4  Syntax       (全量 JS 语法)             PASS
 5  Unit         (全链测试 534)             PASS
 6a Generation  (1570 ALLOW 真实生成)       PASS
 6b Generation  (矩阵冻结)                 PASS
 6c Generation  (Generator Registry)        PASS
 6d Generation  (四轴不夺权)                PASS
 7  Education    (教育语义生成)              PASS
 8  Coverage     (覆盖率报告)               PASS
 9  Golden       (金题集校验)               PASS
 10a Difficulty  (权威链唯一)              PASS
 10b Difficulty  (溯源)                    PASS
 11 Presentation (渲染 + Legacy 隔离)        PASS
 12 SVG          (契约 + Sanitizer)        PASS
 13 Security     (eval/Function + Validator + HTML + KBL写保护) PASS
 14 Sitemap      (381 URL 冻结)            PASS
 15a Crawl       (AI Agent 抓取 375/375)    PASS
 15b Crawl       (爬虫健康)                PASS
 16 LLM          (AI 可读体检)             PASS
 17 Browser/E2E  (并发契约 + 生成链)        PASS
 18 Doc          (历史数字扫描)             PASS
 19 Dead Code    (死代码矩阵)              PASS
 20 Legacy       (Legacy 治理矩阵)          PASS
```

---

## 18. 已经确认完成

- `npm run check-all`：**26 PASS / 0 FAIL**（2026-09-22）。
- `npm test`：**534 PASS / 0 FAIL**。
- KBL canonical 数据冻结：375 KP / 98 Units / 0 Relations / 1570 ALLOW，全部从源码核验一致。
- Version 三方一致：5.0.0。
- FINAL-10：测试绝对路径修复（`tests/presentation/svg-contract*.test.js` 改用 `path.resolve(__dirname, '../..')`），已 VERIFIED（npm test 534/534）。

---

## 19. 已经确认删除（2026-09-22 从 `shared/` 核验已消失）

| 符号 / 文件 | 原位置 | 核验 |
|---|---|---|
| `LegacyRenderer` | `shared/presentation/render.js` | grep `shared/` 0 命中 |
| `SemanticQuestionBridge`（含文件） | `shared/generator/semantic-question-bridge.js` | 文件不存在 + grep `shared/` 0 命中 |
| `createFromLegacyUI` / `normalizeLegacyParams` / `isLegacyRequest` | `shared/strategy/strategy-request.js` | 符号已删 + **文件已删除（FINAL-16）**；活符号 normalizeRequest/validateRequest 内联至 strategy-engine.js |
| `isLegacy()` / `legacyFallback`（含文件） | `shared/strategy/strategy-config.js` | 文件不存在（FINAL-16）+ grep 0 命中；活符号 difficultyAnchorOf 内联至 difficulty-strategy.js |

> 上述删除项不因历史对话重新打开；如需复核，跑 `node dev/p28/check-dead-code.js` 与 `node dev/p28/check-legacy-matrix.js`（check-all #19/#20）。

---

## 20. 已经确认冻结

> 完整任务状态见 `docs/FINAL-REPAIR-STATUS.md`。本节列当前已 FROZEN 的不变量（验证通过即冻结，非当前测试失败不重开）：

- KBL 375/375
- 1570 ALLOW（矩阵冻结，FAIL=0）
- 7 题型（calc/fill/choice/judge/geometry/classify/apply）
- 31 Generator（21 PRODUCTION + 1 COMBINE-ONLY + 2 DORMANT-CARRIER + 7 DORMANT-NO-BINDING）
- Difficulty 权威链（唯一 + 溯源）
- SVG 契约 + Sanitizer
- Validator（AnswerValidator 无动态执行）
- Presentation（渲染 + Legacy 隔离）
- Version 三方一致（5.0.0）
- Sitemap 381 URL 冻结
- Security（eval/Function 0 命中）

---

## 21. 本专项明确不再修改

- 架构层级（`docs/01-ARCHITECTURE.md` 冻结表）——不新增层、不新增顶层源码目录、不下沉到 `shared/` 之外。
- KBL canonical 数据（`kbl/canonical/*.json`）——仅离线派生白名单可写，运行时只读；AI 不改 root Excel。
- 7 个 canonical 题型定义——不增删题型。
- 31 Generator 声明表——不新增 Generator、不重写 Generator。
- Bundle 产物——除非策略/表示层源码变更并同步重建，否则不动 `shared/engine/*.bundle.js`。
- 已删除符号（见 §19）——不重建、不加兼容层/shim/adapter。

---

## 22. 禁止历史回流（FINAL-00 / FINAL-02）

AI 开始任务前的读取优先级与任务状态机制见：
- 读取优先级：本文件 §0 与文件头。
- 任务状态：`docs/FINAL-REPAIR-STATUS.md`（PENDING / IN_PROGRESS / FIXED / VERIFIED / FROZEN）。
- 延后项：`docs/FINAL-REPAIR-DEFERRED.md`。

**FROZEN 项除非出现当前测试失败，禁止因历史对话重新审计。**
