# P36 变更日志（P35 遗留问题收口战役）

> 战役性质：P35-FINAL 已冻结后的遗留销账小战役，不新立架构。
> 立项依据：用户 2026-10-12 指令「解决遗留问题」，范围与口径经签批：
> ① g4-down-u02-k001 judge/apply 配图修复（签批：配主题原材料图）；
> ② DEBT-4 开放设计类讲解深化（签批：规则内重组——仅用生成器既有素材重组，不编支架）；
> H1–H5 人工请求维持催办态不处理。
> 日志 append-only，六字段，最新在上。

---

## P36-03 · 可达性裁决执行：reasoning sudoku/winning 死分支物理删除（2026-10-12）

- **modified**：
  - `shared/generator/generators/reasoning.js`：物理删除 ① type 分派两行（`name.indexOf('数独')`/`name.indexOf('必胜')`）；② `type === 'sudoku'`、`type === 'winning'` 两个 else-if 分支块（含 P36-02 重组文案，约 30 行），不留壳不留别名；分派点留一行 P36-03 裁决标记注释。其余 11 个 type 分支（drawer/extreme/chicken-rabbit/tree-planting/find-defect/handshake/optimization/seq/logic/calc/table789）零改动。
  - `tests/generation/p36-explanation-restructure.test.js`：P36-02 的 sudoku/winning 两条正向断言随删除重写为一条防双轨回归负断言（注入历史名称「数独游戏」「必胜策略」，断言桩题「（推理过程略）」与数独/必胜模板不得复现、logic 兜底题完整）。
  - `shared/engine/strategy-engine.bundle.js` 重建。
- **deleted**：reasoning.js 内 sudoku/winning 死分支（type 分派 2 行 + 两个分支块）。
- **reason**：P36-02 risk① 可达性裁决执行——用户 2026-10-12 指令「处理数独和必胜分支的可达性裁决」。三方印证（死代码清理固化流程）：① 生产消费者 grep——`kbl/`（canonical+teaching，semanticParams.name 唯一来源）与 `dev/` 零命中；`shared/` 仅 reasoning.js 本体 + bundle 重产物 + `question-type-registry.js` L93 的 `'winning'` 字符串键（系 F-TYPE 子类型映射表键，属 H4 人工请求挂账范围，与 reasoning.js 内部 type 分派无功能耦合，不连带删、只登记）；generator:reasoning 绑定 14 KP 名全量核验无「数独/必胜」关键词。② 门禁——6b/6e 冻结矩阵对 sudoku/winning 零引用，1570 行生成从未命中。③ 测试面——仅本会话 P36-02 新增用例直调注入，随删重写为负断言。运行时终证：删除后 6b/6e 免 `--write` 直接 PASS（生成零漂移）。按 P30 §5 物理删除，档案（f-type-2-affected-kps.csv 等）历史保留不动。
- **tests**：定向 p36-explanation-restructure 5/5（-2 正向 +1 负向）；npm test 750/750 PASS；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome；CI 31/0/0）；6b/6e 免重冻 PASS（等价证明）；门禁 21 死代码矩阵 / 22 Legacy 治理 PASS。
- **risk**：① 未来若 root Excel 新增数独/必胜类 KP，须走完整派生链后在 reasoning 重建对应 maker（届时独立立项，非本任务回退）；② `question-type-registry.js` 的 `'winning'` F-TYPE 键可达性属 H4 挂账范围，本任务不触及；③ 未 git commit。

---

## P36-02 · DEBT-4 销账：开放设计类讲解「规则内重组」（2026-10-12）

