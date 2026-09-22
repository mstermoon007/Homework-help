# POL–KBL Stable Baseline v2：Shape Contract Frozen（稳定基线声明）

> 标记时间：2026-09-13（Phase 3 收口后）
> 基线名称：**POL–KBL Stable Baseline v2：Shape Contract Frozen**
> 主报告：`docs/pol-kbl-phase2-closeout.md`｜Shape 审计：`docs/pol-kbl-shape-drift-audit.md`｜唯一性审计：`docs/kbl-runtime-uniqueness-audit.md`｜POL 契约：`docs/pol-contract.md`｜治理：`docs/pol-kbl-phase9-governance.md`

---

## 1. 基线定义

本基线是「KBL Runtime 唯一知识事实源 + POL KnowledgeContext 唯一适配边界」架构
通过静态审计、Bundle 审计、动态 E2E 三层验证，并完成 **Frozen Shape Drift 收口**后的稳定版本。

### 架构不变量（不得破坏）

```text
1. KBL Runtime = 唯一生产知识事实源（App.KNOWLEDGE，PUBLIC_API 10 方法）
2. KnowledgeContext = 唯一业务适配边界（形状投影 / 池展开 / UI 视图）
3. knowledge-compat = 兼容委托桥（旧接口名 → Runtime；不持有数据）
4. POL = 唯一练习编排入口（题量预算 / 题型覆盖 / 容量回收 / 难度统筹）
5. Difficulty Authority = 唯一难度公式裁决（difficulty-static / difficulty）
6. Generator = 只负责生成（不选择知识源，消费 POL Practice Context）
6a. Composite = Pending 最小接口（supportsComposite + combine calc-to-judge；不承担 POL 职责，知识访问 = 0）
7. Presentation / SVG = 只负责呈现（不访问知识事实）
8. Frozen Core（78 文件）= 仅授权 Bug Fix（需 re-baseline）
9. POL = 练习任务唯一编排边界（Practice Request → Practice Plan → Strategy；不管渲染/打印/会话状态/KBL/难度计算）
10. Generation 唯一入口 = PracticeSession → GenerationAPI.generate → POL.orchestrate（executeInline 仅 inactive 透明回退）；计数缩水必须显式 PARTIAL 并在 UI 显示（不静默当成功、不补垃圾题）
11. Difficulty = 唯一公式（difficulty-static/difficulty）+ POL 统筹（DifficultyOrchestrator 已接线）+ 冻结链传递；DRIFT-11 已修（Target 全局兜底）；D2/M16 已重建（tests/difficulty）
12. P10 输入编排冻结：COUNT（POL 唯一分配）/ TYPE（允许集）/ KP（范围）/ DIFFICULTY（只统筹）/ ADAPTIVE（cell 完整继承）
13. P11 生成行为冻结：Coverage & Quota / Duplicate（A 语义）/ Capacity-Recovery-Partial（≤3 轮 + 有界 + Scope 守卫）
14. P12 产品闭环冻结：真实浏览器 E2E（`npm run test:e2e`）覆盖生成/练习/打印/刷新/跨批/重新生成
15. P13 数据治理：Knowledge Entry 540↔540 / canonical 6 题型 / Capacity Map canonical / 缺失项人工清单
16. P14 Release Freeze：Dead Code 0 / Orphan Gate 0 / Bundle 同步 / 404 清零（F-404-1 授权修复）/ 全量回归 PASS
```

## 1.1 Shape Contract（Phase 3 冻结）

```text
KBL canonical shape（11 数据文件 → App.KNOWLEDGE）
        ↓  KnowledgeContext（唯一转换边界：knowledgeId→id / module→moduleId / gN→N）
Practice Context 三视图（键恒存在；缺失统一 null，不出现 undefined）：
  · adaptKp / poolContext   —— 池条目（id/moduleId/unitId/name/type/category/pluginId/grade:N/weight/status）
  · strategyView            —— 冻结 Strategy/Capability 形状（含顶层别名 pluginId/graphicType/operations）
  · uiKp / uiListForGrade   —— 页面 UI 视图
        ↓
Strategy（七维：type/cognition/difficulty/structure/spiral/context/count）
        ↓
Generator（只消费 Strategy Plan：questionTypeId/difficulty/knowledgePointIds/seed/spiralLevel/contextType/count/constraints）
```

**显式边界默认（契约，非猜测）**

