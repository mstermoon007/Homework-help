# P46 三模式交互升级开发任务书

> 文档性质：家庭模式 / 试卷模式 / 教师模式的产品交互升级、实施、清理与最终收口任务书。
>
> 状态：**方案已细化，待用户确认；尚未授权修改生产代码**。
>
> 立项日期：2026-11-14。
>
> 上位约束：用户指令 ＞ `.trae/rules/ai-coding-workflow.md` ＞ `docs/01-ARCHITECTURE.md` ＞ `docs/00-BASELINE.md` ＞ 本文件。
>
> 执行方式：按阶段实施；每阶段提交门禁证据并经用户确认后，才进入下一阶段。不自动 Git commit。

---

## 0. 需求基线与文档效力

### 0.1 用户已明确的产品要求

1. 产品只保留 **家庭模式、试卷模式、教师模式**。
2. 家庭模式只做：
   - 计算题；
   - 应用题。
3. 家庭计算题至少包含：凑十法、破十法、加减法口算、四则运算口算、竖式计算等专项。
4. 试卷模式只包含：单元测试、期中测试、期末测试。
5. 教师模式支持按照课本顺序的章节选择知识点出题。
6. 保留难度和题量控制。
7. 先完成方案与开发文档，确认后执行。
8. 本任务补充升级后的旧实现清理、回归验收与最终冻结收口。

### 0.2 本文件锁定的默认口径

| 决策 | 本任务口径 |
|---|---|
| 家庭/教师题量 | 练习页保留 1～50 题编辑，默认 20 题 |
| 试卷题量 | 三种标准试卷均固定 40 题；练习页只读 |
| 难度 | 三模式均保留现有 1～10 控制；不改难度公式 |
| 试卷配额 | 固定总量 + 七题型基准配额 + 不可行题型确定性重分配 |
| 单元测试范围 | 一个册别下的一个单元 |
| 期中测试范围 | 当前册按课本顺序的前半部分单元，奇数向上取整 |
| 期末测试范围 | 当前册全部有 KP 的单元 |
| 教师“章节” | KBL 已有的“单元 → 单元内 KP”，不虚构课时层级 |
| 产品模式标识 | `home / exam / teacher` |
| 生成架构 | 复用唯一生产主链，不新增家庭/试卷 Strategy Engine |

如后续需要改变上述口径，必须先修订本文件并记录用户指令，再实施对应任务。

---

## 1. 当前基线与已核实证据

### 1.1 当前唯一基线

以 `docs/00-BASELINE.md` 为准：

| 项 | 当前值 | 本任务要求 |
|---|---:|---|
| 版本 | 5.2.1 | 版本发布单独收口，不预设已升级 |
| KP / Units / Relations / ALLOW | **375 / 98 / 407 / 1566** | 全程不变 |
| Canonical 题型 | **7 类** | 全程不变 |
| Generator | **23** | 不新增、不改决策边界 |
| 测试 | **993 PASS / 0 FAIL** | 后续以实际执行结果登记，不预写目标数字 |
| 全量门禁 | **34 项** | 本地 33 PASS / 0 FAIL / 1 SKIP；CI/有 Chrome 时 34/0/0 |
| Sitemap | **382 URL** | 不新增页面，预计不变，仍须实跑门禁 |

七类题型固定为：

```text
calc / fill / choice / judge / geometry / classify / apply
```

### 1.2 现状差距

| 编号 | 已核实事实 | 与本需求的差距 |
|---|---|---|
| E1 | `select.html` 当前模式为 `quick / teacher / competition` | 需一次性切换为 `home / exam / teacher`，快速与竞赛产品入口退出 |
| E2 | 当前快速模式已有 `calc`、`apply` 能力匹配 | 可复用能力判定，但家庭专项需新增范围筛选与独立交互 |
| E3 | 当前教师端已有册别、单元、KP、题型选择 | 可复用；不需要新教师出题引擎 |
| E4 | 当前 `unitBuckets()` 主要按单元中文名排序 | 不符合课本顺序，须改消费 `unitOrdinal / knowledgeNo / 稳定原始序号` |
| E5 | KnowledgeContext 的 UI 视图未完整暴露单元顺序字段 | 需增加只读投影，不改 KBL 数据 |
| E6 | KBL 已有“凑十法”“运算方法（平十、破十）”等 KP | 可支撑专项筛选；破十法不能在未改 Generator 时承诺与平十法完全拆分 |
| E7 | `practice.html` 已有题量、难度、分题型配额与 POL 预览 | 三模式继续复用；试卷只改为只读和模板预览 |
| E8 | POL 对显式不可行题型会跳过，`plannedTotal` 可小于请求值 | 试卷不能简单下发同一份固定 `typeCounts`，需独立模板分配分支 |
| E9 | PracticeSession 内部按 KP 数量使用 `single-kp / multi-kp` | 产品模式无需变成新 Strategy 模式 |
| E10 | 当前无独立 lesson/课时数据实体 | 教师章节只能按单元和 KP 实现 |
| E11 | 选择页测试明确禁止 `countSelect / difficultySelect` | 不在选择页重新增加题量/难度控件，继续留在练习页 |
| E12 | 当前没有第二套试卷渲染器的恢复授权 | 试卷继续复用 practice、Presentation、Print，不恢复旧期末卷 CSS/渲染器 |

### 1.3 唯一生产链不变

```text
KBL
→ KnowledgeContext
→ POL
→ Strategy
→ Generator
→ Validator
→ SemanticQuestion
→ Presentation
→ Practice / SVG
```

本任务只增加产品请求预设、只读知识投影、POL 试卷模板分配和页面交互，不重排上述链路。

---

## 2. 升级目标、非目标与完成定义

### 2.1 升级目标

1. 家长进入后无需理解七类底层题型，只需选择“计算题/应用题”和必要专项。
2. 阶段检测只需选择试卷类型和范围，系统自动给出真实可执行的 40 题计划。
3. 教师能按课本顺序浏览单元和 KP，并精准组合题型、题量和难度。
4. 三模式共用选择页、练习页、作答、批改、打印和错题链。
5. 升级完成后，旧快速/竞赛产品入口、状态、DOM、样式和零消费分支物理清理，无双轨。

### 2.2 非目标

本任务不做：

- 新学科生成能力；语文、英语继续显示既有“接入中”状态；
- 新 canonical 题型；
- 新 Generator、Validator、Presentation、SVG、Preview、Fallback Engine；
- 新课时/小节教学数据；
- Root Excel、canonical、教学语义 JSON 的修改；
- 严格拆分同 KP 内的平十法与破十法生成语义；
- 自定义试卷、随机卷、竞赛卷、小卷/大卷等额外产品；
- 题面、答案、解析、难度公式和作答批改逻辑调整；
- 首页、导航、品牌色和无关页面的重设计；
- 自动 Git 提交或发布。

### 2.3 完成定义（Definition of Done）

必须同时满足：

