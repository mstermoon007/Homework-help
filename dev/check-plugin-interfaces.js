#!/usr/bin/env node
/**
 * dev/check-plugin-interfaces.js — 插件接口合规性检查（工具链统一入口）
 *
 * 对每个插件依次执行 6 项检查：
 *   1. 存在性检查   插件对象是否存在（沙箱能否捕获导出对象）
 *   2. 方法完整性   generate / render / check 是否都是函数
 *   3. 导出正确性   是否正确挂载到 module.exports 或 window.__currentPlugin
 *   4. 接口一致性   调用 generate({grade, count}) 能否运行，返回是否含 questions 数组
 *   5. 渲染检查     调用 render(exerciseSet) 是否返回字符串
 *   6. 批改检查     调用 check(exerciseSet, {}) 是否返回含 score / results 的对象
 *
 * 工具链集成：
 *   - npm run check-plugin-interfaces
 *   - dev/verify-setup.js（第 10 节，随 npm run verify 自动执行）
 *   - scripts/pre-commit.sh（提交前强制闸门，经 core.hooksPath=scripts/githooks 启用）
 *
 * 报告输出（可再生产物，dev/reports/ 已 gitignore）：
 *   node dev/check-plugin-interfaces.js --report  > dev/reports/plugin-check-report.txt
 *   node dev/check-plugin-interfaces.js --fix-json > dev/reports/plugin-fix-report.json
 *
 * API：
 *   const { checkPlugin, checkAll } = require('./dev/check-plugin-interfaces.js');
 *   checkPlugin('math-oral');  // → Promise<{ id, checks:[{name,pass,detail}], passed }>
 *   checkAll();                // → Promise<{ reports, summary }>
 *
 * CLI：
 *   node dev/check-plugin-interfaces.js                # 检查全部插件（详细模式）
 *   node dev/check-plugin-interfaces.js math-oral      # 只检查指定插件（逗号分隔多个）
 *   node dev/check-plugin-interfaces.js --report       # 报告模式：[PASS]/[FAIL] 每插件一行
 *   node dev/check-plugin-interfaces.js --fix-json     # 结构化修复建议 JSON（供 AI 自动修码）
 *   node dev/check-plugin-interfaces.js --json         # 原始检查数据 JSON
 */
'use strict';

var path = require('path');

var ROOT = path.join(__dirname, '..');
var registryMod = require('./plugin-registry.js');
var loader = require('./plugin-loader.js');

// 加载知识库（顺序与浏览器 production 一致：先 bank，后各科目）。
// 否则插件自检调用 reportCoverage 时 KnowledgeBank 缺一年级数据，会误报「无 X 年级知识库数据」。
global.window = global.window || global;
require('../shared/knowledge-bank.js');
require('../shared/knowledge-math.js');
require('../shared/knowledge-cn.js');
require('../shared/knowledge-en.js');

// 加载共享工具层（common.js 会按序注入 core/render/check 等子模块并挂到 global.PluginUtil）。
// 插件构造期依赖 PluginUtil.createPlugin / randInt / createPoolCache 等，必须先行加载，
// 否则 dev/plugin-loader 沙箱中 PluginUtil 为 undefined，全部插件「存在性/接口调用」误报失败。
require('../shared/common.js');

var CHECK_COUNT = 5; // 接口一致性探测用题量（小样本即可）

/** 登记一条检查结果 */
function add(report, name, pass, detail) {
  report.checks.push({ name: name, pass: !!pass, detail: detail || '' });
}

/**
 * 检查单个插件。
 * @param {Object|string} entryOrId registry 条目或插件 id
 * @returns {Promise<{id:string, file:string, checks:Array, passed:boolean}>}
 */
