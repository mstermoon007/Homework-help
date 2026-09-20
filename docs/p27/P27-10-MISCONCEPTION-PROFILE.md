# P27-10 MisconceptionProfile 易错点

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25 任务书 P25-10 缺口（kp-matrix 有 misconceptionSlots 空槽遵守「不伪造」原则，无 triggerPattern→变式 机制）

## 1. 目标

为每个 KP 建立易错点 → 出题变式的映射，且每条须有 KBL 事实依据（不伪造）。
响应轴必须有 P27-09 变式剖面实测证据，否则裁掉不产出。

## 2. 机械派生（dev/p27/derive-misconceptions.js）

**固定策略规则表（8 条 SSOT）× KBL 事实（operations/semanticFamily/maxSteps/
allowByQuestionType/grade）机械匹配**，每 slot 带 basis 引文（如
`semantic.operations∋乘除; grade=g2≤g3（表内段）`）——无一条手工指定 KP。

响应轴必须有 P27-09 变式剖面实测证据（evidenceRows>0，否则裁掉不产出）——共裁 653 条，
产出 **971 slots / 307 KP**：

| 错因 | slots | | 错因 | slots |
|---|---|---|---|---|
| 概念混淆 | 160 | | 计算错误 | 82 |
| 审题错误 | 307 | | 符号错误 | 12 |
| 格式错误 | 160 | | 单位错误 | 39 |
| 步骤错误 | 200 | | 口诀混淆 | 11 |

## 3. 数据落点（overlay 而非 kp-matrix）

产出 `kbl/teaching/misconception-profiles.json`（schema `p27-misconception.1`）。
**kp-matrix.json 的 misconceptionSlots 保持空槽不动**——它是 build-baseline.js 再生产物
（sem.assessment.errors 直投影），overlay 才是易错点 SSOT。测试冻结该不变量。

## 4. 派生期修正实录（跨族/形态教训的复用）

- 单位错误首跑 0 条：规则引用 semantic-families.json 的 `unit-measurement` 族名，但
  kp-matrix semanticFamily 是粗族词汇 → 改为粗族守卫（geometry/application-word）+
  KP 名称单位词正则（沿用 P25 subTopic 跨族防误配教训）→ 39 条。
- 口诀混淆首跑 0 条：`kp.grade <= 3` 恒 false（grade 是 "g2" 字符串形态）→
  `parseInt(String(kp.grade).replace(/\D/g,''),10)` → 11 条。

## 5. 交付文件

**新增**
- dev/p27/derive-misconceptions.js —— 派生脚本
- kbl/teaching/misconception-profiles.json —— 971 slots 易错点 overlay（p27-misconception.1）
- tests/generator/p27-misconception-profile.test.js（5）

## 6. 遗留与边界

- overlay 数据不经 bundle 内联（check-kbl-uniqueness 门禁）——浏览器侧 fail-open，
  完整链路由 Node 测试与 dev 门禁覆盖。
- 本专项产出的 overlay 由 P27-11 消费（Misconception→NextVariation），见
  [P27-11-LEARNER-ERROR-WIRING.md](./P27-11-LEARNER-ERROR-WIRING.md)。
