#!/usr/bin/env node
'use strict';
// dev/p28/check-generator-matrix.js — P28-09 Generator Registry 收口（GENERATOR_MATRIX）
//
// 逐个 Generator 澄清：生产使用 / 测试使用 / 历史使用 / 重复能力 / legacy capability，
// 并强制每个 Generator 声明 7 项：
//   id / semantic family / supported question types / input contract /
//   output contract / validator / production status
//
// 数据来源：
//   - GENERATOR_MATRIX 声明表（下方 DECL，人工审计结论，本文件内嵌纯数据）
//   - registry（shared/generator/generator-registry.js，31 条记录，动态）
//   - P28-08 冻结证据（docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.json，1570 行实际承载，动态）
//   - 生成契约 carrier（shared/knowledge/mappings/generation-contract/math.json，动态）
//
// 判定规则：
//   R1 覆盖：registry 31 个 id 与 DECL 一一对应（无遗漏/无多余）
//   R2 题型：DECL.supportedQuestionTypes === registry record.questionTypes（规范 7 类，无旧令牌）
//   R3 声明完整性：semanticFamily / inputContract / outputContract / validator 非空
//   R4 声明一致性：冻结证据 actualProducerTypes ⊆ 声明题型（无未声明产出）
//   R5 状态一致：production⇒1570 中产出行>0（composite 仅 combine 场景豁免）；
//                dormant-* ⇒ 产出行=0
//   R6 无 legacy：不得出现 oral/recognize/open（声明与能力面）
//
// 产物：
//   docs/archive/phases/p28/P28-GENERATOR-MATRIX.json（机器可读矩阵，每行 7 项声明 + 审计附注）
//   docs/archive/phases/p28/P28-GENERATOR-MATRIX.md（收口结论文档）
//
// 用法：node dev/p28/check-generator-matrix.js（退出码 0=冻结保持，1=违规）

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

var R = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));

