/**
 * 标准题目对象（Question）
 *
 * 所有插件 generate() 产出的题目都必须符合本结构，
 * 使综合/容器类生成器能以统一方式
 * 处理任意题型（调用 q.render(idx) 渲染、q.check(...) 判定、q.answer 取标准答案）。
 *
 * @typedef {Object} Question
 * @property {string|number|Array.<string|number>} answer - 标准答案
 * @property {function(number, Object=): string} render - 渲染单题 HTML；参数：序号 idx、可选上下文 ctx
 * @property {function(Object, number): boolean} [check] - 单题判定（可选）；参数：userAnswers 全量映射、序号 idx
 * @property {string} [type] - 题型标识（如 'oral' / 'make-ten' / 'shapes' / 'word'）
 * @property {string} [knowledgePointId] - 知识点 ID（对应 knowledge-bank.js，用于知识点关联）
 * @property {number} [difficulty] - 相对难度 1-10（可选，便于难度说明与排序）
 * @property {string} [question] - 题干文本（展示用）
 * @property {string} [unit] - 单位（展示用）
 * @property {string} [hint] - 提示（展示用）
 * @property {Array} [options] - 选项（选择题用）
 * @property {Object} [meta] - 其他元数据
 */

/**
 * @typedef {Object} ExerciseSet
 * @property {Question[]} questions - 题目数据列表
 * @property {Object} meta - 元信息（年级、题量等）
 */

/**
 * @typedef {Object} CheckResult
 * @property {number} score - 得分
 * @property {number} total - 总题数
 * @property {number} correct - 正确题数
 * @property {string} message - 鼓励语
 * @property {Array<boolean>} results - 每题正确与否
 * @property {Array<string>} correctAnswers - 每题正确答案
 */

/**
 * @typedef {Object} ExercisePlugin
 * @property {string} id - 唯一标识
 * @property {string} name - 显示名称
 * @property {number[]} grades - 适用年级
 * @property {'math'|'chinese'|'english'} subject
 * @property {'number'|'geometry'|'statistics'|'mixed'} [category] - 数学领域（number/geometry/statistics；mixed 为跨领域综合），非数学插件可省略
 * @property {function(Object): ExerciseSet} generate
 * @property {function(ExerciseSet): string} render
 * @property {function(ExerciseSet, Object): CheckResult} check
 * @property {Object} [printConfig]
 */