1. 选择页只出现家庭、试卷、教师三个产品模式。
2. 家庭模式请求只含 `calc` 或 `apply`，专项来自真实 KP 和 POL 能力。
3. 三种试卷范围确定、配额确定、不可行原因可见，URL 篡改不能解除 40 题模板约束。
4. 教师单元和 KP 按课本顺序展示，选择结果与请求一致。
5. 家庭/教师题量可编辑；三模式难度可编辑；试卷题量只读。
6. 生成、重新生成、作答、批改、查看答案、打印和返回路径无回归。
7. 旧模式产品代码清零；候选死代码按零消费者证据处理，无 shim/adapter/COMPAT/BRIDGE。
8. 定向测试、`npm test`、`node dev/check-all.js` 全过；真实 Chrome 验收完成。
9. 375/98/407/1566、七题型、题目内容和生成矩阵无未授权变化。
10. 日志、实际测试数、基线、冻结记录按事实更新。

---

## 3. 总体信息架构与页面交互

### 3.1 页面分工

```text
select.html
  负责：模式、年级、科目、册别、范围、KP、题型的选择
  不负责：题量/难度编辑、试卷配额计算、题目渲染

practice.html
  负责：题量/难度、POL 计划预览、生成、作答、批改、打印
  不负责：反推 KP 范围、修改试卷模板、自行分配试卷配额

POL
  负责：能力判定、可行题型、试卷模板、配额、容量和最终计划
```

### 3.2 选择页统一结构

保留现有视觉语言和左右布局，不重做页面：

```text
顶部：选择练习

左侧摘要：
  当前模式
  年级 / 科目 / 册别
  当前范围与选择数量
  试卷类型或家庭专项
  开始练习（唯一公共按钮）
  不可开始原因

右侧配置：
  年级 → 科目 → 模式 → 册别
  当前模式专属配置区
```

三个模式不再各维护一个开始按钮。使用一个公共 `startBtnPractice`，由同一份请求和校验结果驱动，避免摘要、URL 和按钮状态不一致。

### 3.3 模式默认值

| 字段 | 默认值 |
|---|---|
| 科目 | 数学 `math` |
| 年级 | 一年级 `1` |
| 模式 | 家庭 `home` |
| 家庭大类 | 计算题 `calc` |
| 家庭专项 | 计算综合 `all` |
| 册别 | 上册 `up` |
| 试卷类型 | 单元测试 `unit` |
| 教师选择 | 默认不预选票中 KP 和题型，由教师主动选择 |

### 3.4 建议状态模型

以下为计划结构，不是已存在代码：

```js
state = {
  mode: 'home',
  subject: 'math',
  grade: 1,

  homeBook: 'up',
  homeKind: 'calc',
  homeFocus: 'all',
  homeUnitIds: [],

  examBook: 'up',
  examType: 'unit',
  examUnitIds: [],

  teacherBook: 'up',
  teacherUnitIds: [],
  teacherKps: [],
  teacherTypes: []
};
```

约束：

- 三模式状态分离，切换模式不串用选择。
- 当前请求只序列化当前模式字段；隐藏模式的旧选择不得进入 URL。
- 单元统一使用稳定 `unitId`，不再以“册别 + 中文单元名”作为主标识。
- 中文单元名只用于展示；KP ID 列表是实际生成范围。

### 3.5 状态变更规则

| 操作 | 保留 | 清理或重算 |
|---|---|---|
| 切换模式 | 各模式在同年级下的独立状态 | 只重建当前模式请求，不带入其他模式字段 |
| 切换年级 | 年级、科目、当前模式 | 清空三模式依赖旧年级的单元/KP；重新计算能力 |
| 切换册别 | 当前模式、家庭专项、试卷类型、教师题型 | 清空当前模式不兼容单元/KP；重新计算候选池 |
| 家庭计算 ↔ 应用 | 册别、单元、已保存的计算专项 | 应用题请求排除 `practiceFocus`；按新大类重算 KP |
| 家庭切换专项 | 大类、册别、单元 | 重算 KP 与可用状态 |
| 试卷切换类型 | 册别、已保存的单元选择 | 单元测试使用单元；期中/期末排除单元参数并自动确定范围 |
| 教师点击单元聚焦 | 已选 KP、已选题型 | 只改变可见分组，不级联清除 KP |
| 教师取消单元 | 已选 KP | 不自动取消该单元已选 KP；提供显式“清空选择” |
| 修改难度 | 范围、KP、题型 | 练习页重新查询计划；已生成题集按现有行为重新生成 |

### 3.6 开始按钮门禁

| 模式 | 可开始条件 | 不可开始提示 |
|---|---|---|
| 家庭 | 数学；大类合法；候选 KP 非空；POL 至少支持对应 `calc/apply` | “当前范围暂无可生成的计算题/应用题，请调整册别、单元或专项” |
| 单元测试 | 数学；恰好选择一个单元；KP 非空；至少一个可行题型 | “请选择一个测试单元”或“该单元暂无可生成内容” |
| 期中/期末 | 数学；册别明确；范围 KP 非空；至少一个可行题型 | “当前册别暂无可生成内容” |
| 教师 | 数学；至少一个 KP；至少一个题型；POL 存在可行组合 | “请选择知识点和题型”或“所选知识点不支持当前题型” |
| 任一模式 | 非数学 | 保留“生成引擎接入中”，禁止开始 |

公共要求：

- `aria-disabled="true"` 与真实点击拦截同时存在，不能只加灰色样式。
- 不可开始时移除有效 `href`，或阻止默认跳转。
- POL 查询中显示“正在检查可生成内容…”，避免查询未完成时跳入空练习。
- 异步结果只消费最新选择签名，旧响应不得覆盖新选择。

### 3.7 通用可访问性与响应式

- 原生 `select` 继续承载年级、科目、模式；选项卡使用真实 `button`。
- 选择按钮同步 `aria-pressed`；禁用项使用真实 `disabled`。
- 摘要状态用 `aria-live="polite"`；阻断错误用 `role="alert"`。
- 键盘可完成模式、单元、KP、题型和开始操作。
- 保留清晰 `:focus-visible`，不仅依赖颜色表达选中/不可用。
- 触屏点击目标不小于 44px。
- 窄屏下教师双栏堆叠，家庭专项和试卷选项单列；不新增侧滑页或弹窗向导。
- 重渲染后尽量保持当前焦点所对应的稳定选项键，避免焦点无故回到页面顶部。

---

## 4. 家庭模式详细设计

### 4.1 配置顺序

```text
练习大类：计算题 / 应用题
册别：上册 / 下册 / 不限
范围：全部单元 / 指定单元（多选）
计算专项：仅计算题显示
```

“全部单元”指当前册别内全部有 KP 的单元；册别“不限”时为上册后下册的稳定顺序。

应用题不显示计算专项，直接按范围筛选真实支持 `apply` 的 KP。

### 4.2 计算专项清单

本批只提供以下六项，不因“等等”自行扩张更多产品入口：

