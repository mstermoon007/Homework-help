// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/english-alphabet.js 依赖 shared/common.js（PluginUtil），请先加载');

  var _lastMeta = null; // generateQuestions 产出后供 meta() 读取（工厂保证先 questions 后 meta）

  /** @type {ExercisePlugin} */
  var plugin = _PU.createPlugin({
    id: 'english-alphabet',
    name: '字母跟读',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'english',
    printConfig: { pageType: 'alphabet' },

    // 跟读型练习：无书面答案可批改，practice.html 据此隐藏「检查答案」按钮
    // （check 仍保留兜底实现，供「显示答案」等入口调用）
    noCheck: true,

    settings: [
      {
        key: 'type',
        label: '筛选字母',
        default: 'all',
        options: [
          { value: 'all',       label: '全部26个' },
          { value: 'vowel',     label: '元音字母' },
          { value: 'consonant', label: '辅音字母' }
        ]
      }
    ],

    generateQuestions(options) {
      options = options || {};
      // practice.html 通过 settings 传 options.type；兼容旧的 options.filter
      var filter = options.type || options.filter || 'all';
      var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      var vowels = ['A', 'E', 'I', 'O', 'U'];
      var selected = letters;
      if (filter === 'vowel' || filter === 'vowels') selected = vowels;
      else if (filter === 'consonant' || filter === 'consonants') selected = letters.filter(function(l) { return vowels.indexOf(l) === -1; });

      var count = Math.min(options.count || 26, selected.length);
      var shuffled = _PU.shuffle(selected.slice()).slice(0, count);

      var questions = shuffled.map(function(letter) {
        return {
          letter: letter,
          name: letter,
          sound: this._getLetterSound(letter),
          example: this._getExample(letter)
        };
      }, this);

      _lastMeta = { filter, count: questions.length, title: '英语字母跟读练习' };
      return questions;
    },

    meta(opts) {
      return _lastMeta || { count: 0, title: '英语字母跟读练习' };
    },

    // 无书面输入，跟读型：自定义渲染（每题一卡，发音按钮走内联 onclick，practice.html 不会调用 bindEvents）
    render: function(exerciseSet) {
      // 科目化书写格：SVGEnglish.letterWriting 生成四线三格小写示范（浏览器端；Node 环境安全降级）
      var _EG = (typeof SVGEnglish !== 'undefined') ? SVGEnglish
        : ((typeof SVGGenerators !== 'undefined' && SVGGenerators.en) ? SVGGenerators.en : null);
      var hasWriter = !!(_EG && typeof _EG.letterWriting === 'function');
      var html = '<div class="alphabet-grid en-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;">';
      var self = this;
      exerciseSet.questions.forEach(function(q, idx) {
        var writeSvg = '';
        if (hasWriter) {
          try { writeSvg = _EG.letterWriting(q.letter.toLowerCase(), 'lower') || ''; } catch (e) { writeSvg = ''; }
        }
        html +=
          '<div class="question-card letter-card en-card" data-index="' + idx + '" style="border-width:2px;border-left-width:3px;border-style:solid;border-color:var(--en-primary);border-radius:12px;padding:15px;text-align:center;background:var(--card);">' +
          '<div class="big-letter" style="font-size:3em;font-weight:bold;color:var(--ink);">' + q.letter + '</div>' +
          (writeSvg ? '<div class="scene-box" style="justify-content:center;">' + writeSvg + '</div>' : '') +
          '<div style="color:var(--muted);font-size:0.9em;">' + q.sound + '</div>' +
          '<div style="margin:8px 0;">例词: <strong>' + q.example + '</strong></div>' +
          '<button class="play-btn" data-letter="' + q.letter + '" data-example="' + q.example + '" onclick="window.__currentPlugin.__play(this)" style="padding:5px 10px;cursor:pointer;border:none;border-radius:8px;background:var(--en-primary);color:var(--card);">🔊 发音</button>' +
          '<div class="feedback"></div>' +
          '</div>';
      });
      html += '</div>';
      return html;
    },

    // 跟读练习无书面输入：check 恒定返回全对 + 明确提示文案
    check: function(exerciseSet, userAnswers) {
      return {
        score: 100,
        total: exerciseSet.questions.length,
        correct: exerciseSet.questions.length,
        message: '跟读练习无批改，请多听多读！',
        results: exerciseSet.questions.map(function() { return true; }),
        correctAnswers: exerciseSet.questions.map(function(q) { return q.letter; })
      };
    },

    // 供 render 内联 onclick 调用：this = button，读取 data-* 播放
    __play: function(btn) {
      var letter = btn.getAttribute('data-letter');
      var example = btn.getAttribute('data-example');
      this._speak(letter, example);
    },

    // 额外的方法，壳页面可在渲染后绑定事件（practice.html 未调用，保留兼容）
    bindEvents: function(container) {
      var self = this;
      var buttons = container.querySelectorAll('.play-btn');
      buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var letter = btn.getAttribute('data-letter');
          var example = btn.getAttribute('data-example');
          self._speak(letter, example);
        });
      });
    },

    _getLetterSound: function(letter) {
      var map = {
        A: '/eɪ/', B: '/biː/', C: '/siː/', D: '/diː/', E: '/iː/', F: '/ef/',
        G: '/dʒiː/', H: '/eɪtʃ/', I: '/aɪ/', J: '/dʒeɪ/', K: '/keɪ/', L: '/el/',
        M: '/em/', N: '/en/', O: '/əʊ/', P: '/piː/', Q: '/kjuː/', R: '/ɑːr/',
        S: '/es/', T: '/tiː/', U: '/juː/', V: '/viː/', W: '/ˈdʌbəl.juː/',
        X: '/eks/', Y: '/waɪ/', Z: '/ziː/'
      };
      return map[letter] || '';
    },

    _getExample: function(letter) {
      var words = {
        A: 'apple', B: 'ball', C: 'cat', D: 'dog', E: 'elephant',
        F: 'fish', G: 'goat', H: 'hat', I: 'igloo', J: 'jam',
        K: 'kite', L: 'lion', M: 'monkey', N: 'nose', O: 'orange',
        P: 'pig', Q: 'queen', R: 'rabbit', S: 'sun', T: 'tiger',
        U: 'umbrella', V: 'van', W: 'water', X: 'box', Y: 'yellow', Z: 'zebra'
      };
      return words[letter] || '';
    },

    _speak: function(letter, example) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        var utter = new SpeechSynthesisUtterance(letter + '. ' + example);
        utter.lang = 'en-US';
        utter.rate = 0.8;
        window.speechSynthesis.speak(utter);
      } else {
        alert('您的浏览器不支持语音合成');
      }
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
