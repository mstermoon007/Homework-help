# P14 最终清理与发布审计（Release Freeze）

> 阶段：P14-01 ~ P14-08。原则：能删除不保留、能合并不新增、只测量不先重构；Frozen Core 仅授权 Bug Fix + 重锚记录。

---

## P14-01 Dead Code 全量清理 ✅

```text
文件级零引用（shared/）           = 0
导出级扫描                        含全局/bundle 消费误报（非权威口径，逐项抽查）
真实死代码删除                    shared/generation/rollback-manager.js（127 行，零消费者，M9 遗留）
                                  → 同步移除 code-ratio 登记 + 架构层清单
```

## P14-02 Legacy 全清 ✅

```text
KBL Runtime Uniqueness = PASS（known 0 / new 0）
受控例外（登记在案）：knowledge-compat 兼容委托桥 / comprehensive-strategy 经 compat 访问 KnowledgeBank
旧 allocation / 旧编排 / 旧难度 wrapper / 旧 gate：已在前序阶段删除，无残留
```

## P14-03 Gate / Probe 清理 ✅

```text
Production Probe = 0（global.__pickOpt 为产品交互实现，非调试探针）
Orphan Gate      = 0（dev/scripts CLI 全部有注册或调用方；capacity CLI 合并后注册 capacity:scan/refresh）
Duplicate Gate   = 0（沿用 P9 治理表）
```

## P14-04 Bundle 最终检查 ✅

```text
npm run build:strategy / build:presentation → 重建与产物 md5 完全一致（source = bundle）
verify:presentation-runtime PASS；M4-19 Bundle 门禁 PASS
无重复 KBL Runtime / 无重复 Context（唯一性门禁）；浏览器与 Node 语义一致（_bundle-env 同构）
```

## P14-05 性能检查（只测量）✅（含 404 修复）

```text
practice.html：script[src] = 50；resource = 67；DOM = 275 节点
导航 → load：486ms；生成耗时：26ms（count=20）
真实 404 = 0（修复后）；JS error = 0；仅 favicon.ico 浏览器自动请求 404（无站点图标，cosmetic）
```

- **F-404-1（Frozen 授权 Bug Fix + 重锚）**：`shared/core/common.js` 浏览器分支动态注入路径错误
  （`base + 'render.js'/'ui-state.js'/'storage.js'` → `shared/core/*` 404）。修复为
  `../presentation/render.js`、`../state/ui-state.js`、`../state/storage.js`（与 Node 分支一致）；
  `check-frozen-core --baseline` 重锚（78 文件）；修复后 3×404 清零。

## P14-06 最终 Browser Regression ✅

`npm run test:e2e`（10 模式）全绿：

```text
P12-01 完整链 / P12-02 多题型多KP / P12-03 难度 1-10 / P12-04 三态 UX
P12-05 打印 / P12-06 刷新 / P12-07 跨批去重 / P12-08 结果与重新生成
P13-02 Knowledge→Practice G1–G6 / P14-05 性能与 404
```

## P14-07 最终全量测试 ✅

```text
npm test                EXIT=0
orchestration           58/58
Difficulty              23/23
Shape                   14/14
Golden                  15/15
Strategy                598/598
KBL VERIFY              ALL PASS（rootHash 未变）
Frozen Core             无漂移（P14-05 授权重锚后）
Code Ratio              PASS（Support 1283 LOC / 4.9% < Core）
KBL Uniqueness          PASS
Browser E2E             10 模式 PASS
```

## P14-08 最终 Release Freeze

```text
docs/
├── pol-contract.md                    （§1-19：输入/生成/难度/覆盖/去重/容量全契约）
├── pol-kbl-stable-baseline.md         （Clean Product Baseline v3）
├── p12-product-audit.md               （产品化基线审计）
├── p12-product-e2e.md                 （浏览器 E2E 报告）
├── p13-content-data-governance.md     （内容与数据治理报告）
├── p14-release-audit.md               （本文件）
└── DEV_LOG.md                         （完整开发日志）
```

**Homework Help Clean Product Baseline** 冻结：

```text
KBL / POL / COUNT / TYPE / KP / DIFFICULTY / ADAPTIVE / GENERATION CONTEXT
COVERAGE / QUOTA / DUPLICATE / CAPACITY / RECOVERY / PARTIAL
PRACTICE / SESSION / PRINT / KNOWLEDGE ENTRY
```

### 遗留人工项（不阻塞发布，登记台账）

```text
P13-05  243 生成映射缺口        ← 需 Excel sheet 4
P13-06  G1 缺失字段（确实缺失） ← 需业务确认策略
P13-07  58 非发布 KP 状态       ← 需产品决策
F-TYPE-2 单题型产出（数据治理项，非契约违规；Scope 守卫保证不越界）
favicon.ico 404（cosmetic）
```