| `practiceFocus` | 展示名 | 候选筛选口径 | canonical 题型 |
|---|---|---|---|
| `all` | 计算综合 | 当前范围内全部真实支持计算的 KP | `calc` |
| `make-ten` | 凑十法 | KP 名称明确包含“凑十法” | `calc` |
| `break-ten` | 破十法 | KP 名称明确包含“破十” | `calc` |
| `add-sub-oral` | 加减法口算 | 口算模块（M1）内，名称/单元语义明确为加法、减法或加减法；排除凑十/平十/破十专项 | `calc` |
| `four-ops-oral` | 四则运算口算 | 口算模块（M1）内，名称/单元语义明确涉及乘、除、四则或混合运算 | `calc` |
| `vertical` | 竖式计算 | 既有竖式模块（M2）内的 KP | `calc` |

补充约束：

1. 上述规则只是 **UI 候选过滤器**，最终是否可生成必须由 POL 的 KP×QT 能力判定确认。
2. 不写死 KP ID；不复制 KP 定义；不建立第二套教学语义表。
3. `M3` 脱式计算可以进入“计算综合”，但不冒充“口算”专项。
4. 应用题只以真实 `apply` 能力筛选，不仅凭 M8 模块名推断。
5. 专项之间允许知识范围有合理交叉，但单次请求只能有一个 `practiceFocus`。
6. 增加新专项必须另有用户任务和真实数据证据，不在实现时顺手补“看起来该有”的分类。

### 4.3 破十法展示口径

当前部分底层 KP 同时承载平十法和破十法，因此本批：

- 入口名称使用“破十法”；
- 辅助说明使用“包含破十法相关知识点的计算练习”；
- 不宣称每题都 exclusively 使用破十法；
- 不为了拆分方法修改 Generator、题面或 KBL；
- 验收只断言范围真实命中相关 KP 且生成题型为 `calc`。

### 4.4 家庭范围解析

```text
当前年级、册别、单元
  ↓
按 homeKind 选择 calc / apply
  ↓
计算题时按 homeFocus 过滤候选 KP
  ↓
POL 计算 KP × questionType 真实可行性
  ↓
得到最终 knowledgePointIds + 单题型白名单
```

不变式：

```text
homeKind=calc  → questionTypes=['calc']
homeKind=apply → questionTypes=['apply']
homeKind=calc  → practiceFocus 为合法专项
homeKind=apply → practiceFocus=null
```

### 4.5 摘要和标题

示例：

```text
模式：家庭模式
范围：一年级数学 · 上册 · 第 5 单元
大类：计算题
专项：凑十法
知识点：1 个
题量/难度：进入练习页设置
```

练习页及打印标题：

```text
一年级数学 · 凑十法计算练习
一年级数学 · 四则运算口算练习
一年级数学 · 应用题练习
```

标题由现有 `titleType` 传入 PracticeSession；不把家庭字段下发给 Generator。

### 4.6 空状态与部分覆盖

- 无候选 KP：专项区下方显示原因，开始按钮禁用。
- 有候选但 POL 不支持目标题型：显示“当前专项暂无可生成内容”，不得改发其他题型。
- 多单元中仅部分可用：允许开始，摘要显示“已覆盖 X/Y 个所选单元”；练习页展示 POL 覆盖信息。
- 查询失败：显示明确错误和重试操作，不以随机 KP 或全册计算题替代。

---

## 5. 试卷模式详细设计

### 5.1 三种试卷交互

| 类型 | `examType` | 用户操作 | 系统范围 |
|---|---|---|---|
| 单元测试 | `unit` | 选上/下册，再单选一个单元 | 该单元全部 KP |
| 期中测试 | `midterm` | 选上/下册 | 当前册前半部分单元 |
| 期末测试 | `final` | 选上/下册 | 当前册全部单元 |

试卷模式不提供“不限册别”，避免跨册范围含混。

### 5.2 范围算法

仅纳入满足以下条件的单元：

- 属于当前年级和册别；
- 至少有一个 KP；
- 有可用于课本排序的 `unitOrdinal`，或能使用 canonical 稳定原始顺序确定位置。

单元排序：

```text
unitOrdinal 升序 → unitId 字典序作为最终稳定 tie-break
```

范围规则：

```text
unit    = 用户选中的 1 个单元
midterm = orderedUnits.slice(0, Math.ceil(orderedUnits.length / 2))
final   = orderedUnits
```

边界：

- 0 个单元：禁止开始并显示空状态；
- 1 个单元：期中与期末范围均为该单元，但标题和模板类型仍不同；
- 不按单元中文名猜测“总复习”“综合实践”并擅自排除；如后续需排除，必须有正式数据或用户裁决。

### 5.3 40 题基准模板

模板常量只存在于 POL 的试卷分配分支，不进入 KBL，不复制到页面：

| 顺序 | 题型 | 基准数量 |
|---:|---|---:|
| 1 | `calc` | 12 |
| 2 | `fill` | 8 |
| 3 | `choice` | 6 |
| 4 | `judge` | 4 |
| 5 | `geometry` | 4 |
| 6 | `classify` | 2 |
| 7 | `apply` | 4 |
|  | **合计** | **40** |

三种试卷使用同一基准模板，差异来自知识范围。模板变更只能修改 POL 常量及对应测试，不改 Generator。

### 5.4 确定性配额重分配

#### 输入

- 固定模板 `baseQuotas`；
- 当前 KP 池；
- `feasibleTypes`；
- 各题型在当前难度下的 `typeCaps`；
- `examType`。

#### 输出

沿用现有计划字段，并增加仅供预览的可选 `quotaAdjustments`：

```js
{
  typeCounts: [{ questionType, count }],
  plannedTotal: 40,
  coverageStatus: 'OK',
  reason: null,
  quotaAdjustments: []
}
```

`quotaAdjustments` 只存在于 POL Plan/CapabilityPlanView，不进入 SemanticQuestion、Generator 或 RenderResult。

#### 算法

```text
1. examType 合法时，模板总量强制为 40，忽略 URL 中其他 count。
2. 对七题型逐项读取基准配额。
3. 不可行题型的基准数量记为 0，其配额进入剩余池。
4. 可行题型先取 min(基准配额, 题型容量)；容量不足部分进入剩余池。
5. 按 calc → fill → choice → judge → apply → geometry → classify
   的固定优先级循环，每次给仍有容量的可行题型补 1 题。
6. 每轮结束后：剩余池为 0 则完成；整轮无法补任何 1 题则停止。
7. plannedTotal = 所有 typeCounts 之和。
8. 记录每次不可行、容量封顶和补量形成的 quotaAdjustments。
9. targetTotal = plannedTotal；不得用重复题、占位题或其他 KP 补齐。
```

使用“循环每次补 1 题”而不是把缺口全部塞给第一个题型，避免重分配后严重失衡，同时保持结果确定。

#### 示例

若 `geometry` 和 `classify` 不可行，基准可行总量为 34，剩余池为 6。容量充足时：

