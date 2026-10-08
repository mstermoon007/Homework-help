# 答案系统专项审计报告（只读，不改代码）

## 审计范围与方法

- **范围**：数学科目答案系统全链路（Generator → Schema → RenderFormat → AnswerValidator → Check → PracticeSession → Bridge）
- **方法**：代码审查 + 现有测试分析 + 数据流追踪
- **性质**：只读审计，不修改任何代码

---

## 发现 1：运行时批改链不消费 `acceptable` 白名单【高危】

### 证据

**生产端**（`shared/generator/generators/semantic-relations.js` L79-85）：
```javascript
function finish(q, prompt, answer, acceptable, explanation) {
  q.prompt = prompt;
  q.answer = {
    value: String(answer),
    acceptable: acceptable || [],  // maker 显式传入替代答案
    explanation: explanation || ...
  };
}
```

**传输端**（`shared/presentation/render-format.js` L77-79）：
```javascript
answer: (sq.answer && sq.answer.value != null) ? sq.answer.value
  : (sq.answer && Array.isArray(sq.answer.acceptable) && sq.answer.acceptable.length) ? sq.answer.acceptable[0]
    : (sq.answer ? sq.answer.value : null),
```
→ acceptable 数组在 RenderFormat 被丢弃，legacy 层只保留单个 value 或 acceptable[0]。

**消费端**（`shared/core/check.js` L14-26 `defaultQCheck`）：
```javascript
var ua = answers ? answers[i] : undefined;
var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
return normalizeAns(ua) === normalizeAns(ans);
```
→ 直接字符串比较 `q.answer`，不消费 `acceptable` 数组。

**批量门禁端**（`shared/validator/answer-validator.js` L213-237 `validateNumericAnswer`）：
```javascript
var candidates = [val].concat(acceptable).map(...).filter(...);
var match = candidates.some(function (c) {
  var cn = coerceNumber(c);
  var en = coerceNumber(expectedStr);
  if (cn != null && en != null) {
    var precision = answerObj.precision != null ? answerObj.precision : 2;
    return Math.abs(cn - en) < Math.pow(10, -precision);
  }
  return c === expectedStr;
});
```
→ 正确消费 acceptable，支持数值精度容差。

### 影响

| 场景 | 批量门禁（validateNumericAnswer） | 运行时（defaultQCheck） |
|---|---|---|
| 用户输入 "3" vs answer.value="3" + acceptable=[] | ✅ 对 | ✅ 对 |
| 用户输入 "三" vs answer.value="3" + acceptable=["三"] | ✅ 对 | ❌ 错 |
| 用户输入 "0.3" vs answer.value="0.30" + precision=2 | ✅ 对 | ❌ 错（字符串不等） |
| 用户输入 "8余5" vs answer.value="8……5" | ✅ 对（validateRemainderAnswer） | ❌ 错 |

**结论**：acceptable 白名单在批量门禁有效，但在运行时批改完全失效。maker 精心设计的替代答案（如中文数字、不同格式、余数记号）用户永远得不到分。

### 根因

`PluginUtil.computeResult` 默认使用 `defaultQCheck`，而不是调用 `answer-validator.js` 的 `validateAnswer`。两条批改链并行存在但功能不对等。

---

## 发现 2：`validateAnswer` judge 分支 hardcode 期望 true【中危】

### 证据

`answer-validator.js` L354-357：
```javascript
} else if (qType === 'judge' || qType === 'true-false') {
  // 判断题需知期望值（此处无法自动推断，仅做格式校验）
  var res2 = validateJudgeAnswer(answerObj, true); // 默认期望 true
  warnings.push({ code: 'JUDGE_ANSWER_UNVERIFIED', ... severity: 'INFO' });
}
```

→ 所有 judge 题在批量门禁中被默认期望 true。如果实际答案是 false，`validateJudgeAnswer` 会报 ANSWER_MISMATCH（ERROR），但 `warnings.push` 只是 INFO，不影响 `valid` 判定。

→ 运行时 `check.js` 的 judge 分支：
```javascript
// defaultQCheck 中 judge 走普通字符串比较
return normalizeAns(ua) === normalizeAns(ans);
```
→ 直接比较用户输入和 answer.value 字符串，不区分语义。

### 影响

- 批量门禁中，所有 judge 题若 answer.value=false 会被标记为 ERROR（期望 true），但 `valid` 只看 errors.length===0，所以这些题实际会 FAIL
- 这是一个假阳性：题目本身是对的，但门禁误判
- 运行时批改不受影响（直接字符串比较）

