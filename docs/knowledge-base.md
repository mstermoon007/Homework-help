# 数学知识库（Math Knowledge Base）

> 本文档说明本项目「数学知识库」的组织结构、知识点 ID 命名规范、插件↔知识点对应关系，
> 以及新增知识点 / 新插件的接入方式。新增知识点 / 新插件时请先阅读本文档与
> `shared/knowledge-bank.js` 头部注释。

## 一、知识库文件

| 文件 | 全局变量 | 作用 | 是否参与运行 |
| --- | --- | --- | --- |
| `shared/knowledge-bank.js` | `KnowledgeBank` | 结构化知识点清单（按年级 × 模块 × 知识点） | 否（静态参考 / 综合练习编排） |
| `shared/module-catalog.js` | `MODULE_CATALOG` | 题型模块目录（`M0`–`M12` 基础 + `C1`–`C9` 竞赛） | 是（页面/校验用） |
| `plugins/registry.js` | `PLUGIN_REGISTRY` | 插件注册表：id → 文件路径 / grades / 占位标记 | **是**（运行时加载） |
| 各 `plugins/*.js` | `window.__currentPlugin` | 插件本体（含 `generate/render/check`） | **是** |
| `knowledge/*.html` | — | 详情页 / 模块页 / 索引页（由生成脚本产出） | 静态页面 |

约定：知识库文件**不参与运行逻辑**。运行时插件元数据以 `plugins/*.js` 与
`plugins/registry.js` 为准；知识库清单用于——确认覆盖是否完整、编排综合练习题型配比、
生成知识点详情页。

## 二、数据结构（当前统一结构，1-6 年级）

`shared/knowledge-bank.js` 采用「按年级分节」的数组结构：

```js
KnowledgeBank = [
  {
    grade: 1,
    modules: [
      {
        moduleId: 'M0',            // 对应 shared/module-catalog.js 中的模块 ID
        knowledgePoints: [
          { id, name, pluginId, weight, type, description, example,
            prerequisites, related, difficulty, status }
        ]
      }
    ]
  },
  // grade 2 … 6
]
```

### 知识点字段 KnowledgePoint

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | **知识点全局唯一 ID**（详见下节命名规范） |
| `name` | string | 知识点中文名 |
| `pluginId` | string | 对应插件 ID（须与 `plugins/registry.js` 一致） |
| `weight` | number | 抽题配比权重（综合练习 `kb` 模式按此分配题量，也驱动题型选择页排序） |
| `type` | string | 推荐传给插件 `generate` 的 `opts.type`（细分子题型） |
| `description` | string | 知识点说明（详情页展示） |
| `example` | string | 典型例题（详情页展示） |
| `prerequisites` | string[] | 前置知识点 ID 数组（允许低年级 / 同年级，**禁止高年级**） |
| `related` | string[] | 关联知识点 ID 数组 |
| `difficulty` | number | 难度：基础模块 `1`；竞赛模块按年级 `3`（4 年）/ `4`（5 年）/ `5`（6 年） |
| `status` | string | `'active'` 或 `'placeholder'`（指向占位插件时为 placeholder） |

## 三、知识点 ID 命名规范

ID 采用 `g{年级}-{模块}-{基础slug}` 三段式，全小写 + 数字 + 连字符，无空格 / 下划线：

```
g{grade}-{moduleIdLower}-{baseSlug}
```

- `grade`：1–6。
- `moduleIdLower`：模块 ID 小写（`m0`–`m12`、`c1`–`c9`）。
- `baseSlug`：语义化片段。**同主题跨年级保持一致**（如竞赛模块 `c1-vertical` 在
  4/5/6 年级分别为 `g4-c1-c1-vertical` / `g5-c1-c1-vertical` / `g6-c1-c1-vertical`）。

示例：`g1-m1-addsub-20`、`g4-c5-c5-meet`、`g6-m8-g6-app-frac-mult`。

> 历史说明：早期 ID 为「语义片段」或「年级前缀+语义片段」，跨年级可能重复、且不带模块信息；
> 已整体迁移为上述三段式，旧 ID 仅存于 `archive/` 迁移归档中。

## 四、模块目录

题型模块统一登记在 `shared/module-catalog.js`：

- 基础模块 `M0`–`M12`（`level: 'basic'`，`M0` 巧算专项仅一年级）。
- 竞赛模块 `C1`–`C9`（`level: 'competition'`，4–6 年级；C6/C7 仅 5–6 年级）。
- 模块名示例：`M1` 口算练习、`M4` 填空题、`M8` 解决问题、`C5` 行程问题、`C9` 竞赛综合。

新增题型模块时在 `BASIC_MODULES` / `COMPETITION_MODULES` 中追加
`{ id, name, grades, category, level }`，保持 `id` 唯一、`grades` 与 `level` 风格一致。

