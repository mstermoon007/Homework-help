# Frozen Core 保护规范

**版本**: 1.0  
**生效日期**: 2026-09-01  
**状态**: 强制执行

---

## 1. 核心原则

**Frozen Core（冻结核心）** 是指已通过 M7 最终验收、在生产环境稳定运行的核心架构层。这些层已完成「设计-实现-验收-生产」完整闭环，**默认冻结，仅允许 Bug Fix，禁止重构/重设计/新增核心能力**。

---

## 2. 冻结范围（M0-M7）

| 里程碑 | 模块 | 冻结文件/目录 | 保护级别 |
|--------|------|---------------|----------|
| **M0** | 基础设施 | `shared/common.js`, `shared/version.js`, `shared/tokens.css`, `shared/base.css`, `shared/states.css`, `shared/components.css`, `shared/pages.css`, `shared/toolbar.css`, `shared/subjects.css` | 🔴 绝对冻结 |
| **M1** | 本体/知识库 | `shared/knowledge-bank.js`, `shared/knowledge-math.js`, `shared/knowledge-cn.js`, `shared/knowledge-en.js`, `shared/knowledge-ontology.js`, `shared/module-catalog.js`, `shared/capability-model.js`, `shared/capability-matrix.js`, `shared/capability-resolver.js`, `shared/question-type-registry.js`, `shared/strategy/strategy-config.js` | 🔴 绝对冻结 |
| **M2** | 能力/生成器契约 | `shared/generator/generator-contract.js`, `shared/generator/generator-registry.js`, `shared/generator/generator-selector.js`, `shared/generator/generator-mode.js`, `shared/generator/retry-loop.js`, `shared/generator/legacy-plugin-adapter.js`, `shared/generator/generators/` | 🔴 绝对冻结 |
| **M3** | 策略引擎 | `shared/strategy/strategy-engine.js`, `shared/strategy/comprehensive-strategy.js`, `shared/strategy/legacy-adapter.js`, `shared/strategy/strategy-error.js` | 🔴 绝对冻结 |
| **M4** | 生成器实现 | `shared/generator/core/`, `shared/generator/generators/arithmetic.js`, `selection.js`, `complex.js`, `shared/generator/semantic-question.js`, `shared/generator/question-id.js` | 🔴 绝对冻结 |
| **M5** | 验证管线 | `shared/validator/validation-pipeline.js`, `shared/validator/question-validator.js`, `shared/validator/answer-validator.js`, `shared/validator/distractor-validator.js`, `shared/validator/structure-validator.js`, `shared/validator/difficulty-validator.js`, `shared/validator/duplicate-validator.js`, `shared/validator/graphic-validator.js`, `shared/validator/render-preflight.js`, `shared/validator/batch-validator.js`, `shared/validator/quality-scorer.js`, `shared/validator/validation-pipeline.js`, `shared/generator-regression.js`, `shared/check-generator-*.js` | 🔴 绝对冻结 |
| **M6** | 学习者模型 | `shared/learner/learner-model.js`, `shared/learner/learner-storage.js`, `shared/learner/practice-result.js`, `shared/learner/result-collector.js`, `shared/learner/error-model.js`, `shared/storage.js`, `shared/difficulty.js`, `shared/difficulty-static.js` | 🔴 绝对冻结 |
| **M7** | 统一渲染/生成/打印 | `shared/presentation/renderer.js`, `shared/presentation/html-renderer.js`, `shared/presentation/render-options.js`, `shared/presentation/render-result.js`, `shared/presentation/legacy-svg-adapter.js`, `shared/presentation/svg-registry.js`, `shared/generation-engine.js`, `shared/strategy/comprehensive-strategy.js`, `shared/presentation-engine.js`, `shared/print.js`, `shared/practice-session.js`, `shared/check.js`, `shared/svg-*.js` | 🔴 绝对冻结 |

---

## 3. 禁止事项

**严禁** 对冻结核心进行以下操作：

