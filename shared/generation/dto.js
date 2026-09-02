/**
 * shared/generation/dto.js — 生成层标准 DTO 定义 (JSDoc/TypeScript)
 *
 * 所有生成层对外暴露的数据结构集中定义于此。
 * 内部模块 (strategy/generator/validator/presentation) 不得直接被外部导入，
 * 仅通过 GenerationAPI 调用，传入/返回这些标准 DTO。
 *
 * @module shared/generation/dto
 */

/**
 * @typedef {Object} GenerateRequest
 * @property {string} knowledgePointId - 知识点 ID (必填)，格式: subject-g{grade}-{module}-{slug}
 * @property {string} [questionType] - 题型: 'oral'|'calc'|'fill'|'choice'|'judge'|'apply'|'open'|'geometry'|'recognize'
 * @property {number} [targetDifficulty=3] - 目标难度 1-10
 * @property {number} [count=10] - 题量 >=1
 * @property {string} [subject] - 学科: 'math'|'cn'|'en'
 * @property {number} [grade] - 年级 1-6
 * @property {string} [subtype] - 子题型标识
 * @property {string} [cognitiveLevel] - 认知层级: 'recognize'|'understand'|'apply'
 * @property {boolean} [adaptive=false] - 是否启用自适应难度
 * @property {number} [adaptiveDelta=0] - 自适应难度增量 -2..+2
 * @property {boolean} [allowDifficultyOverride=true] - 是否允许用户难度覆盖静态难度
 * @property {Object} [learnerProfile] - 学习者画像 { knowledgePoints:{kpId:{mastery,confidence,recentAccuracy,...}}, ... }
 * @property {Object} [settings] - 题目生成设置 (难度/范围/算符等)
 * @property {Object} [customParams] - 自定义参数透传
 * @property {string} [mode] - 生成模式: 'single-kp'|'multi-kp'|'comprehensive'|'adaptive'
 * @property {string[]} [knowledgePoints] - multi-kp 模式下的知识点列表
 * @property {boolean} [legacyOutput=false] - 是否输出 Legacy Question 格式 (含 render/check)
 * @property {boolean} [skipValidation=false] - 是否跳过验证管道
 */

/**
 * @typedef {Object} QuestionPlan
 * @property {string} planId - 计划唯一标识
 * @property {string} knowledgePointId - 知识点 ID
 * @property {string} questionTypeId - 题型 ID
 * @property {string} [subtype] - 子题型
 * @property {number} count - 本计划生成题量
 * @property {number} difficulty - 最终难度 1-10
 * @property {string} [cognitiveLevel] - 认知层级
 * @property {number} [spiralLevel=1] - 螺旋层级 1-6
 * @property {string} [contextType='standard'] - 情境类型: 'pure'|'simple'|'standard'|'complex'|'none'
 * @property {Object} constraints - 结构约束
 * @property {number} constraints.scale - 难度缩放
 * @property {Object} constraints.numberRange - 数值范围 {min, max}
 * @property {number} constraints.maxSteps - 最大步数
 * @property {boolean} constraints.allowBracket - 是否允许括号
 * @property {boolean} constraints.allowMultDiv - 是否允许乘除
 * @property {string} [operation] - 算符集
 * @property {number} [exactSteps] - 固定步数
 * @property {string} [kind] - 特殊结构 kind
 * @property {Object} generator - 选中的生成器信息
 * @property {string} generator.generatorId - 生成器 ID
 * @property {string} generator.source - 来源: 'priority'|'fallback:legacy'
 * @property {Object} generator.record - 生成器记录
 * @property {string} generator.mode - 运行模式: 'native'|'legacy'|'hybrid'
 */

