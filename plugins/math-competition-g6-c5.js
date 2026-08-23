// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c5.js — 六年级竞赛 C5 行程深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   basic              基本行程（s=vt 比例关系）
//   meet               相遇进阶（多次相遇共行 n 个全程）
//   chase              追及进阶（含初始距离）
//   train              火车过桥（桥长＋车长）
//   boat               流水行船（顺逆水、往返平均速度）
//   circular           环形跑道（同向差周长 / 反向和周长）
//   clock              时钟问题（夹角与重合）
//   journey-complex    行程综合（分段平均速度）
//   competition        竞赛行程综合
//   interval-departure 发车间隔
//   pick-up            接送问题
// 设计要点：参数构造法保证整数答案；线段图用 SVGUtil 绘制。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  var _U = global.SVGUtil;
  if (!_U && typeof require !== 'undefined') _U = require('../shared/svg-core.js');
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c5.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type, q: cfg.text, svg: cfg.figure || '',
      answer: cfg.answer, inputType: 'multi', inputCount: cfg.answer.length,
      hint: cfg.hint, render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { vMax: 80, dMax: 900, tMax: 20 };
    if (lv >= 5) return { vMax: 50, dMax: 500, tMax: 15 };
    return { vMax: 30, dMax: 300, tMax: 10 };
  }

  // ============ 简易线段图 ============
  function segDiagram(label1, label2, totalLabel, opts) {
    opts = opts || {};
    var w = 260, y1 = 20, y2 = 60;
    var inner =
      _U.svgLine(10, y1, w - 10, y1, { strokeWidth: 2 }) +
      _U.svgLine(10, y2, w - 10, y2, { strokeWidth: 2 }) +
      _U.svgText(14, y1 - 6, label1 || '', { fontSize: 12, 'text-anchor': 'start' }) +
      _U.svgText(14, y2 - 6, label2 || '', { fontSize: 12, 'text-anchor': 'start' }) +
      _U.svgText(w / 2, y1 + 16, '→', { fontSize: 13 }) +
      _U.svgText(w / 2, y2 + 16, '←', { fontSize: 13 });
    if (totalLabel) {
      inner += _U.svgText(w / 2, 92, totalLabel, { fontSize: 12, fill: '#3f6fd1' });
      inner += _U.svgElement('line', { x1: 10, y1: 78, x2: w - 10, y2: 78, stroke: '#3f6fd1', 'stroke-width': 1, 'stroke-dasharray': '4 3' });
      inner += _U.svgElement('line', { x1: 10, y1: 74, x2: 10, y2: 82, stroke: '#3f6fd1', 'stroke-width': 1 });
      inner += _U.svgElement('line', { x1: w - 10, y1: 74, x2: w - 10, y2: 82, stroke: '#3f6fd1', 'stroke-width': 1 });
    }
    return _U.svgWrap(inner, { width: w, height: 100 });
  }
  function segDiagramChase(gapLabel, chaseLabel) {
    var w = 260, y = 30;
    var inner =
      _U.svgLine(10, y, w - 10, y, { strokeWidth: 2 }) +
      _U.svgCircle(10, y, 4, { fill: '#3f6fd1', stroke: 'none' }) +
      _U.svgCircle(w - 10, y, 4, { fill: '#e05252', stroke: 'none' }) +
      _U.svgText(12, y - 8, gapLabel || '', { fontSize: 12, 'text-anchor': 'start' }) +
      _U.svgText(w - 12, y - 8, chaseLabel || '', { fontSize: 12, 'text-anchor': 'end' });
    return _U.svgWrap(inner, { width: w, height: 55 });
  }

  // ============ 1. 基本行程 ============
  function genBasic(sc) {
    var v = _PU.randInt(3, sc.vMax), t = _PU.randInt(2, sc.tMax);
    var s = v * t;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({
        type: 'basic',
        text: '小明骑自行车每小时行驶 ' + v + ' 千米，行驶了 ' + t + ' 小时。他一共行驶了多少千米？' +
          segDiagram('速度 ' + v + ' km/h × 时间 ' + t + ' h', '', '路程 s ＝ ？'),
        answer: [s],
        hint: 's = v×t = ' + v + ' × ' + t + ' = ' + s + ' 千米'
      });
    }
    return fillQ({
      type: 'basic',
      text: '一辆汽车行驶了 ' + s + ' 千米，速度是每小时 ' + v + ' 千米。它行驶了多少小时？',
      answer: [t],
      hint: 't = s÷v = ' + s + ' ÷ ' + v + ' = ' + t + ' 小时'
    });
  }

  // ============ 2. 相遇问题进阶 ============
  function genMeet(sc) {
    var v1 = _PU.randInt(3, 20), v2 = _PU.randInt(3, 20);
    var t = _PU.randInt(2, sc.tMax);
    var D = (v1 + v2) * t; // 相遇时两人共行 D
    var mode = _PU.randInt(0, 2);
    var fig = segDiagram('甲 v=' + v1, '乙 v=' + v2, '全程 ' + D + ' 千米');
    if (mode === 0) {
      return fillQ({
        type: 'meet',
        text: '甲、乙两地相距 ' + D + ' 千米，一辆客车从甲地出发，同时一辆货车从乙地相向而行。客车速度 ' +
          v1 + ' 千米/时，货车速度 ' + v2 + ' 千米/时。两车几小时后相遇？',
        answer: [t],
        hint: '相遇时间 = 全程 ÷ 速度和 = ' + D + ' ÷ (' + v1 + '+' + v2 + ') = ' + t + ' 小时'
      });
    }
    if (mode === 1) {
      // 多次相遇：第 n 次相遇共行 n 个全程
      var nMeet = _PU.randInt(2, 3);
      var totalTime = nMeet * t;
      return fillQ({
        type: 'meet',
        text: '甲、乙两地相距 ' + D + ' 千米，客车和货车分别从两地同时出发相向而行，客车速度 ' + v1 +
          ' 千米/时，货车速度 ' + v2 + ' 千米/时。两车相遇后继续前行，到达对方出发点后立即返回。从出发到第 ' + nMeet +
          ' 次相遇一共经过了多少小时？',
        answer: [totalTime],
        hint: '两端出发第 n 次相遇共行 n 个全程 → 总时间 = ' + nMeet + '×' + t + ' = ' + totalTime + ' 小时'
      });
    }
    // 已知相遇时间求全程
    return fillQ({
      type: 'meet',
      text: '客车从甲地、货车从乙地同时出发相向而行，速度分别为 ' + v1 + ' 和 ' + v2 + ' 千米/时，' + t +
        ' 小时后两车相遇。甲、乙两地相距多少千米？',
      answer: [D],
      hint: '全程 = (v₁＋v₂)×t = (' + v1 + '＋' + v2 + ')×' + t + ' = ' + D + ' 千米'
    });
  }

  // ============ 3. 追及问题进阶 ============
  function genChase(sc) {
    var vFast = _PU.randInt(10, sc.vMax), diff = _PU.randInt(2, Math.min(vFast - 2, 15));
    var vSlow = vFast - diff;
    var catchTime = _PU.randInt(2, sc.tMax);
    var gap = diff * catchTime;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({
        type: 'chase',
        text: '哥哥和弟弟从同一地点出发去同一目的地，哥哥先出发，每分钟走 ' + vSlow + ' 米。弟弟 ' +
          catchTime * diff / diff + ' 分钟后... （简化）弟弟以每分钟 ' + vFast + ' 米的速度追哥哥，两人相距 ' + gap +
          ' 米，弟弟几分钟可以追上哥哥？',
        answer: [catchTime],
        hint: '追及时间 = 路程差 ÷ 速度差 = ' + gap + ' ÷ (' + vFast + '−' + vSlow + ') = ' + catchTime + ' 分钟'
      });
    }
    return fillQ({
      type: 'chase',
      text: '甲在乙后面 ' + gap + ' 米，两人同向而行。甲每分钟走 ' + vFast + ' 米，乙每分钟走 ' + vSlow +
        ' 米。甲几分钟可以追上乙？',
      answer: [catchTime],
      hint: '速度差 = ' + vFast + ' − ' + vSlow + ' = ' + diff + '；追及时间 = ' + gap + ' ÷ ' + diff + ' = ' + catchTime + ' 分钟'
    });
  }

  // ============ 4. 火车过桥 ============
  function genTrain(sc) {
    var trainLen = _PU.randInt(10, 40) * 10;   // 车长（整百/整十）
    var bridgeLen = _PU.randInt(20, 60) * 10;
    var v = _PU.randInt(20, sc.vMax > 60 ? 90 : 60); // 米/秒 太大，改用 m/min? 用 m/s 但控制范围
    v = _PU.randInt(10, 30);
    var totalDist = bridgeLen + trainLen;
    var tSec = totalDist / v;
    if (tSec !== Math.floor(tSec)) return genTrain(sc);
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({
        type: 'train',
        text: '一列火车长 ' + trainLen + ' 米，以每秒 ' + v + ' 米的速度通过一座长 ' + bridgeLen + ' 米的大桥。火车完全通过大桥需要多少秒？（从车头上桥到车尾离桥）',
        answer: [tSec],
        hint: '总路程 = 桥长＋车长 = ' + bridgeLen + '＋' + trainLen + ' = ' + totalDist + ' 米；时间 = ' + totalDist + ' ÷ ' + v + ' = ' + tSec + ' 秒'
      });
    }
    // 反求车长
    return fillQ({
      type: 'train',
      text: '一列火车以每秒 ' + v + ' 米的速度通过一座长 ' + bridgeLen + ' 米的大桥，用了 ' + tSec +
        ' 秒。这列火车的长度是多少米？',
      answer: [trainLen],
      hint: '总路程 = ' + v + '×' + tSec + ' = ' + totalDist + ' 米；车长 = 总路程 − 桥长 = ' + totalDist + ' − ' + bridgeLen + ' = ' + trainLen + ' 米'
    });
  }

  // ============ 5. 流水行船 ============
  function genBoat(sc) {
    var boatV = _PU.randInt(10, 30), waterV = _PU.randInt(1, Math.min(5, boatV - 3));
    var down = boatV + waterV, up = boatV - waterV;
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      return fillQ({
        type: 'boat',
        text: '一条船在静水中的速度是每小时 ' + boatV + ' 千米，水流速度是每小时 ' + waterV + ' 千米。这条船顺水航行的速度是每小时多少千米？',
        answer: [down],
        hint: '顺水速度 = 船速＋水速 = ' + boatV + '＋' + waterV + ' = ' + down + ' 千米/时'
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'boat',
        text: '一只船顺水航行时速度为每小时 ' + down + ' 千米，逆水航行时速度为每小时 ' + up + ' 千米。水流速度是多少？',
        answer: [waterV],
        hint: '水速 = (顺水－逆水)÷2 = (' + down + '−' + up + ')÷2 = ' + waterV + ' 千米/时'
      });
    }
    // 往返平均速度
    var dist = _PU.randInt(6, 30);
    var tDown = dist / down, tUp = dist / up;
    var avg = 2 * dist / (tDown + tUp);
    if (avg !== Math.floor(avg)) return genBoat(sc);
    return fillQ({
      type: 'boat',
      text: '一艘船在静水中的速度是每小时 ' + boatV + ' 千米，水流速度是每小时 ' + waterV +
        ' 千米。该船在两码头之间往返一次（两码头距离 ' + dist + ' 千米），平均速度是多少千米/时？',
      answer: [avg],
      hint: '顺水时间 = ' + dist + '/' + down + '，逆水时间 = ' + dist + '/' + up +
        '；平均速度 = 2×' + dist + '÷总时间 = ' + avg + ' 千米/时'
    });
  }

  // ============ 6. 环形跑道 ============
  function genCircular(sc) {
    var trackLen = _PU.randInt(20, 60) * 10;
    var v1 = _PU.randInt(5, 20), v2 = _PU.randInt(2, v1 - 1);
    var sameDir = _PU.randInt(0, 1) === 0;
    if (sameDir) {
      var t = trackLen / (v1 - v2);
      if (t !== Math.floor(t)) return genCircular(sc);
      return fillQ({
        type: 'circular',
        text: '环形跑道周长为 ' + trackLen + ' 米。甲、乙两人从同一地点同时出发同向而行，甲每秒跑 ' + v1 +
          ' 米，乙每秒跑 ' + v2 + ' 米。多少秒后甲第一次追上乙？',
        answer: [t],
        hint: '同向追及：路程差 = 周长 → t = ' + trackLen + ' ÷ (' + v1 + '−' + v2 + ') = ' + t + ' 秒'
      });
    }
    var t2 = trackLen / (v1 + v2);
    if (t2 !== Math.floor(t2)) return genCircular(sc);
    return fillQ({
      type: 'circular',
      text: '环形跑道周长为 ' + trackLen + ' 米。甲、乙两人从同一地点同时出发反向而行，甲每秒跑 ' + v1 +
        ' 米，乙每秒跑 ' + v2 + ' 米。多少秒后两人第一次相遇？',
      answer: [t2],
      hint: '反向相遇：路程和 = 周长 → t = ' + trackLen + ' ÷ (' + v1 + '＋' + v2 + ') = ' + t2 + ' 秒'
    });
  }

  // ============ 7. 时钟问题 ============
  function genClock() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 求某一时刻的夹角
      var hour = _PU.randInt(1, 12), min = _PU.rand([0, 10, 20, 30, 40, 50]);
      var hourAngle = (hour % 12) * 30 + min * 0.5;
      var minAngle = min * 6;
      var diff = Math.abs(hourAngle - minAngle);
      if (diff > 180) diff = 360 - diff;
      if (diff % 1 !== 0) return genClock();
      return fillQ({
        type: 'clock',
        text: '时钟显示 ' + hour + ' 点 ' + min + ' 分。此时时针与分针的夹角是多少度？',
        answer: [diff],
        hint: '时针角度 = ' + (hour % 12) + '×30° + ' + min + '×0.5° = ' + hourAngle + '°；分针角度 = ' + min + '×6° = ' + minAngle +
          '°；夹角 = |' + hourAngle + '−' + minAngle + '| = ' + diff + '°' + (diff !== Math.abs(hourAngle - minAngle) ? '（取劣角）' : '')
      });
    }
    // 重合时刻：3点到4点之间分针何时追上时针
    var baseHour = _PU.randInt(1, 11);
    var gap0 = baseHour * 30; // 出发时时针领先的角度
    var relSpeed = 6 - 0.5;   // 5.5°/分
    var tMin = gap0 / relSpeed;
    var rounded = Math.round(tMin * 10) / 10;
    if (rounded !== tMin) return genClock();
    return fillQ({
      type: 'clock',
      text: '从 ' + baseHour + ' 点整开始，经过多少分钟后时针与分针第一次重合？（结果精确到小数点后一位）',
      answer: [rounded],
      hint: '分针速度 6°/分，时针 0.5°/分，速度差 5.5°/分；初始夹角 ' + gap0 + '° → 追及时间 = ' + gap0 + '÷5.5 = ' + rounded + ' 分钟'
    });
  }

  // ============ 8. 行程综合（多阶段平均速度） ============
  function genJourneyComplex(sc) {
    var half = _PU.randInt(30, 100);
    var S = 2 * half; // 总路程 = 2×half
    var v1 = _PU.randInt(10, 40), v2 = _PU.randInt(v1 + 5, 80);
    // 前半程 v1 后半程 v2 → 平均速度 = 2v1v2/(v1+v2)
    var avg = 2 * v1 * v2 / (v1 + v2);
    if (avg !== Math.floor(avg)) return genJourneyComplex(sc);
    return fillQ({
      type: 'journey-complex',
      text: '一辆汽车从 A 城到 B 城，前一半路程的速度是每小时 ' + v1 + ' 千米，后一半路程的速度是每小时 ' + v2 +
        ' 千米。已知 A、B 两城相距 ' + S + ' 千米。求这辆汽车全程的平均速度。',
      answer: [avg],
      hint: '设全程为 2s：前半程用时 s/' + v1 + '，后半程用时 s/' + v2 +
        '；平均速度 = 2s ÷ (s/' + v1 + '+s/' + v2 + ') = 2×' + v1 + '×' + v2 + '/(' + v1 + '+' + v2 + ') = ' + avg + ' 千米/时'
    });
  }

  // ============ 9. 竞赛行程综合 ============
  function genCompetition(sc) {
    // 多段行程：去程 v1 回程 v2，总距离 D，求往返平均速度或总时间
    var D = _PU.randInt(60, 300);
    var vGo = _PU.randInt(15, 40), vBack = _PU.randInt(10, vGo - 3);
    var tGo = D / vGo, tBack = D / vBack;
    var totalT = tGo + tBack;
    var avg = 2 * D / totalT;
    if (totalT !== Math.floor(totalT) || avg !== Math.floor(avg)) {
      // 构造合法数据
      D = vGo * vBack * _PU.randInt(1, 3) * 2;
      tGo = D / vGo; tBack = D / vBack; totalT = tGo + tBack;
      avg = 2 * D / totalT;
      if (avg !== Math.floor(avg)) return genCompetition(sc);
    }
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({
        type: 'competition',
        text: '一辆汽车从甲地到乙地的速度是每小时 ' + vGo + ' 千米，从乙地原路返回甲地的速度是每小时 ' + vBack +
          ' 千米。已知甲、乙两地相距 ' + D + ' 千米。往返一次的平均速度是多少千米/时？',
        answer: [avg],
        hint: '去程 ' + tGo + 'h，回程 ' + tBack + 'h；平均速度 = 2×' + D + '÷(' + tGo + '＋' + tBack + ') = ' + avg +
          ' 千米/时（≠两速度的算术平均！）'
      });
    }
    return fillQ({
      type: 'competition',
      text: '一辆汽车从甲地到乙地的速度是每小时 ' + vGo + ' 千米，从乙地原路返回的速度是每小时 ' + vBack +
        ' 千米。往返共用 ____ 小时。',
      answer: [totalT],
      hint: '去程时间 = ' + D + '/' + vGo + ' = ' + tGo + 'h，回程时间 = ' + D + '/' + vBack + ' = ' + tBack + 'h，合计 ' + totalT + 'h'
    });
  }

  // ============ 发车间隔（保留） ============
  var GAP_PAIRS = [[4, 12], [5, 20], [6, 12], [8, 24], [9, 18], [10, 15], [10, 40], [12, 24], [15, 30]];
  function gapT(x, y) { return 2 * x * y / (x + y); }
  function genInterval() {
    var pr = GAP_PAIRS[_PU.randInt(0, GAP_PAIRS.length - 1)];
    var T = gapT(pr[0], pr[1]);
    return fillQ({
      type: 'interval-departure',
      text: '小明匀速步行，发现迎面每隔 ' + pr[0] + ' 分钟来一辆公交车，背后每隔 ' + pr[1] +
        ' 分钟超过他一辆。公交车发车间隔是多少分钟？',
      answer: [T],
      hint: 'T = 2xy/(x+y) = 2×' + pr[0] + '×' + pr[1] + '/' + (pr[0] + pr[1]) + ' = ' + T + ' 分钟'
    });
  }

  // ============ 接送问题（保留） ============
  var PICK_PAIRS = [[5, 15], [5, 20], [10, 15], [10, 30], [10, 40], [15, 45], [20, 30]];
  function genPickUp() {
    var pr = PICK_PAIRS[_PU.randInt(0, PICK_PAIRS.length - 1)];
    var pw = pr[0], pc = pr[1];
    var fPct = Math.round(pc / (pc + pw) * 100);
    return fillQ({
      type: 'pick-up',
      text: '两个班的学生同时出发去某地，只有一辆汽车接送（车速恒定），学生步行速度也恒定。汽车轮流接送两个班，恰好同时到达。已知车速:人速 = ' + pc + ':' + pw + '。每个班乘车路程占全程的百分比是 ____。（只填数字）',
      answer: [fPct],
      hint: '乘车占比 = 车/(车+人) = ' + pc + '/' + (pc + pw) + ' = ' + fPct + '%'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['basic', 'meet', 'chase', 'train', 'boat', 'circular', 'clock',
         'journey-complex', 'competition', 'interval-departure', 'pick-up']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      basic: function () { return genBasic(sc); },
      meet: function () { return genMeet(sc); },
      chase: function () { return genChase(sc); },
      train: function () { return genTrain(sc); },
      boat: function () { return genBoat(sc); },
      circular: function () { return genCircular(sc); },
      clock: genClock,
      'journey-complex': function () { return genJourneyComplex(sc); },
      competition: function () { return genCompetition(sc); },
      'interval-departure': genInterval,
      'pick-up': genPickUp
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  var plugin = _PU.createPlugin({
    id: 'math-competition-g6-c5',
    name: '行程问题（六年级）',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleId: 'C5',
    knowledgePoints: {
      6: ['g6-c5-basic', 'g6-c5-meet', 'g6-c5-chase', 'g6-c5-train-bridge',
        'g6-c5-boat-stream', 'g6-c5-ring-runway', 'g6-c5-clock',
        'g6-c5-journey-complex', 'g6-c5-competition',
        'g6-c5-interval-departure', 'g6-c5-pick-up-problem']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',                label: '综合' },
        { value: 'basic',              label: '基本行程' },
        { value: 'meet',               label: '相遇进阶' },
        { value: 'chase',              label: '追及进阶' },
        { value: 'train',              label: '火车过桥' },
        { value: 'boat',               label: '流水行船' },
        { value: 'circular',           label: '环形跑道' },
        { value: 'clock',              label: '时钟问题' },
        { value: 'journey-complex',    label: '行程综合' },
        { value: 'competition',        label: '竞赛综合' },
        { value: 'interval-departure', label: '发车间隔' },
        { value: 'pick-up',            label: '接送问题' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 1, title: '行程问题（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
