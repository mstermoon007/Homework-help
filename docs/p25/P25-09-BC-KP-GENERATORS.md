# P25-09 B/C 类 KP 专项生成器建设

## 1. 背景与目标

P25-02 审计将 375 个 KP 按语义质量分为 A/B/C/D 四类：

- **B 类 = 41 个语义误绑 KP**：绑给了语义不匹配的生成器（如「比例的意义」挂算术、单位换算挂加减）；
- **C 类 = 166 个无原生绑定 KP**：无 native 绑定，靠 kp=0 泛化兜底出题。

P25-08 为 D 类扩绑时把 shape-recognition 升到 v3（cap 含 calc），产生新问题：**selector 平局（kp=0）时高 cap 的 shape 会截胡所有未绑定 KP**。修复路径只有一条——native 绑定（绑定即责任：生成器必须覆盖该 KP 全部 ALLOW 题型，否则 allow-gen drop）。

**目标**：完成 B/C 类共 207 KP 的语义化绑定与专项建设，实现 375/375 KP 全量 native 覆盖、1570/1570 ALLOW 对全部由 kp=1 本体候选承载。

**红线**：不新增 QuestionType、不改 math.json、不改 root Excel；改源码必须重建 presentation + strategy 双 bundle；不靠升 version 解决平局（高版本会在 kp=0 行反向截胡），改用「从对手解绑/显式双绑」。

## 2. 绑定终态（375/375 native 覆盖）

| generator | KP 数 | 本轮变化要点 |
|---|---|---|
| arithmetic-addition | 13 | 按名称重绑，移出 2 个误绑（g4-down-u03-k003→乘法、g6-down-u01-k001→concept） |
| arithmetic-subtraction | 13 | 移出 3 个应用题 KP→application-word |
| arithmetic-multiplication | 15 | 纳入 g4-down-u03-k003 等，移出 4 个非乘法 KP |
| arithmetic-division | 23 | 表内除法/有余数除法 KP 全量归位 |
| arithmetic-mixed-calculation | 10 | **+g3-up-u02-k001**（混合运算的定义，原仅绑 composite 漂移至 shape） |
| shape-recognition | 88 | 角/面积/负数 3 KP 移交 concept；**+10 KP geometry 行显式双绑**；+4 图形 KP |
| position-direction | 25 | +7（平移旋转/数对/方向相关 B 类误绑） |
| money-measurement | 12 | +4（人民币应用、克千克吨、称重实践、单位适用场景） |
| application-word | 33 | +21（加减乘除应用题 KP 归位），**含 g2-down-u07-k001 数与运算整合** |
| reasoning | 15 | cap 改 `apply/calc/fill/choice`，新增 calc 分支（7~9 表乘除列式） |
| stats | 11 | cap 改 `apply/calc/fill/choice`；图表 KP 与 classification 双绑分工 |
| code-recognition | 5 | cap 改 `fill/choice/judge/apply`（摘 recognize），覆盖编码单元全部 5 KP |
| percent-calc | 11 | g6-up/u05×6 + g6-down/u02×5 |
| concept-meaning | 42 | 角/面积/负数 3 KP 回归；扩 37 个数概念/数论/乘除关系 KP；**+g1-up-u01-k001** |
| semantic-relations | 10 | +比例单元 8 KP（ratio-basics/scale-map/proportion-application） |
| decimal-number（新建） | 24 | 小数的意义/性质/加减法/乘除（g3-g5） |
| fraction-number（新建） | 19 | 分数读写/性质/通分约分/分数乘除（g3/g5/g6） |
| classification / picture-equation / counting / selection-fill | 25/2/2/1 | 维持/微调 |
| composite | 5 | 仅 combine 计划；其中 3 KP 补单 KP 本体绑定 |

GR.all() knowledgePoints 并集 = **375**，无未绑定 KP、无残留未知 KP ID。

## 3. 生成器建设

