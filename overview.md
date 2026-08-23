# 项目代码与连接审查报告

> 审查日期：2026-08-23 · 仅修改建议，未修改任何文件

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

#### 1. Git：168 个未提交变更未跟踪
- **现状**：`git status` 显示 168 个变更，包括六年级全套插件（11 个 .js）、scripts/ 目录（5 个脚本）、shared/ 新文件（6 个 SVG/备份文件）、shared/base.css/components.css/pages.css 等核心 CSS 未提交
- **风险**：代码丢失、协作冲突、回滚困难
- **建议**：分批提交——先提交 shared/ 核心层，再提交 plugins/ 六年级插件，最后提交 scripts/ 和 docs/

#### 2. `poolFill` 使用 `Math.random()` 违反项目规则
- **文件**：`shared/common.js` 第 172-174 行
- **现状**：
  ```js
  // Fisher-Yates shuffle
  for (var j = pool.length - 1; j > 0; j--) {
    var k2 = Math.floor(Math.random() * (j + 1));  // ← 应为 randInt(0, j)
  ```
- **规则**：`plugins/_template.js` 明确规定"随机数只用 PluginUtil（crypto 优先），禁止 Math.random()"
- **建议**：改为 `var k2 = randInt(0, j);`，与同文件的 `shuffle` 函数保持一致

#### 3. `sw.js` CORE 预缓存缺失新页面
- **文件**：`sw.js` 第 15-39 行的 `CORE` 数组
- **缺失项**：
  - `subject-types.html`（chinese-types.html / english-types.html 都重定向到此页，离线时无法访问）
  - `faq.html`
  - `shared/svg-calculation.js`、`shared/svg-core.js`、`shared/svg-geometry.js`、`shared/svg-make-ten.js`（被竞赛插件引用）
- **建议**：将上述文件加入 `CORE` 数组，并升版本号（当前 `hw-help-v60` → `v61`）

### P1 — 中优先级

#### 4. `index.html` CSS 变量与 `shared/tokens.css` 完全脱节
- **文件**：`index.html` 第 8-21 行
- **现状**：index.html 自定义了一套 `:root` 变量（`--brand-blue`、`--math-color`、`--chinese-color` 等），完全不引用 `shared/tokens.css` 的 `--brand`、`--ink`、`--bg` 等令牌
- **影响**：改 `tokens.css` 无法同步首页视觉；与架构目标"shared/ 为唯一公共来源"矛盾
- **建议**：将 index.html 改为引用 `shared/tokens.css` + `shared/base.css`，逐步用令牌替换硬编码颜色

#### 5. `math-competition-g5-c9` 声明了知识库不存在的知识点
- **文件**：`plugins/math-competition-g5-c9.js`
- **现状**：在 6 年级声明覆盖 `g6-c9-inclusion-exclusion`，但 `shared/knowledge-bank.js` 中无此条目
- **影响**：每次运行 regression-check 产生 console.warn
- **建议**：在 knowledge-bank.js 六年级 C9 模块补充该知识点，或从插件 knowledgePoints 中移除

#### 6. 六年级竞赛知识点覆盖仅 85%
- **现状**：21 个知识点（C2/C3/C6/C8 竞赛专题）仍由 `math-competition-placeholder` 兜底
- **建议**：按优先级开发 `math-competition-g6-c2`（数论）和 `math-competition-g6-c3`（组合计数）等插件

### P2 — 低优先级

#### 7. `shared/` 疑似死代码文件
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