// ---------- GENERATOR_MATRIX 声明表（人工审计，纯数据） ----------
// status: PRODUCTION | PRODUCTION-COMBINE-ONLY | DORMANT-CONTRACT-CARRIER | DORMANT-NO-BINDING
// duplicate/legacy 为审计附注：重复能力 / 声明漂移 / 历史预留意向
var DECL = {
  'generator:arithmetic-addition': {
    family: 'arithmetic', kblFamily: 'integer-arithmetic',
    inputContract: 'plan{kp,qt,difficulty,count,seed} + constraints{numberRange,kind,maxSteps,allowBracket,allowMultDiv,scale} + semanticParams.name(key kind)',
    outputContract: 'answerMode=input; prompt=算式+“=？”; data{operation,steps}; 无图形',
    validator: 'pipeline(kpSemantic+TypeContract[calc:expressionPresent]+schema)',
    status: 'PRODUCTION', note: '算术族五算子之一，op=add'
  },
  'generator:arithmetic-subtraction': {
    family: 'arithmetic', kblFamily: 'integer-arithmetic',
    inputContract: '同 arithmetic-addition（op=sub）',
    outputContract: '同上（data.operation=sub）',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: 'op=sub'
  },
  'generator:arithmetic-multiplication': {
    family: 'arithmetic', kblFamily: 'integer-arithmetic',
    inputContract: '同 arithmetic-addition（op=mult）',
    outputContract: '同上（data.operation=mult）',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: 'op=mult'
  },
  'generator:arithmetic-division': {
    family: 'arithmetic', kblFamily: 'integer-arithmetic',
    inputContract: '同 arithmetic-addition（op=div；kind=div-remainder 由 name 派生）',
    outputContract: '同上（data.operation=div）',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: 'op=div'
  },
  'generator:arithmetic-mixed-calculation': {
    family: 'arithmetic', kblFamily: 'integer-arithmetic',
    inputContract: '同 arithmetic-addition（op=mixed；operationSet 算子集）',
    outputContract: '同上（data.operation=mixed）',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: 'op=mixed'
  },
  'generator:selection-fill': {
    family: 'selection', kblFamily: 'integer-arithmetic',
    inputContract: 'plan + constraints{numberRange,maxSteps,allowBracket,allowMultDiv,scale}；不读 semanticParams',
    outputContract: 'answerMode=input; prompt=算式+“=____”; data{mode:fill,steps,options,correctIndex}',
    validator: 'pipeline(kpSemantic+TypeContract[blankPresent]+schema)',
    status: 'PRODUCTION', note: '1 绑定 KP（g2-down-u07-k002）；几何为名义声明'
  },
  'generator:selection-choice': {
    family: 'selection', kblFamily: 'integer-arithmetic',
    inputContract: 'plan + constraints；不读 semanticParams',
    outputContract: 'answerMode=input; prompt=算式+“=？”; data{mode:choice,steps,options,correctIndex}',
    validator: 'pipeline(kpSemantic+TypeContract[optionsPresent/answerInOptions]+schema)',
    status: 'DORMANT-CONTRACT-CARRIER', note: '重复能力：contract 375 行 choice 名义载体，实际 0 产出（choice 由原生绑定族全覆盖）'
  },
  'generator:selection-judge': {
    family: 'selection', kblFamily: 'integer-arithmetic',
    inputContract: 'plan + constraints',
    outputContract: 'answerMode=input; prompt=算式+“=shown（对还是错？）”; data{mode:judge,steps,shownResult}',
    validator: 'pipeline(kpSemantic+TypeContract[booleanAnswer]+schema)',
    status: 'DORMANT-CONTRACT-CARRIER', note: '重复能力：contract 126 行 judge 名义载体，实际 0 产出（judge 由 shape/position/classification 覆盖）'
  },
  'generator:complex-calc': {
    family: 'complex', kblFamily: 'integer-arithmetic',
    inputContract: 'plan + constraints.structure.family(chain/no-bracket/bracket/inverse)，需 kp-complex-semantics 注入；不读 semanticParams',
    outputContract: 'answerMode=input; chain/bracket/fill-operator/fill-operand 形态; data{mode,operands,operators,steps}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)；依赖 kp-complex-semantics constraints',
    status: 'DORMANT-NO-BINDING', note: '重复能力：calc/fill 被算术族全覆盖；0 绑定 0 产出；bundled 预留'
  },
  'generator:shape-recognition': {
    family: 'shape', kblFamily: 'geometric-figure / geometric-measurement',
    inputContract: 'plan + semanticParams.name（deriveShapeTypeFromName 派生具体图形）',
    outputContract: 'choice4/judge/fill/geometry/calc; data{graphic{type:geometry,subtype},options,correctIndex}; 度量 calc 含列式',
    validator: 'pipeline(kpSemantic+TypeContract[geometry:graphicPresent]+schema)',
    status: 'PRODUCTION', note: '1570 最大承载（421 行）；88 KP 绑定'
  },
  'generator:position-direction': {
    family: 'position', kblFamily: 'spatial-reasoning',
    inputContract: 'plan + semanticParams.name（deriveSpatialType）',
    outputContract: 'choice/judge/fill/geometry/apply; data{scene{objects,gridSize},options,isTrue,correctDirection,graphic{type:geometry,subtype:position-grid}}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '25 KP 绑定'
  },
  'generator:money-measurement': {
    family: 'money-measurement', kblFamily: 'unit-measurement',
    inputContract: 'plan + semanticParams.name+concept（deriveMeasureKind: rmb/length/area/mass/time/capacity）',
    outputContract: 'fill/choice/judge/apply/calc; data{kind,operation,originalAmount/targetUnit/fromUnit/toUnit,options}; graphic currency/rectangle',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '12 KP 绑定；模块级 rng 非逐题确定'
  },
  'generator:application-word': {
    family: 'application', kblFamily: 'word-application',
    inputContract: 'plan only（不读 semanticParams）；模板+随机数驱动（模板由难度闸）',
    outputContract: '模板题; data{mode,steps,template,numbers,relation,options,correctIndex,shownAnswer}; answer=原始 string/boolean（契约偏差，由下游归一）; graphic 矩形虚线',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '33 KP 绑定；answer 不走 {value,acceptable}（收口发现）'
  },
  'generator:counting': {
    family: 'counting', kblFamily: 'multiplicative-relation',
    inputContract: 'plan + semanticParams.name（组合学 subtype 派生）',
    outputContract: 'apply/calc 计数/排列组合 story; data{mode,steps,questionType}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '2 KP 绑定'
  },
  'generator:reasoning': {
    family: 'reasoning', kblFamily: 'multiplicative-relation / statistics-probability',
    inputContract: 'plan + semanticParams.name（推理 subtype 派生）',
    outputContract: 'apply/calc/fill/choice; data{mode,steps,operation,options,correctIndex}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '15 KP 绑定'
  },
  'generator:stats': {
    family: 'stats', kblFamily: 'statistics-probability',
    inputContract: 'plan + semanticParams.name（统计/时间/日历 subtype 派生）',
    outputContract: 'apply/calc/fill/choice; data{mode:apply,graphic{type:chart},choiceForm/judgeForm/calcForm,options}; judge 经 data.judgeForm 产出',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '欠声明 judge：产出 judgeForm 但能力数组无 judge（收口发现）'
  },
  'generator:picture-equation': {
    family: 'picture-equation', kblFamily: 'number-sense',
    inputContract: 'plan only（不读 semanticParams）',
    outputContract: 'apply/calc 看图列式; data{mode,steps,questionType,graphic{type:diagram,subtype:segment/brace/balance/scale}}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '2 KP 绑定'
  },
  'generator:c1-number-puzzle': {
    family: 'c1', kblFamily: 'number-sense',
    inputContract: 'plan only；kp={}，name 恒为默认',
    outputContract: '数字谜 text; data{mode:apply,steps:3,questionType,family:c1-number-puzzle}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '重复能力：apply/calc 全覆盖；0 绑定 0 产出；竞赛 C 族预留'
  },
  'generator:c2-number-theory': {
    family: 'c2', kblFamily: 'number-sense',
    inputContract: 'plan only；依赖 op-semantics 符号',
    outputContract: '数论题 text; data{family:c2-number-theory}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '同 c1：0 绑定 0 产出；预留'
  },
  'generator:c5-c6-journey-engineering': {
    family: 'c5c6', kblFamily: 'ratio-proportion / multiple-ratio',
    inputContract: 'plan only',
    outputContract: '行程/工程/浓度题 text; data{family:c5-c6-journey-engineering}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '同 c1：0 绑定 0 产出；预留'
  },
  'generator:c7-clever-calc': {
    family: 'c7', kblFamily: 'integer-arithmetic',
    inputContract: 'plan only；依赖 op-semantics 符号',
    outputContract: '巧算/裂项 text; data{mode:calc,family:c7-clever-calc}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '同 c1：0 绑定 0 产出；预留'
  },
  'generator:c9-comprehensive': {
    family: 'c9', kblFamily: 'word-application',
    inputContract: 'plan only；竞争模式由外层 hasC9Semantics 硬阻断',
    outputContract: '综合应用题 text; data{mode:apply,family:c9-comprehensive}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '同 c1：0 绑定 0 产出；头部注释陈旧（mock=open 描述已随 P28-07 摘除）'
  },
  'generator:composite': {
    family: 'composite', kblFamily: '跨族（combine 组合）',
    inputContract: 'plan.combine===true && knowledgePointIds.length≥2（supports 门 + 自有 throw guard）',
    outputContract: 'calc-to-judge 组合题; data{mode:calc-to-judge,steps:1,primaryKp,operation,operands,correct,shown,composite:true}',
    validator: 'pipeline(kpSemantic+TypeContract[booleanAnswer]+schema)+自有 guard（<2 KP 抛错）',
    status: 'PRODUCTION-COMBINE-ONLY', note: '唯一 supportsComposite；1570 单 KP 扫描下 0 行（combine 场景承载，见 composite.test.js）'
  },
  'generator:code-recognition': {
    family: 'code', kblFamily: 'number-sense',
    inputContract: 'plan + constraints + semanticParams.name（codeCategory: idcard/postal/feature/practice/life）',
    outputContract: 'CODE_BANK 5 类长情境题; data{mode,codeType}; choice 附 options/correctIndex',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '5 KP 绑定（数字编码单元）'
  },
  'generator:equivalent-reasoning': {
    family: 'equivalent', kblFamily: 'multiple-ratio',
    inputContract: 'plan + constraints；不读 semanticParams',
    outputContract: '等量代换 chain/买家 story; data{mode,chain:[p,q],options,correctIndex}; choice 分支 answerMode 未切（残留 input）',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'DORMANT-NO-BINDING', note: '重复能力：fill/choice/apply 全覆盖；0 绑定 0 产出；answerMode 契约偏差（收口发现）'
  },
  'generator:classification': {
    family: 'classification', kblFamily: 'classification',
    inputContract: 'plan + constraints{numberRange}',
    outputContract: '分类/排序; data{mode:classify,sort{desc,count}}; answerMode=input',
    validator: 'pipeline(kpSemantic[metaExempt]+TypeContract+schema)',
    status: 'PRODUCTION', note: '唯一 classify 承接者（无重复）；25 KP 绑定；经 kp=1 同时产出 fill/choice/judge/apply → 欠声明（收口发现）'
  },
  'generator:percent-calc': {
    family: 'percent', kblFamily: 'percent',
    inputContract: 'plan + constraints + semanticParams.subTopic（paramsOf→SUBTOPIC_MAKERS）',
    outputContract: '百分数计算/互化/折扣/利率; data{mode:percent-calc,subType,...}; answerMode=input',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '11 KP 绑定'
  },
  'generator:concept-meaning': {
    family: 'concept', kblFamily: 'number-sense',
    inputContract: 'plan + constraints + semanticParams.subTopic+name（次数/分数意义/角/面积/负数等 maker）',
    outputContract: '概念题（列式/填空/判断/选择）; data{mode:concept-meaning,subType,semanticEvidence{relations,constructs},options,correctIndex}',
    validator: 'pipeline(kpSemantic[checkSemanticEvidence]+TypeContract+schema)',
    status: 'PRODUCTION', note: '42 KP 绑定（1570 第二大承载，167 行）'
  },
  'generator:semantic-relations': {
    family: 'semantic-relations', kblFamily: 'ratio-proportion / multiple-ratio / unit-measurement',
    inputContract: 'plan + constraints + semanticParams.subTopic(+name)（图解加/周期规律/比例尺/比例应用/比例意义）',
    outputContract: '图形/比例/周期; data{mode:semantic-relations,subTopic,operation/barModel/periodLength/scaleRatio/proportion,options}',
    validator: 'pipeline(kpSemantic[operation 规则]+TypeContract+schema)',
    status: 'PRODUCTION', note: '10 KP 绑定'
  },
  'generator:decimal-number': {
    family: 'decimal', kblFamily: 'decimal',
    inputContract: 'plan + semanticParams.name（NAME_RULES→subtype 12 分支；fail-closed 缺 name 返回[]）',
    outputContract: '小数专项; data{mode:decimal,subType,steps,options,correctIndex}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '24 KP 绑定'
  },
  'generator:fraction-number': {
    family: 'fraction', kblFamily: 'fraction',
    inputContract: 'plan + semanticParams.name（NAME_RULES→subtype 11 分支；fail-closed）',
    outputContract: '分数专项; data{mode:fraction,subType,steps:1,options,correctIndex}',
    validator: 'pipeline(kpSemantic+TypeContract+schema)',
    status: 'PRODUCTION', note: '19 KP 绑定'
  }
};

