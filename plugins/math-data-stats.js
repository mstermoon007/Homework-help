/**
 * plugins/math-data-stats.js — 数据收集与整理插件（二年级：投票统计/正字法/统计表；三年级：复式统计表）
 *
 * 题型：
 *   tally   —— 正字法统计：根据投票「正」字统计各候选人数并填统计表（multi）
 *   result  —— 统计结果问答：谁最多 / 谁最少 / 多几票 / 一共有几人投票（choice）
 *   compare —— 比较数量：最多比最少多几票、还差几票追平（text）
 *   multiTable —— 复式统计表（三年级）：阅读与填写复式统计表，回答谁多/谁少/相差、合计（multi + choice）
 *
 * 情境：选班长 / 选课外书 / 选运动 / 选水果等投票场景；三年级为读书、出游等活动的复式统计表。
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-data-stats.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.paramsFor 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-data-stats.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var dpLevel = 3;
  var _GRADE = 2;

  // 投票情境：候选人/选项 + 投票主题
  var SCENARIOS = [
    { title: '选班长', subject: '谁适合当班长', candidates: ['小明', '小红', '小华'] },
    { title: '选课外书', subject: '大家最喜欢看哪本课外书', candidates: ['《童话故事》', '《科学百科》', '《漫画大王》'] },
    { title: '选运动', subject: '大家最喜欢哪种运动', candidates: ['跳绳', '踢足球', '跑步'] },
    { title: '选水果', subject: '大家最喜欢吃哪种水果', candidates: ['苹果', '香蕉', '西瓜'] },
    { title: '选游戏', subject: '大家最喜欢玩哪种游戏', candidates: ['捉迷藏', '丢沙包', '老鹰捉小鸡'] }
  ];

  // 「正」字的 5 笔（模拟正字计数法的笔画标记）
  var ZHENG_STROKES = ['一', '丨', '一', '丿', '乀'];
  // 生成 n 的「正」字计数表示
  function zhengMarks(n) {
    var full = Math.floor(n / 5);
    var rest = n % 5;
    var s = '';
    for (var i = 0; i < full; i++) s += '正';
    for (var j = 0; j < rest; j++) s += ZHENG_STROKES[j];
    return s;
  }

  // 难度越高，投票人数越多
  function totalVoters() {
    if (dpLevel <= 4) return rnd(12, 18);
    if (dpLevel <= 6) return rnd(18, 26);
    if (dpLevel <= 8) return rnd(24, 32);
    return rnd(30, 40);
  }

  /** 生成一组投票数据：{ scenario, candidates, votes, total }，票数互不相同 */
  function makeVoteData() {
    var sc = pick(SCENARIOS);
    var total = totalVoters();
    var a = rnd(1, total - 3);
    var b = rnd(1, total - 2 - a);
    var c = total - a - b;
    // 确保互不相同
    if (a === b || a === c || b === c) return makeVoteData();
    var votes = shuffleArr([a, b, c]);
    return { scenario: sc, candidates: sc.candidates, votes: votes, total: total };
  }

  // ============ 题目生成 ============
  // 正字法统计：展示 3 人的「正」字票数，填统计表（multi）
  function buildTally() {
    var data = makeVoteData();
    var rows = data.candidates.map(function (name, idx) {
      return { name: name, count: data.votes[idx] };
    });
    // 渲染成表格行
    var html = '<table style="border-collapse:collapse;margin:6px auto;font-size:14px;">';
    html += '<tr><th class="stat-th">姓名</th><th class="stat-th">正字票数</th></tr>';
    rows.forEach(function (r) {
      html += '<tr><td style="border:1px solid var(--line-strong);padding:4px 10px;">' + r.name + '</td><td style="border:1px solid var(--line-strong);padding:4px 10px;font-size:18px;letter-spacing:2px;">' + zhengMarks(r.count) + '</td></tr>';
    });
    html += '<tr><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">合计</td><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">' + data.total + ' 票</td></tr>';
    html += '</table>';

    return {
      kind: 'tally',
      svg: html,
      scenario: data.scenario,
      rows: rows,
      question: '用「正」字法统计投票结果，数一数每人的票数填在横线上：',
      answer: rows.map(function (r) { return String(r.count); }),
      blanks: rows.map(function (r) { return r.name; }),
      inputType: 'multi'
    };
  }

  // 统计结果问答（choice）
  function buildResult() {
    var data = makeVoteData();
    var rows = data.candidates.map(function (name, idx) { return { name: name, count: data.votes[idx] }; });
    var sorted = rows.slice().sort(function (x, y) { return y.count - x.count; });
    var maxRow = sorted[0], minRow = sorted[sorted.length - 1];
    var diff = maxRow.count - minRow.count;
    var variant = rnd(1, 3);
    if (variant === 1) {
      return {
        kind: 'result',
        scenario: data.scenario,
        rows: rows,
        svg: renderVoteTable(rows, data.total),
        question: data.scenario.title + '，谁得票最多？',
        answer: maxRow.name,
        options: shuffleArr(data.candidates.slice()),
        inputType: 'choice'
      };
    }
    if (variant === 2) {
      return {
        kind: 'result',
        scenario: data.scenario,
        rows: rows,
        svg: renderVoteTable(rows, data.total),
        question: data.scenario.title + '，谁得票最少？',
        answer: minRow.name,
        options: shuffleArr(data.candidates.slice()),
        inputType: 'choice'
      };
    }
    return {
      kind: 'result',
      scenario: data.scenario,
      rows: rows,
      svg: renderVoteTable(rows, data.total),
      question: data.scenario.title + '，得票最多的比最少的多了几票？',
      answer: String(diff),
      options: shuffleArr([String(diff), String(diff + 1), String(Math.max(0, diff - 1))]),
      inputType: 'choice'
    };
  }

  // 投票表格渲染（用于 result 题型）
  function renderVoteTable(rows, total) {
    var html = '<table style="border-collapse:collapse;margin:6px auto;font-size:14px;">';
    html += '<tr><th class="stat-th">选项</th><th class="stat-th">得票</th></tr>';
    rows.forEach(function (r) {
      html += '<tr><td style="border:1px solid var(--line-strong);padding:4px 10px;">' + r.name + '</td><td style="border:1px solid var(--line-strong);padding:4px 10px;">' + r.count + '</td></tr>';
    });
    html += '<tr><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">合计</td><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">' + total + '</td></tr>';
    html += '</table>';
    return html;
  }

  // 比较数量（text）：最多比最少多几票 / 差几票追平
  function buildCompare() {
    var data = makeVoteData();
    var rows = data.candidates.map(function (name, idx) { return { name: name, count: data.votes[idx] }; });
    var sorted = rows.slice().sort(function (x, y) { return y.count - x.count; });
    var maxRow = sorted[0], minRow = sorted[sorted.length - 1];
    var diff = maxRow.count - minRow.count;
    var variant = rnd(1, 2);
    if (variant === 1) {
      return {
        kind: 'compare',
        rows: rows,
        svg: renderVoteTable(rows, data.total),
        question: data.scenario.title + '，得票最多的比最少的多了几票？',
        answer: String(diff),
        hint: '用最多的票数减去最少的票数。',
        inputType: 'text'
      };
    }
    // 差几票追平（最多者）
    var maxName = maxRow.name;
    return {
      kind: 'compare',
      rows: rows,
      svg: renderVoteTable(rows, data.total),
      question: data.scenario.title + '，' + maxName + '想再得到一票，现在最少的人还差几票才能和' + maxName + '一样多？',
      answer: String(diff),
      hint: '算出最多的和最少的相差几票。',
      inputType: 'text'
    };
  }

  // ============ 复式统计表（三年级） ============
  // 复式统计表场景：行 = 主分类（如「参加人数」的行），列 = 次分类（如「男生/女生」或四个班级）
  var MULTI_SCENARIOS = [
    { title: '读书活动', subj: '三（1）班同学最喜欢读的书（人数）', rows: ['男生', '女生'], cols: ['童话书', '科普书', '漫画书'] },
    { title: '春游地点投票', subj: '三（2）班春游地点投票（人数）', rows: ['男生', '女生'], cols: ['动物园', '植物园', '科技馆'] },
    { title: '运动会报名', subj: '三（3）班运动会报名人数（人）', rows: ['男生', '女生'], cols: ['跑步', '跳远', '跳绳'] },
    { title: '图书角统计', subj: '三（1）班图书角书籍数量（本）', rows: ['第一周', '第二周'], cols: ['故事书', '科技书', '绘本'] }
  ];

  // 随机生成行列数据（各值互不相同，便于「最大/最小/相差」计算唯一）
  function makeMultiData() {
    var sc = pick(MULTI_SCENARIOS);
    var R = sc.rows.length, C = sc.cols.length;
    var grid = [];
    var used = {};
    for (var r = 0; r < R; r++) {
      var row = [];
      for (var c = 0; c < C; c++) {
        var v = rnd(6, 20);
        // 保证整表数值互不重复，使最大/最小唯一
        var guard = 0;
        while (used[v] !== undefined && guard++ < 50) v = rnd(6, 20);
        used[v] = v;
        row.push(v);
      }
      grid.push(row);
    }
    return { sc: sc, grid: grid };
  }

  // 复式统计表热力/普通表格 HTML（miniCell=true 用于多空填写题显示小格子）
  function renderMultiTable(sc, grid, blanks) {
    var R = sc.rows.length, C = sc.cols.length;
    var html = '<table style="border-collapse:collapse;margin:6px auto;font-size:14px;">';
    // 表头第一行：占位 + 空 + 各列
    html += '<tr>';
    html += '<th rowspan="2" style="border:1px solid var(--line-strong);padding:4px 8px;background:var(--brand-bg);">' + (sc.rows.length > 1 ? '类别' : '') + '</th>';
    html += '<th rowspan="2" style="border:1px solid var(--line-strong);padding:4px 8px;background:var(--brand-bg);">人数</th>';
    sc.cols.forEach(function (cn, c) {
      html += '<th class="stat-th">' + cn + '</th>';
    });
    html += '</tr><tr>';
    sc.cols.forEach(function (cn, c) {
      html += '<th style="border:1px solid var(--line-strong);padding:2px 10px;color:var(--muted);font-weight:400;font-size:11px;">' + (c + 1) + '</th>';
    });
    html += '</tr>';
    // 数据行
    sc.rows.forEach(function (rn, r) {
      html += '<tr><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">' + rn + '</td><td style="border:1px solid var(--line-strong);padding:4px 10px;background:var(--soft-bg);">' + (r + 1) + '</td>';
      for (var c = 0; c < C; c++) {
        var val;
        if (blanks && blanks[r] !== undefined && blanks[r][c] !== undefined) val = blanks[r][c];
        else val = grid[r][c];
        html += '<td style="border:1px solid var(--line-strong);padding:4px 10px;">' + val + '</td>';
      }
      html += '</tr>';
    });
    html += '</table>';
    return html;
  }

  // 复式统计表生成：随机选择「填表（multi）」或「读表问答（choice）」
  function buildMultiTable() {
    var data = makeMultiData();
    var grid = data.grid, sc = data.sc;
    var R = sc.rows.length, C = sc.cols.length;
    // 计算每行合计与每列合计（便于出题）
    var shot = rnd(1, 2);
    var total = 0;
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) total += grid[r][c];

    if (shot === 1) {
      // 填表：隐藏 2~4 个格子，多空输入
      var hides = rnd(2, Math.min(C, 4));
      var hiddenPos = [];
      var hidSet = {};
      var guard = 0;
      while (hiddenPos.length < hides && guard++ < 60) {
        var rr = rnd(0, R - 1), rc = rnd(0, C - 1);
        if (!hidSet[rr + '-' + rc]) { hidSet[rr + '-' + rc] = true; hiddenPos.push([rr, rc]); }
      }
      var expected = hiddenPos.map(function (pos) { return String(grid[pos[0]][pos[1]]); });
      var blanksGrid = [];
      for (var i = 0; i < R; i++) blanksGrid.push([]);
      hiddenPos.forEach(function (pos) { blanksGrid[pos[0]][pos[1]] = '？'; });

      return {
        kind: 'multiTable',
        fill: true,
        rows: sc.rows, cols: sc.cols,
        svg: renderMultiTable(sc, grid, blanksGrid),
        question: sc.subj + '，观察统计表，把空缺的人数填在横线上：',
        blanks: hiddenPos.map(function (pos) { return sc.rows[pos[0]] + ' · ' + sc.cols[pos[1]]; }),
        answer: expected,
        hint: '从表格里找到对应的行和列，看已知的一行/一列推算出空缺。',
        inputType: 'multi'
      };
    }
    // 读表问答（choice）
    var flat = [];
    for (var r2 = 0; r2 < R; r2++) {
      for (var c2 = 0; c2 < C; c2++) flat.push({ r: r2, c: c2, v: grid[r2][c2] });
    }
    var sorted = flat.slice().sort(function (a, b) { return b.v - a.v; });
    var maxCell = sorted[0], minCell = sorted[sorted.length - 1];
    var variant = rnd(1, 4);
    var swapped = rnd(1, 2) === 1;
    var maxName = sc.rows[maxCell.r] + '（' + sc.cols[maxCell.c] + '）';
    var minName = sc.rows[minCell.r] + '（' + sc.cols[minCell.c] + '）';
    if (variant === 1) {
      return {
        kind: 'multiTable',
        rows: sc.rows, cols: sc.cols,
        svg: renderMultiTable(sc, grid),
        question: sc.subj + '，哪个类别的人数最多？',
        answer: maxName,
        options: shuffleArr(sc.rows.slice().map(function (rn, r) {
          var bestC = 0;
          for (var c = 0; c < C; c++) if (grid[r][c] > grid[r][bestC]) bestC = c;
          return rn + '（' + sc.cols[bestC] + '）';
        })),
        hint: '横向和纵向都看看，找最大的数。',
        inputType: 'choice'
      };
    }
    if (variant === 2) {
      return {
        kind: 'multiTable',
        rows: sc.rows, cols: sc.cols,
        svg: renderMultiTable(sc, grid),
        question: sc.subj + '，哪个类别的人数最少？',
        answer: minName,
        options: shuffleArr(sc.rows.slice().map(function (rn, r) {
          var bestC = 0;
          for (var c = 0; c < C; c++) if (grid[r][c] < grid[r][bestC]) bestC = c;
          return rn + '（' + sc.cols[bestC] + '）';
        })),
        hint: '找最小的数。',
        inputType: 'choice'
      };
    }
    if (variant === 3) {
      var diff = maxCell.v - minCell.v;
      return {
        kind: 'multiTable',
        rows: sc.rows, cols: sc.cols,
        svg: renderMultiTable(sc, grid),
        question: sc.subj + '，人数最多的比最少的多多少人？',
        answer: String(diff),
        options: shuffleArr([String(diff), String(diff + 1), String(Math.max(0, diff - 1))]),
        hint: '用最大的数减去最小的数。',
        inputType: 'choice'
      };
    }
    return {
      kind: 'multiTable',
      rows: sc.rows, cols: sc.cols,
      svg: renderMultiTable(sc, grid),
      question: sc.subj + '，一共有多少人参加？',
      answer: String(total),
      options: shuffleArr([String(total), String(total + 1), String(Math.max(0, total - 1))]),
      hint: '把表格里所有的数加起来。',
      inputType: 'choice'
    };
  }

  function buildMixed() {
    // 三年级：多出复式统计表
    var r = rnd(1, 100);
    if (_GRADE >= 3) {
      if (r <= 40) return buildTally();
      if (r <= 65) return buildResult();
      if (r <= 80) return buildCompare();
      return buildMultiTable();
    }
    if (r <= 45) return buildTally();
    if (r <= 75) return buildResult();
    return buildCompare();
  }

  function generateProblems(type, count) {
    var builder = { tally: buildTally, result: buildResult, compare: buildCompare, multiTable: buildMultiTable, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + (q.scenario ? q.scenario.title : '') + '|' + (q.answer ? (Array.isArray(q.answer) ? q.answer.join(',') : q.answer) : '') + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderStatCard(p, i) {
    var mid = '';
    if (p.kind === 'tally') {
      mid = '<div style="margin:4px 0;">' + p.svg + '</div>';
    } else {
      mid = '<div style="margin:4px 0;">' + p.svg + '</div>';
    }

    var inputHTML = '';
    if (p.inputType === 'multi') {
      var blanksHTML = '';
      p.blanks.forEach(function (label, j) {
        blanksHTML += '<input type="text" class="answer-inp" data-idx="' + i + '" data-field="' + j + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;margin:0 4px;">' + '<span style="font-size:12px;color:var(--muted);">' + label + '</span>';
      });
      inputHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:6px;flex-wrap:wrap;">' + blanksHTML + '</div>';
    } else if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 14px;font-size:15px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '<span class="unit">票</span>' +
        '</div>';
    }

    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div>' + p.question + '</div>' +
      mid +
      inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkStatQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'multi') {
      var expected = Array.isArray(q.answer) ? q.answer : [q.answer];
      for (var j = 0; j < expected.length; j++) {
        var key = idx + ':' + j;
        var ua = userAnswers && userAnswers[key] != null ? String(userAnswers[key]).trim() : '';
        if (String(ua) !== String(expected[j])) return false;
      }
      return true;
    }
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return _PU.normHZ(v) === _PU.normHZ(q.answer);
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(q.answer).replace(/\s/g, '');
  }

  // ============ ExercisePlugin ============
  var mathDataStatsPlugin = {
    id: 'math-data-stats',
    moduleId: 'M9',
    name: '数据收集与整理',
    grades: [2, 3],
    subject: 'math',
    category: 'statistics',
    knowledgePoints: {
      2: [
        'math-g2-m9-data-tally',
        'math-g2-m9-data-question'
      ]
    },
    printConfig: { pageType: 'dataStats' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'tally',   label: '正字法统计' },
          { value: 'result',  label: '统计结果问答' },
          { value: 'compare', label: '数量比较' },
          { value: 'multiTable', label: '复式统计表' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.paramsFor 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');

      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      _GRADE = opts.grade || 2;
      // 子题型 → 知识点（按年级区分；未映射的组合不标注，保持纯插件级统计）
      var KP_BY_GRADE_KIND = {
        2: { tally: 'math-g2-m9-data-tally', result: 'math-g2-m9-data-question', compare: 'math-g2-m9-data-question' },
        3: { multiTable: 'math-g3-m9-g3-stats-table', result: 'math-g3-m9-g3-stats-table', compare: 'math-g3-m9-g3-stats-table' }
      };
      var kpMap = KP_BY_GRADE_KIND[_GRADE] || null;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', tally: '正字法统计', result: '统计结果问答', compare: '数量比较', multiTable: '复式统计表' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var q = {
          type: 'data-stats',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          knowledgePointId: kpMap ? (kpMap[p.kind] || undefined) : undefined,
          hint: p.hint,
          render: function (idx, ctx) { return renderStatCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkStatQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学' + (_GRADE === 3 ? '三年级' : '二年级') + '数据收集与整理（' + label + '）' }
      };
    },

    render: function (exerciseSet) {
      var html = '';
      exerciseSet.questions.forEach(function (q, i) { html += q.render(i); });
      return html;
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkStatQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = total === 0 ? 0 : Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    },

    // 选项按钮点击（choice 题型）
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
  global.__currentPlugin = mathDataStatsPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathDataStatsPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