```text
第一轮补 5 题：calc/fill/choice/judge/apply 各 +1
第二轮补 1 题：calc +1

最终：
calc=14 / fill=9 / choice=7 / judge=5 / apply=5
geometry=0 / classify=0
合计=40
```

页面可显示：

```text
当前范围不支持几何题、分类题，6 题已按试卷规则重新分配。
```

#### 容量不足

若所有可行题型均达到容量，仍有缺口：

- `plannedTotal < 40`；
- `coverageStatus='CAPACITY_LIMITED'`；
- 页面显示“当前范围最多可计划 N 题”；
- 生成按钮可按现有 PARTIAL 语义继续或阻断，以练习页既有覆盖处理为准，但不得静默把 N 显示成 40；
- 不降低 Validator、不关闭去重、不生成 placeholder。

### 5.5 状态与不变式

```text
Σ typeCounts.count = plannedTotal
0 ≤ plannedTotal ≤ 40
所有 count 为非负整数
typeCounts 只含 canonical 七题型
不可行题型 count = 0
所有 cell 均属于用户选区 KP × 可行题型
requested(40) ≥ planned ≥ generated = final
```

状态口径：

| 情况 | `coverageStatus` |
|---|---|
| 无调整，计划 40 | `OK` |
| 有题型不可行但配额已补足 40 | `TYPE_COVERAGE_INFEASIBLE`，作为可见提示而非静默失败 |
| 容量导致计划不足 40 | `CAPACITY_LIMITED`；原因同时保留不可行信息 |

### 5.6 与既有显式配额的边界

- 非试卷请求的 `typeCounts / perTypeCount` 语义完全不变。
- 合法 `examType` 是试卷模板开关，在 POL 中优先于显式配额和外部 count，确保固定试卷不可经 URL 绕过。
- 试卷 UI 不产生 `typeCounts / perTypeCount`。
- 新增测试必须分别证明：
  1. 试卷模板权威；
  2. 非试卷显式组合仍原样遵守既有规则；
  3. `examType` 不传入任何 cell/Generator 请求。

### 5.7 生成前预览与标题

示例：

```text
一年级上册 · 第 5 单元 · 单元测试
计划 40 题

计算 12　填空 8　选择 6　判断 4
几何 4　分类 2　应用 4

难度：6（可修改）
题量：40（标准试卷固定）
```

打印标题复用同一 `titleType`：

```text
一年级数学 · 上册第 5 单元单元测试
一年级数学 · 上册期中测试
一年级数学 · 上册期末测试
```

---

## 6. 教师模式详细设计

### 6.1 选择路径

```text
年级
→ 上册 / 下册 / 不限
→ 按课本顺序排列的单元
→ 按课本顺序排列的 KP
→ 题型
→ 练习页设置题量和难度
```

支持：

- 单元聚焦，多选；
- 未聚焦时展示当前册别全部分组；
- 单元全选/取消全选；
- KP 独立多选；
- 题型多选；
- 已选 KP 数、单元数、题型数摘要；
- 清空当前教师选择；
- 所选 KP 不支持的题型显示不可用和原因。

### 6.2 课本顺序投影

KnowledgeContext 的 UI 视图增加以下只读字段：

| 字段 | 来源 | 用途 |
|---|---|---|
| `unitId` | canonical/runtime 已有 `unitId` | 稳定单元标识 |
| `unitOrdinal` | runtime 平铺字段或 `unit.unitOrdinal` | 单元课本顺序 |
| `knowledgeNo` | canonical/runtime 已有 `knowledgeNo` | 单元内 KP 顺序 |
| `sourceIndex` | `uiListForGrade()` 返回数组的稳定原始下标 | 缺号/同号时的确定性 tie-break |

所有键恒存在，缺失为 `null`；`sourceIndex` 为数组下标。只投影，不写回 KBL。

### 6.3 排序规则

单元：

```text
册别 up → down
→ unitOrdinal 数值升序
→ unitId 稳定排序
```

KP：

```text
knowledgeNo 按点分段数值比较（如 2.10 > 2.2）
→ sourceIndex 升序
→ KP ID 稳定排序
```

禁止直接对 `knowledgeNo` 做字符串字典序排序。

### 6.4 单元与 KP 选择一致性

- 请求以 `state.teacherKps` 为 KP 唯一来源。
- `teacherUnitIds` 是聚焦和摘要信息，不能覆盖或扩张显式 KP 池。
- 点击“单元全选”必须显式把该单元 KP 合并到 `teacherKps`。
- 取消单元聚焦不隐式删除 KP；点击“取消全选”才移除该单元已选 KP。
- 切换年级/册别后，只保留仍属于新范围的 KP；本任务默认清空依赖选择，避免隐藏旧选择。
- 题型只作为策略白名单，最终可行组合由 POL 返回。

---

## 7. 请求、URL 与透传契约

### 7.1 新增字段

| 字段 | 合法值 | 适用模式 | 消费方 |
|---|---|---|---|
| `mode` | `home / exam / teacher` | 全部 | 选择页、练习页产品行为 |
| `practiceKind` | `calc / apply` | 家庭 | 选择页、练习页标题与说明 |
| `practiceFocus` | `all / make-ten / break-ten / add-sub-oral / four-ops-oral / vertical` | 家庭计算 | 选择页筛选、练习页标题 |
| `examType` | `unit / midterm / final` | 试卷 | POL 模板、练习页标题/只读状态 |
| `scope.unitIds` | 稳定 unitId 数组 | 三模式 | 选择状态、范围摘要、URL 恢复 |

既有 `scope.knowledgePoints / questionTypes / count / difficulty` 继续承担生成输入。

### 7.2 字段流矩阵

| 字段 | RequestNormalize | URL | practice.html | PracticeBridge/Session | POL | Cell/Generator |
|---|---|---|---|---|---|---|
| `mode` | 归一 | 是 | 产品 UI | 不作为 Strategy 产品模式 | 否 | 否 |
| `practiceKind` | 归一 | 是 | 标题/说明 | 否 | 否 | 否 |
| `practiceFocus` | 归一 | 是 | 标题/说明 | 否 | 否 | 否 |
| `examType` | 归一 | 是 | 只读/标题/预览 | **是** | **是** | **否，规划级字段** |
| `scope.unitIds` | 去重/归一 | `unitIds` CSV | 范围摘要 | 否 | 否；KP 池已显式给出 | 否 |
| `kps` | 既有 | 是 | 是 | 是 | 是 | 以 cell KP 为准 |
| `types` | 既有 | 是 | 是 | 是 | 是 | 以 cell QT 为准 |
| `count/difficulty` | 既有 | 是 | 是 | 是 | 是 | 按既有契约 |

`examType` 必须登记为 Planning Context，在 `practice-orchestrator.js` 的 cell 白名单/排除注释与测试中同步体现，避免静默传入 Generator。

### 7.3 归一化规则

