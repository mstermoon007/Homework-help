# G1 数学知识库草案 · 三重视角完整版（53 KP）

> 依据：`docs/g1-book-annotation-draft.json`（三重视角标注）合并现有 G1 全字段（R0-R2d 已补全的五类本体/难度/螺旋/aqt），
> 产出**可直接应用**的完整知识库草案。
> 数据文件：`docs/g1-math-knowledge-base-draft.json`（26 字段 × 53 条，**不含模块字段**）。

## 1. 组织架构

```
教材定位（book 册 + unit 单元）
   └─ 知识点（kp，26 字段完整条目）
         └─ 类别（category：数与代数 / 图形与几何 / 统计与概率 / 常见的量 / 综合与实践）
```

## 2. 数据结构

```jsonc
{
  "meta":   { 架构说明 / 册枚举 / 类别枚举 / 应用规则 / 依据 },
  "books":  { up, down, mixed, advance }   // 册 → 类别 → kp[] 树形组织（供阅读/UI）
  "entries":[ 53 个完整 kp ]               // 平铺列表（供应用脚本按 id 写回）
}
```

每条目 26 字段 = 既有 23 字段（id/name/type/description/example/concept/operations/factualContent/
common_errors/graphicType/prerequisites/related/difficulty/spiral_level/max_spiral_level/
cognitive_level/applicable_question_types/number_range_default/max_steps_default/context_default/status）
**+ 新增 3 字段**：`book`（上下册）、`unit`（教材单元）、`category`（知识类别）。

## 3. 册 × 类别 矩阵（53 条全覆盖）

| 册 \ 类别 | 代数 | 几何 | 常见的量 | 统计 | 综合 | 小计 |
|---|---|---|---|---|---|---|
| 📗 上册 | 14 | 2 | 3 | 0 | 0 | 19 |
| 📘 下册 | 8 | 3 | 3 | 3 | 1 | 18 |
| 📖 跨册 | 9 | 2 | 0 | 0 | 2 | 13 |
| ⏭ 超前 | 3 | 0 | 0 | 0 | 0 | 3 |
| **小计** | **34** | **7** | **6** | **3** | **3** | **53** |

## 4. 应用规则（写入 meta.rules，供生成层/服务层遵守）

| 规则 | 内容 |
|---|---|
| 跨册出题范围 | `mixed` kp：进度=上册按一上范围、进度=下册按下册范围（生成层以 `number_range_default` 约束） |
| 超前可见性 | `advance` kp：进度维度默认隐藏，教师模式可显式调出 |
| 模块已去除 | 草案不含模块字段；模块容器仅作数据存储，用户流程不可见 |

## 5. 内容示例（`math-g1-m1-addsub-5`）

```jsonc
{
  "id": "math-g1-m1-addsub-5", "name": "5以内加减法",
  "book": "up", "unit": "第二单元 5以内数的认识和加减法", "category": "algebra",
  "type": "addsub", "difficulty": 1, "spiral_level": 1, "cognitive_level": "remember",
  "applicable_question_types": [{"type":"calc","coefficient":1},{"type":"fill","coefficient":0.6}],
  "operations": ["add","subtract"],
  "concept": "在 5 以内进行加、减法口算，借助实物与点数建立初步数感与运算概念。"
  // …其余字段见 json
}
```

## 6. 下一步（应用，待确认）

沿用 R2-d 脚本模式：`dev/r2d-ontology-apply.js` 同款（草案 → 归档 → 幂等写入），
把 `book/unit/category` 三字段写回 `shared/knowledge-math.js` G1 条目；
应用后跑 verify:m1 + check-knowledge + check-regression + frozen-core 复核。
