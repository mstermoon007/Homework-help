/**
 * 数学练习页公共 UI 框架
 * 由 math-unit-convert / math-number-sense / math-measurement / math-geometry 共享
 *
 * 用法：
 *   <script src="shared/ui-framework-math.js"></script>
 *   <script>
 *   MathUI.create({
 *     pageId: 'mathUnitConvert',
 *     printTitle: '一年级数学单位换算练习',
 *     printPageType: 'unitConvert',
 *     typeNames: { all:'全部', clock:'认读时钟', ... },
 *     generators: { clock:[genClock], money:[genMoney], calc:[genCalc] },
 *     badgeLabels: null,        // optional: { angle:'角的初步认识', ... }
 *     sceneBox: true            // optional: wrap SVG in .scene-box
 *   });
 *   </script>
 */
var MathUI = (function () {
  'use strict';

  var state = { count: 5, type: 'all', problems: [], revealed: false };
  var config = {};
  var problemsArea, resultArea;

  // ============ 工具函数 ============
  function rnd(min, max) { return App.randInt(min, max); }
  function pick(arr) { return App.rand(arr); }
  function shuffleArr(arr) { return App.shuffle(arr); }

  // 暴露为全局，供页面内生成器函数直接调用
  window.rnd = rnd;
  window.pick = pick;
  window.shuffleArr = shuffleArr;

  // ============ 生成 ============
  function generate() {
    var gens = [];
    Object.keys(config.generators).forEach(function (t) {
      if (state.type === 'all' || state.type === t) {
        gens = gens.concat(config.generators[t]);
      }
    });

    var list = [];
    var seen = {};
    for (var i = 0; i < state.count; i++) {
      var q, attempts = 0;
      do {
        q = pick(gens)();
        attempts++;
      } while (seen[q.q] && attempts < 20);
      seen[q.q] = true;
      list.push(q);
    }
    state.problems = list;
    state.revealed = false;
    renderProblems();
    resultArea.innerHTML = '';
  }

  // ============ 渲染 ============
  function renderProblems() {
    if (!state.problems.length) {
      problemsArea.innerHTML = '<div class="empty">点击「生成练习题」开始吧～</div>';
      return;
    }
    var meta = '<div class="meta">' +
      '<span class="pill">' + state.problems.length + ' 题</span>' +
      '<span class="pill">' + (config.typeNames[state.type] || '全部') + '</span>' +
      '</div>';

    var cards = state.problems.map(function (p, i) {
      // SVG
      var svgHtml = '';
      if (p.svg) {
        svgHtml = config.sceneBox ? '<div class="scene-box">' + p.svg + '</div>' : p.svg;
      }
      // Badge
      var badgeHtml = '';
      if (config.badgeLabels && config.badgeLabels[p.type]) {
        badgeHtml = '<span class="badge ' + p.type + '">' + config.badgeLabels[p.type] + '</span>';
      }
      // Input
      var inputHtml = '';
      if (p.inputType === 'choice') {
        inputHtml = '<div class="options">' + p.options.map(function (o) {
          return '<span class="opt" data-ans="' + o + '">' + o + '</span>';
        }).join('') + '</div>';
      } else if (p.inputType === 'multi') {
        var inputs = '';
        for (var j = 0; j < p.inputCount; j++) {
          inputs += '<input type="text" inputmode="numeric" placeholder="?" autocomplete="off" data-idx="' + j + '">';
        }
        inputHtml = '<div class="input-group">' + inputs + '</div>';
      } else {
        inputHtml = '<div class="input-group"><input type="text" placeholder="填写答案" autocomplete="off"></div>';
      }
      // Unit
      var unitHtml = p.unit ? '<span class="unit">' + p.unit + '</span>' : '';
      var answerText = p.answerDisplay || p.answer;

      return '<div class="problem" data-i="' + i + '">' +
        '<div class="num">' + (i + 1) + '</div>' +
        badgeHtml +
        '<p class="q">' + p.q + '</p>' +
        svgHtml +
        inputHtml +
        '<div class="ans">' +
          unitHtml +
          '<span class="feedback"></span>' +
          '<span class="reveal hide">正确答案：' + answerText + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    problemsArea.innerHTML = meta + cards;

    // 绑定选项点击
    problemsArea.querySelectorAll('.opt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var card = this.closest('.problem');
        card.querySelectorAll('.opt').forEach(function (o) { o.classList.remove('chosen'); });
        this.classList.add('chosen');
      });
    });
  }

  // ============ 检查答案 ============
  function extractAnswer(card, p) {
    if (p.inputType === 'choice') {
      var chosen = card.querySelector('.opt.chosen');
      return chosen ? chosen.dataset.ans : '';
    } else if (p.inputType === 'multi') {
      var inputs = card.querySelectorAll('input');
      return Array.prototype.map.call(inputs, function (inp) { return inp.value.trim(); }).join(',');
    } else {
      var input = card.querySelector('input');
      return (input ? input.value : '').trim();
    }
  }

  function check() {
    if (!state.problems.length) return;
    var correct = 0;
    var cards = problemsArea.querySelectorAll('.problem');
    state.problems.forEach(function (p, i) {
      var card = cards[i];
      var fb = card.querySelector('.feedback');
      card.classList.remove('correct', 'wrong');

      var userAnswer = extractAnswer(card, p);
      var normUser = PracticeCore.normalizeAnswer(userAnswer);
      var normRight = PracticeCore.normalizeAnswer(p.answer);

      if (!userAnswer) {
        fb.textContent = '未作答'; fb.style.color = 'var(--warn)'; card.classList.add('wrong');
      } else if (normUser === normRight) {
        fb.textContent = '✓ 正确'; fb.style.color = 'var(--ok)'; card.classList.add('correct'); correct++;
      } else {
        fb.textContent = '✗ 正确答案：' + (p.answerDisplay || p.answer);
        fb.style.color = 'var(--bad)'; card.classList.add('wrong');
      }
    });
    var total = state.problems.length;
    var pct = PracticeCore.computeScore(correct, total);
    var tips = correct === total ? '太棒了，全部答对！👏' : correct >= total * 0.8 ? '表现很好，再练练就满分啦！💪' : '别灰心，把错题弄懂，下次一定行！🌟';
    resultArea.innerHTML = '<div class="result">' +
      '<div class="score">' + correct + ' / ' + total + '</div>' +
      '<div class="detail">正确率 ' + pct + '% &nbsp;·&nbsp; ' + tips + '</div>' +
      '</div>';
  }

  // ============ 显示/隐藏答案 ============
  function toggleReveal() {
    state.revealed = !state.revealed;
    problemsArea.querySelectorAll('.reveal').forEach(function (r) { r.classList.toggle('hide', !state.revealed); });
    document.getElementById('revealBtn').textContent = state.revealed ? '🙈 隐藏答案' : '👀 显示答案';
  }

  // ============ 打印 ============
  function printFile() {
    if (!state.problems.length) { alert('请先生成练习题！'); return; }
    PracticeCore.printSheet('#problemsArea', config.printTitle, { pageType: config.printPageType });
  }

  // ============ 初始化 ============
  function init(opts) {
    config = opts;
    problemsArea = document.getElementById('problemsArea');
    resultArea = document.getElementById('resultArea');

    var grade = App.getGradeParam();
    document.getElementById('gradeTitle').textContent = App.getGradeName(grade);
    document.getElementById('backLink').href = App.buildLink('math-types.html');

    document.querySelectorAll('[data-count]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-count]').forEach(function (c) { c.classList.remove('active'); });
        this.classList.add('active');
        state.count = +this.dataset.count;
      });
    });
    document.querySelectorAll('[data-type]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-type]').forEach(function (c) { c.classList.remove('active'); });
        this.classList.add('active');
        state.type = this.dataset.type;
        if (state.problems.length) generate();
      });
    });
    document.getElementById('genBtn').addEventListener('click', generate);
    document.getElementById('checkBtn').addEventListener('click', check);
    document.getElementById('revealBtn').addEventListener('click', toggleReveal);
    document.getElementById('printBtn').addEventListener('click', printFile);
    App.initPageController(config.pageId, 'math');
  }

  return {
    init: init,
    generate: generate,
    check: check,
    toggleReveal: toggleReveal,
    printFile: printFile,
    state: state,
    rnd: rnd,
    pick: pick,
    shuffleArr: shuffleArr
  };
})();
