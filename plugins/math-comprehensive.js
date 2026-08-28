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
            { value: 'domain',   label: '按领域分布' }
          ]
        }
      ],

      generate: function (options) {
        var opts = options || {};
        var grade = opts.grade || 1;
        var count = opts.count || 10;
        // 默认按知识点重要度分配（kb）；兼容旧 average/domain/weighted
        var mode = opts.type;
        if (mode !== 'kb' && mode !== 'average' && mode !== 'domain' && mode !== 'weighted') mode = 'kb';

        return ensureSubPlugins().then(function (subs) {
          var applicable = subs.filter(function (p) {
            return !isPlaceholderPlugin(p) &&
              p.grades && p.grades.indexOf(grade) !== -1;
          });
          if (!applicable.length) {
            throw new Error('当前年级没有可用的数学练习，请返回选择其他年级');
          }

          var questions = [];
          var weightInfo = [];
          var categoryCounts = {}; // 各领域实际题数（用于 meta 展示）
          var kbWeights = null;

          if (mode === 'kb') {
            // 知识点级抽题：按当前年级知识库各知识点 weight 分配题量
            var plan = kbEntryPlan(grade, applicable, count);
            kbWeights = plan.map(function (item) { return item.total; });
            plan.forEach(function (item) {
              var p = item.plugin;
              if (item.count <= 0) return;
              if (item.points && item.points.length) {
                // 细分：同一插件的多个知识点按各自 weight/type 分别出题
                item.points.forEach(function (pt) {
                  if (!pt.count || pt.count <= 0) return;
                  var subOpts = { grade: grade, count: pt.count, type: pt.type || 'mix' };
                  var usedDiff = (opts.difficulty != null) ? opts.difficulty : 3;
                  if (opts.difficulty) subOpts.difficulty = opts.difficulty;
                  if (pt.lowerDiff && subOpts.difficulty != null) {
                    subOpts.difficulty = Math.max(1, subOpts.difficulty - 1); // 极薄弱：难度降 1 档
                  }
                  usedDiff = (subOpts.difficulty != null) ? subOpts.difficulty : 3;
                  var set = p.generate(subOpts);
                  var qs = (set && set.questions) || [];
                  if (!qs.length) return; // 插件未产出题目（占位/异常）→ 忽略该知识点，不占权重
                  qs.forEach(function (q) {
                    q.__src = p; // 记录来源插件（仅作元信息，渲染/判定一律走标准 Question 接口）
                    q.__kp = pt; // 记录来源知识点
                    q.knowledgePointId = pt.id;      // 用于知识点关联
                    q.difficulty = usedDiff;         // 标注实际使用的难度
                    questions.push(q);
                  });
                  weightInfo.push(p.id + '·' + (pt.name || pt.type || 'mix') + '×' + qs.length);
                  var cat = p.category || 'number';
                  categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
                });
              } else {
                var subOpts = { grade: grade, count: item.count, type: 'mix' };
                if (opts.difficulty) subOpts.difficulty = opts.difficulty;
                var set = p.generate(subOpts);
                var qs = (set && set.questions) || [];
                if (!qs.length) return; // 插件未产出题目（占位/异常）→ 忽略
                qs.forEach(function (q) {
                  q.__src = p;
                  questions.push(q);
                });
                weightInfo.push(p.id + '×' + qs.length);
                var cat = p.category || 'number';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
              }
            });
          } else {
            var counts = allocateCounts(count, applicable, mode);
            applicable.forEach(function (p, idx) {
              var n = counts[idx];
              if (n <= 0) return;
              var subOpts = { grade: grade, count: n, type: 'mix' };
              if (opts.difficulty) subOpts.difficulty = opts.difficulty;
              var set = p.generate(subOpts);
              var qs = (set && set.questions) || [];
              if (!qs.length) return; // 插件未产出题目（占位/异常）→ 忽略，避免空条目
              qs.forEach(function (q) {
                q.__src = p; // 记录来源插件（仅作元信息，渲染/判定一律走标准 Question 接口）
                questions.push(q);
              });
              weightInfo.push(p.id + '×' + qs.length);
              var cat = p.category || 'number';
              categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
            });
          }

          // 前置补强（原步骤5）已随自适应难度功能一并移除：不再按薄弱度注入额外前置基础题。

          // 混合后打乱顺序，形成完整综合试卷
          questions = _PU.shuffle(questions);

          // 空集保护：综合练习不能为空（理论上 applicable 已排除占位，双保险）
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
              weights: (mode === 'kb' && kbWeights) ? kbWeights : DOMAIN_WEIGHTS,
              categoryCounts: categoryCounts,
              weight: weightInfo
            }
          };
        });
      },

render: function (exerciseSet) {
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
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathComprehensivePlugin; // practice.html / dev/plugin-check.html
  // 测试钩子（dev/test-comprehensive-adaptive.js）：暴露抽题计划函数做确定性断言
  mathComprehensivePlugin.__debug_kbEntryPlan = kbEntryPlan;
  if (typeof module !== 'undefined' && module.exports) module.exports = mathComprehensivePlugin;

})(typeof window !== 'undefined' ? window : globalThis);
