# PluginUtil / App 工具 API 速查

> 来源：`shared/common.js`。插件内通过 `PluginUtil.*` 调用；
> dev/ Node 脚本 `require('../shared/common.js')` 复用同一实现。

## 随机数（批次1规范：运行时禁止直接 Math.random()）

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `randInt` | `(min, max) → int` | 闭区间整数随机；crypto.getRandomValues 优先，Math.random 兜底（唯一豁免位置） |
| `shuffle` | `(arr) → arr'` | Fisher-Yates 洗牌，返回**新数组**不改原数组；禁止 sort 随机比较器 |
| `rand` | `(arr) → item` | 从数组等概率取一个元素 |

概率判断约定：`randInt(0, 1) === 0`（50%）、`randInt(1, 100) <= p`（p%）。

## 难度系统

| 函数/对象 | 签名 | 说明 |
| --- | --- | --- |
| `diffLevel` | `(d) → 1..10` | 归一化难度，非法回退 3 |
| `diffScale` | `(level) → number` | 缩放系数 `1+(level−3)×0.2`（3→1.0、10→2.4） |
| `diffMax` | `(base, level) → int` | 基准最大数 × scale |
| `App.Difficulty.difficultyToStructure` | `(level) → {steps, allowBracket, allowMultDiv, complexityScore, …}` | 难度→结构五档映射；complexityScore 全档严格单调（测试 dev/test-difficulty-structure.js） |
| `App.Difficulty.createProfile` | `(baseLevel, delta, opts?) → profile` | 合并用户选择/自适应/插件选项 → `{effectiveLevel, scale, structure, typePreference}` |
| `App.Difficulty.consumeProfile` | `(profile, pluginType) → params` | 按插件类型（expression/geometry/application/oral/默认）翻译为生成参数 |
| `App.Difficulty.consume` | `(options) → profile + hasOwnLevel` | 插件统一难度入口（任务4）：自带 level 分档时 hasOwnLevel=true，通用难度不叠加 |
| `App.Difficulty.profileFor / paramsFor / strategyFor` | `(subject[, level, delta]) → …`（任务10） | 科目档案路由（chinese/english 归一 cn/en，未知回落 math）；paramsFor 输出科目生成参数（cn：vocabTier/sentenceLength…，en：wordLengthMax/grammarTier…）；strategyFor 供按科目取难度调整规则 |

## 渲染与工厂

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `renderCard` | `(q, idx, opts?) → HTML` | 标准题目卡片；样式全部走 shared/components.css 类 + tokens 变量 |
| `createPlugin` | `(config) → plugin` | 插件工厂：包装 generate/render/check、注册 moduleId、校验 knowledgePoints；声明以 `plugin.declaredKnowledgePoints` 暴露供静态校验 |
| `createMathPlugin` | `(config) → plugin` | 任务11：预设 subject='math'、数值比较批改、`math-grid/card` 类、自动注入 `opts.difficultyParams` |
| `createChinesePlugin` | `(config) → plugin` | 预设 'chinese'；标准化批改（空白/全角/尾部句读归一）；`cn-grid/card`；难度消费 cn |
| `createEnglishPlugin` | `(config) → plugin` | 预设 'english'；拼写批改（大小写不敏感 + `\|` 多答案）；`en-grid/card`；难度消费 en |
| `SUBJECT_FACTORY_DEFAULTS` | 对象 | 三科目工厂预设表（gridClass/cardClass/checkAnswer/difficultySubject） |

## SVGGenerators（shared/svg-*.js，任务7–9）

| 命名空间 | 成员 | 说明 |
| --- | --- | --- |
| `SVGGenerators.core` | =SVGUtil | 基础元素/computeViewBox/svgWrap；全局旧名 SVGUtil 保留同引用 |
| `SVGGenerators.math.geometry / calculation / makeTen` | 同全局旧名 | 平面立体图形+标注 / 四则竖式 / 凑十三法图解 |
| `SVGGenerators.cn` | `hanziGrid(char,'tian'\|'mi')` · `pinyinGrid(syllable)` · `strokeOrder(char)` · `sentenceLine(text)` | 田/米字格汉字、四线三格拼音、内置10字笔顺演示、书写格；格线颜色消费 tokens 的 --grid-tianzige-* 与 --grid-fourline-* 变量；非法输入返回 null |
| `SVGGenerators.en` | `letterWriting(letter,'upper'\|'lower')` · `wordCard(word, phonetic?)` · `fourLineWriting(text)` | 单字母四线三格（case 可省略推断）、单词卡（词+音标+抄写区）、句子抄写条（≤28 字符）；格线消费 --grid-fourline-* |

SVG 统一出口：`App.SVGRenderer.render(graphic, options)`（见 shared/presentation/svg-registry.js），
`graphic` 为结构化描述 `{ type, subtype, params }`；SVG 生成器模块（shared/svg-core / svg-geometry /
svg-calculation / svg-make-ten / svg-chinese / svg-english）在页面 boot 阶段挂载到 `SVGGenerators` 命名空间，
并注入 `SVGRenderer`。插件脚本加载用 `App.PluginLoader.loadSubjectPlugins(subject, grade)`。

## SubjectUtils（shared/subject-utils.js，任务12）

| 工具 | 代表成员 | 说明 |
| --- | --- | --- |
| `MathUtil` | `rangeByLevel(base,level)` · `gcd/lcm/reduce/add/sub/mul/div/format(f)` · `filterOperators/pickOperator` | 数值范围、分数运算（除零返回 null）、运算符筛选抽取 |
| `ChineseUtil` | `normPY/normHZ/normalizeHanzi` · `compareGlyph(a,b)` · `TONE_MAP` | 拼音归一、汉字标准化、字形比较（易混组：己已巳/未末…）；PluginUtil.normPY/normHZ 为 @deprecated 别名 |
| `EnglishUtil` | `normalizeWord/wordCase(mode)` · `normalizePhonetic/samePhonetic` | 大小写与空白归一、首字母大写、音标剥斜杠与等值比较 |

## 样式令牌要点

- 唯一来源：`shared/tokens.css`（@layer 锁定 tokens → base → components → toolbar → pages）。
- 内联样式颜色必须写 `var(--ink)` 等；SVG 表现属性（`fill=`/`stroke=`）不支持 var()，
  保持字面量或改写在 style 属性上。
