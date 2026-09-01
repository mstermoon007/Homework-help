# M4-R27 FROZEN_CORE_CHANGE 报告 — 六上负数/小数家族迁移

> 授权变更类型：M4 迁移批次（逐步摒弃双轨）。
> 生效提交：待定（本批次提交）。
> 门禁证据：FULL-EQ math-g6-oral neg-add-sub 9/9 + math-g6-calc dec-mult 9/9；
> verify:m4 全 PASS；test:regression PASS 1032 / FAIL 0；frozen-core 93/93 重锚。

## 1. 变更原因

单步口算（R24/R25）与多步简便计算（R26）两条轴均绿后，按既定路线推进到「六上负数/小数」轴：

- `math-g6-m1-g6-oral-neg-add-sub`（负数加减）：legacy 产出 `−a + b` / `−a − b` 水平题面
  （首操作数为负），SP 纯算术语义可解析（probe 9/9），FULL-EQ 对照前提成立。
- `math-g6-m2-g6-calc-dec-mult`（小数乘法笔算）：legacy 语义 question 为水平小数乘法表达式
  `1.17 × 0.45`（SP 可解析 9/9）；其竖直式仅用于渲染（renderDiv），语义仍为水平乘式。
- 同批其余候选均不可迁（设计外，保持 legacy）：
  - `dec-div`（小数除法笔算）：legacy 语义 question 含 `⟮` 竖式占位符，SP 解析为空操作符集
    → 无算术语义，保持 legacy。
  - `frac-mult-int/frac-mult-frac/frac-div-int/frac-div-frac/dec-perc/ratio-simp`：
    legacyType 对应 QT 仅 `apply`，无 calc/oral 语义 → N/A。
  - `frac-mult-div/solve-proportion/frac-order/frac-simple/solve-equation`：同上，仅 apply。

## 2. 变更内容（native 轨道扩展，6 个冻结文件）

### 2.1 `shared/generator/core/arithmetic-core.js`
- 新增 `buildNegAddsub(rng)`：`−a + b`（a∈[2,9], b∈[1,9], 答 b−a）与 `−a − b`
  （a,b∈[1,9], 答 −(a+b)）两种结构（镜像 legacy math-g6-oral buildNegAddSub）。
- 新增 `buildDecMult(rng)`：`dd`（一位小数×一位小数）、`di`（一位小数×整数）、
  `dd2`（两位小数×两位小数）三种结构（镜像 legacy math-g6-calc buildDecMult）；
  答案以 `toFixed(6)` 清理浮点噪声（legacy trimD 同款），保留小数位。
- `buildSpecialKind` 新增 `neg-add-sub`/`dec-mult` 两 kind 分派。

### 2.2 `shared/generator/core/kp-arithmetic-semantics.js`
- `SPECIAL_ORAL_PROFILE` 新增：
  - `neg-add-sub`: { operators:['+','−'], steps:1, kind:'neg-add-sub' }
  - `dec-mult`: { operators:['×'], steps:1, kind:'dec-mult' }
- 使 `resolveArithmeticSemantics` 对这两个 legacyType 返回可迁移语义，并在引擎注入
  `constraints.operation`、`constraints.kind`。

### 2.3 `shared/knowledge-math.js`（KB 表示范围修正）
- `math-g6-m1-g6-oral-neg-add-sub`：`number_range_default` {1,20} → **{−20,20}**
  （legacy 首操作数恒为负 −9..−2，原范围不含负值会导致 native 越界）。
- `math-g6-m2-g6-calc-dec-mult`：`number_range_default` {1,10000} → **{0.1,10000}**
  （legacy 因数可 <1，如 0.25×0.4，与 g5-oral-decmul {0.1,1000} 同款下界约定）。

### 2.4 `shared/generator/generator-registry.js`
- `generator:arithmetic-addition` 绑定 `math-g6-m1-g6-oral-neg-add-sub`。
- `generator:arithmetic-multiplication` 绑定 `math-g6-m2-g6-calc-dec-mult`。
- （与 R24/R25/R26 同款：KP 级绑定保证 native 选择确定且轨道为 core。）

### 2.5 `shared/generator/generator-mode.js`
- knowledgePoint 覆盖新增两个 KP → `native`。

### 2.6 `shared/generator/migration-switch.js`
- 新增 `R27_KPS`（2 KP）、并入 `ALL_MIGRATED`、导出。

## 3. 非冻结配套（dev / 产物）

- `shared/strategy-engine.bundle.js`：重建（模块 84）。
- `dev/migration/m1-m4-old-debt-scan.md`：增量记录 R27 批次与双轨摒弃进度表。

## 4. 影响面与回归

| KP | legacyType | 迁移 | FULL-EQ |
|----|-----------|------|---------|
| math-g6-m1-g6-oral-neg-add-sub | neg-add-sub | → native (arithmetic-addition) | 9/9 EQUIVALENT |
| math-g6-m2-g6-calc-dec-mult | dec-mult | → native (arithmetic-multiplication) | 9/9 EQUIVALENT |
| math-g6-m2-g6-calc-dec-div | dec-div | 保持 legacy（⟮ 竖式占位，设计外） | N/A |
| math-g6-oral frac-mult-int/frac-mult-frac/frac-div-int/frac-div-frac/dec-perc/ratio-simp | … | 保持 legacy（仅 apply QT，设计外） | N/A |
| math-g6-calc frac-mult-div/solve-proportion、math-g6-m3 混合族 | … | 保持 legacy（仅 apply QT，设计外） | N/A |

- 迁移门禁：`node dev/check-generator-migration.js math-oral,math-g4-oral,math-g5-oral,math-g4-mixed,math-g6-oral,math-g6-calc` → PASS
  （g6-oral: 可迁移=1 设计外=6；g6-calc: 可迁移=1 设计外=6）。
- verify:m4 全 PASS；verify:m1/m3 PASS；check-core-generators PASS；check-comprehensive-pipeline PASS。
- test:regression: PASS 1032 / FAIL 0 / PLAN_ERROR 774（与基线一致）。
- bundle 重建 + check-strategy-bundle PASS。
- 表示范围：neg-add-sub {−20,20}、dec-mult {0.1,10000}（KB 已修正，native 构造内聚）。

## 5. 基线重锚

以上 6 个冻结文件为核心迁移（R27 批）授权改动，基线已重锚（93/93）。
