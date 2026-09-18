# 六层结构审计：编排 / 生成 / UI / KBL 标准库 / 渲染 / 打印

> 只读审计（无代码变更）。依据：`architecture/layers.json`（四层逻辑）× 物理目录 × 冻结门禁
> `dev/check-frozen-core.js` × 实测调用链。上一审计：`docs/f-type-2-root-cause.md`（题型错位根因，
> 与本文件 §5 数据呼应）。

---

## 1. 六层 ↔ 逻辑/物理架构映射

| 用户命名 | 逻辑层（layers.json） | 物理目录/入口 | 冻结 |
|---|---|---|---|
| **UI 层** | UI（display） | `index/practice/select/faq/contact/math-types/subject-types.html`、`knowledge/*.html`、`sw.js` | 冻结页面 |
| **编排层** | SERVICE.ASSOCIATION + SERVICE.ORCHESTRATION | `shared/bridge/practice-bridge.js`（关联/唯一生成入口）；`shared/orchestration/*`（POL 五模块） | 可演化 |
| **生成层** | GENERATION（CORE_ENGINE/STRATEGY/SEMANTIC/GENERATOR/SERVICE_IFACE/PLUGINS） | `shared/engine/*`、`shared/strategy/*`、`shared/generator/*`、`shared/generation/api.js`、`shared/semantic/*`、`plugins/` | 引擎/策略/生成器 Frozen |
| **KBL 标准库** | KNOWLEDGE（base-data） | `kbl/`（canonical 知识体系）、`shared/knowledge/*`、`shared/catalog/*`、`knowledge/`（静态页含能力索引）、`migration/`（原始数据） | 数据变更走 `kbl:import` |
| **渲染** | GENERATION.PRESENTATION + GRAPHIC_RENDER | `shared/presentation/render.js`（卡片/网格）、`shared/presentation/svg-registry.js`、`shared/svg/svg-core.js`（图形渲染器）、`shared/engine/presentation-engine.js(.bundle.js)` | render/svg 冻结；模板族经 ppt/plugins 演化 |
| **打印** | GENERATION.PRESENTATION（print.js 归呈现组） | `shared/presentation/print.js`（DOM 克隆 → 预览弹窗 → 打印） | 冻结 |

> 用户语义与架构差异提示：打印并非独立大层，是渲染层的「导出/物理呈现」出口；
> 「编排层」在架构里拆为关联层（bridge，唯一生成入口+批改分发）与 POL 规划层（仅资源调度，不生成题目）。

## 2. 依赖方向与接缝（谁调用谁）

```text
UI(practice.html)
  └─ common.js 引导（shared/core/common.js 按相对路径 document.write 注入 core/render/check/ui-state/storage → F-404-1 修正过的路径）
       └─ shared/request/request-normalize.js    （请求归一：UI token → canonical，§5 释义边界）
       └─ shared/bridge/practice-bridge.js       （ControlService：唯一生成入口 / 计数·难度·知识点提取 / 去重记忆 / 结果收集）
            └─ shared/orchestration/practice-orchestrator.js  （POL：预算/题型覆盖/均衡/容量/回收/账本）
                 ├─ shared/orchestration/knowledge-context.js （KBL ↔ 编排：pool/strategyView/generation capability）
                 ├─ shared/orchestration/budget-allocation.js （容量封顶 capacity-map）
                 └─ shared/orchestration/difficulty-orchestrator.js
            └─ shared/engine/practice-session.js （CORE_ENGINE 壳：会话/记账/回收）
                 └─ shared/generation/api.js      （GenerationAPI.generate：build → runPlans → 渲染/状态；POL 与 UI 共用同入口）
                      └─ shared/strategy/strategy-engine.js → QuestionPlan（题型白名单∩能力/难度/复杂度/样式）
                           └─ shared/generator/generator-selector.js → generator-registry（按 plan 选生成器）
                                └─ shared/generator/generators/* + plugins/（产出 semantic-question，inputType=choice/text）
                                     └─ shared/validator/*           （质量/结构/图形/难度校验）
                                          └─ shared/presentation/render.js → svg-registry + svg-core（渲染卡片/网格/SVG）
                                               └─ shared/presentation/print.js（克隆 DOM → 预览 → window.print）
KBL 侧（写/查分离）：
  kbl/（canonical 数据）← kbl:import 写入 → shared/knowledge（knowledge-bank 读取）
  shared/capability/capability-model+matrix+resolver（能力视图；rawType 归一 → F-TYPE-2 根因）
  shared/catalog/module-catalog.js + version.js（版本/特性门；冻结接口）
  预编译 bundle：presentation-engine.bundle / strategy-engine.bundle（页面注入）
```

## 3. 冻结边界（哪些接缝不能动）

```text
78 文件 Frozen Core 按层分布（示例）：
  生成层   core.js / generation-engine / presentation-engine / strategy-engine.bundle /
           generator-contract/registry/selector/mode/retry + arithmetic/selection/complex/index /
           rng / semantic-question / semantic-question-bridge / schemas
  策略     strategy-config.js（难度档/规格）
  能力     capability-model / matrix / resolver、question-type-registry（释义根因所在）
  渲染     render.js / svg-registry / svg-core / svg-make-ten / svg-*模板 / print.js
  目录     module-catalog / version.js、styles/*.css
可演化（非冻结）：orchestration/*（POL 编排、Scope 守卫、seenKeys）｜practice-bridge（去重记忆）
                            ｜request-normalize（释义入口）｜validator 多数 ｜plugins 模板族
契约（跨层铁律）：
  P10-2 Scope：cell 生成范围封锁，不得越界重解释
  P11-00 Context：生成上下文继承 cell，规划上下文不下沉
  P9-9 绑定：libraries 绑定 canonical，不落 legacy
  P14 Freeze：Frozen Core 仅授权 Bug Fix（改后重锚 + 全量回归）
```