1. 选择页和 RequestNormalize 只接受 `home/exam/teacher`；非法产品模式回退 `home`。
2. 家庭默认 `practiceKind='calc'`、`practiceFocus='all'`。
3. `practiceKind='apply'` 时强制 `practiceFocus=null`。
4. 教师模式强制 `practiceKind/practiceFocus/examType=null`。
5. 试卷模式强制 `practiceKind/practiceFocus=null`，非法 `examType` 回退 `unit`；选择页仍要求单元测试显式选单元。
6. `unitIds` 去空、去重、保持当前课本顺序；不在 RequestNormalize 直接读取 KBL 文件。
7. 试卷创建请求时写 `count=40`；POL 再次强制 40，防止 URL 或调用方篡改。
8. 既有知识页等无产品 mode 的 practice 深链继续保持通用练习行为，不形成第四个可见产品模式。
9. 不为旧 `quick/competition` 建转换器或兼容模块。

### 7.4 URL 示例

家庭：

```text
practice.html?subject=math&grade=1&mode=home&book=up
&practiceKind=calc&practiceFocus=make-ten
&unitIds=math-g1-up-u05&kps=<该专项KP>
&qt=calc&types=calc&count=20&difficulty=6
```

单元测试：

```text
practice.html?subject=math&grade=1&mode=exam&book=up
&examType=unit&unitIds=math-g1-up-u05&kps=<该单元KP>
&types=calc,fill,choice,judge,geometry,classify,apply
&count=40&difficulty=6
```

教师：

```text
practice.html?subject=math&grade=1&mode=teacher&book=up
&unitIds=<聚焦单元>&kps=<教师显式KP>
&types=calc,apply&count=20&difficulty=6
```

实际 URL 由 `CatalogUtils.buildPracticeUrl()` 单行生成并正确编码；示例换行仅用于文档阅读。

### 7.5 请求一致性

- 页面摘要、开始 URL、练习页预览必须来自同一状态快照。
- `kps` 是实际生成范围，`unitIds` 不得暗中扩大该范围。
- 家庭标题字段不参与生成语义。
- PracticeSession 内部仍按 KP 数量设置 `single-kp/multi-kp`，不得把 `home/exam` 当成新 Strategy 模式。
- 对全部 12 个年级×册别执行 URL 构建冒烟，确认无未编码逗号、中文、非法 ID 或异常超长截断。

---

## 8. 练习页交互改造

### 8.1 三模式控件矩阵

| 控件 | 家庭 | 试卷 | 教师 |
|---|---|---|---|
| 总题量 | 可编辑 1～50，默认 20 | 固定 40，只读 | 可编辑 1～50，默认 20 |
| 难度 | 可编辑 1～10 | 可编辑 1～10 | 可编辑 1～10 |
| 分题型数量 | 单题型时不显示无意义编辑 | 只读，展示 POL 最终值 | 保留现有编辑与守恒 |
| POL 覆盖提示 | 显示 | 显示，含重分配说明 | 显示 |
| 生成/重新生成 | 保持 | 保持 | 保持 |
| 作答/批改/答案/打印 | 保持 | 保持 | 保持 |

### 8.2 试卷只读实现

- `customCount.readOnly=true`，显示 40，附“标准试卷固定题量”。
- 分题型输入设只读，并通过 `aria-readonly` 和说明文本表达，不仅改颜色。
- 试卷路径始终 `state.typeCounts=null`，避免把只读预览回写成用户显式配额。
- `ratioPolView()` 请求和签名加入 `examType`；40 题不受 URL count 影响。
- 切换难度后重新查询 POL，因为容量和可行性可能随难度上下文变化。
- 不使用 `catch → ''`，不吞计划错误。

### 8.3 计划预览

复用 `CatalogUtils.capabilityPlanView()`，增加透传：

- `examType`；
- `quotaAdjustments`；
- 既有 `typeCounts/plannedTotal/coverageStatus/reason`。

页面只渲染结果，不自行推导补题优先级。

异步签名至少包含：

```text
subject / grade / book / examType / count / difficulty
/ sorted KP IDs / sorted question types
```

旧签名响应不得覆盖新选择。

### 8.4 加载、空态与失败

| 状态 | 展示 |
|---|---|
| 初始 | 模式、范围、题量和难度摘要；主生成按钮可用性明确 |
| POL 查询中 | “正在计算实际出题计划…” |
| 计划可用 | 最终题量、题型数量、覆盖和调整说明 |
| 无能力 | 明确不可生成原因，不展示伪造的 40 题计划 |
| 生成中 | 复用现有进度与防重复提交 |
| PARTIAL | 显示实际题数和原因，不宣称完整 40 题 |
| 生成异常 | 复用全局错误与重试，不切换第二生成器 |

### 8.5 标题和打印

`deriveTypeName()` 优先级调整为：

```text
试卷完整标题
→ 家庭专项/应用题标题
→ 教师选题练习
→ 既有 recommendType/qt/module 深链标题
```

只修改标题来源，不改 Presentation、Print、Layout 或 SemanticQuestion。打印继续由 PracticeSession 的 `titleType` 驱动。

---

## 9. 文件级最小改动清单

| 文件 | 允许修改 | 计划删除/禁止 |
|---|---|---|
| `shared/orchestration/knowledge-context.js` | UI KP 只读投影增加 `unitId/unitOrdinal/knowledgeNo/sourceIndex` | 禁止业务筛选、写 KBL |
| `shared/orchestration/practice-orchestrator.js` | 合法 `examType` 的模板分配、重分配、调整记录；规划字段排除说明 | 禁改非试卷显式配额；禁传 examType 到 cell |
| `shared/request/request-normalize.js` | 新产品模式、家庭/试卷字段、unitIds、默认归一 | 删旧产品模式枚举；不留旧模式转换器 |
| `shared/catalog/catalog-utils.js` | 新字段 URL 序列化；POL 预览参数与调整结果透传 | 不在页面外另建 URL 拼接入口 |
| `shared/catalog/module-catalog.js` | 如选择页需要，承载家庭专项的稳定产品筛选配置 | 不复制 KP 事实，不新增第二套语义库 |
| `shared/bridge/practice-bridge.js` | `examType` 在 profile/sessionConfig 中透传 | 不计算模板和配额 |
| `shared/engine/practice-session.js` | config 与 `_buildGenerationRequest()` 透传 `examType` | 不新增 home/exam Strategy 模式 |
| `select.html` | 三模式 DOM/状态/交互/摘要/范围筛选/课本排序/必要样式 | 物理删除 quick/competition 产品实现 |
| `practice.html` | 新参数、标题、试卷只读、POL 预览与调整说明 | 不自行算试卷配额，不改作答/渲染架构 |
| `tests/orchestration/request-contract.test.js` | 按新请求契约重写并新增归一/URL 用例 | 不仅删除旧断言 |
| `tests/orchestration/p10-count-contract.test.js` 或既有 POL 数量契约文件 | 试卷模板、守恒、重分配、容量、显式配额隔离 | 不放宽既有数量契约 |
| `tests/orchestration/p10-2-scope-contract.test.js` | 范围/规划字段不进入 cell 的断言 | 不新增第二条 scope 链 |
| `tests/presentation/select-page-contract.test.js` | 三模式稳定 ID、顺序、无旧 DOM、交互结构断言 | 旧断言按新产品契约重写，不删除失败用例凑 PASS |
| 既有真实浏览器 E2E 脚本 | 增加三模式关键路径与打印断言 | 不伪造 DOM/生成结果 |

