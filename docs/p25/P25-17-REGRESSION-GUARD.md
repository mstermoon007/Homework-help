# P25-17 防退化测试纳入 CI

状态：已完成（本报告随实现同批提交）
日期：2026-09-20
前置：P25-14 覆盖率报告 + P25-15 教育真实性门禁 + P25-16 黄金题集

## 1. 目标

任务书 P25-17：将 ALLOW/SEMANTIC/Golden/KP identity/QT/evidence 6 项退化检测
纳入 CI，任一退化即 FAIL。防退化测试是 P25 教学语义深度的「守门人」，
确保已通过的基线不会因后续重构静默回退。

## 2. CI 接线

### 2.1 package.json 新增 3 脚本

```json
"verify:education": "node dev/check-educational-generation.js",
"verify:coverage": "node dev/p25/build-coverage-report.js --strict",
"verify:golden": "node dev/p25/validate-golden-dataset.js"
```

### 2.2 dev/verify-m0.js 新增 3 blocking 步骤

在 `steps[]` 数组末尾追加：

```js
{ key: 'edu-gen',  spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'check-educational-generation.js')] } },
{ key: 'coverage', spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'p25', 'build-coverage-report.js'), '--strict'] } },
{ key: 'golden',   spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'p25', 'validate-golden-dataset.js')] } }
```

均 blocking（不加 `nonBlocking:true`），失败计入最终 FAIL。

## 3. 防退化 6 项

| 退化项 | 检测方法 | 脚本 | 失败行为 |
|---|---|---|---|
| ALLOW 下降 | 实时跑 `KCV.buildEligibility` 统计 ALLOW 数 vs 基线 1570 | check-allow-generation.js | exit 1 |
| SEMANTIC 退化 | 307 A 类 KP × 核心题型 E2E，任一 SEMANTIC_FAIL | check-educational-generation.js | exit 1 |
| Golden 失败 | 黄金题 9 字段 + 证据状态 + 族覆盖 + 无重复 | validate-golden-dataset.js | exit 1 |
| KP identity 错误 | 黄金题 kpId ∈ A 类 KP 集合（防 KP 改名/删除） | validate-golden-dataset.js + p25-17 test #8 | exit 1 |
| questionType 错误 | 黄金题 questionType ∈ apply/choice/fill（防题型改名） | validate-golden-dataset.js + p25-17 test #9 | exit 1 |
| coverage 退化 | coverage-report newDeclaredOnly > 0（防生产消费撤回） | build-coverage-report.js --strict | exit 1 |

### 3.1 coverage --strict allowlist 机制

`build-coverage-report.js --strict` 仅对 allowlist 之外的新增 declared-only
字段阻断。当前 allowlist 2 项（均为 dev 基线/观察产物，非生产消费对象）：

- `kpSemantic.kp-matrix.json` — P25-00 基线矩阵，生产直读 kbl/root
- `variation.variation-profiles.json` — P27-09 观察产物，生产由 variation-directive.js 接入

新增 declared-only 字段（如某维度字段被重构出生产消费链）会触发 exit 1，
防生产消费静默撤回。

## 4. 测试

`tests/generator/p25-17-anti-regression.test.js` — 10 例全 PASS：

**CI 接线（4）**：
1. package.json 含 verify:education 脚本
2. package.json 含 verify:coverage 脚本（--strict）
3. package.json 含 verify:golden 脚本
4. verify-m0.js steps 含 edu-gen/coverage/golden 三键

**防退化（6）**：
5. ALLOW 基线 = 1570（实时跑 buildEligibility）
6. educational-generation-report.json 存在且 semanticFail = 0
7. golden-validation-report.json passed = true（0 errors）
8. 黄金题 kpId 全部 ∈ A 类 KP 集合
9. 黄金题 questionType 全部 ∈ apply/choice/fill
10. coverage-report.json 无新增 declared-only 字段

## 5. 当前基线快照

```
CI 接线：3 脚本 + 3 verify-m0 步骤（均 blocking）
ALLOW：1570/1570 真实生成
教育真实性：921/921 PASS（0 SEMANTIC_FAIL）
黄金题：259 题，0 errors，15 族全覆盖
覆盖率：7 维，5 implemented，2 known declared-only，0 new
```

## 6. 红线遵守

- ✓ 不重构 KBL/POL/Difficulty Core（仅接线 CI 脚本）
- ✓ 不降 Validator 标准（--strict allowlist 仅豁免已知 dev 产物）
- ✓ 不增加新 QuestionType
- ✓ 防退化测试不参与运行时评分（仅 CI 阻断）
