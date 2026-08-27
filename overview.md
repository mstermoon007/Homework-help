# 项目代码与连接审查报告

> 审查日期：2026-08-23 · 仅修改建议，未修改任何文件
> **状态更新（2026-08-24）**：本报告所列问题已全部处置完毕（P0/P1/P2 逐项标注见下），
> 并在此基础上完成了「科目化改造」大版本演进与多项性能优化，详见文末
> 「六、架构变更与性能优化（2026-08-24）」。

---

## 一、总体健康度

| 维度 | 状态 | 说明 |
|------|------|------|
| verify-setup.js | ✅ 全通过 | 38 项检查全部通过 |
| 知识点覆盖 | ⚠️ 六年级 85% | 1-5 年级 100%，六年级 122/143 |
| 回归测试 | ✅ 全通过 | 123 个插件·年级组合，满分回填全 100 |
| Git 状态 | ❌ 168 个未提交 | 大量修改未提交 + 新文件未跟踪 |
| 连接器 | ℹ️ 无需连接 | 纯前端静态站，仅 agent-mail 已连接但与本项目无关 |

---

## 二、发现的问题与建议（按严重度排序）

### P0 — 高优先级

#### 1. Git：168 个未提交变更未跟踪 ✅ 已解决（V2.1→V3.0 分批入库，此后按任务粒度提交）
- **现状**：`git status` 显示 168 个变更，包括六年级全套插件（11 个 .js）、scripts/ 目录（5 个脚本）、shared/ 新文件（6 个 SVG/备份文件）、shared/base.css/components.css/pages.css 等核心 CSS 未提交
- **风险**：代码丢失、协作冲突、回滚困难
- **建议**：分批提交——先提交 shared/ 核心层，再提交 plugins/ 六年级插件，最后提交 scripts/ 和 docs/

#### 2. `poolFill` 使用 `Math.random()` 违反项目规则 ✅ 已解决（改用 randInt；另新增 dev/lint-check.js R1 规则静态拦截）
- **文件**：`shared/common.js` 第 172-174 行
- **现状**：
  ```js
  // Fisher-Yates shuffle
  for (var j = pool.length - 1; j > 0; j--) {
    var k2 = Math.floor(Math.random() * (j + 1));  // ← 应为 randInt(0, j)
  ```
- **规则**：`plugins/_template.js` 明确规定"随机数只用 PluginUtil（crypto 优先），禁止 Math.random()"
- **建议**：改为 `var k2 = randInt(0, j);`，与同文件的 `shuffle` 函数保持一致

#### 3. `sw.js` CORE 预缓存缺失新页面 ✅ 已解决（v61 补页面/SVG；后续随拆分追加知识库三分片与科目资源，当前 v80）
- **文件**：`sw.js` 第 15-39 行的 `CORE` 数组
- **缺失项**：
  - `subject-types.html`（chinese-types.html / english-types.html 都重定向到此页，离线时无法访问）
  - `faq.html`
  - `shared/svg-calculation.js`、`shared/svg-core.js`、`shared/svg-geometry.js`、`shared/svg-make-ten.js`（被竞赛插件引用）
- **建议**：将上述文件加入 `CORE` 数组，并升版本号（当前 `hw-help-v60` → `v61`）

### P1 — 中优先级

#### 4. `index.html` CSS 变量与 `shared/tokens.css` 完全脱节 ✅ 已解决（接入 tokens/base；批次3 后页面与插件内联主题色清零）
- **文件**：`index.html` 第 8-21 行
- **现状**：index.html 自定义了一套 `:root` 变量（`--brand-blue`、`--math-color`、`--chinese-color` 等），完全不引用 `shared/tokens.css` 的 `--brand`、`--ink`、`--bg` 等令牌
- **影响**：改 `tokens.css` 无法同步首页视觉；与架构目标"shared/ 为唯一公共来源"矛盾
- **建议**：将 index.html 改为引用 `shared/tokens.css` + `shared/base.css`，逐步用令牌替换硬编码颜色

