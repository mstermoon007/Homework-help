#!/usr/bin/env node
/**
 * dev/check-plugin-responsibility.js — M4-R20 插件职责清理 · 检测器 + 盘点
 *
 * 目标：禁止插件（Legacy Generator）继续承担以下职责，插件只允许生成 q（prompt/answer/data），
 *      渲染/判定归渲染层，难度/题型/自适应归 Strategy：
 *   ① difficulty-decision   难度决策（App.Difficulty / paramsFor / DifficultyStatic / consumeProfile / 自算难度档位）
 *   ② question-type-decision 题型决策（按 type/subtype/questionType 分支选生成路径）
 *   ③ global-adaptive       全局自适应（读用户画像/错题/weakness 决定难度或出题）
 *   ④ svg-rendering         SVG 渲染（createElementNS / SVG 路径 / SVGUtil / 图形描述）
 *   ⑤ dom-manipulation      DOM 操作（document / querySelector / innerHTML / createElement / addEventListener）
 *   ⑥ duplicate-random      重复随机算法（自实现 randInt/randomInt/shuffle/pick，而非统一 _PU.randInt）
 *   ⑦ duplicate-expression  重复表达式算法（自拼算式串，而非委托 arithmetic-core / native generator）
 *   ⑧ duplicate-distractor 重复干扰项算法（本地生成错误选项）
 *
 * Legacy Generator 合规判据（R20）：插件不应命中 ①~⑤；⑥⑦⑧ 视保留程度为技术债。
 *
 * 本工具为「检测 + 盘点 + 整改清单」，不实际改插件（整改由后续轮次逐批进行）。
 * 输出：
 *   - dev/reports/m4-r20-responsibility-report.json（逐插件分类清单）
 *   - stdout 各职责命中插件数 + 合规 / 需整改 / 建议删除 汇总
 * 退出码：非 0 仅当【工具自身崩溃】或【无法隔离占位/无源文件】（盘点完整性失败）。
 * 命中数为盘点结果，不因存在违规而 fail——违规是「待整改」而非「检测失败」。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var registry = require('../plugins/registry.js');
var GenCap = require('../shared/generator-capability-registry.js');

// ---------- 源文件读取 / 注释剥离 ----------
function readSrc(file) {
  return fs.readFileSync(file, 'utf8');
}

/** 去掉行注释与块注释，降低把「说明/注释」误判为调用的风险。保留字符串内的匹配仍可能，但已足够保守。 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ---------- 职责检测器（返回证据行） ----------
function grepLines(src, re) {
  var hits = [];
  var lines = src.split('\n');
  var inBlock = false;
  lines.forEach(function (raw, i) {
    var ln = raw;
    // 处理块注释：跨行跟踪状态，逐行剥离
    if (inBlock) {
      var closer = ln.indexOf('*/');
      if (closer === -1) { inBlock = true; return; }
      ln = ln.slice(closer + 2); inBlock = false;
    }
    for (;;) {
      var bo = ln.indexOf('/*');
      if (bo === -1) break;
      var bc = ln.indexOf('*/', bo + 2);
      if (bc === -1) { ln = ln.slice(0, bo); inBlock = true; break; }
      ln = ln.slice(0, bo) + ln.slice(bc + 2);
    }
    var lc = ln.indexOf('//');
    if (lc !== -1) ln = ln.slice(0, lc);
    if (re.test(ln)) hits.push((i + 1) + ': ' + raw.trim());
  });
  return hits.slice(0, 8);
}

