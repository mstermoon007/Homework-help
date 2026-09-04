/**
 * plugins/math-comprehensive.js — 数学综合练习插件
 *
 * 混合当前年级全部可用的数学插件题型，生成一份完整综合试卷：
 *   - 自动加载 PLUGIN_REGISTRY 中该年级所有已注册的数学插件（无需维护硬编码清单）；
 *   - 题量按领域权重分配：默认「领域配比」数与代数 60% / 图形几何 30% / 统计推理 10%，
 *     保证数与代数、图形几何、统计推理均有题目出现；可选 average（每插件均分）/
 *     domain（领域均分）；
 *   - 各插件题目混合后打乱顺序，卡片标注来源题型；
 *   - 渲染/判定一律走标准 Question 接口（q.render(idx) / q.check(userAnswers, idx)），
 *     单位、多空、有余数等复合答案由各题自身的 check 判定；
 *     批改给出综合得分 + 分领域/分题型正确率提示。
 *
 * generate 返回 Promise（需异步加载子插件），practice.html 已支持异步 generate。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-comprehensive.js 依赖 shared/common.js（PluginUtil），请先加载');

  // 子插件来源：统一从 PLUGIN_REGISTRY 动态选取（新增/删除插件自动同步，无硬编码清单）。
  // 仅在 PLUGIN_REGISTRY 不可用或当前无已注册数学插件时 reject，避免维护两份易漂移的数据。

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  // ============ 子插件异步加载 ============
  // 统一走 shared/common.js 的 App.PluginLoader（scriptCache / 5 秒超时 / deps 依赖链 /
  // Node require 回退均由加载器提供），本插件不再自建加载逻辑。
  var subPlugins = null;
  var subPluginMap = {};
  // 综合练习仅纳入「已实现题型」的插件：
  //   1. 占位插件（竞赛专题 C1-C9 未实现，isPlaceholder / competitionModule* 标记）一律剔除；
  //   2. 能力检测兜底：竞赛模块（category === 'competition'）且 generate 产出空题的插件剔除。
  //   （针对可能未打标记的占位实现；真实竞赛插件若已实现出题则自动放行）
  function isPlaceholderPlugin(p) {
    if (!p) return true;
    if (p.isPlaceholder || p.competitionModuleIds || p.competitionModuleId) return true;
    if (p.category === 'competition') {
      // 能力检测兜底：能真实出题的竞赛插件自动放行（占位实现 generate 产出空题）。
      // 异步 generate（返回 Promise）视为已实现，避免误杀。
      try {
        var probe = p.generate({ grade: (p.grades || [4])[0], count: 1 });
        if (probe && typeof probe.then === 'function') return false;
        return !(probe && probe.questions && probe.questions.length);
      } catch (e) { return true; }
    }
    return false;
  }
  function ensureSubPlugins() {
    if (subPlugins) return Promise.resolve(subPlugins);

    // 优先使用 practice.html 预加载的子插件（window.__mathSubPlugins）
    // 占位插件（竞赛专题）无实际题目，一律剔除，避免参与综合抽题
    var placeholderFilter = function (p) {
      return !isPlaceholderPlugin(p);
    };
    var preloaded = (typeof global !== 'undefined') ? global.__mathSubPlugins : null;
    if (Array.isArray(preloaded) && preloaded.length) {
      subPlugins = preloaded.filter(placeholderFilter);
      subPlugins.forEach(function (p) {
        if (p && p.id) subPluginMap[p.id] = p;
      });
      global.__currentPlugin = mathComprehensivePlugin; // 恢复当前插件，保证选项按钮 __choose 正确
      return Promise.resolve(subPlugins);
    }

    // 动态选取注册表中全部数学插件（新增插件自动纳入，无需改此清单）
    var registry = (typeof global.PLUGIN_REGISTRY !== 'undefined') ? global.PLUGIN_REGISTRY : [];
    var mathRecs = registry.filter(function (r) {
      return r && r.id && r.id.indexOf('math-') === 0 && r.id !== 'math-comprehensive' && !r.isPlaceholder;
    });
    if (!mathRecs.length) {
      return Promise.reject(new Error('PLUGIN_REGISTRY 不可用或当前无已注册的数学插件，无法加载综合练习子插件'));
    }
    var loader = (typeof App !== 'undefined' && App.PluginLoader) ? App.PluginLoader : null;
    if (!loader) {
      return Promise.reject(new Error('math-comprehensive 依赖 App.PluginLoader（shared/common.js），请先加载'));
    }
    subPlugins = [];
    subPluginMap = {};
    // 单个插件加载失败仅跳过（console.warn），不阻塞整份综合卷
    return Promise.all(mathRecs.map(function (rec) {
      return loader.loadPlugin(rec).then(function (p) {
        if (p && p.id) {
          subPlugins.push(p);
          subPluginMap[p.id] = p;
        }
      }).catch(function (e) {
        if (global.console) global.console.warn('[math-comprehensive] 跳过子插件 ' + rec.id + '：' + (e && e.message));
      });
    })).then(function () {
      global.__currentPlugin = mathComprehensivePlugin; // 恢复当前插件，保证选项按钮 __choose 正确
      return subPlugins;
    });
  }

    // ============ 题量分配 ============
    // mode:
    //   'average'  每插件均分（余数给前面插件）
    //   'domain'   按领域均分（number/geometry/statistics 各领域题量相等，再在领域内均分）
    //   'weighted' 按领域权重配比（默认 60/30/10，保证三个领域均有题目）
    var DOMAIN_ORDER = ['number', 'geometry', 'statistics'];
    var DOMAIN_WEIGHTS = { number: 60, geometry: 30, statistics: 10 };
    var DOMAIN_NAMES = { number: '数与代数', geometry: '图形几何', statistics: '统计推理' };

    // 按领域配比分配题量：最大余数法 + 每个出现的领域至少 1 题（题量足够时）
    function allocateDomain(count, plugins, weights) {
      var groups = {}; // category -> [plugin]
      plugins.forEach(function (p) {
        var c = p.category || 'number';
        if (!groups[c]) groups[c] = [];
        groups[c].push(p);
      });
      var cats = DOMAIN_ORDER.filter(function (c) { return groups[c]; });

      var wsum = 0;
      cats.forEach(function (c) { wsum += (weights[c] || 0); });
      if (!wsum) cats.forEach(function (c) { wsum += 1; });

      // 各领域题量（最大余数法）
      var shares = {};
      var fracs = [];
      var total = 0;
      cats.forEach(function (c) {
        var ideal = count * (weights[c] || 0) / wsum;
        var f = Math.floor(ideal);
        shares[c] = f;
        total += f;
        fracs.push({ c: c, f: ideal - f });
      });
      fracs.sort(function (a, b) { return b.f - a.f; });
      var k = 0;
      while (total < count) { shares[fracs[k % fracs.length].c]++; total++; k++; }

      // 保证每个出现的领域至少 1 题（题量 >= 领域数时）
      if (count >= cats.length) {
        cats.forEach(function (c) {
          if (shares[c] < 1) {
            var donor = cats.filter(function (x) { return shares[x] > 1; })
              .sort(function (a, b) { return shares[b] - shares[a]; })[0];
            if (donor) { shares[donor]--; shares[c]++; }
          }
        });
      }

      // 领域内均分
      return plugins.map(function (p) {
        var c = p.category || 'number';
        var g = groups[c];
        var catShare = shares[c] || 0;
        var per = Math.floor(catShare / g.length);
        var extra = catShare % g.length;
        var pos = g.indexOf(p);
        return per + (pos < extra ? 1 : 0);
      });
    }

    function allocateCounts(count, plugins, mode) {
      if (mode === 'weighted') {
        return allocateDomain(count, plugins, DOMAIN_WEIGHTS);
      }
      if (mode === 'domain') {
        var equal = {};
        DOMAIN_ORDER.forEach(function (c) { equal[c] = 1; });
        return allocateDomain(count, plugins, equal);
      }
      // average（默认）：每插件均分，余数给前面的插件
      var per = Math.floor(count / plugins.length);
      var extra = count % plugins.length;
      return plugins.map(function (p, idx) { return per + (idx < extra ? 1 : 0); });
    }

    // ============ 知识点权重（来自 knowledge-bank.js 统一结构） ============
    // 每个插件的权重 = 其名下所有知识点 weight 之和（weight 代表抽题比例/重要度）。
    // 若知识库不可用或某条目缺字段，按领域默认值兜底（数与代数4 / 图形几何3 / 统计推理2）。
    var CATEGORY_IMPORTANCE = { number: 4, geometry: 3, statistics: 2, mixed: 3 };
    function entryImportance(e) {
      return (typeof e.weight === 'number') ? e.weight
        : (CATEGORY_IMPORTANCE[e.category] || 3);
    }

    // 知识点级抽题计划：读取当前年级知识库知识点（含 weight 与推荐 type），
    // 按知识点 weight 比例分配题量，返回按插件聚合的分配计划：
    //   [{ plugin, count, points: [{ id, name, type, count }] }]
    // 若某插件在知识库无条目（兜底），则按领域默认 weight 参与分配。
    function kbEntryPlan(grade, plugins, count) {
      var entries = (typeof KnowledgeBank !== 'undefined' && KnowledgeBank.getEntries)
        ? KnowledgeBank.getEntries('math', grade) : [];
      var byPlugin = {}; // pluginId -> { plugin, points: [], total: 0 }
      plugins.forEach(function (p) {
        byPlugin[p.id] = { plugin: p, points: [], total: 0 };
      });
      if (entries.length) {
        entries.forEach(function (e) {
          if (!e.pluginId || !byPlugin[e.pluginId]) return;
          // 知识点抽题权重（历史加权自适应已移除：固定权重，不再按薄弱度加成）
          byPlugin[e.pluginId].points.push({
            id: e.id, name: e.name, type: e.type || null,
            weight: entryImportance(e),
            lowerDiff: false,
            _stats: null
          });
          byPlugin[e.pluginId].total += entryImportance(e);
        });
      }
      // 无知识库条目（或条目缺失）的插件：按领域默认 weight 兜底，保证不遗漏题型
      plugins.forEach(function (p) {
        if (byPlugin[p.id].total === 0) byPlugin[p.id].total = CATEGORY_IMPORTANCE[p.category] || 3;
      });
      // 归一化：总题数按各插件权重比例分配到插件
      var plan = plugins.map(function (p) { return byPlugin[p.id]; });
      var total = 0;
      plan.forEach(function (item) { total += item.total; });
      var perPlugin = allocateByWeight(count, plugins, plan.map(function (item) { return item.total; }));
      // 插件内部：若含多个知识点，按知识点 weight 比例细分到各点
      plan.forEach(function (item, idx) {
        var n = perPlugin[idx];
        item.count = n;
        if (!item.points.length) return;
        var pTotal = 0;
        item.points.forEach(function (pt) { pTotal += pt.weight; });
        if (pTotal <= 0) { item.points[0].count = n; return; }
        var perPt = allocateByWeight(n, item.points, item.points.map(function (pt) { return pt.weight; }));
        item.points.forEach(function (pt, i) { pt.count = perPt[i]; });
      });
      return plan;
    }

    // 按权重分配题量（最大余数法）：重要度高的插件抽到更多题
    function allocateByWeight(count, plugins, weights) {
      var total = 0;
      weights.forEach(function (w) { total += (w || 0); });
      if (!total) { // 全部无权重：退化为均分
        var per = Math.floor(count / plugins.length);
        var extra = count % plugins.length;
        return plugins.map(function (p, idx) { return per + (idx < extra ? 1 : 0); });
      }
      var shares = plugins.map(function (p, i) {
        return Math.floor(count * (weights[i] || 0) / total);
      });
      var assigned = 0;
      shares.forEach(function (s) { assigned += s; });
      var fracs = plugins.map(function (p, i) {
        return { i: i, f: count * (weights[i] || 0) / total - shares[i] };
      }).sort(function (a, b) { return b.f - a.f; });
      var k = 0;
      while (assigned < count) { shares[fracs[k % fracs.length].i]++; assigned++; k++; }
      return shares;
    }

    // 答案展示格式化：支持数字/字符串/多空数组/有余数除法对象
    function formatAnswer(ans) {
      if (ans == null) return '';
      if (Array.isArray(ans)) return ans.join('、');
      if (typeof ans === 'object') {
        if (typeof ans.q !== 'undefined' && typeof ans.r !== 'undefined') return ans.q + '……余 ' + ans.r;
        if (typeof ans.quotient !== 'undefined' && typeof ans.remainder !== 'undefined') {
          return ans.quotient + '……余 ' + ans.remainder;
        }
        return JSON.stringify(ans);
      }
      return String(ans);
    }

  // 自适应难度统计已移除（App.Adaptive 模块已删除）：保留空桩以避免破坏综合练习抽题
  // 逻辑——返回 null 表示「不加权 / 不降档 / 不补强」，与无历史记录时行为一致。
  function adaptiveStats() { return null; }

  /** 全库知识点索引：id → { kp(含 prerequisites/type), grade } */
  function bankKpIndex() {
    var KB = global.KnowledgeBank;
    var idx = {};
    if (!KB || typeof KB !== 'object') return idx;
    // 科目分组对象：遍历全部科目数组
    Object.keys(KB).forEach(function (subject) {
      if (!Array.isArray(KB[subject])) return;
      KB[subject].forEach(function (entry) {
        (entry.modules || []).forEach(function (mod) {
          (mod.knowledgePoints || []).forEach(function (kp) {
            idx[kp.id] = { kp: kp, grade: entry.grade };
          });
        });
      });
    });
    return idx;
  }

  // ============ 期末模拟卷（exam 子类型） ============
  // 固定结构试卷模板：按知识库模块分配题量，从对应注册插件抽题。
  // 各模块知识点来源（knowledge-math.js 一年级模块）：
  //   一 口算(M1) / 二 填空(M4) / 三 判断(M11+M4/M6) / 四 选择(M12+M1/M4/M6)
  //   五 连线(M5) / 六 看图列式(M7) / 七 解决问题(M8) / 八 操作题(M6)
  // 二年级期末模拟卷模板（满分按各题分值累加，详见下方 score）
  var EXAM_TEMPLATE = [
    { title: '一、口算',     modules: ['M1'],                        qCount: 20, score: 1 },
    { title: '二、填空',     modules: ['M4'],                        qCount: 10, score: 2 },
    { title: '三、判断',     modules: ['M11', 'M4', 'M6'],           qCount: 5,  score: 2, wantType: 'judge' },
    { title: '四、选择',     modules: ['M12', 'M1', 'M4', 'M6'],     qCount: 5,  score: 2, wantType: 'choice' },
    { title: '五、竖式计算', modules: ['M2'],                        qCount: 4,  score: 3 },
    { title: '六、脱式计算', modules: ['M3'],                        qCount: 4,  score: 3 },
    { title: '七、看图列式', modules: ['M7'],                        qCount: 4,  score: 3 },
    { title: '八、解决问题', modules: ['M8'],                        qCount: 6,  score: 4 },
    { title: '九、操作题',   modules: ['M6'],                        qCount: 2,  score: 4, wantTag: 'operation' },
    { title: '十、统计与推理', modules: ['M9', 'M10'],               qCount: 2,  score: 5 }
  ];

  // 按模块聚合当前年级知识点（moduleId -> [{id,name,type,weight,pluginId}]）
  function examKpByModule(grade) {
    var entries = (typeof KnowledgeBank !== 'undefined' && KnowledgeBank.getEntries)
      ? KnowledgeBank.getEntries('math', grade) : [];
    var map = {};
    entries.forEach(function (e) {
      var mid = e.moduleId;
      if (!mid) return;
      if (!map[mid]) map[mid] = [];
      map[mid].push(e);
    });
    return map;
  }

  // M4-R19：以下 抽题/生成 已统一改走 Strategy→Generator（见 examDrawQuestions 与 generateForKp），
  // 原 examWeightedPick/examGenOne（直接 plugin.generate）已移除，不再使用子插件 generate 方法出题。

  // 从候选知识点抽取 n 道题目，池不足时按权重补足至目标题量
  // difficulty 透传给各子插件，使期末试卷随难度档位自适应出题（题量固定，不随 count 变化）
  // M4-R19：期末卷逐知识点走 Strategy → Generator（不再直接调 plugin.generate）
  // cands 为 [{ id, name, type, category, weight, pluginId }]；返回 Promise<Question[]>
  function examDrawQuestions(cands, grade, n, difficulty) {
    if (!cands.length) return Promise.resolve([]);
    var weights = cands.map(function (c) { return c.weight || 1; });
    var alloc = allocateByWeight(n, cands, weights);
    var tasks = [];
    cands.forEach(function (c, i) {
      var cnt = alloc[i];
      if (cnt <= 0) return;
      tasks.push(migrateSwitchReady().then(function () {
        return generateForKp({
          id: c.id, name: c.name, type: c.type, category: c.category, weight: c.weight, pluginId: c.pluginId
        }, cnt, grade, difficulty).then(function (qs) {
          qs.forEach(function (q) { q.__kp = c; q.knowledgePointId = c.id; });
          return qs;
        });
      }));
    });
    return Promise.all(tasks).then(function (groups) {
      var qs = [];
      groups.forEach(function (g) { qs = qs.concat(g); });
      // 池不足目标题量时按权重补足
      var guard = 0;
      return (function fill(cur) {
        if (cur.length >= n || guard >= n * 4) return cur.slice(0, n);
        guard++;
        var c2 = examWeightedPickSilent(cands);
        if (!c2) return cur.slice(0, n);
        return generateForKp({
          id: c2.id, name: c2.name, type: c2.type, category: c2.category, weight: c2.weight, pluginId: c2.pluginId
        }, 1, grade, difficulty).then(function (g) {
          var q2 = g && g[0];
          if (!q2) return cur.slice(0, n);
          q2.__kp = c2; q2.knowledgePointId = c2.id;
          cur.push(q2);
          return fill(cur);
        }).catch(function () { return cur.slice(0, n); });
      })(qs);
    });
  }

  function migrateSwitchReady() {
    var Sw = (typeof MigrationSwitch !== 'undefined')
      ? MigrationSwitch
      : ((typeof global !== 'undefined' && global.MigrationSwitch) ? global.MigrationSwitch : null);
    if (Sw && Sw.apply) Sw.apply();
    return Promise.resolve();
  }

  // 与 examWeightedPick 相同，但返回 cand 本身而非再次构造（避免依赖 plugin 对象）
  function examWeightedPickSilent(cands) {
    var wsum = 0;
    cands.forEach(function (c) { wsum += (c.weight || 1); });
    if (!wsum) return cands[0] || null;
    var r = _PU.randInt(0, 999999999) / 1e9 * wsum, acc = 0;
    for (var i = 0; i < cands.length; i++) { acc += (cands[i].weight || 1); if (r < acc) return cands[i]; }
    return cands[cands.length - 1] || null;
  }

  // 组装期末模拟卷：返回标准 ExerciseSet（Promise，需先加载子插件）
  // difficulty 透传至子插件以实现「只适应难度」；题量由模板固定（count 仅占位）
  function buildExamPaper(grade, count, difficulty) {
    return ensureSubPlugins().then(function () {
      migrateSwitchReady();
      var byMod = examKpByModule(grade);
      var questions = [];
      var sections = [];
      var tasks = [];
      EXAM_TEMPLATE.forEach(function (sec) {
        tasks.push(migrateSwitchReady().then(function () {
          var cands = [];
          sec.modules.forEach(function (mid) {
            (byMod[mid] || []).forEach(function (kp) {
              var p = subPluginMap[kp.pluginId];
              if (!p) return;                                   // 该知识点无对应插件 → 跳过
              if (!p.grades || p.grades.indexOf(grade) === -1) return;
              if (sec.wantType && kp.type !== sec.wantType) return; // 仅取目标题型知识点
              if (sec.wantTag === 'operation' && kp.pluginId !== 'math-g1-operation') return;
              cands.push({
                id: kp.id, name: kp.name, type: kp.type,
                category: p.category || kp.category || 'number',
                weight: (typeof kp.weight === 'number' ? kp.weight : 3),
                pluginId: kp.pluginId
              });
            });
          });
          if (!cands.length) return;                           // 该部分无可用插件 → 跳过整段
          return examDrawQuestions(cands, grade, sec.qCount, difficulty).then(function (qs) {
            if (!qs.length) return;
            var start = questions.length;
            qs.forEach(function (q, j) {
              q._section = sections.length;
              q._examNo = j + 1;
              q._examScore = sec.score;   // 期末卷按题给分，check 依此累计总分
              questions.push(q);
            });
            sections.push({ title: sec.title, count: qs.length, score: sec.score, start: start });
          });
        }));
      });
      return Promise.all(tasks).then(function () {
        if (!questions.length) {
          throw new Error('期末模拟卷暂无可用的已实现题型，请返回选择其他题型');
        }
        return {
          questions: questions,
          meta: {
            grade: grade,
            count: questions.length,
            title: '期末模拟卷',
            exam: true,
            sections: sections
          }
        };
      });
    });
  }

  // 试卷渲染：各大部分独立区块标题，不显示来源徽章（无括号注释）
  function renderExam(set) {
    var meta = set.meta || {};
    var html = '<div class="exam-paper">';
    (meta.sections || []).forEach(function (sec) {
      html += '<section class="exam-part">';
      html += '<h3 class="exam-part-title">' + sec.title + '</h3>';
      html += '<div class="exam-part-items">';
      for (var i = sec.start; i < sec.start + sec.count; i++) {
        var q = set.questions[i];
        if (!q || typeof q.render !== 'function') continue;
        html += '<div class="q-wrap">' + q.render(i) + '</div>';
      }
      html += '</div></section>';
    });
    html += '</div>';
    return html;
  }

  // ============ M4-R19 Strategy → Generator 管线 ============
  //
  // 变更：不再由本插件直接调子插件 plugin.generate(subOpts) 出题，
  // 而是逐知识点走统一管线：
  //   KnowledgeBank → knowledgePoint(weight 只分配题量) → StrategyEngine.plan
  //   → GeneratorSelector.selectGenerator → instantiate → Generator.generate
  //   → SemanticQuestion → 语义渲染桥(toQuestion) → 标准 Question。
  // weight 仅用于「知识点题量分配」，不参与生成逻辑。

  // 年级可用子插件集合（剔除占位、年级不符）
  function applicablePlugins(subs, grade) {
    return subs.filter(function (p) {
      return !isPlaceholderPlugin(p) && p.grades && p.grades.indexOf(grade) !== -1;
    });
  }

  // 年级知识点清单（扁平：取自知识库 getEntries，附加 category/weight/pluginId）
  function gradeKps(grade) {
    var entries = (typeof KnowledgeBank !== 'undefined' && KnowledgeBank.getEntries)
      ? KnowledgeBank.getEntries('math', grade) : [];
    var pluginIds = {};
    (subPluginMap && Object.keys(subPluginMap)).forEach(function (id) { pluginIds[id] = 1; });
    return entries.map(function (e) {
      return {
        id: e.id,
        name: e.name,
        type: e.type || null,
        category: e.category || 'number',
        weight: entryImportance(e),
        pluginId: e.pluginId,
        _usable: !!e.pluginId && !!pluginIds[e.pluginId]
      };
    }).filter(function (k) { return k._usable; });
  }

  // 领域内按权重或均分分配（保证权重仅做数量分配）
  function allocateKps(count, kps, perDomain, weights) {
    // 无领域分组：整体按权重/均分
    if (!perDomain) {
      var ws = weights || kps.map(function (k) { return k.weight; });
      return allocateByWeight(count, kps, ws);
    }
    // 按领域分组
    var groups = {};
    kps.forEach(function (k, i) { (groups[k.category] = groups[k.category] || []).push(i); });
    var cats = Object.keys(groups);
    var wsum = 0;
    cats.forEach(function (c) { wsum += (weights[c] || 0); });
    if (!wsum) cats.forEach(function (c) { wsum += 1; });
    var shares = {};
    var fracs = [];
    var total = 0;
    cats.forEach(function (c) {
      var ideal = count * (weights[c] || 0) / wsum;
      shares[c] = Math.floor(ideal); total += Math.floor(ideal);
      fracs.push({ c: c, f: ideal - Math.floor(ideal) });
    });
    fracs.sort(function (a, b) { return b.f - a.f; });
    var k = 0;
    while (total < count) { shares[fracs[k % fracs.length].c]++; total++; k++; }
    // 领域内均分（或按权重）
    var out = kps.map(function () { return 0; });
    cats.forEach(function (c) {
      var idxs = groups[c];
      var catN = shares[c] || 0;
      if (!catN) return;
      var per = Math.floor(catN / idxs.length);
      var extra = catN % idxs.length;
      idxs.forEach(function (ai, j) { out[ai] = per + (j < extra ? 1 : 0); });
    });
    return out;
  }

  /**
   * 逐知识点 → Strategy → Generator → 语义题 → 标准题。
   * @param {Object} kp 知识点 { id, name, type, category, weight }
   * @param {number} n  题量
   * @returns {Promise<Array<Object>>} 标准 Question[]（Promise，因 legacy generate 可异步）
   */
  function generateForKp(kp, n, grade, difficulty, existingPlan) {
    // M4-19：Generator Runtime 统一来自 shared/strategy-engine.bundle.js 挂载的全局。
    // 不再运行时 require（消灭 require 链）；缺失即显式抛错，方便定位加载顺序问题。
    // Node 直接 require 本插件（仅测试 allocateByWeight 等纯函数）时不会走到此处生题，
    // 故无需 require fallback —— 保持与浏览器一致的全链路由全局注入。
    var g = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
    var Engine = g.StrategyEngine;
    var Selector = g.GeneratorSelector;
    var Bridge = g.SemanticQuestionBridge;
    if (!Engine || !Selector || !Bridge) {
      throw new Error('M4-19: Generator Runtime 未加载（需先加载 shared/strategy-engine.bundle.js）');
    }

    var diff = (difficulty != null) ? difficulty : 3;
    // M7-R11：优先复用 ComprehensiveStrategy 已决策的 QuestionPlan（避免二次规划），
    // 无则回退单点规划。子插件对象仅经 LegacyAdapter.instantiate 注入，不再直接调用其 generate。
    var plan = existingPlan || Engine.plan({ knowledgePointId: kp.id, count: n, difficulty: diff }).plans[0];
    var selection = Selector.selectGenerator(plan);
    var plugin = null;
    if (selection.record && selection.record.scope === 'legacy') {
      var pid = selection.record.id.replace('legacy:', '');
      plugin = subPluginMap[pid] || null;
    }
    var inst = Selector.instantiate(selection, plugin);
    if (!inst) return Promise.resolve([]); // 无生成器（KP 无插件/无实现）→ 跳过该知识点

    var genResult = inst.generate(plan, { grade: grade, count: n });
    var unwrap = function (sems) {
      var qs = Bridge.toQuestions(sems || []);
      qs.forEach(function (q) {
        q.__src = subPluginMap[kp.pluginId] || null;
        q.__kp = kp;
        q.knowledgePointId = kp.id;
        q.difficulty = diff;
      });
      return qs;
    };
    if (genResult && typeof genResult.then === 'function') return genResult.then(unwrap);
    return Promise.resolve(unwrap(genResult));
  }

  // M7-R11：综合练习分配/规划统一交给 ComprehensiveStrategy（Resource 覆盖、题量分配、
  // 难度分布、跨知识点混合、coveragePolicy），本插件不再手写子插件抽题流程。
  // policy 映射：kb→weighted（知识点 weight），average→balanced，domain/weighted→weighted，
  // 另透传 weak-first / recent-first（依赖 learnerProfile）。
  // 返回 { questions, categoryCounts, weightInfo, coverage }。
  function comprehensiveStrategyGenerate(grade, count, difficulty, policy, learnerProfile) {
    var g = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
    var CS = g.ComprehensiveStrategy;
    if (!CS) {
      throw new Error('M7-R11: ComprehensiveStrategy 未加载（需先加载 shared/strategy/comprehensive-strategy.js）');
    }
    var diff = (difficulty != null) ? difficulty : undefined;
    return CS.build({
      subject: 'math',
      grade: grade,
      count: count,
      difficulty: diff,
      coveragePolicy: policy,
      learnerProfile: learnerProfile || null
    }).then(function (res) {
      var categoryCounts = {};
      var weightInfo = [];
      var proms = (res.plans || []).map(function (plan) {
        var entry = plan.__comprehensive || {};
        var kp = { id: entry.kpId, name: entry.kpId, type: plan.questionTypeId || null, pluginId: entry.pluginId };
        return generateForKp(kp, plan.count, grade, plan.difficulty, plan).then(function (qs) {
          if (!qs.length) return [];
          weightInfo.push((entry.kpId || '') + '×' + qs.length + (plan.difficulty ? '(D' + plan.difficulty + ')' : ''));
          var cat = (subPluginMap[entry.pluginId] && subPluginMap[entry.pluginId].category) || 'number';
          categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
          return qs;
        }).catch(function () { return []; });
      });
      return Promise.all(proms).then(function (groups) {
        var questions = [];
        groups.forEach(function (gq) { questions = questions.concat(gq); });
        return {
          questions: questions,
          categoryCounts: categoryCounts,
          weightInfo: weightInfo,
          coverage: (res.trace && res.trace.coverage) || null,
          failedPlans: (res.trace && res.trace.failedPlans) || []
        };
      });
    });
  }

  // 按模式产出 flat [{ kp, count }] 分配计划；weight 仅用于题量分配
  function kpAllocation(grade, plugs, count, mode) {
    var kps = gradeKps(grade);
    var valid = [], perPlugin = {};
    plugs.forEach(function (p) { perPlugin[p.id] = 1; });
    kps.forEach(function (k) { if (perPlugin[k.pluginId]) valid.push(k); });
    if (!valid.length) return [];

    var counts;
    if (mode === 'kb') {
      counts = allocateByWeight(count, valid, valid.map(function (k) { return k.weight; }));
    } else if (mode === 'average') {
      counts = allocateKps(count, valid, false, valid.map(function () { return 1; }));
    } else if (mode === 'domain') {
      counts = allocateKps(count, valid, true, { number: 1, geometry: 1, statistics: 1 });
    } else { // weighted(default)
      counts = allocateKps(count, valid, true, DOMAIN_WEIGHTS);
    }
    return valid.map(function (k, i) { return { kp: k, count: counts[i] }; })
      .filter(function (item) { return item.count > 0; });
  }

  // 旧分配兜底（ComprehensiveStrategy 不可用时的纯子插件路径，保证 Node/验收/降级可用）：
  // 按 mode 用 kpAllocation 分配，再逐知识点 generateForKp。返回 { questions, weightInfo, categoryCounts }。
  function legacyStrategyGenerate(grade, count, difficulty, mode) {
    var legacyMode = mode;
    if (legacyMode === 'weak-first' || legacyMode === 'recent-first') legacyMode = 'weighted';
    var plan = kpAllocation(grade, applicablePlugins(subPluginMap ? Object.keys(subPluginMap).map(function (id) { return subPluginMap[id]; }) : [], grade), count, legacyMode);
    var weightInfo = [];
    var categoryCounts = {};
    return Promise.all(plan.map(function (item) {
      return generateForKp(item.kp, item.count, grade, difficulty).then(function (qs) {
        if (!qs.length) return [];
        weightInfo.push(item.kp.id + '×' + qs.length);
        var cat = item.kp.category || 'number';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
        return qs;
      }).catch(function () { return []; });
    })).then(function (groups) {
      var questions = [];
      groups.forEach(function (gq) { questions = questions.concat(gq); });
      return { questions: questions, weightInfo: weightInfo, categoryCounts: categoryCounts, coverage: null, failedPlans: [] };
    });
  }

  // 避免重复模块加载标识冲突时覆盖子插件：提供安全的全局读取
  var gvar = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
  function hasComprehensiveStrategy() {
    return !!gvar.ComprehensiveStrategy;
  }

  // ============ ExercisePlugin ============
  /** @type {ExercisePlugin} */
  var mathComprehensivePlugin = {
    id: 'math-comprehensive',
    moduleId: 'M8',
    name: '综合练习',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },

      settings: [
        {
          key: 'type',
          label: '组卷方式',
          default: 'kb',
          options: [
            { value: 'kb',       label: '按知识点重要度（课时占比，表内乘法等核心题型更多）' },
            { value: 'weighted', label: '领域配比（数与代数60%·图形几何30%·统计推理10%）' },
            { value: 'average',  label: '均衡分配' },
            { value: 'domain',   label: '按领域分布' },
            { value: 'exam',     label: '期末模拟试卷', divider: true }
          ]
        }
      ],

      // 期末模拟卷子类型：题型选择页卡片链接携带 &subtype=exam 即走固定模板生成
      subtypes: [{ id: 'exam', label: '期末模拟卷' }],

      // 对外方法：生成期末模拟卷（grade 年级；count 仅占位，题量由模板固定）
      generateExamPaper: function (grade, count) {
        return buildExamPaper(grade || 1, count || 54);
      },

      generate: function (options) {
        var opts = options || {};
        // 期末模拟卷：同样走 Strategy → Generator 逐知识点管线（EXAM_TEMPLATE 只定题量/配比）
        if (opts.subtype === 'exam' || opts.type === 'exam') {
          return buildExamPaper(opts.grade || 1, opts.count || 54, opts.difficulty);
        }
        var grade = opts.grade || 1;
        var count = opts.count || 10;
        // M7-R11：分配/规划统一交给 ComprehensiveStrategy。
        // 旧 mode 映射：kb→weighted；average→balanced；domain/weighted→weighted；另透传 weak-first / recent-first。
        var mode = opts.type || 'kb';
        var policy = mode;
        if (mode === 'kb') policy = 'weighted';
        else if (mode === 'average') policy = 'balanced';
        else if (mode === 'domain' || mode === 'weighted') policy = 'weighted';
        else if (mode !== 'weak-first' && mode !== 'recent-first') policy = 'weighted';

        return ensureSubPlugins().then(function () {
          // 迁移开关：已迁移知识点（R17+R18）走原生 core 生成器，
          // 其余仍经 legacy 适配器（instantiate 时注入子插件）。全局可重复调用，幂等。
          if (typeof MigrationSwitch !== 'undefined' && MigrationSwitch.apply) MigrationSwitch.apply();

          var runner;
          if (hasComprehensiveStrategy()) {
            // M7-R11 主径：ComprehensiveStrategy 分配/规划 → 逐知识点 Strategy → Generator
            runner = comprehensiveStrategyGenerate(grade, count, opts.difficulty, policy, opts.learnerProfile);
          } else {
            // 兜底：旧 kpAllocation 分配（浏览器由 practice.html 保证加载 CS；Node/离线验收走此路径）
            runner = legacyStrategyGenerate(grade, count, opts.difficulty, mode);
          }
          return runner.then(function (res) {
            var questions = _PU.shuffle(res.questions);

            // 空集保护：综合练习不能为空
            if (!questions.length) {
              throw new Error('当前年级数学综合练习暂无可用的已实现题型，请返回选择其他题型');
            }

            return {
              questions: questions,
              meta: {
                grade: grade,
                count: questions.length,
                title: '小学' + gradeName(grade) + '数学综合练习',
                distribution: mode,
                distributionPolicy: policy,
                weights: res.weightInfo,
                categoryCounts: res.categoryCounts,
                weight: res.weightInfo,
                coverage: res.coverage,
                failedPlans: res.failedPlans
              }
            };
          });
        });
      },

      // M7-R08/R14：综合练习新出口 —— 直接产出 SemanticQuestion[]（经 GenerationEngine 全链：
      // ComprehensiveStrategy → StrategyEngine → Generator → Validator → Regenerate → Render）。
      // 与生成本身解耦：结果交由 PresentationRenderer 渲染。
      generateSemantic: function (options) {
        var opts = options || {};
        var g = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
        var GE = g.GenerationEngine;
        if (!GE) {
          return Promise.reject(new Error('M7-R08: GenerationEngine 未加载（需先加载 shared/generation-engine.js）'));
        }
        var grade = opts.grade || 1;
        var count = opts.count || 10;
        var mode = opts.type || 'kb';
        var policy = mode;
        if (mode === 'kb' || mode === 'weighted' || mode === 'domain') policy = 'weighted';
        else if (mode === 'average') policy = 'balanced';
        if (mode === 'exam' || opts.type === 'exam') {
          return Promise.reject(new Error('期末模拟卷请使用 generate(生成 legacy 题面)'));
        }
        return GE.generate({
          model: 'comprehensive',
          subject: 'math',
          grade: grade,
          count: count,
          difficulty: opts.difficulty,
          coveragePolicy: policy,
          learnerProfile: opts.learnerProfile || null
        }, { renderOptions: opts.renderOptions });
      },

  render: function (exerciseSet) {
        if (exerciseSet && exerciseSet.meta && exerciseSet.meta.exam) return renderExam(exerciseSet);
        var html = '';
        exerciseSet.questions.forEach(function (q, i) {
          if (typeof q.render !== 'function') return;
          var src = q.__src;
          var badge = '';
          if (src && src.name && src.category) {
            var dn = DOMAIN_NAMES[src.category] || src.category;
            badge = '<span class="q-badge">' + dn + ' · ' + src.name + '</span>';
          }
          html += '<div class="q-wrap">' + badge + q.render(i) + '</div>';
        });
        return html;
      },

      check: function (exerciseSet, userAnswers) {
        // 期末模拟卷：按各题分值累计得分（满分 = Σ 分值），而非百分比
        if (exerciseSet && exerciseSet.meta && exerciseSet.meta.exam) {
          var eRes = [], earned = 0, totalPts = 0, correctAnswers = [];
          exerciseSet.questions.forEach(function (q, i) {
            var ok = (typeof q.check === 'function')
              ? !!q.check(userAnswers, i)
              : !!_PU.defaultQCheck(q, userAnswers, i);
            eRes.push(ok);
            var pt = (typeof q._examScore === 'number') ? q._examScore : 1;
            totalPts += pt;
            if (ok) earned += pt;
            correctAnswers.push(formatAnswer(q.answer));
          });
          var eScore = totalPts === 0 ? 0 : Math.round(earned / totalPts * 100);
          var msg = (eScore === 100) ? '太棒了！全对！'
            : (eScore >= 60) ? '及格啦，继续加油！' : '继续加油！';
          return {
            score: eScore, total: totalPts, correct: earned, message: msg,
            results: eRes, correctAnswers: correctAnswers,
            examPoints: { earned: earned, total: totalPts }
          };
        }

        var correct = 0;
        var results = [];
        var correctAnswers = [];
        var domainStats = {}; // category -> { total, correct }

        exerciseSet.questions.forEach(function (q, i) {
          var ok;
          if (typeof q.check === 'function') {
            ok = !!q.check(userAnswers, i); // 标准 Question.check：统一判定任意题型（含单位/多空/复合答案）
          } else {
            // 缺省回退：与 createPlugin 的 defaultCheck 一致（multi 分字段 / 其余整串比较）
            ok = !!_PU.defaultQCheck(q, userAnswers, i);
          }
          results.push(ok);
          if (ok) correct++;
          correctAnswers.push(formatAnswer(q.answer));
          var cat = (q.__src && q.__src.category) || 'number';
          if (!domainStats[cat]) domainStats[cat] = { total: 0, correct: 0 };
          domainStats[cat].total++;
          if (ok) domainStats[cat].correct++;
        });

        var total = exerciseSet.questions.length;
        var score = total === 0 ? 0 : Math.round((correct / total) * 100);
        var message = '继续加油！';
        if (score === 100) message = '太棒了！全对！';
        else if (score >= 80) message = '很不错！';

        // 分领域正确率提示（如「数与代数 6/7｜图形几何 3/5」）
        var breakdown = [];
        var breakdownText = [];
        DOMAIN_ORDER.forEach(function (c) {
          var s = domainStats[c];
          if (!s) return;
          breakdown.push({ category: c, categoryName: DOMAIN_NAMES[c] || c, total: s.total, correct: s.correct });
          breakdownText.push((DOMAIN_NAMES[c] || c) + ' ' + s.correct + '/' + s.total);
        });
        if (breakdownText.length) message += '（分题型：' + breakdownText.join('｜') + '）';

        return {
          score: score, total: total, correct: correct, message: message,
          results: results, correctAnswers: correctAnswers,
          domainBreakdown: breakdown
        };
      },

    // 图形题选项按钮点击（与 math-shapes 一致）：写入隐藏输入 + 高亮
    __choose: function (btn) {
    // TODO(M4): 选项高亮属交互层，迁移到 check/render 层
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = 'var(--soft-bg)';
        btns[i].style.borderColor = 'var(--line-strong)';
      }
      btn.style.background = 'var(--brand)';
      btn.style.borderColor = 'var(--brand-d)';
      btn.style.color = 'var(--card)';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathComprehensivePlugin; // practice.html / dev/plugin-check.html
  // 测试钩子（dev/test-comprehensive-adaptive.js）：暴露抽题计划函数做确定性断言
  mathComprehensivePlugin.__debug_kbEntryPlan = kbEntryPlan;
  // 测试钩子：暴露权重分配函数（allocateByWeight）供 task 4.2 确定性断言
  mathComprehensivePlugin.__debug_allocateByWeight = allocateByWeight;
  if (typeof module !== 'undefined' && module.exports) module.exports = mathComprehensivePlugin;

})(typeof window !== 'undefined' ? window : globalThis);
