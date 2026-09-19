# P25-05 语义族映射报告（Semantic Family Mapping）

> 计划步骤：P25-05「建立语义族，而不是 375 个 Generator」
> 产物：`kbl/teaching/semantic-families.json`（15 族 × 375 KP 归属，含证据）
> 派生：`dev/p25/derive-semantic-families.js`（只读 KBL，可重复执行，`--check` 防漂移）
> 日期：2026-09-19 ｜ 状态：kbl-derived（机械派生，无 AI 教学推测）

---

## 1. 本步目标与边界

计划要求：

1. 一个语义族可服务多个 KP；2. 一个 KP 可属多个语义族；3. 不新增 per-KP Generator；
4/5. Generator 负责生成、Strategy 负责传参，均不定义教材语义；6. 语义族必须可测试；
7. 输出 KP → Semantic Family 映射。

**本步只交付「映射」本体，不改任何 Generator/Strategy/运行时**——语义族的参数化消费是 P25-06 的工作。
不新增独立知识库：全部归属从 KBL 既有事实（`semantic.family`、`name`、`unitName`）机械匹配得到，
每条归属在产物中携带 `evidence: {rule, field, matched}`，可逐条回溯到具体事实与规则。

## 2. 语义族词表（15 族）

计划示例 13 族全部保留；数据强证据要求新增 2 族（`planListed=false`）：

| # | id | 语义族 | primary | membership | 说明 |
|---|---|---|---:|---:|---|
| 1 | `number-sense` | 数的认识与代数初步 | 40 | 46 | **计划外新增**：数数/数位/读写/比较/近似数/负数/因数倍数数论/字母表示数（calculation 粗桶中约 1/3 并非运算） |
| 2 | `integer-arithmetic` | 整数四则运算 | 29 | 54 | 口算/笔算/竖式/混合运算/运算律 |
| 3 | `multiplicative-relation` | 乘除关系 | 38 | 42 | 乘除含义/平均分/互逆/余数/积商关系 |
| 4 | `multiple-ratio` | 倍数关系 | 3 | 3 | 倍的认识/两类倍应用/逆向倍数（数论「倍数的特征」明确排除） |
| 5 | `fraction` | 分数 | 25 | 32 | 含分数乘除；百分数作为特例多族重叠 |
| 6 | `decimal` | 小数 | 24 | 27 | |
| 7 | `percent` | 百分数 | 11 | 11 | 百分/折扣/税率/利率/成数/达标率 |
| 8 | `ratio-proportion` | 比与比例 | 7 | 7 | **计划外新增**：g6-down-u04 为独立比例单元，计划词表未单列 |
| 9 | `unit-measurement` | 量与计量单位 | 17 | 18 | 人民币/时间/长度/质量单位与换算 |
| 10 | `geometric-figure` | 几何图形 | 49 | 68 | 图形的认识/要素/特征/性质/分类 |
| 11 | `geometric-measurement` | 图形测量 | 23 | 29 | 长度/角度/周长/面积/表面积/体积/容积 |
| 12 | `spatial-reasoning` | 空间观念与图形运动 | 29 | 39 | 观察物体/方向位置/路线/平移旋转轴对称 |
| 13 | `statistics-probability` | 统计与概率 | 22 | 26 | 数据/统计图表/平均数/可能性 |
| 14 | `classification` | 分类 | 4 | 6 | g2 分类单元 primary；几何「三角形的分类」为次级 |
| 15 | `word-application` | 问题解决与综合实践 | 54 | 97 | 解决问题/数量关系/数学广角策略/综合实践（弱归属，允许与任意领域族共存） |

- **primary**：每 KP 一个主族（供 P25-06 选择参数化 Generator）；**membership**：含次级族的总归属数。
- 多族 KP **124/375（33%）**；primary 合计 375。

## 3. 派生方法

规则全部固化在 `derive-semantic-families.js`：

1. **粗 family 基线**：KBL `semantic.family`（8 粗值）→ 族初判；
   `calculation` 粗桶不设默认族（名称异构：数感/运算/单位/比例/百分数混杂，强制走名称规则）；
   `multiplication-division` 粗桶对已知异质 KP（平年闰年/数论/字母/反比例/运算顺序）不挂乘除基线。
2. **名称规则**：约 20 条 `when/re/unless` 规则（规则表与正则随产物落盘，便于审计），多族叠加。
3. **primary 裁决**：领域层（倍/百分/比例/分数/小数）> 关系层（乘除/数感/单位）> 图形层 > 统计层 > 运算 > 应用；
   同层证据强度（name/unitName 直接命中=2，粗 family 默认=1）优先；同强度按词表顺序。
