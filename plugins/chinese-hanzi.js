// @ts-check
/// <reference path="../shared/plugin-types.js" />

/**
 * plugins/chinese-hanzi.js — 汉字练习插件（N2 模块）
 *
 * 数据源：全局 HanziBank（shared/hanzi-bank.js，任务：语文模块化数据基础）
 *   characters / radicals / polySemanticExamples / contextExamples /
 *   dictionaryRules / phoneticCompounds
 *
 * 题型生成器（18 种，经 selectedKnowledgeIds 或年级默认池路由）：
 *   笔顺域   stroke-count · stroke-name · stroke-order-sort · stroke-order-which
 *            （→ cn-g?-n2-stroke-order）
 *   结构域   structure-classify · context-meaning · write-from-pinyin
 *            · poly-semantic-pick（→ cn-g?-n2-word-structure）
 *   部首域   radical-classify · radical-meaning · phonetic-compound-judge
 *            （→ cn-g?-n2-radical-grouping）
 *   同音域   homophone-pick · polyphone-pick
 *            （→ cn-g3-n2-homophone-chars）
 *   形近域   similar-pick · hardwriting-judge
 *            （→ cn-g2-n2-similar-characters）
 *   查字典域 dictionary-phonetic-step · dictionary-radical-step
 *            · dictionary-step-comprehensive（→ cn-g3-n2-dictionary-lookup）
 *
 * 支持 options.grade / options.difficulty 过滤字库档位；
 * opts.type 直选生成器；count<=0 自然返回空集。
 */
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/chinese-hanzi.js 依赖 shared/common.js（PluginUtil），请先加载');
  var _CU = typeof ChineseUtil !== 'undefined' ? ChineseUtil
    : (typeof require !== 'undefined' ? require('../shared/subject-utils.js').ChineseUtil : null);
  if (!_CU) throw new Error('plugins/chinese-hanzi.js 依赖 shared/subject-utils.js（ChineseUtil），请先加载');
  var _HB = typeof HanziBank !== 'undefined' ? HanziBank
    : (typeof require !== 'undefined' ? require('../shared/hanzi-bank.js') : null);
  if (!_HB) throw new Error('plugins/chinese-hanzi.js 依赖 shared/hanzi-bank.js（HanziBank），请先加载');

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  // ============ 科目化题卡：田字格示范（任务：语文题卡田字格） ============
  // 提取题干「X」中的单个提示汉字，经 SVGGenerators.cn.hanziGrid 生成田字格 <svg>。
  // 仅展示题干已出现的提示字（非答案），Node 测试环境无生成器时安全降级为 null。
  function tianSvgOf(core) {
    try {
      var G = (typeof SVGGenerators !== 'undefined') ? SVGGenerators.cn : null;
      if (!G || typeof G.hanziGrid !== 'function') return null;
      var m = /「([\u4e00-\u9fa5])」/.exec(String((core && core.q) || ''));
      return m ? G.hanziGrid(m[1], 'tian') : null;
    } catch (e) { return null; }
  }

  /** 按难度挑字：1-3 偏低年级、4-7 中段、8-10 高段；池空时逐级放宽 */
  function pickChar(R, difficulty) {
    var all = _HB.characters;
    if (!all.length) return null;
    var d = Math.max(1, Math.min(10, Number(difficulty) || 5));
    var want = d <= 3 ? [1] : d <= 6 ? [2, 1] : [3, 2, 1];
    for (var i = 0; i < want.length; i++) {
      var tier = all.filter(function (c) { return c.grade === want[i]; });
      if (tier.length) return R.pick(tier);
    }
    return R.pick(all);
  }

  /** 数字选项（去重、含正确值、数值相邻） */
  function numOptions(correct) {
    var set = [correct];
    var deltas = [-1, 1, -2, 2];
    for (var i = 0; i < deltas.length && set.length < 4; i++) {
      var v = correct + deltas[i];
      if (v >= 1 && set.indexOf(v) === -1) set.push(v);
    }
    return _PU.shuffle(set.map(String));
  }

  // ============ 生成器注册表 ============
  // fn(C, R, ctx) → {q, answer, inputType, options?, hint?, uniqKey} 或 null
  // C=按年级过滤后的字数组；R=随机上下文；ctx={difficulty}
  var GENERATORS = {

    'stroke-count': {
      kp: 'stroke-order', grades: [1, 2, 3],
      fn: function (C, R) {
        var ch = R.pick(C);
        return { q: '「' + ch.char + '」一共有几画？', answer: String(ch.strokes),
          inputType: 'choice', options: numOptions(ch.strokes),
          hint: '按笔顺数一数。', uniqKey: 'sc|' + ch.char };
      }
    },

    'stroke-name': {
      kp: 'stroke-order',
      grades: [1, 2, 3],
      fn: function (C, R, ctx) {
        var pool = C.filter(function (c) { return c.strokeOrder && c.strokeOrder.length >= 2; });
        if (!pool.length) return null;
        var ch = R.pick(pool);
        var names = ['横', '竖', '撇', '捺', '点', '提', '折', '钩'];
        var pos = R.int(0, ch.strokeOrder.length - 1);
        var answer = ch.strokeOrder[pos];
        var opts = [answer];
        while (opts.length < Math.min(4, names.length)) {
          var cand = names[R.int(0, names.length - 1)];
          if (opts.indexOf(cand) === -1) opts.push(cand);
        }
        void ctx;
        return { q: '「' + ch.char + '」的第 ' + (pos + 1) + ' 笔是什么笔画？',
          answer: answer, inputType: 'choice', options: _PU.shuffle(opts),
          hint: '共 ' + ch.strokes + ' 画。', uniqKey: 'sn|' + ch.char + '|' + pos };
      }
    },

    'stroke-order-sort': {
      kp: 'stroke-order',
      grades: [1, 2, 3],
      fn: function (C, R) {
        var pool = C.filter(function (c) {
          return c.strokeOrder && c.strokeOrder.length >= 3;
        });
        if (!pool.length) return null;
        var ch = R.pick(pool);
        var order = ch.strokeOrder;
        var correct = order.join(' → ');
        // 交换前两个不同的笔画制造错误顺序
        var wrongOrder = order.slice();
        for (var i = 1; i < wrongOrder.length; i++) {
          if (wrongOrder[i] !== wrongOrder[0]) {
            var t = wrongOrder[0]; wrongOrder[0] = wrongOrder[i]; wrongOrder[i] = t;
            break;
          }
        }
        var wrong = wrongOrder.join(' → ');
        if (wrong === correct) return null;
        var third = order.slice().reverse().join(' → ');
        if (third === correct || third === wrong) third = order.concat([order[0]]).join(' → ');
        return { q: '「' + ch.char + '」的正确笔顺是？', answer: correct,
          inputType: 'choice', options: _PU.shuffle([correct, wrong, third])
            .filter(function (v, i2, a) { return a.indexOf(v) === i2; }),
          hint: '先横后竖、先撇后捺、从上到下。', uniqKey: 'so|' + ch.char };
      }
    },

    'stroke-order-which': {
      kp: 'stroke-order',
      grades: [1, 2, 3],
      fn: function (C, R) {
        var pool = C.filter(function (c) {
          return c.strokeOrder && c.strokeOrder.length >= 2;
        });
        if (!pool.length) return null;
        var ch = R.pick(pool);
        var pos = R.int(0, ch.strokeOrder.length - 1);
        var name = ch.strokeOrder[pos];
        // 该笔画名可能多次出现——问「第一次出现在第几笔」，语义无歧义
        var firstAt = ch.strokeOrder.indexOf(name);
        return { q: '「' + ch.char + '」的「' + name + '」第一次出现在第几笔？',
          answer: '第 ' + (firstAt + 1) + ' 笔',
          inputType: 'choice',
          options: numOptions(firstAt + 1).map(function (n) { return '第 ' + n + ' 笔'; }),
          hint: '共 ' + ch.strokes + ' 画。', uniqKey: 'sw|' + ch.char + '|' + pos };
      }
    },

    'radical-classify': {
      kp: 'radical-grouping',
      grades: [2, 3],
      fn: function (C, R) {
        var withRad = C.filter(function (c) { return (c.radicals || []).length > 0; });
        if (withRad.length < 4) return null;
        var target = R.pick(withRad);
        var rad = target.radicals[0];
        // 同部首池放宽到全库（当前档位内可能只有目标一字带该部首）
        var allSame = _HB.characters.filter(function (c) {
          return c.char !== target.char && (c.radicals || []).indexOf(rad) !== -1;
        });
        var correct = allSame.length ? R.pick(allSame).char : target.char;
        var others = withRad.filter(function (c) {
          return c.char !== correct && (c.radicals || []).indexOf(rad) === -1;
        }).slice(0, 2).map(function (c) { return c.char; });
        var options = _PU.shuffle([correct].concat(others))
          .filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (options.length < 3) return null;
        return { q: '下面哪个字也带有「' + rad + '」这个部首？', answer: correct,
          inputType: 'choice', options: options,
          hint: '想一想字的偏旁。', uniqKey: 'rc|' + rad + '|' + target.char };
      }
    },

    'radical-meaning': {
      kp: 'radical-grouping',
      grades: [2, 3],
      fn: function (C, R) {
        void C;
        var rads = _HB.radicals.filter(function (r) { return r.meaning; });
        if (!rads.length) return null;
        var r = R.pick(rads);
        var others = rads.filter(function (x) { return x !== r; })
          .map(function (x) { return x.meaning; });
        var opts = _PU.shuffle([r.meaning].concat(others.slice(0, 3)))
          .filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (opts.length < 3) return null;
        return { q: '「' + r.name + '」（' + r.radical + '）的字大多与什么有关？',
          answer: r.meaning, inputType: 'choice', options: opts,
          hint: '例字：' + r.examples.slice(0, 3).join('、'), uniqKey: 'rm|' + r.radical };
      }
    },

    'structure-classify': {
      kp: 'word-structure',
      grades: [1, 2, 3],
      fn: function (C, R) {
        var structures = {};
        C.forEach(function (c) { (structures[c.structure] = structures[c.structure] || []).push(c); });
        var keys = Object.keys(structures).filter(function (k) { return structures[k].length >= 1; });
        if (keys.length < 2) return null;
        var key = R.pick(keys);
        var ch = R.pick(structures[key]);
        var others = keys.filter(function (k) { return k !== key; });
        if (!others.length) return null;
        return { q: '「' + ch.char + '」是什么结构的字？', answer: key,
          inputType: 'choice',
          options: _PU.shuffle([key].concat(others.slice(0, 3))),
          hint: '看部件的排列方式。', uniqKey: 'stc|' + ch.char };
      }
    },

    'homophone-pick': {
      kp: 'homophone-chars',
      grades: [2, 3],
      fn: function (C, R) {
        var withHo = C.filter(function (c) { return (c.homophones || []).length > 0; });
        if (!withHo.length) return null;
        var ch = R.pick(withHo);
        var ho = ch.homophones[0];
        var distractPool = C.filter(function (c) {
          return c.char !== ch.char && c.char !== ho && c.pinyin !== ch.pinyin;
        }).map(function (c) { return c.char; });
        if (distractPool.length < 2) return null;
        return { q: '与「' + ch.char + '」（' + ch.pinyin + '）同音的字是？',
          answer: ho, inputType: 'choice',
          options: _PU.shuffle([ho, distractPool[0], distractPool[1]]),
          hint: '读音相同，字形不同。', uniqKey: 'hp|' + ch.char };
      }
    },

    'similar-pick': {
      kp: 'similar-characters',
      grades: [2, 3],
      fn: function (C, R) {
        // 从字库 similar 关系或 ChineseUtil 易混组构造「找不同类」题
        var groups = [];
        C.forEach(function (c) {
          (c.similar || []).forEach(function (s) {
            groups.push([c.char, s]);
          });
        });
        (_CU.CONFUSABLE_GROUPS || []).forEach(function (g) { groups.push(g.slice()); });
        if (!groups.length) return null;
        var group = R.pick(groups);
        if (group.length < 2) return null;
        // 干扰项：取一个不属于该组的常用字
        var outsider = null;
        var guard = 0;
        while (!outsider && guard++ < 30) {
          var cand = R.pick(C).char;
          if (group.indexOf(cand) === -1) outsider = cand;
        }
        if (!outsider) return null;
        return { q: '下面三个字中，哪一个与其他两个字不是易混字形？',
          answer: outsider, inputType: 'choice',
          options: _PU.shuffle([group[0], group[1] % group.length === group[0] ? group[group.length - 1] : group[1], outsider]),
          hint: '仔细比较细微差别。', uniqKey: 'sp|' + group.join('') + '|' + outsider };
      }
    },

    'polyphone-pick': {
      kp: 'homophone-chars',
      grades: [2, 3],
      fn: function (C, R) {
        var multi = C.filter(function (c) { return (c.polyphones || []).length >= 2; });
        if (multi.length) {
          var ch = R.pick(multi);
          var ph = ch.polyphones[0];
          return { q: '「' + ch.char + '」在「' + ph.ctx + '」中读作？',
            answer: ph.py, inputType: 'choice',
            options: _PU.shuffle(ch.polyphones.map(function (p2) { return p2.py; })),
            hint: '结合词语意思判断读音。', uniqKey: 'pp|' + ch.char };
        }
        // 回退：拼音银行多音字
        var PB = global.PINYIN_BANK;
        if (PB && PB.polyphones) {
          var ph2 = R.pick(PB.polyphones);
          var readings = ph2.readings.map(function (r) { return r.py; });
          return { q: '多音字「' + ph2.char + '」在「' + ph2.readings[0].ctx + '」中读作？',
            answer: ph2.readings[0].py, inputType: 'choice',
            options: _PU.shuffle(readings), uniqKey: 'pp|' + ph2.char };
        }
        return null;
      }
    },

    'poly-semantic-pick': {
      kp: 'word-structure',
      grades: [2, 3],
      fn: function (C, R) {
        void C;
        var entries = _HB.polySemanticExamples;
        if (!entries.length) return null;
        var e = R.pick(entries);
        var sense = R.pick(e.senses);
        var others = e.senses.filter(function (x) { return x !== sense; })
          .map(function (x) { return x.meaning; });
        if (others.length < 2) return null;
        return { q: '「' + e.char + '」在「' + sense.example + '」中的意思是？',
          answer: sense.meaning, inputType: 'choice',
          options: _PU.shuffle([sense.meaning].concat(others)),
          hint: '结合词语语境判断。', uniqKey: 'ps|' + e.char + '|' + sense.example };
      }
    },

    'dictionary-phonetic-step': {
      kp: 'dictionary-lookup',
      grades: [3],
      fn: function (C, R) {
        void C; void R;
        var rule = _HB.dictionaryRules.yinxu;
        if (!rule) return null;
        var stepIdx = R.int(0, rule.steps.length - 1);
        var wrongs = _HB.dictionaryRules.bushou.steps.filter(function (s2) {
          return s2 !== rule.steps[stepIdx];
        });
        return { q: '音序查字法的第 ' + (stepIdx + 1) + ' 步是？', answer: rule.steps[stepIdx],
          inputType: 'choice',
          options: _PU.shuffle([rule.steps[stepIdx]].concat(wrongs.slice(0, 2))),
          hint: '知道读音时用音序查字法。', uniqKey: 'dps-y|' + stepIdx };
      }
    },

    'dictionary-radical-step': {
      kp: 'dictionary-lookup',
      grades: [3],
      fn: function (C, R) {
        var chars = C.filter(function (c) {
          return c.dictionary || (c.radicals || []).length > 0;
        });
        if (!chars.length) return null;
        var ch = R.pick(chars);
        var rad = (ch.radicals || [])[0] || '口';
        var rest = ch.strokes - 3;
        return { q: '用部首查字法查「' + ch.char + '」，应查的部首是？除部首外还有几画？',
          answer: rad + '；' + Math.abs(rest) + '画', inputType: 'text',
          hint: '先找部首，再数剩余笔画。', uniqKey: 'drs|' + ch.char };
      }
    },

    'dictionary-step-comprehensive': {
      kp: 'dictionary-lookup',
      grades: [3],
      fn: function (C, R) {
        var withDic = C.filter(function (c) { return c.dictionary; });
        if (!withDic.length) return null;
        var ch = R.pick(withDic);
        var rule = _HB.dictionaryRules.combined || {};
        return { q: '「清」「请」「晴」读音相同，要确定用哪个字，最好的办法是？',
          answer: rule.note || '按部首和字义区分', inputType: 'choice',
          options: _PU.shuffle([
            rule.note || '按部首和字义区分',
            '随便选一个',
            '都写成同一个字'
          ]),
          hint: '同音字要靠部首和语境区分。', uniqKey: 'dsc|' + ch.char };
      }
    },

    'context-meaning': {
      kp: 'word-structure',
      grades: [2, 3],
      fn: function (C, R) {
        void C;
        var list = _HB.contextExamples;
        if (!list.length) return null;
        var e = R.pick(list);
        var answer = e.options[e.answerIndex];
        return { q: e.sentence, answer: answer, inputType: 'choice',
          options: _PU.shuffle(e.options.slice()),
          hint: e.hint || '联系句子意思选择。', uniqKey: 'cm|' + e.sentence };
      }
    },

    'write-from-pinyin': {
      kp: 'word-structure',
      grades: [1, 2, 3],
      fn: function (C, R) {
        if (!C.length) return null;
        var ch = R.pick(C);
        return { q: '看拼音写汉字：' + ch.pinyin, answer: ch.char,
          inputType: 'text', hint: '注意字形结构。', uniqKey: 'wp2|' + ch.char };
      }
    },

    'hardwriting-judge': {
      kp: 'similar-characters',
      grades: [2, 3],
      fn: function (C, R) {
        // 构造形近对（真）与随机对（假）混合判断
        var truePairs = [];
        C.forEach(function (c) {
          (c.similar || []).forEach(function (s) { truePairs.push([c.char, s]); });
        });
        (_CU.CONFUSABLE_GROUPS || []).forEach(function (g) {
          if (g.length >= 2) truePairs.push([g[0], g[1]]);
        });
        if (truePairs.length < 2) return null;
        var isTrue = R.int(0, 1) === 0;
        var pair;
        if (isTrue) {
          pair = truePairs[R.int(0, truePairs.length - 1)];
        } else {
          var guard = 0;
          do {
            var a = R.pick(C).char, b = R.pick(C).char;
            pair = [a, b];
            guard++;
          } while ((guard < 20) && truePairs.some(function (tp) {
            return (tp[0] === pair[0] && tp[1] === pair[1]) || (tp[0] === pair[1] && tp[1] === pair[0]);
          }));
        }
        return { q: '判断：「' + pair[0] + '」和「' + pair[1] + '」是一对形近字。',
          answer: isTrue ? '对' : '错', inputType: 'choice',
          options: _PU.shuffle(['对', '错']),
          hint: '形近字字形相近但意义不同。', uniqKey: 'hw|' + pair[0] + pair[1] + (isTrue ? 'T' : 'F') };
      }
    },

    'phonetic-compound-judge': {
      kp: 'radical-grouping',
      grades: [3],
      fn: function (C, R) {
        void C;
        var list = _HB.phoneticCompounds;
        if (!list.length) return null;
        var e = R.pick(list);
        var isTrue = R.int(0, 1) === 0;
        var shapeTxt = isTrue ? e.shapePart : (e.soundPart || '声旁');
        var soundTxt = isTrue ? (e.soundPart || '声旁') : e.shapePart;
        return { q: '判断：「' + e.char + '」中，' + shapeTxt + ' 表意、' + soundTxt + ' 表音。',
          answer: isTrue ? '对' : '错', inputType: 'choice',
          options: _PU.shuffle(['对', '错']),
          hint: '形声字 = 形旁表义 + 声旁表音。', uniqKey: 'pcj|' + e.char + '|' + (isTrue ? 'T' : 'F') };
      }
    }
  };


  /** 年级默认题型池 */
  var GRADE_POOLS = {
    1: ['stroke-count', 'stroke-name', 'stroke-order-sort', 'stroke-order-which',
        'structure-classify', 'write-from-pinyin'],
    2: ['stroke-count', 'stroke-name', 'stroke-order-sort', 'stroke-order-which',
        'structure-classify', 'write-from-pinyin', 'radical-classify', 'similar-pick',
        'hardwriting-judge', 'homophone-pick', 'polyphone-pick', 'poly-semantic-pick'],
    3: ['stroke-count', 'stroke-name', 'structure-classify', 'write-from-pinyin',
        'radical-classify', 'radical-meaning', 'similar-pick', 'polyphone-pick',
        'poly-semantic-pick', 'dictionary-phonetic-step', 'dictionary-radical-step',
        'dictionary-step-comprehensive', 'context-meaning', 'homophone-pick',
        'hardwriting-judge', 'phonetic-compound-judge']
  };

  var GEN_KP = {
    'stroke-count': 'stroke-order',
    'stroke-name': 'stroke-order',
    'stroke-order-sort': 'stroke-order',
    'stroke-order-which': 'stroke-order',
    'radical-classify': 'radical-grouping',
    'radical-meaning': 'radical-grouping',
    'phonetic-compound-judge': 'radical-grouping',
    'structure-classify': 'word-structure',
    'context-meaning': 'word-structure',
    'write-from-pinyin': 'word-structure',
    'poly-semantic-pick': 'word-structure',
    'homophone-pick': 'homophone-chars',
    'polyphone-pick': 'homophone-chars',
    'similar-pick': 'similar-characters',
    'hardwriting-judge': 'similar-characters',
    'dictionary-phonetic-step': 'dictionary-lookup',
    'dictionary-radical-step': 'dictionary-lookup',
    'dictionary-step-comprehensive': 'dictionary-lookup'
  };

  var GRADE_OF_KP = {
    'stroke-order': 1, 'word-structure': 1,
    'radical-grouping': 2, 'similar-characters': 2,
    'dictionary-lookup': 3, 'homophone-chars': 3
  };

  function kpIdFor(genKey, grade) {
    var tail = GEN_KP[genKey];
    var g = grade <= 3 ? Math.min(Math.max(grade, GRADE_OF_KP[tail] || 1), 3) : 3;
    return 'cn-g' + g + '-n2-' + tail;
  }

  /** @type {ExercisePlugin} */
  var plugin = {
    id: 'chinese-hanzi',
    name: '汉字练习',
    subject: 'chinese',
    moduleId: 'N2',
    grades: [1, 2, 3],
    printConfig: { pageType: 'pinyin' },
    knowledgePoints: {
      1: ['cn-g1-n2-stroke-order', 'cn-g1-n2-word-structure'],
      2: ['cn-g2-n2-radical-grouping', 'cn-g2-n2-similar-characters'],
      3: ['cn-g3-n2-dictionary-lookup', 'cn-g3-n2-homophone-chars']
    },

    settings: [
      { key: 'type', label: '题型', default: 'mix', options: [
        { value: 'mix', label: '智能混合（按知识点）' },
        { value: 'stroke-count', label: '数笔画' },
        { value: 'stroke-name', label: '笔画名称' },
        { value: 'stroke-order-sort', label: '笔顺排序' },
        { value: 'stroke-order-which', label: '第几笔' },
        { value: 'structure-classify', label: '结构分类' },
        { value: 'write-from-pinyin', label: '看拼音写字' },
        { value: 'radical-classify', label: '部首归类' },
        { value: 'similar-pick', label: '形近字辨析' },
        { value: 'homophone-pick', label: '同音字' },
        { value: 'context-meaning', label: '语境选字' }
      ] }
    ],

    generate(options) {
      options = options || {};
      if (typeof HanziBank === 'undefined') {
        throw new Error('HanziBank 未加载，请确保 hanzi-bank.js 已引入');
      }

      var grade = Math.min(Number(options.grade) || 1, 3);
      var count = Number(options.count) > 0 ? Number(options.count) : 10;
      var difficulty = options.difficulty;

      var R = {
        int: function (a, b) { return _PU.randInt(a, b); },
        pick: function (arr) { return arr[_PU.randInt(0, arr.length - 1)]; },
        shuffle: function (arr) { return _PU.shuffle(arr); }
      };

      // 字库档位过滤（按难度映射年级层，池空放宽）
      var dLevel = Math.max(1, Math.min(10, Number(difficulty) || (grade * 3)));
      var tiers = dLevel <= 3 ? [[1]] : dLevel <= 6 ? [[2], [1]] : [[3], [2], [1]];
      var C = [];
      tiers.some(function (tier) {
        var arr = _HB.characters.filter(function (c2) { return tier.indexOf(c2.grade) !== -1; });
        if (arr.length) { C = arr; return true; }
        return false;
      }) || (C = _HB.characters);

      var selected = Array.isArray(options.selectedKnowledgeIds) ? options.selectedKnowledgeIds : null;
      var poolIds = GRADE_POOLS[Math.min(grade, 3)] || [];
      if (options.type && GENERATORS[options.type]) poolIds = [options.type];

      var enabled = poolIds.filter(function (gid) {
        if (!selected || !selected.length) return true;
        var tail = GEN_KP[gid];
        return selected.some(function (sid) {
          return sid === tail || sid.indexOf('-n2-' + tail) !== -1;
        });
      });

      var out = [];
      var seen = {};
      var guard = 0;
      var gens = enabled.length ? enabled : Object.keys(GENERATORS);
      while (out.length < count && guard++ < count * 60) {
        var gid = gens[R.int(0, gens.length - 1)];
        var core = GENERATORS[gid].fn(C, R, { difficulty: dLevel || undefined });
        if (!core || seen[core.uniqKey]) continue;
        seen[core.uniqKey] = 1;
        out.push({
          type: gid,
          q: core.q,
          answer: core.answer,
          inputType: core.inputType,
          options: core.options,
          svg: tianSvgOf(core) || undefined,
          hint: core.hint,
          knowledgePointId: kpIdFor(gid, grade),
          difficulty: Math.max(1, Math.min(10, dLevel || 5))
        });
      }

      return {
        questions: out,
        meta: { grade: grade, count: out.length, columns: 1,
                title: gradeName(grade) + '汉字练习（N2）' }
      };
    },

    render(exerciseSet) {
      // 科目化题卡：cn-grid 网格 + cn-card 卡片（田字格示范随题注入）
      return _PU.renderGrid(exerciseSet.questions,
        { columns: 1, inputWidth: 140, gridClass: 'cn-grid', cardClass: 'cn-card' });
    },

    check(exerciseSet, userAnswers) {
      return _PU.computeResult(exerciseSet.questions, userAnswers, {});
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
