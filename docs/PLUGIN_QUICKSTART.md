# 插件快速上手：10 分钟写出一个题型插件

> 目标读者：第一次给 Homework Help 贡献题型插件的新开发者 / AI 助手。
> 读完本文你应能 **用脚手架生成骨架 → 实现生成逻辑 → 注册 → 跑通校验 → 本地预览**，全程命令可直接复制。

本项目的核心契约（生成 / 渲染 / 批改接口、科目工厂、难度系统）以
[`shared/plugin-types.js`](shared/plugin-types.js) 与 [`docs/API.md`](docs/API.md) 为权威定义；
本文是「能跑起来」的最小路径，细节以契约文档为准。

---

## 1. 准备环境

- **Node.js ≥ 16**（推荐 20+；仅用于脚手架与本地校验，运行时不依赖 Node）。
- 克隆仓库，**无需 `npm install`**（零运行时依赖，脚手架/校验脚本均为内置模块）：

```bash
git clone <仓库地址> homework-help
cd homework-help
node -v            # 确认 >= 16
```

---

## 2. 用脚手架生成插件骨架

脚手架 [`scripts/new-plugin.js`](scripts/new-plugin.js) 会一次性产出三样东西：
1. `plugins/<id>.js` —— 插件骨架（基于 `createPlugin` 工厂，你只需填 `generateQuestions`）；
2. `plugins/registry.js` —— 追加一条注册记录；
3. （仅数学）`shared/knowledge-bank.js` —— 在指定年级 / 模块下追加知识点条目。

以「两位数加法」为例（一年级数学，归属模块 M1 口算）：

```bash
node scripts/new-plugin.js math-add2 "两位数加法" 1 \
  --subject math --category number --module M1 \
  --kp math-g1-m1-addsub-20 \
  --desc "两位数不进位加法练习"
```

参数速查：

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `<id>` | 插件唯一标识，建议 `<subject>-<topic>` | `math-add2` |
| `<name>` | 展示名称（给学生/家长看） | `"两位数加法"` |
| `<grades>` | 适用年级，逗号分隔 | `1` 或 `1,2` |
| `--subject` | `math`/`chinese`/`english`（缺省按 id 前缀推断） | `math` |
| `--category` | 数学领域 `number`/`geometry`/`statistics`/`mixed` | `number` |
| `--module` | 知识点归属模块 ID（M0–M12，仅数学必填） | `M1` |
| `--kp` | 声明覆盖的知识点 id（对应 knowledge-bank 条目） | `math-g1-m1-addsub-20` |
| `--desc` | 一句话描述 | `"两位数不进位加法练习"` |
| `--dry-run` | 仅预览不写盘 | — |

> 加 `--dry-run` 先看看会生成什么；确认无误再去掉重跑。
> 生成的骨架已经能用（默认是随机加法），但我们要把它改成「两位数加法」。

---

## 3. 实现三个核心方法（以两位数加法为例）

打开 `plugins/math-add2.js`，找到 `generateQuestions(opts)`，改成：

```js
function generateQuestions(opts) {
  var grade = opts.grade || 1;
  var count = opts.count || 10;
  var questions = [];
  for (var i = 0; i < count; i++) {
    // 用 PluginUtil.randInt 取随机源（crypto 安全随机，禁止直接用 Math.random）
    var a = PU.randInt(10, 99);   // 两位数
    var b = PU.randInt(10, 99);
    questions.push({
      q: a + ' + ' + b + ' = ?',
      answer: String(a + b)      // 答案必须是字符串或可序列化值
    });
  }
  return questions;
}
```

### 关于 render / check

- **数学插件默认 `render` 走 `renderCard` 网格卡片，`check` 走数值比较**——大多数题型**不用写**这两方法。
- 需要自定义卡片？在题上加 `render(idx)`：
  ```js
  questions.push({
    q: a + ' + ' + b,
    answer: String(a + b),
    render: function (idx) { return PluginUtil.renderCard(this, idx); }
  });
  ```
- 主观/多选/多空题：在题上加 `check(userAnswers, idx)` 返回 `{ correct, correctAnswer }`；
  或利用 `inputType: 'choice'` + `options` 让工厂自动处理选择题。

