# FINAL-REPAIR-STATUS — P30 最终修复状态（2026-10-04）

> 只记录最终事实。口径来源：`docs/00-BASELINE.md`、`docs/01-ARCHITECTURE.md`、`.trae/rules/p30-repair-rules.md`。

## 版本与指纹

| 项 | 值 |
|---|---|
| Release version | **5.1.0**（`VERSION`） |
| Root Excel | `kbl/root/小学G1-G6数学知识点.xlsx`，50639 B，sha256 `8d4ebef5dede235260ab773f480ac0574f72f558a9b7ea3eb7846f599f5b1afa` |
| KBL rootHash | `158b74dac30524535cc851dbd712db3d835a51f55ebee5159c2024c18c092678`（`kbl/manifest/manifest.json` 与 `shared/knowledge/manifest/manifest.json` 一致） |
| Sitemap | 382 URL（6 公共页 + 375 KP 页 + 索引页），`check-sitemap-freeze` PASS |

## 数据规模（冻结口径）

| 项 | 值 |
|---|---|
| KP | **375**（g1 39 / g2 60 / g3 71 / g4 69 / g5 80 / g6 56） |
| Units | **98** |
| Relations | **373** |
| Mappings | **1570**（allow 1570 / forbid 0 / degrade 0 / missing 0） |
| Canonical 题型 | **7 类**：calc / fill / choice / judge / geometry / classify / apply |
| qt-intent | 1570 行 |
| misconception slots | 920 |
| variation profiles | 1323 |
| Generator | **23**（`shared/generator/generator-registry.js`） |
| SVG | 7 个渲染模块，11 类语义类型全注册 |
| 知识页 | 376 页（375 KP + 索引） |

## 执行链（唯一冻结链）

```
KBL → KnowledgeContext → POL → Strategy → Generator → Validator → SemanticQuestion → Presentation → SVG
```

Misconception 支链：Learner → AdaptiveStrategy → KnowledgeContext → MisconceptionProfile → VariationDirective → QuestionPlan → Generator（P30-31 经 KnowledgeContext 正规通道接通，Strategy 不直读 KBL）。

## 阶段四收口事实

- P30-31/32/33/34：VariationDirective 断链接通；命中错误产出 errorType/expectedError/variant/axis/feedback/basis 六字段进 QuestionPlan；端到端实测步骤错误触发 unknown-position 变式、审题错误触发 context 变式；变式不突破 KP/题型/难度。
- P30-35：同 KP/QT + 同 seed → 指纹全等；异 seed → 批内唯一且指纹序列必异（D11）。
- P30-36/37：物理删除 1 个生产零消费者（`shared/capability/capability-scan-context.js`）+ 7 个一次性/探针 dev 脚本；archive 不参与生产。
- P30-38：56 个测试文件无同规则重复；目录 taxonomy 重排留为债务。
- P30-39：Excel→KBL→Teaching→Strategy→Presentation→Pages 全量重生成，确定性成立（重跑零漂移，rootHash 不变）。
- P30-40：`verify` 8/8 PASS；`verify:allow-gen` 1570/1570；`verify:education` SEMANTIC_PASS 939 / FAIL 0；`npm test` 655 PASS / 0 FAIL；`check-all` 29 PASS / 0 FAIL / 1 SKIP / 30 项。
- P30-41：G1–G6 抽样 + 8 重点域（数与代数/图形几何/统计/应用题/分数/小数/百分数/低年级计算）ALLOW 对真实生成全 OK，SVG/答案/难度/KP 回写一致。
- P30-42：无 /tmp、probe、audit-output、debug、snapshot、临时 JSON/CSV/图片残留。
- P30-43：本文档 + `FINAL-ACCEPTANCE.md`。
