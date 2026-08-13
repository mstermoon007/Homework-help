// ========== 练习公共内核 ==========
// PracticeCore —— 数学(MathUI) 与 语文(PracticeUI) 共享的练习原语
// 提供：计时器、答案归一化、算分、评级、壳页面初始化、对错标记、打印、错题重做编排
// 本文件必须在 shared/ui-framework-math.js 与 shared/ui-framework.js 之前加载。

var PracticeCore = (function () {
  'use strict';

  // ============ 计时器（DOM-free，显示更新由调用方负责） ============
  function Timer() {
    this._id = null;
    this._start = 0;
  }
  Timer.prototype.start = function () {
    this.stop();
    this._start = Date.now();
  };
  Timer.prototype.startTicking = function (onTick) {
    this.stop();
    this._start = Date.now();
    var self = this;
    this._id = setInterval(function () {
      var t = Math.floor((Date.now() - self._start) / 1000);
      if (onTick) onTick(t);
    }, 1000);
  };
  Timer.prototype.stop = function () {
    if (this._id) { clearInterval(this._id); this._id = null; }
  };
  Timer.prototype.getElapsed = function () {
    return Math.floor((Date.now() - this._start) / 1000);
  };

  // ============ 答案归一化 ============
  function normalizeAnswer(v) {
    return (v == null ? '' : ('' + v)).trim().replace(/\s+/g, '').toLowerCase();
  }

  // ============ 算分 ============
  function computeScore(right, total) {
    if (!total) return 0;
    return Math.round((right / total) * 100);
  }

  // ============ 评级 + 评语 ============
  // 返回 { tier: 'excellent'|'good'|'pass'|'fail', comment: string }
  function getScoreTier(score, elapsed) {
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins > 0 ? (mins + '分' + secs + '秒') : (secs + '秒');
    if (score === 100) return { tier: 'excellent', comment: '太棒了！满分！用时' + timeStr };
    if (score >= 90) return { tier: 'excellent', comment: '非常优秀！用时' + timeStr };
    if (score >= 75) return { tier: 'good', comment: '成绩不错，继续加油！用时' + timeStr };
    if (score >= 60) return { tier: 'pass', comment: '刚好及格，多练练！用时' + timeStr };
    return { tier: 'fail', comment: '不要灰心，多做练习！用时' + timeStr };
  }

  // ============ 壳页面初始化 ============
  // 处理年级徽标、返回链接、页面控制器、年级默认题数。
  // config: { pageId, pageCategory, gradeBadgeId?, backPage?, gradeDefaults?, countElId? }
  // 返回 { grade, gradeName }
  function initShell(config) {
    config = config || {};
    var grade = App.getGradeParam();
    var gradeName = App.getGradeName(grade);

    var gb = document.getElementById(config.gradeBadgeId || 'gradeBadge');
    if (gb) gb.textContent = gradeName;

    var bl = document.getElementById('backLink');
    if (bl) bl.href = App.buildLink(config.backPage || (config.pageCategory === 'math' ? 'math-types.html' : 'chinese-types.html'));

    if (config.gradeDefaults && config.countElId) {
      var countEl = document.getElementById(config.countElId);
      if (countEl && config.gradeDefaults[grade] !== undefined) {
        if (!countEl.dataset.touched) countEl.value = config.gradeDefaults[grade];
      }
    }

    App.initPageController(config.pageId, config.pageCategory || 'chinese');
    return { grade: grade, gradeName: gradeName };
  }

  // ============ 对错标记（icon 模式：语文用） ============
  // 切换 correct/wrong 类、移除旧标记、锁定输入、追加 mark-icon。
  function markItem(itemEl, opts) {
    if (!itemEl) return;
    var correct = !!opts.correct;
    itemEl.classList.remove('correct', 'wrong');
    itemEl.classList.add(correct ? 'correct' : 'wrong');

    var oldMk = itemEl.querySelector('.mark-icon');
    if (oldMk) oldMk.remove();
    var oldCa = itemEl.querySelector('.correct-answer');
    if (oldCa) oldCa.remove();

    var inputs = itemEl.querySelectorAll('input');
    for (var j = 0; j < inputs.length; j++) {
      inputs[j].setAttribute('readonly', 'true');
    }

    var mk = document.createElement('span');
    mk.className = 'mark-icon ' + (correct ? 'ok' : 'bad');
    mk.textContent = correct ? '✓' : '✗';
    itemEl.appendChild(mk);
  }

  // ============ 打印 ============
  function printSheet(selector, title, opts) {
    if (typeof Print === 'undefined') { alert('打印组件未加载'); return; }
    Print.open(selector, title, opts || {});
  }

  // ============ 错题重做编排（状态由本管理器持有） ============
  // getExercises: () => 当前题目数组
  function createRedo(getExercises) {
    var wrongIndices = [];
    var reviewed = false;

    function findQuestionDomId(q, i) {
      return q._domId || ('q_' + (q.num || i));
    }

    function redoWrong(renderFn) {
      if (wrongIndices.length === 0) { alert('没有错题！'); return; }
      var exercises = getExercises();
      var wrongQuestions = wrongIndices.map(function (idx) { return exercises[idx]; });
      wrongQuestions.forEach(function (q) { q.userAnswer = null; q.correct = null; });

      var colRadio = document.querySelector('input[name="columns"]:checked');
      var cols = colRadio ? Math.min(2, parseInt(colRadio.value)) : 2;
      var grid = document.getElementById('wrongGrid');
      if (!grid) return;
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      grid.innerHTML = '';

      if (typeof renderFn === 'function') {
        renderFn(grid, wrongQuestions, cols);
      }

      var cb = document.getElementById('correctBtn');
      if (cb) { cb.style.display = 'inline-flex'; cb.disabled = false; }
      var ws = document.getElementById('wrongSection');
      if (ws) { ws.classList.add('show'); ws.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }

    function submitWrongCorrections(checkFn, getElapsed, showScorePanel) {
      var exercises = getExercises();
      var reRight = 0, stillWrong = 0;
      wrongIndices.forEach(function (idx) {
        var q = exercises[idx];
        var newAns = (q._redo && q._redo.newAnswer !== undefined) ? q._redo.newAnswer : q.userAnswer;
        var correctNow = checkFn(q, newAns);
        if (correctNow) {
          q.correct = true;
          q.userAnswer = newAns;
          reRight++;
          updateOriginalItem(idx, true, newAns);
          updateWrongItem(idx, true, q.answer);
        } else {
          stillWrong++;
          q.userAnswer = newAns;
          updateWrongItem(idx, false, q.answer);
        }
      });

      var right = 0;
      exercises.forEach(function (q) { if (q.correct) right++; });
      var total = exercises.length;
      var score = computeScore(right, total);
      showScorePanel(score, right, total - right, total, getElapsed());

      var cb = document.getElementById('correctBtn');
      if (cb) cb.disabled = true;

      setTimeout(function () {
        alert('错题修改完成！\n本次订正对：' + reRight + ' 题\n仍未答对：' + stillWrong + ' 题\n最终得分：' + score + ' 分');
      }, 200);
    }

    function updateOriginalItem(idx, correct, newAns) {
      var exercises = getExercises();
      var q = exercises[idx];
      var item = document.getElementById(findQuestionDomId(q, idx));
      if (!item) return;
      item.classList.remove('wrong');
      if (correct) item.classList.add('correct');
      var mk = item.querySelector('.mark-icon');
      if (mk) { mk.className = 'mark-icon ' + (correct ? 'ok' : 'bad'); mk.textContent = correct ? '✓' : '✗'; }
      var ca = item.querySelector('.correct-answer');
      if (ca) ca.remove();
      var inputs = item.querySelectorAll('input');
      for (var j = 0; j < inputs.length; j++) {
        if (correct && newAns) inputs[j].value = newAns;
        inputs[j].setAttribute('readonly', 'true');
      }
    }

    function updateWrongItem(idx, correct, answer) {
      var witem = document.getElementById('wq_' + idx);
      if (!witem) return;
      witem.classList.add(correct ? 'correct' : 'wrong');
      var inp = witem.querySelector('input');
      if (inp) inp.setAttribute('readonly', 'true');
      var m = witem.querySelector('.mark-icon');
      if (!m) { m = document.createElement('span'); witem.appendChild(m); }
      m.className = 'mark-icon ' + (correct ? 'ok' : 'bad');
      m.textContent = correct ? '✓ 已订正' : '✗ 正确:' + answer;
    }

    function resetState() {
      wrongIndices = [];
      reviewed = false;
    }

    return {
      redoWrong: redoWrong,
      submitWrongCorrections: submitWrongCorrections,
      updateOriginalItem: updateOriginalItem,
      updateWrongItem: updateWrongItem,
      findQuestionDomId: findQuestionDomId,
      getWrongIndices: function () { return wrongIndices; },
      setWrongIndices: function (w) { wrongIndices = w; },
      isReviewed: function () { return reviewed; },
      resetState: resetState
    };
  }

  // ============ 公共 API ============
  return {
    Timer: Timer,
    normalizeAnswer: normalizeAnswer,
    computeScore: computeScore,
    getScoreTier: getScoreTier,
    initShell: initShell,
    markItem: markItem,
    printSheet: printSheet,
    createRedo: createRedo
  };
})();