## 五、便捷查询方法（挂在 KnowledgeBank 数组对象上）

| 方法 | 说明 |
| --- | --- |
| `findGrade(g)` / `getGrade(g)` | 取某年级对象（`{grade, modules}`），不存在返回 `null` |
| `getEntries(subject, grade)` | 扁平化知识点数组 `[{id,name,pluginId,moduleId,weight,type}]` |
| `getCoverage(subject, grade, ids)` | 按插件 id 集合统计覆盖（total / covered / missing / next） |
| `coverageFromRegistry(subject, grade, registry)` | 自动从插件注册表提取覆盖并统计 |
| `suggestNext(subject, grade, coveredIds)` | 建议下一个应开发的插件 |

## 六、知识点详情页

`knowledge/` 下的静态页面由 `scripts/generate-knowledge-pages.js` 生成，命名与 ID 一致：

- 知识点详情页：`knowledge/{id}.html`（如 `knowledge/g4-c5-c5-meet.html`）。
- 模块聚合页：`knowledge/g{grade}-{moduleId}.html`（如 `knowledge/g4-m5.html`）。
- 全量索引页：`knowledge/knowledge-index.html`。

修改知识库后运行：

```bash
node scripts/generate-knowledge-pages.js   # 重新生成全部页面
node dev/verify-knowledge-bank.js          # 校验结构 / ID / 引用 / 难度 / status / 页面对应
```

## 七、一年级知识库结构（示例）

一年级共 **7 模块、20 个知识点**：

| 模块 | 知识点 id | 名称 | 插件 |
| --- | --- | --- | --- |
| M0 巧算专项 | `g1-m0-make-ten` | 凑十法 | math-make-ten |
| M0 | `g1-m0-make-ten-ping` | 平十法 | math-make-ten |
| M0 | `g1-m0-make-ten-po` | 破十法 | math-make-ten |
| M1 口算练习 | `g1-m1-addsub-20` | 20 以内加减法 | math-oral |
| M4 填空题 | `g1-m4-count` | 数数与顺序 | math-number-sense |
| M4 | `g1-m4-compose-digit` | 数的组成与数位 | math-number-sense |
| M4 | `g1-m4-compare` | 比大小 | math-number-sense |
| M4 | `g1-m4-clock-hour` | 认识钟表（整时） | math-clock |
| M4 | `g1-m4-patterns` | 找规律 | math-patterns |
| M4 | `g1-m4-money` | 认识人民币 | math-money |
| M6 操作题 | `g1-m6-solid-shapes` | 认识立体图形 | math-shapes |
| M6 | `g1-m6-flat-shapes` | 认识平面图形 | math-shapes |
| M6 | `g1-m6-shape-compose` | 图形拼组 | math-shapes |
| M6 | `g1-m6-position` | 上下左右位置 | math-shapes |
| M7 看图列式 | `g1-m7-picture-equations` | 看图列式 | math-picture-equations |
| M8 解决问题 | `g1-m8-chain-mixed` | 连加连减与加减混合 | math-word-problems |
| M8 | `g1-m8-solve-problems` | 解决问题 | math-word-problems |
| M9 分类与整理 | `g1-m9-classify` | 分类与整理 | math-statistics |
| M9 | `g1-m9-stats-table` | 填写简单统计表 | math-statistics |
| M9 | `g1-m9-pictograph` | 象形统计图 | math-statistics |

## 八、二年级知识库结构（示例）

二年级共 **6 模块、18 个知识点**：

| 模块 | 知识点 id | 名称 | 插件 |
| --- | --- | --- | --- |
| M1 口算练习 | `g2-m1-addsub-100` | 100 以内加减法 | math-oral |
| M1 | `g2-m1-muldiv` | 表内乘除法 | math-oral |
| M1 | `g2-m1-remainder` | 有余数除法 | math-oral |
| M1 | `g2-m1-mixed` | 混合运算 | math-oral |
| M4 填空题 | `g2-m4-readwrite` | 万以内数的读写 | math-number-sense |
| M4 | `g2-m4-compose-digit` | 数的组成与数位 | math-number-sense |
| M4 | `g2-m4-approx` | 近似数 | math-number-sense |
| M4 | `g2-m4-unit-convert` | 单位换算 | math-unit-convert |
| M4 | `g2-m4-fill-unit` | 填合适单位 | math-unit-convert |
| M6 操作题 | `g2-m6-shapes-2` | 认识图形 | math-shapes |
| M6 | `g2-m6-angles` | 角的初步认识 | math-geometry |
| M6 | `g2-m6-motion` | 图形的运动 | math-geometry |
| M6 | `g2-m6-grid` | 方格纸 | math-geometry |
| M8 解决问题 | `g2-m8-solve-problems` | 解决问题 | math-word-problems |
| M9 分类与整理 | `g2-m9-data-tally` | 数据收集与整理 | math-data-stats |
| M9 | `g2-m9-data-question` | 根据统计结果回答问题 | math-data-stats |
| M10 推理与数学广角 | `g2-m10-logic-reasoning` | 简单逻辑推理 | math-logic-reasoning |
| M10 | `g2-m10-sudoku3` | 3×3 数独 | math-logic-reasoning |

