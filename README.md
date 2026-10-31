# Homework Help · 小学练习本

一个**完全免费、无广告、无弹窗**的小学 1–6 年级数学练习题生成与打印工具。

数学支持 **一年级至六年级**，2025 人教版基础知识点全覆盖（375 个知识点）。选好年级、题型、难度、题量，点击生成即可进入练习、批改、错题重做与 A4 打印。

纯前端静态站，**零运行时依赖**，无注册、无数据上传。

---

## 当前基线（与 `docs/00-BASELINE.md` 同步）

| 项 | 值 |
|---|---|
| 版本 | **5.2.0** |
| KP / Units / Relations / ALLOW | **375 / 98 / 407 / 1566** |
| Canonical 题型 | **7 类**（calc / fill / choice / judge / geometry / classify / apply） |
| Generator | **23**（PRODUCTION 20 / COMBINE-ONLY 1 / DORMANT-CARRIER 2） |
| 测试 | **102 文件 / 937 用例 / 0 FAIL** |
| 门禁 | **34 项**：本地 33 PASS / 0 FAIL / 1 SKIP（#15 无 Chrome）；CI 设 `CHROME_BIN` 为 34/0/0 |
| Sitemap | **382 URL**（6 公共页 + 375 KP 页 + 1 索引页） |

唯一执行链：`KBL → KnowledgeContext → POL → Strategy → Generator → Validator → SemanticQuestion → Presentation → SVG`。

---

## 快速验证

```bash
npm run verify          # M0 聚合门禁（8 步）
npm test                # 全链测试（937/937）
node dev/check-all.js   # 全量门禁（34 项）
```

---

## 仓库结构

- `docs/`：当前开发文档（`00-BASELINE.md` ~ `11-SECURITY.md`、`CHANGELOG.md`、各阶段 `change-log.md`）；历史报告在 `docs/archive/phases/`（ARCHIVED，不作开发依据）
- `dev/`：验证与门禁脚本
- `tests/`：单元与集成测试
- `shared/`：核心源码（冻结模块，唯一下沉层）
- `kbl/`：知识基线数据（T1/T2 数据层）
- `tools/kbl/`：KBL 构建与校验工具

---

## 文档入口

| 文档 | 内容 |
|---|---|
| `docs/00-BASELINE.md` | **唯一当前基线**；任何「项目现在是什么」只以此为准 |
| `docs/01-ARCHITECTURE.md` | 冻结架构、层级归属、跨层禁令 |
| `docs/02-KBL.md` ~ `docs/11-SECURITY.md` | 各领域事实与契约 |
| `docs/CHANGELOG.md` | 版本变更历史 |
| `docs/archive/` | 历史阶段报告（仅追溯，不作依据） |

规则：`.trae/rules/ai-coding-workflow.md`（九步流水线）+ P30/P31 专项规则。