补充入口检查仅限 `index.html / math-types.html / subject-types.html / knowledge` 链接模板及全站 `mode=quick|competition` 引用。若知识页模板需改，必须改生成模板并重建正式知识页，禁止手改 375 个生成文件。

预计不需要修改：

```text
shared/strategy/**
shared/generator/**
shared/validator/**
shared/semantic/**
shared/presentation/**
shared/svg/**
kbl/**
```

---

## 10. 分阶段实施任务与门禁

> 每个任务执行前仍须走九步流水线：定位层 → 读架构 → 读基线 → 读契约 → 最小修改 → 执行 → 局部测试 → check-all → 日志。
>
> 阶段内任务按编号执行；阶段结束必须用户确认。

### 阶段一 · FOUNDATION：只读顺序与试卷后端能力

#### P46-01 KnowledgeContext 课本顺序只读投影

- 修改：`knowledge-context.js` 及既有 KnowledgeContext/POL 契约测试。
- 内容：增加四个 UI 字段；补单元/KP 排序输入测试。
- 不改：select、KBL、生成请求。
- 定向验收：
  - `5.1 < 5.10`；
  - `2.2 < 2.10`；
  - 缺字段为 `null`；
  - 相同 knowledgeNo 以 sourceIndex 稳定排序；
  - canonical 文件 hash 不变。
- 门禁：定向测试 → `npm test` → `node dev/check-all.js` → 日志。

#### P46-02 POL 试卷模板与确定性重分配

- 修改：`practice-orchestrator.js`、既有数量/范围测试。
- 内容：40 题模板、容量封顶、循环补 1、quotaAdjustments、状态口径。
- 定向用例：
  1. 全部可行且无容量限制 → 精确基准 40；
  2. geometry/classify 不可行 → 文档示例 40；
  3. 全部容量不足 → plannedTotal 如实小于 40；
  4. 同一输入重复计划 → 输出逐字段一致；
  5. URL/count=1 或 50 → 试卷仍按 40 规划；
  6. 非试卷显式 typeCounts → 既有结果不变；
  7. Σ counts、cell 选区、canonical 题型不变式全部成立。
- 禁改：Strategy/Generator/Validator。
- 门禁：POL 定向 → `npm test` → check-all → 日志。

#### P46-03 `examType` 会话透传与规划边界

- 修改：`practice-bridge.js`、`practice-session.js`、既有会话/编排测试。
- 内容：profile → session config → generation request → POL。
- 定向断言：
  - POL 真实读到 `examType` 且产出模板配额；
  - cell 请求不含 `examType`；
  - PracticeSession 内部 `single-kp/multi-kp/adaptive` 行为不变；
  - 家庭字段未进入会话/Generator。
- 阶段过门：01～03 全部证据 + 用户确认。

### 阶段二 · PRODUCT-UI：三模式选择与练习页接通

#### P46-04 选择页与请求边界一次性切换三模式

- 修改：`select.html`、`request-normalize.js`、`catalog-utils.js`、对应契约测试。
- 内容：
  - 产品模式改为 home/exam/teacher；
  - 公共开始按钮；
  - 三模式独立状态和基础 DOM；
  - 教师单元/KP 课本排序；
  - 新字段归一和 URL；
  - 删除快速/竞赛主交互，不保留双轨。
- 验收：
  - 页面只有三个模式；
  - 选择页仍无 countSelect/difficultySelect；
  - 模式切换不串状态；
  - 年级/册别变更无隐藏旧 KP；
  - 教师顺序和跨册同名单元稳定；
  - 非法模式/字段归一正确；
  - 无旧开始按钮、stageQuick、stageCompetition。

#### P46-05 家庭模式专项与空能力交互

- 修改：家庭配置、筛选、摘要、开始门禁及测试。
- 内容：calc/apply、六专项、单元多选、部分覆盖、空态。
- 定向样本：
  - 一年级上册凑十法；
  - 一年级下册破十法相关 KP；
  - 有真实能力的加减法口算、四则运算口算、竖式计算年级；
  - 一个无专项能力范围；
  - 一个部分单元支持 apply 的范围。
- 断言：请求只含 calc/apply；专项空时不开始；无 KP ID 硬编码。

#### P46-06 试卷范围与摘要交互

- 修改：三类试卷选择、单元单选、期中/期末自动范围、范围摘要及测试。
- 定向样本：
  - 单元数分别为奇数、偶数、1 的册别；
  - 单元测试未选单元；
  - 不支持全部七题型的单元；
  - 期中与期末范围 KP 不串册。
- 断言：范围算法与 POL 计划预览使用同一 KP 池。

#### P46-07 练习页三模式控制、标题与计划预览

- 修改：`practice.html`、`catalog-utils.js` 预览透传、页面/会话测试。
- 内容：题量只读矩阵、难度保留、标题、quotaAdjustments、异步签名。
- 验收：
  - 家庭/教师改题量仍按现有行为工作；
  - 试卷 URL count=1/50 均显示并规划 40；
  - 试卷分题型输入不回写显式 typeCounts；
  - 难度变化重新预览；
  - 旧异步响应不覆盖新计划；
  - 屏幕标题与打印标题一致。
- 阶段过门：04～07 定向测试 + npm test + check-all + 用户确认。

### 阶段三 · CLEANUP：升级后的物理清理

#### P46-08 旧模式、死状态与重复实现清理

按本文件 §11 的证据矩阵逐项处理，不打包扩删：

1. 删除 quick/competition 残留产品 DOM、状态、分支、专用样式和无效事件。
2. 清理请求枚举、模式描述、开始按钮映射和摘要旧分支。
3. 定点更新仍指向旧模式的入口。
4. 对 competition module、Strategy 内部模式等候选，不满足三方零消费证据就保留并登记，不强行删除。
5. 删除本批产生且无消费者的辅助函数/字段；不保留“以后可能用到”的抽象。
6. 检查无 shim/adapter/COMPAT/BRIDGE、无第二套试卷模板或渲染器。
- 阶段过门：检索证据 + dead-code/legacy 门禁 + npm test + check-all + 用户确认。

### 阶段四 · ACCEPT：真实浏览器与最终冻结

#### P46-09 三模式浏览器与打印验收

- 扩充现有 E2E，不新建第二套测试框架。
- 按 §12 矩阵执行真实 Chrome。
- 留存：关键 URL、计划配额、控制台错误、生成/批改/打印结果和必要截图。
- 任何失败先定位唯一层，禁止为赶验收降低标准。
- 阶段过门：用户确认浏览器证据。

