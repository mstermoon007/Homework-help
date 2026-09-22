# 全量问题归类（Issue Register）— Clean Product Baseline v3

> 汇总 M0–P14 全部已知发现/断点/例外，按「状态 × 归属层」归类。唯一权威台账为
> `docs/pol-kbl-pending.md`；本文件为分类总览（问题数：已收口 19 / 受控例外 7 / 待授权 2 / 待人工数据 3 / 观察 3）。

---

## A. 已收口（Resolved，18）

| # | 问题 | 阶段 | 处置 |
|---|---|---|---|
| 1 | FAIL-001 render.js 死代码访问旧 KnowledgeBank | Phase 2 | 删除死路径 |
| 2 | FAIL-002 kp-semantic-validator 失效 combine 引用 | Phase 2 | 删除 |
| 3 | FAIL-003 presentation bundle 内联第二份 KC 副本 | Phase 2 | 构建委托去重（31→22 内联） |
| 4 | A2 comprehensive 路由漂移（带题型白名单误入 POL 池） | Phase 1 | POL 显式 comprehensive 回退 |
| 5 | A3/P1a UI typeCounts 恒传覆盖 POL 分配 | P10-1 | `typeCountsEdited` 显式编辑才传 |
| 6 | P1b 知识页 legacy 残留（655 页） | P9-10 | canonical 重建 540 页 + sitemap |
| 7 | P2 D2/M16 难度测试断链 | P8 | tests/difficulty 6 文件 23 用例重建 |
| 8 | P4 B5/B6/B7 生成绑定 legacy ID | P9-9 | canonical 迁移 + 重锚（377 绑定） |
| 9 | DRIFT-09 冻结多默认值 | P8 | 契约固化（分层默认不统一） |
| 10 | DRIFT-10 默认值政策 | P8 | 契约 §11 固化 |
| 11 | DRIFT-11 Target 全局兜底缺失 | P8-1 | `getTargetDifficulty` 兜底 |
| 12 | F-ADAPT-1 POL cell 丢失生成上下文 | P10-3 | cellReq 白名单补全 |
| 13 | F-DUP-1 POL 覆盖 previousSeenKeys | P11-02 | 初始 seenKeys 播种 + 实证 |
| 14 | F-DUP-2 刷新无跨批记忆 | P11-02 | sessionStorage 最小记忆（A 语义） |
| 15 | F-DUP-3 api.js 注释漂移 | P11-02 | 同步 |
| 16 | F-CAP-1 capacity map legacy 键（命中 0） | P13-04 | canonical 重建 598/598 + CLI 修复 |
| 17 | F-404-1 common.js 注入路径 3×404 | P14-05 | 修正 + 重锚（78 文件） |
| 18 | F-PRINT-1 UI `.catch` TypeError（打印） | P12-05 | UI 调用点 Promise 归一 |
| 19 | **P16-FOLLOWUP-B6** registry 261 条 legacy KP 绑定 | P16-B6 | 删数据不改决策逻辑：registry legacy→0、bundle 重建→0、capacity-map 重建 375 键→0；verify-setup 采样对齐 canonical；冻结线 `docs/kbl-freeze-line.md` |

## B. 受控例外（Controlled，7）

| # | 问题 | 原因 | 状态 |
|---|---|---|---|
| 1 | F6-1 Presentation 二次 selectGenerator | Frozen 不可改；确定性输入 | 维持 |
| 2 | F6-2 generation-engine 内联回退 | Frozen；GenerationAPI 存在时不触发 | 维持 |
| 3 | F6-4 / W7 编排规范化重复 | api.js/generation-engine frozen | 维持 |
| 4 | KnowledgeBank compat 委托桥 | 冻结 bundle 消费方唯一接线 | 维持（唯一性 PASS） |
| 5 | comprehensive-strategy 经 compat 访问 | Frozen；只读 | 维持 |
| 6 | F-PRINT-1 frozen 侧 `print()` 返回 undefined | print.js/practice-session frozen | UI 已防护；frozen 归一待授权 |
| 7 | adaptive/learnerProfile UI 未启用 | UI 不提供 profile（API 能力保留） | 产品功能项 |

## C. 待授权修复（Frozen Fix，2）

| # | 问题 | 根因 | 影响 | 建议 |
|---|---|---|---|---|
| 1 | **F-TYPE-2** 多题型请求单题型产出 | registry 归一表误映射（RECOGNIZE_KEYWORDS→geometry、factor-multiple→geometry）+ capability-model rawType 优先 | 76~79 KP（13%）题型错位 | 方案 B（授权修 Frozen 表 + rawType 优先改为 type 优先）+ 重锚 + 回归 |
| 2 | **F-TYPE-1** Strategy 退化产出越界题型 | 同 F-TYPE-2（错映射导致 supported 错型） | 越界题被 Scope 守卫丢弃 → PARTIAL/FAILED | 随 F-TYPE-2 一并收口 |

## D. 待人工数据/决策（Human，3）

| # | 问题 | 需要 | 清单 |
|---|---|---|---|
| 1 | P13-05 243 生成映射缺口 | Excel sheet 4（原始映射） | `docs/human-data-requests/mapping-gap-243.csv` |
| 2 | P13-06 G1 缺失字段（32 KP） | 业务确认（合法为空/补齐/保持缺失） | `docs/human-data-requests/g1-missing-fields.csv` |
| 3 | P13-07 58 非发布 KP 状态 | 产品决策（published/knowledge-only/hidden/pending-data） | `docs/human-data-requests/non-publishable-58.csv` |

## E. 观察项（Observation，3）

| # | 观察 | 说明 |
|---|---|---|
| 1 | 低容量 KP 95 个（GENERATOR_LIMITED 46 / EXPECTED_LIMITED 49） | 真实生成空间有限；PARTIAL 为正确语义（非缺陷） |
| 2 | favicon.ico 404 | 浏览器自动请求；无站点图标（cosmetic） |
| 3 | 6 题型全选产出以 calc 为主 | F-TYPE-2 症状；Scope 守卫保证不越界 |

## 归属层分布

```text
Frozen Core（受控/待授权）   : 9（B1-B6、C1-C2、B7 相关）
POL / UI（已收口）           : 7（A5、A12-A15、A18、A16 部分）
数据治理（KBL/映射/容量）    : 6（A7、A16、D1-D3、A19-B6）
产品决策                     : 2（B7、D3）
架构治理（已收口）           : 6（A1-A4、A6、A8）
```
