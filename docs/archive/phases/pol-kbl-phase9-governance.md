# POL–KBL Phase 9：代码治理与 Clean Baseline（P9-0～P9-8 执行记录）

> 执行时间：2026-09-13
> 范围：**P9-0～P9-8 纯清理**（P9-9 B5/B6/B7、P9-10 G1 数据治理待后续授权）
> 原则：删无效/删重复/删断链/删冗余门禁/删冗余探针；**不新增架构、不新增 Gate/Probe/Validator、不改 Frozen Core/KBL 语义/难度公式/UI**
> 验证：`npm test` 全链 PASS（见 §6）

---

## 1. P9-0 治理基线

| 项 | 值 |
|---|---|
| 起始 git | 39 ?? / 100 D / 56 M（均为历次授权阶段产物） |
| 门禁脚本（起始） | 41 个（dev/check-* 30 + verify-* 6 + test-* 5） |
| 零引用运行时对象（起始） | 5 个 |
| 孤儿门禁（未接线） | 2 个 |
| 生产探针 | 0（`shared/` 无 probe/debug 临时逻辑；logger DEBUG/capacity probes/strategy trace 为正式能力） |

---

## 2. 表一：删除台账

| 文件/对象 | 原因 | 引用数 | 生产职责 | 删除结果 | 验证 |
|---|---|---|---|---|---|
| `shared/capability/capability-contract.js` | 零引用契约模块（旧 M2-R03 门禁已删） | 0 | 无 | 删除 | 零引用扫描 |
| `shared/generation/dto.js` | 零引用 JSDoc DTO（契约已入 pol-contract §12） | 0 | 无 | 删除 | 零引用扫描 |
| `shared/schemas/knowledge-point.schema.js` | 零引用 schema（旧 normalizer 已删） | 0 | 无 | 删除 | 零引用扫描 |
| `shared/knowledge/schema/curriculum-schema.js` | 零引用 KBL stub（validate 使用 knowledge-schema） | 0 | 无 | 删除（KBL 数据/rootHash 不变） | kbl:verify |
| `shared/knowledge/schema/generation-contract-schema.js` | 同上 | 0 | 无 | 删除 | kbl:verify |
| `dev/check-core-integrity.js` | 孤儿门禁（仅 verify-setup 断言其存在，从未执行） | 1（仅存在性） | 无 | 删除 + 移除 verify-setup 断言 | verify-setup PASS |
| `dev/check-metrics.js` | 孤儿工具（Node 无 metrics 数据路径） | 0 | 无 | 删除 + metrics.js 注释更新 | 零引用扫描 |
| `dev/check-generator-mode.js` | 与 `tests/generator/generator-mode.test.js` 重复 | 1（npm chain） | 无（合并） | 独有检查并入测试后删除 + verify:m4 移除 | 测试 8/8 |
| `tests/test-runner.html` | 引用已删 API（PluginUtil.randInt / App.buildPluginLink） | 0 | 无 | 删除 | 失效测试清理 |
| `tests/e2e/practice-restore-e2e.js` | 不可运行（需 jsdom），覆盖被正式 E2E 取代 | 0 | 无 | 删除 | 正式 E2E PASS |
| `tests/snapshot/snapshot.json` | 已退役结构基线（技术文档 §9.3 声明） | 0 | 无 | 删除 | 文档已声明 |

**同步修改**：`architecture/layers.json`（移除 6 条目）、`package.json`（verify:m4 去 gate）、`dev/verify-setup.js`（去断言）、`shared/state/metrics.js`（注释）。

---

## 3. 表二：重复职责表

