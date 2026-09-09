/**
 * CI 门禁：ontology 字典完整性校验
 *
 * 目标：让 shared/ontology-*.map.js 成为唯一字典，负责把 knowledge-math.js 中的
 * 外键 ID 翻译成文案/算法/SVG 参数。本脚本逐一校验 knowledge-math.js 引用的所有
 * 外键 ID 都能在对应映射表中解析；任一缺失 → 构建失败（exit 1）。
 *
 *   [OPS]  operations[]        → ontology-operation-map.OP_SEMANTICS（symbol/calcMethod/visualAlias）
 *   [CAT]  category            → ontology-category-map.CATEGORIES
 *   [GFX]  graphicType         → GRAPHIC_RENDERERS ∪ 语义别名表（视觉别名）
 *   [ERR]  common_errors[].id  → ontology-error-map（全插件聚合索引）
 *   [BOOK] ontology-book-map 键必须都存在于 KB（无悬挂键）；kp.book 取值合法
 *   [MAPS] operation/factual/error-map 的 plugin 键必须都存在于 KB plugin 集合
 *
 * 用法：node dev/check-ontology-integrity.js [--full] [--errors-catalog]
 *   --full          打印全部缺失项（默认每个检查只打印前 5 条示例）
 *   --errors-catalog 输出缺失 error id 的迁移清单（id,category,description）
 */