4. **单元名兜底**：当粗 family 与名称冲突时，`unitName` 作为 KBL 事实参与裁决。

## 4. 审计发现（flagged，列账不改 root）

4 条 `coarse-family-conflict`，全部集中在 **g6-up-u02「分数乘法」单元**——`derive-kbl` 的关键词检测把整单元误标为
`semantic.family=geometry`（分数乘整数 / 一个数乘分数 / 分数小数混合运算 / 解决问题）。

本映射按 `name + unitName=分数乘法` 正确归入 fraction（k003 兼 decimal，k004 兼 word-application），不挂任何图形族，
同时保留冲突旗标，作为后续 root Excel/KBL 派生修订候选。**映射层正确性不依赖 root 噪声修复。**

## 5. 粗 family → 语义族 crosswalk（P25-06 接线依据）

| 粗 family | 主要流向（membership 计数） |
|---|---|
| calculation (83) | number-sense 30 / integer-arithmetic 28 / word 16 / ratio 6 / unit 6 / percent 2 |
| multiplication-division (52) | multiplicative-relation 42 / integer-arithmetic 26 / word 11 / number-sense 7 / multiple-ratio 3 / ratio 1 / unit 1 |
| fraction (28) | fraction 28 / percent 7 / number-sense 2 / decimal 2 / word 2 |
| decimal (24) | decimal 24 / number-sense 4 / unit 1 / word 1 |
| percent (2) | percent 2 / word 1 |
| geometry (101) | geometric-figure 60 / spatial 35 / measurement 29 / unit 6 / word 5 / classification 2 / fraction 4* / decimal 1* |
| statistics (25) | statistics 25 / classification 4 / word 1 |
| application-word (60) | word 60 / geometric-figure 8 / spatial 4 / unit 4 / number-sense 3 / statistics 1 |

\* 即 g6-up-u02 噪声单元。关键结论：**8 个粗桶全部是异构的**（尤其 calculation/geometry/application-word），
P25-06 Generator 参数化不能继续用粗 `semantic.family` 路由，应消费本映射的 primary/membership。

## 6. 与既有 P25 产物的关系

- P25-01 `TeachingSemanticProfile.semanticFamily` 投影的是 KBL 粗 family（8 值），保持不变（KBL 事实投影）；
  本映射是**教学治理层的细分族**，落位 `kbl/teaching/`，与 qt-intent/evidence/denials 同层。
- P25-03 `intent-relations.json` 的 `when.family` 继续引用粗 family，本步不改；P25-06 可据 crosswalk 迁移到细分族。
- P25-04 evidence 规则的 6 个代表 KP 均可在本映射中定位（倍→multiple-ratio，分数→fraction，面积→measurement…）。
- P25-06 裁决的 4 个 representation-conflict KP 归属：图形表述数量关系→word-application；
  周期问题→multiplicative-relation；图形放缩→ratio-proportion；正反比例解决问题→ratio-proportion。
  语义族映射为 P25-06「给这 4 个 KP 建参数化生成器、再撤销 deny 恢复 1570」提供了族级落点。

## 7. 验收

| 项 | 结果 |
|---|---|
| KP 覆盖 | 375/375，每 KP ≥1 族，零 unassigned |
| 族完整性 | 15 族全部有 KP（无死族），计划 13 族在场 |
| 证据 | 每条归属有 rule/field/matched，field 仅取 KBL 事实 |
| 多族 | 124 KP 多族（33%），符合「同 KP 可属多族」 |
| 防漂移 | `--check` 模式产物逐字节一致；单测 16 用例冻结典型归属 |
| 全门禁 | npm test 318/318、verify 5/5、syntax、lint、kbl-uniqueness PASS |
| 运行时 | 零改动；canonical 1570 / 运行时有效 1566 均不变 |

## 8. 下一步（P25-06，计划本体）

按计划 P25-06「从题型生成转为语义参数生成」：以本映射的 primary family 为参数化入口，
优先治理审计报告 H1-H3 债务（percent 尾缀分派、371 条 STALE ID、19 个零调用子串谓词），
并为 4 个被 deny KP 所在族（word-application / multiplicative-relation / ratio-proportion）
补齐语义参数生成路径，目标撤销教学裁决、恢复 1570/1570 真实可生成。
