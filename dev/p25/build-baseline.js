'use strict';

/**
 * dev/p25/build-baseline.js — P25-00 教学语义基线构建（只读，禁止修改任何源码/数据）
 *
 * 数据源（全部只读）：
 *   kbl/canonical/knowledge.json            —— 375 KP 权威条目（id/grade/book/unit/domain/definition）
 *   kbl/canonical/capability.json           —— 每 KP 能力视图（numberRange/cognitiveLevel/seedDifficulty/maxSteps/allowedTypes/families）
 *   kbl/canonical/mappings.json             —— 1570 条 KP×QuestionType ALLOW 映射（pluginId = 实际承载生成器）
 *   kbl/data/math/g1..g6/knowledge-points.json —— KBL 权威 KP 库（semantic.family/concept/operations/representations + assessment.errors；与 runtime 副本逐字节一致，P25 派生以 KBL 侧为唯一事实源，不直读 shared/knowledge/data 以合 kbl-access 门禁）
 *   shared/generator/generator-registry.js  —— CORE_RECORDS 原生绑定（KP→Generator SSOT）
 *
 * 产出（全部新增文件，可重复运行）：
 *   kbl/teaching/kp-matrix.json             —— 375 KP 教学语义矩阵（含 A/B/C/D 草拟分级 + 依据）
 *   kbl/teaching/generation-matrix.json     —— 1570 映射逐行 + Generator 实际使用索引
 *   docs/p25/P25-BASELINE.md                —— 11 项基线报告
 *
 * 不变式（违反即 exit 1）：
 *   KP = 375、ALLOW = 1570、permission 全 allow、映射/能力/语义库 KP 全覆盖且 ID 一致
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
// KBL 教学语义扩展层（数据派生/治理产物落位 kbl/teaching/；报告 md 留 docs/p25/）
var OUT_DIR = path.join(ROOT, 'kbl', 'teaching');

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function readHeaderTitle(rel) {
  // 提取模块首行 docstring 的「— 副标题」作为一句话角色描述
  try {
    var head = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').slice(0, 12).join('\n');
    var m = head.match(/([A-Za-z0-9\-\.\/]+\.js)\s*—\s*(.+?)\s*\*?\s*$/m);
    return m ? m[2].trim() : '';
  } catch (e) { return ''; }
}
function assert(cond, msg) {
  if (!cond) { console.error('[P25-00] INVARIANT FAIL: ' + msg); process.exit(1); }
}

// ---------- 1. 载入数据源（只读） ----------
var knowledge = readJSON('kbl/canonical/knowledge.json');
var capability = readJSON('kbl/canonical/capability.json');
var mappings = readJSON('kbl/canonical/mappings.json');
var registry = require(path.join(ROOT, 'shared/generator/generator-registry.js'));
var qtr = require(path.join(ROOT, 'shared/knowledge/question-type-registry.js'));

var kpRows = Array.isArray(knowledge.knowledge) ? knowledge.knowledge : Object.keys(knowledge.knowledge).map(function (k) { return knowledge.knowledge[k]; });
var kpMap = {};
kpRows.forEach(function (k) { kpMap[k.id] = k; });
var kpIds = Object.keys(kpMap).sort();
var capRows = capability.capability;
var capById = {};
capRows.forEach(function (c) { capById[c.knowledgeId] = c; });

var mapRows = mappings.mappings.slice().sort(function (a, b) {
  return (a.knowledgeId + '#' + a.questionType).localeCompare(b.knowledgeId + '#' + b.questionType);
});

// runtime 语义块（semantic.family/concept/operations/representations + assessment.errors）
var semById = {};
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  var k = readJSON('kbl/data/math/' + g + '/knowledge-points.json');
  var arr = Array.isArray(k) ? k : (k.knowledgePoints || []);
  arr.forEach(function (kp) { semById[kp.knowledgeId] = kp; });
});

// ---------- 2. 不变式 ----------
assert(kpIds.length === 375, 'KP 总数应为 375，实际 ' + kpIds.length);
assert(mapRows.length === 1570, 'ALLOW 映射应为 1570，实际 ' + mapRows.length);
assert(capRows.length === 375, 'capability 应为 375，实际 ' + capRows.length);
mapRows.forEach(function (m, i) {
  assert(m.permission === 'allow', '映射 #' + i + ' permission=' + m.permission);
  assert(!!kpMap[m.knowledgeId], '映射 #' + i + ' 引用未知 KP ' + m.knowledgeId);
});
kpIds.forEach(function (id) {
  assert(!!capById[id], 'capability 缺少 ' + id);
  assert(!!semById[id], 'runtime 语义库缺少 ' + id);
});
Object.keys(semById).forEach(function (id) {
  assert(!!kpMap[id], 'runtime 语义库存在未知 KP ' + id);
});
var nullPlugin = mapRows.filter(function (m) { return !m.pluginId; }).length;
assert(nullPlugin === 0, '存在 ' + nullPlugin + ' 条无 pluginId 的映射');

// ---------- 3. Generator 绑定与实际使用 ----------
var recs = (typeof registry.records === 'function' ? registry.records() : registry.records) || [];
var bindByKp = {};
var genById = {};
recs.forEach(function (r) {
  genById[r.id] = { questionTypes: r.questionTypes, capabilities: r.capabilities };
  (r.knowledgePoints || []).forEach(function (kp) {
    (bindByKp[kp] = bindByKp[kp] || []).push(r.id);
  });
});

var ARITH_RE = /^(generator:arithmetic-|generator:complex-calc$)/;
// 通用兜底：仅按题型/组合承载、不含 KP 专项语义的 Generator
var GENERIC = { 'generator:selection-fill': 1, 'generator:selection-choice': 1, 'generator:selection-judge': 1, 'generator:composite': 1 };

var pluginByKp = {};
mapRows.forEach(function (m) {
  (pluginByKp[m.knowledgeId] = pluginByKp[m.knowledgeId] || {})[m.pluginId] = 1;
});

// 草拟分级（P25-02 人工确认前的启发式初判，非结论）。
// 口径基于「三层承载模型」：
//   ① canonical mappings pluginId —— kbl-derived 粗派生（939 行归 arithmetic-addition 等，仅 5 种）
//   ② registry 原生绑定（CORE_RECORDS.knowledgePoints）—— 语义专项路由 SSOT
//   ③ 运行时实证 —— selector 能力评分路由，P24-02 verify:allow-gen 已实证 1570/1570 可真实生成
// 分级以 ② 为主证据：
//   A 深语义型   —— 原生绑定到专项语义 Generator（非算术族、非通用兜底）
//   B 结构语义型 —— 原生绑定算术/复杂数计算族（运算语义经 core resolver 注入）
//   D 待治理型   —— 无专项/算术绑定（仅通用兜底或未绑定），但 domain 为几何/统计或表征含 graphic
//   C 通用基础型 —— 其余无专项/算术绑定 KP（依赖通用兜底 + selector 路由）
function draftLevel(id) {
  var bound = (bindByKp[id] || []).slice().sort();
  var special = bound.filter(function (p) { return !ARITH_RE.test(p) && !GENERIC[p]; });
  if (special.length) return { level: 'A', evidence: special };
  var arith = bound.filter(function (p) { return ARITH_RE.test(p); });
  if (arith.length) return { level: 'B', evidence: arith };
  var cap = capById[id];
  var sem = semById[id] || {};
  var graphic = ((sem.semantic && sem.semantic.representations) || []).indexOf('graphic') !== -1;
  var bindTag = bound.length ? 'generic-only' : 'unbound';
  if (cap.domain === 'geometry' || cap.domain === 'statistics' || graphic) {
    return { level: 'D', evidence: [bindTag].concat(bound, ['domain=' + cap.domain], graphic ? ['graphic'] : []) };
  }
  return { level: 'C', evidence: [bindTag].concat(bound) };
}

// ---------- 4. KP 矩阵 ----------
var kpMatrix = kpIds.map(function (id) {
  var k = kpMap[id];
  var cap = capById[id];
  var sem = semById[id];
  var draft = draftLevel(id);
  var perQt = {};
  mapRows.forEach(function (m) {
    if (m.knowledgeId === id) perQt[m.questionType] = (perQt[m.questionType] || 0) + 1;
  });
  return {
    id: id,
    grade: k.grade,
    book: k.book,
    unitId: k.unitId,
    unitNo: k.unit && k.unit.unitOrdinal,
    unitName: k.unit && k.unit.unitName,
    module: k.domain,
    name: k.name,
    description: k.definition,
    cognitiveLevel: cap.cognitiveLevel,
    seedDifficulty: cap.seedDifficulty,
    numberRange: cap.numberRange,
    maxSteps: cap.maxSteps,
    questionTypes: cap.allowedTypes,
    semanticFamily: sem.semantic && sem.semantic.family,
    semanticConcept: sem.semantic && sem.semantic.concept,
    operations: (sem.semantic && sem.semantic.operations) || [],
    representations: (sem.semantic && sem.semantic.representations) || [],
    factualContent: sem.content && sem.content.factualContent || {},
    graphicType: sem.content && sem.content.graphicType,
    assessmentQuestionTypes: (sem.assessment && sem.assessment.questionTypes) || [],
    misconceptionSlots: (sem.assessment && sem.assessment.errors) || [],
    generatorBindings: (bindByKp[id] || []).slice().sort(),
    canonicalPlugins: Object.keys(pluginByKp[id] || {}).sort(),
    allowCount: perQt[Object.keys(perQt)[0]] !== undefined ? Object.keys(perQt).reduce(function (n, qt) { return n + perQt[qt]; }, 0) : 0,
    allowByQuestionType: perQt,
    draftSemanticLevel: draft.level,
    draftBasis: draft.evidence
  };
});

// ---------- 5. 生成矩阵 + Generator 索引 ----------
var genStats = {};
mapRows.forEach(function (m) {
  var g = genStats[m.pluginId] = genStats[m.pluginId] || { allowCount: 0, kpSet: {}, qtCount: {} };
  g.allowCount += 1;
  g.kpSet[m.knowledgeId] = 1;
  g.qtCount[m.questionType] = (g.qtCount[m.questionType] || 0) + 1;
});
var levelById = {};
kpMatrix.forEach(function (k) { levelById[k.id] = k.draftSemanticLevel; });

var generationMatrix = {
  schemaVersion: '1.0.0',
  builtFrom: { knowledge: knowledge.generatedAt, capability: capability.generatedAt, mappings: mappings.generatedAt },
  counts: { knowledgePoints: kpIds.length, allowMappings: mapRows.length },
  rows: mapRows.map(function (m) {
    return {
      knowledgeId: m.knowledgeId,
      questionType: m.questionType,
      capability: m.capability,
      permission: m.permission,
      pluginId: m.pluginId,
      coefficient: m.coefficient,
      derivation: m.derivation,
      draftSemanticLevel: levelById[m.knowledgeId]
    };
  }),
  generatorIndex: {
    canonicalPluginCoverage: Object.keys(genStats).sort().map(function (pid) {
      var g = genStats[pid];
      return {
        pluginId: pid,
        allowCount: g.allowCount,
        distinctKps: Object.keys(g.kpSet).length,
        questionTypeCounts: g.qtCount,
        note: 'kbl-derived 粗派生承载（非运行时实际路由）'
      };
    }),
    registryGenerators: recs.map(function (r) {
      var bound = r.knowledgePoints || [];
      return {
        pluginId: r.id,
        questionTypes: r.questionTypes,
        capabilities: r.capabilities,
        bindingsCount: bound.length,
        boundKpDraftLevels: countBy(bound.map(function (k) { return levelById[k]; })),
        supportsComposite: r.supportsComposite,
        version: r.version
      };
    })
  }
};

function countBy(arr) {
  var o = {};
  arr.forEach(function (x) { o[x] = (o[x] || 0) + 1; });
  return o;
}

// ---------- 6. 静态能力清单（resolver / validator / learner） ----------
function listDir(rel, filter) {
  return fs.readdirSync(path.join(ROOT, rel)).filter(filter || function () { return true; }).sort()
    .filter(function (f) { return /\.js$/.test(f); });
}
var resolverInventory = listDir('shared/generator/core').map(function (f) {
  return { file: 'shared/generator/core/' + f, role: readHeaderTitle('shared/generator/core/' + f) };
});
var validatorInventory = listDir('shared/validator').map(function (f) {
  return { file: 'shared/validator/' + f, role: readHeaderTitle('shared/validator/' + f) };
});
var learnerInventory = listDir('shared/learner').map(function (f) {
  return { file: 'shared/learner/' + f, role: readHeaderTitle('shared/learner/' + f) };
});

// ---------- 7. 统计 ----------
function groupCount(arr) { return countBy(arr); }
var domainDist = groupCount(kpMatrix.map(function (k) { return k.module; }));
var levelDist = groupCount(kpMatrix.map(function (k) { return k.draftSemanticLevel; }));
var gradeDist = groupCount(kpMatrix.map(function (k) { return k.grade + '-' + k.book; }));
var qtDist = groupCount(mapRows.map(function (m) { return m.questionType; }));
var levelQt = {};
mapRows.forEach(function (m) {
  var lv = levelById[m.knowledgeId];
  levelQt[lv] = levelQt[lv] || {};
  levelQt[lv][m.questionType] = (levelQt[lv][m.questionType] || 0) + 1;
});

// ---------- 8. 写出 ----------
fs.mkdirSync(OUT_DIR, { recursive: true });

var kpMatrixJson = {
  schemaVersion: '1.0.0',
  note: 'P25-00 基线矩阵；draftSemanticLevel 为启发式草拟（A 深语义/B 结构语义/C 通用基础/D 待治理），须经 P25-02 人工确认，不得作为最终结论',
  builtFrom: { knowledge: knowledge.generatedAt, capability: capability.generatedAt, mappings: mappings.generatedAt },
  counts: { knowledgePoints: kpMatrix.length, allowMappings: mapRows.length },
  distributions: { byDraftLevel: levelDist, byDomain: domainDist, byGradeBook: gradeDist, allowByQuestionType: qtDist, allowByLevelQuestionType: levelQt },
  kps: kpMatrix
};
fs.writeFileSync(path.join(OUT_DIR, 'kp-matrix.json'), JSON.stringify(kpMatrixJson, null, 2) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'generation-matrix.json'), JSON.stringify(generationMatrix, null, 2) + '\n');

// ---------- 9. BASELINE.md ----------
function lvlList(level) {
  return kpMatrix.filter(function (k) { return k.draftSemanticLevel === level; }).map(function (k) { return k.id; });
}
var aList = lvlList('A'), bList = lvlList('B'), cList = lvlList('C'), dList = lvlList('D');

var md = [];
md.push('# P25-BASELINE — 教学语义专项基线（P25-00）');
md.push('');
md.push('> 由 `dev/p25/build-baseline.js` 只读生成；可重复运行，结果仅随数据源变化。');
md.push('> 本文件为 P25 专项的事实快照，不引入任何新语义结论；A/B/C/D 分级为**草拟**（`draftSemanticLevel`），须经 P25-02 人工治理确认。');
md.push('');
md.push('## 0. 基线快照与不变式');
md.push('');
md.push('| 项 | 值 | 来源 |');
md.push('| --- | --- | --- |');
md.push('| KP 总数 | **' + kpIds.length + '** | kbl/canonical/knowledge.json (generatedAt ' + knowledge.generatedAt + ') |');
md.push('| ALLOW 映射 | **' + mapRows.length + '**（permission 全 allow） | kbl/canonical/mappings.json (generatedAt ' + (mappings.generatedAt || '—，与 generation-contract/math.json 同源同计数') + ') |');
md.push('| capability 视图 | ' + capRows.length + ' | kbl/canonical/capability.json |');
md.push('| runtime 语义库 | ' + Object.keys(semById).length + '（semantic/assessment 块） | kbl/data/math/g1..g6（与 runtime 副本逐字节一致） |');
md.push('| 原生 Generator 记录 | ' + recs.length + '（其中 ' + recs.filter(function (r) { return (r.knowledgePoints || []).length; }).length + ' 个有 KP 绑定，绑定 KP 共 ' + kpMatrix.filter(function (k) { return k.generatorBindings.length; }).length + ' 个） | shared/generator/generator-registry.js CORE_RECORDS |');
md.push('| 规范题型 | ' + qtr.TYPES.map(function (t) { return t.id; }).join(' / ') + ' | question-type-registry |');
md.push('');
md.push('不变式校验：KP=375 ✔ / ALLOW=1570 ✔ / capability 覆盖 375 ✔ / 语义库覆盖 375 ✔ / 映射无空 pluginId ✔');
md.push('');
md.push('## 1. KP 总表与字段口径（对应指令第 1/2 项）');
md.push('');
md.push('全量 375 行见 [kp-matrix.json](../../kbl/teaching/kp-matrix.json)。字段口径：`grade/book/unitId/unitNo/unitName/module(domain)/name/description(definition)/cognitiveLevel/seedDifficulty/numberRange/maxSteps/questionTypes(allowedTypes)/semanticFamily/operations/representations/assessmentQuestionTypes/misconceptionSlots(现 assessment.errors 空槽)/generatorBindings(registry 原生绑定)/canonicalPlugins(canonical 粗派生承载)/allowByQuestionType/draftSemanticLevel/draftBasis`。');
md.push('');
md.push('### 分布');
md.push('');
md.push('- 草拟分级：' + JSON.stringify(levelDist));
md.push('- domain 分布：' + JSON.stringify(domainDist));
md.push('- 年级·册分布：' + JSON.stringify(gradeDist));
md.push('');
md.push('## 2. 1570 条 KP×QuestionType 映射（对应指令第 3 项）');
md.push('');
md.push('全量 1570 行见 [generation-matrix.json](../../kbl/teaching/generation-matrix.json)（每行含 knowledgeId/questionType/capability/permission/pluginId/coefficient/derivation/draftSemanticLevel）。');
md.push('');
md.push('- 按题型分布：' + JSON.stringify(qtDist));
md.push('- 按草拟分级×题型：' + JSON.stringify(levelQt));
md.push('');
md.push('## 3. 承载模型：每条映射实际使用的 Generator（对应指令第 4 项）');
md.push('');
md.push('「实际使用」需分三层表述（这是本基线的关键口径修正）：');
md.push('');
md.push('1. **canonical 粗派生承载**（mappings.json / generation-contract 的 pluginId，kbl-derived）：仅 5 种——' + generationMatrix.generatorIndex.canonicalPluginCoverage.map(function (g) { return g.pluginId.split(':')[1] + '(' + g.allowCount + ')'; }).join('、') + '。这是派生期的粗粒度归类，**不是运行时实际路由**。');
md.push('2. **registry 原生语义绑定**（CORE_RECORDS.knowledgePoints）：语义专项路由 SSOT，' + recs.filter(function (r) { return (r.knowledgePoints || []).length; }).length + ' 个 Generator 绑定 ' + kpMatrix.filter(function (k) { return k.generatorBindings.length; }).length + ' 个 KP。逐 Generator 见 generatorIndex.registryGenerators。');
md.push('3. **运行时实证**：selector 按能力评分路由（kp > capability > qt），P24-02 `verify:allow-gen` 已实证 **1570/1570 全部可真实生成 ≥1 题**。静态基线不重跑生成，以该门禁为运行时事实引用。');
md.push('');
md.push('## 4. 每 Generator 支持的语义族（对应指令第 5 项）');
md.push('');
md.push('Generator 的「语义族」以其 questionTypes/capabilities + 所绑定 KP 的 semantic.family 与草拟分级刻画；registryGenerators.boundKpDraftLevels 给出每 Generator 服务 KP 的 A/B/C/D 构成。专项语义（百分数/分类/图形/统计/推理/计数/看图方程/应用题等）由专项 Generator 承载，算术族由 arithmetic/complex + core resolver 注入运算语义，其余 KP 依赖通用兜底 + selector 路由。');
md.push('');
md.push('## 5. 现有 semantic resolver / profile（对应指令第 6 项）');
md.push('');
resolverInventory.forEach(function (r) { md.push('- `' + r.file + '` — ' + r.role); });
md.push('');
md.push('- 专项注入点：`kp-arithmetic-semantics.js` 的 `CANONICAL_KP_OVERRIDES`（当前 1 条：math-g5-up-u02-k002 → dec-mult，`knowledgePoints:[]` 形态以过 kbl-uniqueness 门禁）；`percent.js` 以 KP 尾缀 \'001\'~\'006\' 分派 6 个子类型 maker（P24-02）。');
md.push('- 已知债务：尾缀分派是事实上的 KP 硬编码，列入 P25-06 审计项。');
md.push('');
md.push('## 6. Validator 现有语义验证能力（对应指令第 7 项）');
md.push('');
validatorInventory.forEach(function (r) { md.push('- `' + r.file + '` — ' + r.role); });
md.push('');
md.push('- 语义验证核心：`kp-semantic-validator.js` 六项检查 = ① KP identity（question.knowledgePointIds 与 Plan 一致）② questionType ∈ KP 允许范围 ③ operation 与 KP 一致（经 arithmetic/complex resolver）④ numberRange ⑤ maxSteps/structure ⑥ factualContent/graphicType 出现性。');
md.push('- P25-04 将在其上扩展 `SEMANTIC_PASS/WARN/FAIL` 语义证据层（不做任何放宽）。');
md.push('');
md.push('## 7. Learner / error-model 记录能力（对应指令第 8 项）');
md.push('');
learnerInventory.forEach(function (r) { md.push('- `' + r.file + '` — ' + r.role); });
md.push('');
md.push('- 持久化：复用 StorageManager，唯一 key `hw-help-state.learnerState`。');
md.push('- P25-11 接线要求：错误反馈可回溯 knowledgePointId + questionType + semanticTarget（semanticTarget 为 P25 新增维度）。');
md.push('');
md.push('## 8. 深语义 / 结构 / 兜底 KP 清单（对应指令第 9/10/11 项）');
md.push('');
md.push('草拟口径（以 registry 原生绑定为主证据，详见脚本注释）：**A 深语义型** = 原生绑定专项语义 Generator；**B 结构语义型** = 原生绑定算术/复杂数计算族（resolver 注入运算语义）；**C 通用基础型** = 无原生绑定（通用兜底 + selector 路由）；**D 待专项治理型** = 无原生绑定但 domain 为几何/统计或表征含 graphic（概念丰富、生成器通用 → P25-02 重点）。');
md.push('');
md.push('| 级别 | 数量 | 说明 |');
md.push('| --- | --- | --- |');
md.push('| A 深语义型 | ' + aList.length + ' | 全表见 kbl/teaching/kp-matrix.json（draftSemanticLevel=A） |');
md.push('| B 结构语义型 | ' + bList.length + ' | 同上（=B） |');
md.push('| C 通用基础型 | ' + cList.length + ' | 同上（=C） |');
md.push('| D 待治理型 | ' + dList.length + ' | 同上（=D）；P25-02 优先治理对象 |');
md.push('');
md.push('A 类样例（前 20）：' + aList.slice(0, 20).join(', ') + (aList.length > 20 ? ' …' : ''));
md.push('');
md.push('D 类全列：' + (dList.join(', ') || '（无）'));
md.push('');
md.push('## 9. P25-02 交接');
md.push('');
md.push('- 本基线的 `draftSemanticLevel/draftBasis` 仅为启发式初判，全部视为 `NEEDS_REVIEW`。');
md.push('- 下一步：`dev/p25/draft-semantic-matrix.js` 基于 A/D 类优先产出人工评审矩阵（xlsx + review json），人工确认前不写入任何正式数据（不改 root Excel / 不改 kbl/canonical）。');
md.push('');
md.push('## 10. 复现');
md.push('');
md.push('```bash');
md.push('node dev/p25/build-baseline.js   # 只读；产出 docs/p25/ 三件套');
md.push('```');
md.push('');
fs.writeFileSync(path.join(ROOT, 'docs', 'p25', 'P25-BASELINE.md'), md.join('\n'));

// ---------- 10. 汇总输出 ----------
console.log('[P25-00] 基线构建完成（只读，未修改任何源码/数据）');
console.log('  KP = ' + kpIds.length + ' / ALLOW = ' + mapRows.length + ' / capability = ' + capRows.length + ' / 语义库 = ' + Object.keys(semById).length);
console.log('  草拟分级：A=' + aList.length + ' B=' + bList.length + ' C=' + cList.length + ' D=' + dList.length);
console.log('  registry 原生绑定 Generator：' + recs.length + ' 记录 / canonical 粗派生承载种类：' + generationMatrix.generatorIndex.canonicalPluginCoverage.length);
console.log('  产出：docs/p25/P25-BASELINE.md, kbl/teaching/kp-matrix.json, kbl/teaching/generation-matrix.json');