| 职责 | 实现 A | 实现 B | 权威实现 | 处置 |
|---|---|---|---|---|
| Generator 双轨许可 | `dev/check-generator-mode.js`（gate） | `tests/generator/generator-mode.test.js`（test） | **test** | A 独有检查并入 B；A 删除 |
| Generator 契约 | `dev/check-generator-contract.js`（源码禁止项扫描） | `tests/generator/generator-contract.test.js`（API 校验） | 两者互补 | 保留 |
| Generator Registry | `dev/check-generator-registry.js`（数据完整性/覆盖） | `tests/generator-registry/*`（单元语义） | 两者互补 | 保留 |
| 难度校验 | `difficulty-validator`（layer2 启发式） | `difficulty-integrity-validator`（layer3 结构一致性） | 两者互补（仅 spiral 重叠） | 保留（Phase 8 结论） |
| KBL Schema | `knowledge/manifest/relation-schema`（validate 使用） | `curriculum/generation-contract-schema`（未消费） | 前三者 | 后两者删除 |
| Capability 契约 | `capability-resolver/model/matrix`（生产链） | `capability-contract.js`（旧门禁 schema） | 生产链 | 后者删除 |
| 结构基线 | `check-golden`（行为） | `tests/snapshot`（结构，已退役） | **check-golden** | snapshot 删除 |

---

## 4. 表三：门禁表（治理后 38 项，按域）

| 域 | 门禁 | 检查什么 | 唯一/必要 |
|---|---|---|---|
| KBL | `tools/kbl/validate` / `roundtrip` / `build` / `publish`、`verify-kbl-runtime`、`check-knowledge-access`、`check-generator-capability`、`check-kbl-quality`、`check-knowledge-dir` | 数据/运行时/单入口/质量 9 项/目录 | ✅（kbl:verify 8 段链） |
| Frozen/契约 | `check-frozen-core`、`check-kbl-uniqueness`、`tests/shape/*`、`check-code-ratio` | 代码哈希/知识唯一性/形状契约/反膨胀 | ✅（各自唯一） |
| 生成链 | `check-golden`、`check-strategy-config`、`check-strategy-plumbing`、`check-strategy-bundle`、`check-presentation-runtime`、`check-comprehensive-pipeline`、`check-core-generators`、`check-generator-contract`、`check-generator-registry` | 行为/配置/七维/bundle 冒烟/浏览器 E2E/综合管线/核心生成器语义 | ✅ |
| 能力 | `check-capability-matrix`、`check-capability-resolver` | 矩阵全覆盖/快慢路径一致 | ✅ |
| 页面/UI | `verify-pages`、`check-practice-page`、`check-ui-boundary`、`check-contrast`、`check-syntax`、`lint-check`、`check-architecture-layers/rules`、`check-type-module-consistency` | 页面完整性/职责边界/对比度/语法/规范/分层 | ✅ |
| 难度 | `check-difficulty-dual`、`tests/difficulty/*`、`test-difficulty-structure` | 双引擎表征/公式与分布/结构分档 | ✅ |
| 聚合 | `verify-m0`、`verify-m2`、`verify:m3`、`verify:m4`、`verify-setup` | 分域聚合入口 | ✅ |
| 运维 | `check:sw-version`、`test:sw-cache`、`test:svg-units`、`test:pol-generation` | SW/缓存/SVG 单测/POL 契约 | ✅ |

**本阶段删除**：`check-core-integrity`（孤儿）、`check-metrics`（孤儿）、`check-generator-mode`（重复）→ 门禁数 41 → 38。
**冻结冗余**：无（各冻结检查覆盖不同事实：代码哈希 / 知识访问 / 形状 / 比例 / 数据 rootHash，无重复表达）。

---

## 5. 表四：探针表

| Probe | 用途 | 调用 | 长期需要 | 处理 |
|---|---|---|---|---|
| `shared/state/logger.js` DEBUG | 运行日志级别 | 生产 | 是 | 保留 |
| `capacity-inventory` probes | 容量扫描探针（生产扫描） | POL/CLI | 是 | 保留 |
| `strategy-engine` debug trace | 决策链 11 步 trace | 请求 debug 标志 | 是 | 保留 |
| `dev/_bundle-env.js` | 浏览器等价测试环境 | tests/gates | 是 | 保留（dev） |
| `tests/test-runner.html` | 手工测试壳 | 无 | 否（API 已删） | 删除 |
| `tests/e2e/practice-restore-e2e.js` | jsdom 全链探针 | 无（依赖缺失） | 否 | 删除 |

**生产探针 = 0**（`shared/` + 页面无开发期探针）。

---

## 6. P9-11 验证矩阵