function checkPlugin(entryOrId) {
  var entry = typeof entryOrId === 'string'
    ? registryMod.getEntry(entryOrId)
    : entryOrId;

  var report = {
    id: entry ? entry.id : String(entryOrId),
    file: entry ? entry.file : '',
    checks: [],
    passed: false
  };

  // —— 步骤 A：加载（存在性 / 方法完整性 / 导出正确性）——
  var loaded = loader.loadPlugin(entry);

  // 1. 存在性检查
  if (!loaded.plugin) {
    add(report, '1.存在性', false, loaded.error || '未能捕获插件对象');
    return Promise.resolve(report);
  }
  add(report, '1.存在性', true, '插件对象已加载');

  var p = loaded.plugin;

  // 2. 方法完整性
  var missing = ['generate', 'render', 'check'].filter(function (fn) {
    return typeof p[fn] !== 'function';
  });
  add(report, '2.方法完整性', missing.length === 0,
    missing.length ? '缺失或非函数：' + missing.join(' / ') : 'generate/render/check 均为函数');

  // 3. 导出正确性：module.exports 或 window 全局挂载（__currentPlugin / 兜底扫描命中）
  var src = loaded.source || '';
  var exportOk = !!src &&
    (src === 'module.exports' || src.indexOf('window.') === 0);
  add(report, '3.导出正确性', exportOk,
    src ? ('导出来源：' + src + (loaded.warnings.length ? '；⚠ ' + loaded.warnings.join('；') : ''))
        : '导出对象未设置 window.__currentPlugin，module.exports 也无 generate');

  // —— 步骤 B：真实调用（接口一致性 / 渲染 / 批改）——
  var grade = (entry && entry.grades && entry.grades[0]) || p.grades && p.grades[0] || 1;

  return Promise.resolve()
    .then(function () { return p.generate({ grade: grade, count: CHECK_COUNT }); })
    .then(function (set) {
      // 4. 接口一致性：能运行且返回含 questions 数组
      var ok = set && typeof set === 'object' && Array.isArray(set.questions);
      add(report, '4.接口一致性', ok, ok
        ? 'generate({grade:' + grade + ',count:' + CHECK_COUNT + '}) 正常，返回 ' +
          set.questions.length + ' 题'
        : 'generate 返回缺少 questions 数组');
      if (!ok) return;

      // 5. 渲染检查：render 返回字符串
      var html = null, rErr = null;
      try { html = p.render(set); } catch (e) { rErr = e.message; }
      add(report, '5.渲染检查', typeof html === 'string' && html.length > 0,
        rErr ? 'render 抛错：' + rErr
          : (typeof html === 'string' ? '返回 HTML 字符串 ' + html.length + ' 字符' : '返回非字符串：' + typeof html));

      // 6. 批改检查：check 返回含 score 与 results 数组的对象
      var cr = null, cErr = null;
      try { cr = p.check(set, {}); } catch (e) { cErr = e.message; }
      var cOk = cr && typeof cr === 'object' &&
        'score' in cr && Array.isArray(cr.results);
      add(report, '6.批改检查', cOk, cErr ? 'check 抛错：' + cErr
        : (cOk ? 'score=' + cr.score + '，results[' + cr.results.length + ']'
               : '返回缺少 score 或 results'));
    })
    .catch(function (e) {
      add(report, 'B.接口调用', false, '执行异常：' + e.message);
    })
    .then(function () {
      report.passed = report.checks.every(function (c) { return c.pass; });
      return report;
    });
}

/**
 * 批量检查全部（或筛选后）插件。
 * @param {{subject?: string, ids?: string[], quiet?: boolean}} [options]
 *   quiet: 屏蔽插件加载期日志（报告模式默认开启），保证输出干净
 */