/**
 * @typedef {Object} SemanticQuestion
 * @property {string} id - 唯一标识 (sq_...)
 * @property {string} version - Schema 版本
 * @property {string} knowledgePoint - 知识点 ID
 * @property {string} knowledgePointId - 知识点 ID (别名)
 * @property {string} skill - 技能标识
 * @property {number} difficulty - 难度 1-10
 * @property {Object} difficultyParams - 难度参数 {level, scale, steps, allowBracket, allowMultDiv}
 * @property {Object} numberRange - 数值范围 {min, max}
 * @property {number} spiralLevel - 螺旋层级
 * @property {string} context - 情境类型
 * @property {string} [seed] - 随机种子
 * @property {string} [cognitiveLevel] - 认知层级
 * @property {Object} content - 内容对象 {prompt, stem, materials[]}
 * @property {Object} question - 题目核心 {prompt, answerMode, options[]}
 * @property {Object} answer - 答案 {value, acceptable[]}
 * @property {Array<Object>} distractors - 干扰项 [{value, errorType, weight}]
 * @property {Object} graphic - 图形描述 {type, subtype, params, renderHints}
 * @property {Object} metadata - 可追溯元数据 {generator, generatorVersion, seed, planId, timestamp, retryCount, validationScore, tags[]}
 * @property {Function} [render] - 兼容字段: 旧渲染函数 (仅 Legacy 路径填充)
 * @property {Function} [check] - 兼容字段: 旧判分函数 (仅 Legacy 路径填充)
 * @property {string} [svg] - 兼容字段: 旧 SVG 字符串
 * @property {string} questionType - 题型
 * @property {string} [answerMode] - 答题模式: 'input'|'choice'|'multi'|'none'|'read-aloud'
 * @property {string} [type] - 类型别名
 * @property {string} [hint] - 提示
 * @property {Object} [numberRange] - 数值范围别名
 */

/**
 * @typedef {Object} RenderResult
 * @property {string} html - 单题 HTML 片段
 * @property {string} graphic - SVG 字符串或空串
 * @property {Object} metadata - 渲染元数据 {renderer, version}
 * @property {string} [id] - 题目 ID
 * @property {string} [questionType] - 题型
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 是否通过
 * @property {Array<Object>} errors - 错误列表 [{code, field, message, severity, detail}]
 * @property {Array<Object>} warnings - 警告列表
 * @property {Array<Object>} info - 信息列表
 * @property {number} score - 单题评分 0-1
 * @property {Object} checks - 详细检查项
 * @property {Set} [seenKeys] - 去重键集合 (批量验证时共享)
 */

/**
 * @typedef {Object} BatchValidationResult
 * @property {boolean} valid - 整批是否通过
 * @property {Array<Object>} errors - 汇总错误
 * @property {Array<Object>} warnings - 汇总警告
 * @property {Array<Object>} info - 汇总信息
 * @property {number} score - 平均分
 * @property {Object} checks - 汇总检查项
 * @property {number} [duplicateRate] - 重复率
 * @property {Object} [qualitySummary] - 质量摘要 {average, breakdown}
 */

/**
 * @typedef {Object} GenerateResult
 * @property {Array<SemanticQuestion>} questions - 生成的语义题目数组
 * @property {Array<RenderResult>} items - 渲染结果数组
 * @property {string} html - 拼接后的完整 HTML
 * @property {Array<QuestionPlan>} plans - 使用的计划列表
 * @property {Object} trace - 执行轨迹 {mode, kps?, failedPlans[]}
 * @property {Object} renderOptions - 实际使用的渲染选项
 * @property {Array<Object>} failedPlans - 失败的计划 [{planId, error}]
 */

/**
 * @typedef {Object} LegacyGenerateOptions
 * @property {string} pluginId - 旧插件 ID (必填)
 * @property {number} [grade] - 年级
 * @property {number} [count] - 题量
 * @property {number} [difficulty] - 难度
 * @property {string} [questionType] - 题型
 * @property {string} [subtype] - 子题型
 * @property {Object} [settings] - 设置
 * @property {Object} [settingNums] - 数值设置
 */

/**
 * @typedef {Object} LegacyGenerateResult
 * @property {Object} set - 旧插件返回的原始 exerciseSet {questions[], meta}
 * @property {string} source - 'legacy'
 * @property {Object|null} renderOptions - 无渲染选项
 */

/**
 * @typedef {Object} RenderOptions
 * @property {string} [mode='screen'] - 渲染模式: 'screen'|'print'|'preview'
 * @property {string} [theme='default'] - 主题
 * @property {string} [device='desktop'] - 设备: 'desktop'|'mobile'
 * @property {string} [density='normal'] - 密度: 'compact'|'normal'|'comfortable'
 */

/**
 * @typedef {Object} PlanValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

'use strict';

module.exports = {
  // 类型定义仅供 JSDoc/TypeScript 使用，运行时无导出
};