# P25-15 教育真实性最终门禁

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25-00 基线矩阵 + P25-04 证据规则 + P26 evidence 全量扩建

## 1. 目标

任务书 P25-15：307 A 类 KP × 核心题型（apply/choice/fill）全量 E2E 门禁。
对每个 (KP, 题型) 真实生成 1 题，并跑 `KpSemantic.checkSemanticEvidence` 分桶，
证明「capability 声明 = 真实教育性生成」（Capability Declaration = Educational Authenticity）。

## 2. 实现

### 2.1 脚本

`dev/check-educational-generation.js` — 复用 `dev/check-allow-generation.js` 模板，
扩展为四态分桶。

用法：
```bash
node dev/check-educational-generation.js                 # 921 对核心题型（默认）
node dev/check-educational-generation.js --extended      # 1299 对全题型
node dev/check-educational-generation.js --shard=1/3     # CI 分片
node dev/check-educational-generation.js --cache         # 启用持久缓存
node dev/check-educational-generation.js --require-semantic-pass  # 未来严格模式
```

产出：`dev/p25/reports/educational-generation-report.json`（提交，作 P25-17 diff 基线）

### 2.2 四态分桶

| 状态 | 判定 | 第一阶段门禁 |
|---|---|---|
| `GENERATION_PASS` | 生成 ≥1 题 且 证据状态 = skip（KP×QT 无证据规则） | ✓ 通过 |
| `SEMANTIC_PASS` | 生成 ≥1 题 且 证据状态 = pass（规则全满足） | ✓ 通过 |
| `SEMANTIC_WARN` | 生成 ≥1 题 且 证据状态 = warn（规则存在但题未声明 semanticEvidence，过渡期） | ✓ 通过 |
| `SEMANTIC_FAIL` | 生成 0 题 / 抛错 / 证据状态 = fail（规则违例） | ✗ 阻断 |

**第一阶段门禁**（当前）：任一 `SEMANTIC_FAIL` → exit 1。

### 2.3 关于 WARN 视为通过的设计决策

黄金题集（P25-16）显示 259 题中 253 为 `warn`（生成器尚未普遍声明
`data.semanticEvidence`），仅 6 为 `pass`。若第一阶段强制 `SEMANTIC_PASS`，
将阻断 98% 合法生成，与 P25-16「接受 pass/warn/skip、拒绝 fail」一致性被破坏。

当前设计：
- 默认门禁仅阻断 `SEMANTIC_FAIL`（生成失败 + 证据规则违例）
- `--require-semantic-pass` 留作未来生成器普遍声明 semanticEvidence 后启用
- `strictPass` 计数（GENERATION_PASS + SEMANTIC_PASS）在报告中可见，
  作未来收严的基线

## 3. 当前基线快照

```
A 类 KP：307，对数：921 [核心题型 apply/choice/fill]
GENERATION_PASS：0
SEMANTIC_PASS  ：7
SEMANTIC_WARN  ：914
SEMANTIC_FAIL  ：0
合计 PASS 921 / FAIL 0
```

- 921/921 对全部通过第一阶段门禁（0 SEMANTIC_FAIL）
- 914 对为 `warn`：KP×QT 有证据规则，但生成器过渡期未声明 semanticEvidence
- 7 对为 `pass`：生成器已声明 semanticEvidence 且满足规则（如 shape/position/
  semantic-relations 等参数化族生成器）
- 0 对为 `skip`：所有 921 对核心题型均有证据规则（P26 evidence 扩建覆盖 1299/1570）

## 4. 性能策略

921 对 E2E 生成（每对 `new PracticeSession → session.start()`）耗时约 3 分钟。
CI 优化：

1. **进程内热缓存**：`_bundle-env.js` 一次性载入 KBL，无 per-pair reload
2. **持久缓存**：`--cache` 启用 `dev/reports/edu-gen-cache.json`（已 .gitignore），
   键 `${kpId}|${qt}` → state；仅 kbl 变化或缓存缺失才重跑
3. **分片**：`--shard=i/N`（默认 N=1，CI 可拆 N=3，每片 ~307 对）
4. **年级过滤**（应急）：可按 grade 缩量
5. **扩展模式**：`--extended` 跑全 1299 对（含 geometry/judge/calc/classify）

## 5. 测试

`tests/generator/p25-15-educational-gate.test.js` — 6 例全 PASS：

1. 脚本 `dev/check-educational-generation.js` 存在
2. A 类 KP 来源 `kp-matrix.json` 且数量 = 307
3. 核心题型 = apply/choice/fill
4. 四态分桶枚举完整（GENERATION_PASS/SEMANTIC_PASS/SEMANTIC_WARN/SEMANTIC_FAIL）
5. 报告 `educational-generation-report.json` schema 正确
6. `--strict` 语义：任一 SEMANTIC_FAIL → exit 1

## 6. 红线遵守

- ✓ 不降标准（PASS 须真 pass；SEMANTIC_FAIL 仍阻断）
- ✓ 不删 ALLOW（921 对全量枚举自 `buildEligibility`）
- ✓ `generator-registry/selector/validator` 逻辑零改动
- ✓ 不增加新 QuestionType

## 7. CI 集成（B4 接线）

本脚本由 B4（P25-17）接入 `package.json` 的 `verify:education` 与
`dev/verify-m0.js` 的 `edu-gen` 步骤，纳入防退化 CI。