function checkAll(options) {
  options = options || {};
  var list = registryMod.readRegistry();

  if (options.subject) {
    list = list.filter(function (e) { return e.subject === options.subject; });
  }
  var requestedIds = null;
  if (options.ids && options.ids.length) {
    requestedIds = options.ids.slice();
    var wanted = {};
    requestedIds.forEach(function (id) { wanted[id] = true; });
    list = list.filter(function (e) { return wanted[e.id] || wanted[e.runtimeId]; });
  }

  // 报告模式下屏蔽插件自身的开发期日志（coverage 提示等），保持输出干净
  var restored = null;
  if (options.quiet) {
    var origLog = console.log, origInfo = console.info, origWarn = console.warn;
    restored = function () {
      console.log = origLog; console.info = origInfo; console.warn = origWarn;
    };
    console.log = function () {}; console.info = function () {}; console.warn = function () {};
  }

  var reports = [];
  // 串行执行：每个检查都会建独立沙箱，串行更省内存且输出稳定
  var chain = Promise.resolve();
  list.forEach(function (e) {
    chain = chain.then(function () {
      return checkPlugin(e).then(function (r) { reports.push(r); });
    });
  });

  return chain.then(function () {
    if (restored) restored();

    // 显式请求但不存在的 id：合成失败报告，避免静默丢失
    if (requestedIds) {
      var seen = {};
      reports.forEach(function (r) { seen[r.id] = true; });
      requestedIds.forEach(function (id) {
        if (!seen[id]) {
          reports.push({
            id: id, file: id + '.js', checks: [], passed: false,
            error: '注册表中不存在该插件'
          });
        }
      });
    }

    var passed = 0, failedReports = [];
    reports.forEach(function (r) {
      if (r.passed) passed++;
      else failedReports.push(r.id);
    });
    return {
      reports: reports,
      summary: { total: reports.length, passed: passed, failed: reports.length - passed, failedIds: failedReports }
    };
  });
}

module.exports = { checkPlugin: checkPlugin, checkAll: checkAll, formatReport: formatReport, buildFixReport: buildFixReport };

// ---- 报告生成 ----
// 各检查项对应的建议修复操作
var FIX_SUGGESTIONS = {
  '1.存在性': '确认插件文件存在且无语法错误（可先 node --check <文件> 排查），并已复制 _template.js 骨架',
  '2.方法完整性': '补齐缺失方法，或改用 PluginUtil.createMathPlugin / createChinesePlugin / createEnglishPlugin 工厂自动生成三大接口',
  '3.导出正确性': '在插件文件末尾双环境导出：global.__currentPlugin = plugin; 且 if (typeof module !== \'undefined\') module.exports = plugin;',
  '4.接口一致性': 'generate(options) 须返回 { questions: Question[], meta }，questions 为数组；异步插件返回 Promise<ExerciseSet>',
  '5.渲染检查': 'render(exerciseSet) 必须同步返回 HTML 字符串（推荐 PluginUtil.renderGrid / renderCard）',
  '6.批改检查': 'check(exerciseSet, userAnswers) 须返回 { score, total, correct, message, results[], correctAnswers[] }',
  'B.接口调用': '接口执行抛错——常见为依赖数据未加载：确认所需全局库已在 plugins/registry.js 的 deps 中声明'
};

/** 单份报告 → 一至多行文本（失败插件每个失败项一行） */
function formatReport(r) {
  var file = path.basename(r.file || (r.id + '.js'));
  var lines = [];
  var failedChecks = (r.checks || []).filter(function (c) { return !c.pass; });

  if (!failedChecks.length && !r.error) {
    lines.push('[PASS] ' + file);
    return lines;
  }
  // 加载阶段即失败（尚无 checks）：单行输出
  if (!(r.checks || []).length) {
    lines.push('[FAIL] ' + file + ': ' + (r.error || '未能捕获插件对象') +
      ' → 建议：' + FIX_SUGGESTIONS['1.存在性']);
    return lines;
  }
  failedChecks.forEach(function (c) {
    var reason = c.detail || '未通过';
    var suggest = FIX_SUGGESTIONS[c.name] || '对照 plugins/CONTRACT.md 修正该插件的接口实现';
    lines.push('[FAIL] ' + file + ': ' + reason + ' → 建议：' + suggest);
  });
  return lines;
}

