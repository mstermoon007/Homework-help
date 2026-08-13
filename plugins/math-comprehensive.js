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

  // 兜底清单：仅当 PLUGIN_REGISTRY 不可用时按约定路径加载（正常环境优先走注册表动态加载）
  var MATH_SUB_IDS = [
    'math-oral', 'math-word-problems', 'math-make-ten', 'math-shapes',
    'math-number-sense', 'math-clock', 'math-patterns', 'math-picture-equations', 'math-statistics',
    'math-money', 'math-unit-convert', 'math-geometry', 'math-data-stats', 'math-logic-reasoning'
  ];

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  // ============ 子插件异步加载（动态加载注册表中对应的插件文件） ============
  var scriptCache = {};
  function loadScript(src) {
    if (scriptCache[src]) return Promise.resolve();
    // Node 环境：直接 require（插件均通过 module.exports 导出，且设置 global.__currentPlugin）
    if (typeof document === 'undefined' && typeof require !== 'undefined') {
      return Promise.resolve().then(function () {
        var p = require('./' + src.replace(/^plugins\//, ''));
        global.__currentPlugin = p;
        scriptCache[src] = true;
        return p;
      });
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error('脚本加载超时（5 秒）：' + src)); }
      }, 5000);
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        scriptCache[src] = true;
        resolve();
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('脚本加载失败：' + src));
      };
      document.head.appendChild(s);
    });
  }

  var subPlugins = null;
  var subPluginMap = {};
  function ensureSubPlugins() {
    if (subPlugins) return Promise.resolve(subPlugins);

    // 优先使用 practice.html 预加载的子插件（window.__mathSubPlugins）
    var preloaded = (typeof global !== 'undefined') ? global.__mathSubPlugins : null;
    if (Array.isArray(preloaded) && preloaded.length) {
      subPlugins = preloaded.slice();
      subPlugins.forEach(function (p) {
        if (p && p.id) subPluginMap[p.id] = p;
      });
      global.__currentPlugin = mathComprehensivePlugin; // 恢复当前插件，保证选项按钮 __choose 正确
      return Promise.resolve(subPlugins);
    }

    // 动态选取注册表中全部数学插件（新增插件自动纳入，无需改此清单）
    var registry = (typeof global.PLUGIN_REGISTRY !== 'undefined') ? global.PLUGIN_REGISTRY : [];
    var mathRecs = registry.filter(function (r) {
      return r && r.id && r.id.indexOf('math-') === 0 && r.id !== 'math-comprehensive';
    });
    var records = mathRecs.length ? mathRecs : MATH_SUB_IDS.map(function (id) {
      return { id: id, file: 'plugins/' + id + '.js' };
    });
    subPlugins = [];
    var chain = Promise.resolve();
    records.forEach(function (rec) {
      chain = chain.then(function () {
        return loadScript(rec.file).then(function () {
          var p = global.__currentPlugin;
          if (p && p.id === rec.id) {
            subPlugins.push(p);
            subPluginMap[p.id] = p;
          }
        });
      });
    });
    return chain.then(function () {
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

    // ============ 知识点重要度权重（来自 knowledge-bank.js） ============
    // 每个插件的重要度 = 其名下所有知识点 importance 之和（importance 代表课时占比/重要度）。
    // 若知识库不可用或某条目缺字段，按领域默认值兜底（数与代数4 / 图形几何3 / 统计推理2）。
    var CATEGORY_IMPORTANCE = { number: 4, geometry: 3, statistics: 2, mixed: 3 };
    function entryImportance(e) {
      return (typeof e.importance === 'number') ? e.importance
        : (CATEGORY_IMPORTANCE[e.category] || 3);
    }
    function kbPluginWeights(grade, plugins) {
      var g = (typeof KnowledgeBank !== 'undefined' && KnowledgeBank.getGrade)
        ? KnowledgeBank.getGrade(grade) : null;
      var byPlugin = {};
      if (g && g.entries) {
        g.entries.forEach(function (e) {
          if (!e.pluginId) return;
          byPlugin[e.pluginId] = (byPlugin[e.pluginId] || 0) + entryImportance(e);
        });
      }
      return plugins.map(function (p) { return byPlugin[p.id] || 0; });
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

  // ============ ExercisePlugin ============
  /** @type {ExercisePlugin} */
  var mathComprehensivePlugin = {
    id: 'math-comprehensive',
    name: '综合练习',
    grades: [1, 2, 3],
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
            return p.grades && p.grades.indexOf(grade) !== -1;
          });
          if (!applicable.length) {
            throw new Error('当前年级没有可用的数学练习，请返回选择其他年级');
          }

          var counts, kbWeights = null;
          if (mode === 'kb') {
            kbWeights = kbPluginWeights(grade, applicable);
            counts = allocateByWeight(count, applicable, kbWeights);
          } else {
            counts = allocateCounts(count, applicable, mode);
          }
          var questions = [];
          var weightInfo = [];
          var categoryCounts = {}; // 各领域实际题数（用于 meta 展示）
          applicable.forEach(function (p, idx) {
            var n = counts[idx];
            if (n <= 0) return;
            var subOpts = { grade: grade, count: n, type: 'mix' };
            if (opts.difficulty) subOpts.difficulty = opts.difficulty;
            var set = p.generate(subOpts);
            var qs = (set && set.questions) || [];
            qs.forEach(function (q) {
              q.__src = p; // 记录来源插件（仅作元信息，渲染/判定一律走标准 Question 接口）
              questions.push(q);
            });
            weightInfo.push(p.id + '×' + qs.length);
            var cat = p.category || 'number';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + qs.length;
          });

          // 混合后打乱顺序，形成完整综合试卷
          questions = _PU.shuffle(questions);

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
          var ok = (typeof q.check === 'function')
            ? !!q.check(userAnswers, i) // 标准 Question.check：统一判定任意题型（含单位/多空/复合答案）
            : false;
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
  if (typeof module !== 'undefined' && module.exports) module.exports = mathComprehensivePlugin;

})(typeof window !== 'undefined' ? window : globalThis);