| 禁止操作 | 说明 |
|-----------|------|
| 🚫 重构核心架构 | 重新设计 M0-M7 任一层的核心数据结构/接口/流程 |
| 🚫 新增核心层 | 引入 `NewEngine` / `NewStrategy` / `NewGeneratorFramework` / `NewQuestionModel` / `NewValidatorFramework` / `NewRendererFramework` 等同级核心抽象 |
| 🚫 修改核心契约 | 变更已验收的接口签名、数据结构、错误码、错误语义 |
| 🚫 绕过核心入口 | 在页面/插件中直接调用被冻结层内部实现（如直接 `StrategyEngine.plan()`、`Generator.generate()`、`Plugin.generate()`） |
| 🚫 耦合内部实现 | 新代码依赖冻结层的内部实现细节（私有函数、未导出变量、内部状态结构） |
| 🚫 破坏单向数据流 | 在反方向建立依赖（如 Renderer 反向依赖 Generator、Validator 反向依赖 Strategy） |

---

## 4. 允许的例外（仅限 Bug Fix）

**仅在以下条件全部满足时，允许修改冻结核心**：

| 条件 | 要求 |
|------|------|
| ✅ 明确 Bug | 有确凿的 Bug 报告（Issue/复现步骤/预期 vs 实际行为） |
| ✅ 最小改动 | 仅修复该 Bug，不引入无关改动、不重构、不扩展功能 |
| ✅ 回归测试通过 | 相关单元测试 + 集成测试 + 端到端测试全部通过 |
| ✅ 门禁通过 | M7 最终验收 (31/31) + 所有子 Gate 全绿 |
| ✅ 变更记录 | 在 `CHANGELOG.md` 记录：Bug 编号、根因、修复点、验证方式 |

---

## 5. 扩展机制（在核心之外扩展）

**需要新功能时，必须在冻结核心之外扩展**：

| 扩展类型 | 推荐方式 |
|---------|----------|
| 新题型/新知识点 | 在 `shared/knowledge-*.js` 增加 KP，`plugins/` 增加插件，**不改核心** |
| 新生成器 | 在 `shared/generator/generators/` 增加实现，注册到 `GeneratorRegistry`，**不改 Selector/Contract** |
| 新验证规则 | 在 `shared/validator/` 增加 Validator，注册到 Pipeline，**不改 Pipeline 结构** |
| 新渲染器 | 在 `shared/presentation/` 增加 Renderer，注册到 `PresentationRenderer`，**不改 Renderer 核心** |
| 新打印模板 | 在 `shared/print.js` 增加 `PRINT_ROUTES` 配置，**不改打印核心逻辑** |
| 新 SVG 生成器 | 在 `plugins/svg-*.js` 增加，注册到 `SVGRegistry`，**不改 SVGRegistry 核心** |

---

## 6. 违规处理

| 违规类型 | 处理 |
|----------|------|
| 未经批准修改冻结核心 | 代码审查拦截，要求回滚或走 Bug Fix 流程 |
| 引入新核心层 | 架构评审否决，要求改为扩展机制 |
| 绕过核心入口 | 代码审查拦截，要求改用公开 API |
| 破坏单向数据流 | 架构评审否决，要求重构依赖方向 |

---

## 7. 变更申请流程

若确需修改冻结核心（仅限 Bug Fix）：

```
1. 提交 Issue：标记 [Bug Fix][Frozen Core]，描述 Bug、复现步骤、影响范围
2. 评估：核心维护组评估（是否真为 Bug、是否可在外层解决、影响面）
3. 批准：核心维护组批准后，打 [Frozen Core Fix] 标签
4. 实施：最小改动 + 完整测试
5. 验收：M7 Gate 全绿 + 相关回归测试通过
6. 合并：记入 CHANGELOG.md [Frozen Core Fix]
```

---

## 8. 附录：当前 Frozen Core 清单（自动生成）

> 以下文件列表由 `dev/check-frozen-core.js` 自动扫描生成，作为审查基线。

```bash
# 运行方式
node dev/check-frozen-core.js

# 输出示例
=== Frozen Core 基线检查 ===
M0: 8 files - FROZEN
M1: 15 files - FROZEN
M2: 22 files - FROZEN
M3: 4 files - FROZEN
M4: 18 files - FROZEN
M5: 16 files - FROZEN
M6: 9 files - FROZEN
M7: 24 files - FROZEN
Total: 116 files - FROZEN
```

---

**执行者**: 核心架构组  
**监督者**: 技术委员会  
**下次评审**: 每季度或重大版本发布前

---

> **核心不变，边界可扩。稳定是最大的功能。**