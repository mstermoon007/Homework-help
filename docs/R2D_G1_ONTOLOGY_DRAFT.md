# R2-d 五类本体补全草案 · 批次 1：G1（60 KP）

> 依据：`docs/AI_REFACTOR_PLAN.html` R2 子项 2「五类本体补齐」；Q7「分批出草案」。
> 授权：Q7（concept/factualContent/assessment.errors/graphicType 分批出草案，评审后应用）。
> 批次策略：按年级分批，G1（60 KP）为第 1 批——最小年级、用户点名基准，审过格式后推广 G2-G6。

## 1. 批次范围与缺口

| 数据文件 | G1 KP | 缺口 |
|---|---|---|
| math-g1 | 53 | concept/factualContent/graphicType 已具备（此前补全），仅缺 assessment.errors |
| cn-g1 | 7 | concept/factualContent/graphicType/errors 全缺 |

**本批补全量**：concept 7（cn）、factualContent 7（cn）、graphicType 7（cn）、errors 60（123 条，平均每 KP 约 2 条）。

## 2. 草案文件

- 草案数据：`docs/r2d-g1-ontology-draft.json`（60 条目）
- 结构：
  - `concept`：字符串（知识点概念，含教材定位，沿用 math-g1 既有措辞风格）
  - `factualContent`：对象，键 ∈ FACT_TYPES（cn 用 classification/relationship/rule/notation）
  - `graphicType`：字符串（cn 语文类用 `text`；math 已有值不动）
  - `errors`：`[{ id, category, description }]`，id 英文 kebab、category ∈ 10 类、description 中文

## 3. 内容示例

**cn-g1-n1-pinyin-basic（拼音基础）**
- concept：认识汉语拼音的 23 个声母、24 个韵母与 16 个整体认读音节，能正确认读与书写。
- factualContent：`{ classification: "声母 23 个（b p m f …）；韵母 24 个（a o e …）；整体认读音节 16 个（zhi chi shi …）" }`
- graphicType：`text`
- errors：
  - `pinyin-initial-confuse`（reading）形近声母混淆：b/d、p/q、f/t
  - `pinyin-final-mixup`（reading）韵母混淆：an/ang、en/eng 前后鼻音
  - `whole-syllable-misread`（notation）整体认读音节误按两拼拆读

**math-g1-m1-carry-add-20（20 以内进位加法）**
- errors：
  - `carry-add-carry-miss`（calculation）个位满十未向十位进 1
  - `carry-add-unit-error`（calculation）个位相加结果算错导致进位错误

## 4. 校验

- 草案 JSON 通过 `knowledge-error.validate`（id 合法/无重复/category 合法）与 `knowledge-factual.validate`（无策略字段混入）——0 问题。
- 全库 error id 不重复（跨 KP 复用同一典型错因 id，语义一致）。

## 5. 应用方式（评审后）

应用脚本 `dev/r2d-ontology-apply.js`（按 R2-b 同款纪律）：
1. 归档备份 knowledge-math/cn/en.js → archive/knowledge-\<sub\>-r2d-20260904-*.js
2. 按 kpId 定位，写入/追加 concept、factualContent、graphicType、assessment.errors（math 只补 errors）
3. 行级最小改写，保留原文件格式
4. 验证：verify:m1（check-error-ontology/check-factual-content/check-ontology-schema）+ verify:m2 + check-regression + npm test
5. Frozen Core 授权 + 基线快照 + 独立 commit

## 6. 待决策问题（约束 5）

- **D1 · FORBIDDEN_RE 误伤**：`shared/knowledge-error.js` 的 FORBIDDEN_RE `/(plugin|question|error-[0-9]|math-g|cn-|en-)/` 中 `en-`/`cn-` 过宽，会误伤含 "en-"（如 `make-ten-*`）或含 "question"（如 `brace-question-*`）的合法数学 error id。本批草案已改名规避（`make10-*`/`brace-op-*`），不改核心校验。是否后续在 R 阶段修复 FORBIDDEN_RE（需 GEN 授权，属核心校验逻辑）？
