# 00-PROJECT-BASELINE — 项目当前基线

> 状态：FROZEN（2026-09-19 冻结）
> 本文档回答：项目现在是什么状态。

## 1. 基本信息

- 项目：小学练习本（Homework Help）— 免费、无广告的小学 1-6 年级练习题生成与打印工具
- 版本：4.3.0（`VERSION` / `package.json` / SW 缓存名三方一致）
- 形态：纯前端静态站，零运行时依赖；浏览器 + Node 双环境兼容

## 2. 冻结基线门禁（全部实测通过，2026-09-19）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| M0 聚合门禁 | `npm run verify` | 5/5 PASS（kbl-validate / kbl-runtime / kbl-uniqueness / kbl-access / kbl-dir） |
| 全量语法 | `npm run verify:syntax` | 209 文件 / 0 错误 |
| Node 测试全套 | `npm test` | 239 / 239 PASS |
| 静态质量 | `npm run check-lint` | 0 违规 |
| SW 版本一致性 | `npm run check:sw-version` | hw-help-4.3.0 一致 |
| 七类全链 E2E | `node docs/archive/freeze-20260919/p005-e2e.js` | PASS |
| 题量控制回归 | `node docs/archive/freeze-20260919/step20-count.js` 等 | PASS（40 断言） |
| 重复题回归 | `node docs/archive/freeze-20260919/p13-dup.js` | PASS（同轮/跨轮 0 重复） |
| 浏览器产品回归 | 练习全流程 + 异常场景 | 13/13 PASS |

本地一键复跑：`bash scripts/run-all-checks.sh`（与 CI 等价）。

## 3. 唯一生产执行链

```text
KBL
→ KnowledgeContext
→ KP × QT
→ Strategy
→ Generation Requirements
→ Generation Plan
→ 唯一 Executor（shared/generation/api.js）
→ 唯一 Selector
→ Generator
→ Validator
→ Presentation
→ Practice
```

UI 只是 Request 的输入端；题型/难度/数量决策全部在 POL 及以下层完成。

## 4. 关键数据事实

- KBL Runtime：598 KP / 128 Units / 1293 Relations / 639 Allow mappings
- Canonical ID：`{subject}-{grade}-{book}-u{nn}-k{nnn}`
- Canonical 题型：7 类（calc / fill / choice / judge / geometry / classify / apply），SSOT 为 `shared/knowledge/question-type-registry.js`

## 5. 当前文档状态总表

| 阶段 | 状态 |
| --- | --- |
| KBL 数据治理（T1） | FROZEN |
| 难度系统（T2） | FROZEN |
| POL 编排层（T3） | FROZEN |
| 七类题型统一（T4 / P0-11-A） | FROZEN |
| GAP-4 + P0-05 FINAL（T5） | FROZEN |
| P0-09 全链唯一决策验证（T6） | FROZEN |
| P0-11-B 产品回归（T7） | FROZEN |
| P0-12 UI 控制审计（T8） | FROZEN |
| P0-13 项目清理（T9） | FROZEN |
| 最终冻结 Clean Product Baseline（T10） | FROZEN（本文档） |

## 6. 遗留问题登记（TRACKED，不影响冻结）

1. **capacity-map.json 历史缓存过期**
   - 现象：`shared/capacity/capacity-map.json` 键为旧 KnowledgeBank ID 体系（如 `math-g2-m2-chain-add-col`），与 KBL canonical KP ID（598 个）不在同一空间。
   - 影响：`practice-orchestrator` / `api.js` 容量查询全部 miss → typeCaps 无界，由 recovery 无进展终止兜底；产品行为以 13/13 回归为准，不崩溃。
   - 处理：不重建（重建会改变已冻结验证行为，且全量扫描耗时长）。若未来需要容量预判层，执行 `node dev/scan-capacity.js --refresh` 并重跑全量回归。
   - 关联修复：`tests/orchestration/p11-01-coverage-quota.test.js` 已改为 canonical KP 固定池，不再依赖该缓存。

2. **knowledge-point.js / knowledge-ontology.js 历史断链**
   - 状态：ARCHIVED / TRACKED；Production dependency = 0。
   - 处理：不恢复、不创建 stub。

3. **generation-core.js**
   - 零生产调用，但被 P17 测试使用 → 保留为测试资产，非死代码。

## 7. 冻结纪律

- 任何修改不得重新设计已冻结架构（详见 `01-ARCHITECTURE-FROZEN.md`）。
- 新任务必须先回答：当前阶段 / 唯一目标 / 已冻结项 / 修改层 / 是否重复实现 / 能否删除 / 如何验证 / 是否扩围。