(function () {
  'use strict';

  var path = require('path');
  var ROOT = path.join(__dirname, '..');

  var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
  var OpsMap = require(path.join(ROOT, 'shared', 'knowledge', 'ontology-operation-map.js'));
  var CatMap = require(path.join(ROOT, 'shared', 'knowledge', 'ontology-category-map.js'));
  var BookMap = require(path.join(ROOT, 'shared', 'knowledge', 'ontology-book-map.js'));
  var FactMap = require(path.join(ROOT, 'shared', 'knowledge', 'ontology-factual-map.js'));
  var ErrMap = require(path.join(ROOT, 'shared', 'knowledge', 'ontology-error-map.js'));
  var GraphicRenderer = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));

  var FULL = process.argv.indexOf('--full') !== -1;
  var CATALOG = process.argv.indexOf('--errors-catalog') !== -1;

  var printf = console.log.bind(console);

  function distinct(arr) {
    var seen = {};
    return (arr || []).filter(function (x) { return seen[x] ? false : (seen[x] = true, true); });
  }

  // ---------- 收集 KB 的 566 个 KP（平面化） ----------
  var KPs = [];
  var kpIdSet = {};
  var SUBJECTS = Object.keys(KnowledgeBank || {});
  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          kp.subject = s;
          kp.grade = g.grade != null ? g.grade : g.id;
          KPs.push(kp);
          kpIdSet[kp.id] = true;
        });
      });
    });
  });

  // ---------- 检查器 ----------
  var report = { checks: [] };
  function Check(name, pass, total, missing, note) {
    report.checks.push({
      name: name,
      pass: pass,
      total: total,
      missingCount: missing.length,
      missing: missing
    });
    var flag = pass ? 'PASS' : 'FAIL';
    printf('[' + flag + '] ' + name + '   total=' + total + '  missing=' + missing.length +
      (note ? '   (' + note + ')' : ''));
    if (!pass) {
      var show = FULL ? missing : missing.slice(0, 5);
      if (show.length) {
        printf('        -> ' + show.join(', ') + (!FULL && missing.length > show.length ? ' …' : ''));
      }
    }
  }

  // ---------- OPS: operations[] → OP_SEMANTICS ----------
  (function () {
    var missing = [];
    KPs.forEach(function (kp) {
      (kp.operations || []).forEach(function (op) {
        var s = OpsMap.semanticsFor(op);
        if (!s || !('visualAlias' in s)) missing.push(kp.id + ' :: ' + op);
      });
    });
    Check('OPS', missing.length === 0, KPs.length, distinct(missing), 'operation→symbol/calc/visualAlias');
  })();

  // ---------- CAT: category → CATEGORIES ----------
  (function () {
    var missing = [];
    KPs.forEach(function (kp) {
      if (kp.category && CatMap.CATEGORIES.indexOf(kp.category) === -1) {
        missing.push(kp.id + ' :: ' + kp.category);
      }
    });
    Check('CAT', missing.length === 0, KPs.length, distinct(missing), '分类白名单');
  })();

  // ---------- GFX: graphicType → 渲染器/视觉别名 ----------
  (function () {
    var GFX_ALIAS = {
      'number-line': 'number-line',   // semantic-question.schema GRAPHIC_TYPES
      'grid': 'grid',
      'ten-frame': 'make-ten',        // 旧字段 → make-ten 视觉族
      'vertical-form': 'calculation', // 旧字段 → 竖式视觉族
      'text': null                    // 无视觉（纯文本），合法哨兵
    };
    var rendererKeys = Object.keys(GraphicRenderer.GRAPHIC_RENDERERS || {});
    function resolve(gfx) {
      if (gfx == null) return true;
      if (GFX_ALIAS.hasOwnProperty(gfx)) return true;
      return rendererKeys.indexOf(gfx) !== -1;
    }
    var missing = [];
    KPs.forEach(function (kp) {
      if (!resolve(kp.graphicType)) missing.push(kp.id + ' :: ' + kp.graphicType);
    });
    Check('GFX', missing.length === 0, KPs.length, distinct(missing), 'graphicType→渲染器/别名');
  })();

  // ---------- ERR: common_errors[].id → ontology-error-map 聚合索引 ----------
  (function () {
    var errIndex = {};
    Object.keys(ErrMap.MAP || {}).forEach(function (plugin) {
      (ErrMap.MAP[plugin] || []).forEach(function (e) {
        if (e && e.id) errIndex[e.id] = (errIndex[e.id] || 0) + 1;
      });
    });
    var missing = [], dead = [];
    var referenced = {};
    KPs.forEach(function (kp) {
      (kp.common_errors || []).forEach(function (e) {
        var id = typeof e === 'string' ? e : (e && e.id);
        if (!id) return;
        referenced[id] = true;
        if (!errIndex[id]) missing.push(id);
      });
    });
    Object.keys(errIndex).forEach(function (id) {
      if (!referenced[id]) dead.push(id);
    });
    var u = distinct(missing);
    if (CATALOG) {
      printf('---- ERRORS CATALOG (id, category, description) ----');
      KPs.forEach(function (kp) {
        (kp.common_errors || []).forEach(function (e) {
          var id = typeof e === 'string' ? e : (e && e.id);
          if (id && !errIndex[id]) {
            var inner = (typeof e === 'string') ? {} : (e || {});
            printf('%s,%s,%s', id, inner.category || '', (inner.description || '').replace(/,/g, '，'));
          }
        });
      });
      return;
    }
    var totalRefs = Object.keys(referenced).length;
    Check('ERR', u.length === 0, totalRefs, u, 'error id→ontology-error-map');
    printf('   [INFO] 已注册但未被 KB 引用（死条目）: ' + dead.length +
      (dead.length ? '  -> ' + (FULL ? dead.join(', ') : dead.slice(0, 8).join(', ') + ' …') : ''));
  })();

  if (CATALOG) return finish(0);

  // ---------- BOOK: book-map 无悬挂键 + kp.book 取值合法 ----------
  (function () {
    var dangling = [], badBook = [];
    var ALLOWED = ['up', 'down', 'mixed', 'advance'];
    Object.keys(BookMap.BOOK_UNIT_MAP || {}).forEach(function (kpId) {
      if (!kpIdSet[kpId]) dangling.push(kpId);
    });
    KPs.forEach(function (kp) {
      if (kp.book && ALLOWED.indexOf(kp.book) === -1) badBook.push(kp.id + ' :: ' + kp.book);
    });
    Check('BOOK', dangling.length === 0 && badBook.length === 0,
      Object.keys(BookMap.BOOK_UNIT_MAP || {}).length + KPs.length,
      dangling.concat(badBook), 'book-map悬挂键 + book取值');
  })();

  // ---------- MAPS: 三张 plugin 键控 map 的键都存在于 KB ----------
  (function () {
    var pluginSet = {};
    KPs.forEach(function (kp) { if (kp.pluginId) pluginSet[kp.pluginId] = true; });
    var dangling = [];
    var maps = {
      operation: OpsMap.MAP,
      factual: FactMap.MAP,
      error: ErrMap.MAP
    };
    Object.keys(maps).forEach(function (name) {
      Object.keys(maps[name] || {}).forEach(function (plugin) {
        if (!pluginSet[plugin]) dangling.push(name + ' :: ' + plugin);
      });
    });
    Check('MAPS', dangling.length === 0, 0, dangling, 'map plugin键→KB存在');
  })();

  function finish(code) {
    var failed = report.checks.filter(function (c) { return !c.pass; });
    printf('\n-------- ontology 字典完整性校验 --------');
    report.checks.forEach(function (c) {
      printf('  ' + (c.pass ? 'PASS' : 'FAIL') + '  ' + c.name + '  missing=' + c.missingCount);
    });
    printf('  verdict: ' + (failed.length ? 'FAIL（存在未解析外键 ID）' : 'PASS（所有外键 ID 均可解析）'));
    return code;
  }

  var fail = report.checks.some(function (c) { return !c.pass; });
  process.exit(finish(fail ? 1 : 0));
})();