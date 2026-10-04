# FINAL-ACCEPTANCE — P30 最终验收（2026-10-04）

> 只记录最终验收事实。验收方法：`node dev/check-all.js` 全量门禁 + 真实产品抽样。

## 验收结果

| 域 | 门禁 | 结果 |
|---|---|---|
| Version | SW 版本一致 | PASS |
| KBL | M0 聚合 8 步（validate / runtime / uniqueness / access / dir / edu-gen / coverage / golden） | 8/8 PASS |
| KBL | AI 边界 + 页面漂移 | PASS |
| Lint | 静态质量 | PASS |
| Syntax | 全量 JS 语法 289 文件 | 0 错 |
| Unit | `npm test` | **655 PASS / 0 FAIL** |
| Generation | 1570 ALLOW 真实生成 | 1570/1570 PASS |
| Generation | 矩阵冻结 / Generator Registry / 四轴不夺权 / KP×QT Maker 矩阵 / 失败分类 | PASS ×5 |
| Education | 教育语义生成 | SEMANTIC_PASS 939 / FAIL 0 |
| Golden | 金题集校验 | PASS |
| Difficulty | 权威链唯一 + 溯源 | PASS ×2 |
| Presentation | 渲染 + Legacy 隔离 | PASS |
| SVG | 契约 + Sanitizer | PASS |
| Security | eval/Function + AnswerValidator + HTML + KBL 写保护 | PASS |
| Sitemap | 382 URL 冻结 | PASS |
| Crawl | AI Agent 375/375 + 爬虫健康 | PASS ×2 |
| Browser/E2E | 真实浏览器 9 步路径 | 本地 SKIP（无 Chrome）；CI `REQUIRE_BROWSER_E2E=1` 强制执行 |
| Bundle | source==bundle hash 一致 | PASS |
| Determinism | 构建重跑 hash 不变；固定 seed 5 连跑逐字节一致 | PASS |
| Coverage / LLM / Doc / DeadCode / Legacy | 附加门禁 | PASS ×5 |
| FINAL-91 | 只读门禁（CI 不改源码/测试/冻结文件） | PASS |

**合计：29 PASS / 0 FAIL / 1 SKIP / 30 项。**

## 真实产品抽样（P30-41）

- G1–G6 各年级 ALLOW 对抽样：题目 KP / 题型 / 难度 / 答案 / SVG 回写一致。
- 重点域：数与代数、图形几何（SVG=Y）、统计、应用题、分数（SVG=Y）、小数、百分数、低年级计算 —— 全部真实生成 OK。
- 非 ALLOW (KP×QT) 请求被能力闸门正确拒绝（不伪造产出）。

## 变式与确定性（阶段四判据）

- 变式行真实生效：Misconception→Variation 六字段进入 QuestionPlan（P30-32）。
- 变式不突破 Intent：KP / 题型 / 难度不变（P30-34 测试断言）。
- 同 KP/QT + 同 seed → 指纹全等；异 seed → 可识别变化；完全相同 → 去重剔除（P30-35 / D11）。
- 无 learner 时输出逐字节相等（P28-15 语义确定性门禁 PASS）。
- 变式剖面漂移：硬违例 0（`check-variation-drift` PASS）。