var DETECTORS = {
  // ① 难度决策（Legacy Generator 禁止：难度应来自 plan.constraints / Strategy）
  'difficulty-decision': function (src) {
    return grepLines(src, /paramsFor\s*\(|consumeProfile\s*\(|\.diffLevel\s*=|DifficultyStatic|diffScale\s*[=(]|staticDifficult|_D\s*\.\s*params/);
  },
  // ② 题型决策（按「题目呈现类型」分支选生成路径，Legacy 禁止：题型应来自 plan）。
  //    区分：真正按题型路由（choice/judge/fill/blank/calc/oral/geometry/apply/conn/write/vertical/horizontal/addchain…）
  //    vs 按知识内容类别切数据（negative/percent/circle…，合法，不算违规）。
  'question-type-decision': function (src) {
    return grepLines(src, /\b(qType|questionType|subType|subtype)\b|(switch|case)\s*\(\s*(this\.|cfg\.|config\.|options\.)?(type|qType|questionType|subType)\s*\)|(this\.|cfg\.|config\.|options\.|opts\.)?type\s*===?\s*['"](addchain|subchain|carry|retreat|choice|judge|fill|blank|calc|oral|geometry|apply|conn|write|vertical|horizontal|calculation|ratio-op)['"]|subType\s*===|qType\s*===/);
  },
  // ③ 全局自适应（读用户画像/错题决定难度或出题，Legacy 禁止：无全局状态）
  'global-adaptive': function (src) {
    return grepLines(src, /userLevel|wrongCount|errorAnalysis|weakPoints|Profile\s*\.\s*(get|set|level)|knowledgePointMeta|StudentModel|mastery|adaptive/);
  },
  // ④ SVG 渲染（真实 DOM/SVG 渲染：build 元素树。注：svg: 前缀是图形描述符，属合法；实际渲染在 render 层）
  'svg-rendering': function (src) {
    return grepLines(src, /createElementNS|SVGUtil\s*\.|\.getBBox\s*\(|\.getTotalLength\s*\(|document\.createElementNS|\.setAttribute\s*\(\s*['\"]d['\"]/);
  },
  // ⑤ DOM 操作（渲染/交互层职责，Legacy 禁止）
  'dom-manipulation': function (src) {
    return grepLines(src, /document\.|\.querySelector|\.querySelectorAll|\.innerHTML\s*=|document\.createElement|\baddEventListener|getElementById|\.insertAdjacentHTML/);
  },
  // ⑥ 重复随机算法（自实现 rand 工具，而非统一 _PU.randInt）
  'duplicate-random': function (src) {
    return grepLines(src, /function\s+\w*[Rr]and(om)?Int|Math\.random\s*\(|_randInt\s*=|_pick\s*=|_shuffle\s*=|randInt\s*[:=][\s\S]{0,3}function|function\s+rand\b|function\s*shuffle\b/);
  },
  // ⑦ 重复表达式算法（自拼算式，而非委托 arithmetic-core / native generator）
  'duplicate-expression': function (src) {
    return grepLines(src, /_generate\w*(Chain|Carry|Mixed|TwoDigit|Div|Mul)\s*\(|_gen(Add|Sub|Mul|Div|Carry|Chain)\w*\s*\(|_makeExpr\s*\(|_buildEq\s*\(|_genExpr\s*\(/);
  },
  // ⑧ 重复干扰项算法（本地生成错误选项）
  'duplicate-distractor': function (src) {
    return grepLines(src, /var\s+(distractors|wrongOpts|wrongOptions|_wrong\w*)\s*=\s*\[\]|var\s+distractorPool\s*=\s*\[\]|function\s+(makeWrong|genWrong|wrongOpts|buildDistractors|genDistractors)\s*\(|_makeWrong\s*\(|_genWrong\s*\(|distractorPool\.push|distractors\.push|_buildWrong\s*\(/);
  }
};

// ---------- 插件清单（有 KP 绑定、非占位、非 facade） ----------
var FACADE = { 'math-comprehensive': 1, 'math-g1-patterns': 1 };

function buildScope() {
  var recs = GenCap.buildGeneratorCapabilityRegistry();
  var infos = [];
  registry.forEach(function (entry) {
    var rec = recs.filter(function (r) { return r.pluginId === entry.id; })[0];
    var kps = (rec && rec.knowledgePoints) || [];
    infos.push({
      id: entry.id,
      file: entry.file || null,
      subject: entry.subject,
      hasKp: kps.length > 0,
      isPlaceholder: !!entry.isPlaceholder,
      isFacade: !!FACADE[entry.id]
    });
  });
  infos.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  return infos;
}

// ---------- 主流程 ----------
function main() {
  var scope = buildScope();
  var report = { version: 1, milestone: 'M4-R20', generatedAt: new Date().toISOString(), plugins: [] };
  var counts = { total: 0, scanned: 0, noSource: 0, compliant: 0, needsFix: 0, candidatesDelete: 0 };
  var byCategory = {};
  Object.keys(DETECTORS).forEach(function (k) { byCategory[k] = []; });

  scope.forEach(function (info) {
    var isScope = info.hasKp && !info.isPlaceholder && !info.isFacade;
    // 盘点口径：有 KP 绑定、非占位、非 facade
    report.plugins.push({
      id: info.id, subject: info.subject, file: info.file, scope: isScope
    });
    counts.total++;

    if (!info.file || !fs.existsSync(path.join(ROOT, info.file))) {
      counts.noSource++;
      return;
    }
    var src = readSrc(path.join(ROOT, info.file));
    counts.scanned++;

    var hits = {};
    Object.keys(DETECTORS).forEach(function (k) {
      var ev = DETECTORS[k](src);
      if (ev.length) { hits[k] = ev; byCategory[k].push(info.id); }
    });

    var rec = report.plugins[report.plugins.length - 1];
    rec.hits = Object.keys(hits).length ? hits : undefined;

    // 逐插件判定：
    //   compliant        —— 不命中任何职责
    //   candidate-delete —— 命中技术债（重复随机/表达式/干扰项），且无核心职责
    //   needs-fix        —— 命中任一核心职责(①~⑤)
    if (isScope) {
      var core = ['difficulty-decision', 'question-type-decision', 'global-adaptive', 'svg-rendering', 'dom-manipulation'];
      var coreHits = core.filter(function (k) { return hits[k]; });
      if (coreHits.length) {
        rec.verdict = 'needs-fix'; rec.reasons = coreHits; counts.needsFix++;
      } else if (hits['duplicate-random'] || hits['duplicate-expression'] || hits['duplicate-distractor']) {
        rec.verdict = 'candidate-delete'; rec.reasons = Object.keys(hits); counts.needsFix++;
      } else {
        rec.verdict = 'compliant'; counts.compliant++;
      }
    }
  });

  // 建议删除：重复实现（命中 duplicate-expression 且另有无 state 的 core 迁移）——本阶段仅标记，不删除
  // 候选删除 = scope 中命中 duplicate-expression + duplicate-random 却无 SVG/几何属性的纯算术重复插件
  // 由清单人工确认，gate 不自动删。

  var out = {
    name: 'M4-R20 插件职责清理',
    pass: counts.noSource === 0, // 盘点完整性：所有插件都能读到源码则 PASS（违规是待整改项）
    summary: '检测完成 · scope(' + (counts.total - 0) + '): 合规 ' + counts.compliant +
      ' / 需整改 ' + counts.needsFix + ' / 无源 ' + counts.noSource,
    counts: counts,
    byCategory: byCategory
  };

  fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'm4-r20-responsibility-report.json'),
    JSON.stringify(report, null, 2));

  console.log('M4-R20 插件职责清理 · 检测器');
  console.log('插件总数: ' + counts.total + '；可读源码: ' + counts.scanned + '；无源: ' + counts.noSource);
  console.log('---- 各职责命中插件数 ----');
  Object.keys(byCategory).forEach(function (k) {
    console.log('  ' + k.padEnd(26) + ': ' + byCategory[k].length + (byCategory[k].length ? '  [' + byCategory[k].slice(0, 6).join(', ') + (byCategory[k].length > 6 ? ', …' : '') + ']' : ''));
  });
  console.log('---- 盘点评级 ----');
  console.log('  合规(Legacy Generator): ' + counts.compliant);
  console.log('  需整改(命中核心职责): ' + counts.needsFix);
  console.log('Report -> dev/reports/m4-r20-responsibility-report.json');

  console.log('=== M4-R20 职责门禁 ===');
  if (!out.pass) { console.log('FAIL：存在无法读源码的插件（盘点不完整）'); process.exit(1); }
  console.log('PASS（盘点完整；整改清单已产出）');
  process.exit(0);
}

module.exports = { main: main, DETECTORS: DETECTORS, buildScope: buildScope };
if (require.main === module) main();