#### 5. `math-competition-g5-c9` 声明了不存在的知识点 ✅ 已解决（补登 g6-c9-inclusion-exclusion；verify 第8条双向对齐强制化）
- **文件**：`plugins/math-competition-g5-c9.js`
- **现状**：在 6 年级声明覆盖 `g6-c9-inclusion-exclusion`，但 `shared/knowledge-bank.js` 中无此条目
- **影响**：每次运行 regression-check 产生 console.warn
- **建议**：在 knowledge-bank.js 六年级 C9 模块补充该知识点，或从插件 knowledgePoints 中移除

#### 6. 六年级竞赛知识点覆盖仅 85% ✅ 已解决（100%：激活 C2×7、C3×10、新建 C6、C8 补最值与逻辑推理）
- **现状**：21 个知识点（C2/C3/C6/C8 竞赛专题）仍由 `math-competition-placeholder` 兜底
- **建议**：按优先级开发 `math-competition-g6-c2`（数论）和 `math-competition-g6-c3`（组合计数）等插件

### P2 — 低优先级

#### 7. `shared/` 疑似死代码文件 ✅ 已解决（slug-map 键同步前缀后归档 archive/dead-code-20260823/；manual-backup 删除）
- `shared/knowledge-bank-manual-backup.js`：仅被 archive/ 迁移脚本引用
- `shared/knowledge-slug-map.js`：仅被自身和 archive/ 引用
- **建议**：确认无活跃引用后移至 archive/ 或删除

#### 8. `.venv/` Python 虚拟环境存在于纯前端项目
- **现状**：`.venv/` 已在 `.gitignore` 中，但物理目录仍占空间
- **建议**：若不再使用 Python 工具，可删除 `.venv/` 目录

#### 9. 5 个 `.DS_Store` 文件散落
- 路径：`./.DS_Store`、`./archive/.DS_Store`、`./docs/.DS_Store`、`./.venv/.DS_Store`、`./.workbuddy/.DS_Store`
- **建议**：执行 `find . -name ".DS_Store" -not -path "./.git/*" -delete`

#### 10. `check-duplicates.js` 变量遮蔽（已修复 2026-08-23）
- **文件**：`dev/check-duplicates.js`
- **处理**：已移除循环内重复声明的 `var grade`，统一使用外层声明

#### 11. `cleanup-scan.js` 白名单引用了不在注册表中的占位文件（已修复 2026-08-23）
- **处理**：`math-g4-placeholder.js`、`math-g5-placeholder.js` 经确认无任何注册/运行时引用，
  已从白名单与文件系统中移除；仅保留注册表在用的 `math-competition-placeholder.js`

---

## 二点五、架构变更与性能优化（2026-08-24 科目化大版本）

### 架构变更

| 层 | 变更 | 关键文件 |
|----|------|----------|
| 模块目录 | 每模块含 `subject` 字段；新增语文 N1–N8 / 英语 E1–E6 | shared/module-catalog.js |
| 知识库 | 按科目分组 `{math,cn,en}` + 双参查询 API；数据分片 knowledge-math/cn/en.js 按需加载 | shared/knowledge-bank.js |
| 知识点 ID | 强制科目前缀四段式；跨科目引用被 verify 拦截 | 同上 + dev/verify-knowledge-bank.js |
| 难度系统 | DifficultyProfiles 三科目参数映射 + strategyFor 路由 | shared/difficulty.js |
| 插件工厂 | createMathPlugin/createChinesePlugin/createEnglishPlugin（批改策略/网格类/difficultyParams 差异化） | shared/common.js |
| SVG 生成器 | SVGGenerators 命名空间；新增 cn（田字格/拼音格/笔顺/书写格）与 en（字母书写/单词卡/句子抄写） | shared/svg-*.js |
| 工具归类 | MathUtil/ChineseUtil/EnglishUtil 独立全局（normPY/normHZ 废弃别名委托） | shared/subject-utils.js |
| 样式令牌 | 科目三色 --math/cn/en-primary·secondary·accent + 书写格五变量；旧名别名化联动 | shared/tokens.css |

