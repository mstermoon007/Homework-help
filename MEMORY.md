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

## CSS 令牌迁移（2026-08-24 完成）

- 页面层与插件层内联样式主题色已全部迁移 tokens.css 变量（批次1/2 + 2026-08-24 批次3，
  共替换约 340 处）。
- 新增令牌：`--brand-bg`(#eef3fb 题号徽章浅底) / `--soft-bg`(#fafbff 输入框近白软底，
  吸收 fafafa/f8fafd) / `--line-strong`(#c9d4e6 可交互边框，吸收 ccc/d5dff0/d5dde9/c3ccd8-border)。
- 属性感知映射：同色值按属性分流（#c3ccd8 color→muted / border→line-strong；
  #fff 仅 background→card，color:#fff 白字保留字面量）。
- **保留字面量豁免清单**（内容插画/科目装饰色，非主题角色）：拼音红粉 #f5576c、
  楷体绿 #10ac84、钱币金 #b8860b/#fdf3e3、数独空格底 #fffbe8、占位强调橙 #e8870a、
  划去标记红 #e74c3c、英语字母卡绿 #4caf50、米黄底 #fffdf6/#fef0e8 及 SVG 表现属性
  （fill=/stroke= 与纯 fill/stroke 内联样式）。新增装饰色请沿用此豁免口径。

## SVG 生成器约定（详见 CONTRIBUTING.md「三点六·4」）

- 插件内禁止手写 `<svg>` 拼接，统一走 `SVGUtil/SVGGeometry/SVGCalculation/SVGMakeTen`；
- 输出即完整 `<svg>`（自带 viewBox），移动端/打印缩放由 `.scene-box svg { max-width:100% }` 规则兜底；
- 测试义务：`node dev/verify-svg.js` + 对应 `dev/test-svg-*.js` 必须通过。

## 难度系统 v2（2026-08-24 起启用）

- **解析层**：`shared/difficulty.js`（`App.Difficulty`）——`consume(options)` 为插件唯一
  难度入口（自带 `level` 分档时 hasOwnLevel=true，通用难度不叠加）；
  `difficultyToStructure` 五档结构映射；`createProfile`/`consumeProfile` 供细分消费。
- **Adaptive 存储 v2**：`localStorage['hw_adaptive_v2']`，桶 `{ ema, sessions }`；
  主键 `(subject:grade:pluginId[:kpId])`，凡携带 kpid 的会话建 KP 桶（MAX_KEYS=400 保护）；
  首次读取自动迁移并清除 `hw_adaptive_v1`。
- **统计**：难度加权正确率 `Σ答对难度/Σ全部难度`（context 平行数组
  `questionDifficulties`+`correctFlags`）；EMA 平滑 `emaRate=0.4×本次+0.6×上次`；
  规则基于 (emaRate,lastRate)：≥0.85 且全对 +2 / ≥0.8 +1 / ≤0.5 −2 / ≤0.65 −1。
- **采集**：Question 可选字段 `knowledgePointId/difficulty`；
  practice.html 批改后走 `recordSession(questions, flags)`（插件级加权摘要 + KP 分组）。
- **综合练习**：kb 组卷按 KP 统计薄弱加权（<0.7 ×1.5）、极薄弱（<0.5）降档、
  薄弱前置注入 2 题/上限 ⌈count×30%⌉（`__prereqFor` 标记）。
- **步骤7（2026-08-24）批次迁移 + KP 标注扩量**：
  - 一~三年级基础插件全部迁移 `App.Difficulty.consume`（pattern/make-ten/picture-eq/
    number-sense/money/statistics/area/decimal/fraction/geometry/shapes/unit-convert/
    data-stats/logic-reasoning，共 14 个），统一 `_DIFF = prof.effectiveLevel` 保持内部
    读法不变；题目标注 `q.difficulty`。
  - KP 标注扩量至上述插件：子题型→知识点映射表（按年级区分），仅标注本插件在
    knowledge-bank 中登记的 KP；无对应 KP 的组合不标注（保持纯插件级统计）。
  - math-word-problems 为自带 level 分档插件，按规范跳过通用消费，仅补 KP 标注
    （模板 `_resolveTemplate` 回传 `cat` 供分桶映射）。
  - 迁移插件合计 18 个（含步骤4 的 4 个）；竞赛类插件保留自身难度基线，未迁移。
  - `dev/test-difficulty.js` 增步骤7回归块（批次插件的难度透传/KP 合法性断言 +
    word-problems 分档语义）；修复 dedupe 键漏 `q.q` 字段导致的重复误报
    （g6-matching/g5-oral 曾被误判），均值断言大样本化抗抖动；sw.js 升 v63。
- 相关测试：`dev/test-difficulty.js`（含步骤6/7回归块）、`dev/test-difficulty-structure.js`、
  `dev/test-adaptive.js`、`dev/test-adaptive-e2e.js`、`dev/test-comprehensive-adaptive.js`。

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
