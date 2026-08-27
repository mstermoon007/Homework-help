// @ts-check
/// <reference path="../shared/plugin-types.js" />

/**
 * plugins/chinese-pinyin.js — 拼音练习插件（N1 模块 · 阶段4 重构）
 *
 * 数据源：全局 PINYIN_BANK / PinyinBank（结构化语音数据：initials / finals /
 *   wholeSyllables / toneExamples / jqxuWords / lightToneWords / confusingGroups /
 *   polyphones / syllables）
 *
 * 题型生成器（11 种，经 selectedKnowledgeIds 或年级默认池路由）：
 *   initials-pick        声母辨认             → cn-g?-n1-pinyin-basic
 *   finals-pick          韵母辨认             → cn-g?-n1-pinyin-basic
 *   whole-syllable-pick  整体认读音节辨认      → cn-g?-n1-pinyin-basic
 *   tone-mark            标调位置选择          → cn-g?-n1-tone-marks
 *   judge-tone           标调正误判断          → cn-g?-n1-tone-marks
 *   fill-blank           看字写拼音/韵母补全   → cn-g?-n1-pinyin-to-char / pinyin-basic
 *   jqx-u                j/q/x 与 ü 规则       → cn-g?-n1-syllable-spelling
 *   syllable-sort        音节排序成词          → cn-g?-n1-syllable-spelling
 *   confusing-pick       易混音辨析            → cn-g?-n1-pinyin-review / vowel-confusion
 *   light-tone-judge     轻声判断              → cn-g?-n1-pinyin-review
 *   polyphone-note       多音字注音            → cn-g3-n1-multi-pronunciation
 *
 * 兼容：opts.type = copy | char | word 仍走旧版看字写拼音路径；
 * 批改沿用 ChineseUtil.normPY 声调容错。
 */
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/chinese-pinyin.js 依赖 shared/common.js（PluginUtil），请先加载');
  var _CU = typeof ChineseUtil !== 'undefined' ? ChineseUtil
    : (typeof require !== 'undefined' ? require('../shared/subject-utils.js').ChineseUtil : null);
  if (!_CU) throw new Error('plugins/chinese-pinyin.js 依赖 shared/subject-utils.js（ChineseUtil），请先加载');

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  // ============ 科目化书写格（任务：语文题卡四线格/田字格） ============
  // 经 shared/svg-chinese.js 的 SVGGenerators.cn 生成完整 <svg>（四线三格/田字格）。
  // Node 测试环境无该脚本时安全降级为 null（题目退化为纯文本卡片）。
  function cnSvg(fnName, arg) {
    try {
      var G = (typeof SVGGenerators !== 'undefined') ? SVGGenerators.cn : null;
      return (G && typeof G[fnName] === 'function') ? G[fnName](arg) : null;
    } catch (e) { return null; }
  }

  // ============ 拼音标注工具 ============
  var TONE_CHAR = {
    a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè',
    i: 'īíǐì', u: 'ūúǔù', 'ü': 'ǖǘǚǜ'
  };
  var TONE_ORDER = ['a', 'o', 'e', 'i', 'u', 'ü'];

  /** 给韵母按声调加调号（iu 标后、ui 标 i，其余按 a-o-e-i-u-ü 优先） */
  function markFinal(fin, tone) {
    var idx;
    if (/iu$/.test(fin)) idx = fin.length - 1;
    else if (/ui$/.test(fin)) idx = fin.length - 2;
    else {
      for (var k = 0; k < TONE_ORDER.length; k++) {
        idx = fin.indexOf(TONE_ORDER[k]);
        if (idx !== -1) break;
      }
    }
    if (idx == null || idx === -1) return fin;
    var ch = fin[idx];
    var plain = null;
    Object.keys(TONE_CHAR).forEach(function (p) {
      if (TONE_CHAR[p].indexOf(ch) !== -1 && plain === null) plain = p;
    });
    if (plain === null) return fin;
    return fin.slice(0, idx) + TONE_CHAR[plain].charAt(tone - 1) + fin.slice(idx + 1);
  }

  /** 展示音节：j/q/x/y 后 ü 写作 u */
  function displaySyllable(initial, markedFinal) {
    if (/^[jqxy]$/.test(initial)) return initial + markedFinal.replace(/ü/g, 'u');
    return initial + markedFinal;
  }

  /** 把带调音节换成其他声调的错误标调形式（供正误判断题） */
  function misplacedVariant(markedSyllable) {
    var TONE_MARKS = ['\u0304', '\u0301', '\u030C', '\u0300']; // 一二三四声组合符
    var nfd = markedSyllable.normalize('NFD');
    var m = nfd.match(/[\u0300-\u036F]/);
    if (!m) return null;
    var alt = TONE_MARKS.filter(function (mk) { return mk !== m[0]; });
    var picked = alt[_PU.randInt(0, alt.length - 1)];
    return nfd.replace(m[0], picked).normalize('NFC');
  }


  // ============ 生成器注册表 ============
  // fn(B, R) → {q, answer, inputType, options?, hint?, uniqKey} 或 null（数据不足跳过）
  var GENERATORS = {

    'initials-pick': {
      kp: 'basic',
      fn: function (B, R) {
        var syl = R.pick(B.syllables);
        if (!syl.initial) return null;
        var dis = B.initials.filter(function (x) { return x !== syl.initial; });
        var opts = R.shuffle([syl.initial,
          dis[R.int(0, dis.length - 1)], dis[R.int(0, dis.length - 1)], dis[R.int(0, dis.length - 1)]])
          .filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (opts.length < 3) return null;
        var shown = displaySyllable(syl.initial, markFinal(syl.final, syl.tone));
        return { q: '「' + shown + '」的声母是？', answer: syl.initial,
          inputType: 'choice', options: opts,
          hint: '声母位于音节开头。', uniqKey: 'ip|' + shown };
      }
    },

    'finals-pick': {
      kp: 'basic',
      fn: function (B, R) {
        var syl = R.pick(B.syllables);
        var pool = [].concat(B.finals.simple, B.finals.compound, B.finals.nasalFront, B.finals.nasalBack);
        var shown = displaySyllable(syl.initial || '', markFinal(syl.final, syl.tone));
        var opts = R.shuffle([syl.final,
          pool[R.int(0, pool.length - 1)], pool[R.int(0, pool.length - 1)], pool[R.int(0, pool.length - 1)]])
          .filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (opts.length < 3 || !syl.final) return null;
        return { q: '「' + shown + '」的韵母是？', answer: syl.final,
          inputType: 'choice', options: opts,
          hint: '去掉声母，剩下的部分是韵母。', uniqKey: 'fp|' + shown };
      }
    },

    'whole-syllable-pick': {
      kp: 'basic',
      fn: function (B, R) {
        var whole = R.pick(B.wholeSyllables);
        var fakes = [];
        var guard = 0;
        while (fakes.length < 3 && guard++ < 80) {
          var s = R.pick(B.syllables);
          var plain = s.initial + s.final;
          if (B.wholeSyllables.indexOf(plain) === -1 && fakes.indexOf(plain) === -1 &&
              /^[bpmfdtnlgkhzcs]/.test(plain)) fakes.push(plain);
        }
        if (fakes.length < 3) return null;
        return { q: '下面哪一个是整体认读音节？', answer: whole,
          inputType: 'choice', options: R.shuffle([whole].concat(fakes)),
          hint: '整体认读音节要整体识记，不能拼读。', uniqKey: 'wp|' + whole };
      }
    },

    'tone-mark': {
      kp: 'tone-marks',
      fn: function (B, R) {
        var ex = R.pick(B.toneExamples);
        var nfd = ex.syllable.normalize('NFD');
        var acc = nfd.match(/[\u0300-\u0304]/);
        if (!acc) return null;
        var accPos = nfd.indexOf(acc[0]);
        var answerLetter = nfd.charAt(accPos - 1);
        // 与答案同口径：从 NFD 剥离形式收集元音（避免预组合字符导致答案缺席）
        var basePlain = nfd.replace(/[\u0300-\u036F]/g, '');
        var letters = [];
        'aeiouü'.split('').forEach(function (v) {
          if (basePlain.indexOf(v) !== -1 && letters.indexOf(v) === -1) letters.push(v);
        });
        ['o','e','u'].forEach(function (v) { if (letters.length < 3 && letters.indexOf(v) === -1) letters.push(v); });
        while (letters.length < 3) {
          ['o','e','i'].some(function (v) { if (letters.indexOf(v) === -1) { letters.push(v); return true; } return false; });
        }
        var opts = R.shuffle(letters.slice());
        return { q: '「' + ex.syllable + '」的调号标在哪个字母上？（规则：' + ex.rule + '）',
          answer: answerLetter, inputType: 'choice', options: opts,
          hint: ex.note, uniqKey: 'tm|' + ex.syllable };
      }
    },

    'judge-tone': {
      kp: 'tone-marks',
      fn: function (B, R) {
        var ex = R.pick(B.toneExamples);
        var wrong = misplacedVariant(ex.syllable);
        if (!wrong || wrong === ex.syllable) return null;
        var showCorrect = R.int(0, 1) === 0;
        var shown = showCorrect ? ex.syllable : wrong;
        return { q: '判断标调是否正确：「' + shown + '」', answer: showCorrect ? '对' : '错',
          inputType: 'choice', options: _PU.shuffle(['对', '错']),
          hint: '对照规则：' + ex.rule, uniqKey: 'jt|' + shown };
      }
    },

    'fill-blank': {
      kp: 'to-char',
      fn: function (B, R) {
        var chars = B.getCharsUpTo(Math.min(3, B.bank ? Object.keys(B.bank).length : 3)) ||
                    B.getCharsUpTo(3);
        if (!chars.length) return null;
        var mode = R.int(0, 1);
        if (mode === 0) {
          var ch = R.pick(chars);
          return { q: '看汉字写拼音：' + ch.hz, answer: ch.py,
            // 田字格展示提示汉字（答案为拼音，无泄露）
            svg: cnSvg('hanziGrid', ch.hz),
            inputType: 'text', hint: '注意标调位置。', uniqKey: 'fb-c|' + ch.hz };
        }
        var syl = R.pick(B.syllables);
        if (!syl.final) return null;
        var marked = markFinal(syl.final, syl.tone);
        return { q: '补全音节：' + syl.initial + '（　）', answer: marked,
          inputType: 'text', hint: '写出韵母并标上调号。', uniqKey: 'fb-f|' + syl.initial + marked };
      }
    },

    'jqx-u': {
      kp: 'syllable-spelling',
      fn: function (B, R) {
        var cand = B.jqxuWords.filter(function (w) { return /^[jqx]/.test(w.py); });
        var w = R.pick(cand.length ? cand : B.jqxuWords);
        var firstSyl = w.py.trim().split(/\s+/)[0];
        if (!/^[jqx][u]/.test(firstSyl)) return null;
        return { q: '「' + w.word + '」的拼音「' + firstSyl + '」中，u 实际读作？',
          answer: 'ü', inputType: 'choice', options: R.shuffle(['ü', 'u', 'ou']),
          hint: 'j/q/x 与 ü 相拼省去两点，读音仍是 ü。',
          uniqKey: 'ju|' + w.word };
      }
    },

    'syllable-sort': {
      kp: 'syllable-spelling',
      fn: function (B, R) {
        var pool = B.jqxuWords.concat(B.lightToneWords);
        var w = R.pick(pool);
        var parts = w.py.trim().split(/\s+/);
        if (parts.length !== 2) return null;
        var correct = parts.join(' ');
        var reversed = parts.slice().reverse().join(' ');
        if (reversed === correct) return null;
        return { q: '把音节排成词语：「' + parts[0] + '」「' + parts[1] + '」',
          answer: correct, inputType: 'choice',
          options: R.shuffle([correct, reversed]),
          hint: '按词语读音顺序排列。', uniqKey: 'ss|' + w.word };
      }
    },

    'confusing-pick': {
      kp: 'review',
      grades: [2, 3],
      fn: function (B, R) {
        var g = R.pick(B.confusingGroups);
        var w = R.pick(g.words);
        var others = g.words.filter(function (x) { return x.py !== w.py; })
          .map(function (x) { return x.py; });
        var opts = R.shuffle([w.py].concat(others)).slice(0, Math.max(2, others.length + 1))
          .filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (opts.length < 2) return null;
        var kpTail = g.pair.join('') === 'ining' || g.group === '前后鼻音' ? 'vowel-confusion' : 'review';
        void kpTail;
        return { q: '「' + w.w + '」的正确注音是？', answer: w.py,
          inputType: 'choice', options: opts,
          hint: '注意' + g.group + '发音区别。', uniqKey: 'cp|' + w.w };
      }
    },

    'light-tone-judge': {
      kp: 'review',
      fn: function (B, R) {
        var lightSet = {};
        B.lightToneWords.forEach(function (x) { lightSet[x.word] = true; });
        var useLight = R.int(0, 1) === 0;
        var w;
        if (useLight) {
          w = R.pick(B.lightToneWords);
        } else {
          var gradeData = B.bank[1] || [];
          if (!gradeData.length) return null;
          var c1 = R.pick(gradeData), c2 = R.pick(gradeData);
          w = { word: c1.hz + c2.hz, py: c1.py + ' ' + c2.py };
          if (lightSet[w.word]) return null;
        }
        var secondIsLight = !!lightSet[w.word];
        return { q: '判断：「' + w.word + '」的第二个音节读轻声。',
          answer: secondIsLight ? '对' : '错',
          inputType: 'choice', options: ['对', '错'],
          hint: '叠音词与部分口语词的第二音节常读轻声。', uniqKey: 'lt|' + w.word + '|' + (secondIsLight ? 'Y' : 'N') };
      }
    },

    'polyphone-note': {
      kp: 'multi-pronunciation',
      fn: function (B, R) {
        var ph = R.pick(B.polyphones);
        if (!ph.readings || ph.readings.length < 2) return null;
        var target = R.pick(ph.readings);
        var word = target.ctx.replace(/（[^）]*）/g, '').trim();
        if (!word) return null;
        return { q: '「' + word + '」中「' + ph.char + '」的读音是？', answer: target.py,
          inputType: 'choice', options: R.shuffle(ph.readings.map(function (r2) { return r2.py; })),
          hint: '结合词语意思选择读音。', uniqKey: 'pn|' + word };
      }
    }
  };

  var GRADE_POOLS = {
    1: ['initials-pick', 'finals-pick', 'whole-syllable-pick', 'tone-mark', 'judge-tone', 'fill-blank', 'jqx-u'],
    2: ['initials-pick', 'finals-pick', 'whole-syllable-pick', 'tone-mark', 'judge-tone', 'fill-blank',
        'jqx-u', 'syllable-sort', 'confusing-pick', 'light-tone-judge'],
    3: ['fill-blank', 'confusing-pick', 'light-tone-judge', 'polyphone-note', 'tone-mark', 'judge-tone', 'syllable-sort']
  };

  var GEN_KP = {
    basic: 'basic',
    'tone-marks': 'tone-marks',
    'to-char': 'to-char',
    'syllable-spelling': 'syllable-spelling',
    review: 'review',
    'multi-pronunciation': 'multi-pronunciation'
  };

  var KP_PREFIX = 'cn-gX-n1-';
  function kpIdFor(genKey, grade) {
    var tail = GEN_KP[GENERATORS[genKey].kp];
    var g = GENERATORS[genKey].kp === 'multi-pronunciation' ? 3 : Math.min(grade, 2);
    return 'cn-g' + g + '-n1-' + tail;
  }

  /** @type {ExercisePlugin} */
  var plugin = {
    id: 'chinese-pinyin',
    name: '拼音练习',
    subject: 'chinese',
    moduleId: 'N1',
    grades: [1, 2, 3],
    printConfig: { pageType: 'pinyin' },
    knowledgePoints: {
      1: ['cn-g1-n1-pinyin-basic', 'cn-g1-n1-pinyin-to-char', 'cn-g1-n1-char-to-pinyin',
          'cn-g1-n1-tone-marks', 'cn-g1-n1-syllable-spelling'],
      2: ['cn-g2-n1-alphabet-order', 'cn-g2-n1-pinyin-review'],
      3: ['cn-g3-n1-multi-pronunciation', 'cn-g3-n1-vowel-confusion']
    },

    settings: [
      { key: 'type', label: '题型', default: 'mix', options: [
        { value: 'mix',   label: '智能混合（按知识点）' },
        { value: 'copy',  label: '拼音抄写' },
        { value: 'char',  label: '汉字注音' },
        { value: 'word',  label: '词语注音' },
        { value: 'initials-pick',  label: '声母辨认' },
        { value: 'finals-pick',    label: '韵母辨认' },
        { value: 'whole-syllable-pick', label: '整体认读' },
        { value: 'tone-mark',      label: '标调练习' },
        { value: 'jqx-u',          label: 'jqx 与 ü' },
        { value: 'confusing-pick', label: '易混音辨析' },
        { value: 'light-tone-judge', label: '轻声判断' },
        { value: 'polyphone-note', label: '多音字' }
      ] }
    ],

    generate(options) {
      options = options || {};
      if (typeof PINYIN_BANK === 'undefined') {
        throw new Error('PINYIN_BANK 未加载，请确保 pinyin-bank.js 已引入');
      }
      var bank = PINYIN_BANK;

      var grade = Math.min(Number(options.grade) || 1, 6);
      var count = Number(options.count) > 0 ? Number(options.count) : 10;
      var legacyType = options.type;

      // ---- 旧题型兼容 ----
      if (legacyType === 'copy' || legacyType === 'char' || legacyType === 'word') {
        var qs = [];
        var srcChars = bank.getChars(Math.min(grade, 3));
        var srcWords = bank.getWords(Math.min(grade, 3));
        if (legacyType === 'word') {
          _PU.shuffle(srcWords).slice(0, count).forEach(function (w) {
            qs.push({ type: 'word', q: w.w, answer: w.py, inputType: 'text',
              // 四线三格示范：目标词语拼音（供照格书写）
              svg: cnSvg('pinyinGrid', String(w.py).replace(/\s+/g, '')),
              knowledgePointId: 'cn-g1-n1-pinyin-to-char', difficulty: 2 });
          });
        } else {
          _PU.shuffle(srcChars).slice(0, count).forEach(function (ch) {
            qs.push({ type: legacyType,
              q: legacyType === 'copy' ? ch.hz + ' → ' + ch.py : ch.hz,
              answer: ch.py, inputType: 'text',
              // 抄写题：四线格展示拼音示范；注音题：田字格展示汉字（提示非答案）
              svg: legacyType === 'copy'
                ? cnSvg('pinyinGrid', ch.py)
                : cnSvg('hanziGrid', ch.hz),
              knowledgePointId: 'cn-g1-n1-pinyin-basic', difficulty: 1 });
          });
        }
        return { questions: qs, meta: { grade: grade, count: qs.length, columns: 1,
          title: gradeName(grade) + '拼音练习' } };
      }

      // ---- 新架构路由 ----
      var R = {
        int: function (a, b) { return _PU.randInt(a, b); },
        pick: function (arr) { return arr[_PU.randInt(0, arr.length - 1)]; },
        shuffle: function (arr) { return _PU.shuffle(arr); }
      };

      var selected = Array.isArray(options.selectedKnowledgeIds) ? options.selectedKnowledgeIds : null;
      var poolIds = GRADE_POOLS[Math.min(grade, 3)] || GRADE_POOLS[3];

      // 显式单题型（settings 直选生成器名）
      if (legacyType && GENERATORS[legacyType]) poolIds = [legacyType];
      else if (legacyType && legacyType !== 'mix') poolIds = GRADE_POOLS[Math.min(grade, 3)].slice();

      var enabled = poolIds.filter(function (gid) {
        if (!selected || !selected.length) return true;
        var kpTail = GEN_KP[GENERATORS[gid].kp];
        return selected.some(function (sid) {
          return sid === kpTail || sid.indexOf('-n1-' + kpTail) !== -1;
        });
      });
      if (!enabled.length) enabled = GRADE_POOLS[Math.min(grade, 3)] || poolIds;

      var seen = {};
      var out = [];
      var guard = 0;
      while (out.length < count && guard++ < count * 60) {
        var gid = enabled[R.int(0, enabled.length - 1)];
        var core = GENERATORS[gid].fn(bank, R);
        if (!core || seen[core.uniqKey]) continue;
        seen[core.uniqKey] = 1;

        var kpId = KP_PREFIX.replace('gX', 'g' + Math.min(grade, 2)) + GEN_KP[GENERATORS[gid].kp];
        if (GENERATORS[gid].kp === 'multi-pronunciation') kpId = 'cn-g3-n1-multi-pronunciation';

        out.push({
          type: gid,
          q: core.q,
          answer: core.answer,
          inputType: core.inputType,
          options: core.options,
          svg: core.svg || undefined,
          hint: core.hint,
          knowledgePointId: kpId,
          difficulty: Math.max(1, Math.min(5, Math.ceil(grade * 1.6)))
        });
      }

      return { questions: out,
        meta: { grade: grade, count: out.length, columns: 1,
                title: gradeName(grade) + '拼音练习（N1）' } };
    },

    render(exerciseSet) {
      // 科目化题卡：cn-grid 网格 + cn-card 卡片（左侧绿色色条，四线格/田字格随题注入）
      return _PU.renderGrid(exerciseSet.questions,
        { columns: 1, inputWidth: 220, gridClass: 'cn-grid', cardClass: 'cn-card' });
    },

    check(exerciseSet, userAnswers) {
      return _PU.computeResult(exerciseSet.questions, userAnswers, {
        checkFn: function (q, ua, i) {
          var userAns = ua && ua[i] != null ? String(ua[i]).trim() : '';
          if (q.inputType === 'choice') return userAns === String(q.answer);
          return _CU.normPY(userAns) === _CU.normPY(q.answer);
        }
      });
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