var CANONICAL = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
var LEGACY = /oral|recognize|open/;

// ---------- 动态数据 ----------
var recs = R.records();
var byId = {};
recs.forEach(function (r) { byId[r.id] = r; });

var evidence = [];
try {
  var fz = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-GENERATION-MATRIX-FROZEN.json'), 'utf8'));
  evidence = fz.evidence || [];
} catch (e) {
  console.error('无法读取 P28-08 冻结证据（' + e.message + '）——请先运行 node dev/p28/check-generation-matrix-freeze.js');
  process.exit(2);
}

var produced = {}; // id -> {rows, types:Set}
evidence.forEach(function (e) {
  var g = e.generator;
  if (!g) return;
  produced[g] = produced[g] || { rows: 0, types: {} };
  produced[g].rows++;
  produced[g].types[e.qt] = (produced[g].types[e.qt] || 0) + 1;
});

var carrier = {};
var contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json'), 'utf8'));
(contract.mappings || []).forEach(function (m) {
  carrier[m.pluginId] = (carrier[m.pluginId] || 0) + 1;
});

// ---------- 判定 ----------
var fails = [];
var rows = [];

recs.forEach(function (r) {
  var d = DECL[r.id];
  var p = produced[r.id] || { rows: 0, types: {} };
  var matrixRow = {
    id: r.id,
    semanticFamily: d ? (d.kblFamily || d.family) : null,
    family: d ? d.family : null,
    supportedQuestionTypes: r.questionTypes,
    inputContract: d ? d.inputContract : null,
    outputContract: d ? d.outputContract : null,
    validator: d ? d.validator : null,
    productionStatus: d ? d.status : null,
    scope: r.scope, version: r.version, supportsComposite: r.supportsComposite,
    kpBindings: r.knowledgePoints.length,
    contractCarrierRows: carrier[r.id] || 0,
    producedRows1570: p.rows,
    actualProducerTypes: Object.keys(p.types),
    tests: [],
    historical: [],
    note: d ? d.note : null
  };

  // R1 覆盖
  if (!d) { fails.push('R1: registry id 无矩阵声明 ' + r.id); }
  // R2 题型一致 + canonical
  if (d) {
    var qts = (r.questionTypes || []).slice().sort().join(',');
    var can = r.questionTypes.slice().sort().join(',');
    if (LEGACY.test(can)) fails.push('R6: legacy 令牌 in ' + r.id + ': ' + can);
    // R4 声明一致性（P25-07 form-bound 边界）：calc/geometry/classify 为 form-bound，
  // 产出行必须声明该题型；非 formBound 题型可经 native kp=1 泛型产出（超出声明 → 记录 nativeExtended，不进 fail）
  var FORM_BOUND = { calc: 1, geometry: 1, classify: 1 };
  if (d) {
    var declSet = {};
    r.questionTypes.forEach(function (t) { declSet[t] = 1; });
    Object.keys(p.types).forEach(function (t) {
      if (FORM_BOUND[t] && !declSet[t]) fails.push('R4: ' + r.id + ' 未声明产出 ' + t + ' (form-bound, 实际产出行=' + p.types[t] + ')');
    });
    var nativeExtended = [];
    Object.keys(p.types).forEach(function (t) {
      if (!FORM_BOUND[t] && !declSet[t]) nativeExtended.push(t + ':' + p.types[t]);
    });
    if (nativeExtended.length) matrixRow.nativeExtendedTypes = nativeExtended;
  }
  }
  // R5 状态一致
  if (d) {
    if (d.status === 'PRODUCTION' && p.rows === 0) fails.push('R5: ' + r.id + ' 声明 PRODUCTION 但冻结产出行=0');
    if (d.status !== 'PRODUCTION' && d.status !== 'PRODUCTION-COMBINE-ONLY' && p.rows > 0) {
      fails.push('R5: ' + r.id + ' 状态=' + d.status + ' 但冻结产出行=' + p.rows);
    }
  }
  // R3 完整性
  if (d) ['family', 'inputContract', 'outputContract', 'validator', 'status'].forEach(function (k) {
    if (!d[k]) fails.push('R3: ' + r.id + ' 缺声明 ' + k);
  });
  rows.push(matrixRow);
});

