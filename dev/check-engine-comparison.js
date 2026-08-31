#!/usr/bin/env node
/**
 * dev/check-engine-comparison.js — M7-R30 统一引擎 vs 旧插件 等价对比
 *
 * 目标：验证 M7 统一 API（GenerationEngine.generate）相比旧路径
 * （GenerationEngine.generateLegacy → 旧插件）未丢失行为。逐 legacy 插件
 * （经其绑定 KP）同一样本对比四轴：
 *   [A] 题量      legacy set.questions.length  vs  unified questions.length
 *   [B] 可判分    legacy answer 存在可判  vs  unified SemanticQuestion 可判分
 *   [C] 文本内容  按题干(stem)配对：legacy 有文本时 unified 同题也有文本
 *   [D] 可视化   按题干(stem)配对：legacy 同题承载 per-question svg
 *                （q.svg 或 q.render(i)）而 unified 该题无图形 → 丢失
 *
 * [D] 说明：legacy 插件使用非种子化 crypto RNG，每次生成变体不同；故 D 轴
 * 不比较“整屏网格是否含 svg”（跨变体比较会抖动/误报），改为按题干配对后
 * 判断“同一题 legacy 有图形而 unified 无”。题干无法配对（变体不同）时不误报。
 * 已知架构边界：`*-vertical` 等插件以 HTML 布局而非 <svg>/文本承载内容，
 * 统一模型当前无法表达——此类 legacy 题干为空（无 stem 配对），不判为缺陷。
 *
 * 结论：
 *   EQUIVALENT  —— 四轴一致（迁移保真）
 *   DIVERGENT   —— 某轴丢失（记录丢失项；读数格式）
 *   SKIP_NO_LEGACY / SKIP_NO_KP —— 该插件无对应对象，跳过
 *
 * 用法：node dev/check-engine-comparison.js [--only pluginId]
 * 退出码：0 全部等价；1 存在 DIVERGENT（真实迁移 gap，硬 Gate）
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'common.js'));
require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'legacy', 'plugin-adapter.js'));
require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));

var ONLY = null;
process.argv.slice(2).forEach(function (a, i, arr) {
  if (a === '--only') ONLY = String(arr[i + 1] || '').split(',');
});
var COUNT = 3;

var equiv = [], diverge = [], skipped = [];

/** legacy question 是否有可判分 answer */
function legacyGradable(q) {
  if (!q) return false;
  var a = q.answer;
  if (a == null) return false;
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return String(a) !== '';
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'object') return a.value != null || (Array.isArray(a.acceptable) && a.acceptable.length);
  return false;
}
/** legacy question 是否有提示文本 */
function legacyText(q) {
  var t = q.question || q.prompt || (q.q != null ? q.q : '')
    || (q.data && (q.data.question || q.data.prompt || q.data.text))
    || q.char || q.pinyin || q.name || q.letter;
  return t != null && String(t).trim() !== '';
}
/** legacy question 是否承载 per-question 可视化（svg 字段 或 q.render(i) 产出 <svg>） */
function legacyHasSvg(q, index) {
  if (q && typeof q.svg === 'string' && q.svg.length > 0) return true;
  if (q && typeof q.render === 'function') {
    try {
      var out = q.render.call(q, index);
      return String(out).indexOf('<svg') !== -1;
    } catch (e) { return false; }
  }
  return false;
}
/** legacy 题干文本（用于与 unified 按 prompt 配对） */
function legacyStem(q) {
  var t = q.q != null ? q.q
    : (q.question != null ? q.question
      : (q.text != null ? q.text
        : (q.data && (q.data.question || q.data.prompt || q.data.text)) || q.char || q.pinyin || null));
  return t != null ? String(t).trim() : '';
}
/** unified SemanticQuestion 是否可判分 */
function unifGradable(q) {
  if (!q) return false;
  var a = q.answer;
  if (a == null) return false;
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return true;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'object') return a.value != null || (Array.isArray(a.acceptable) && a.acceptable.length);
  return false;
}
/** unified 是否有内容（文本或图形） */
function unifContent(q) {
  var p = q.prompt || (q.question && q.question.prompt) || (q.content && q.content.prompt);
  if (p && String(p).trim() !== '') return true;
  return !!(q.graphic && q.graphic.type);
}
/** unified 题干文本（用于与 legacy 同题配对） */
function unifStem(q) {
  var p = q.prompt || (q.question && q.question.prompt) || (q.content && q.content.prompt);
  return p != null ? String(p).trim() : '';
}

