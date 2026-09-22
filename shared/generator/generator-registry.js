/**
 * shared/generator/generator-registry.js — M4-R03 Generator Registry
 *
 * 只读、纯数据的 Generator 注册表。仅保存声明：
 *   Generator ID / subject / capabilities / supported question types /
 *   supported knowledge points / version
 *
 * 禁止保存执行函数源码（运行时 Gate 校验：所有记录必须 JSON 可序列化）。
 *
 * 查询关系（KnowledgePoint → Capability → Generator）：
 *   forKnowledgePoint(kpId)     → 服务该 KP 的 Generator 列表
 *   forQuestionType(qtId)       → 具备该题型的 Generator 列表
 *   resolveChain(kpId)          → { kp, capabilityQuestionTypes, generators }
 */
'use strict';

// MATH-14：legacy 插件轨道已删除。注册表仅保留 native core Generator，
// 不再合并 generator-capability-registry 的 legacy 记录（无 fallback 宿主）。

// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
var CORE_RECORDS = [
  // P25-09：B/C 类 KP 语义重绑——整数运算 KP 归位到对应算术生成器（原无绑定/误绑）。
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-down-u04-k002', 'math-g1-down-u05-k001', 'math-g1-down-u06-k001', 'math-g1-up-u01-k002', 'math-g1-up-u01-k003', 'math-g1-up-u04-k003', 'math-g1-up-u05-k001', 'math-g1-up-u05-k002', 'math-g2-down-u04-k007', 'math-g2-down-u05-k001', 'math-g2-down-u05-k003', 'math-g4-down-u03-k001', 'math-g4-up-u04-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-down-u02-k001', 'math-g1-down-u02-k002', 'math-g1-down-u03-k001', 'math-g1-down-u04-k001', 'math-g1-down-u04-k003', 'math-g1-down-u04-k004', 'math-g1-down-u05-k002', 'math-g1-up-u04-k001', 'math-g2-up-u02-k002', 'math-g2-up-u02-k004', 'math-g2-down-u05-k002', 'math-g4-down-u03-k002', 'math-g4-up-u01-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g2-up-u02-k001', 'math-g2-up-u02-k003', 'math-g3-up-u05-k001', 'math-g3-up-u05-k002', 'math-g3-up-u05-k003', 'math-g3-up-u05-k004', 'math-g3-up-u05-k005', 'math-g4-up-u03-k001', 'math-g4-up-u03-k002', 'math-g4-up-u03-k003', 'math-g4-down-u03-k003', 'math-g4-up-u04-k002', 'math-g4-up-u04-k003', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g2-down-u02-k001', 'math-g2-down-u02-k002', 'math-g2-down-u02-k003', 'math-g2-down-u02-k004', 'math-g2-down-u03-k002', 'math-g2-down-u03-k006', 'math-g2-up-u03-k001', 'math-g2-up-u03-k002', 'math-g2-up-u03-k003', 'math-g2-up-u03-k004', 'math-g2-up-u03-k005', 'math-g2-up-u07-k002', 'math-g3-down-u02-k001', 'math-g3-down-u02-k002', 'math-g3-down-u02-k003', 'math-g3-down-u02-k004', 'math-g3-down-u02-k005', 'math-g3-down-u02-k006', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g5-down-u02-k001', 'math-g5-down-u02-k002', 'math-g5-up-u03-k003'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-up-u02-k002', 'math-g3-up-u02-k001', 'math-g3-up-u02-k002', 'math-g3-up-u02-k003', 'math-g3-up-u02-k004', 'math-g4-down-u01-k003', 'math-g4-down-u03-k004', 'math-g6-up-u02-k002', 'math-g6-up-u02-k003', 'math-g6-up-u02-k004'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill', 'geometry', 'calc', 'apply'], questionTypes: ['fill', 'geometry', 'calc', 'apply'], knowledgePoints: ['math-g2-down-u07-k002'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice', 'geometry', 'calc', 'apply'], questionTypes: ['choice', 'geometry', 'calc', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge', 'geometry', 'calc', 'apply'], questionTypes: ['judge', 'geometry', 'calc', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  // P25-09：原 5 个误绑 KP 已全部迁出（g1-up-u03-k001→shape；g2-down-u04-k002/3/4/6→concept）。
  // FINAL-20：complex-calc dormant（0 mapping、0 evidence、重复能力被算术族全覆盖），从生产 bundle 排除。源码保留。

  // P0-04 Step 15-20: 新增形状/位置/金钱/应用题 Generator
  // P25-07：version 升 2（classification choice 选项 null 修复 + flat 语义回退）；
  // 摘除 'oral'（历史 token，归一后即 calc——shape 无列式形态，不得 claim form-bound 的 calc）
  // P25-08：绑定 D 类 geometric-figure(40) + geometric-measurement(12) 共 52 个 KP；
  // shape.js 已改为从 plan.semanticParams.name 派生具体图形类型，并新增 calc 度量计算 maker。
  // P25-09：补 g1-up-u03-k001（立体图形初识，原误绑 complex-calc）、
  // g3-down-u03-k001（多边形/长正方形特点，原误绑 stats）、g5-down-u09-k001/k002（正方体涂色）；
  // g3-up-u06-k001（数字编码）移交 code-recognition；
  // g3-up-u07-k002（角的认识）/g3-down-u04-k001（面积的认识）/g6-up-u07-k001（寻找负数）
  // 移交 concept-meaning 专属 maker（含 geometry/judge 行覆盖）。
  { id: 'generator:shape-recognition', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g3-down-u05-k001', 'math-g4-down-u02-k001', 'math-g4-down-u07-k001', 'math-g4-down-u07-k002', 'math-g5-down-u01-k001', 'math-g5-down-u03-k004', 'math-g5-down-u03-k005', 'math-g5-down-u05-k001', 'math-g5-down-u05-k002', 'math-g5-down-u05-k003', 'math-g5-down-u05-k004', 'math-g5-up-u06-k001', 'math-g5-up-u06-k002', 'math-g5-up-u06-k003', 'math-g5-up-u06-k004', 'math-g5-up-u06-k005', 'math-g5-up-u06-k006', 'math-g6-down-u03-k001', 'math-g6-down-u03-k002', 'math-g6-down-u03-k003', 'math-g6-down-u03-k004', 'math-g6-up-u02-k001', 'math-g1-down-u01-k001', 'math-g1-up-u03-k002', 'math-g2-up-u05-k003', 'math-g2-up-u05-k004', 'math-g2-up-u06-k001', 'math-g3-down-u01-k001', 'math-g3-down-u03-k004', 'math-g3-down-u08-k003', 'math-g3-down-u08-k006', 'math-g3-up-u01-k002', 'math-g3-up-u01-k003', 'math-g3-up-u03-k003', 'math-g3-up-u03-k004', 'math-g3-up-u07-k001', 'math-g3-up-u07-k004', 'math-g4-down-u02-k002', 'math-g4-down-u05-k001', 'math-g4-down-u05-k002', 'math-g4-down-u05-k003', 'math-g4-down-u05-k004', 'math-g4-down-u05-k005', 'math-g4-down-u05-k006', 'math-g4-up-u02-k001', 'math-g4-up-u02-k003', 'math-g4-up-u05-k001', 'math-g4-up-u05-k002', 'math-g4-up-u05-k003', 'math-g4-up-u05-k004', 'math-g5-down-u01-k002', 'math-g5-down-u03-k001', 'math-g5-down-u03-k002', 'math-g5-up-u08-k001', 'math-g5-up-u08-k002', 'math-g5-up-u08-k003', 'math-g5-up-u08-k004', 'math-g6-down-u03-k006', 'math-g6-up-u04-k001', 'math-g6-up-u04-k004', 'math-g6-up-u04-k005', 'math-g2-up-u05-k002', 'math-g3-down-u03-k002', 'math-g3-down-u03-k003', 'math-g3-down-u04-k003', 'math-g3-down-u04-k005', 'math-g3-up-u07-k003', 'math-g4-up-u02-k002', 'math-g5-down-u03-k003', 'math-g6-down-u03-k005', 'math-g6-up-u04-k002', 'math-g6-up-u04-k003', 'math-g1-up-u03-k001', 'math-g3-down-u03-k001', 'math-g5-down-u09-k001', 'math-g5-down-u09-k002',
      // P25-09 geometry 行显式双绑（10 KP）：下列 KP 的非 geometry 行仍由 money/application/
      // arithmetic 本体承载（kp=1+cap=1 胜出），仅 geometry（操作/作图意图）经 form-bound
      // 声明门过滤后由本生成器 kp=1 显式承载，消除 kp=0 隐式兜底（与 stats×classification 双绑同构）。
      'math-g2-up-u05-k001', 'math-g2-up-u05-k005', 'math-g3-down-u04-k002', 'math-g3-down-u04-k004',
      'math-g3-up-u03-k001', 'math-g3-up-u03-k002', 'math-g5-down-u03-k006',
      'math-g6-up-u02-k002', 'math-g6-up-u02-k003', 'math-g6-up-u02-k004'],
    scope: 'core', version: 3, supportsComposite: false },
  { id: 'generator:position-direction', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'geometry', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    knowledgePoints: ['math-g2-up-u04-k003', 'math-g2-up-u04-k004', 'math-g3-down-u01-k002', 'math-g3-down-u01-k003', 'math-g3-down-u01-k004', 'math-g3-up-u01-k001', 'math-g4-down-u02-k003', 'math-g4-down-u07-k003', 'math-g4-down-u07-k004', 'math-g4-down-u07-k005', 'math-g5-down-u01-k003', 'math-g5-up-u01-k001', 'math-g5-up-u01-k003', 'math-g5-up-u04-k001', 'math-g5-up-u04-k002', 'math-g6-up-u01-k001', 'math-g6-up-u01-k002', 'math-g6-up-u01-k003', 'math-g2-up-u04-k001', 'math-g2-up-u04-k002', 'math-g5-up-u01-k002', 'math-g4-up-u08-k001', 'math-g4-up-u08-k002', 'math-g4-up-u08-k003', 'math-g5-up-u04-k003'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:money-measurement', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply', 'calc'], questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc'],
    knowledgePoints: ['math-g1-down-u07-k001', 'math-g1-down-u07-k002', 'math-g2-up-u05-k001', 'math-g2-up-u05-k005', 'math-g3-down-u04-k002', 'math-g3-down-u04-k004', 'math-g3-up-u03-k001', 'math-g3-up-u03-k002', 'math-g1-down-u07-k003', 'math-g3-up-u04-k002', 'math-g3-up-u04-k003', 'math-g3-up-u04-k004'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:application-word', subject: 'math', capabilities: ['apply', 'fill', 'choice', 'judge', 'calc'], questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc'],
    knowledgePoints: ['math-g4-up-u06-k001', 'math-g5-down-u03-k006', 'math-g1-down-u08-k001', 'math-g2-up-u08-k001', 'math-g3-up-u09-k001', 'math-g4-down-u10-k001', 'math-g4-up-u09-k001', 'math-g5-down-u11-k001', 'math-g5-up-u09-k001', 'math-g6-down-u06-k001', 'math-g6-up-u06-k001', 'math-g1-down-u02-k003', 'math-g1-down-u04-k005', 'math-g1-down-u05-k003', 'math-g1-down-u06-k003', 'math-g1-up-u05-k003', 'math-g1-up-u06-k001', 'math-g2-down-u05-k004', 'math-g2-down-u06-k001', 'math-g2-down-u06-k002', 'math-g2-down-u06-k003', 'math-g2-down-u06-k004', 'math-g2-down-u07-k001', 'math-g2-down-u07-k003', 'math-g3-down-u08-k002', 'math-g3-down-u08-k005', 'math-g3-up-u02-k005', 'math-g3-up-u04-k001', 'math-g4-down-u01-k004', 'math-g4-down-u09-k003', 'math-g5-up-u03-k006', 'math-g5-down-u09-k003', 'math-g6-down-u01-k005'],
    scope: 'core', version: 2, supportsComposite: false },

  // P0-07 Step 32: Composite Generator（仅三种模式，supportsComposite=true）
  { id: 'generator:counting', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g3-down-u08-k001', 'math-g3-up-u08-k001'],
    scope: 'core', version: 1, supportsComposite: false },
  // P25-07：reasoning 产出「推理问答题」形态，不承载 calc（calc 为 form-bound，
  // 未声明即不入候选，(g2-up-u07-k001, calc) 由算术兜底承载）。
  // P25-09：cap 扩 calc/fill/choice（reasoning.js 已补对应 maker）；
  // 承接推理/策略/找规律类 C 类 KP（列表法、找次品最优策略、打电话/运筹、鸽巢一般形式等）。
  // g4-up-u08-k002（描述位置）移交 position-direction。
  { id: 'generator:reasoning', subject: 'math', capabilities: ['apply', 'calc', 'fill', 'choice'], questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: ['math-g2-up-u07-k001', 'math-g4-down-u09-k001', 'math-g4-down-u09-k002', 'math-g5-down-u08-k001', 'math-g5-down-u08-k002', 'math-g5-down-u08-k003', 'math-g5-down-u10-k001', 'math-g5-down-u10-k002', 'math-g5-down-u10-k003', 'math-g5-down-u10-k004', 'math-g5-up-u07-k002', 'math-g6-down-u05-k001', 'math-g6-down-u05-k002', 'math-g6-down-u05-k003', 'math-g6-down-u05-k004'],
    scope: 'core', version: 1, supportsComposite: false },
  // P25-09：cap 扩 fill/choice（stats.js 补时间/日历 maker 与全 type 选项）；
  // 绑定统计图表之外的时间/日历/综合实践统计 KP；移出几何/位置/负数误绑。
  // 图表 KP 的 judge/classify 行仍由 classification v2 以 kp=1 承载。
  { id: 'generator:stats', subject: 'math', capabilities: ['apply', 'calc', 'fill', 'choice'], questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: ['math-g2-down-u01-k001', 'math-g2-down-u01-k002', 'math-g2-down-u01-k003', 'math-g3-down-u06-k001', 'math-g3-down-u06-k002', 'math-g3-down-u08-k004', 'math-g4-down-u08-k004', 'math-g4-up-u07-k001', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:picture-equation', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-down-u01-k001', 'math-g5-up-u07-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  // FINAL-20：c1/c2/c5-c6/c7/c9 dormant（0 mapping、0 evidence、竞赛 C 族预留），从生产 bundle 排除。源码保留。
  { id: 'generator:composite', subject: 'math', capabilities: ['calc', 'judge', 'fill', 'apply'], questionTypes: ['calc', 'judge', 'fill', 'apply'],
    knowledgePoints: ['math-g1-up-u01-k001', 'math-g2-down-u07-k001', 'math-g2-up-u01-k005', 'math-g3-up-u02-k001', 'math-g4-up-u03-k001'],
    scope: 'core', version: 1, supportsComposite: true },

  // V2.1 专项语义生成器（新教材补录 KP 的专用逻辑，native 绑定保证语义正确路由）
  // P25-07：摘除 'recognize'（normList 归一后即 geometry）——编码题目无图形表征，
  // geometry 为 form-bound，未声明即不入候选，(g4-up-u01-k002, geometry) 由 shape-recognition 承载。
  // P25-09：绑定 g3-up-u06 数字编码单元 5 KP（身份证/邮编/编码特点/实践）；
  // cap 增 apply（CODE_BANK 含 5 类长情境题）；g4-up-u01-k002（数位与数级）移交 concept-meaning。
  { id: 'generator:code-recognition', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply'], questionTypes: ['fill', 'choice', 'judge', 'apply'],
    knowledgePoints: ['math-g3-up-u06-k001', 'math-g3-up-u06-k002', 'math-g3-up-u06-k003', 'math-g3-up-u06-k004', 'math-g3-up-u06-k005'],
    scope: 'core', version: 2, supportsComposite: false },
  // FINAL-20：equivalent-reasoning dormant（0 mapping、0 evidence、重复能力全覆盖），注册条目移除。源码已从 semantic-special.js 清除。

  // V2.1 补充：分类整理生成器（补齐 7 类规范题型中唯一无生成器的 classify）
  // P17-10：knowledgePoints 重对齐为 canonical 生成映射（shared/knowledge/mappings/generation-contract/math.json
  // 真值源，classify→generator:classification 共 25 条）。旧绑定（g3-g4 4 条）为 legacy 残留（DEV_LOG:1838「非运行时绑定」）。
  // 25 个 canonical classify 载体同时被 shape-recognition 等泛型家族部分绑定；classify 计划下
  // classification 依 kp 并列后靠 capability/qt 胜出（配合 generator-selector 分类语义域提升），非 classify 计划不受影响。
  { id: 'generator:classification', subject: 'math', capabilities: ['classify'], questionTypes: ['classify'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003', 'math-g2-up-u01-k004', 'math-g2-up-u01-k005', 'math-g2-up-u01-k006', 'math-g3-down-u05-k001', 'math-g3-down-u05-k002', 'math-g3-down-u05-k003', 'math-g3-down-u05-k004', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g4-up-u06-k004', 'math-g4-down-u08-k001', 'math-g4-down-u08-k002', 'math-g4-down-u08-k003', 'math-g4-down-u08-k004', 'math-g5-up-u07-k001', 'math-g5-up-u07-k002', 'math-g5-up-u07-k003', 'math-g5-up-u07-k004', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'],
    scope: 'core', version: 2, supportsComposite: false },

  // P24-02：百分数单元语义生成器（意义/互化/折扣/利率/达标线/解决问题）。
  // 6 个 canonical KP 此前被误绑 shape-recognition，calc 真实生成 0 题（1570 探针 15 失败项）。
  // choice 仍由 generation-contract 指定的 generator:selection-choice 承载。
  // P25-09：承接 g6-down-u02 折扣/成数/税率/利率/生活百分数 5 KP（maker 已补齐）。
  { id: 'generator:percent-calc', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'],
    knowledgePoints: ['math-g6-up-u05-k001', 'math-g6-up-u05-k002', 'math-g6-up-u05-k003', 'math-g6-up-u05-k004', 'math-g6-up-u05-k005', 'math-g6-up-u05-k006', 'math-g6-down-u02-k001', 'math-g6-down-u02-k002', 'math-g6-down-u02-k003', 'math-g6-down-u02-k004', 'math-g6-down-u02-k005'],
    scope: 'core', version: 1, supportsComposite: false },

  // P25-04：A 类代表 KP 概念语义生成器（倍的认识/角的认识/面积的认识/分数的意义）。
  // 此前 4 KP 无原生绑定，calc/fill 被泛型兜底产出错误语义题（加法题冒充倍、编码题冒充分数）。
  // 规则行（KP×calc/fill）的产出在 data.semanticEvidence 按题声明语义关系，对应
  // kbl/teaching/evidence-rules.json（验证器第 7 检查 checkSemanticEvidence，声明制）。
  // capabilities 覆盖 4 KP 全部 ALLOW 题型：native binding 下 kp=1 胜出不分题型，
  // 未覆盖题型会导致该 ALLOW 行 0 产出破坏 verify:allow-gen 1570 门禁。
  // P25-09：扩绑 37 个数概念/数论/负数/字母表示/乘除关系/倍 KP（共 41 个，见 bc-subcheck 审计）。
  // 角的认识/面积的认识/寻找负数 3 KP 同时从 shape-recognition 解绑，由 concept 专属 maker
  //独立承载（不采用升版本的方式：高版本会在 kp=0 行反向截胡 shape 的几何兜底）。
  { id: 'generator:concept-meaning', subject: 'math', capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'], questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    knowledgePoints: ['math-g2-down-u03-k003', 'math-g3-up-u07-k002', 'math-g3-down-u04-k001', 'math-g5-down-u04-k001', 'math-g1-down-u03-k002', 'math-g1-down-u03-k003', 'math-g1-down-u03-k004', 'math-g1-down-u03-k005', 'math-g1-down-u03-k006', 'math-g1-up-u02-k001', 'math-g1-up-u04-k002', 'math-g2-down-u04-k001', 'math-g2-down-u04-k002', 'math-g2-down-u04-k003', 'math-g2-down-u04-k004', 'math-g2-down-u04-k005', 'math-g2-down-u04-k006', 'math-g4-up-u01-k002', 'math-g4-up-u01-k003', 'math-g4-up-u01-k004', 'math-g4-up-u01-k005', 'math-g4-up-u01-k006', 'math-g5-up-u05-k004', 'math-g5-down-u02-k003', 'math-g5-down-u02-k004', 'math-g5-down-u02-k005', 'math-g5-down-u02-k006', 'math-g6-down-u01-k001', 'math-g6-down-u01-k002', 'math-g6-down-u01-k003', 'math-g6-down-u01-k004', 'math-g6-up-u07-k001', 'math-g6-up-u07-k002', 'math-g6-up-u07-k003', 'math-g5-up-u05-k001', 'math-g5-up-u05-k002', 'math-g5-up-u05-k003', 'math-g2-down-u03-k001', 'math-g4-down-u01-k002', 'math-g2-down-u03-k004', 'math-g2-down-u03-k005', 'math-g1-up-u01-k001'],
    scope: 'core', version: 1, supportsComposite: false },

  // P25-09：比例单元 6 KP 归入语义关系族（比例意义/性质/解比例/正反比例/比例尺，
  // scale-map、ratio-basics、proportion-application maker 已就绪，fail-closed 审计全绿）。
  { id: 'generator:semantic-relations', subject: 'math', capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry'], questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry'],
    knowledgePoints: ['math-g1-down-u06-k002', 'math-g2-down-u02-k005', 'math-g6-down-u04-k001', 'math-g6-down-u04-k002', 'math-g6-down-u04-k003', 'math-g6-down-u04-k004', 'math-g6-down-u04-k005', 'math-g6-down-u04-k006', 'math-g6-down-u04-k007', 'math-g6-down-u04-k008'],
    scope: 'core', version: 1, supportsComposite: false },

  // P25-09：小数/分数专项语义生成器（按 KP 名称派生 subtype，12/11 个 maker 分支）。
  // 小数 24 KP（g3 初步认识 → g5 乘除），分数 19 KP（g3 初步 → g6 除法单元）。
  { id: 'generator:decimal-number', subject: 'math', capabilities: ['calc', 'fill', 'choice', 'apply'], questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: ['math-g3-down-u07-k001', 'math-g3-down-u07-k002', 'math-g3-down-u07-k003', 'math-g3-down-u07-k004', 'math-g4-down-u04-k001', 'math-g4-down-u04-k002', 'math-g4-down-u04-k003', 'math-g4-down-u04-k004', 'math-g4-down-u04-k005', 'math-g4-down-u04-k006', 'math-g4-down-u04-k007', 'math-g4-down-u06-k001', 'math-g4-down-u06-k002', 'math-g4-down-u06-k003', 'math-g4-down-u06-k004', 'math-g5-up-u02-k001', 'math-g5-up-u02-k002', 'math-g5-up-u02-k003', 'math-g5-up-u02-k004', 'math-g5-up-u02-k005', 'math-g5-up-u03-k001', 'math-g5-up-u03-k002', 'math-g5-up-u03-k004', 'math-g5-up-u03-k005'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:fraction-number', subject: 'math', capabilities: ['calc', 'fill', 'choice', 'apply'], questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: ['math-g3-up-u08-k002', 'math-g3-up-u08-k003', 'math-g3-up-u08-k004', 'math-g3-up-u08-k005', 'math-g5-down-u04-k002', 'math-g5-down-u04-k003', 'math-g5-down-u04-k004', 'math-g5-down-u04-k005', 'math-g5-down-u04-k006', 'math-g5-down-u06-k001', 'math-g5-down-u06-k002', 'math-g5-down-u06-k003', 'math-g5-down-u06-k004', 'math-g5-down-u06-k005', 'math-g6-up-u03-k001', 'math-g6-up-u03-k002', 'math-g6-up-u03-k003', 'math-g6-up-u03-k004', 'math-g6-up-u03-k005'],
    scope: 'core', version: 1, supportsComposite: false }
];

// 7 类规范题型（知识点驱动）：CORE_RECORDS 的 capability / questionTypes 声明
// 一律为 canonical 7 类；历史 token（oral/recognize/open）仅在 request/策略入口
// 经 question-type-registry.normalizeQuestionType 归一，不得进入能力声明。
// normList 保留为归一兜底，保证下游暴露的 capability / questionTypes 恒为规范 7 类。
var QTR = (function () {
  try { return require('../knowledge/question-type-registry.js'); }
  catch (e) {
    return (typeof window !== 'undefined' && window.QuestionTypeRegistry) ||
      (typeof globalThis !== 'undefined' && globalThis.QuestionTypeRegistry) || null;
  }
})();

function normToken(tok) {
  if (!tok || typeof tok !== 'string') return tok;
  if (!QTR) return tok;
  var r = QTR.normalizeQuestionType(tok, { allowHeuristic: false });
  return (r && r.id) ? r.id : tok;
}

function normList(arr) {
  if (!Array.isArray(arr)) return arr;
  var seen = {}, out = [];
  arr.forEach(function (t) {
    var n = normToken(t);
    if (n && !seen[n]) { seen[n] = 1; out.push(n); }
  });
  return out;
}

function buildRecords() {
  // MATH-14：legacy 轨道已删除，注册表仅含 native core Generator。
  // （历史上曾合并 generator-capability-registry 的 legacy 插件记录，已移除。）
  return CORE_RECORDS.map(function (r) {
    return {
      id: r.id,
      subject: r.subject,
      capabilities: normList(r.capabilities),
      questionTypes: normList(r.questionTypes),
      knowledgePoints: r.knowledgePoints,
      scope: r.scope,
      version: r.version,
      supportsComposite: r.supportsComposite
    };
  });
}

var _records = null;
var _kpCache = null;      // M11-R02: kpId -> generators[]
var _qtCache = null;      // M11-R02: qtId -> generators[]

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function invalidateCaches() {
  _kpCache = null;
  _qtCache = null;
}

function get(id) {
  for (var i = 0; i < records().length; i++) {
    if (records()[i].id === id) return records()[i];
  }
  return null;
}

function all() {
  return records().slice();
}

function forKnowledgePoint(kpId) {
  if (!_kpCache) _kpCache = {};
  if (_kpCache[kpId]) return _kpCache[kpId];
  var result = records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
  return (_kpCache[kpId] = result);
}

function forQuestionType(qtId) {
  if (!_qtCache) _qtCache = {};
  if (_qtCache[qtId]) return _qtCache[qtId];
  var result = records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
  return (_qtCache[qtId] = result);
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require('../knowledge/knowledge-point.js');
  var Resolver = require('../capability/capability-resolver.js');
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var capabilityQuestionTypes = Resolver.getCapabilities(kp).questionTypes || [];
  return {
    knowledgePointId: kpId,
    capabilityQuestionTypes: capabilityQuestionTypes,
    generators: forKnowledgePoint(kpId).map(function (r) { return r.id; })
  };
}

/**
 * M4-R12 知识点绑定迁移：KnowledgePoint → Capabilities → Generator Registry。
 *
 * 在 Canonical KP 上注入：
 *   capabilities     —— 该 KP 能由哪些能力生成（Generator Registry 推导，覆盖类型级 capability）
 *   legacyPluginId   —— 迁移兼容字段（保留原 pluginId 引用，逐步淘汰）
 *
 * 不修改知识层 / 插件；只读增强返回同一对象（浅注入）。
 */
function enhanceKp(kp) {
  if (!kp || typeof kp !== 'object' || !kp.id) return kp;

  var generators = forKnowledgePoint(kp.id);
  var capabilities = [];
  generators.forEach(function (g) {
    (g.capabilities || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
    // 核心 Generator 的语义能力（scope=core 无 KP 绑定，由题型/能力反查补充）
    (g.questionTypes || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
  });

  // 无 Generator 直接绑定该 KP 时，回退解析链（CapabilityResolver 的能力集）
  if (capabilities.length === 0) {
    var Resolver = require('../capability/capability-resolver.js');
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  // MATH-14：legacy 轨道已删，不再注入 legacyPluginId。
  return kp;
}

module.exports = {
  records: records,
  get: get,
  all: all,
  forKnowledgePoint: forKnowledgePoint,
  forQuestionType: forQuestionType,
  forSubject: forSubject,
  resolveChain: resolveChain,
  enhanceKp: enhanceKp,
  invalidateCaches: invalidateCaches
};
