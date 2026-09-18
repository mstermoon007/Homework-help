# POL–KBL Phase 2 主报告：唯一性 FAIL 收口 + 工程清理

> 执行时间：2026-09-13
> 范围：消除 KBL Runtime 唯一性审计 3 项 FAIL；清理断链孤儿、失效门禁/测试；统一文档与基线
> 原则：最小修改、直接断链、确认后删除；**未扩架构、未动 Frozen Core、未实施 B5/B6/B7、未处理 Composite/D2/G1**
> 结论：**KBL Runtime Uniqueness = PASS**；标记 **POL–KBL Stable Baseline**

---

## 1. Phase 2 目标

不扩架构，把已成立的主链收干净，形成可长期维护的稳定基线：

```text
KBL Runtime → POL KnowledgeContext → Practice Context → Strategy → Generator
            → Validator → SemanticQuestion → Presentation / SVG
```

## 2. 起始基线（Phase 2 START）

| 项 | 状态 |
|---|---|
| 主链 `npm test` | PASS（含 KBL 8 段链） |
| `test:kbl-uniqueness` | FAIL（3 known / 0 new） |
| Frozen Core | 无漂移（79 文件） |
| bridge | 7/7 |
| Browser E2E / SVG E2E | PASS / 162 例 |
| 工作树 | 29 ?? / 87 D / 55 M（均属 Phase 1 + 唯一性审计授权范围） |

## 3. FAIL-001 收口（render.js 旧 KnowledgeBank）

- **反向调用分析**：`_kb` 仅在 `createPlugin` 内声明与使用；`createPlugin` 仅被 `createMathPlugin` 调用；`createMathPlugin` 全仓 0 调用方（production/test/bundle runtime 均无）；`global.KnowledgeBank` 运行时从未定义。
- **处理**：删除 `_kb` 声明 + 知识点声明校验块（仅服务该路径的代码）；未触碰其他 render 逻辑。
- **结果**：`render.js` 零旧知识引用；RESOLVED。

## 4. FAIL-002 收口（kp-semantic-validator 失效 combine 路径）

- **定性**：`checkComposite` 仅在 `context.kpConstraintsList` 存在时调用，而该字段**全仓 0 注入** → 死路径（情况 A）；且含未定义引用 `KnowledgePoint.get`/`Ontology.normalize`（触发即 ReferenceError）。
- **处理**：删除 `checkComposite` 函数 + 调用点 + `checks.composite` 键 + 导出；`KP_SEMANTIC_COMPOSITE` 错误码保留（frozen `retry-loop` 引用）。
- **结果**：验证器零未定义引用；RESOLVED。

## 5. FAIL-003 收口（presentation bundle 内联 KC/Runtime 副本）

- **构建图分析**：presentation bundle 只内联「strategy bundle 未注册」的模块；`kp-semantic-validator` 顶层 `require(knowledge-context.js)` → KC 未注册 → 内联 KC + 其依赖 `knowledge-runtime.js` → 产生第二份适配器/Runtime 副本（Runtime 副本休眠、Context 副本覆盖 `global.KnowledgeContext`）。
- **最小方案**：`dev/build-strategy-bundle.js` SHIMS 新增 `shared/orchestration/knowledge-context.js → global.KnowledgeContext`（委托注册）；presentation 构建器自然去重。
- **结果**：presentation bundle 内联模块 31→22；KC/Runtime 副本 0；`global.KnowledgeContext` 不再被覆盖；动态 `App.KNOWLEDGE` 挂载 = 1；RESOLVED。

## 6. 死代码清理（第二轮）

| 对象 | 处理 | 依据 |
|---|---|---|
| `shared/presentation/svg-templates.js` | 删除（同步移除 practice.html script、verify-svg require、layers.json 登记） | 死注册表，无消费者（W4） |
| `dev/check-g1-quality-matrix.js` | 删除 | no-op 占位（提前 exit 0），无引用 |
| `dev/test-runner.js` | 删除 | pattern `tests/capability/*` 已归档 → 0 测试空跑 |
| `dev/cleanup-scan.js`、`dev/semantic-parse.js`、`scripts/clean-difficulty-consume.js` | 归档 `archive/legacy-tools/` | 一次性工具，仅被归档物引用 |
| `tests/integration/column-consistency-*` | 归档 `archive/legacy-tests/integration/` | 测已删除 API（0/6 失败） |
| `dev/test-svg-{core,geometry,calculation,make-ten}.js`、`dev/test-difficulty-structure.js`、`dev/test-sw-cache-upgrade.js` | **保留并接线**（有效孤儿测试） | 全部 PASS（105+34+5 断言） |

## 7. 审计代码处理