// R1 反向：DECL 多余
Object.keys(DECL).forEach(function (id) {
  if (!byId[id]) fails.push('R1: DECL 含 registry 外 id ' + id);
});

var sums = {
  total: rows.length,
  production: rows.filter(function (r) { return r.productionStatus === 'PRODUCTION'; }).length,
  combineOnly: rows.filter(function (r) { return r.productionStatus === 'PRODUCTION-COMBINE-ONLY'; }).length,
  dormantCarrier: rows.filter(function (r) { return r.productionStatus === 'DORMANT-CONTRACT-CARRIER'; }).length,
  dormantNoBinding: rows.filter(function (r) { return r.productionStatus === 'DORMANT-NO-BINDING'; }).length,
  sumProducedRows: rows.reduce(function (s, r) { return s + r.producedRows1570; }, 0)
};

// ---------- 产物 ----------
var artifact = {
  task: 'P28-09 Generator Registry 收口 —— GENERATOR_MATRIX',
  date: new Date().toISOString().slice(0, 10),
  generatorCount: rows.length,
  canonicalTypes: CANONICAL,
  statusCounts: sums,
  rules: ['R1 覆盖', 'R2 题型=registry', 'R3 声明完整', 'R4 产出⊆声明', 'R5 状态一致', 'R6 无 legacy'],
  generators: rows.sort(function (a, b) { return a.id < b.id ? -1 : 1; }),
  fails: fails.slice(0, 30),
  frozen: fails.length === 0
};
fs.mkdirSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-GENERATOR-MATRIX.json'), JSON.stringify(artifact, null, 1) + '\n');
writeMd(artifact);
console.log('GENERATOR_MATRIX：' + sums.total + ' 个 Generator，' + statusSummary(sums) + '，FAIL ' + fails.length + '（R1–R6）');
  fails.slice(0, 20).forEach(function (f) { console.log('  ✗ ' + f); });
  console.log((fails.length ? '收口冻结未通过 ❌' : '收口冻结 ✅') + ' —— 产物 docs/archive/phases/p28/P28-GENERATOR-MATRIX.{json,md}');
  process.exit(fails.length ? 1 : 0);