### 难度消费（可选但推荐）

科目工厂在调用 `generateQuestions` 前注入了 `opts.difficultyParams`（由
`App.Difficulty.paramsFor` 计算）。想让题目随难度变化，直接读它：

```js
var p = opts.difficultyParams;   // { level, scale, steps, allowBracket, ... }
var hi = 10 + p.level * 10;      // 难度越高数字越大
var a = PU.randInt(10, hi);
```

---

## 4. 注册插件

脚手架已自动往 `plugins/registry.js` 追加了条目，无需手改。
若手动新增，确保该文件里有一条：

```js
{ id: 'math-add2', file: 'plugins/math-add2.js', name: '两位数加法',
  subject: 'math', category: 'number', grades: [1] },
```

> `scripts/verify-registry.js` 会校验「注册条目 ↔ 实际插件文件」一一对应，缺注册或字段错配会阻断提交。

---

## 5. 运行校验

```bash
npm test                 # 门禁：lint / verify-setup / 知识库 / 回归 / 难度 / SVG / registry
npm run check-lint       # 只看代码规范（最快反馈）
npm run check:registry   # 只看注册表一致性
npm run test:node        # 插件生成 + 核心函数 Node 单测（task 4.1/4.2/4.3）
```

`check-lint` 关键规则（详见 `dev/lint-check.js`）：
- **R1** 禁止运行时直调 `Math.random()` —— 一律用 `PluginUtil.randInt` / `shuffle`；
- **R2** 禁止硬编码颜色 —— 一律用 `var(--*)` 设计令牌（SVG `fill`/`stroke`、纯白 `#fff`、阴影色除外）；
- **R3** 数学插件必须声明 `moduleId`；
- **R4** 知识点 id 必须有科目前缀（`math-`/`cn-`/`en-`）。

---

## 6. 本地预览

项目是纯静态站点，起任意静态服务器即可：

```bash
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/dev/plugin-check.html
```

在 `dev/plugin-check.html` 里加载 `plugins/math-add2.js`，确认：
- 能生成题目、卡片渲染正常；
- 手动批改能判对错；
- 换年级 / 难度档位题目有变化。

（也可用 `node dev/coverage.js` 看分科目覆盖报告。）

---

## 7. 常见注意事项（避免踩坑）

1. **随机源**：只用 `PU.randInt(min, max)` / `PU.shuffle(arr)`。直接用 `Math.random()` 会触发 R1 报错。
2. **颜色**：只用 `tokens.css` 里的 `var(--*)` 令牌；新增配色先入 `components.css`/`tokens.css`。
3. **知识库同步**：数学插件若声明 `knowledgePoints`，对应 id 必须已在
   `shared/knowledge-bank.js` 的该年级模块中登记（脚手架已处理；手写时别忘了，否则 verify-setup 会警告）。
4. **禁止全局 DOM 操作**：`generateQuestions` 等逻辑函数里不要碰 `document`/`window`——
   渲染/绑定事件只在 `render`/`check` 或页面层做。
5. **答案类型**：`answer` 建议为字符串；多接受答案用 `|` 分隔（英语工厂忽略大小写）。
6. **难度系统**：消费 `opts.difficultyParams`，不要自己硬编码难度档位。

---

## 8. 提交前检查清单

- [ ] 已用脚手架生成并注册（或 `plugins/registry.js` 已含本插件条目）
- [ ] `generateQuestions` 返回 `{ q, answer, ... }` 数组，无空题 / 字段缺失
- [ ] 未直调 `Math.random()`，未硬编码颜色
- [ ] 数学插件有 `moduleId`，知识点 id 已在知识库登记
- [ ] `npm test` 全绿（或至少 `check-lint` + `check:registry` 通过）
- [ ] `dev/plugin-check.html` 本地预览生成 / 渲染 / 批改正常
- [ ] 语文/英语数据改动后额外跑了 `node dev/verify-language-banks.js`

完成以上即可提交 PR。更完整的接口契约见 [`docs/API.md`](docs/API.md) 与
[`shared/plugin-types.js`](shared/plugin-types.js)；架构与修改禁区见
[`docs/AI_DEV_GUIDE.md`](docs/AI_DEV_GUIDE.md)。
