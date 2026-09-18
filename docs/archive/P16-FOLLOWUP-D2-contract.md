# P16-FOLLOWUP-D2：POL Contract 冻结

## C2-01 冻结 PracticeRequest

### 定义
PracticeRequest只表达用户需求，不包含任何生成算法参数。

### 唯一字段
```text
subject          - 学科，固定为 math
grade            - 年级，范围 g1–g6
knowledge scope  - 知识点范围（由 KBL 决定，不直接读取KBL文件）
questionTypes    - 题型集合（由CANONICAL_TYPES决定）
count            - 请求题目数量
difficulty       - 难度等级（1-10，由POL决定）
style            - 练习风格
cognitive        - 认知层级
adaptive         - 是否自适应
```

### 禁止字段
```text
generatorId      - 禁止：交给Generator决定
svg              - 禁止：交给Presentation渲染
DOM              - 禁止：交给DOM渲染
render           - 禁止：交给Presentation层
generator内部参数 - 禁止：Algorithm参数
```

---

## C2-02 冻结 PracticePlan

### 定义
PracticePlan负责调度，不包含生成细节。

### 结构
```js
{
  plannedTotal,      // 总题目数
  cells: [           // Cell数组
    {
      cellId,        // Cell唯一标识
      knowledgeId,   // KPs唯一标识
      questionType,  // 题型
      difficulty,      // 难度等级
      planned,       // 计划生成数
      context        // 执行上下文
    }
  ]
}
```

### 明确字段
- `plannedTotal`：总计划题目数
- `cells[]`：Cell数组，每个Cell包含上述必需字段

### 禁止字段
```text
planLevel        - 禁止：POL内部层级详情
parentCount      - 禁止：父级计数
combine          - 禁止：组合标志
budget算法       - 禁止：预算算法细节
capacity内部数据 - 禁止：容量内部数据
round-robin状态 - 禁止：轮转状态
```

---

## C2-03 冻结 GenerationPlan

### 定义
GenerationPlan是POL交给Generation的最终执行计划。

### 最小结构
```js
{
  totalPlanned,      // 总计划题目数
  cells: [           // Cell数组
    {
      cellId,          // Cell唯一标识
      knowledgeId,     // KPs唯一标识
      questionType,    // 题型
      difficulty,      // 难度
      planned,         // 计划数
      context          // 执行上下文
    }
  ]
}
```

### 禁止内容
尤其不要把POL内部规划字段全部塞进去：
- `planLevel`
- `parentCount`
- `combine`
- `budget算法`
- `capacity内部数据`
- `round-robin状态`

---

## C2-04 Cell

### 正式定义
Cell是POL与Generation的唯一业务契约。

### 必须明确
```text
cellId
knowledgeId
questionType
difficulty
planned
context
```

### 原则
> **Generator只能执行Cell，不能重新解释Cell。**

### 示例
POL:
```text
knowledgeId = G1-U01-K001
type = calc
difficulty = 5
planned = 3
```

Generation:
```text
必须生成：
G1-U01-K001
calc
difficulty 5
3题
```

不能自行变成：
```text
fill
difficulty 3
5题
```
