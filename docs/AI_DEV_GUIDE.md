# AI 开发指南（AI_DEV_GUIDE）

> 面向 AI 助手与新接入开发者的速查手册：项目是什么、哪些不能碰、怎么按规矩加东西。
> 规范细节以 `CONTRIBUTING.md`（贡献指南）与 `plugins/CONTRACT.md`(插件契约) 为准，
> 本文件只做导航与红线汇总。**任何与本文件冲突的旧约定，以 CONTRIBUTING/CONTRACT 为准。**

---

## 一、项目架构摘要（30 秒版）

纯前端静态站：HTML + CSS + JS，**无构建工具、无后端、无框架、无 npm 运行时依赖**。
数学覆盖 1–6 年级（含竞赛 C1–C9），语文/英语目录已建、内容逐轮填充。

```
页面层    index.html · {math,cn,chinese,english}-types.html · subject-types.html
          practice.html（统一练习宿主）· faq.html
            │ 按需加载
共享层    shared/common.js（PluginUtil + App.PluginLoader）
          shared/difficulty.js（App.Difficulty：Profiles×3 / paramsFor / strategyFor）
          shared/knowledge-bank.js（{ math:[年级…], cn:[…], en:[] } 按科目分组）
          shared/module-catalog.js（SUBJECTS；M0–M12/C1–C9=math，N1–N8=cn，E1–E6=en）
          shared/svg-*.js（SVGGenerators：core / math.geometry|calculation|makeTen / cn / en）
          shared/subject-utils.js（MathUtil / ChineseUtil / EnglishUtil）
          shared/tokens.css（设计令牌唯一来源，含科目三色与书写格变量）
插件层    plugins/*.js × 86 + registry.js（静态索引，deps 依赖链）
数据      knowledge/*.html（由 scripts/generate-knowledge-pages.js 生成的静态详情页）
验证      dev/*（verify-setup / verify-knowledge-bank / regression-check /
                test-difficulty / verify-svg / coverage …）
```

**科目代码**：ID 前缀用 `math / cn / en`；registry 的 plugin.subject 用全称
`math / chinese / english`——两套口径在 API 层已自动归一，勿手工转换。

### 数据层科目化要点

- 知识点 ID：`{subject}-g{grade}-{module}-{slug}`，如 `math-g1-m1-addsub-20`、
  `cn-g1-n1-pinyin-basic`、`en-g3-e1-letter-recognition`。**前缀强制**，
  跨科目引用（prerequisites/related）会被 verify-knowledge-bank 报错拦截。
- 难度调整策略经 `App.Difficulty.strategyFor(subject)` 路由（按科目取调整规则）。

### 插件接口（三大件不可变）

```js
generate(options) → { questions, meta }   // options 含 grade/count/type?/difficulty?/difficultyParams?
render(exerciseSet) → html 字符串          // 只拼字符串，禁止碰 DOM
check(exerciseSet, userAnswers) → CheckResult
```

Question 可选字段：`knowledgePointId`、`difficulty`（用于知识点关联与难度说明）。

---

## 二、修改禁区（硬性红线）

1. **不要改 `module-catalog.js` 的结构约定**：subject/prefix 对应关系（M/C→math、N→cn、
   E→en）与 ID 唯一性是全链路校验的锚点；新增模块走数组追加，不改导出形态。
2. **不要引入构建工具/框架/npm 运行时依赖/后端**。所有脚本零依赖双环境
   （浏览器 `<script>` + Node `require`）。
3. **不要破坏纯前端与隐私原则**：不引入账号体系、不上传用户数据、
   插件不读写 localStorage（状态/难度由 common.js 统一管理）。
4. **不要绕过统一随机**：运行时禁止 `Math.random()` 直调，一律 `PluginUtil.randInt/shuffle/rand`。
5. **不要手写 SVG 拼接**：图形一律走 SVGGenerators 各科目生成器；颜色常量见
   SVG_DEFAULTS 与各文件头；书写格辅助线消费 tokens.css 变量。