#### P46-10 最终全量门禁与冻结收口

- 运行最终定向测试、npm test、check-all。
- 核对 KBL、七题型、1566 ALLOW、生成矩阵、Sitemap、bundle 确定性。
- 按实际结果更新基线/变更日志；不预写测试数。
- 检查无临时探针、报告、调试日志或规划外文件混入交付。
- 登记最终冻结记录和未授权遗留项。
- 不自动 commit；版本号和发布另行按用户指令执行。

---

## 11. 升级后的专项清理方案

### 11.1 清理原则

清理对象是**已被三模式替代的产品实现**，不是借升级重写相关模块。

每个物理删除必须满足：

1. 代码检索生产零消费者；
2. `node dev/p28/check-dead-code.js` 与 `check-cross-layer.js` 无阻断；
3. 相关测试和门禁不以“被删物存在”为通过条件；
4. 若门禁本身引用，先按新产品契约修订门禁并说明，不删检查；
5. archive、历史 change-log 不作为生产消费者，不改写历史。

### 11.2 必删项

| 对象 | 删除内容 | 验证 |
|---|---|---|
| 模式选项 | quick/competition 的 option、MODE_DESC、URL 初态白名单 | 选择页只剩三模式 |
| 三按钮实现 | startBtnQuick/startBtnCompetition 及旧 teacher 专用映射，合并公共按钮 | 摘要和按钮同一请求 |
| 旧 stage | stageQuick/stageCompetition 及其专属容器 | 无旧 ID 引用 |
| 旧状态 | quickTypes/quickUnits/competitionModules 等 | 无旧状态键 |
| 旧渲染分支 | renderQuick/renderCompetition 及 collectKps 旧分支 | 无重复产品实现 |
| 旧摘要/提示 | quick/competition 专属摘要和模式提示分支 | 三模式摘要完整 |
| 旧样式 | 只服务旧 stage/竞赛模块的 CSS | 共享样式保留，做引用检查 |
| 请求旧枚举 | RequestNormalize 中 quick/competition 产品枚举 | 新模式归一测试通过 |

实际符号名以实施时源码为准；若已在 P46-04 删除，P46-08 只核验，不重复制造改动。

### 11.3 证据后决定项

| 候选 | 处置 |
|---|---|
| `competitionModulesFor`、C1–C9 模块目录 | 有其他页面消费者则保留；三方证明全零后才删 |
| Strategy 内部 `quick/competition` 模式 | 不因其与旧产品同名就自动删；先证明无生产调用、无契约消费 |
| `isCompetitionKp` 等过滤函数 | 家庭/教师仍承担排除非课本 KP 职责时保留并按新语义命名；否则删除 |
| 旧 quick 类型定义 | 七题型教师/试卷仍复用时改为共享常量；只服务 quick 的部分删除 |
| 旧 CSS 类 | 有共享消费者保留；仅旧模式使用才删 |
| 旧测试名/注释 | 当前测试按新契约更新；历史档案不改 |

### 11.4 明确不清理

- canonical 题型归一中的 `oral/vertical/cushi` 等既有请求别名，不因家庭专项同名而误删；
- 现有 Knowledge/practice 无 mode 深链；
- POL 非试卷显式配额；
- Generator 内已有凑十法、竖式等教学实现；
- 历史文档与归档中的旧模式记录；
- 仍有真实消费者的模块目录和 Strategy 能力。

---

## 12. 测试与验收矩阵

### 12.1 单元/契约测试

| 领域 | 必测内容 |
|---|---|
| KnowledgeContext | 顺序字段完整、null 口径、数值化 knowledgeNo、稳定 tie-break |
| RequestNormalize | 三模式、字段互斥、默认值、非法输入、count/difficulty 既有归一 |
| URL | 新字段编码、unitIds/kps CSV、无拼接第二入口、12 册冒烟 |
| POL | 40 守恒、七题型基准、不可行重分配、容量、确定性、非试卷隔离 |
| Session/Bridge | examType 到达 POL、不到 cell、内部 Strategy mode 不回归 |
| Select | 三模式 DOM、状态隔离、开始门禁、教师顺序、无旧入口 |
| Practice | 控件矩阵、只读、标题、计划预览、异步签名、无显式配额回写 |
| 回归 | 作答、批改、答案、重新生成、错题、深链和打印既有契约 |

### 12.2 真实生成样本

至少覆盖：

| 样本 | 验收点 |
|---|---|
| G1 上册凑十法 | KP 命中、calc、题量/难度可调 |
| G1 下册破十法相关 | 不错误承诺方法拆分、calc |
| G2/G3 加减法口算代表 | 候选非空、无竖式冒充口算 |
| G4～G6 四则运算口算代表 | 按真实能力筛选，不跨年级取 KP |
| 有竖式能力年级 | M2 + POL calc，标题正确 |
| 家庭应用题 | 只生成 apply |
| 单元测试：七题型不全 | 调整说明和总量正确 |
| 期中测试：奇数单元册 | 前 ceil(n/2) 单元，顺序正确 |
| 期末测试 | 当前册全部范围，不串上下册 |
| 教师多单元多 KP | 请求与勾选完全一致，题型可行 |

样本 KP 在实施时经真实数据选择并记录，不在文档中编造不存在的 ID。

### 12.3 Chrome 端到端路径

每模式至少完成：

```text
打开 select
→ 选择模式与范围
→ 校验摘要和开始状态
→ 进入 practice
→ 校验题量/难度控件
→ 生成
→ 作答
→ 提交批改
→ 查看答案
→ 重新生成保持配置
→ 打印
→ 返回选择页
```

试卷额外断言：

- 单元/期中/期末三种标题和范围；
- 固定 40 的 POL 计划或明确容量不足；
- 修改 URL count 不生效；
- 配额调整文本与 POL 输出一致；
- 打印题数与最终实际题集一致。

通用断言：

- 控制台零新增 JS error；
- 无空白题卡、占位题、 fake/fallback 题；
- 无跨模式状态串用；
- 无横向溢出；
- 键盘路径和窄屏可操作。

### 12.4 全量门禁

最终必须执行：

```bash
npm test
node dev/check-all.js
```

当前基线标尺：

```text
34 项：本地 33 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome）
有 Chrome/CI：34 PASS / 0 FAIL / 0 SKIP
```

重点关注：

- 5：全量测试；
- 6a/6b：1566 真实生成与矩阵冻结；
- 6c/6d：Generator 注册和四轴边界；
- 9a/9b：难度权威与溯源；
- 10/11/12：Presentation、SVG、安全；
- 13/14：Sitemap 和爬取不受查询参数影响；
- 15：真实浏览器；
- 16/17：bundle source/hash 与构建确定性；
- 20：文档一致性；
- 21/22：死代码与 Legacy 治理。

若 6a/6b 因本任务出现非预期变化，必须停手定位；不得直接重冻矩阵掩盖回归。

---

## 13. 构建、派生与冻结物处理

