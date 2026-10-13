'use strict';
/**
 * dev/p40/t12-regression-baseline.js — P40-T-12 回归基线快照（E6，只读 + 重放证明）
 *
 * 七项（任务书 §2.3）：
 *   ①38 边 evolution 覆盖率 100%（R-REL-03 边均带合法 evolution，op∈闭集，fromStageOrder<toStageOrder）
 *   ②同族 stageOrder 无重复无倒挂（族内 stageOrder 唯一、按序年级非递减）
 *   ③familyId 375/375（capability 全量回填）
 *   ④跨族前置无环（canonical 373 前置边 KP 级 DAG 无环 + evolution 图无环；T-06 族投影环为
 *       primary-family 折叠产物，登记 needs-review 观察，非数据违规）
 *   ⑤qt-intent 重放逐字节一致（1570 零重冻证明：重跑派生器前后 SHA256 不变）
 *   ⑥6a 复跑零 fake（check-allow-generation 复跑 FAIL=0）
 *   ⑦快照归档为本战役验收证据（dev/p40/out/t12-regression-baseline.json）
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');
var ROOT = path.join(__dirname, '..', '..');

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function json(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

var cap = json(path.join(ROOT, 'kbl', 'canonical', 'capability.json')).capability;
var rels = json(path.join(ROOT, 'kbl', 'canonical', 'relations.json')).relations;
var known = json(path.join(ROOT, 'kbl', 'canonical', 'knowledge.json')).knowledge;
var DR = require(path.join(ROOT, 'tools', 'kbl', 'derive-relations.js'));

var items = {};
var problems = [];

/* ① evolution 覆盖率 */
var evEdges = rels.filter(function (r) { return r.evolution; });
var OPS = { extend_number: 1, increase_complexity: 1, abstract_up: 1, inverse: 1 };
var evBad = evEdges.filter(function (r) {
  var e = r.evolution;
  return !e.familyId || e.fromStageOrder == null || e.toStageOrder == null ||
    !OPS[e.op] || !(e.toStageOrder > e.fromStageOrder);
});
items.evolution = { edges: evEdges.length, coverage: evEdges.length + '/38', bad: evBad.length, pass: evEdges.length === 38 && evBad.length === 0 };
if (!items.evolution.pass) problems.push('① evolution 覆盖/字段异常');

/* ② 同族 stageOrder 无重复无倒挂 */
var fam = {};
cap.forEach(function (c) { (fam[c.familyId] = fam[c.familyId] || []).push(c); });
var gNum = function (g) { return parseInt(String(g).replace(/[^0-9]/g, ''), 10) || 0; };
var dupFamilies = [], inversionFamilies = [];
Object.keys(fam).forEach(function (f) {
  var arr = fam[f].slice().sort(function (a, b) { return a.stageOrder - b.stageOrder; });
  var seen = {};
  arr.forEach(function (c) { if (seen[c.stageOrder]) dupFamilies.push(f + '@' + c.stageOrder); seen[c.stageOrder] = 1; });
  for (var i = 1; i < arr.length; i++) if (gNum(arr[i].grade) < gNum(arr[i - 1].grade)) inversionFamilies.push(f);
});
items.stageOrder = { families: Object.keys(fam).length, duplicate: dupFamilies.length, gradeInversion: inversionFamilies.length,
  pass: dupFamilies.length === 0 && inversionFamilies.length === 0 };
if (!items.stageOrder.pass) problems.push('② 族内 stageOrder 重复/年级倒挂');

/* ③ familyId 覆盖 */
var withFam = cap.filter(function (c) { return c.familyId; }).length;
items.familyId = { covered: withFam + '/' + cap.length, pass: withFam === cap.length && cap.length === 375 };
if (!items.familyId.pass) problems.push('③ familyId 回填不完整');

