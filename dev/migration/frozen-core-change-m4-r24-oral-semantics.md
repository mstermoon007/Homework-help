# FROZEN_CORE_CHANGE — M4-R24 口算特殊语义白名单（3 KP 迁移 + div-tens 修复）

> 变更类型：M4-R17 迁移批次的授权扩展（用户决策：扩展算术语义白名单 → 先修 oral-divt 先例）
> 范围：7 个冻结核心文件 + 1 个构建产物 + 1 个 dev 工具。冻结基线已按授权重锚（93/93）。

## 1. 背景

- 507 个真实未迁移 KP 中，31 个纯数学算子 KP 全部 FULL-EQ=0/31（6 个 add/sub 为图形/列式插件 → DIFFERS/NO_PARSE；25 个 legacyType NON_MIGRATABLE）。
- 决策：扩展算术语义白名单（SPECIAL_ORAL_PROFILE）覆盖 4 个整数域口算 KP，使 native 产出与 legacy 相同粒度的技能结构。
- 首个先例 `oral-divt` 此前（v4.0.0/135ca55）已 native 但为**小除法**（16÷2=8）而非整十除法（240÷60），本次一并修复。

## 2. 冻结核心变更明细（7 文件）

| 文件 | 变更 | 原因 |
|------|------|------|
| shared/generator/core/kp-arithmetic-semantics.js | 新增 `SPECIAL_ORAL_PROFILE`（big-addsub/mul3x1/mul2tens/div-tens）带 `kind` 字段并导出 | 4 个 legacyType 由 NON_MIGRATABLE → 纯算术语义可解析 |
| shared/generator/core/arithmetic-core.js | 新增 `buildBigAddsub`/`buildMul3x1`/`buildMul2tens`/`buildDivTens`/`buildSpecialKind`；`buildDivTens` 按 `range.max` 约束被除数 | native 需以 legacy 相同粒度生成技能结构；已在 FULL-EQ 中发现并修复被除数越界（5600>5000） |
| shared/generator/generators/arithmetic.js | generate 先按 `kind` 分发 `buildSpecialKind`，并传 `numberRange`；无 kind 回退 generateStructure | 按 KP 语义选择正确结构与范围 |
| shared/strategy/strategy-engine.js | 注入 `constraints.kind`（源自 arithSem.kind） | 让算术生成器读到语义 kind |
| shared/generator/generator-registry.js | oral-big → arithmetic-addition/+subtraction；mul3x1/mul2t → arithmetic-multiplication | 3 KP 路由到 native 核心生成器 |
| shared/generator/generator-mode.js | oral-big/mul3x1/mul2t 增加 `native` 硬编码切换（oral-divt 已存在） | 与 P4-R04 口算批次先例一致 |
| shared/knowledge-math.js | number_range_default：oral-big {1,10000}、mul3x1 {1,1000}、mul2t {1,100}、divt {1,5000} | 语义范围对齐 legacy 技能规模 |

## 3. 非冻结变更

| 文件 | 变更 | 理由 |
|------|------|------|
| dev/test-migration-equiv.js | legacyExtra 增加 `type=kpCanon.source.legacyType`（math-g4-oral 按 type 驱动技能）；KP 不支持题型 → N/A 跳过且不计入等价基数；N/A 从 all 中过滤 | math-g4-oral 插件忽略 operators、以 type 选技能，old 对照不公平；oral 仅为 league 级（law-oral）能力并集，非 4 个整数域 KP 实际能力 |
| shared/strategy-engine.bundle.js | 重建（含 M4-R24 + 既有 KD-4 产物） | build 产物，check-strategy-bundle PASS |

## 4. 验证证据

- FULL-EQ（math-g4-oral）：oral-big / mul3x1 / mul2t / div-tens 均 `calc=9/9 FULL-EQ`；dec/law 维持 N/A。
- math-oral 迁移批不变：12/21 FULL-EQ，门禁 [PASS]（可迁移=12 全部 FULL-EQ）。
- verify:m4 全门禁 PASS（含 R01-R21 + check-generator-mode + migration + switch + r18 + bundle 一致）。
- test:regression：PASS 1032 / FAIL 0 / PLAN_ERROR 774（与基线一致，零回归）。
- check-frozen-core：93/93，基线已重锚（--baseline）。

## 5. 设计说明

- **能力并集 vs 单 KP 能力**：math-g4-oral 的 `oral` QT 仅来自 law-oral（KP 级能力），4 个整数域 KP 能力均为 calc。FULL-EQ 改为按真实可比 case 判定，避免插件级并集把 calc-only KP 误判为失败。
- **范围语义**：等价门禁校验的是**操作数**（非答案）。div-tens 的被除数本身是操作数，必须 ≤ range.max；mul3x1/mul2t/big-addsub 操作数天然在范围内。