#!/usr/bin/env node
/**
 * dev/verify-knowledge-bank.js — KnowledgeBank 完整性验证器 (M1-R02)
 *
 * 注意：这是验证器，不是 KnowledgeBank 改造器。只读 KnowledgeBank。
 * 逐 KP 检查 Identity / Difficulty / Assessment / Knowledge 四个分组。
 *
 *   缺失            -> WARNING（不阻断）
 *   格式非法(可客观判定) -> ERROR（阻断）
 *
 * 客观格式 ERROR：
 *   numberRange.min > numberRange.max
 *   maxSteps < 1
 *   spiralLevel > maxSpiralLevel
 * 其余（questionType 未知 / cognitive_level 未知）按 UNKNOWN 处理为 WARNING，
 * 不强行猜测，也不阻断（符合“缺数据优于伪造”）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var Schema = require(path.join(ROOT, 'shared', 'schemas', 'knowledge-point.schema.js'));
var Normalizer = require(path.join(ROOT, 'shared', 'knowledge-ontology-normalizer.js'));

var SUBJECTS = Ontology.SUBJECTS;
var COGNITIVE_MAP = Schema.COGNITIVE_MAP;

function isNum(x) { return typeof x === 'number' && isFinite(x); }

function checkOne(kp) {
  var errors = [], warnings = [];

  if (!kp.id) warnings.push('id 缺失');
  if (!kp.name) warnings.push('name 缺失');
  if (!kp.pluginId) warnings.push('pluginId 缺失');

  var sl = kp.spiral_level, msl = kp.max_spiral_level;
  if (sl == null) warnings.push('spiral_level 缺失');
  if (msl == null) warnings.push('max_spiral_level 缺失');
  if (isNum(sl) && isNum(msl) && sl > msl) errors.push('spiral_level > max_spiral_level');

  if (kp.cognitive_level == null) warnings.push('cognitive_level 缺失');
  else if (typeof kp.cognitive_level === 'string' && !COGNITIVE_MAP[kp.cognitive_level]) warnings.push('cognitive_level 未知: ' + kp.cognitive_level);

  var nr = kp.number_range_default;
  if (nr == null) warnings.push('number_range_default 缺失');
  else if (typeof nr === 'object' && nr !== null && isNum(nr.min) && isNum(nr.max) && nr.min > nr.max) errors.push('number_range min > max');

  var ms = kp.max_steps_default;
  if (ms == null) warnings.push('max_steps_default 缺失');
  else if (isNum(ms) && ms < 1) errors.push('max_steps_default < 1');

  if (!Array.isArray(kp.applicable_question_types) || kp.applicable_question_types.length === 0) {
    warnings.push('applicable_question_types 缺失');
  } else {
    kp.applicable_question_types.forEach(function (a) {
      if (!a || !a.type) return;
      var canon = Normalizer.canonQuestionType(a.type);
      if (Schema.KNOWN_QUESTION_TYPES.indexOf(canon) === -1) warnings.push('questionType 未知: ' + a.type);
    });
  }

  if (kp.context_default == null) warnings.push('context_default 缺失');

  if (!Array.isArray(kp.operations) || kp.operations.length === 0) warnings.push('operations 缺失');
  if (!kp.factualContent || Object.keys(kp.factualContent).length === 0) warnings.push('factualContent 缺失');

  return { errors: errors, warnings: warnings };
}

function run() {
  var total = 0, errTotal = 0, warnTotal = 0;
  var records = [];
  var errByKind = {};

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var r = checkOne(kp);
          errTotal += r.errors.length;
          warnTotal += r.warnings.length;
          r.errors.forEach(function (e) { errByKind[e] = (errByKind[e] || 0) + 1; });
          records.push({ id: kp.id, pluginId: kp.pluginId, errors: r.errors, warnings: r.warnings });
        });
      });
    });
  });

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'knowledge-bank-verification.json'),
    JSON.stringify({ total: total, errors: errTotal, warnings: warnTotal, errByKind: errByKind, records: records }, null, 2));

  console.log('M1-R02 KnowledgeBank 完整性验证');
  console.log('');
  console.log('Total KP:     ' + total);
  console.log('ERROR:        ' + errTotal);
  console.log('WARNING:      ' + warnTotal);
  if (errTotal) console.log('ERROR by kind: ' + JSON.stringify(errByKind));
  console.log('');
  console.log('Report -> dev/reports/knowledge-bank-verification.json');

  var ok = errTotal === 0;
  console.log('');
  console.log(ok ? '[PASS] M1-R02 KB 完整性验证' : '[FAIL] M1-R02 KB 完整性验证');
  process.exitCode = ok ? 0 : 1;
}

run();
