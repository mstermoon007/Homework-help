# 数学知识库（Math Knowledge Base）

> 本文档说明本项目「数学知识库」的组织结构、一二年级覆盖情况、插件↔知识点对应关系，
> 以及高年级（三年级起）的扩展方式。新增知识点 / 新插件时请先阅读本文档与
> `shared/knowledge-bank.js` 头部注释。

## 一、知识库文件

| 文件 | 全局变量 | 作用 | 是否参与运行 |
| --- | --- | --- | --- |
| `shared/knowledge-bank.js` | `KnowledgeBank` | 结构化知识点清单：领域、插件、条目、默认参数 | 否（静态参考） |
| `shared/math-knowledge.js` | `MathKnowledge` | 按年级分领域的知识点树（供题型选择页 / 插件设计参考） | 否（静态参考） |
| `plugins/registry.js` | `PLUGIN_REGISTRY` | 插件注册表：id → 文件路径 / 依赖 | **是**（运行时加载） |
| 各 `plugins/*.js` | `window.__currentPlugin` | 插件本体（含 `generate/render/check`） | **是** |

约定：知识库文件**不参与运行逻辑**。运行时插件元数据以 `plugins/*.js` 与
`plugins/registry.js` 为准；知识库清单用于——确认覆盖是否完整、编排综合练习题型配比、
让 `math-types.html` 免加载插件脚本即可获取题型名称与描述。

## 二、数据结构（多年级复用格式）

`shared/knowledge-bank.js` 采用「按年级分节」的结构，所有年级共用同一套字段：

```js
KnowledgeBank = {
  subject: 'math',
  categoryOrder: ['number', 'geometry', 'statistics'],   // 领域展示顺序
  categoryNames: { number: '数与代数', geometry: '图形与几何', statistics: '统计与概率' },
  grades: {
    1: {                       // 年级号（整数）
      meta:     { grade, gradeName, subject, version, maintained },
      plugins:  [ { id, name, category, desc }, ... ],    // 该年级涉及的插件清单
      entries:  [ KnowledgeEntry, ... ],                  // 知识点条目（见下方 @typedef）
      byPlugin(pluginId), byCategory(category), entry(id) // 查询工具
    }
    // 2: { ... },  // 后续年级照抄一年级结构追加
  },
  getGrade(g)   // 取指定年级知识库，不存在返回 null
};
// 兼容别名：KnowledgeBankGrade1 === KnowledgeBank.grades[1]
```

### 知识点条目 KnowledgeEntry

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 知识点唯一标识（年级内唯一，如 `addsub-20`、`classify`） |
| `name` | string | 知识点中文名 |
| `category` | string | 领域：`number` / `geometry` / `statistics` |
| `pluginId` | string | 对应插件 ID（须与 `plugins/registry.js` 一致） |
| `type` | string? | 推荐题型参数（传给 `generate` 的 `opts.type`，省略则用插件默认） |
| `defaults` | object? | 推荐默认参数（如 `count` / `maxNum` / `difficulty`） |
| `desc` | string | 一句话描述（供题型选择页展示） |
| `points` | string[] | 知识点细分条目（如 `['加法','减法','相差']`） |

## 三、一年级知识库结构

一年级共 **11 个插件、18 个知识点条目**，覆盖三大领域。

### 领域一：数与代数（number）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `count` | 数数与顺序 | math-number-sense | `type=count` | 数数、顺序 |
| `compose-digit` | 数的组成与数位 | math-number-sense | `type=compose` | 组成、数位 |
| `compare` | 比大小 | math-number-sense | `type=compare` | 比大小 |
| `addsub-20` | 20 以内加减法 | math-oral | `type=addsub` | 20 以内加减法 |
| `chain-mixed` | 连加连减与加减混合 | math-word-problems | `difficulty=basic` | 连加连减、加减混合 |
| `make-ten` | 凑十法 | math-make-ten | `type=mix` | 凑十法、平十法、破十法 |
| `clock-hour` | 认识钟表（整时） | math-clock | — | 整时 |
| `patterns` | 找规律 | math-patterns | — | 数字规律、图形规律 |
| `picture-equations` | 看图列式 | math-picture-equations | — | 看图列式 |
| `money` | 认识人民币 | math-money | `type=mix` | 认识面值、元角分换算、简单计算 |
| `solve-problems` | 解决问题 | math-word-problems | `difficulty=mix` | 加法、减法、相差、连加连减、多余条件 |

### 领域二：图形与几何（geometry）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `solid-shapes` | 认识立体图形 | math-shapes | `type=solid` | 长方体、正方体、圆柱、球 |
| `flat-shapes` | 认识平面图形 | math-shapes | `type=flat` | 三角形、正方形、长方形、圆形、梯形 |
| `shape-compose` | 图形拼组 | math-shapes | `type=count` | 图形拼组 |
| `position` | 上下左右位置 | math-shapes | `type=position` | 上下左右位置 |

