# Homework Help · 小学练习本

一个**完全免费、无广告、无弹窗**的小学 1-6 年级练习题生成与打印工具。

数学支持 **一年级至六年级**，2025 人教版基础知识点全覆盖（375 个知识点）。竞赛模式（C1–C9）入口已预留，但竞赛知识点暂未纳入 2025 人教版 KBL 发布包。只需选好年级、题型、难度、题量，点击生成，即可自动进入练习。

---

## 🚀 P17–P23 产品化收口完成

**P17-FINAL**：架构收口、7类真实生成、数量闭环、难度闭环、依赖门禁  
**P18**：练习闭环、异常处理、稳定性验证  
**P19**：页面产品化（二级/三级页面统一、UI服务收口）  
**P20**：题目质量治理（598 KP覆盖、Generator质量抽检、低容量KP治理）  
**P21**：性能优化、浏览器/打印兼容  

**P23**：数学产品化收口专项——数据源清洗、派生链路验证、生成链路健康、产品验收、最终冻结

**核心冻结边界**：KBL/Runtime/KnowledgeContext/POL/Strategy/26Generators/Validator/SemanticQuestion/Presentation 均为只读态。（GenerationCore 为测试/历史资产，见下。）

**健康检查入口**：`npm run verify:frozen-core`、`npm run verify:p17-deps`、`npm test`（全链）

---

## 📦 版本信息

**当前版本**：5.0.0

**版本变更说明**：
- P17-FINAL：共同生成内核与旧链最终收口
- P18–P21：产品化闭环、页面产品化、题目质量、工程稳定性
- P23：数学产品化收口——数据源清洗、派生链路健康、生成链健康、产品验收、冻结
- P24：产品化一致性收口——知识页/sitemap 重建（375=375=375）、ALLOW 真实性门禁（1570/1570）、Capacity Map 重建、版本统一 5.0.0、语法门禁补齐
- P28-29：Bundle 最终收口——strategy/presentation bundle 清理 legacy/测试/GenerationCore/重复 renderer/registry 死代码（strategy 71 defs、presentation 21 defs 全可达，node:path/node:fs/generator-contract/generation-core 零内联）
- P28-30：Practice 首屏性能治理——45 项同步脚本中的 21 项（渲染栈/SVG 生成器含非核心插件/打印模块）移出首屏，经 `ensureDeferredReady()` 顺序惰性装载（约 -168KB 初始 JS：46→25 静态标签）；首次生成/打印前门控就绪，语义与旧同步装载零差异；sw.js CORE 补齐 render-options/render-result 保离线；`resolved Print` 惰性化（practice-session）
- P28-33：KBL→页面→AI 数据边界（FROZEN）——公开知识内容单向 `KBL→Static Page`；SEO/AI/Crawler/LLM 禁反向修改 KBL（KBL 唯一可写方=离线派生白名单）；`build-knowledge-pages.js --check` 升级为真漂移校验（页面哈希 vs 当前 KBL 投影，审计归零 11 个过期 kbgen:hash 页面）；新增门禁 `check:kbl-ai-boundary`（写方白名单 + 零漂移 + 公开物驻留，已接入 run-all-checks 第 6 步）
- P28-34：SEO/AI 历史数据隔离（FROZEN）——`archive/migration/audit-results/.trae/test/dev` 六目录不进 sitemap/内部导航/llms 知识源；robots.txt 补齐 4 项 Disallow；历史 html（`dev/svg-test.html`、`archive/legacy-tests/…`）补 `noindex`；llms.txt 新增「知识源单一性声明」= 正式发布知识页面唯一；新增门禁 `check:seo-ai-history`（run-all-checks 第 7 步）
- P28-35：sitemap 最终冻结（FROZEN）——集合定死 5 公共页 + 375 KP + 索引（381 条）；逐 URL 验证 HTTP 200·无 redirect·文件存在·canonical 与 sitemap URL 完全一致（补上 index.html 缺失 canonical）；新增门禁 `check:sitemap-freeze`（run-all-checks 第 8 步）
- P28-36：AI Agent 抓取最终测试（FROZEN）——模拟不执行 JS 的抓取（GET→HTML→link→knowledge→practice）；入口 index.html 仅靠静态链接图可达全部 KP；375/375 可发现·375/375 可读取（服务端含名称+释义）·375/375 identity 正确（canonical/知识点 ID/h1=KBL 名称）；新增门禁 `check:ai-crawl`（run-all-checks 第 9 步）

**已完成的关键交付**：
- 7类真实生成矩阵测试（p17-14） through 11 tests
- 数量闭环测试（p17-15） through 4 tests  
- 难度闭环测试（p17-16） through 4 tests
- 依赖硬门禁（p17-17） through 5 WARN/0 Violation
- 练习会话闭环验证
- 生成异常与短缺处理
- 生成稳定性与会话一致性
- 7类真实生成基线固化
- KBL幂等重建验证
- Capacity Map 重生成与一致性验证
- frozen-core 完整性完好
- npm test 全链 PASS

**冻结边界**：
- KBL数据模型、KBL运行API
- POL编排职责
- GenerationCore共同生成内核 = **测试/历史资产**（非生产）：源文件保留（T9「不误删」），但生产 bundle 不内联、生产链不经过；仅 `tests/orchestration/p17-10/14/15/16` 直接装载验证其 execute 语义
- 26个Generator算法
- Validator核心规则
- SemanticQuestion数据契约
- 7个canonical question types
- 难度公式/数量分配原则

**健康检查**（2026-09-19 P24 冻结基线，详见 `docs/00-BASELINE.md`）：
- `npm run verify`（M0 聚合门禁）：5/5 PASS
- `npm run verify:syntax`：218 文件 / 0 错误
- `npm run verify:allow-gen`：ALLOW 真实性 1570/1570 PASS
- `npm test`：239/239 PASS
- `bash scripts/run-all-checks.sh`：一键全绿（与 CI 等价）

---

## 📁 仓库结构要点

- `docs/`：当前基线（00-BASELINE ~ 11-SECURITY + CHANGELOG，按主题域组织）；历史阶段报告在 `docs/archive/phases/`（ARCHIVED）
- `dev/`：验证与检查脚本
- `tests/`：单元与集成测试
- `shared/`：核心源代码（冻结模块）
- `kbl/`：知识基线数据
- `tools/kbl/`：KBL构建与验证工具

---

## 📜 版本变更日志

> 详细变更请参考 `docs/CHANGELOG.md` 与 `docs/archive/` 下的历史审计报告。
> 版本号遵循语义化版本；5.0.0 为 2026-09-19 产品冻结版本。

---
*生成时间：2026-09-16*