### 3.1 新建 decimal-number / fraction-number（[decimal.js](../shared/generator/generators/decimal.js)、[fraction.js](../shared/generator/generators/fraction.js)）

两个同构专项生成器，cap 均为 `calc/fill/choice/apply`，按 KP 名称机械派生命题素材（小数意义/读写/性质/大小比较/加减/乘除；分数意义/读写/与除法关系/真假带分数/通分约分/分数乘除），数值范围随年级收窄。[generators/index.js](../shared/generator/generators/index.js) buildAll 注册。

### 3.2 arithmetic（[arithmetic.js](../shared/generator/generators/arithmetic.js)）

新增 `deriveKindFromName(name, op)`：有余数除法等名称信号派生 special-kind，使竖式除法 KP 稳定产出「q……r」结构而非默认整除。

### 3.3 concept-meaning（[concept-meaning.js](../shared/generator/generators/concept-meaning.js)）

- 新增 5 个 P25-09 subTopic maker（number-concept / negative-number / multdiv-relation / algebra-letter / number-theory），各覆盖 calc/fill/choice/apply 四题型；
- 角的认识 / 面积的认识 / 寻找负数 3 KP 从 shape 解绑，由 angle-concept/area-concept/negative-maker kp=1 唯一承载（含 geometry/judge 行）；
- number-concept builder 新增「1-5数的认识」分支：素材限定 1~5（n∈2..5 保证 n−1≥1），杜绝落默认两位数分支的 off-grade 题。

### 3.4 semantic-relations（[semantic-relations.js](../shared/generator/generators/semantic-relations.js)）

- 新增 **ratio-basics** subTopic：比例的意义（比值相等判定）/基本性质（内项积=外项积、解比例），4 题型 maker；
- 新增 **scale-map** subTopic：比例尺图上距离/实际距离；
- 既有 scale-transform / proportion-application 承接放大缩小、正反比例 KP。

### 3.5 其他

- [reasoning.js](../shared/generator/generators/reasoning.js)：新增 calc 分支——名称含除/乘/口诀时出 7~9 表乘除列式（带算式/data.operation 满足 calc 契约），否则找规律列式兜底；
- [money.js](../shared/generator/generators/money.js)：mass 正则 +「称重|秤」；`getMoneyMeta` 增 concept 参数，name 无信号时用 concept 文本兜底派生；
- [percent.js](../shared/generator/generators/percent.js)：语义键分派（P25-06 H1 清偿）；
- [stats.js](../shared/generator/generators/stats.js)：扩 calc/apply 产出，与 classification 双绑后按 kp+cap 分工；
- [semantic-special.js](../shared/generator/generators/semantic-special.js)：CODE_BANK 全部 apply 题干补齐问号/疑问词（idcard/postal/feature/life 共 11 条改标点），满足 apply 契约 `contextPresent`。

## 4. 关键工程修复

### 4.1 subTopic 双环境规则漂移（本轮根因级发现）

**现象**：allow-gen 对 g6-down-u04-k001「比例的意义」calc/fill/choice/apply 4 行报 n=-1；源码直连全部 PASS。

**根因**：[semantic-parameters.js](../shared/generator/core/semantic-parameters.js) 的 subTopic 派生有两条路径——Node 侧按 teaching 细族收窄规则候选，bundle 侧 teaching JSON 不内联、全表顺序扫描。bundle 全扫时：

- `multdiv-relation` 旧正则 `/互逆|意义|各部分|关系/` 的裸「意义」抢先匹配「比例的意义」，maker 表无该 subTopic → fail-closed 0 题；
- `times-concept` 的裸 `/倍/` 抢先匹配「2、5、3的倍数的特征」，应为 number-theory。

**修复**：

- multdiv 正则收紧为 `/互逆|各部分|余数|被除数|平均数的意义/`——保留 7 个真实承载 KP，排除「比例的意义/数量关系/三角形三条边的关系/分数与除法的关系」6 个跨族误匹配；
- number-theory 规则上移至规则表首位（同时保证先于 number-concept 与 times-concept）。

