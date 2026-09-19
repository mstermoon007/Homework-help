# P25-SEMANTIC-MATRIX — 375 KP 教学语义覆盖矩阵（P25-02 起草）

> 由 `dev/p25/draft-semantic-matrix.js` 生成；**人工数据治理阶段产物，不写入任何正式数据**。

| 项 | 值 |
| --- | --- |
| 覆盖 | 375/375 KP |
| semanticLevel 分布 | {"D":93,"B":41,"C":166,"A":75} |
| A 类带 learningTargets 提案 | 75 / 75（提案=KBL 定义机械分句，子串断言防虚构） |
| NEEDS_REVIEW 字段格 | 1800 |

## 产物

- [P25-KP-SEMANTIC-MATRIX.xlsx](./P25-KP-SEMANTIC-MATRIX.xlsx) — 人工评审表（总览 / A类评审 / D类治理 / 字段口径）
- [P25-KP-SEMANTIC-REVIEW.json](./P25-KP-SEMANTIC-REVIEW.json) — 机读评审文件（含 workflow 与逐字段状态）

## 状态机

```
kbl-derived（事实投影，人工可修正）  ──人工确认──▶  confirmed
draft-proposal（A类定义分句提案）    ──人工改写──▶  confirmed
needs-review（无可靠来源，留空）    ──人工编写──▶  confirmed
```

禁止：AI 直接 confirmed；confirmed 数据未回灌 KBL 前不得进入正式数据链路（P25-01 Schema E05 会拒绝 NEEDS_REVIEW 携带内容）。
