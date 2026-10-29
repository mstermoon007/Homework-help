# P43 Change Log

> 打印排版收口日志（append-only，最新在上）。
> 基线口径：375 KP / 98 Units / 373 Relations / 1570 ALLOW——全程零变动。

---

## P43-02 | 2026-10-29 | 打印列数估算修正（inline-after-equals 按真实 72px 作答宽）

- **modified**:
  - `shared/presentation/layout.js`：`estimateCardWidth` 对 `response.layout='inline-after-equals'` 采用 72px 作答宽（原统一 96px 块状作答宽），异常分支同源；两位数口算 10 字符题干卡宽估算 234→210px，列数 2→3
  - `tests/presentation/layout-plan.test.js`：新增 1 条 P43-02 契约（6 道 inline 口算 → 3 列；同题干块状作答仍 2 列）
- **deleted**: 无
- **reason**: 用户反馈打印预览仍为 2 列。真实 Chrome 诊断：6 道两位数除法题估算 median=234px（90px 文本 + 96px 块状作答 + 48px 内边距），`(718+12)/(234+12)=2.96 → 2 列`；而实际内联空白盒仅 72px，3 列实测约 660px < 718px。修正后屏显 / 直渲 / 克隆三路径同为 3 列（实测 `232px×3`），P43-01 的题卡外观零变化。属 P31 排版决策的估算口径修正，未新增决策规则
- **tests**: 定向 `tests/presentation` **184/184**；`npm test` **939/939**；`CHROME_BIN=... node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP**；真实 Chrome 复测两条打印路径均 3 列且题卡/网格/题干 computed style 逐项一致；375/98/373/1570 零变动；`layout.js` 不在 presentation bundle 内，无需重建
- **risk**: 低——①影响所有 inline-after-equals 题型的列数估算（更贴近真实渲染宽度），已用真实页面与两条打印路径复核；②块状作答仍按 96px，不扩散；③未 git commit

---

## P43-01 | 2026-10-29 | 打印题卡样式单一来源（去卡片框 + 双路径版面同源）

- **modified**:
  - `shared/presentation/print.js`：新增 `buildPaperQuestionCss()`（试卷式题卡 SSOT：`display:block` / `border:0` / `border-radius:0` / `background:transparent` / `box-shadow:none`，内边距走 `--card-padding-print`；网格 `margin:0` + 间距走 `--grid-gap-print`；题干 15px/1.5/600）；新增 `buildClonePrintCss()`（共用块 + 克隆链专属 chrome 隐藏 / M13 静态表格 / 空反馈规则）；`buildPrintHtml` 的 extraCss 由私写 cloneCss 改为 `buildClonePrintCss()`；`buildFromQuestions` 改消费 `buildPaperQuestionCss()`；`global.Print` 导出新增两函数入口
  - `tests/presentation/renderer.test.js`：新增 2 条 P43-01 契约用例（共用试卷式样式内容断言；双链文档页边距 / 网格间距 / 题卡内边距同源断言）
  - `docs/06-PRESENTATION.md` §4.1：SSOT 索引补「打印题目/题卡样式」一行
- **deleted**: `print.js` 内 `buildPrintQcss`（旧直渲专用 QCSS 构建器）及克隆链私写覆盖规则（`.print-sheet .question-card` justify 兜底、`#problemsArea .questions-grid .question-card` padding `!important`、`.question-answer` border-bottom:none、`.question-card` 分页兜底、gap / 字号重复声明）
- **reason**: 用户 Bug Fix 报告（打印排版浪费版面 + 多余卡片样式 + 双路径不一致 + 标题下细灰横线）。实测定因：克隆链原样复制 `components.css` 分层屏幕卡片样式（border/radius/background/grid-rows/overflow:hidden）与 `pages.css` `.questions-grid` 的 `margin:15px 0`，题干继承屏幕 17px/1.6；直渲链为 15px/1.5 / margin:0。首行整卡通栏卡的边框即「标题下细灰横线」。修复按 P30 §5（重复层删除）与 P31 §3（一中心）：题卡外观唯一来源 `buildPaperQuestionCss`，克隆链仅追加 chrome 专属规则，第二套构建器物理删除。作答区结构差异（克隆链保留已冻结 input 框、直渲链空白区）沿用 `docs/06-PRESENTATION.md` §4 契约，未改；SemanticQuestion → PresentationRenderer 数据结构与接口签名零变动
- **tests**: 定向 `node --test "tests/presentation/*.test.js"` **183/183**；`npm test` **938/938**（基线 936 + 新增 2）；`CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node dev/check-all.js` **34 PASS / 0 FAIL / 0 SKIP / 34 项**（第 15 项真实浏览器 9 步 E2E PASS、16/17 bundle 确定性 PASS）；375/98/373/1570 零变动；`print.js` 不参与 presentation bundle（无需重建）
- **risk**: 低——①仅改打印文档内联 CSS，屏幕页与 SemanticQuestion / RenderResult 契约零触碰；②克隆链 input 框与直渲链空白作答区的结构差异为冻结契约，未新建第二套渲染统一；③「逐像素一致」以共用 CSS 块 + 同页边距 / 间距 / 题卡内边距断言实现，非截图 diff 工具；④未 git commit