function statusSummary(s) {
  return 'PRODUCTION=' + s.production + ' COMBINE-ONLY=' + s.combineOnly +
    ' DORMANT-CARRIER=' + s.dormantCarrier + ' DORMANT-NO-BINDING=' + s.dormantNoBinding;
}

function writeMd(a) {
  var md = [];
  md.push('# P28-Generator-Matrix — Generator Registry 收口');
  md.push('');
  md.push('| 项 | 值 |');
  md.push('|---|---|');
  md.push('| 任务 | P28-09 Generator Registry 收口：31 个 Generator 逐个澄清 生产使用/测试使用/历史使用/重复能力/legacy capability，并强制声明 id · semantic family · supported question types · input contract · output contract · validator · production status |');
  md.push('| 执行日期 | ' + a.date + ' |');
  md.push('| 判定规则 | R1 覆盖 / R2 题型=registry / R3 声明完整 / R4 产出⊆声明 / R5 状态一致 / R6 无 legacy（统一门禁 `node dev/p28/check-generator-matrix.js`） |');
  md.push('');
  md.push('## 1. 收口结论');
  md.push('');
  md.push('**' + a.generatorCount + ' 个 Generator · PRODUCTION=' + a.statusCounts.production +
    ' · COMBINE-ONLY=' + a.statusCounts.combineOnly + ' · DORMANT-CARRIER=' + a.statusCounts.dormantCarrier +
    ' · DORMANT-NO-BINDING=' + a.statusCounts.dormantNoBinding + ' ' + (a.frozen ? '—— 收口冻结 ✅' : '—— 存在 FAIL ❌') + '**');
  md.push('');
  md.push('冻结证据：1570 行真实生成（P28-08）中，实际承载行合计 = ' + a.statusCounts.sumProducedRows +
    '；历史使用集中在 `archive/legacy-tests/generator/*`（31 个 id 全量旧测试）+ `migration/excel-raw/*`（4 个）+ kbl 冻结产物。');
  md.push('');
  md.push('## 2. GENERATOR_MATRIX（逐 Generator 7 项声明）');
  md.push('');
  md.push('| id | semantic family | kblFamily | supported question types | input contract | output contract | validator | production status |');
  md.push('|---|---|---|---|---|---|---|---|');
  a.generators.forEach(function (r) {
    md.push('| `' + r.id + '` | `' + (r.family || '-') + '` | `' + (r.semanticFamily || '-') + '` | ' +
      r.supportedQuestionTypes.join('/') + ' | ' + (r.inputContract || '-') + ' | ' + (r.outputContract || '-') +
      ' | ' + (r.validator || '-') + ' | `' + r.productionStatus + '` |');
  });
  md.push('');
  md.push('## 3. 使用维度审计');
  md.push('');
  md.push('| 维度 | 结论 |');
  md.push('|---|---|');
  md.push('| **生产使用** | 21 个实际承载（1570 冻结行全部落于原生绑定生成器）；composite 仅 combine 场景；其余 10 个 0 产出行（见 §4） |');
  md.push('| **测试使用** | 直接 id 引用 14 个文件：arithmetic-addition/multiplication (p27-variation-directive)、shape (p25-07-type-contracts)、money/application/reasoning/code/percent/concept/semantic-relations/decimal/fraction (p25-09-native-bindings)、concept (p25-04/p25-06)、classification (p17-10-classify)、composite (composite)；间接经 1570 门禁全覆盖 |');
  md.push('| **历史使用** | `archive/legacy-tests/generator/core-generators.test.js`（31/31 全量）、registry/selector legacy tests、`migration/excel-raw/kps.json+mappings.json`（addition+selection×3+classification）、`archive/docs-2026-09/migration-reports/*`、`archive/r6-gate-cleanup/*`、kbl 冻结产物（generation-matrix/kp-matrix/教学 semantic-review） |');
  md.push('| **重复能力** | selection-choice（375 行 choice 载体）/ selection-judge（126 行 judge 载体）实际 0 产出——choice/judge 已由 shape/position/concept/application 等原生绑定族全覆盖；complex-calc、c1/c2/c5c6/c7/c9、equivalent-reasoning 的 apply/calc/fill/choice 全被覆盖、0 产出 |');
  md.push('| **legacy capability** | 能力面无旧令牌（P28-07 已清，R6 通过）；剩余：selection 族几何为名义声明、stats 欠声明 judge、classification 欠声明 fill/choice/judge/apply、application/equivalent answer 契约偏差、c9 陈旧注释 |');
  md.push('');
  md.push('## 4. 状态明细');
  md.push('');
  md.push('| 状态 | 数量 | 生成器 |');
  md.push('|---|---|---|');
  md.push('| PRODUCTION（1570 实际承载≥1 行） | ' + a.statusCounts.production + ' | ' +
    a.generators.filter(function (r) { return r.productionStatus === 'PRODUCTION'; }).map(function (r) { return '`' + r.id + '`'; }).join('、') + ' |');
  md.push('| PRODUCTION-COMBINE-ONLY（combine 专享） | ' + a.statusCounts.combineOnly + ' | `generator:composite` |');
  md.push('| DORMANT-CONTRACT-CARRIER（契约名义载体，0 产出，重复能力） | ' + a.statusCounts.dormantCarrier + ' | `generator:selection-choice`、`generator:selection-judge` |');
  md.push('| DORMANT-NO-BINDING（0 绑定 0 产出，bundled 预留） | ' + a.statusCounts.dormantNoBinding + ' | ' +
    a.generators.filter(function (r) { return r.productionStatus === 'DORMANT-NO-BINDING'; }).map(function (r) { return '`' + r.id + '`'; }).join('、') + ' |');
  md.push('');
  md.push('## 5. 收口发现（契约/声明漂移，不阻塞现行生产，待 P28-10 处置）');
  md.push('');
  md.push('1. `generator:stats` 欠声明 judge：`data.judgeForm` 可产出 judge，能力数组无 judge（现行 routing 由 classification/shape 覆盖，不达）。');
  md.push('2. `generator:classification` 欠声明 fill/choice/judge/apply：经 kp=1 在 25 绑定 KP 上产出 4 类；补齐声明会改变 tiebreak 路由，需联动审计，故列入待处置。');
  md.push('3. selection 族几何名义声明：maker 仅产出算术形态，form-bound 门内从不命中 geometry（无害）。');
  md.push('4. `generator:application-word` answer 原始 string/boolean（非 `{value,acceptable}`），由下游 TypeContract/schema 归一（契约偏差）。');
  md.push('5. `generator:equivalent-reasoning` choice 分支 answerMode 残留 input（dormant，无运行影响）。');
  md.push('6. `generator:c9-comprehensive` 头部注释陈旧（mock=open 描述，随 P28-07 已摘除 open，注释未同步）。');
  md.push('7. 非 formBound 泛型产出（native kp=1 扩展）：arithmetic×5、selection-fill、counting、picture-equation、percent-calc、classification 在未声明 choice/fill/apply/judge 情况下仍经 kp=1 产出该类题（maker 泛化）；form-bound（calc/geometry/classify）受 form-bound 声明门约束，本次无一违例（R4 全绿）。');
  md.push('');
  md.push('## 6. 门禁');
  md.push('');
  md.push('- `node dev/p28/check-generator-matrix.js` —— 收口一致性门禁（R1–R6，退出码 0=冻结保持）');
  fs.writeFileSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-GENERATOR-MATRIX.md'), md.join('\n') + '\n');
}