- `dev/check-kbl-uniqueness.js`：**保留为长期门禁**，并入 `npm test`（`test:kbl-uniqueness`）。
- `dev/reports/kbl-uniqueness-report.json`：遵循 `dev/reports/` 既有报告规范，保留（由门禁再生成）。

## 8. 文档整理

| 文档 | 处理 |
|---|---|
| `docs/技术文档--基础.md` | §7 重写为「KBL Runtime Contract」；目录树/分层表/ASCII/ADR D1/文件地图/TOC 同步 |
| `docs/知识层架构与7类题型模型.md` | 归档（描述已删除旧层） |
| `docs/pol-kbl-phase1-inventory.md` | 标记 Phase 1 COMPLETE + 追加 Phase 2 CLOSEOUT |
| `docs/pol-kbl-pending.md` | 移除已收口 FAIL；重排 P0–P4；受控例外与已收口分列 |
| `docs/kbl-runtime-*.md`（4 份） | 保留（唯一性审计证据链） |
| `docs/pol-kbl-phase2-closeout.md` | 本报告（Phase 2 唯一主报告） |
| `docs/pol-kbl-stable-baseline.md` | 稳定基线声明 |

## 9. 测试结果（Phase 2 END）

| 项 | 结果 |
|---|---|
| `npm test` | **PASS（exit 0）** |
| `test:kbl-uniqueness` | **PASS**（916 文件扫描；受控 30；0 known / 0 new） |
| `test:node` | 120/120 |
| `verify:bridge` | 7/7 |
| KBL VERIFY（8 段） | ALL PASS（rootHash 重算一致） |
| Frozen Core | 无漂移（79 文件） |
| Golden | 15/15 |
| Strategy 管道 | 598/598 七维落点 |
| Browser E2E | PASS（GenerationEngine + SVG + PracticeSession） |
| SVG E2E | 162 例 + 单测 105 断言 |
| 综合练习管线 | 20 题 PASS |
| 架构 layers / lint / syntax | PASS（227 文件 0 错） |

## 10. KBL Runtime 唯一性结论

```text
KBL Runtime Uniqueness = PASS
  Production Runtime        PASS（无生产文件直读 KBL 数据）
  POL KnowledgeContext      PASS（唯一适配边界；副本已去重）
  Compatibility Bridge      PASS（Delegation）
  Browser Runtime           PASS（App.KNOWLEDGE 挂载=1；旧知识全局 undefined）
  Generator Boundary        PASS（可变生成器零知识访问；frozen 经 compat 委托）
  Test Boundary             PASS（活动测试 0 旧知识引用）
  Second Knowledge Source   NO
  Bypass Path（活跃）        NO
```

## 11. 当前最终架构

```text
                        ┌──────────────┐
                        │  KBL Runtime │  ← 唯一知识事实源（App.KNOWLEDGE）
                        └──────┬───────┘
                               │
                     ┌─────────┴──────────┐
                     │ KnowledgeContext   │  ← 唯一业务适配边界（POL）
                     └─────────┬──────────┘
                               │ Practice Context
              ┌────────────────┼────────────────┐
              ▼                                 ▼
        Strategy                        Difficulty Context
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                           Generator          ← 只负责生成（不选知识源）
                               ▼
                           Validator
                               ▼
                      SemanticQuestion
                               ▼
                      Presentation / SVG      ← 只负责呈现

  knowledge-compat = Frozen bundle 兼容委托桥（旧接口名 → Runtime；不持有数据）
  POL = 唯一练习编排入口（题量预算 / 题型覆盖 / 容量回收 / 难度统筹）
  Difficulty Authority = 唯一难度公式裁决（difficulty-static / difficulty）
```

## 12. Pending（详见 `docs/pol-kbl-pending.md`）

| 优先级 | 事项 |
|---|---|
| P0 | 冻结形状漂移默认值（spiral / allowBracket 等） |
| P1 | Composite Combine（先确认是否恢复） |
| P2 | D2 难度门禁 / M16 |
| P3 | G1 Matrix 迁移 |
| P4 | B5/B6/B7 Generator 绑定迁移 |

受控例外：Frozen 兼容接线（knowledge-compat + bundle SHIMS）、W7 冻结重复、容量扫描 CLI、bundle 内嵌 legacy 绑定表。

## 13. 下一阶段建议

- 先以 **POL–KBL Stable Baseline** 运行一段时间（观察真实浏览器行为与回归门禁）。
- 不立即进入 B5/B6/B7：Generator 已与旧 Knowledge 断链且主链验证通过，迁移收益低于扰动风险。
- 若必须推进，按 P0 → P1 → … 顺序单独授权、单独验证。