// ---- 结构化修复建议（供 AI 助手解析并自动修改代码） ----
// 各失败项对应的可执行代码片段（均基于项目真实的 PluginUtil API）
var FIX_SNIPPETS = {
  addGenerate: [
    '// 三大接口之一：生成题目集（同步或返回 Promise 均可）',
    'generate(options) {',
    '  var count = Number(options && options.count) > 0 ? Number(options.count) : 10;',
    '  var grade = (options && options.grade) || this.grades[0];',
    '  var questions = [];',
    '  // TODO: 按 grade/difficulty 生成题目，每题至少含 answer + render(idx)',
    '  for (var i = 0; i < count; i++) {',
    '    questions.push({',
    "      type: this.id,",
    "      question: '题干',",
    '      answer: 42,',
    '      inputType: \'text\',',
    '      render: function (idx) { return PluginUtil.renderCard(this, idx); }',
    '    });',
    '  }',
    '  return { questions: questions, meta: { grade: grade, count: questions.length } };',
    '}'
  ].join('\n'),
  addRender: [
    'render(exerciseSet) {',
    '  return PluginUtil.renderGrid(exerciseSet.questions);',
    '}'
  ].join('\n'),
  addCheck: [
    'check(exerciseSet, userAnswers) {',
    '  return PluginUtil.computeResult(exerciseSet.questions, userAnswers);',
    '}'
  ].join('\n'),
  fixExport: [
    '// 文件末尾双环境导出（浏览器 + Node 自检）',
    'global.__currentPlugin = plugin;',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = plugin;',
    '}'
  ].join('\n'),
  fixGenerateReturn: [
    '// generate 必须返回含 questions 数组的 ExerciseSet（异步插件返回 Promise<ExerciseSet>）',
    'return { questions: questions, meta: { grade: options.grade, count: questions.length } };'
  ].join('\n'),
  fixRenderReturn: [
    '// render 必须同步返回 HTML 字符串；整组网格推荐 renderGrid，单题卡片用 renderCard(this, idx)',
    'render(exerciseSet) {',
    '  return PluginUtil.renderGrid(exerciseSet.questions);',
    '}'
  ].join('\n'),
  fixCheckReturn: [
    '// check 必须返回 { score, total, correct, message, results[], correctAnswers[] }',
    '// computeResult 已按该结构返回；自定义判定时给每题配 check(userAnswers, idx) 即可',
    'check(exerciseSet, userAnswers) {',
    '  return PluginUtil.computeResult(exerciseSet.questions, userAnswers);',
    '}'
  ].join('\n')
};

/** 由单个失败检查项生成一条结构化修复建议 */
function buildOneFix(r, c) {
  var base = {
    pluginId: r.id,
    file: r.file,
    check: c.name,
    reason: c.detail || '未通过'
  };
  switch (c.name) {
    case '2.方法完整性':
      // detail 形如「缺失或非函数：generate / render」，逐个缺失方法给出代码
      var missing = ['generate', 'render', 'check'].filter(function (m) {
        return base.reason.indexOf(m) !== -1;
      });
      if (!missing.length) missing = ['generate', 'render', 'check'];
      return missing.map(function (m) {
        return {
          pluginId: base.pluginId, file: base.file, check: c.name,
          reason: '缺少 ' + m + ' 方法',
          action: 'add-method', method: m,
          insertHint: m === 'generate'
            ? '在插件对象中添加 generate 方法（或改用 PluginUtil.createPlugin 工厂只需提供 generateQuestions）'
            : '在插件对象中添加 ' + m + ' 方法（或改用 createPlugin 工厂自动生成三大接口）',
          code: FIX_SNIPPETS[m === 'generate' ? 'addGenerate' : m === 'render' ? 'addRender' : 'addCheck']
        };
      });
    case '3.导出正确性':
      return [{
        pluginId: base.pluginId, file: base.file, check: c.name, reason: base.reason,
        action: 'fix-export',
        insertHint: '删除原导出语句后，在文件末尾添加以下双环境导出代码',
        code: FIX_SNIPPETS.fixExport
      }];
    case '4.接口一致性':
      return [{
        pluginId: base.pluginId, file: base.file, check: c.name, reason: base.reason,
        action: 'fix-generate-return',
        insertHint: '修改 generate 的返回值，确保包含 questions 数组',
        code: FIX_SNIPPETS.fixGenerateReturn
      }];
    case '5.渲染检查':
      return [{
        pluginId: base.pluginId, file: base.file, check: c.name, reason: base.reason,
        action: 'fix-render-return',
        insertHint: '替换 render 实现，确保同步返回 HTML 字符串',
        code: FIX_SNIPPETS.fixRenderReturn
      }];
    case '6.批改检查':
      return [{
        pluginId: base.pluginId, file: base.file, check: c.name, reason: base.reason,
        action: 'fix-check-return',
        insertHint: '替换 check 实现，确保返回含 score 与 results 的对象',
        code: FIX_SNIPPETS.fixCheckReturn
      }];
    default:
      // 1.存在性 / B.接口调用：无法给出确定代码，输出排查指引
      return [{
        pluginId: base.pluginId, file: base.file, check: c.name, reason: base.reason,
        action: c.name === '1.存在性' ? 'load-failure' : 'runtime-error',
        insertHint: FIX_SUGGESTIONS[c.name],
        code: null
      }];
  }
}

