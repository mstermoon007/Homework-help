'use strict';
/**
 * dev/p40/t08-explanation-samples.js — P40-T-08 承上启下解释抽样（只读，人工评审证据）
 *
 * 从有同族前序（upstream）的 KP 中抽样，跑 concept-meaning 生成器，输出
 * 「前序 canonical 名/定义要点 ↔ 本题解析首段桥接句」对照，供 20 题人工评审。
 * 输出：dev/p40/out/t08-explanation-samples.md
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
var K = global.App.KNOWLEDGE;
var SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
var CM = require(path.join(ROOT, 'shared', 'generator', 'generators', 'concept-meaning.js'));
var RESOLVER = SP.createSemanticParameterResolver({});
var gen = CM.createConceptMeaningGenerator({});

var grades = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
var rows = [];
var families = {};
grades.forEach(function (g) {
  K.byGrade(g).forEach(function (kp) {
    if (rows.length >= 20) return;
    var sp = RESOLVER.resolve(kp.knowledgeId, 'judge');
    if (!sp || !sp.upstream) return;
    var fc = families[sp.upstream.familyId] || 0;
    if (fc >= 2) return; // 每族至多 2 题，保证跨族多样性
    families[sp.upstream.familyId] = fc + 1;
    var canonical = K.get(sp.upstream.knowledgeId);
    // 真实生成解析（concept-meaning 消费 upstream 的 KP 才有；其余给桥接预览）
    var real = null;
    try {
      var out = gen.generate({
        questionTypeId: 'judge', count: 1, difficulty: 2,
        knowledgePointIds: [kp.knowledgeId],
        constraints: { numberRange: { min: 1, max: 20 } },
        seed: 'p40t08|' + kp.knowledgeId, semanticParams: sp
      }, { seed: 'p40t08' });
      if (out && out.length) {
        var ex = String(out[0].answer.explanation || '');
        if (ex.indexOf('我们之前学过〈') === 0) real = ex;
      }
    } catch (e) { /* 生成器不覆盖该 KP kind，给预览 */ }
    rows.push({
      kpId: kp.knowledgeId, kpName: kp.name,
      upstreamId: sp.upstream.knowledgeId, upstreamName: sp.upstream.name,
      canonicalName: canonical.name,
      canonicalDef: sp.upstream.definition,
      explanation: real || SP.composeExplanation({
        upstream: sp.upstream, name: kp.name, current: '〈本题解析 current 段〉'
      }),
      real: !!real
    });
  });
});

var lines = [];
lines.push('# P40-T-08 解释承上启下抽样（人工评审证据）');
lines.push('');
lines.push('规则：桥接句「我们之前学过〈前序名〉（前序定义要点）。把〈前序名〉和〈本课名〉结合起来看：」逐字引用 canonical 前序；无前序不硬加。');
lines.push('');
lines.push('抽样 ' + rows.length + ' 题（每概念族至多 2 题，跨族覆盖）：');
lines.push('');
lines.push('| # | 本课 KP | 本课名 | 前序 KP | 前序名 | 前序名逐字一致 | 前序定义要点 |');
lines.push('|---|---|---|---|---|---|---|');
rows.forEach(function (r, i) {
  lines.push('| ' + (i + 1) + ' | `' + r.kpId + '` | ' + r.kpName + ' | `' + r.upstreamId + '` | ' +
    r.upstreamName + ' | ' + (r.upstreamName === r.canonicalName ? '✓' : '✗') + ' | ' +
    (r.canonicalDef || '（无，仅引用名称）') + ' |');
});
lines.push('');
lines.push('## 生成解析全文对照');
lines.push('');
rows.forEach(function (r, i) {
  lines.push('### ' + (i + 1) + '. ' + r.kpName + '（`' + r.kpId + '`）');
  lines.push('');
  lines.push('- canonical 前序：`' + r.upstreamId + '` ' + r.upstreamName + (r.canonicalDef ? '（' + r.canonicalDef + '）' : ''));
  lines.push('- 解析：' + r.explanation);
  lines.push('');
});

fs.mkdirSync(path.join(ROOT, 'dev', 'p40', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dev', 'p40', 'out', 't08-explanation-samples.md'), lines.join('\n') + '\n', 'utf8');
console.log('[P40-T-08] 解释抽样：' + rows.length + ' 题写入 dev/p40/out/t08-explanation-samples.md');