---

## 发现 3：apply/geometry/classify 等题型批改仅非空校验【中危】

### 证据

`answer-validator.js` L381-386：
```javascript
} else {
  // 其他类型（apply, open, operate 等）仅做非空
  if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
    warnings.push(createError(..., '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
  }
}
```

→ apply/geometry/classify 等题型在批量门禁中只做非空检查，不验证答案正确性。

→ 运行时 `defaultQCheck` 同样只做字符串比较。

### 影响

- 应用题（apply）的数值答案是否正确，系统层面不验证
- 几何作图题、分类题没有自动批改能力
- 这些题型的答案质量完全依赖 Generator 的正确性和人工抽查

---

## 发现 4：答案归一化链存在信息丢失【中危】

### 证据

`render-format.js` L77-79 的 answer 归一化：
```javascript
answer: (sq.answer && sq.answer.value != null) ? sq.answer.value
  : (sq.answer && Array.isArray(sq.answer.acceptable) && sq.answer.acceptable.length) ? sq.answer.acceptable[0]
    : (sq.answer ? sq.answer.value : null),
```

→ 优先级：value > acceptable[0] > null。acceptable 数组被降维成单个字符串。

→ `check.js` `defaultQCheck` 比较的是 legacy `q.answer`（字符串），acceptable 数组已丢失。

### 影响

即使 maker 正确产出 acceptable，到了运行时批改链也只剩一个值。这是发现 1 的直接原因。

---

## 发现 5：测试覆盖存在盲区【低危】

### 现有测试

| 测试文件 | 覆盖内容 | 用例数 |
|---|---|---|
| `tests/validator/answer-validator.test.js` | computeExpectedAnswer 安全 parser | 21 |
| `tests/generation/p25-07-type-contracts.test.js` | 题型契约 enforce | ? |
| `tests/generation/generator-contract.test.js` | Generator 输出 schema | ? |

### 盲区

1. `validateAnswer` 主入口的各题型分支没有专项测试
2. `defaultQCheck` 的 acceptable 消费没有测试
3. 「答案为 null」的逐题型断言没有测试
4. batch-validator 的 ANSWER_INCOMPLETE 没有专项测试
5. acceptable 白名单的边界 case（空数组、含错误值、重复值）没有测试

---

## 发现 6：Generator 端答案产出模式不统一【低危】

### 已核实的 maker

| Maker | value 类型 | acceptable | explanation |
|---|---|---|---|
| arithmetic.js | String() | [] | 有 |
| selection.js | String() | []（fill）/ undefined（choice） | 有 |
| semantic-relations.js | String() | 显式传入或 [] | 有 |
| shape.js | 未核实 | 未核实 | 未核实 |
| stats.js | 未核实 | 未核实 | 未核实 |

### 潜在问题

- acceptable 是否有 maker 误把错误答案放进白名单？
- acceptable 是否有 maker 遗漏（如 "3" 和 "三" 等价）？
- explanation 是否与答案语义一致？

---

## 汇总

| 序号 | 问题 | 严重级别 | 影响面 | 修复复杂度 |
|---|---|---|---|---|
| 1 | 运行时不消费 acceptable | 高 | 所有有 acceptable 的题型 | 中（需改 computeResult 或 defaultQCheck） |
| 2 | judge hardcode 期望 true | 中 | 所有 answer=false 的 judge 题 | 低（需从题干推断或标记） |
| 3 | apply/geometry 等仅非空校验 | 中 | 非计算题型 | 高（需题型专用批改器） |
| 4 | RenderFormat 丢失 acceptable | 中 | 所有题型 | 低（保留数组即可） |
| 5 | 测试覆盖盲区 | 低 | 质量保障 | 中（补测试） |
| 6 | Generator 产出模式不统一 | 低 | 代码质量 | 低（规范化） |

---

## 建议修复优先级

1. **P0**：统一运行时批改链——`computeResult` 支持 acceptable 消费（或 defaultQCheck 升级为调用 validateAnswer）
2. **P1**：修复 RenderFormat answer 归一化——保留 acceptable 数组供下游消费
3. **P1**：修复 judge hardcode true——从题干语义推断期望值
4. **P2**：补充测试覆盖——validateAnswer 各题型分支 + acceptable 消费 + null 防御
5. **P2**：Generator 产出模式规范化——统一 acceptable 语义和 explanation 必填

---

*报告生成时间：2026-10-07*
*审计范围：数学科目答案系统全链路（只读，不改代码）*