/**
 * 把批量检查结果转为结构化修复报告（JSON 友好）。
 * @param {{reports: Array, summary: Object}} out checkAll() 的返回值
 */
function buildFixReport(out) {
  return {
    generatedAt: new Date().toISOString(),
    summary: out.summary,
    plugins: out.reports.map(function (r) {
      var failedChecks = (r.checks || []).filter(function (c) { return !c.pass; });
      var fixes = [];
      if (!(r.checks || []).length && r.error) {
        fixes = buildOneFix(r, { name: '1.存在性', pass: false, detail: r.error });
      } else {
        failedChecks.forEach(function (c) {
          fixes = fixes.concat(buildOneFix(r, c));
        });
      }
      return {
        id: r.id,
        file: r.file,
        status: (r.passed && !r.error) ? 'pass' : 'fail',
        fixes: fixes
      };
    })
  };
}

// ---- CLI ----
if (require.main === module) {
  var args = process.argv.slice(2);
  var asJson = args.indexOf('--json') !== -1;
  var asReport = args.indexOf('--report') !== -1;
  var asFixJson = args.indexOf('--fix-json') !== -1;
  var idsArg = args.filter(function (a) {
    return a !== '--json' && a !== '--report' && a !== '--fix-json';
  })[0];
  var options = idsArg ? { ids: idsArg.split(',') } : {};
  if (asReport || asFixJson) options.quiet = true;

  checkAll(options).then(function (out) {
    if (asFixJson) {
      // 结构化修复建议：供 AI 助手解析并自动修改代码
      console.log(JSON.stringify(buildFixReport(out), null, 2));
    } else if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else if (asReport) {
      // 报告模式：每个插件一行（失败插件逐项一行），格式 [PASS]/[FAIL]
      out.reports.forEach(function (r) {
        formatReport(r).forEach(function (line) { console.log(line); });
      });
      console.log('\n== 汇总：共 ' + out.summary.total +
        '，通过 ' + out.summary.passed +
        '，失败 ' + out.summary.failed + ' ==');
    } else {
      out.reports.forEach(function (r) {
        console.log((r.passed ? '  ✓ ' : '  ✗ ') + r.id +
          '  （' + r.checks.filter(function (c) { return c.pass; }).length + '/' + r.checks.length + ' 项通过）');
        r.checks.forEach(function (c) {
          if (!r.passed || !c.pass) {
            console.log('      ' + (c.pass ? '· ' : '✗ ') + c.name + ' — ' + c.detail);
          }
        });
      });
      console.log('\n汇总：共 ' + out.summary.total +
        '，通过 ' + out.summary.passed +
        '，失败 ' + out.summary.failed +
        (out.summary.failedIds.length ? '（' + out.summary.failedIds.join(', ') + '）' : ''));
    }
    if (out.summary.failed > 0) process.exitCode = 1;
  }).catch(function (e) {
    console.error('检查器异常：', e);
    process.exitCode = 1;
  });
}
