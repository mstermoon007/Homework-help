# P16-FOLLOWUP-C1：POL Contract 冻结

## C1-01 建立基线
- **基线文件**：`P16-FOLLOWUP-C0-baseline.json`（已生成）
- **当前状态**：
  - `npm test` EXIT=0（65 PASS）
  - `kbl:verify` 9/9 ALL PASS
  - `golden` 15/15 PASS
  - `f-type-2` PASS
  - frozen-core：无变更完整
  - Legacy=0、Runtime=0、Capacity Map=0、Strategy Bundle=0

## C1-02 禁止事项（不得做的事）
1. 新增题型体系
2. 新增KBL体系
3. 新增第二套POL
4. 新增第二套Generation
5. 新增第二套difficulty
6. 新增第二套quantity
6. 新增CommonGenerator大总成
7. 新增新的兼容ID体系
8. 新增Compatibility层
9. 修改difficulty公式
10. 修改KBL数据语义
11. 修改首页
12. 修改练习UI视觉
13. 重写26个Generator

## C1-03 仅允许的事项
1. 收口
2. 归位
3. 抽取
4. 重命名
5. 删除
6. 桥接
7. 验证

---

## 二、C1-02/03 冻结规则文档

**冻结线以上**（未经授权不可任意修改）：
- KBL 知识事实结构
- KnowledgeContext 唯一业务接缝
- POL 决策范围（数量/题型/难度/Cell）
- GenerationCore 唯一执行入口
- Strategy 策略消费角色
- Generator 生产角色
- Validator 验收角色
- Presentation 展示角色

**冻结线以下**（可正常开发，但不得绕过 KnowledgeContext 重新访问 KBL）：
- POL 模块内的非核心参数调优
- Strategy 中的策略参数微调
- Generator 内部实现细节优化（不改逻辑）

**核心原则**：
> **POL 决策，GenerationCore 执行，Strategy 解释，Generator 生产，Validator 验收，Presentation 展示。**
