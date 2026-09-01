# FROZEN_CORE_CHANGE — M4-R25 小数/运算律口算扩展（4 KP native 迁移）

> 变更类型：M4-R24 模式的续批（用户决策：续算纯 calc/oral 白名单批）。
> 范围：4 个冻结核心文件 + 1 KB 文件 + 1 个 dev gate 校验口径。冻结基线已按授权重锚（93/93）。

## 1. 背景

- 507 未迁移 KP 中，纯 calc/oral 数学 KP 共 127（其余 21 为 cn/en 语言类）。
- 分类：14 个单算子（+/−/×/÷）已可解析但来自数学图像/应用题插件（呈现解耦，保持 legacy 设计上正确）；其余 ~113 SEM-FAIL。
- 其中「口算族」与 M4-R24 同源（同类 legacy 插件、纯表达式输出），本次扩 4 个：g4 `oral-dec`/`oral-law`，g5 `oral-decmul`/`oral-decdiv`。

## 2. 冻结核心变更明细（5 文件）

| 文件 | 变更 | 原因 |
|------|------|------|
| shared/generator/core/kp-arithmetic-semantics.js | SPECIAL_ORAL_PROFILE 增 `dec-addsub`/`law-oral`/`dec-mul-oral`/`dec-div-oral`（带 kind） | 4 legacyType 纳入纯算术语义白名单 |
| shared/generator/core/arithmetic-core.js | 新增 `buildDecAddsub`/`buildLawOral`/`buildDecMulOral`/`buildDecDivOral`/`trimDec`；`buildDecDivOral` 按 range.min 约束被除数；**`apply()` 的 OP_DIV 由 Math.floor 改为精确除法**（原用于整数整除，现需支持小数除法；所有整数构造均严格整除不受影响） | native 镜像 legacy 相同粒度；改造除法支持小数 |
| shared/generator/generator-registry.js | oral-dec → addition/subtraction；oral-law/oral-decmul → multiplication；oral-decdiv → division | 4 KP 路由到 native 核心生成器 |
| shared/generator/generator-mode.js | 4 KP 增加 `native` 硬编码切换 | 与 P4-R04/M4-R24 口算批先例一致 |
| shared/knowledge-math.js | number_range_default：dec{0.1,20}、law{1,1000}、decmul{0.1,1000}、decdiv{0.1,100} | 语义范围对齐 legacy 技能规模（小数下界 0.1、乘法/运算律上界放大） |

## 3. 非冻结变更

| 文件 | 变更 | 理由 |
|------|------|------|
| dev/check-core-generators.js | checkArithmeticInvariant 改数值容差（1e-6），翻 n(normalize) 后比较 | M4-R06 语义不变量原先 `String(expected)===String(answer)` 对小数除法浮点噪声（0.8999… vs 0.9）误报 |
| shared/strategy-engine.bundle.js | 重建 | build 产物，check-strategy-bundle PASS |

## 4. 验证证据

- FULL-EQ：math-g4-oral **6/6 MIGRATABLE [PASS]**（big/mul3x1/mul2t/divt + dec/law 全绿）；math-g5-oral 2/2（decmul/decdiv）；math-oral 12/21 不变。
- 迁移门禁（3 batch 并跑）[PASS]：math-oral 可迁移=12、math-g4-oral 可迁移=6 设计外=0、math-g5-oral 可迁移=2。
- verify:m4 全门禁 PASS（含 M4-R06 语义不变量 OK、R14/R17/R18/R21、bundle 一致）。
- test:regression：PASS 1032 / FAIL 0（与基线一致）。
- verify:m1（KB 变更后）：全 PASS。
- check-frozen-core：93/93 重锚。

## 5. 设计说明

- **小数精度**：builder 用 `trimDec`（toFixed(2)）产出字符串 answer；FULL-EQ 与 R06 gate 均以 ≤1e-6 数值容差比较，避免浮点噪声。
- **除法由 floor 改精确**：legacy 整数除法（div-tens/div-table/复杂链）均构造为严格整除，floor 与精确结果一致；小数除法需要精确商，故 `apply()` 统一改为 `a / b`，无破坏面（回归 FAIL=0 佐证）。
- **能力并集**：oral-dec 为 calc，其余 3 个为 oral-only；FULL-EQ N/A 跳过逻辑（M4-R24 已引入）维持正确判定。
