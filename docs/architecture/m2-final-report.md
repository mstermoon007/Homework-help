# M2 Final Report — Knowledge Capability Architecture

> 里程碑：M2「Knowledge Capability → 生成能力闭环」。
> M0/M1 冻结边界保持；线上生成逻辑零修改；M2 只建立"知识点 × 题型 × 能力 × 插件"的可验证地图。

## 1. M2 Objective

把 M1 的 KnowledgePoint 本体转化为可执行、可审计的生成能力描述与策略入口基础：
回答"这个知识点能生成什么题、由什么能力生成、当前系统是否具备生成能力"，但不接管线上出题。

## 2. R01～R07 状态

| R | 内容 | 状态 |
|---|---|---|
| M2-R01 | QuestionType Registry | ✅ COMPLETE |
| M2-R02 | 测试基础设施修复 + 4 组测试 | ✅ COMPLETE |
| M2-R03 | Capability Contract Gate | ✅ COMPLETE |
| M2-R04 | Capability Matrix (574×题型) | ✅ COMPLETE |
| M2-R05 | Generator Capability Registry | ✅ COMPLETE |
| M2-R06 | Capability Resolver 最终闭环 | ✅ COMPLETE |
| M2-R07 | 最终 Gate / 报告 / 冻结 | ✅ COMPLETE |

## 3. QuestionType Registry

- `shared/question-type-registry.js`，9 个标准题型：
  `oral / calc / fill / choice / judge / apply / open / geometry / recognize`
- 每个题型含：name / category / cognitiveLevels / difficultyRange[1,6] / supports{context,graphic,distractors}
- 启动期校验：0 重复 ID / 0 非法 cognitiveLevel / 0 非法 difficultyRange / 0 非法 supports

## 4. Capability Model

- `shared/capability-model.js`：`{knowledgePointId, questionTypes:[{id,cognitiveLevels,difficultyRange,priority,supported}]}`
- 纯能力声明，不含 generateFunction / generator / plugin 引用。

## 5. Capability Contract

- `shared/capability-contract.js`：契约校验（题型合法性、cognitiveLevel 词表、difficultyRange、priority、禁止执行引用）。
- R03 Gate：574 KP 全扫描，Resolved=574，Invalid QuestionType=0，Invalid Capability=0。

## 6. Capability Matrix

- `shared/capability-matrix.js`：四类决策 ALLOW / FORBID / DEGRADE / MISSING。
- R04 Gate 结果：574 KP 均 ≥1 ALLOW；决策分布 ALLOW=574 / FORBID=168 / DEGRADE=4424 / MISSING=0。

## 7. Generator Capability Registry

- `shared/generator-capability-registry.js`：99 插件 × KB 关联只读注册表。
- 每插件含 pluginId / subject / category / grades / questionTypes / capabilities / knowledgePoints / confidence。
- R05 Gate：99 扫描，96 有 KP 关联，3 无（math-comprehensive 聚合 / math-g1-patterns / placeholder），0 非法题型 / 0 非法能力 / 0 源码级执行引用。

## 8. Resolver

- `shared/capability-resolver.js`：
  - `resolve(kp)` → CapabilityModel
  - `resolveFinal({knowledgePointId, questionType})` → `{decision, capability, source, confidence}`
  - 决策优先级：INVALID → FORBID → MISSING → ALLOW → DEGRADE（DEGRADE 绝不自动升级）
  - 决策来源可追溯：knowledgePoint=ontology / questionType=registry / plugin=declared / matrix=R04

## 9. 574 KP 覆盖

- 574/574 归一化合法；0 非法 Canonical；574/574 均有 ≥1 ALLOW 题型。

## 10. 99 Plugin 覆盖

- 99/99 扫描；96 有 KB 知识点关联；3 无关联（可审计 WARNING，不阻断）。

## 11. ALLOW / FORBID / DEGRADE / MISSING

Resolver 全量 574×9=5166 组合：
- ALLOW=574 / FORBID=168 / DEGRADE=4424 / MISSING=0 / INVALID=0

## 12. Warning

- contract：0 WARNING
- generator：2 WARNING（math-g1-patterns / math-comprehensive 未直接关联 KB 知识点）
- 均为可审计项，非错误。

## 13. 已知历史技术债

（继承 M0/M1，仅记录不修复）
- math-unit-convert / math-geometry / chinese-pinyin 的 knowledgePointId 与 KB 漂移
- math-g2-column 答案 `"6……6"` 未过自身 check
- difficulty-static 休眠态
- SVG 共享模块未全入生产页

## 14. M0 回归

`npm run verify` → **7/7 PASS**（249 JS 文件 0 语法错误；KB 574 ERROR 0；插件 99 ERROR 0；难度双轨 0；Golden 11/11；Snapshot 漂移 0；架构护栏 ERROR 0）

## 15. M1 回归

`npm run verify:m1` → **PASS**；M1 ontology 测试 **62 PASS / 0 FAIL**。

## 16. M2 测试

`tests/capability/*.test.js`（7 文件）→ **39 PASS / 0 FAIL**：
- question-type-registry（7）/ capability-model（4）/ capability-resolver（3）/ knowledge-capability（5）/ capability-matrix（6）/ generator-capability（4）/ capability-resolver-final（10）

## 17. 架构边界

已确认无反向依赖（R07.3 全量源码扫描 99 插件）：
- ❌ Generator → Ontology mutation
- ❌ Generator → Strategy 依赖
- ❌ Capability → Generator execution
- ❌ Matrix → Generator execution
- ❌ Resolver → Generator execution
- ❌ Ontology → DOM

## 18. 未修改线上逻辑证明

M2 未修改：practice.html / knowledge-bank.js / difficulty.js / difficulty-static.js / 任何插件 generate / SVG Renderer。新代码为纯数据/纯函数层（registry/model/matrix/resolver/contract），无 Math.random，无 DOM 引用。

## 19. M2 冻结结论

M2 Unified Gate 全部 PASS：
```
M0 7/7 PASS → M1 PASS → R02 PASS → R03 PASS → R04 PASS → R05 PASS → R06 PASS → R07 PASS
```
**M2 = COMPLETE / FROZEN**

## 20. M3 输入

M2 为 M3 Strategy Engine 提供唯一标准输入：
```json
{
  "knowledgePointId": "math-g1-m0-make-ten",
  "questionTypes": { "calc": {"supported":true,"decision":"ALLOW","capability":"calculation"} },
  "resolverDecision": { "decision":"ALLOW", "source": {...} }
}
```
M3 将基于该地图做策略决策，不重新猜测能力。

---

**分界线**：M2 到此为止仍未生成任何新题目、未改变现有题目生成结果。Strategy Engine / Question Planner / Difficulty Strategy / Learner Model / Semantic Renderer 全部留给 M3+。
