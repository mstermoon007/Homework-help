# P17-0 测试真实性审计

## 目标

确认 npm test 是否真实覆盖 KBL/POL/Generation/Generator/Validator/Presentation，并区分 Unit/Integration/E2E。

## npm test 实际结果

### 运行事实（审计当日）

```
npm test → 存在 4 项失败（tests/orchestration/p11-01-coverage-quota.test.js）
```

### 失败明细

| 失败项 | 期望 | 实际 | 根因 |
|--------|------|------|------|
| C1 正常单题型：requested=planned=generated=final=20（SUCCESS） | 20 | 1 | capacity-map 该 KP 容量=1 |
| C7 Capacity 限制：requested ≥ planned ≥ generated = final，PARTIAL | 断言失败 | 见 C1 | 同上 |
| C8 Recovery：不突破 selectedKPs×selectedTypes | recovery 未发生 | 无空间 | 容量=1 无 recovery 空间 |
| C9 legacy 别名不丢失：oral → calc | 10 | 1 | 同上 |

### 根因

```
capacity-map.json
  math-g2-down-u01-k001（钟面结构）:
    total: 1, tier: VERY_LOW, limited: true, limitedKind: GENERATOR_LIMITED
```

p11-01 测试的 KPS 池取自 `KC.poolKpIds({math, grade 2}).slice(0,3)`，第一个恰好是容量=1 的 KP。

---

## 测试对口径的声明 vs 事实

| 项 | 测试声明 | 实际事实 |
|----|----------|----------|
| Canonical 题型 | "6（calc/fill/choice/judge/geometry/apply）" | 7（含 classify） |
| oral 别名 | "legacy 别名 → calc" | 仍有效（question-type-registry.js） |

测试注释与代码事实存在偏差（文档过时）。

---

## 测试覆盖矩阵

### KBL 相关
- `kbl:verify`（tools/kbl/verify.js） ✅ 覆盖
- `test:pol-kbl-shape`（tests/shape/*.test.js） ✅ 覆盖
- `verify:kb`（tools/kbl/validate.js） ✅ 覆盖

### POL 相关
- `test:pol-generation`（tests/orchestration/*.test.js） ⚠️ 部分失败
- p11-01-coverage-quota ⚠️ 4 失败

### Generation / Generator / Validator
- `verify:m4`（tests/generator/*.test.js + check-generator-contract + check-generator-registry + check-core-generators） ✅ 通过
- test:svg-units ✅ 通过
- tests: difficulty ✅ 通过

### Presentation
- check-presentation-runtime ✅ 通过
- verify:presentation-runtime ✅ 通过

---

## 结论

### 测试真实性：⚠️ 部分真实

- **真实覆盖**：KBL、Generator、Validator、SVG、Difficulty、Strategy 均有真实测试且通过。
- **POL 编排测试**：4 项失败，根因是 capacity-map 中特定 KP 容量=1 与测试期望冲突。
- **E2E**：`test:e2e` 需要浏览器，未在 npm test 主链。

### 修复建议（进入 P17 前）

1. **DATA**：确认 `math-g2-down-u01-k001` 容量是否应更大（可能属人工数据确认，或测试应改用容量充足 KP）。
2. **CONTRACT**：测试文件注释 canonical 6→7 对齐。
   - **已闭合（P17-10）**：`tests/orchestration/p11-01-coverage-quota.test.js` 升级为 7 类全量覆盖（含 classify 载体池），新增 `tests/orchestration/p17-10-classify.test.js` 收口 25 载体真实生成；`docs/pol-contract.md` 契约同步对齐 7。
3. 修复后回归 npm test 全绿。