> 3–6 年级结构一致，可在 `shared/knowledge-bank.js` 中查看；完整清单亦见
> `knowledge/knowledge-index.html` 与 `knowledge/{id}.html`。

## 九、前置 / 关联引用规则（prerequisites / related）

- **允许低年级前置与同年级前置，禁止高年级前置**。高年级前置由
  `dev/verify-knowledge-bank.js` 报错阻断。
- 低年级前置表达「先修基础」；同年级前置表达年级内学习顺序（如模块内部递进），
  添加时需确认逻辑合理、无循环依赖。
- 校验脚本对同年级前置**仅警告、不阻断**，会单独计数并输出
  「同年级前置依赖 N 条，请确认是否符合教学顺序」，需定期人工复核。

## 十、难度系统（1-10 数值难度）

`practice.html` 设置面板含**难度输入框**（仅数学插件显示，1-10 整数，默认 3）。
用户填写的数值经 `state.difficulty` 传入各插件 `generate({ difficulty: n })`：

- **共享工具**（`shared/common.js` 的 `PluginUtil`）：
  - `diffLevel(d)`：归一化 1-10 整数，非法值回退 3；
  - `diffScale(level)`：缩放系数，level 1→0.8、3→1.0、5→1.4、8→2.0、10→2.4；
  - `diffMax(base, level)`：推荐最大数 = `round(base * diffScale(level))`。
- **接入约定**：每个数学插件在 `generate()` 开头读取
  `_DIFF = PluginUtil.diffLevel(opts.difficulty)`，用 `diffMax(base)` 缩放数值范围；
  逻辑深度随难度提升。
- **URL 参数**：支持 `practice.html?plugin=xxx&grade=4&difficulty=8&type=subtype`。
- **新增数学插件时必须**接入难度（至少用 `diffMax` 缩放数值范围）。

> 知识库知识点字段 `difficulty`（1/3/4/5）是**静态难度基线**，用于迁移与展示；
> 与练习页运行时难度（1-10）含义不同，勿混淆。

## 十一、插件 ↔ 知识点 对应关系

同一插件可承载多个知识点（通过 `type` / `difficulty` 区分）。插件在
`createPlugin` config 上声明 `knowledgePoints`：

```js
knowledgePoints: ['g1-m4-patterns'],                 // 格式①：单年级数组（id）
knowledgePoints: {                                    // 格式②：按年级区分（对象）
  4: ['g4-c1-c1-vertical', 'g4-c1-c1-horizontal'],
  5: ['g5-c1-c1-vertical', 'g5-c1-c1-horizontal']
}
```

- 工厂会在 `generate` 时校验声明的 id 是否已登记在对应年级知识库，未登记会
  `console.warn` 输出「缺失知识点清单」。
- 多年级插件（如竞赛 C1 覆盖 4/5/6 年级）**必须**用格式②，因为 ID 已含年级。
- 新增 / 修改知识点后同步 `knowledgePoints` 与 `weight`。

## 十二、覆盖检查与验证

```bash
node dev/coverage.js               # 各年级知识点覆盖基线（1-3 年级应 100%）
node dev/verify-knowledge-bank.js  # 结构 / 模块 / 插件 / ID / 引用 / 难度 / status / 页面
node dev/verify-setup.js           # 项目搭建与插件契约校验
node dev/check-core-integrity.js   # 核心文件完整性
```

覆盖率统计会自动排除占位插件（`isPlaceholder: true`）。

## 十三、AI 辅助生成新插件时的检查清单

1. `shared/module-catalog.js`：模块是否已登记（`Mx` / `Cx`）？
2. `shared/knowledge-bank.js`：对应年级模块下知识点是否已登记？`id` 是否符合
   `g{grade}-{module}-{baseSlug}` 命名规范且全局唯一？`pluginId` 是否唯一匹配？
3. `plugins/registry.js`：插件 id / file / grades / 占位标记是否注册？
4. 插件实现：是否满足 `plugins/CONTRACT.md` 契约（`generate/render/check`、
   category、grades、不用 `Math.random()`、不直接操作 DOM、接入难度）？
5. `knowledgePoints`：单年级用数组、多年级用按年级对象，声明与知识库 id 一致。
6. 综合练习：若需纳入 `math-comprehensive` 混合卷，确认插件可被
   `generate({grade,count})` 无参调用。
7. 运行 `node scripts/generate-knowledge-pages.js` 刷新详情页，并跑上节全部校验。
