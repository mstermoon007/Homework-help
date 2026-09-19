# 00-PROJECT-BASELINE — 项目当前基线

> 状态：FROZEN（2026-09-19 冻结，P24 一致性收口同日修订）
> 本文档回答：项目现在是什么状态。

## 1. 基本信息

- 项目：小学练习本（Homework Help）— 免费、无广告的小学 1-6 年级练习题生成与打印工具
- 版本：5.0.0（`VERSION` / `package.json` / `shared/catalog/version.js` / SW 缓存名 `hw-help-5.0.0` 四方一致）
- 形态：纯前端静态站，零运行时依赖；浏览器 + Node 双环境兼容

## 2. 冻结基线门禁（全部实测通过，2026-09-19 P24 修订）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| M0 聚合门禁 | `npm run verify` | 5/5 PASS（kbl-validate / kbl-runtime / kbl-uniqueness / kbl-access / kbl-dir） |
| 全量语法 | `npm run verify:syntax` | 218 文件 / 0 错误（P24 起含 plugins/feedback 7 个文件） |
| Node 测试全套 | `npm test` | 239 / 239 PASS |
| 静态质量 | `npm run check-lint` | 0 违规 |
| SW 版本一致性 | `npm run check:sw-version` | hw-help-5.0.0 一致 |
| ALLOW 真实性（P24 新增） | `npm run verify:allow-gen` | 1570 / 1570 PASS（每个 KBL ALLOW 映射真实生成 ≥1 题，QT 与 KP 身份一致） |
| 七类全链 E2E | `node docs/archive/freeze-20260919/p005-e2e.js` | PASS |
| 题量控制回归 | `node docs/archive/freeze-20260919/step20-count.js` 等 | PASS（40 断言） |
| 重复题回归 | `node docs/archive/freeze-20260919/p13-dup.js` | PASS（同轮/跨轮 0 重复） |
| 浏览器产品回归 | 练习全流程 + 异常场景 | 13/13 PASS |

本地一键复跑：`bash scripts/run-all-checks.sh`（与 CI 等价；含 1570 对串行真实生成，约 3-6 分钟）。

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

- KBL Runtime：375 KP / 98 Units / 0 Relations / 1570 Allow mappings（2025 人教版有效基线；旧文档 598/1293/639 为历史基线）
- Canonical ID：`{subject}-{grade}-{book}-u{nn}-k{nnn}`
- Canonical 题型：7 类（calc / fill / choice / judge / geometry / classify / apply），SSOT 为 `shared/knowledge/question-type-registry.js`
- 静态知识页：375 个 KP 页 + 1 个索引页（`knowledge/` 共 376 个 HTML，kbl-dir 门禁校验），sitemap 381 URL（5 静态页 + 376 知识页），三者 375=375=375 对齐
- Capacity Map：375 keys / 与 1570 ALLOW 全重叠 / 0 stale / 0 missing（P24 重建；分级 HIGH 333 / MEDIUM 4 / LOW 11 / VERY_LOW 27，27 个 VERY_LOW 全部 GENERATOR_LIMITED）
- 生成器：新增 `generator:percent-calc`（六上百分数 6 KP 语义生成）；15 个 calc ALLOW 失败 KP 已从 shape-recognition 解绑回归算术/百分数语义族

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
| 最终冻结 Clean Product Baseline（T10） | FROZEN |
| 产品化一致性收口 P24（T11） | FROZEN（本文档 P24 修订） |

## 6. 遗留问题登记（TRACKED，不影响冻结）

1. **knowledge-point.js / knowledge-ontology.js 历史断链**
   - 状态：ARCHIVED / TRACKED；Production dependency = 0。
   - 处理：不恢复、不创建 stub。

2. **generation-core.js**
   - 零生产调用，但被 P17 测试使用 → 保留为测试资产，非死代码。

> P24 已解决：capacity-map.json 历史缓存过期问题——已执行 `node dev/scan-capacity.js --refresh`，
> 新缓存 375 keys / 1570 ALLOW 全重叠 / 0 stale / 0 missing；capacity 容量预判层恢复有效（typeCaps 不再全部 miss→Infinity）。
> P24 另修复：15 个 calc ALLOW 映射真实生成失败（shape-recognition 误绑，详见 02 时间轴 T11）。

## 7. 冻结纪律

- 任何修改不得重新设计已冻结架构（详见 `01-ARCHITECTURE-FROZEN.md`）。
- 新任务必须先回答：当前阶段 / 唯一目标 / 已冻结项 / 修改层 / 是否重复实现 / 能否删除 / 如何验证 / 是否扩围。