| 字段 | 缺失/未知时 | 说明 |
|---|---|---|
| `spiral` | `{level:1,maxLevel:1}` | canonical 无该数据；真实语义待 Schema 扩展（非阻塞） |
| `structure.allowBracket/allowMultDiv` | `false` | 同上 |
| `structure.maxSteps` | `1` | canonical `generation.maxSteps` 缺失（32 KP） |
| `numeric.range` | `{min:null,max:null}` | canonical `generation.numberRange` 缺失（11 KP） |
| `cognition.level` | `0`（未知/缺失同值） | 已知映射：recognize 0 / understand 0.33 / apply 1.0 / analyze 1.0 |
| `legacy.difficulty` | `null` | canonical seedDifficulty 缺失（31 KP）→ frozen 默认 3 |
| `source.legacyType` / `uiKp.type` | `null` | canonical `type` 缺失（32 KP） |

**契约测试**：`npm run test:pol-kbl-shape`（14 用例：三视图契约 / 缺省默认 / 边界 / 多 KP / 只读稳定性）。

## 2. 版本锚点

| 项 | 值 |
|---|---|
| 应用版本 | `4.3.0`（`shared/catalog/version.js`；SW 缓存名同步） |
| KBL 快照 | `kbl-math-v1.0.0-45b9a2f4` |
| KBL rootHash | `45b9a2f414f468e685c22cca1eb9e34105399c7afaa5d62a134641cca18c248a` |
| KBL 规模 | 598 KP / 128 Unit / 1287 Relations / 639 Mappings（allow 409 / missing 230；P13-04 capacity canonical 598/598） |
| Frozen Core | 78 文件（`dev/frozen-core-baseline.json`，无漂移；P10-3 删旧 allocation / P14-05 修 404 注入路径后重锚） |
| Bundle 产物 | `strategy-engine.bundle.js`（59 模块 / 7 shim）、`presentation-engine.bundle.js`（22 内联 / 67 委托） |
| 页面装载序 | `runtime → knowledge-context → knowledge-compat → strategy bundle → presentation bundle` |

## 3. 基线门禁（全部 PASS）

```bash
npm test                  # 全链（含下列全部）
npm run test:kbl-uniqueness   # KBL Runtime Uniqueness = PASS（0 known / 0 new）
npm run test:pol-kbl-shape    # Shape Contract PASS（三视图契约 14 用例）
npm run test:code-ratio       # 反膨胀门禁 PASS（Support < Core 且辅助文件已登记）
npm run kbl:verify            # KBL 8 段链 ALL PASS
npm run verify:frozen-core    # 无漂移
npm run test:node             # 120/120
npm run verify:bridge         # 7/7
npm run verify:presentation-runtime  # Browser E2E PASS
node dev/verify-svg.js        # 162 例 + test:svg-units 105 断言
npm run verify:m4             # Strategy→Generator→Semantic 全链
```

## 4. 变更政策

| 变更类型 | 要求 |
|---|---|
| KBL 数据（KP/关系/映射） | 经 `tools/kbl/*` 工具链；`npm run kbl:verify` 全绿；rootHash 变化需更新本基线 |
| KBL Runtime 内部模块 | 修改后重建 `knowledge-runtime.js`（`kbl:bundle-runtime`）并全链验证 |
| KnowledgeContext / knowledge-compat | 保持委托语义（不引入数据副本/第二查询实现）；唯一性门禁必须 PASS |
| Shape 契约（三视图字段/默认值） | 修改须保持 `test:pol-kbl-shape` PASS；转换只允许发生在 knowledge-context.js |
| 新增辅助代码（service/manager/adapter/resolver/registry/gate/…） | 必须有生产调用方 + 不可替代职责，并登记 `dev/check-code-ratio.js` 白名单；Support 总量必须 < Core |
| Frozen Core（78 文件） | 仅授权 Bug Fix；`node dev/check-frozen-core.js --baseline` 重锚 + 记录 |
| 新增生产知识访问 | 禁止绕过 KnowledgeContext；唯一性门禁（test:kbl-uniqueness）拦截新增违规 |
| Pending 项（P0–P4） | 单独授权、单独验证；不随常规改动夹带 |

## 5. 基线复验（任一时刻）

```bash
npm test && npm run test:kbl-uniqueness
```

期望：

```text
KBL Runtime Uniqueness = PASS
Production Knowledge Access → KnowledgeContext → KBL Runtime（无第二事实链）
Frozen Core = NO DRIFT
KBL VERIFY = ALL PASS
```

## 6. 备注

- 本基线以当前工作树 + 上述门禁为锚；如需发布级锚点，建议对当前状态打 Git 标签
  （如 `pol-kbl-stable-2026-09-13`）——提交/打标签动作由仓库所有者执行。
- 基线之后的第一优先事项是 P0（冻结形状漂移默认值），其余 Pending 见 `docs/pol-kbl-pending.md`。
