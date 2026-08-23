// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c5.js — 五年级竞赛 C5 行程问题（新语义题型）
// 实现题型（type 与知识库一致）：
//   basic     基本行程（路程=速度×时间）
//   meet      相遇问题（路程和÷速度和）
//   chase     追及问题（路程差÷速度差，先定答案再反推）
//   train     火车过桥（总路程=桥长+车长）
//   boat      流水行船（顺水=船速+水速）
//   avg-speed 平均速度（调和平均，取可整除速度对）
// 设计要点：速度差不为 0、除法整除、答案唯一。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c5.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }
  function divisors(n) { var r = []; for (var i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; }

  // ============ 1. 基本行程 ============
  function genBasic() {
    var v = _PU.randInt(40, 120), t = _PU.randInt(5, 20), s = v * t;
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      return fillQ({ type: 'basic', text: '小明以每分钟 ' + v + ' 米的速度步行，走了 ' + t + ' 分钟。他一共走了 ____ 米。', answer: [s], hint: '路程 = 速度 × 时间 = ' + v + ' × ' + t });
    }
    if (mode === 1) {
      return fillQ({ type: 'basic', text: '一段路长 ' + s + ' 米，小明以每分钟 ' + v + ' 米的速度步行。走完这段路需要 ____ 分钟。', answer: [t], hint: '时间 = 路程 ÷ 速度 = ' + s + ' ÷ ' + v });
    }
    return fillQ({ type: 'basic', text: '一段路长 ' + s + ' 米，小明走了 ' + t + ' 分钟走完。他的速度是每分钟 ____ 米。', answer: [v], hint: '速度 = 路程 ÷ 时间 = ' + s + ' ÷ ' + t });
  }

  // ============ 2. 相遇问题 ============
  function genMeet() {
    var v1 = _PU.randInt(40, 100), v2 = _PU.randInt(40, 100);
    var time = _PU.randInt(3, 15), total = (v1 + v2) * time;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({ type: 'meet', text: '甲乙两人从相距 ' + total + ' 米的两地同时相向而行，甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。经过 ____ 分钟后两人相遇。', answer: [time], hint: '相遇时间 = ' + total + ' ÷ ' + (v1 + v2) + ' = ' + time });
    }
    return fillQ({ type: 'meet', text: '甲乙两人从两地同时相向而行，甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米，经过 ' + time + ' 分钟后相遇。两地相距 ____ 米。', answer: [total], hint: '总路程 = (' + v1 + '＋' + v2 + ')×' + time + ' = ' + total });
  }

  // ============ 3. 追及问题 ============
  function genChase() {
    var v2 = _PU.randInt(25, 80), t0 = _PU.randInt(2, 12);
    var gap = v2 * t0;                       // 路程差
    var ds = divisors(gap);
    var chaseTime = ds[Math.floor(ds.length / 2)] || 1;   // 取中位因数保证不太小/太大
    if (chaseTime > 30) chaseTime = ds[0] || 1;
    var diff = gap / chaseTime;              // 速度差
    var v1 = v2 + diff;
    return fillQ({
      type: 'chase',
      text: '乙以每分钟 ' + v2 + ' 米的速度先行，先出发 ' + t0 + ' 分钟后，甲以每分钟 ' + v1 + ' 米的速度从同一地点出发同向追赶。甲出发后 ____ 分钟追上乙。',
      answer: [chaseTime],
      hint: '追及时间 = 路程差 ÷ 速度差 = ' + gap + ' ÷ ' + diff + ' = ' + chaseTime
    });
  }

  // ============ 4. 火车过桥 ============
  function genTrain() {
    var trainLen = _PU.randInt(60, 180);
    var speed = _PU.randInt(10, 30);
    var bridgeLen = _PU.randInt(200, 500);
    var total = trainLen + bridgeLen;
    if (total % speed !== 0) bridgeLen = speed * Math.ceil(total / speed) - trainLen;
    var total2 = trainLen + bridgeLen;
    var time = total2 / speed;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({ type: 'train', text: '一列长 ' + trainLen + ' 米的火车以每秒 ' + speed + ' 米的速度通过一座长 ' + bridgeLen + ' 米的桥，从车头进入到车尾离开共需 ____ 秒。', answer: [time], hint: '总路程 = ' + bridgeLen + '＋' + trainLen + ' = ' + total2 + '；时间 = ' + total2 + ' ÷ ' + speed + ' = ' + time });
    }
    return fillQ({ type: 'train', text: '一列长 ' + trainLen + ' 米的火车以每秒 ' + speed + ' 米的速度通过一座桥，从车头进入到车尾离开用了 ' + time + ' 秒。这座桥长 ____ 米。', answer: [bridgeLen], hint: '桥长 = 总路程 − 车长 = ' + total2 + ' − ' + trainLen + ' = ' + bridgeLen });
  }

  // ============ 5. 流水行船 ============
  function genBoat() {
    var boat = _PU.randInt(10, 25), water = _PU.randInt(2, Math.floor(boat / 3));
    var down = boat + water, up = boat - water;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({ type: 'boat', text: '一艘船静水速度为每小时 ' + boat + ' 千米，水流速度为每小时 ' + water + ' 千米。顺水速度是 ____ 千米/时，逆水速度是 ____ 千米/时。（先填顺水，再填逆水）', answer: [down, up], hint: '顺水 = ' + boat + '＋' + water + ' = ' + down + '；逆水 = ' + boat + '−' + water + ' = ' + up });
    }
    return fillQ({ type: 'boat', text: '一艘船顺水速度是每小时 ' + down + ' 千米，逆水速度是每小时 ' + up + ' 千米。静水船速是 ____ 千米/时，水速是 ____ 千米/时。（先填船速，再填水速）', answer: [boat, water], hint: '船速 = (' + down + '＋' + up + ')÷2 = ' + boat + '；水速 = (' + down + '−' + up + ')÷2 = ' + water });
  }

  // ============ 6. 平均速度（调和平均，可整除速度对） ============
  var AVG_PAIRS = [[2, 6, 3], [3, 6, 4], [4, 12, 6], [5, 20, 8], [6, 12, 8], [8, 24, 12], [10, 15, 12], [12, 24, 16], [6, 30, 10], [10, 40, 16]];
  function genAvgSpeed() {
    var p = AVG_PAIRS[_PU.randInt(0, AVG_PAIRS.length - 1)];
    var v1 = p[0], v2 = p[1], ans = p[2];
    return fillQ({
      type: 'avg-speed',
      text: '一段路去时以每小时 ' + v1 + ' 千米的速度行驶，原路返回时以每小时 ' + v2 + ' 千米的速度行驶。往返全程的平均速度是每小时 ____ 千米。',
      answer: [ans],
      hint: '平均速度 = 2×' + v1 + '×' + v2 + '÷(' + v1 + '＋' + v2 + ') = ' + ans
    });
  }


  function genCircular() {
    var trackLen = _PU.randInt(200, 600), v1 = _PU.randInt(5, 15), v2 = _PU.randInt(2, v1 - 2);
    var t = trackLen / (v1 - v2);
    if (t !== Math.floor(t)) return genCircular();
    return fillQ({ type: 'circular',
      text: '环形跑道周长 ' + trackLen + ' 米，甲乙同地同向出发，甲每秒 ' + v1 + ' 米，乙每秒 ' + v2 + ' 米。甲多久第一次追上乙？',
      answer: [t], hint: '路程差=周长：' + trackLen + '/(' + v1 + '-' + v2 + ')=' + t + '秒'
    });
  }
  function genClock() {
    var h = _PU.randInt(1, 11), m = _PU.rand([0, 10, 20, 30, 40, 50]);
    var ha = (h % 12) * 30 + m * 0.5, ma = m * 6;
    var ang = Math.abs(ha - ma); if (ang > 180) ang = 360 - ang;
    if (ang % 1 !== 0) return genClock();
    return fillQ({ type: 'clock',
      text: h + ' 点 ' + m + ' 分时，时针与分针的夹角是多少度？',
      answer: [ang], hint: '时针=' + ha + '° 分针=' + ma + '° 夹角=' + ang + '°'
    });
  }
  function genRatio() {
    var a = _PU.randInt(2, 5), b = _PU.randInt(1, a - 1), k = _PU.randInt(3, 10);
    var total = (a + b) * k;
    return fillQ({ type: 'ratio',
      text: '甲乙两车速度比为 ' + a + ':' + b + '，同时从相距 ' + total + ' 千米的两地相向而行。相遇时甲车行驶了多少千米？',
      answer: [a * k], hint: '路程比=速度比=' + a + ':' + b + '，每份=' + k + ' → 甲行 ' + (a * k) + ' 千米'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['basic', 'meet', 'chase', 'train', 'boat', 'avg-speed', 'circular', 'clock', 'ratio'] : [type];
    var count = opts.count || 10;
    var genMap = { basic: genBasic, meet: genMeet, chase: genChase, train: genTrain, boat: genBoat, 'avg-speed': genAvgSpeed, circular: genCircular, clock: genClock, ratio: genRatio };
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
    id: 'math-competition-g5-c5',
    name: '行程问题（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5],
    moduleId: 'C5',
    knowledgePoints: {
      5: ['g5-c5-basic-motion', 'g5-c5-meet-problem', 'g5-c5-chase-problem',
          'g5-c5-train-bridge', 'g5-c5-boat-stream', 'g5-c5-average-speed']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',        label: '综合' },
        { value: 'basic',      label: '基本行程' },
        { value: 'meet',       label: '相遇问题' },
        { value: 'chase',      label: '追及问题' },
        { value: 'train',      label: '火车过桥' },
        { value: 'boat',       label: '流水行船' },
        { value: 'avg-speed',  label: '平均速度' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '行程问题（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
