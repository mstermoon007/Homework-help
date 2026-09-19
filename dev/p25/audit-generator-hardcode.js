#!/usr/bin/env node
'use strict';
/**
 * dev/p25/audit-generator-hardcode.js — P25-06 Generator KP 硬编码审计（只读）
 *
 * 扫描「以编码手段承载教学事实」的模式。P25-06 本体后 H1/H2/H3 已治理，
 * 本脚本对三类复现采取零容忍（发现即 FAIL，防止债务回潮）：
 *
 *   H1 KP 形态分派   —— slice(-n)/尾缀正则/-exec(kpId)/kpId.match 等按 KP ID
 *                      字符串形态决定生成行为（跨单元碰撞 + 静默 fallback 风险）
 *   H2 STALE KP 清单 —— generator 内 knowledgePoints 使用不在 canonical 375 中的 ID
 *   H3 pluginId 子串 —— 以 pluginId.indexOf('c3-'/'money'/...) 猜语义的 selector 谓词
 *
 * H4 显式 ID override（kp-arithmetic-semantics CANONICAL_KP_OVERRIDES）已声明正当，
 * 仅登记不阻断。
 *
 * 一致性断言（防漂移，失败即 FAIL）：
 *   A1 capability-resolver ACTIVE 表 ↔ teaching-denials.json 非 revoked 行集合一致
 *   A2 selector 无 has*Semantics / is*Family 形态谓词（含引用未定义变量的坏死版本）
 *   A3 GenerationParameters 双环境等价：Node（teaching 细族收窄）与 bundle 降级
 *      （无 teaching JSON、规则全扫）对全部 native 绑定的语义消费 KP 派生同一 subTopic
 *
 * 用法：node dev/p25/audit-generator-hardcode.js
 * 退出码：H1/H2/H3 任一非零或 A1/A2/A3 失败 = 1；H4 登记不阻断。
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var GEN_DIR = path.join(ROOT, 'shared', 'generator');
var CAP_RESOLVER = path.join(ROOT, 'shared', 'capability', 'capability-resolver.js');
var DENIALS_JSON = path.join(ROOT, 'kbl', 'teaching', 'teaching-denials.json');

function walk(dir, re) {
  var out = [];
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var st = fs.statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full, re));
    else if (re.test(name)) out.push(full);
  });
  return out;
}

function lines(file) {
  return fs.readFileSync(file, 'utf8').split('\n');
}

var findings = { H1: [], H2: [], H3: [], H4: [] };
var failures = [];

// ---------- H1 KP 形态分派：slice(- / 尾缀正则 / 对 kpId 直接正则匹配 ----------
var H1_PATTERNS = [
  { re: /\.(?:slice|substring|substr)\(\s*-\d|split\(['"][^'"]*k['"]\)|lastIndexOf\(['"]-k['"]\)/, tag: 'tail-slice' },
  { re: /\.exec\(\s*kp(?:Id)?[\s,)]|\.exec\(\s*[a-zA-Z_]*[Kk]pId/, tag: 'regex-exec-kpId' },
  { re: /\bkp(?:Id)?\.match\s*\(|\b[a-zA-Z_]*[Kk]pId\.match\s*\(/, tag: 'kpId-match' }
];
walk(path.join(GEN_DIR, 'generators'), /\.js$/).forEach(function (f) {
  lines(f).forEach(function (ln, i) {
    if (/^\s*(\*|\/\/)/.test(ln)) return;
    H1_PATTERNS.forEach(function (p) {
      if (p.re.test(ln)) findings.H1.push({ file: path.relative(ROOT, f), line: i + 1, kind: p.tag, code: ln.trim() });
    });
  });
});

// ---------- H2 STALE KP 清单：generators/*.js 内的 'math-...' ID 不在 canonical（按文件聚合） ----------
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var ID_RE = /['"](math-[a-z0-9]+(?:-[a-z0-9]+)+)['"]/g;
walk(path.join(GEN_DIR, 'generators'), /\.js$/).forEach(function (f) {
  var stale = {};
  lines(f).forEach(function (ln, i) {
    if (/^\s*(\*|\/\/)/.test(ln)) return; // 跳过注释
    var m;
    ID_RE.lastIndex = 0;
    while ((m = ID_RE.exec(ln)) !== null) {
      var id = m[1];
      if (!KC.get(id)) stale[id] = i + 1;
    }
  });
  var ids = Object.keys(stale);
  if (ids.length) findings.H2.push({ file: path.relative(ROOT, f), count: ids.length, ids: ids });
});

// ---------- H3 selector pluginId 子串语义谓词（任何形态出现都视为回潮） ----------
var selectorFile = path.join(GEN_DIR, 'generator-selector.js');
var H3_FN_RE = /function (has\w+Semantics|is\w*Family)\s*\(/g;
var selectorText = fs.readFileSync(selectorFile, 'utf8');
var selectorCodeLines = selectorText.split('\n').filter(function (ln) {
  return !/^\s*(\*|\/\/)/.test(ln);
}).join('\n');
var m3;
while ((m3 = H3_FN_RE.exec(selectorCodeLines)) !== null) {
  findings.H3.push({ fn: m3[1] });
}

// ---------- H4 ID override：kp-arithmetic-semantics CANONICAL_KP_OVERRIDES（正当，仅登记） ----------
var arithSem = path.join(GEN_DIR, 'core', 'kp-arithmetic-semantics.js');
lines(arithSem).forEach(function (ln, i) {
  var m = ln.match(/knowledgePoints:\s*\[([^\]]+)\]/);
  if (m && /CANONICAL_KP_OVERRIDES|dec-mult/.test(selectorText + fs.readFileSync(arithSem, 'utf8').split('\n').slice(Math.max(0, i - 8), i).join('\n'))) {
    var ids = (m[1].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); });
    ids.forEach(function (id) {
      findings.H4.push({ file: path.relative(ROOT, arithSem), line: i + 1, id: id, exists: !!KC.get(id) });
    });
  }
});

// ---------- A1 teaching denials 代码 ACTIVE 表 ↔ JSON 非 revoked SSOT 一致性 ----------
var resolverText = fs.readFileSync(CAP_RESOLVER, 'utf8');
var codeDenials = {};
var tableBlock = resolverText.match(/var TEACHING_DENIALS = \{([\s\S]*?)\};/);
if (!tableBlock) failures.push('A1: resolver 中未找到 TEACHING_DENIALS 表');
else {
  var rowRe = /['"](math-[a-z0-9-]+)\|([a-z]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  var rm;
  while ((rm = rowRe.exec(tableBlock[1])) !== null) codeDenials[rm[1] + '|' + rm[2]] = rm[3];
}
var jsonDoc = JSON.parse(fs.readFileSync(DENIALS_JSON, 'utf8'));
var jsonActive = {};
var jsonRevoked = {};
(jsonDoc.denials || []).forEach(function (d) {
  var key = d.knowledgeId + '|' + d.questionType;
  if (d.status === 'revoked') jsonRevoked[key] = d;
  else jsonActive[key] = d;
});
Object.keys(jsonActive).forEach(function (k) {
  if (!Object.prototype.hasOwnProperty.call(codeDenials, k)) failures.push('A1: ACTIVE 教学裁决未在 resolver 执行：' + k);
});
Object.keys(codeDenials).forEach(function (k) {
  if (!Object.prototype.hasOwnProperty.call(jsonActive, k)) {
    failures.push('A1: resolver 存在无 ACTIVE SSOT 行的裁决：' + k
      + (jsonRevoked[k] ? '（JSON 该行已 revoked，应从代码表移除）' : ''));
  }
});

// ---------- A2 selector 不得保留任何 pluginId 子串语义谓词（含历史坏死版本） ----------
if (/function hasShapeSemantics\(kp\)\s*\{\s*return g\.id/.test(selectorText)) {
  failures.push('A2: selector 仍存在引用未定义变量 g 的坏 hasShapeSemantics 死函数');
}
findings.H3.forEach(function (x) {
  failures.push('A2: selector 仍存在 pluginId 子串语义谓词：' + x.fn);
});

// ---------- A3 GenerationParameters 双环境 subTopic 等价（Node 细族收窄 vs bundle 全扫降级） ----------
var SemanticParameters = require(path.join(GEN_DIR, 'core', 'semantic-parameters.js'));
var GenRegistry = require(path.join(GEN_DIR, 'generator-registry.js'));
// 语义消费 KP = 绑定到已迁移为 subTopic 分派的 3 个生成器的全部 canonical KP
var PARAM_DRIVEN = ['generator:percent-calc', 'generator:concept-meaning', 'generator:semantic-relations'];
var boundKps = [];
GenRegistry.all().forEach(function (rec) {
  if (PARAM_DRIVEN.indexOf(rec.id) !== -1) {
    (rec.knowledgePoints || []).forEach(function (id) { if (boundKps.indexOf(id) === -1) boundKps.push(id); });
  }
});
boundKps.forEach(function (kpId) {
  var nodeParams = SemanticParameters.resolve(kpId, 'calc');
  if (!nodeParams) { failures.push('A3: 语义参数解析失败：' + kpId); return; }
  if (!nodeParams.subTopic) { failures.push('A3: Node 侧 subTopic 未派生：' + kpId); return; }
  // 模拟 bundle 降级：只用 strategyView（无 teaching 细族/意图）+ family=null 全扫规则
  var degradedView = KC.strategyView(kpId);
  var facts = SemanticParameters.readFacts(degradedView);
  var degraded = SemanticParameters.deriveSubTopic(facts, null);
  if (degraded.subTopic !== nodeParams.subTopic) {
    failures.push('A3: 双环境 subTopic 分歧 ' + kpId + '：Node=' + nodeParams.subTopic
      + ' bundle降级=' + degraded.subTopic);
  }
  // subTopic 必须带机械证据
  if (!nodeParams.subTopicEvidence || !nodeParams.subTopicEvidence.matched) {
    failures.push('A3: subTopic 缺少派生证据：' + kpId);
  }
});

// ---------- 报告 ----------
function p(title, items) {
  console.log('\n## ' + title + '（' + items.length + '）');
  items.forEach(function (x) { console.log('  ' + JSON.stringify(x)); });
}

console.log('# P25-06 Generator 硬编码审计  ' + new Date().toISOString().slice(0, 10));
p('H1 KP 形态分派（阻断）', findings.H1);
p('H2 STALE KP 清单（阻断，不在 canonical 375）', findings.H2);
p('H3 selector pluginId 子串谓词（阻断）', findings.H3);
p('H4 显式 ID override（已声明正当，仅登记）', findings.H4);

var debtBlocked = findings.H1.length + findings.H2.length + findings.H3.length;
console.log('\n## 一致性断言');
console.log('  A1 ACTIVE teaching denials 代码表 ↔ SSOT JSON：'
  + (Object.keys(jsonActive).length === Object.keys(codeDenials).length && !failures.some(function (f) { return /^A1/.test(f); })
    ? '一致（ACTIVE ' + Object.keys(codeDenials).length + ' 条，revoked 留痕 ' + Object.keys(jsonRevoked).length + ' 条）'
    : '不一致'));
console.log('  A2 selector 子串语义谓词：' + (findings.H3.length === 0 ? '已清零' : findings.H3.length + ' 个'));
console.log('  A3 subTopic 双环境等价（' + boundKps.length + ' 个绑定 KP）：'
  + (failures.some(function (f) { return /^A3/.test(f); }) ? '有分歧' : '一致且证据齐全'));

if (failures.length === 0 && debtBlocked === 0) {
  console.log('\n结果：PASS（H1/H2/H3=0，H4 登记 ' + findings.H4.length + ' 项，断言全过；runtime 有效能力 1570）');
  process.exit(0);
}
failures.forEach(function (f) { console.log('  FAIL ' + f); });
console.log('\n结果：FAIL（H1/H2/H3 复现 ' + debtBlocked + ' 项，断言失败 ' + failures.length + ' 项）');
process.exit(1);