### 性能优化

- **图片**：banner.jpg(48KB) → assets/banner.webp(16.7KB, -65%)；四枚 logo PNG(合计 ~222KB)
  → 128px WebP(合计 ~13.6KB, -94%)；全部 `<img>` 补 width/height 防 CLS，
  中屏图标加 loading="lazy"，hero 预加载升级 fetchpriority="high"
- **渲染**：practice.html 布局判定不再对每题二次完整渲染（50 题省 ~100 次 render 调用，
  布局阶段实测 1.84ms→0.43ms）；回车监听改事件委托单次绑定
- **加载**：知识库分片按科目懒加载（语文/英语/练习页不再首屏拉取数学全量 ~250KB）；
  Service Worker 升级 stale-while-revalidate（缓存秒回 + 后台静默更新），v80
- **质量门禁**：npm test 六道（新增 lint-check 与 test-difficulty/verify-svg 入链），
  pre-commit.sh 四步快速失败；回归含 255 项边界用例与分科目满分报告

---

## 三、连接器状态

| 连接器 | 状态 | 与本项目关系 |
|--------|------|-------------|
| agent-mail | ✅ 已连接 | 无直接关系 |
| 其余全部 | ❌ 未连接 | 纯前端静态站，无需外部服务 |

**结论**：本项目为纯前端静态 Web 应用（HTML + CSS + JS），无后端、无 API 调用、无外部数据依赖，当前连接器状态正常，无需额外连接。

---

## 四、建议的提交顺序

若开始提交，建议按以下顺序分批提交：

1. **shared/ 核心层**：tokens.css、base.css、components.css、pages.css、common.js、print.js 及新增 SVG 文件
2. **plugins/ 六年级**：11 个 g6 插件 + 修改过的 registry.js
3. **scripts/ 工具**：5 个新增脚本
4. **docs/ 和页面**：index.html、math-types.html、subject-types.html 等页面更新
5. **sw.js**：升版本号 + 补充 CORE
6. **清理**：删除 .DS_Store、移除死代码文件

---

## 五、开发规范速查（详情见根目录 CONTRIBUTING.md）

**随机数**：运行时禁止直接 `Math.random()`；整数用 `PluginUtil.randInt(min, max)`（crypto 优先），
乱序用 `shuffle(arr)`，取元素用 `rand(arr)`；禁止 `sort(() => Math.random()-0.5)` 偏偏差洗牌。

**样式令牌**：颜色/圆角/阴影/渐变一律用 `shared/tokens.css` 变量（`--brand/--ink/--muted/--line/
--math/--chinese/--english/--ok/--bad` 等）；插件优先 `renderCard()` + 类名，内联样式必须写
`var(--xxx)`；SVG 表现属性（fill/stroke）不支持 var()，保留字面量。

**知识库同步**：插件声明 `knowledgePoints` 必须在 `knowledge-bank.js` 有对应年级条目，
反向 pluginId 必须已注册；ID 四段式 `{subject}-g{grade}-{module}-{slug}`（math/cn/en 前缀强制，跨科目引用拦截）；
slug 字典已归档（`archive/dead-code-20260823/`），无需登记。违规由
`dev/verify-knowledge-bank.js` 第 8 条非零退出拦截。

**提交门禁**：pre-commit 钩子自动跑 `npm test`（lint-check → verify-setup → verify-knowledge-bank →
regression-check 含边界用例 → test-difficulty → verify-svg，共 6 道）；启用方式 `git config core.hooksPath scripts/githooks`；
CI（`.github/workflows/ci.yml`）在 push/PR 重跑同一门禁，重复率报告非阻断。