## 4. 一次生成请求的完整数据流（实测）

```text
1. UI 输入（practice.html）→ urlParams.types / 题量 / 难度
2. request-normalize：类型 token 归一为 canonical id（含去重、容量档）
3. practice-bridge.plan(ui)：计数/难度/知识点提取 → 组装 profile → 归一请求
4. POL(practice-orchestrator).plan(req)：题型白名单 → 每题 cell（dkId/capability/题型/预算/容量/seenKeys 避重）
   → 需求 ≤ 容量则规划，否则 PARTIAL/FAILED（outOfScopeDropped 记账）
5. practice-session.start() → GenerationAPI.generate(req)（api.js build → runPlans）
6. strategy-engine：题型白名单 ∩ capability supported × 难度档 → QuestionPlan（F-TYPE-2 在此被错 supported 带偏）
7. generator-selector → generators/plugins → semantic-question（q.type 落定；inputType: choice→选项 / text→填空）
8. validators 校验（题型合法性/结构/图形/难度）
9. render.js renderCard/renderGrid + svg 模板 → DOM；badgeLabels[q.type] 渲染题型中文徽标
10. print.js open(container)：克隆 DOM（去交互元素）→ 预览弹窗 → window.print()
```

## 5. 题型生成与释义逻辑（八类 UI 题型，跨层横向）

### 5.1 释义边界（UI token → canonical，实测 normalize）

| UI 选题 | canonical | 途径 | 备注 |
|---|---|---|---|
| 计算题 | calc | UI 直接发 id（exact） | 142 KP 声明 / 167 可生成 |
| 填空题 | fill | id（exact） | 64 / 64 |
| 选择题 | choice | id（exact） | 30 / 30 |
| 判断题 | judge | id（exact） | 8 / 8 |
| 操作/作图题 | geometry | id（exact） | 94 声明 / 151 可生成（↑泄漏） |
| 分类整理题 | classify（sort→classify 显式别名） | UI 键仍为 `sort`→classify | 7 / 7 |
| 解决问题/应用题 | apply | id（exact） | 320 声明 / 247 可生成（↓74 被降型） |
| **口算题** | calc（oral=legacy 别名） | select 已移除；口算归计算题 | 无独立类型 |

**风险（F-TYPE-2 的另一个侧面）**：若把中文标签/子类型当 token 走归一，
`作图→calc`、`分类→calc`、`解决问题/应用→calc`（默认回退 heuristic）。系统正常路径只发 canonical id，
故未被触发；但这正是 registry 关键词/别名启发式不可靠的证据（见 `docs/f-type-2-root-cause.md`）。

### 5.2 每 KP 的生成链路（声明 → 能力 → 生成 → 渲染）

- **声明**：KBL `assessment.questionTypes`（每 KP 1~2 条；598 KP 合计 665 条声明）
- **能力**：`capability-model` 以 rawType 归一（F-TYPE-2：apply 320→247、geometry 94→151 泄漏/降型）
- **支持**：`strategy-engine` 白名单 ∩ supported → QuestionPlan → generator-selector
- **产出**：semantic-question（`type` 落定；`inputType` 决定 choice 选项块 / text 填空排版）
- **渲染**：render.js 按 `q.type` 走徽标 + 题面块；图形题走 svg-registry/svg-core 模板族
- **释义展示**：badgeLabels（render.js）渲染题型中文名；题量守恒重分配 UI 复用同一映射

### 5.3 与已知缺陷的串接

```text
typeCoverage 8 类兜底键（capability/matrix） → 含 'oral' 遗留 → P11-01 已登记
apply 声明 320 中 73 不可生成（升/降型几何化） → F-TYPE-2 受影响 76~79 KP（f-type-2-affected-kps.csv）
geometry 可生成 151 > 声明 94（错型吸入）       → 同根：rawType 误归一沉淀到能力索引
classify/judge 全量可生成 7/8                  → 小体量，未受污染
```

## 6. 观察 / 风险清单

| # | 观察 | 层 | 建议 |
|---|---|---|---|
| S1 | print.js 归呈现组（逻辑非独立大层） | 打印 | 维持现状（DOM 克隆打印是渲染出口，非业务层） |
| S2 | 编排层在架构里实为 关联(POL) 两层 | 编排 | 文档语义对齐即可；代码结构已稳定 |
| S3 | 中文 token 归一全部回落 calc | 释义 | 若未来 UI 发中文标签需先过显式映射表（防 F-TYPE-2 类回归） |
| S4 | geometry 能力索引虚增（151>94） | 能力 | 随 F-TYPE-2 方案 B 修复后回落；知识页「可练题型」随规整 |
| S5 | generation.api.js 为 POL/UI 共用入口 | 生成 | 有意设计（P0-001 修复）；勿再开第二入口 |

## 7. 结论

- 六层结构完整、接缝清晰：UI →（normalize/bridge）→ POL（编排）→ Session → GenerationAPI → Strategy → Generator → Validator → Render → Print，KBL/capability/catalog 为读侧权威源，`kbl:import` 为唯一写口。
- 唯一系统性风险集中在 **KBL↔生成 的题型归一接缝**（question-type-registry/capability-model，F-TYPE-2），已定位、已量化、待授权修复；其余接缝受 P10-2/P11-00/P9-9/P14 契约约束无越界。
- 打印与渲染为同一呈现族，无独立状态；编排层不生成题目（P10-2 铁律实测成立）。