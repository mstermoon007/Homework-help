# P27-09 VariationProfile 变式系统

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25 任务书 P25-09 缺口（schema 有 variationDimensions 字段、生成器有隐式变式，但无显式 VariationProfile 机制与漂移校验）

## 1. 目标

把生成器已有的隐式变式（未知量/情境/数值）显式化为可校验的 VariationProfile，
并建立跨运行漂移门禁。红线：不伪造证据（一切从真实生成产出机械派生）。

## 2. 五轴观测（dev/p27/variation-observe.js，纯函数公共模块）

对每 ALLOW 行 × PracticeSession N=6 真实生成样本做浅层普查（census，路径前缀 `data.`，
与 evidence-rules 路径约定一致）：

| 轴 | 判定口径 |
|---|---|
| unknown | 答案承载位（data 叶子值 == answer 值的路径集） |
| numeric | distinct 答案 ≥2 → varies + 值域 |
| context | 题干 ≥2 汉字样本占比 ≥0.5 → present |
| representation | data 中 graphic/svg/picture/image/diagram 类路径 + 取值集 |
| structure | data.steps 类字段取值集 |

derive 与 drift check 同源（同一 observeRow），保证比对有意义。

## 3. 派生与漂移门禁

- `dev/p27/derive-variation-profiles.js`：枚举 1299 行（307 A 类 KP × ALLOW 题型，与
  check-allow-generation 同机制）→ `kbl/teaching/variation-profiles.json`
  （schema `p27-variation.1`）。
- **结果**：1299/1299 成剖面（生成失败 0），轴覆盖 unknown=536 / numericVaries=892 /
  context=1295 / representation=662 / structure 多步=24；flags 纪律完整
  （single-sample=372，unknown-not-observed=763）。
- `dev/p27/check-variation-drift.js`：重生成 N=6 与 profile 逐行比对 →
  `dev/p27/reports/variation-drift-report.json`。

## 4. 硬/软漂移契约（跨运行 RNG 抖动的工程解）

RNG 基种子跨运行非确定，值依赖轴天然抖动——两轮 derive 实测 unknown 525→523、
numericVaries 888→892。据此把契约分为两级（policy 声明于 profile 文件头）：
- **硬轴（漂移即 exit 1）**：`context.present`、`representation.present`、
  `representation.paths`——值无关，确定性可断言。
- **软轴（report-only）**：`unknown.positions`、`numeric.varies`、`structure.steps`
  ——structure 首跑曾出真实硬违例（fill 生成器按样本随机步数），结构边界本就由
  validator check#5 守护，故降为软轴。

门禁现状：1299 行比对，硬违例 0，软报告 200（封顶上报），PASS。

## 5. 交付文件

**新增**
- dev/p27/variation-observe.js —— 五轴观测纯函数模块（derive 与 drift 同源）
- dev/p27/derive-variation-profiles.js —— 派生脚本
- dev/p27/check-variation-drift.js —— 漂移门禁
- kbl/teaching/variation-profiles.json —— 1299 行变式剖面（p27-variation.1）
- dev/p27/reports/variation-derive-report.json、variation-drift-report.json
- tests/generator/p27-variation-profile.test.js（9）

## 6. 遗留与边界

- 软轴（unknown/numeric/structure）漂移为 report-only——RNG 非确定性使值依赖轴不可
  硬断言；结构边界已由 validator check#5 独立守护。
- 本专项产出 P27-11 消费链所需的变式轴证据（context/numeric 等），见
  [P27-11-LEARNER-ERROR-WIRING.md](./P27-11-LEARNER-ERROR-WIRING.md)。