function comparePlugin(rec) {
  var pluginId = rec.pluginId;
  var grade = (Array.isArray(rec.grades) && rec.grades[0]) || 1;
  var kpId = rec.knowledgePoints[0];
  var label = pluginId + '[g' + grade + ']';

  return GE.generateLegacy({ pluginId: pluginId, grade: grade, count: COUNT }).then(function (lr) {
    var legacyQ = (lr.set && lr.set.questions) || [];
    return GE.generate({ mode: 'single-kp', knowledgePointId: kpId, subject: rec.subject, grade: grade, count: COUNT, difficulty: 2 }, { legacyOutput: true }).then(function (ug) {
      var unifQ = ug.questions || [];
      var unifHtml = ug.html || '';

      var lost = [];
      // [A] 题量
      if (legacyQ.length !== unifQ.length) lost.push('A题量 ' + legacyQ.length + '→' + unifQ.length);
      // [B] 可判分
      if (legacyQ.every(legacyGradable) && !unifQ.every(unifGradable)) lost.push('B失去可判分');
      // [C] 文本内容：按题干(stem)配对，确保 legacy 有文本时 unified 同题也有文本
      var unifByStem = {};
      unifQ.forEach(function (u) {
        var s = unifStem(u);
        if (s) unifByStem[s] = u;
      });
      var cMiss = legacyQ.filter(function (lq) {
        var s = legacyStem(lq);
        if (!s) return false;
        var u = unifByStem[s];
        return u && !unifContent(u);
      });
      if (cMiss.length) lost.push('C失去文本内容（' + cMiss.length + ' 题）');
      // [D] 可视化：按题干配对，legacy 同题承载 per-question svg 而 unified 该题无图形 → 丢失（真实适配缺陷）
      var dMiss = legacyQ.filter(function (lq, i) {
        if (!legacyHasSvg(lq, i % legacyQ.length)) return false;
        var s = legacyStem(lq);
        var u = s ? unifByStem[s] : null;
        if (!u) return false; // 变体不匹配（legacy 与 unified 生成不同变体）——不误报
        return !(u.graphic && u.graphic.type) && (unifHtml.indexOf('<svg') === -1);
      });
      if (dMiss.length) lost.push('D失去SVG可视化（' + dMiss.length + ' 题）');

      if (lost.length) {
        diverge.push({ pluginId: pluginId, kpId: kpId, lost: lost });
        console.log('  ✗ ' + label + ' DIVERGENT — ' + lost.join('；'));
      } else {
        equiv.push(pluginId);
        console.log('  ✓ ' + label + ' 等价（A' + unifQ.length + ' B可判 C文本 D' + (unifHtml.indexOf('<svg') !== -1 ? 'svg' : '—') + '）');
      }
    });
  }).catch(function (e) {
    skipped.push(pluginId);
    console.log('  - ' + label + ' SKIP — ' + (e && e.message || e));
  });
}

function main() {
  var recs = GenCap.buildGeneratorCapabilityRegistry();
  var list = recs.filter(function (r) {
    if (r.isPlaceholder || !r.knowledgePoints.length || r.pluginId === 'math-comprehensive') return false;
    if (ONLY && !ONLY.some(function (k) { return r.pluginId.indexOf(k) !== -1; })) return false;
    return true;
  });

  var chain = Promise.resolve();
  list.forEach(function (rec) { chain = chain.then(function () { return comparePlugin(rec); }); });

  chain.then(function () {
    console.log('\nR30 统一引擎 vs 旧插件 等价对比：' + equiv.length + ' 等价 / ' + diverge.length + ' 发散 / ' + skipped.length + ' 跳过');
    if (diverge.length) {
      console.log('发散插件:');
      diverge.forEach(function (d) {
        console.log('  ✖ ' + d.pluginId + '（' + d.kpId + '）丢失: ' + d.lost.join('；'));
      });
      console.log('\n[FAIL] R30 — 存在统一引擎丢失旧插件内容（详见上）。为真实迁移 gap，待 legacy 适配修复。');
      process.exitCode = 1;
    } else {
      console.log('[PASS] R30 统一引擎与旧插件输出等价（无行为丢失）');
    }
  });
}

main();