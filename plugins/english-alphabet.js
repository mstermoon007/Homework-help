// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/english-alphabet.js 依赖 shared/common.js（PluginUtil），请先加载');

  var _lastSet = null; // 供发音交互按 index 读取当前题目

  /** @type {ExercisePlugin} */
  var plugin = {
    id: 'english-alphabet',
    name: '字母跟读',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'english',
    printConfig: { pageType: 'alphabet', title: '英语字母练习' },

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

    generate(options = {}) {
      // practice.html 通过 settings 传 options.type；兼容旧的 options.filter
      const filter = options.type || options.filter || 'all';
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const vowels = ['A', 'E', 'I', 'O', 'U'];
      let selected = letters;
      if (filter === 'vowel' || filter === 'vowels') selected = vowels;
      else if (filter === 'consonant' || filter === 'consonants') selected = letters.filter(l => vowels.indexOf(l) === -1);

      const count = Math.min(options.count || 26, selected.length);
      const shuffled = _PU.shuffle(selected.slice()).slice(0, count);

      const questions = shuffled.map(letter => ({
        letter,
        name: letter,
        sound: this._getLetterSound(letter),
        example: this._getExample(letter)
      }));

      _lastSet = questions;
      return { questions, meta: { filter, count: questions.length, title: '英语字母跟读练习' } };
    },

    _getLetterSound(letter) {
      const map = {
        A: '/eɪ/', B: '/biː/', C: '/siː/', D: '/diː/', E: '/iː/', F: '/ef/',
        G: '/dʒiː/', H: '/eɪtʃ/', I: '/aɪ/', J: '/dʒeɪ/', K: '/keɪ/', L: '/el/',
        M: '/em/', N: '/en/', O: '/əʊ/', P: '/piː/', Q: '/kjuː/', R: '/ɑːr/',
        S: '/es/', T: '/tiː/', U: '/juː/', V: '/viː/', W: '/ˈdʌbəl.juː/',
        X: '/eks/', Y: '/waɪ/', Z: '/ziː/'
      };
      return map[letter] || '';
    },

    _getExample(letter) {
      const words = {
        A: 'apple', B: 'ball', C: 'cat', D: 'dog', E: 'elephant',
        F: 'fish', G: 'goat', H: 'hat', I: 'igloo', J: 'jam',
        K: 'kite', L: 'lion', M: 'monkey', N: 'nose', O: 'orange',
        P: 'pig', Q: 'queen', R: 'rabbit', S: 'sun', T: 'tiger',
        U: 'umbrella', V: 'van', W: 'water', X: 'box', Y: 'yellow', Z: 'zebra'
      };
      return words[letter] || '';
    },

    render(exerciseSet) {
      // 无书面输入，跟读型：每题一卡，按钮走内联 onclick（practice.html 不会调用 bindEvents）
      let html = '<div class="alphabet-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;">';
      exerciseSet.questions.forEach((q, idx) => {
        html += `
          <div class="question-card letter-card" data-index="${idx}" style="border:2px solid #4CAF50;border-radius:12px;padding:15px;text-align:center;background:#fff;">
            <div class="big-letter" style="font-size:3em;font-weight:bold;color:#333;">${q.letter}</div>
            <div style="color:#666;font-size:0.9em;">${q.sound}</div>
            <div style="margin:8px 0;">例词: <strong>${q.example}</strong></div>
            <button class="play-btn" data-letter="${q.letter}" data-example="${q.example}" onclick="window.__currentPlugin.__play(this)" style="padding:5px 10px;cursor:pointer;border:none;border-radius:8px;background:#4CAF50;color:#fff;">🔊 发音</button>
            <div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:6px;"></div>
          </div>`;
      });
      html += '</div>';
      return html;
    },

    // 供 render 内联 onclick 调用：this = button，读取 data-* 播放
    __play(btn) {
      const letter = btn.getAttribute('data-letter');
      const example = btn.getAttribute('data-example');
      this._speak(letter, example);
    },

    check(exerciseSet, userAnswers) {
      // 跟读练习通常无批改，但接口要求返回 CheckResult，可返回空成绩
      return {
        score: 100,
        total: exerciseSet.questions.length,
        correct: exerciseSet.questions.length,
        message: '跟读练习无批改，请多听多读！',
        results: exerciseSet.questions.map(() => true),
        correctAnswers: exerciseSet.questions.map(q => q.letter)
      };
    },

    // 额外的方法，壳页面可在渲染后绑定事件（practice.html 未调用，保留兼容）
    bindEvents(container) {
      const buttons = container.querySelectorAll('.play-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const letter = btn.getAttribute('data-letter');
          const example = btn.getAttribute('data-example');
          this._speak(letter, example);
        });
      });
    },

    _speak(letter, example) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(letter + '. ' + example);
        utter.lang = 'en-US';
        utter.rate = 0.8;
        window.speechSynthesis.speak(utter);
      } else {
        alert('您的浏览器不支持语音合成');
      }
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
