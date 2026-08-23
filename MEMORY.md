# MEMORY.md — 项目关键状态备忘

> 供开发者 / AI 助手快速了解项目当前约定的「记忆」。任何与本文件冲突的旧约定以本文件为准。

## 知识点编号体系（2026-08-23 起启用）

**旧 ID → 新 ID 迁移已完成。** 现行知识点 ID 一律为三段式：

```
g{grade}-{moduleIdLower}-{baseSlug}
```

- 示例：`g1-m1-addsub-20`、`g4-c5-c5-meet`、`g6-m8-g6-app-frac-mult`。
- 全小写 + 数字 + 连字符；`moduleIdLower` 为模块小写（`m0`–`m12`、`c1`–`c9`）。
- **同主题跨年级 baseSlug 保持一致**（如 `c1-vertical` → `g4-c1-c1-vertical` / `g5-...` / `g6-...`）。
- slug 字典已归档：`archive/dead-code-20260823/knowledge-slug-map.js`（2026-08-23 归档，运行时零引用）。

**旧 ID（`addsub-20`、`g4-fill-line` 等）已废弃**，仅存于 `archive/migration-20260823/`。切勿再引入。

## 关键文件

- 知识库：`shared/knowledge-bank.js`（`[{grade, modules:[{moduleId, knowledgePoints}]}]`）
- 模块目录：`shared/module-catalog.js`（`M0`–`M12` + `C1`–`C9`）
- slug 字典：已归档至 `archive/dead-code-20260823/`（无运行时引用）
- 详情页：`knowledge/{id}.html`（生成脚本 `scripts/generate-knowledge-pages.js`）
- SVG 生成器层：
  - `shared/svg-core.js`（`SVGUtil`：元素/viewBox/svgWrap 基础设施）
  - `shared/svg-geometry.js`（`SVGGeometry`：平面图形+标注、立体图、变换叠加演示）
  - `shared/svg-calculation.js`（`SVGCalculation`：四则竖式，进/借位点与错误模式）
  - `shared/svg-make-ten.js`（`SVGMakeTen`：凑十/平十/破十三行彩色图解，无效组合返回 null）
- 难度解析层：`shared/difficulty.js`（`App.Difficulty`：difficultyToStructure/createProfile/
  consumeProfile；结构五档映射与严格单调 complexityScore，测试 `dev/test-difficulty-structure.js`）
- 验证：`dev/verify-knowledge-bank.js` / `dev/verify-setup.js` / `dev/check-core-integrity.js` / `dev/verify-svg.js`
- 迁移审计：`docs/migration-report.md`

## 知识点字段

`id / name / pluginId / weight / type / description / example / prerequisites / related / difficulty / status`

- `prerequisites` / `related`：允许低年级与同年级前置，**禁止高年级前置**（校验报错）。
- `difficulty`：基础模块 `1`；竞赛模块按年级 `3/4/5`。
- `status`：`'active'` 或 `'placeholder'`。

## 竞赛模块实现水位（2026-08-23）

- 五年级 C1~C9 全插件；六年级 C2/C3/C4/C5/C7/C8/C9 新语义插件已注册
  （`math-competition-g6-*`），深化/巩固类知识点大部分占位待逐轮激活。
- 旧式四/六年级竞赛插件收缩到四年级（grades:[4]）；仅服务六年级的
  c6-engineering、c7-fraction 已归档 `archive/superseded-plugins/`。

## SVG 生成器约定（详见 CONTRIBUTING.md「三点六·4」）

- 插件内禁止手写 `<svg>` 拼接，统一走 `SVGUtil/SVGGeometry/SVGCalculation/SVGMakeTen`；
- 输出即完整 `<svg>`（自带 viewBox），移动端/打印缩放由 `.scene-box svg { max-width:100% }` 规则兜底；
- 测试义务：`node dev/verify-svg.js` + 对应 `dev/test-svg-*.js` 必须通过。

## 常用命令

```bash
npm test                                    # 硬门禁：verify-setup + verify-knowledge-bank + regression-check
npm run check-duplicates                    # 重复率报告（非门禁，仅记录）
bash scripts/pre-commit.sh                  # 与 pre-commit 钩子相同的本地手动校验
node scripts/generate-knowledge-pages.js   # 再生成 knowledge/ 页面
node dev/verify-knowledge-bank.js          # 知识库结构/编号/引用校验
node dev/verify-setup.js                   # 项目搭建校验
node dev/check-core-integrity.js           # 核心文件完整性
node dev/cleanup-scan.js --dry-run         # 清理扫描（仅垃圾文件被标记）
node dev/prereq-review.js                  # 同年级前置依赖审查 CSV（建议每月）
```

## 提交自动化（零依赖）

- 版本化钩子：`scripts/githooks/pre-commit` → `scripts/pre-commit.sh`（跑 `npm test` 同一套）。
- 启用：`git config core.hooksPath scripts/githooks`（本地一次性配置）。
- CI：`.github/workflows/ci.yml` 在 push/PR 时运行 `npm test`，重复率报告非阻断。

## 竞赛模块实现状态（2026-08-23 更新）

- **五年级 C1~C9 已全部实现**：`math-competition-g5-c1` ~ `g5-c9` 各一个插件；
  仅少量知识点仍为占位（C1 复合数阵、C2×4、C3×3、C4×2、C5×3、C7×4、C9 植树/方阵/分数百分数应用）。
- **六年级新语义迁移已完成**：旧 slug 条目已替换为 `g6-c{m}-{slug}` 新体系（90 条，
  迁移脚本 `scripts/add-g6-competition-entries.js`）；已实现插件 `math-competition-g6-c2/c3/c4/c5/c7/c8/c9`
  （覆盖全部「新增」题型），深化/巩固类知识点大部分仍为占位待逐轮激活。
- **旧式四/六年级竞赛插件已收缩到四年级**：c1/c2/c3/c4/c5/c8 `grades:[4]`；
  c6-engineering、c7-fraction（仅六年级）退役归档于 `archive/superseded-plugins/`。
- 高频考点权重：五年级 C2 数论 / C4 几何模型 / C5 行程 知识点 weight=2。

## 测试与回归约定

- `dev/regression-check.js`：全插件满分回填回归，必须 100 分。
- `dev/test-difficulty.js`：难度系统回归。占位插件自动跳过；小题池插件
  （judge/reasoning/math-oral）重复断言仅记录不判失败；其余重复容忍线
  min(max(2, 20%), 12)。单输入名单题按整串键回填、余数除法按 idx:0/idx:1 回填。
- 根目录无 shared 公共文件副本；`pinyin-bank.js` 在根目录是 registry `deps` 约定路径，非冗余。