### 领域三：统计与概率（statistics）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `classify` | 分类与整理 | math-statistics | `type=classify` | 按形状分类、按颜色分类、按用途分类 |
| `stats-table` | 填写简单统计表 | math-statistics | `type=table` | 填写简单统计表 |
| `pictograph` | 象形统计图 | math-statistics | `type=picto` | 涂色制作象形统计图 |

> 一年级仅实现了统计与概率中的「分类整理 / 统计表 / 象形统计图」，尚不含综合练习。

### 综合插件

| 插件 id | 名称 | 说明 |
| --- | --- | --- |
| `math-comprehensive` | 综合练习 | 按 `meta.distribution`（average / domain）混合各题型生成整卷 |

## 三B、二年级知识库结构

二年级共 **13 个插件、19 个知识点条目**，覆盖三大领域。部分插件为新建
（`math-unit-convert` / `math-geometry` / `math-data-stats` / `math-logic-reasoning`），
其余为一年级插件扩展 `grades: [2]`。

### 领域一：数与代数（number）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `addsub-100` | 100 以内加减法 | math-oral | `type=addsub` `maxNum=100` | 100 以内加减法、进位加法、退位减法、竖式计算 |
| `muldiv` | 表内乘除法 | math-oral | `type=muldiv` | 乘法口诀、表内乘法、表内除法 |
| `remainder` | 有余数除法 | math-oral | `type=remainder` | 有余数的除法、余数与除数的关系 |
| `mixed` | 混合运算 | math-oral | `type=mixed` | 乘加乘减、两步运算 |
| `wp-solve` | 解决问题 | math-word-problems | `difficulty=mix` | 乘法、除法、两步运算、进一法、去尾法、周期问题、估算、质量计算 |
| `readwrite` | 万以内数的读写 | math-number-sense | `type=readwrite` | 读写、万以内数的认识 |
| `compose-4` | 数的组成与数位 | math-number-sense | `type=compose` | 组成、数位顺序 |
| `approx` | 近似数 | math-number-sense | `type=approx` | 近似数 |
| `unit-convert` | 单位换算 | math-unit-convert | `type=convert` | 长度单位、单位换算、厘米、米、毫米、千米、克与千克换算 |
| `fill-unit` | 填合适单位 | math-unit-convert | `type=fillUnit` | 认识质量单位、长度单位应用、常见的量、克与千克 |
| `money-2` | 认识人民币 | math-money | `type=mix` | 元角分换算、简单计算 |

### 领域二：图形与几何（geometry）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `angles` | 角的初步认识 | math-geometry | `type=angleClass` | 锐角、直角、钝角 |
| `motion` | 图形的运动 | math-geometry | `type=motion` | 平移、旋转 |
| `grid` | 方格纸 | math-geometry | `type=grid` | 在方格纸上画简单图形 |
| `shapes-2` | 认识图形 | math-shapes | `type=mix` | 立体图形、平面图形、上下左右位置、图形拼组 |

### 领域三：统计与概率（statistics）

| 知识点 id | 名称 | 插件 | 题型/参数 | 细分 |
| --- | --- | --- | --- | --- |
| `data-tally` | 数据收集与整理 | math-data-stats | `type=tally` | 正字统计法、简单统计表 |
| `data-question` | 根据统计结果回答问题 | math-data-stats | `type=result` | 根据统计结果提出建议 |
| `logic-reasoning` | 简单逻辑推理 | math-logic-reasoning | `type=bookGuess` | 简单逻辑推理 |
| `sudoku3` | 3×3 数独 | math-logic-reasoning | `type=sudoku3` | 数独启蒙 |

### 综合插件

| 插件 id | 名称 | 说明 |
| --- | --- | --- |
| `math-comprehensive` | 综合练习 | grades=[1,2]；二年级 `domain` 模式按三大领域权重混合，`make-ten` 在二年级被排除 |

> 知识点树 `shared/math-knowledge.js` 中「整百整千数加减」「找规律（数字规律）」
> 「从不同方向观察物体」暂无对应插件，属于纯课程参考节点（预留扩展），不计入插件覆盖。

## 四、插件 ↔ 知识点 对应关系

同一插件可承载多个知识点（通过 `type` / `difficulty` 区分）；下表为「插件 → 知识点」反向索引。

| 插件 id | grades | 知识点条目 | 题型维度 |
| --- | --- | --- | --- |
| `math-number-sense` | [1,2] | count / compose-digit / compare / readwrite / compose-4 / approx | count / compose / compare / readwrite / approx |
| `math-oral` | [1,2,3] | addsub-20 / addsub-100 / muldiv / remainder / mixed | addsub / muldiv / remainder / mixed |
| `math-word-problems` | [1,2] | chain-mixed / solve-problems / wp-solve | 文字题（basic / mix，含进一法/去尾法/周期/估算/质量） |
| `math-make-ten` | [1,2] | make-ten | mix（凑十/平十/破十） |
| `math-clock` | [1] | clock-hour | 整时 |
| `math-patterns` | [1] | patterns | 数字规律 / 图形规律 |
| `math-picture-equations` | [1] | picture-equations | 看图列式 |
| `math-money` | [1,2] | money / money-2 | recognize / convert / calc / mix |
| `math-shapes` | [1,2] | solid-shapes / flat-shapes / shape-compose / position / shapes-2 | solid / flat / count / position / mix |
| `math-statistics` | [1] | classify / stats-table / pictograph | classify / table / picto |
| `math-unit-convert` | [2] | unit-convert / fill-unit | convert / fillUnit |
| `math-geometry` | [2] | angles / motion / grid | angleClass / motion / grid |
| `math-data-stats` | [2] | data-tally / data-question | tally / result |
| `math-logic-reasoning` | [2] | logic-reasoning / sudoku3 | bookGuess / sudoku3 |
| `math-comprehensive` | [1,2] | —（混合调度上述插件） | distribution：average / domain |