/* ④ 跨族前置无环 */
var adj = {}, indeg = {}, nodes = {};
rels.forEach(function (r) { nodes[r.fromId] = 1; nodes[r.toId] = 1; (adj[r.fromId] = adj[r.fromId] || []).push(r.toId); indeg[r.toId] = (indeg[r.toId] || 0) + 1; if (indeg[r.fromId] == null) indeg[r.fromId] = 0; });
var q = Object.keys(nodes).filter(function (n) { return !indeg[n]; }), vis = 0;
while (q.length) { var n = q.shift(); vis++; (adj[n] || []).forEach(function (m) { if (--indeg[m] === 0) q.push(m); }); }
var kpAcyclic = vis === Object.keys(nodes).length;
var evAcyclic = true;
try { DR.validateEvolution(rels, known, {}); } catch (e) { evAcyclic = false; }
var proj = DR.reportCrossFamily(rels, known); // 打印 T-06 报告；族投影环=观察项
items.crossFamily = {
  kpGraphAcyclic: kpAcyclic, evolutionGraphAcyclic: evAcyclic,
  familyProjectionAcyclic: proj.acyclic, familyEdges: Object.keys(proj.familyEdges).length,
  familyProjectionNote: proj.acyclic ? '' : 'primary-family 折叠产物（共享单元如「7～9的表内乘、除法」多族归属），登记 needs-review 观察，非数据违规',
  pass: kpAcyclic && evAcyclic
};
if (!items.crossFamily.pass) problems.push('④ canonical 前置图/evolution 图存在环');

/* ⑤ qt-intent 重放逐字节一致 */
var qtPath = path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json');
var before = sha256(qtPath);
cp.execSync('node dev/p25/derive-qt-intent.js', { cwd: ROOT, stdio: 'ignore' });
var after = sha256(qtPath);
items.qtIntentReplay = { sha256: before, identical: before === after, rows: json(qtPath).counts.rows, needsReview: json(qtPath).counts.needsReview, pass: before === after };
if (!items.qtIntentReplay.pass) problems.push('⑤ qt-intent 重放漂移（发生重冻）');

/* ⑥ 6a 复跑零 fake */
var gen6a = cp.execSync('node dev/check-allow-generation.js', { cwd: ROOT, encoding: 'utf8' });
var m = gen6a.match(/PASS (\d+)，FAIL (\d+)/);
var fail6a = m ? parseInt(m[2], 10) : -1;
items.allowGeneration = { pass6a: m ? parseInt(m[1], 10) : -1, fail: fail6a, pass: fail6a === 0 };
if (!items.allowGeneration.pass) problems.push('⑥ 6a 复跑存在 FAIL');

var snapshot = {
  task: 'P40-T-12',
  generatedBy: 'dev/p40/t12-regression-baseline.js',
  baseline: '基线即验收标准（非仅当前量）',
  counts: { KP: known.length, capability: cap.length, relations: rels.length },
  items: items,
  problems: problems,
  verdict: problems.length === 0 ? 'PASS' : 'FAIL'
};
fs.mkdirSync(path.join(ROOT, 'dev', 'p40', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dev', 'p40', 'out', 't12-regression-baseline.json'), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

console.log('[P40-T-12] 回归基线七项：' + (problems.length === 0 ? '✅ 全过' : '❌ ' + problems.join('；')));
console.log('  ① evolution ' + items.evolution.coverage + ' bad=' + items.evolution.bad +
  ' | ② 族 ' + items.stageOrder.families + ' dup=' + items.stageOrder.duplicate + ' inv=' + items.stageOrder.gradeInversion +
  ' | ③ familyId ' + items.familyId.covered + ' | ④ DAG=' + kpAcyclic + ' ev=' + evAcyclic + ' 族投影环=' + (!proj.acyclic) +
  ' | ⑤ qt-intent ' + (items.qtIntentReplay.identical ? '零重冻' : '漂移') + ' | ⑥ 6a FAIL=' + fail6a);
console.log('  快照：dev/p40/out/t12-regression-baseline.json');
