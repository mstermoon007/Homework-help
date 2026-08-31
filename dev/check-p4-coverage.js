#!/usr/bin/env node
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
require(path.join(ROOT, 'shared', 'knowledge-point.js'));

var GR = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

var recs = GR.records();
var nat = recs.filter(function (r) { return r.scope === 'core'; });
var leg = recs.filter(function (r) { return r.scope === 'legacy'; });

console.log('=== P4-R01 Native Generator Coverage Report ===\n');
console.log('Registry Overview:');
console.log('  Total records:', recs.length);
console.log('  Native (core):', nat.length);
console.log('  Legacy (legacy):', leg.length);
console.log('');

console.log('Native Generators (core):');
nat.forEach(function (r) {
  console.log('  ' + r.id);
  console.log('    capabilities:', r.capabilities.join(', ') || '(none)');
  console.log('    questionTypes:', r.questionTypes.join(', ') || '(none)');
  console.log('    knowledgePoints:', r.knowledgePoints.length ? r.knowledgePoints.join(', ') : '(none - capability-only)');
  console.log('');
});

console.log('Legacy Generators (legacy) by subject:');
var legBySub = leg.reduce(function (a, r) { (a[r.subject] = a[r.subject] || []).push(r); return a; }, {});
Object.keys(legBySub).forEach(function (s) { console.log('  ' + s + ': ' + legBySub[s].length + ' generators'); });
console.log('');

var allKPs = [];
['math', 'chinese', 'english'].forEach(function (subj) {
  [1,2,3,4,5,6].forEach(function (g) { (KB.getEntries(subj, g) || []).forEach(function (kp) { allKPs.push(kp); }); });
});

var natKPSet = new Set();
nat.forEach(function (r) { r.knowledgePoints.forEach(function (kp) { natKPSet.add(kp); }); });

var stats = { nativeOnly: 0, hybrid: 0, legacyOnly: 0, none: 0 };
var hybridKPs = [], natOnlyKPs = [], legOnlyKPs = [], noneKPs = [];

allKPs.forEach(function (kp) {
  var hasNat = natKPSet.has(kp.id);
  var legGens = leg.filter(function (r) { return r.knowledgePoints.indexOf(kp.id) !== -1; });
  if (hasNat && legGens.length > 0) { stats.hybrid++; hybridKPs.push({ kp: kp.id, nat: true, leg: legGens.map(function (r) { return r.id; }) }); }
  else if (hasNat) { stats.nativeOnly++; natOnlyKPs.push({ kp: kp.id }); }
  else if (legGens.length > 0) { stats.legacyOnly++; legOnlyKPs.push({ kp: kp.id, leg: legGens.map(function (r) { return r.id; }) }); }
  else { stats.none++; noneKPs.push(kp.id); }
});

console.log('=== KP Level Coverage (' + allKPs.length + ' KPs) ===');
console.log('  Hybrid (Nat + Leg):', stats.hybrid);
console.log('  Native Only:', stats.nativeOnly);
console.log('  Legacy Only:', stats.legacyOnly);
console.log('  No Generator:', stats.none);
console.log('');

var Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));
console.log('Current Production Mode:', Mode.getGlobal());

var routeStats = { nat: 0, leg: 0, fallback: 0, none: 0 };
var subjStats = {};

allKPs.forEach(function (kp) {
  var plan = { knowledgePointId: kp.id, grade: kp.grade || 1, difficulty: 3, questionTypeId: 'calc', subject: kp.subject };
  try {
    var sel = Selector.selectGenerator(plan);
    var trk = sel.record && sel.record.scope;
    if (trk === 'core') routeStats.nat++;
    else if (trk === 'legacy') { if (sel.source === 'fallback:legacy') routeStats.fallback++; else routeStats.leg++; }
    else routeStats.none++;
    
    subjStats[kp.subject] = subjStats[kp.subject] || { nat: 0, leg: 0, fallback: 0, none: 0 };
    if (trk === 'core') subjStats[kp.subject].nat++;
    else if (trk === 'legacy') { if (sel.source === 'fallback:legacy') subjStats[kp.subject].fallback++; else subjStats[kp.subject].leg++; }
    else subjStats[kp.subject].none++;
  } catch (e) { routeStats.none++; }
});

console.log('=== Production Routing (hybrid mode) ===');
console.log('  Native:', routeStats.nat);
console.log('  Legacy:', routeStats.leg);
console.log('  Fallback:', routeStats.fallback);
console.log('  None:', routeStats.none);
console.log('');
Object.keys(subjStats).forEach(function (s) { var st = subjStats[s]; console.log('  ' + s + ': Nat=' + st.nat + ' Leg=' + st.leg + ' Fallback=' + st.fallback + ' None=' + st.none); });
console.log('');
console.log('=== Migration Priority ===');
console.log('1. Hybrid KPs (Nat exists, can switch): ' + hybridKPs.length);
console.log('2. Legacy Only KPs (need Native gen): ' + stats.legacyOnly);
console.log('3. Native Only KPs (ready): ' + stats.nativeOnly);

