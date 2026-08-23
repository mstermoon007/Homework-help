// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c5-journey.js — 竞赛 C5 行程问题
//
// 覆盖 C5 模块五个子题型（type 与 shared/knowledge-bank.js 四年级 C5 知识点一致）：
//   basic  基本行程（路程=速度×时间，已知两量求第三量）
//   meet   相遇问题（相向而行，相遇时间=总路程÷速度和）
//   chase  追及问题（同向追及，追及时间=路程差÷速度差）
//   train  火车过桥（过桥总路程=桥长+车长）
//   river  流水行船（顺水速度=船速+水速，逆水速度=船速-水速）
//
// 设计要点（竞赛题必须答案唯一）：所有子题型均为「先定答案再反推参数」，
// 保证除法整除、答案唯一；校验器从题面反解参数独立重算比对。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C5'、category:'number'、grades 与模块目录一致 [4,5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c5-journey.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 通用构造 ============
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

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { vmax: 120, tmax: 30, smax: 1200, lmax: 350 };
    if (lv >= 5) return { vmax: 80,  tmax: 20, smax: 800,  lmax: 280 };
    return { vmax: 80,  tmax: 20, smax: 600,  lmax: 250 };
  }

  // ============ 1. 基本行程 ============
  function genBasic(sc) {
    var v = _PU.randInt(30, sc.vmax);        // 速度 米/分
    var t = _PU.randInt(5, sc.tmax);          // 时间 分
    var s = v * t;                            // 路程 米
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 已知速度、时间求路程
      return fillQ({
        type: 'basic',
        text: '小明以每分钟 ' + v + ' 米的速度步行，走了 ' + t + ' 分钟。他一共走了 ____ 米。',
        answer: [s],
        hint: '路程 = 速度 × 时间 = ' + v + ' × ' + t
      });
    }
    if (mode === 1) {
      // 已知路程、速度求时间
      return fillQ({
        type: 'basic',
        text: '一段路长 ' + s + ' 米，小明以每分钟 ' + v + ' 米的速度步行。走完这段路需要 ____ 分钟。',
        answer: [t],
        hint: '时间 = 路程 ÷ 速度 = ' + s + ' ÷ ' + v
      });
    }
    // 已知路程、时间求速度
    return fillQ({
      type: 'basic',
      text: '一段路长 ' + s + ' 米，小明走了 ' + t + ' 分钟走完。他的速度是每分钟 ____ 米。',
      answer: [v],
      hint: '速度 = 路程 ÷ 时间 = ' + s + ' ÷ ' + t
    });
  }

  // ============ 2. 相遇问题 ============
  function genMeet(sc) {
    // 甲乙相向而行，相遇时间 = 总路程 ÷ (v1 + v2)
    var v1 = _PU.randInt(40, sc.vmax);
    var v2 = _PU.randInt(40, sc.vmax);
    var time = _PU.randInt(3, sc.tmax);       // 相遇时间
    var total = (v1 + v2) * time;             // 总路程（保证整除）
    if (total > sc.smax * 2) { time = Math.floor(sc.smax * 2 / (v1 + v2)); total = (v1 + v2) * time; }
    if (time < 2) return null;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 求相遇时间
      return fillQ({
        type: 'meet',
        text: '甲乙两人从相距 ' + total + ' 米的两地同时出发，相向而行。甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。经过 ____ 分钟后两人相遇。',
        answer: [time],
        hint: '相遇时间 = 总路程 ÷ 速度和 = ' + total + ' ÷ ' + (v1 + v2)
      });
    }
    // 求总路程
    return fillQ({
      type: 'meet',
      text: '甲乙两人从两地同时出发，相向而行。甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米，经过 ' + time + ' 分钟后两人相遇。两地相距 ____ 米。',
      answer: [total],
      hint: '总路程 = 速度和 × 相遇时间 = ' + (v1 + v2) + ' × ' + time
    });
  }

  // ============ 3. 追及问题 ============
  function genChase(sc) {
    // 甲追乙（甲快乙慢）：乙先出发 t0 分钟后甲开始追，追及时间 = 路程差 ÷ 速度差。
    // 构造策略（先定答案再反推，答案唯一且整除）：
    //   先定乙速 v2 与先走时间 t0（题干自然参数）→ 路程差 gap = v2 × t0；
    //   再在 gap 的因数中选追及时间 chaseTime（答案）→ 速度差 diff = gap ÷ chaseTime 自动整除。
    // 相比旧实现：参数空间显著扩大（v2×t0 直接枚举，chaseTime 从因数表挑选），
    // 几乎不再返回 null，重复率随之大幅下降。
    var v2 = _PU.randInt(25, Math.min(sc.vmax, 100));   // 乙速（较慢者）米/分
    var t0 = _PU.randInt(2, Math.min(sc.tmax, 20));     // 乙先出发时间 分
    var gap = v2 * t0;                                  // 路程差 米
    var maxCT = Math.min(sc.tmax, 25);                  // 追及时间上限（答案）
    var v1cap = Math.min(150, v2 + 90);                 // 甲速上限（避免速度差过大失真）
    var candidates = [];
    for (var ct = 2; ct <= maxCT; ct++) {
      if (gap % ct === 0) {
        var diff = gap / ct;
        if (v2 + diff <= v1cap) candidates.push(ct);
      }
    }
    if (candidates.length === 0) return null;           // 理论兜底，几乎不触发
    var chaseTime = _PU.rand(candidates);               // 追及时间（答案）
    var diff = gap / chaseTime;                         // 速度差（自动整除）
    var v1 = v2 + diff;                                 // 甲速
    var mode = _PU.randInt(0, 1);
    var phrasing = _PU.randInt(0, 1);
    if (mode === 0) {
      // 求追及时间
      return fillQ({
        type: 'chase',
        text: phrasing === 0
          ? '甲乙两人从同一地点出发。甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。乙先出发 ' + t0 + ' 分钟后甲才开始追赶。甲出发后经过 ____ 分钟追上乙。'
          : '甲乙两人从同一地点出发。甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。乙先出发 ' + t0 + ' 分钟后甲才开始追赶。甲需要 ____ 分钟才能追上乙。',
        answer: [chaseTime],
        hint: '追及时间 = 路程差 ÷ 速度差 = (' + v2 + ' × ' + t0 + ') ÷ ' + diff
      });
    }
    // 求路程差
    return fillQ({
      type: 'chase',
      text: phrasing === 0
        ? '甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。乙先出发 ' + t0 + ' 分钟后甲才开始追赶，甲出发后经过 ' + chaseTime + ' 分钟追上乙。甲出发时乙在甲前方 ____ 米。'
        : '甲每分钟走 ' + v1 + ' 米，乙每分钟走 ' + v2 + ' 米。乙先出发 ' + t0 + ' 分钟后甲才开始追赶，甲出发后经过 ' + chaseTime + ' 分钟追上乙。甲出发时乙已经走了 ____ 米。',
      answer: [gap],
      hint: '路程差 = 乙速 × 乙先走时间 = ' + v2 + ' × ' + t0
    });
  }

  // ============ 4. 火车过桥 ============
  function genTrain(sc) {
    // 先定速度和时间，反推总路程（保证整除），再拆为车长+桥长
    var speed = _PU.randInt(10, Math.max(12, Math.floor(sc.vmax / 2))); // 车速 米/秒
    var time = _PU.randInt(5, 40);            // 过桥时间 秒
    var totalDist = speed * time;            // 总路程 = 车长 + 桥长
    var trainLen = _PU.randInt(50, Math.min(sc.lmax, totalDist - 100));
    var bridgeLen = totalDist - trainLen;
    if (bridgeLen < 50 || trainLen < 50) return null;
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 求过桥时间
      return fillQ({
        type: 'train',
        text: '一列长 ' + trainLen + ' 米的火车以每秒 ' + speed + ' 米的速度通过一座长 ' + bridgeLen + ' 米的桥。从车头进入桥面到车尾离开桥面共需 ____ 秒。',
        answer: [time],
        hint: '过桥总路程 = 桥长 + 车长 = ' + bridgeLen + ' + ' + trainLen + ' = ' + totalDist + '；时间 = ' + totalDist + ' ÷ ' + speed
      });
    }
    // 求桥长
    return fillQ({
      type: 'train',
      text: '一列长 ' + trainLen + ' 米的火车以每秒 ' + speed + ' 米的速度通过一座桥，从车头进入桥面到车尾离开桥面共用了 ' + time + ' 秒。这座桥长 ____ 米。',
      answer: [bridgeLen],
      hint: '过桥总路程 = 速度 × 时间 = ' + speed + ' × ' + time + ' = ' + totalDist + '；桥长 = ' + totalDist + ' - ' + trainLen
    });
  }

  // ============ 5. 流水行船 ============
  function genRiver(sc) {
    // 顺水速 = 船速 + 水速；逆水速 = 船速 - 水速
    var boatSpeed = _PU.randInt(15, sc.vmax);  // 静水船速 千米/时
    var waterSpeed = _PU.randInt(2, Math.min(15, boatSpeed - 3)); // 水速
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 已知船速、水速求顺逆水速
      return fillQ({
        type: 'river',
        text: '一艘船在静水中的速度是 ' + boatSpeed + ' 千米/时，水流速度是 ' + waterSpeed + ' 千米/时。这艘船的顺水速度是 ____ 千米/时，逆水速度是 ____ 千米/时。（先填顺水速度，再填逆水速度）',
        answer: [boatSpeed + waterSpeed, boatSpeed - waterSpeed],
        hint: '顺水速度 = 船速 + 水速；逆水速度 = 船速 - 水速'
      });
    }
    // 已知顺水速、逆水速求船速和水速
    var downstream = boatSpeed + waterSpeed;
    var upstream = boatSpeed - waterSpeed;
    return fillQ({
      type: 'river',
      text: '一艘船顺水航行速度是 ' + downstream + ' 千米/时，逆水航行速度是 ' + upstream + ' 千米/时。这艘船在静水中的速度是 ____ 千米/时，水流速度是 ____ 千米/时。（先填静水船速，再填水速）',
      answer: [boatSpeed, waterSpeed],
      hint: '船速 = (顺水速 + 逆水速) ÷ 2；水速 = (顺水速 - 逆水速) ÷ 2'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['basic', 'meet', 'chase', 'train', 'river']
      : [type];
    var count = opts.count || 10;
    var genMap = { basic: genBasic, meet: genMeet, chase: genChase, train: genTrain, river: genRiver };
    var questions = [];
    var seen = {};
    var MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      // 同一题型反复重试（生成失败或撞题均重来），不再静默换成其它题型；
      // 子生成器返回 null 的情况已几乎消除，撞题也由更大参数空间大幅缓解。
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key](sc);
        if (q && !seen[q.q]) break;
      }
      // 理论兜底（所有子生成器当前均极少返回 null；genBasic 恒不返回 null）
      if (!q || seen[q.q]) q = genBasic(sc);
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-c5-journey',
    name: '行程问题',
    subject: 'math',
    category: 'number',
    grades: [4],
    moduleIds: ['C5'],
    knowledgePoints: {
      4: ['g4-c5-c5-basic', 'g4-c5-c5-meet', 'g4-c5-c5-chase', 'g4-c5-c5-train', 'g4-c5-c5-river'],
      6: ['g6-c5-c5-basic', 'g6-c5-c5-meet', 'g6-c5-c5-chase', 'g6-c5-c5-train', 'g6-c5-c5-river']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',      label: '综合' },
        { value: 'basic',    label: '基本行程' },
        { value: 'meet',     label: '相遇问题' },
        { value: 'chase',    label: '追及问题' },
        { value: 'train',    label: '火车过桥' },
        { value: 'river',    label: '流水行船' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 4,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '行程问题'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
