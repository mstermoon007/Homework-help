// ========== 语文练习共享框架 ==========
// PracticeUI —— 统一的练习生命周期管理
// 提供：计时器、评分面板、错题重做、打印等标准化流程
// 通过 plugin 接口与具体题型解耦

var PracticeUI = (function () {
  'use strict';

  // ========== 内部状态 ==========
  var config = {};
  var exercises = [];
  var reviewed = false;
  var timer = new PracticeCore.Timer();
  var columns = 3;
  var count = 15;
  var redo = PracticeCore.createRedo(function () { return exercises; });

  // ========== 计时器（委托核心 Timer） ==========
  function startTimer() {
    timer.startTicking(function (t) {
      var el = document.getElementById('timerDisplay');
      if (el) el.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    });
  }

  function stopTimer() {
    timer.stop();
  }

  function getElapsed() {
    return timer.getElapsed();
  }

  // ========== UI 工具 ==========
  function resetUIState() {
    var sp = document.getElementById('scorePanel');
    if (sp) sp.classList.remove('show');
    var ws = document.getElementById('wrongSection');
    if (ws) ws.classList.remove('show');
    var cb = document.getElementById('correctBtn');
    if (cb) cb.style.display = 'none';
    var sb = document.getElementById('submitBtn');
    if (sb) sb.disabled = true;
  }

  function getNowStr() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  // ========== 评分面板 ==========
  function showScorePanel(score, right, wrong, total, elapsed) {
    var panel = document.getElementById('scorePanel');
    if (!panel) return;
    var big = document.getElementById('scoreBig');
    var comment = document.getElementById('scoreComment');

    if (big) {
      big.textContent = score + ' 分';
      var tier = PracticeCore.getScoreTier(score, elapsed);
      big.className = 'score-big ' + tier.tier;
      if (comment) comment.textContent = tier.comment;
    }

    var cc = document.getElementById('correctCount');
    var wc = document.getElementById('wrongCount');
    var tc = document.getElementById('totalCount');
    if (cc) cc.textContent = right;
    if (wc) wc.textContent = wrong;
    if (tc) tc.textContent = total;

    var rb = document.getElementById('redoBtn');
    if (rb) rb.disabled = wrong === 0;
    panel.classList.add('show');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ========== 生命周期：初始化 ==========
  // config: { pageId, pageCategory, gradeDefaults:{1:N,2:N,...}, printConfig:{pageType,columns?},
  //           autoGenerate:bool, getTitle:fn(grade,gradeName), getDesc:fn(grade,gradeName) }
  function init(opts) {
    config = opts || {};
    var info = PracticeCore.initShell({
      pageId: config.pageId,
      pageCategory: config.pageCategory || 'chinese',
      backPage: config.backPage,
      gradeBadgeId: 'gradeBadge',
      gradeDefaults: config.gradeDefaults,
      countElId: 'count'
    });
    if (config.gradeDefaults && config.gradeDefaults[info.grade] !== undefined) {
      count = config.gradeDefaults[info.grade];
    }

    // 列数
    var colRadio = document.querySelector('input[name="columns"]:checked');
    if (colRadio) columns = parseInt(colRadio.value) || 3;

    // 自动生成
    if (config.autoGenerate !== false && typeof config.onGenerate === 'function') {
      config.onGenerate();
    }
  }

  // ========== 生命周期：开始练习 ==========
  // newExercises: 题目数组（由页面生成）
  // options: { columns, title, description, count }
  function startPractice(newExercises, options) {
    options = options || {};
    exercises = newExercises;
    redo.resetState();
    reviewed = false;
    resetUIState();

    // 更新标题信息
    var st = document.getElementById('sheetTitle');
    if (st && options.title) st.textContent = options.title;
    var hd = document.getElementById('headerDesc');
    if (hd && options.description) hd.textContent = options.description;
    var qc = document.getElementById('questionCount');
    if (qc) qc.textContent = '共 ' + exercises.length + ' 道题';
    var gt = document.getElementById('generateTime');
    if (gt) gt.textContent = '生成时间：' + getNowStr();

    // 显示题目卡片
    var card = document.getElementById('questionsCard');
    if (card) card.classList.add('show');

    // 启用按钮
    var eb = document.getElementById('exportBtn');
    if (eb) eb.disabled = false;
    var sb = document.getElementById('submitBtn');
    if (sb) sb.disabled = false;

    // 隐藏错题区
    var ws = document.getElementById('wrongSection');
    if (ws) ws.classList.remove('show');

    // 开始计时
    startTimer();
  }

  // ========== 生命周期：提交答案 ==========
  // checkFn(q, userAnswer) → boolean
  // getAnswerFn(q) → { inputId, el }
  function submitAnswers(checkFn, getInputFn) {
    stopTimer();
    var elapsed = getElapsed();

    // 收集答案
    exercises.forEach(function (q, i) {
      if (getInputFn) {
        var info = getInputFn(q);
        if (info && info.el) q.userAnswer = info.el.value.trim() === '' ? null : info.el.value.trim();
      }
    });

    // 检查
    var right = 0, wrong = 0;
    var wrongIdx = [];
    exercises.forEach(function (q, i) {
      q.correct = checkFn(q, q.userAnswer);
      if (q.correct) right++;
      else { wrong++; wrongIdx.push(i); }
    });
    redo.setWrongIndices(wrongIdx);

    var total = exercises.length;
    var score = PracticeCore.computeScore(right, total);

    // 更新 DOM 标记
    exercises.forEach(function (q, i) {
      markQuestion(q, i);
    });

    showScorePanel(score, right, wrong, total, elapsed);
    return { right: right, wrong: wrong, total: total, score: score, elapsed: elapsed };
  }

  // 在 DOM 中标记某道题的对错（dom-id 解析保留原逻辑，实际 DOM 操作委托核心 markItem）
  function markQuestion(q, i) {
    var itemId = q._domId || ('q_' + (q.num || q.flatIdx !== undefined ? (q.flatIdx !== undefined ? q.flatIdx : q.num) : i));
    var item = document.getElementById(itemId);
    if (!item) return;
    PracticeCore.markItem(item, { correct: q.correct });
  }

  // 供 reviewAll 使用（与核心 RedoManager 的 dom-id 解析保持一致）
  function findQuestionDomId(q, i) {
    return q._domId || ('q_' + (q.num || i));
  }

  // ========== 查看正确答案 ==========
  function reviewAll() {
    reviewed = true;
    exercises.forEach(function (q, i) {
      if (q.correct === false) {
        var item = document.getElementById(findQuestionDomId(q, i));
        if (item) {
          var oldCa = item.querySelector('.correct-answer');
          if (oldCa) oldCa.remove();
          var ca = document.createElement('span');
          ca.className = 'correct-answer';
          ca.textContent = '\u6b63\u786e\uff1a' + (q.answerDisplay || q.answer);
          item.appendChild(ca);
        }
      }
    });
    alert('\u5df2\u663e\u793a\u5168\u90e8\u9519\u9898\u7684\u6b63\u786e\u7b54\u6848\uff01');
  }

  // ========== 错题重做（委托核心 RedoManager，对外接口不变） ==========
  function redoWrong(renderFn) {
    redo.redoWrong(renderFn);
  }

  function submitWrongCorrections(checkFn) {
    redo.submitWrongCorrections(checkFn, getElapsed, showScorePanel);
  }

  function updateOriginalItem(idx, correct, newAns) {
    redo.updateOriginalItem(idx, correct, newAns);
  }

  function updateWrongItem(idx, correct, answer) {
    redo.updateWrongItem(idx, correct, answer);
  }

  // ========== 重新开始 ==========
  // renderFn(questions) — 重新渲染题目
  function resetAll(renderFn) {
    if (!confirm('\u786e\u5b9a\u8981\u91cd\u65b0\u5f00\u59cb\u5417\uff1f\u5f53\u524d\u4f5c\u7b54\u8bb0\u5f55\u5c06\u6e05\u7a7a\u3002')) return;

    exercises.forEach(function (q) { q.userAnswer = null; q.correct = null; if (q._redo) delete q._redo; });
    redo.resetState();
    reviewed = false;
    resetUIState();

    if (typeof renderFn === 'function') {
      renderFn(exercises);
    }

    // 清空输入
    exercises.forEach(function (q, i) {
      var info = getInputEls(q, i);
      if (info) {
        for (var k = 0; k < info.els.length; k++) {
          info.els[k].value = '';
        }
      }
    });

    var sb = document.getElementById('submitBtn');
    if (sb) sb.disabled = false;
    var sp = document.getElementById('scorePanel');
    if (sp) sp.classList.remove('show');
    startTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getInputEls(q, i) {
    var id = q._ansId || ('ans_' + (q.num || q.globalNum || i));
    return { els: [document.getElementById(id)].filter(Boolean) };
  }

  // ========== 打印 ==========
  function printFile() {
    if (exercises.length === 0) { alert('\u8bf7\u5148\u751f\u6210\u9898\u76ee\uff01'); return; }
    var title = document.getElementById('sheetTitle');
    var printConfig = config.printConfig || {};
    var cols = columns;

    // 从 radio 获取最新的列数
    var colRadio = document.querySelector('input[name="columns"]:checked');
    if (colRadio) cols = parseInt(colRadio.value) || 3;

    PracticeCore.printSheet('#questionsCard', title ? title.textContent : '', {
      pageType: printConfig.pageType || 'pinyin',
      columns: cols
    });
  }

  // ========== 公共 API ==========
  return {
    // 生命周期
    init: init,
    startPractice: startPractice,
    submitAnswers: submitAnswers,
    redoWrong: redoWrong,
    submitWrongCorrections: submitWrongCorrections,
    reviewAll: reviewAll,
    resetAll: resetAll,
    printFile: printFile,

    // 计时器
    startTimer: startTimer,
    stopTimer: stopTimer,
    getElapsed: getElapsed,

    // UI
    showScorePanel: showScorePanel,
    resetUIState: resetUIState,
    markQuestion: markQuestion,

    // 状态访问器
    getExercises: function () { return exercises; },
    getWrongIndices: function () { return redo.getWrongIndices(); },
    setWrongIndices: function (w) { redo.setWrongIndices(w); },
    getColumns: function () { return columns; },
    getCount: function () { return count; },

    // 配置
    getConfig: function () { return config; }
  };
})();
