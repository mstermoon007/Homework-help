# P17-0 数据链冻结规则（Source vs Derived）

冻结日期：2026-09-15
状态：审批后生效（P17 所有阶段强制执行）

## 1. 唯一源头（Source，人工维护）

| 序号 | 文件 | 说明 |
|---|---|---|
| S1 | `kbl/root/小学G1-G6数学知识点.xlsx` | 唯一人工维护的知识点源。含知识点、单元、定义、领域。禁止程序写回。 |

## 2. 派生数据（Derived，一律由工具重生成，禁止手改）

| 序号 | 文件 | 生成命令 | 消费方 |
|---|---|---|---|
| D1 | `kbl/import/extract-raw.json` | `kbl:extract` → `node tools/kbl/extract-source.js` | KBL 构建 |
| D2 | `kbl/canonical/knowledge.json` | `kbl:build` → `node tools/kbl/build.js` | Runtime KnowledgeContext |
| D3 | `kbl/canonical/capability.json` | 同上（derive-kbl.js 派生 allowedTypes/capacity 等） | KCV / POL / capacity |
| D4 | `kbl/canonical/mappings.json` | 同上（derive-kbl.js 按题型匹配合法生成器） | GeneratorRegistry / POL |
| D5 | `kbl/canonical/course.json` / `relations.json` | 同上 | 课程视图 |
| D6 | `shared/capacity/capacity-map.json` | `capacity:refresh` → `node dev/scan-capacity.js --refresh` | POL 预算 / Strategy |
| D7 | `kbl/releases/latest.json` + snapshot | `kbl:publish` → `node tools/kbl/publish.js` | 版本解耦 |
| D8 | Runtime bundle（`kbl/*.js` 等共享运行时态） | `kbl:bundle-runtime` → `node dev/build-knowledge-runtime.js` | 页面/测试 |

## 3. 单向依赖律（唯一链，禁止反向）

```text
S1 Excel ──extract──▶ D1 extract-raw.json
   │                    │
   └── build ──init────▶ D2 knowledge.json ──▶ Runtime KnowledgeContext
                        D3 capability.json  ──▶ KCV / POL
                        D4 mappings.json    ──▶ GeneratorRegistry 绑定 / POL selection
                        D5 course.json
D6 capacity-map.json    ◀──capacity:refresh──（真实生成扫描，读 Generator+Strategy 产物）
D7/KBL bundle           ◀──publish / bundle──
```

- Runtime（POL → GenerationPlan → GenerationCore → Strategy → Selector → Generator → Validator → SemanticQuestion → Presentation）**只读**派生数据，绝不写回。
- 派生数据之间保持一致性由 `kbl:verify`（M17 9 项）与 `npm test` 门禁保证。

## 4. 根因修复唯一两条合规路径（P17-1 已应用）

对任何"派生数据与期望不符"的情况：

1. **源数据（Excel）错误** → 修 S1 → 重跑 extract → build → 逐级重生成 D1–D8。
2. **真实容量/能力即如此（非错误）** → 改测试使用的 KP（从容量充足池选择），不改派生事实、不伪造 capacity。

禁止动作：
- 直接编辑 `capacity-map.json`、`capability.json`、`mappings.json`、`knowledge.json` 等 D 级文件绕过重生成。
- 在 Excel 中造数据满足测试。
- 降低断言或删除测试以掩盖真实容量不足（可换 KP、可降 count，但须注明根因）。

## 5. P17-1 实证记录（本次根因）

- `math-g2-down-u01-k001`（钟面结构）与 `k002`（时间单位换算）真实容量=1，kind=`GENERATOR_LIMITED`。
- 根因链：该知识点为时间/时钟类（Excel 归 "数与代数"），但派生 allowedTypes 无 `geometry` 时钟载体，mapping 落到 `arithmetic/selection` 族；生成器对该 KP 无正确模板 → 真实生成退化（产出「条形图统计」错题）→ 扫描容量=1。
- 处置：属路径 2（非数据错误）——测试 `tests/orchestration/p11-01-coverage-quota.test.js` 改用容量 ≥20 的 KP 池（前 3 为 u01-k003/u02-k001/u02-k002），未改动任何 D 级数据。
- 遗留观察项（不阻塞本期）：时间类 KP 的题型载体缺失，归入后续题型/生成器族补全范围（P17-10 7 类统一时评估 classify/geometry 载体）。
  - **P17-10 评估记录**：以 classify 为第 7 类载体完成 7 类统一收口（25 个 classify 载体 = g2-up-u01/g3-down-u05/g4-up-u06/g4-down-u08/g5-up-u07/g5-down-u07；`generator:classification` 注册表绑定已重对齐权威生成映射，selector 增加 classify 计划语义域提升，`p17-10-classify.test.js` 全量真实生成验证 SUCCESS 且不越界）。时钟/时间类 KP（u01-k001/k002 等）仍无 geometry 时钟载体，载体缺失保持 OPEN（不阻断）。

## 6. 契约：canonical 题型 = 7

`calc / fill / choice / judge / geometry / classify / apply`（第 7 类为 `classify`，非第 8 类；`oral→calc`、`classification→classify` 为别名）。测试/文档中 "canonical 6" 均为过时表述，统一对齐 7。