- **modified**：
  - `shared/generator/generators/semantic-special.js`：code-recognition apply 讲解模板重组——答案均为「直接作答；依据/好处」两分结构且题面为多任务设问，双段答案重组为「按题面任务逐项作答：① …；② …」（消除 k005 旧模板「根据数字编码规则：规则：…」叠词病句），单段答案回落「依据题中的编码规则作答：…」；fill/choice 分支保持 P34-14 口径不连带。
  - `shared/generator/generators/reasoning.js`：sudoku 讲解拆为「依据（数独规则）：…。推理方法：…」；winning 三变体拆为「依据（策略名）：…。执行：…。结论：…」，策略名（对称/凑 5/尼姆和）取自答案括号既有文本。两分支零新增教学语义，仅既有文案结构拆分。
  - `tests/generation/p36-explanation-restructure.test.js`：新增定向断言 6 用例（逐项作答结构/单段回落/无叠词/讲解含答案要素/数独依据→方法/必胜依据→执行→结论/fill·choice 防线）。
  - 重冻/派生：`variation-profiles.json`/`misconception-profiles.json` 派生重跑；`P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b，1570 行 0 FAIL）；`P30-KP-QT-MAKER-MATRIX.{json,md}`（6e）；`shared/engine/strategy-engine.bundle.js` 重建。
- **deleted**：一次性取证探针 `dev/p36-probe-explanations.js`（断言已固化进定向测试，删后 check-all 复跑等价）。
- **reason**：P35-FINAL risk① / P34-14 risk① 遗留销账（DEBT-4）——code-recognition apply、数独、必胜策略三类讲解为「规则结论复述」。用户 2026-10-12 签批口径「规则内重组」：仅用生成器既有素材（规则文本/答案结论/题面任务）重组为「依据→结论」结构，不新增教学支架、不编造逐步支架类假冒解析。修复后 15 条 apply 讲解全部与题面多任务一一对应，数独/必胜讲解为既有文案的显式结构化。
- **tests**：定向测试 6/6；npm test 751/751 PASS（+6 新用例）；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome；CI 31/0/0）；6b/6e 重冻 1570 行 0 FAIL；6g 泄露门禁 PASS；probe 复验 5 KP×apply 全量讲解非空、非复述、含答案要素。
- **risk**：① 数独/必胜分支经 canonical 375 KP 名核验不可达（无 KP 名含「数独」「必胜」），属源码层模板，本任务按签批范围只重组不删分支，可达性处置登记待裁决；② apply 答案文案本身未动，仅讲解结构变化，375/98/373/1570 基线不变；③ 未 git commit。

---

## P36-01 · judge/apply 配主题原材料图：shapeTheme 第 5 参 judgeGraphic/applyGraphic（2026-10-12）

- **modified**：
  - `shared/generator/generators/shape.js`：① `shapeTheme` 新增可选第 5 参 `opts.judgeGraphic / opts.applyGraphic`（descriptor 对象），缺省时 judge/apply 沿用 qMeta 派生图（其余 69 KP 行为零变化）；② `makeThemedShapeQuestion` judge/apply 分支消费该声明（`!noGraphic && theme.judgeGraphic/applyGraphic` 时深拷贝直通覆盖 data.graphic）；③ `math-g4-down-u02-k001` 条目补第 5 参：judge 配 cuboid 观察对象示意（length:4/width:2/height:2, labelSides:false）、apply 配 cube 原材料示意（edge:2, labelSides:false），均带 unit=cm/unitPx=25 满足 evidence 锚定；题面/答案文案零变化。
  - `tests/generation/p28-hollow-shape-themed.test.js`：新增 P36-01 用例（judge 3 题恒 cuboid、apply 3 题恒 cube、labelSides:false、unit=cm、role 回显，防 flat 族回退）。
  - 冻结产物重冻：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}`（6b，1570 行 0 FAIL）、`docs/P30/.../kp-qt-maker-matrix.{json,md}`（6e）。
  - `shared/engine/strategy-engine.bundle.js` 重建（presentation 侧零改动）。
- **deleted**：无。
- **reason**：P35-CLOSE-01 risk① 遗留销账——本 KP judge/apply 沿用 qMeta 派生 flat 族图（circle/square），与「从不同方向观察物体」题面语义弱相关。用户 2026-10-12 签批「配主题原材料图」：judge 命题是观察物体的事实/误区判断，配 cuboid 观察对象示意；apply 情境是摆小正方体，配 cube 原材料示意；同语义域、不泄题、不带棱长数字误导。data.shapeName 保留 qMeta 原名（不进 DOM，仅供 graphicOrInstruction/6e makerKey，刻意不动）。
- **tests**：定向测试 hollow-shape-themed 14/14；npm test 745/745 PASS（+1 新用例）；`node dev/check-all.js` = 30 PASS / 0 FAIL / 1 SKIP（#15 本机无 Chrome；CI 31/0/0）；6b/6e 重冻 1570 行 0 FAIL；6g 泄露门禁 PASS；probe 确认 judge 3 题 cuboid / apply 3 题 cube 且 labelSides:false。
- **risk**：① judge 命题为抽象事实，配图定位是「观察对象示意」而非题设数据（练习册判断题配示意图惯例）；② choice/fill/geometry 三行已在 P35-CLOSE-01 修复，本任务不触及；③ 未 git commit。