> `plugins/*.js` 中 `category` 字段（`number` / `geometry` / `statistics` / `mixed`）与
> 本知识库的 `category` 一一对应，可据此在插件与知识库之间双向检索。

## 五、高年级扩展接口（预留给 2-6 年级）

### 5.0 难度系统（1-10 数值难度）

`practice.html` 设置面板新增**难度输入框**（仅数学插件显示，1-10 整数，默认 3）。
用户填写的数值经 `state.difficulty` 传入各插件 `generate({ difficulty: n })`：

- **共享工具**（`shared/common.js` 的 `PluginUtil`）：
  - `diffLevel(d)`：归一化 1-10 整数，非法值回退 3；
  - `diffScale(level)`：缩放系数，level 1→0.8、3→1.0、5→1.4、8→2.0、10→2.4；
  - `diffMax(base, level)`：推荐最大数 = `round(base * diffScale(level))`。
- **接入约定**：每个数学插件在 `generate()` 开头读取
  `_DIFF = PluginUtil.diffLevel(opts.difficulty)`，用 `diffMax(base)` 缩放数值范围；
  逻辑深度随难度提升（如找规律序列变长、人民币跨单位换算、图形位置题排数变多）。
- **math-comprehensive**：自动把 `opts.difficulty` 透传给子插件。
- **URL 参数**：支持 `practice.html?plugin=xxx&difficulty=8`。
- **新增数学插件时必须**接入难度（至少用 `diffMax` 缩放数值范围），否则高难度下数值不增长。

### 5.1 新增二年级知识点（流程示例）

1. **知识库**：在 `shared/knowledge-bank.js` 的 `GRADES` 中追加 `2:` 节点，结构照抄一年级：
   ```js
   2: buildGrade(
     { grade: 2, gradeName: '二年级', subject: 'math', version: '1.0.0', maintained: '...' },
     GRADE2_PLUGINS,   // 二年级涉及的插件清单
     GRADE2_ENTRIES    // 二年级知识点条目
   )
   ```
2. **知识点树**：在 `shared/math-knowledge.js` 的 `GRADES` 中追加 `2:`（含 domains/topics）。
3. **插件**：若二年级新增插件，写入 `plugins/*.js` 并在 `plugins/registry.js` 注册；
   若复用现有插件（如 math-oral 已支持 [1,2,3]），只需确认其 `grades` 含 2 即可。
4. **题型选择页**：`math-types.html` 已按 `KnowledgeBank.getGrade(grade)` 自动读取
   当前年级知识库，**无需改动**。

### 5.2 统计与概率领域扩展预留

`category: 'statistics'` 已预留，一年级仅使用「分类整理」。高年级将出现：

| 预期年级 | 知识点 | 建议插件/条目 |
| --- | --- | --- |
| 二/三年级 | 条形统计图、简单统计表 | 复用或新增 `math-statistics` 的 `type=bar` |
| 四年级 | 平均数 | 新增条目（category=statistics） |
| 五年级 | 折线统计图、复式统计表 | 新增条目（category=statistics） |

新增时在对应年级 `entries` 中以 `category: 'statistics'` 追加条目即可，插件接口与
知识库格式无需改动。

### 5.3 格式兼容性

- 年级节点结构完全一致 → 新增年级是**纯追加**，不破坏已有读取逻辑。
- `KnowledgeBank.getGrade(g)` 对不存在年级返回 `null`，页面可安全回退到插件自身元数据。
- 兼容别名 `KnowledgeBankGrade1` 保留，旧引用不受影响。

## 六、AI 辅助生成新插件时的检查清单

新增「知识点 → 插件」时按以下顺序核对：

1. `shared/math-knowledge.js`：该年级是否已有对应 topic？没有则补充。
2. `shared/knowledge-bank.js`：该年级 `entries` 是否已登记？`pluginId` 是否唯一匹配？
3. `plugins/registry.js`：插件 id / file / deps 是否注册？
4. 插件实现：是否满足 `plugins/CONTRACT.md` 契约（`generate/render/check`、category、
   grades、不用 `Math.random()`、不直接操作 DOM）？
5. `shared/knowledge-bank.js` 中该知识点的 `defaults`/`type` 是否与插件实际支持一致？
6. 综合练习：若需纳入 `math-comprehensive` 混合卷，确认插件可被 `generate({grade,count})` 无参调用。