6. **不要在插件里操作 DOM / 注入全局样式**，渲染只返回 HTML 字符串。
7. **不要让根目录出现公共文件副本**：shared/ 是唯一来源；新公共能力进 shared/ 并入白名单。
8. **不要再引入旧知识点 ID**（`g1-m4-patterns` 这类无科目前缀格式已废弃）。

---

## 三、标准开发流程（新增一个题型）

以「数学·五年级·新计算题型」为例（语文/英语同构，换工厂与模块即可）：

1. **建插件**：复制 `plugins/_template.js` → `plugins/math-g5-mytype.js`，
   用 `PluginUtil.createMathPlugin({ id, name, grades:[5], moduleId:'M2', … })`
   实现 `generateQuestions(opts)`（语文换 `createChinesePlugin` + N 系模块；
   英语换 `createEnglishPlugin` + E 系模块）。
2. **注册**：`plugins/registry.js` 追加
   `{ id, file, name, subject, grades, moduleIds:['M2'] }`。
3. **知识库**：`shared/knowledge-bank.js` 对应科目对应年级的模块下登记知识点
   （ID 三段式带科目前缀 + weight/type/status），并在插件的
   `knowledgePoints` 声明中回填相同 ID（双向对齐，verify 强制）。
4. **详情页**：`node scripts/generate-knowledge-pages.js` 再生成静态页。
5. **验证**：
   ```bash
   node dev/verify-setup.js             # 结构/文件/可加载性
   node dev/verify-knowledge-bank.js    # 知识库+声明对齐（--g4 --g5 专项另测）
   node dev/regression-check.js         # 全插件满分回归（分科目报告）
   node dev/test-difficulty.js          # 难度系统（含按科目策略）
   node dev/verify-svg.js               # SVG 生成器结构（三科目）
   ```
   或一把梭：`npm test`（前三项门禁）＋ 后两项单独跑。
6. **缓存**：改动被 SW 预缓存的文件（HTML/shared/plugins）必须升 `sw.js` 的 CACHE 版本号。
7. **提交**：启用钩子后 commit 自动跑 `npm test`；信息风格
   `feat|fix|refactor|docs|chore：中文摘要`。

---

## 四、常用命令速查

```bash
npm test                                  # 门禁：verify-setup + verify-knowledge-bank + regression + test-difficulty + verify-svg
node dev/coverage.js                      # 分科目知识点覆盖率报告（cn/en 有数据自动纳入）
node scripts/generate-knowledge-pages.js # 再生成 knowledge/ 静态详情页
node dev/prereq-review.js                 # 同年级前置依赖人工复核 CSV（建议每月）
node dev/verify-language-banks.js       # 语文/英语库专项：ID格式·词库引用·循环依赖·难度递进
bash scripts/pre-commit.sh                # 手动执行与钩子相同的校验
```

## 五、验证矩阵（谁拦什么）

| 工具 | 拦截内容 |
| --- | --- |
| verify-setup | 目录/核心文件缺失、catalog 科目字段与数量、KB={math,cn,en} 结构、subject-utils/difficulty 可加载性 |
| verify-knowledge-bank | KP ID 格式（科目前缀）、跨科目引用、模块 subject 与 ID 前缀一致性、声明↔知识库双向对齐、详情页一一对应 |
| regression-check | 全插件×年级组合生成/渲染/满分回填（124 组合），分科目汇报 |
| test-difficulty | 结构单调、consume 行为、KP 标注合法性、三科目策略路由与参数映射 |
| verify-svg | 三科目全部生成器输出结构（svg 头/viewBox/无 NaN 泄漏） |

## 六、文档地图

- 贡献规范（单一来源）：根目录 `CONTRIBUTING.md`（docs/ 下是指针页）
- 插件契约：`plugins/CONTRACT.md`
- API 速查：`docs/API.md`
- 知识库背景：`docs/knowledge-base.md` · 迁移史：`archive/` 与 `docs/migration-report.md`
- 关键状态备忘：`MEMORY.md`（每次大改造后更新）
