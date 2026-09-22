# P12 产品交互闭环 E2E 报告（真实浏览器）

> 环境：本机 Chrome（headless=new）+ CDP（Node 内置 WebSocket）+ `python3 -m http.server`（HTTP 环境）。
> 驱动器：`dev/e2e/browser-e2e.js`（dev-only，不进入生产链、不新增运行时架构）。
> 观测点：页面内包装唯一生成入口 `GenerationAPI.generate`（记录 Request/Result/题目归属）+ DOM 渲染 + JS 错误。
> 命令：`npm run test:e2e`（P12-01 ~ P12-08 全量）。

---

## 结果总览（全部 PASS）

| 步骤 | 场景 | 结果 |
|---|---|---|
| P12-01 | 完整生成链：1type×1kp / Ntype×1kp / 1type×Nkp / Ntype×Nkp | 4/4 PASS（SUCCESS，dom = produced，0 JS error） |
| P12-02 | 多题型 × 多 KP（canonical 6 题型） | 2/2 PASS（types ⊆ selected，kps ⊆ selected，req ≥ planned ≥ gen = final） |
| P12-03 | Difficulty 真实链 1/3/5/7/10 | 5/5 PASS（request.difficulty = UI 值；实际题目难度逐级精确命中 [d,d]） |
| P12-04 | SUCCESS / PARTIAL / FAILED 用户体验 | 3/3 PASS（20/20；1/5 + Partial 文案；0 题 + 生成失败提示 + 打印禁用） |
| P12-05 | 打印闭环 | PASS（打印弹窗与 print 调用 1 次；打印卡片 = produced；标题存在；打印不触发新生成；0 JS error） |
| P12-06 | Session / 刷新 / 恢复 | PASS（刷新后自动生成；请求参数保持；hasPrevSeen=true；状态可交付；0 JS error） |
| P12-07 | 跨批去重 Browser E2E | PASS（刷新与重新生成两路：overlap = 0；sessionStorage 记忆生效） |
| P12-08 | 结果与重新生成（Generate→Practice→Finish→Result→Regenerate） | PASS（参数保持；新批 20/20；overlap = 0；0 JS error） |

---

## 关键证据

### P12-01/02（真实链唯一）
- 浏览器内调用来源 = `GenerationAPI`（setter 陷阱捕获赋值瞬间，唯一生成入口）。
- Request 字段（subject/grade/count/difficulty/types/kps）与 UI 深链一致；DOM 可见网格 `.questions-grid .question-card` 数量 = produced。
- `#printMeasure` 打印测量副本不计入用户可见题数（E2E 计数口径已修正）。
- S3/S4 出现 `outOfScope`（3 题越界被 POL Scope 守卫丢弃）并由 Recovery 补齐至 SUCCESS —— P11-03 守卫在真实浏览器生效。

### P12-03（难度）
```text
d=1  → 10 题 diffRange [1,1]    SUCCESS
d=3  → 10 题 diffRange [3,3]    SUCCESS
d=5  → 10 题 diffRange [5,5]    SUCCESS
d=7  → 10 题 diffRange [7,7]    SUCCESS
d=10 → 10 题 diffRange [10,10]  SUCCESS
```

### P12-04（三态）
```text
SUCCESS：进度「已生成 20 / 20 题」
PARTIAL：进度「本次已生成 1 / 5 题 · 部分题型/知识点暂无足够题目」
FAILED ：notice「生成失败，请重试」+ 打印按钮禁用 + 0 JS error（不出现空白练习页崩溃）
```

### P12-05（打印 + 真实 Bug 修复）
- **F-PRINT-1（已修复）**：`PracticeSession.print()` 在 Engine 产物路径同步返回 `undefined`（frozen print 链），
  而 `practice.html` 两处调用 `.print().catch(...)` → 点击打印抛 `TypeError: Cannot read properties of undefined (reading 'catch')`。
  修复：UI 调用点改为 `Promise.resolve(...print()).catch(...)`（UI 层最小修复；frozen API 不一致登记台账）。
- 打印载荷：10 张卡片（= produced）、`ps-title` 标题、弹窗与 print 各 1 次、不触发新生成。

### P12-06/07/08（状态与跨批）
- 刷新：同 URL 自动生成；`hasPrevSeen=true`（P11-02 sessionStorage 记忆在真实浏览器生效）；两批均 20/20，overlap=0。
- 重新生成（完整闭环：检查答案 → 结果区「重新生成」）：请求参数保持；batch1/batch2 各 20 题，overlap=0（A 语义）。

---

## 发现与登记

| # | 发现 | 处置 |
|---|---|---|
| F-PRINT-1 | `session.print()` 返回 undefined（frozen print/session 链），UI `.catch` 抛 TypeError | UI 调用点已修（Promise.resolve）；frozen API 不一致登记台账（P14 授权后处理） |
| F-TYPE-1（延续） | Strategy 对部分 KP×Type 退化产出越界题型（P11-03 守卫丢弃；S3/S4 实测 outOfScope=3） | 数据治理 P13-05/P13-08 |
| 观察 | 6 题型全选时实际产出以 calc 为主（类型分布偏离请求结构） | 内容质量抽检 P13-08 |

## 验收

```text
真实用户闭环：选择 → 生成 → 练习 → 打印 → 结果 → 重新生成   ✅
生产生成主链唯一（浏览器实测 via GenerationAPI）              ✅
Partial / Failed 真实且不伪造                                  ✅
跨批去重（刷新 / 重新生成）overlap = 0 + sessionStorage 生效   ✅
0 JS error（8 个模式全部）                                     ✅
```
