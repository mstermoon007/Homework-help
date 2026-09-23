'use strict';
/**
 * dev/p28/final-37-deepen-evidence.js — FINAL-37 一次性迁移脚本
 *
 * 为 5 个 A 类概念族（倍/分数/角/百分数/分类）的 evidence-rules 行追加
 * `construct` 必需断言，使 constructs 不再装饰而是被 validator check#7 真正校验。
 *
 * 构件命名与 semantic-evidence.js deriveConstructs() / concept-meaning makers 同源：
 *   倍 (math-g2-down-u03-k003)              → base-quantity / multiple / comparison
 *   分数 (math-g5-down-u04-k001)            → whole / part / fraction-relation
 *   角 (math-g3-up-u07-k002)
 *       fill                               → vertex / rays / angle
 *       apply/choice/geometry/judge       → angle
 *   百分数 (math-g6-up-u05-k001..k006)       → percentage (+part-whole 见 maker 字段)
 *   分类 (mode=classify 各 KP)             → classification-criterion / items / ordered-or-classified-result
 *
 * 幂等：重复运行不重复追加（按 name 去重）。
 * 运行：node dev/p28/final-37-deepen-evidence.js [--percent] [--classify]
 *   默认仅深化 倍/分数/角（13 行，增量1）；
 *   --percent 深化 6 个百分数 KP；--classify 深化分类族。
 */

var fs = require('fs');
var path = require('path');

var RULES_PATH = path.resolve(__dirname, '../../kbl/teaching/evidence-rules.json');

// (kpId) → { qt → [construct...] } 或 '*' 表示该 KP 所有 QT
var DEEPEN = {
  // 倍的认识
  'math-g2-down-u03-k003': {
    '*': ['base-quantity', 'multiple', 'comparison']
  },
  // 分数的意义
  'math-g5-down-u04-k001': {
    '*': ['whole', 'part', 'fraction-relation']
  },
  // 角的认识
  'math-g3-up-u07-k002': {
    'fill': ['vertex', 'rays', 'angle'],
    'apply': ['angle'],
    'choice': ['angle'],
    'geometry': ['angle'],
    'judge': ['angle']
  }
};

var PERCENT_KPS = [
  'math-g6-up-u05-k001', 'math-g6-up-u05-k002', 'math-g6-up-u05-k003',
  'math-g6-up-u05-k004', 'math-g6-up-u05-k005', 'math-g6-up-u05-k006'
];
// 百分数：所有 QT → percentage；maker 发射 whole+part 字段的 → part-whole 由 derive 派生
// 为统一与诚实，规则统一要求 percentage；part-whole 不强制（maker 字段不一）
var PERCENT_DEEPEN = {};
PERCENT_KPS.forEach(function (kp) { PERCENT_DEEPEN[kp] = { '*': ['percentage'] }; });

// 分类族：mode=classify 的所有 KP → 三构件（items 由 maker 补 data.items 后派生）
var CLASSIFY_DEEPEN = { '*classify*': { '*': ['classification-criterion', 'items', 'ordered-or-classified-result'] } };

function addConstructs(rule, names) {
  if (!rule.required) rule.required = [];
  names.forEach(function (n) {
    var exists = rule.required.some(function (a) {
      return a.kind === 'construct' && a.name === n;
    });
    if (!exists) rule.required.push({ kind: 'construct', name: n });
  });
}

function applyDeepen(doc, map) {
  var touched = 0;
  (doc.rules || []).forEach(function (r) {
    var spec = map[r.knowledgePointId];
    if (!spec) return;
    var qtSpec = spec[r.questionType] || spec['*'];
    if (!qtSpec) return;
    addConstructs(r, qtSpec);
    touched++;
  });
  return touched;
}

function applyClassifyDeepen(doc) {
  var touched = 0;
  (doc.rules || []).forEach(function (r) {
    if (r.questionType !== 'classify') return;
    addConstructs(r, ['classification-criterion', 'items', 'ordered-or-classified-result']);
    touched++;
  });
  return touched;
}

function main() {
  var args = process.argv.slice(2);
  var doPercent = args.indexOf('--percent') !== -1;
  var doClassify = args.indexOf('--classify') !== -1;

  var raw = fs.readFileSync(RULES_PATH, 'utf8');
  var doc = JSON.parse(raw);

  var report = [];
  report.push(applyDeepen(doc, DEEPEN) + ' 倍/分数/角');
  if (doPercent) report.push(applyDeepen(doc, PERCENT_DEEPEN) + ' 百分数');
  if (doClassify) report.push(applyClassifyDeepen(doc) + ' 分类');

  // 更新 assertionKinds 文档：登记 construct/constructNot
  if (doc.assertionKinds && Array.isArray(doc.assertionKinds.required)) {
    var hasConstruct = doc.assertionKinds.required.some(function (s) {
      return typeof s === 'string' && s.indexOf('construct(name)') === 0;
    });
    if (!hasConstruct) {
      doc.assertionKinds.required.push('construct(name): 声明 constructs 须包含该结构构件（FINAL-37，真实结构证据）');
    }
  }
  if (doc.assertionKinds && Array.isArray(doc.assertionKinds.forbidden)) {
    var hasConstructNot = doc.assertionKinds.forbidden.some(function (s) {
      return typeof s === 'string' && s.indexOf('constructNot(name)') === 0;
    });
    if (!hasConstructNot) {
      doc.assertionKinds.forbidden.push('constructNot(name): 声明 constructs 含该构件即违禁');
    }
  }

  var out = JSON.stringify(doc, null, 2) + '\n';
  fs.writeFileSync(RULES_PATH, out, 'utf8');
  console.log('FINAL-37 deepen evidence-rules: ' + report.join(', '));
  console.log('assertionKinds updated: construct / constructNot');
}

main();