### 13.1 本任务预期无需执行的数据派生

因为不改 Excel、KBL、题面、答案和教学语义，预期不需要：

- `tools/kbl/derive-*.js`；
- `emit-canonical.js`；
- variation/misconception 派生；
- KBL manifest/rootHash 重建；
- GENERATOR-MATRIX 重冻。

仍须通过 hash/门禁证明“不需要”而不是凭计划跳过验证。

### 13.2 Bundle

本任务预计不修改 Strategy/Presentation 的 bundle 模块图源码，但每阶段仍执行 16/17：

- 若实际修改文件进入任一 bundle 模块图，必须运行对应既有构建脚本；
- 不手编 bundle；
- 重建后证明同源 hash 一致、重复构建确定；
- 未进入模块图也记录 16/17 PASS，不无依据重建。

### 13.3 Sitemap、知识页与 SW

- 不新增公共 HTML 页面，Sitemap 预计仍为 382；以门禁为准。
- 查询参数不进入 sitemap/canonical。
- 知识页链接模板未改时不重建 375 页；若定点证据要求改模板，则必须统一重建并核对指纹。
- select/practice 已在现有 SW 预缓存中；版本发布是否 bump 由最终发布任务决定，本任务不预先改版本。

---

## 14. 最终收口清单

### 14.1 代码收口

- [ ] 选择页只有 home/exam/teacher。
- [ ] 无 quick/competition 产品 DOM、状态、摘要、URL 分支。
- [ ] 无公共开始按钮之间的状态竞争。
- [ ] 无第二套家庭筛选事实源、试卷配额计算或试卷渲染器。
- [ ] examType 只到 POL 规划层，不进入 Generator。
- [ ] 无 shim/adapter/COMPAT/BRIDGE、无临时 feature flag。
- [ ] 无调试日志、探针、临时报告和无用新文件。
- [ ] 候选死代码均有删除证据或保留原因。

### 14.2 数据与架构收口

- [ ] 375/98/407/1566 不变。
- [ ] 七题型和 23 Generator 不变。
- [ ] KBL/canonical/runtime 数据未因本任务写入。
- [ ] Generator 不自决 KP/题型/数量/难度。
- [ ] 难度公式、Validator、SemanticQuestion、Presentation、SVG 未改。
- [ ] requested ≥ planned ≥ generated = final 守恒。
- [ ] 生成矩阵无未授权漂移。

### 14.3 文档收口

- [ ] `docs/P46/change-log.md` 每任务记录 modified/deleted/reason/tests/risk。
- [ ] 任务书状态、实际完成项和遗留项按事实更新。
- [ ] `docs/00-BASELINE.md` 仅在真实测试数/门禁/版本变化时更新。
- [ ] `docs/CHANGELOG.md` 仅在版本收口时按实际内容更新。
- [ ] 历史档案不改写，不用旧阶段数字充当当前基线。
- [ ] 最终记录本地与 Chrome/CI 两种门禁口径。
- [ ] 未执行事项明确标“未执行”，不写“预计 PASS”充当结果。

### 14.4 交付与发布收口

- [ ] 用户已逐阶段确认。
- [ ] 最终浏览器证据已确认。
- [ ] 全量门禁通过。
- [ ] 工作区变更范围与本任务书一致。
- [ ] 不自动 Git commit、不自动 push。
- [ ] 版本升级、SW 缓存发布和部署如需执行，另获用户明确指令。

---

## 15. 风险与回退策略

| 风险 | 预防 | 触发后的处理 |
|---|---|---|
| 专项名称匹配过宽/过窄 | 候选过滤 + POL 双判定；真实样本验收 | 只修当前专项规则，不扩全项目审计 |
| 破十法被误解为独占方法 | 明确辅助说明 | 不改 Generator 掩盖；必要时调整文案 |
| 固定配额导致部分试卷不足 40 | 重分配 + 容量提示 | 不补假题；保留 PARTIAL 证据 |
| 大改 select 引发状态串用 | 三模式独立状态、统一请求快照、公共按钮 | 回退当前任务最小改动，修状态契约 |
| 旧模式删除误伤其他入口 | 定点检索 + 浏览器入口矩阵 | 恢复仍有消费者的共享模块，不恢复旧产品双轨 |
| 新旧测试契约冲突 | 以新需求重写断言并保留覆盖 | 禁止删失败用例凑 PASS |
| 异步 POL 响应覆盖新选择 | 请求签名和过期响应丢弃 | 增加复现测试后修单一消费点 |
| URL 被篡改绕过固定卷 | Request 与 POL 双重强制 40 | 修 POL 权威边界，不仅修 UI |
| 意外改到生成矩阵 | 每阶段 6a/6b | 停止、回退越界改动、重走流水线 |

回退以**当前任务**为边界，不使用破坏性 Git 操作覆盖用户其他改动。出现跨层根因时拆新任务，先举证并经用户确认。

---

## 16. P46 红线

1. 禁止修改 Root Excel、KBL 事实或 AI 编造专项映射数据。
2. 禁止新增第八种题型，或把口算/竖式/凑十法注册为 canonical 题型。
3. 禁止新增家庭/试卷 Strategy Engine、试卷 Renderer、Preview/Fallback Engine。
4. 禁止 Generator 自决 KP、题型、数量、难度；禁止 SVG/Presentation 反推试卷范围。
5. 禁止页面复制 POL 配额算法或自行补题。
6. 禁止为达到 40 题生成重复占位题、关闭去重、降低 Validator 或吞错。
7. 禁止改变非试卷显式 `typeCounts/perTypeCount` 语义。
8. 禁止 `examType` 进入 cell/Generator。
9. 禁止为旧 quick/competition 建 shim/adapter/COMPAT/BRIDGE 或长期双轨。
10. 禁止为测试 PASS 删除失败用例或降低测试标准。
11. 禁止顺手重构 Generator、Strategy、Presentation、批改和无关页面。
12. 禁止未经用户阶段确认进入下一阶段。
13. 禁止改完不跑门禁、不记日志、不更新真实状态即交付。
14. 禁止自动 Git commit/push。

唯一允许偏离：用户显式指令覆盖某条，并在 change-log 的 reason 中留存依据。

---

## 17. 开工确认项

用户确认本任务书，即表示同时确认：

- [ ] 三模式及各自范围；
- [ ] 家庭六项计算入口和破十法能力边界；
- [ ] 三种试卷默认 40 题、难度可调、题量只读；
- [ ] 固定基准配额及不可行题型确定性重分配；
- [ ] 期中取前半部分、奇数向上取整；
- [ ] 教师按单元 → KP 的课本顺序，不虚构课时；
- [ ] 题量/难度继续只在练习页；
- [ ] 升级后物理清理旧快速/竞赛产品实现；
- [ ] 按 P46-01～10 分阶段执行并逐阶段签收；
- [ ] 最终完成真实浏览器、全量门禁和冻结收口。

确认后首先执行 **P46-01**，不在同一批次自动完成全部任务。