修复后全量 375 KP 双环境扫描：subTopic 消费生成器（percent/concept-meaning/semantic-relations）绑定 KP 的两环境派生**零分歧且非 null**（19 处非消费 KP 的 node=null/bundle 非 null 为良性降级，其生成器不读 subTopic，由永久测试按「仅消费方」口径豁免）。

### 4.2 selector 未知题型 fail-closed（[generator-selector.js](../shared/generator/generator-selector.js)）

375 全量绑定后，任意无法归一到规范 7 类的题型 token（如历史测试中的 `review`）都能靠 kp=1 得分直通本体生成器。现归一失败（`normalizeQuestionType(..., {allowHeuristic:false})` 返回空）即显式 `GENERATOR_UNSUPPORTED`，禁止 kp 绑定豁免无效题型。

### 4.3 composite-only KP 漂移

g1-up-u01-k001 / g2-down-u07-k001 / g3-up-u02-k001 仅绑 composite（supportsComposite 生成器不参与单 KP 计划候选），单 KP 请求下被 shape v3 kp=0 截胡。分别补绑 concept-meaning（number-concept）/ application-word / arithmetic-mixed-calculation，composite 绑定保留。

### 4.4 geometry 行显式双绑

10 个 KP（长度/面积单位×5、不规则物体体积×1、分数混合运算×3 等）的非 geometry 行由 money/application/arithmetic 本体承载，geometry（操作/作图意图）经 form-bound 声明门过滤后由 shape kp=0 隐式兜底。本轮将这 10 KP 显式加绑 shape，与 P25-06 stats×classification 双绑同构：非 geometry 行仍由原载体 kp=1+cap=1 胜出，输出零变化，承载关系全部显式化。

## 5. 永久回归测试

新增 [p25-09-native-bindings.test.js](../../tests/generator/p25-09-native-bindings.test.js)（13 项）：

1. 375 KP 均有 core 生成器 native 绑定，注册表无未知 KP ID（H2 回归）；
2. **1570 对 ALLOW 全部 selector kp=1 承载**（kp=0 截胡回归门）；
3. 未知题型 fail-closed unsupported；
4. subTopic 消费生成器绑定 KP 的 Node/bundle 派生一致且非 null；
5. 9 个新建/重绑生成器代表 KP 全部 ALLOW 题型的 PracticeSession E2E 抽样（题型/KP/承载生成器一致 + 七题型契约 check 通过）。

同步更新 [p25-04-semantic-evidence.test.js](../../tests/generator/p25-04-semantic-evidence.test.js)：角的认识/面积的认识随承载回归 concept-meaning，4 个 A 类代表 KP 规则行证据恢复全 pass。

## 6. 门禁结果（全绿）

| 门禁 | 结果 |
|---|---|
| npm test | **393/393**（380 + P25-09 新增 13） |
| verify（M0 五项） | **5/5 PASS** |
| check-allow-generation | **1570/1570 PASS** |
| check-syntax | **241 文件 / 0 错误** |
| derive-semantic-families --check | PASS（375 KP，15 族，多族 124，flagged 4） |
| audit-type-contract | JSON↔code 对齐 PASS；1570 题复扫 **0 违例** |
| check-lint | **0 违规** |

双 bundle（strategy 66 模块/7 shims、presentation 24 内联/73 委派）已重建。

## 7. 遗留与非目标

- 19 处非消费 KP 的 subTopic node=null/bundle 非 null（名称含「认识/比较」等被 number-concept 兜底）：绑定生成器不读 subTopic，无生成影响；如需彻底归零，后续可在派生表为 geometric/fraction 族补空规则或在审计侧维持消费方口径；
- shape 涂色 n³ 分支（三面=8、两面=12(n−2)、一面=6(n−2)²）为可选增强，本轮未做；
- P25-06 硬编码审计 H4=1 项债务维持原状。