| # | 项 | 结果 |
|---|---|---|
| ① | `npm test` | PASS |
| ② | KBL VERIFY | ALL PASS |
| ③ | Strategy 管道 | 598/598 |
| ④ | Golden | 15/15 |
| ⑤ | Browser / SVG E2E | PASS |
| ⑥ | Frozen Core | 0 drift |
| ⑦ | KBL Runtime Uniqueness | PASS |
| ⑧ | POL Boundary（practice-page / ui-boundary） | PASS |
| ⑨ | Shape Contract | 14/14 |
| ⑩ | Difficulty | 23/23 + structure 34 |
| ⑪ | Code Ratio | PASS（Support < Core） |
| ⑫ | 零引用扫描 | 0 |
| ⑬ | 生产入口扫描 | 唯一链（Bridge→Session→API→POL） |
| ⑭ | 旧架构关键词扫描 | 仅受控（frozen require / compat 桥 / 文档） |
| ⑮ | **DEAD CODE = 0** | 零引用运行时对象 0；孤儿门禁 0；失效测试 0 |

---

## 7. P9-12 Clean Baseline 声明

```text
POL–KBL Clean Baseline（Phase 9，2026-09-13）
  生产链：KBL → KnowledgeContext → POL → Strategy → Generator → Validator → Presentation → PracticeSession → UI/Print
  旁路仅：Difficulty Authority / Retry / Composite(Pending) / knowledge-compat(薄桥)
  门禁：38 项（每项唯一事实或互补职责）
  零引用运行时对象 = 0；生产探针 = 0；孤儿门禁 = 0
  Runtime Core Delta = 负（净删除）；Support Delta = 0；New Gate/Probe/Validator = 0
```

## 8. P9-9 / P9-10 执行结果（2026-09-13）

### P9-9 B5/B6/B7 绑定迁移 — RESOLVED
- canonical 生成映射（639 条）`capability` → generator id（点→横线）重建 26 个 generator 的
  `knowledgePoints`（allow 409 → 377 去重绑定）；仅改绑定数据 + Frozen Core 授权重锚。
- legacy 残留 464 → 0；乘法 KP → 乘法 Generator；自愈降级对有绑定 KP 自动恢复 ERROR。
- 残留：243/598 KP 无 allow 绑定（含 73 无映射行）→ 生成映射数据治理（登记）。

### P9-10 G1 数据治理
- 字段：seedDifficulty 缺 31 / cognitiveLevel 缺 31 / type 缺 32 / maxSteps 缺 32 / numberRange 缺 11；
  非法 0；不盲填、不回写公式结果（登记）。
- 生成映射：覆盖 525/598；allow 409 / missing 230。
- 关系：kbl:verify Q4/Q5（悬空/自环/重复/环 = 0）。
- **知识内容页 canonical 重建**：`dev/build-knowledge-pages.js` → 540 selectable 页 + 索引；
  剪除 655 legacy 页；CTA canonical；sitemap 重生成；58 非 selectable 登记不产页。

### 外围（P9-11/12/13）
- Render 单入口 PASS；Print no-generation PASS；SVG no-KBL PASS；Session 无重复渲染实现。

## 9. Clean Product Baseline（2026-09-13）

```text
KBL Runtime → KnowledgeContext → POL → Strategy → Generator → Validator
  → PresentationRenderer → PracticeSession/UI + Print

数据：598 KP / 567 seedDifficulty（31 登记）/ 1287 relations / 639 mappings（allow 409）
绑定：registry.knowledgePoints = canonical（legacy 残留 0）
知识页：540 selectable canonical 页 + 索引（legacy 0）
门禁：39 项（含 build:knowledge-pages 构建入口；每项唯一事实或互补）
DEAD CODE = 0；生产探针 = 0；孤儿门禁 = 0；Support < Core
验证：npm test PASS（KBL VERIFY / Golden 15/15 / Strategy 598/598 / Browser·SVG E2E /
      Uniqueness / Shape 14/14 / Difficulty 23/23 / code-ratio / 零引用 0）
```

## 10. 后续（按需单独授权）

- 生成映射数据治理（243 无绑定 KP：Excel sheet 4 补齐 → kbl:import → rootHash 变更）。
- 58 非 selectable KP 的发布/废弃决策。
- P1a UI 等分 typeCounts 覆盖 POL 分配（待决策）。
