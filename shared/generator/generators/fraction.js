/**
 * shared/generator/generators/fraction.js — P25-09 分数专项 Generator
 *
 * 承载 20 个分数 KP（g3 初步认识 → g5 意义/性质/加减 → g6 倒数/除法/混合），
 * 取代被 shape-recognition v3 截胡产出的语义无关题。
 *
 * 分派：消费 plan.semanticParams.name，按 NAME_RULES 机械派生子类型。
 * 题型：calc / fill / choice / apply。calc 题干内嵌算式满足 expressionPresent。
 */
'use strict';

var Rng = require('../core/rng.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':frac:' + i;
  if (plan && plan.seed != null) return plan.seed + ':frac:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':frac:' + i;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
function simp(n, d) { var g = gcd(n, d); return { n: n / g, d: d / g }; }
function fs(f) { return f.n + '/' + f.d; }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// 顺序敏感
var NAME_RULES = [
  { sub: 'word', re: /解决问题/ },
  { sub: 'reciprocal', re: /倒数/ },
  { sub: 'div', re: /除以|除法/ },
  { sub: 'mix', re: /混合/ },
  { sub: 'addsub-diff', re: /异分母/ },
  { sub: 'addsub', re: /加|减|简单计算/ },
  { sub: 'compare', re: /比较|比大小/ },
  { sub: 'relation', re: /与除法|除法.*关系/ },
  { sub: 'proper', re: /真分数|假分数/ },
  { sub: 'nature', re: /性质|约分|通分|互化/ },
  { sub: 'meaning', re: /读写|认识|意义/ }
];

function deriveSubtype(name) {
  for (var i = 0; i < NAME_RULES.length; i++) {
    if (NAME_RULES[i].re.test(name || '')) return NAME_RULES[i].sub;
  }
  return 'meaning';
}

/* ------------------------------------------------------------------ *
 * 分数运算结构
 * ------------------------------------------------------------------ */

function diffDenomAdd(rng) {
  var d1 = pick(rng, [2, 3, 4, 6]), d2 = pick(rng, [3, 5, 4, 6].filter(function (x) { return x !== d1; }));
  var n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
  var lcm = d1 * d2 / gcd(d1, d2);
  var num = n1 * (lcm / d1) + n2 * (lcm / d2);
  return { d1: d1, d2: d2, n1: n1, n2: n2, lcm: lcm,
    expr: n1 + '/' + d1 + ' + ' + n2 + '/' + d2, ans: simp(num, lcm) };
}

function fracDiv(rng) {
  var n1 = ri(rng, 1, 5), d1 = ri(rng, 2, 8);
  var n2 = ri(rng, 1, 5), d2 = ri(rng, 2, 8);
  return { n1: n1, d1: d1, n2: n2, d2: d2,
    expr: n1 + '/' + d1 + ' ÷ ' + n2 + '/' + d2, ans: simp(n1 * d2, d1 * n2) };
}

function fracDivInt(rng) {
  var d = ri(rng, 2, 8), n = ri(rng, 1, d - 1), k = ri(rng, 2, 6);
  return { n: n, d: d, k: k,
    expr: n + '/' + d + ' ÷ ' + k, ans: simp(n, d * k) };
}

/* ------------------------------------------------------------------ *
 * P30-GEN-06（P30-16）：子类型 × 题型 Assessment Target 真分工
 *
 *   calc   —— 列式计算/列式转换（算式在场，直接求结果）
 *   fill   —— 结构性逆推/通分约分过程填空（空位承担子目标）
 *   choice —— 得数选式 / 等值·分类·倒数辨析（四个备选项求值或判类互异）
 *   apply  —— 分蛋糕/修路/分装等真实分数情境迁移
 *
 * 题型集仍为 calc/fill/choice/apply（未扩题型）；备选项全部真实可判，无「以上都不对」。
 * ------------------------------------------------------------------ */

function fparse(t) { var p = String(t).split('/'); return { n: +p[0], d: +p[1] }; }
function fadd(a, b) { var l = a.d * b.d / gcd(a.d, b.d); return simp(a.n * (l / a.d) + b.n * (l / b.d), l); }
function fsub(a, b) { var l = a.d * b.d / gcd(a.d, b.d); return simp(a.n * (l / a.d) - b.n * (l / b.d), l); }
function fmul(a, b) { return simp(a.n * b.n, a.d * b.d); }
function fdiv(a, b) { return simp(a.n * b.d, a.d * b.n); }
function fstr(f) { return f.d === 1 ? String(f.n) : fs(f); }

// 受限分数四则求值（先同级左到右，仅用于备选项判重；出现负数/零除数返回 null）
function fracEval(s) {
  var m = String(s).match(/\d+\/\d+|\d+|[+\-−×÷]/g);
  if (!m || m.length < 3) return null;
  var acc = (m[0].indexOf('/') !== -1) ? fparse(m[0]) : { n: +m[0], d: 1 };
  for (var k = 1; k < m.length; k += 2) {
    var op = m[k], t = m[k + 1];
    if (!t) return null;
    var b = (t.indexOf('/') !== -1) ? fparse(t) : { n: +t, d: 1 };
    if (op === '+') acc = fadd(acc, b);
    else if (op === '−' || op === '-') { acc = fsub(acc, b); if (acc.n < 0) return null; }
    else if (op === '×' || op === 'x' || op === '*') acc = fmul(acc, b);
    else if (op === '÷' || op === '/') { if (b.n === 0) return null; acc = fdiv(acc, b); }
    else return null;
  }
  return acc;
}

// 四个算式备选项：正确式 + 扰动分子的算式（逐个求值去重，保证四个得数互异）
function exprOptionsFrac(rng, expr, correctVal) {
  var m = String(expr).match(/\d+\/\d+|\d+|[+\-−×÷]/g);
  var pos = [];
  m.forEach(function (t, i) { if (!/[+\-−×÷]/.test(t)) pos.push(i); });
  var opts = [expr], seenE = {}, seenV = {};
  seenE[expr] = 1; seenV[fstr(correctVal)] = 1;
  var deltas = [1, -1, 2, -2, 3, -3], guard = 0;
  while (opts.length < 4 && guard++ < 400) {
    var pi = pos[guard % pos.length], dlt = deltas[Math.floor(guard / pos.length) % deltas.length];
    var orig = m[pi], isF = orig.indexOf('/') !== -1, f0 = isF ? fparse(orig) : { n: +orig, d: 1 };
    var nn = f0.n + dlt;
    if (nn < 1) continue;
    var parts = m.slice();
    parts[pi] = isF ? nn + '/' + f0.d : String(nn);
    var cand = parts.join(' ');
    if (seenE[cand]) continue;
    var v = fracEval(cand);
    if (!v || seenV[fstr(v)]) continue;
    seenE[cand] = 1; seenV[fstr(v)] = 1; opts.push(cand);
  }
  return Rng.shuffle(rng, opts.slice(0, 4));
}

function calcItem(expr, ansF, hint) {
  return { prompt: (hint ? hint + '：' : '列式计算：') + expr + ' = ？', answer: fs(ansF), options: null };
}
function choiceExprItem(rng, expr, ansF, stemPrefix) {
  return { prompt: (stemPrefix || '下面哪个算式的得数是 ') + fs(ansF) + '？（  ）', answer: expr,
    options: exprOptionsFrac(rng, expr, ansF) };
}
function applyItem(story, expr, ansF) {
  return { prompt: story + '：' + expr + ' = ？', answer: fs(ansF), options: null };
}

// 运算类子类型（word/addsub/addsub-diff/mix/div）的四题型真分工
function arithmeticTyped(sub, qt, rng) {
  if (sub === 'word') {
    var wd = ri(rng, 3, 9), wa = ri(rng, 1, wd - 2), wb = ri(rng, 1, wd - wa - 1);
    var wexpr = wa + '/' + wd + ' + ' + wb + '/' + wd, wans = simp(wa + wb, wd);
    if (qt === 'calc') return calcItem(wexpr, wans);
    if (qt === 'fill') {
      return { prompt: '一块蛋糕，小明吃了这块蛋糕的 ' + wa + '/' + wd + '，剩下的小红正好吃完，小红吃了这块蛋糕的 ____',
        answer: fs({ n: wd - wa, d: wd }), options: null };
    }
    if (qt === 'choice') {
      return { prompt: '一块蛋糕，小明吃了 ' + wa + '/' + wd + '，小红吃了 ' + wb + '/' + wd +
        '，求两人一共吃了这块蛋糕的几分之几，下面哪个列式正确？（  ）',
        answer: wexpr, options: exprOptionsFrac(rng, wexpr, wans) };
    }
    return { prompt: '一块蛋糕，小明吃了这块蛋糕的 ' + wa + '/' + wd + '，小红吃了 ' + wb + '/' + wd +
      '，两人一共吃了这块蛋糕的几分之几？列式 ' + wexpr + ' = ？', answer: fs(wans), options: null };
  }

  if (sub === 'addsub') {
    var d = ri(rng, 3, 9), add = rng() < 0.5;
    if (add) {
      var a = ri(rng, 1, d - 2), b = ri(rng, 1, d - a);
      var ae = a + '/' + d + ' + ' + b + '/' + d, aa = simp(a + b, d);
      if (qt === 'calc') return calcItem(ae, aa);
      if (qt === 'fill') return { prompt: '在 ____ 里填上合适的分数：' + a + '/' + d + ' + ____ = ' + (a + b) + '/' + d,
        answer: b + '/' + d, options: null };
      if (qt === 'choice') return choiceExprItem(rng,ae, aa);
      return applyItem('一根彩带，第一次用去这根彩带的 ' + a + '/' + d + '，第二次又用去 ' + b + '/' + d +
        '，列式求两次一共用去这根彩带的几分之几', ae, aa);
    }
    var hi = ri(rng, 2, d - 1), lo = ri(rng, 1, hi - 1);
    var se = hi + '/' + d + ' − ' + lo + '/' + d, sa = simp(hi - lo, d);
    if (qt === 'calc') return calcItem(se, sa);
    if (qt === 'fill') return { prompt: '在 ____ 里填上合适的分数：' + hi + '/' + d + ' − ____ = ' + (hi - lo) + '/' + d,
      answer: lo + '/' + d, options: null };
    if (qt === 'choice') return choiceExprItem(rng, se, sa);
    return applyItem('一根彩带长是单位「1」，先用去这根彩带的 ' + hi + '/' + d + '，又用去 ' + lo + '/' + d +
      '，列式求还剩这根彩带的几分之几', se, sa);
  }

  if (sub === 'addsub-diff') {
    var s2 = diffDenomAdd(rng);
    var de = s2.expr, da = s2.ans;
    if (qt === 'calc') return calcItem(de, da, '列式计算（先通分）');
    if (qt === 'fill') {
      var c1 = s2.n1 * (s2.lcm / s2.d1);
      return { prompt: '先通分再填空：' + s2.n1 + '/' + s2.d1 + ' = ____/' + s2.lcm,
        answer: c1 + '/' + s2.lcm, options: null };
    }
    if (qt === 'choice') return choiceExprItem(rng, de, da);
    return applyItem('修路队第一天修了这条路的 ' + s2.n1 + '/' + s2.d1 + '，第二天修了 ' + s2.n2 + '/' + s2.d2 +
      '，列式求两天一共修了这条路的几分之几（异分母先通分）', de, da);
  }

  if (sub === 'mix') {
    var md = ri(rng, 4, 9);
    var m1 = ri(rng, 1, md - 3), m2 = ri(rng, 1, md - m1 - 2), m3 = ri(rng, 1, md - m1 - m2 - 1);
    var me = m1 + '/' + md + ' + ' + m2 + '/' + md + ' + ' + m3 + '/' + md, ma = simp(m1 + m2 + m3, md);
    if (qt === 'calc') return calcItem(me, ma);
    if (qt === 'fill') return { prompt: '在 ____ 里填上合适的分数：' + m1 + '/' + md + ' + ' + m2 + '/' + md +
      ' + ____ = ' + (m1 + m2 + m3) + '/' + md, answer: m3 + '/' + md, options: null };
    if (qt === 'choice') return choiceExprItem(rng, me, ma);
    return applyItem('看一本书，第一天看了全书的 ' + m1 + '/' + md + '，第二天看了 ' + m2 + '/' + md +
      '，第三天看了 ' + m3 + '/' + md + '，列式求三天一共看了全书的几分之几', me, ma);
  }

  // div
  if (rng() < 0.5) {
    var dv = fracDiv(rng), de2 = dv.expr, da2 = dv.ans;
    if (qt === 'calc') return calcItem(de2, da2);
    if (qt === 'fill') return { prompt: '在 ____ 里填上合适的分数：____ ÷ ' + dv.n2 + '/' + dv.d2 + ' = ' + fs(da2),
      answer: dv.n1 + '/' + dv.d1, options: null };
    if (qt === 'choice') return choiceExprItem(rng, de2, da2);
    return applyItem('把 ' + dv.n1 + '/' + dv.d1 + ' 米长的彩带剪成每段 ' + dv.n2 + '/' + dv.d2 +
      ' 米的小段，列式求能剪多少段', de2, da2);
  }
  var di = fracDivInt(rng), ie = di.expr, ia = di.ans;
  if (qt === 'calc') return calcItem(ie, ia);
  if (qt === 'fill') return { prompt: '在 ____ 里填上合适的数：' + di.n + '/' + di.d + ' ÷ ____ = ' + fs(ia),
    answer: String(di.k), options: null };
  if (qt === 'choice') return choiceExprItem(rng, ie, ia);
  return applyItem('把 ' + di.n + '/' + di.d + ' 升果汁平均分给 ' + di.k + ' 个小朋友，列式求每人分得多少升', ie, ia);
}

// 概念类子类型（meaning/nature/compare/relation/proper/reciprocal）的四题型真分工
function conceptTyped(sub, qt, rng) {
  if (sub === 'meaning') {
    var d0 = ri(rng, 4, 9), n0 = ri(rng, 2, d0 - 2);
    if (qt === 'calc') {
      return { prompt: '分数单位累加，列式：1/' + d0 + ' + 1/' + d0 + ' + 1/' + d0 + ' = ？',
        answer: '3/' + d0, options: null };
    }
    if (qt === 'fill') return { prompt: '把一个圆平均分成 ' + d0 + ' 份，每份是它的 1/____',
      answer: String(d0), options: null };
    if (qt === 'choice') {
      var optsM = Rng.shuffle(rng, [n0 + '/' + d0, (n0 + 1) + '/' + d0, '1/' + d0, d0 + '/' + n0]);
      return { prompt: '把一个圆平均分成 ' + d0 + ' 份，取其中 ' + n0 + ' 份，下面哪个分数表示涂色部分？（  ）',
        answer: n0 + '/' + d0, options: optsM };
    }
    return { prompt: '把一个蛋糕平均分给 ' + d0 + ' 个小朋友，每人得到这个蛋糕的几分之几？',
      answer: '1/' + d0, options: null };
  }

  if (sub === 'nature') {
    if (qt === 'calc') {
      var g2 = ri(rng, 2, 5), ca = ri(rng, 1, 4), cb = ca + ri(rng, 1, 3);
      var cn = g2 * ca, cd = g2 * cb, cr = simp(cn, cd);
      return { prompt: '约成最简分数（分子分母同除以 ' + g2 + '，列式：' + cn + ' ÷ ' + g2 + ' = ' + cr.n + '）：' +
        cn + '/' + cd + ' = ？', answer: fs(cr), options: null };
    }
    if (qt === 'fill') {
      var bd = ri(rng, 3, 8), bk = ri(rng, 2, 5);
      return { prompt: '分数的基本性质，在 ____ 里填数：1/' + bd + ' = ____/' + (bd * bk),
        answer: String(bk), options: null };
    }
    if (qt === 'choice') {
      var g3 = ri(rng, 2, 4), rn3 = ri(rng, 1, 4), rd3 = rn3 + ri(rng, 1, 3);
      var en = g3 * rn3, ed = g3 * rd3, rr = simp(en, ed);
      var optsN = Rng.shuffle(rng, [fs(rr), (en + 1) + '/' + ed, en + '/' + (ed + 1), (rr.n + 1) + '/' + rr.d]);
      return { prompt: '下面哪个分数与 ' + en + '/' + ed + ' 大小相等？（  ）', answer: fs(rr), options: optsN };
    }
    var ag = ri(rng, 2, 5), ab = ag + ri(rng, 1, 3), an = ag * ri(rng, 1, ab - 1);
    var ar = simp(an, ab * ag);
    return { prompt: '合唱队有 ' + (ab * ag) + ' 人，其中男生 ' + an + ' 人，列式求男生占全队人数的几分之几（约成最简分数）：' +
      an + '/' + (ab * ag) + ' = ？', answer: fs(ar), options: null };
  }

  if (sub === 'compare') {
    var cd2 = ri(rng, 4, 9), clo = ri(rng, 1, cd2 - 2), chi = ri(rng, clo + 1, cd2 - 1);
    var lf = clo + '/' + cd2, hf = chi + '/' + cd2;
    if (qt === 'calc') {
      return { prompt: '列式比一比：' + hf + ' − ' + lf + ' = ？（差大于 0，说明同分母时分子大的分数大）',
        answer: fs(simp(chi - clo, cd2)), options: null };
    }
    if (qt === 'fill') return { prompt: '比较大小，在 ____ 里填上 >、< 或 =：' + lf + ' ____ ' + hf,
      answer: '<', options: null };
    if (qt === 'choice') {
      var optsC = Rng.shuffle(rng, [lf + ' < ' + hf, lf + ' > ' + hf, lf + ' = ' + hf, hf + ' < ' + lf]);
      return { prompt: '下面大小关系正确的是？（  ）', answer: lf + ' < ' + hf, options: optsC };
    }
    return { prompt: '小华和小明跑同样长的一段路，小华用了 ' + lf + ' 分钟，小明用了 ' + hf +
      ' 分钟，谁用的时间更短？', answer: '小华', options: null };
  }

  if (sub === 'relation') {
    var rn1 = ri(rng, 2, 6), rd1 = rn1 + ri(rng, 1, 4);
    if (qt === 'calc') return { prompt: '用分数表示除法的商，列式：' + rn1 + ' ÷ ' + rd1 + ' = ？',
      answer: rn1 + '/' + rd1, options: null };
    if (qt === 'fill') return { prompt: '分数与除法，在 ____ 里填除数：' + rn1 + ' ÷ ____ = ' + rn1 + '/' + rd1,
      answer: String(rd1), options: null };
    if (qt === 'choice') {
      var correct = rn1 + ' ÷ ' + rd1;
      var optsR = Rng.shuffle(rng, [correct, rd1 + ' ÷ ' + rn1, rn1 + ' + ' + rd1, rn1 + ' × ' + rd1]);
      return { prompt: '下面哪个算式的商用分数 ' + rn1 + '/' + rd1 + ' 表示？（  ）', answer: correct, options: optsR };
    }
    return { prompt: '把 ' + rn1 + ' 个同样大的月饼平均分给 ' + rd1 + ' 个小朋友，每人分得多少个月饼？（用分数表示）',
      answer: rn1 + '/' + rd1, options: null };
  }

  if (sub === 'proper') {
    if (qt === 'calc') {
      var improper = rng() < 0.5;
      var pq, qq;
      if (improper) { qq = ri(rng, 2, 5); pq = qq + ri(rng, 1, 4); }
      else { pq = ri(rng, 1, 4); qq = pq + ri(rng, 2, 5); }
      return { prompt: '比较分子与分母（列式：' + pq + ' − ' + qq + ' = ？）：分数 ' + pq + '/' + qq +
        ' 的分子减去分母，得数是多少？', answer: String(pq - qq), options: null };
    }
    if (qt === 'fill') {
      var imp2 = rng() < 0.5;
      var p2, q2;
      if (imp2) { q2 = ri(rng, 2, 6); p2 = q2 + ri(rng, 1, 3); }
      else { p2 = ri(rng, 1, 5); q2 = p2 + ri(rng, 1, 4); }
      return { prompt: '分数 ' + p2 + '/' + q2 + ' 的分子' + (imp2 ? '大于分母' : '小于分母') + '，它是 ____ 分数',
        answer: imp2 ? '假分数' : '真分数', options: null };
    }
    if (qt === 'choice') {
      var bd3 = ri(rng, 4, 7), impN = bd3 + ri(rng, 1, 3);
      var impFrac = impN + '/' + bd3;
      var optsP = Rng.shuffle(rng, ['1/' + bd3, '2/' + bd3, '3/' + bd3, impFrac]);
      return { prompt: '下面四个分数中，哪个是假分数？（  ）', answer: impFrac, options: optsP };
    }
    var pg = ri(rng, 2, 6), qg = pg + ri(rng, 1, 3);
    return { prompt: '把 ' + pg + ' 个同样大的面包平均分给 ' + qg + ' 个小组，每个小组分得多少个面包？（用分数表示）',
      answer: pg + '/' + qg, options: null };
  }

  // reciprocal
  var ra = ri(rng, 2, 7), rb = ra + ri(rng, 1, 3);
  var orig = ra + '/' + rb, recip = rb + '/' + ra;
  if (qt === 'calc') {
    return { prompt: '写出 ' + orig + ' 的倒数，再列式检验乘积：' + orig + ' × ' + recip + ' = ？',
      answer: '1', options: null };
  }
  if (qt === 'fill') return { prompt: '在 ____ 里填上合适的分数：' + orig + ' × ____ = 1',
    answer: recip, options: null };
  if (qt === 'choice') {
    var optsRc = Rng.shuffle(rng, [recip, orig, '1', (rb + 1) + '/' + ra]);
    return { prompt: '下面哪个数是 ' + orig + ' 的倒数？（  ）', answer: recip, options: optsRc };
  }
  return { prompt: '小明写了分数 ' + orig + '，小红要写一个分数使两数乘积等于 1，小红应该写什么分数？',
    answer: recip, options: null };
}

/* ------------------------------------------------------------------ *
 * 出题
 * ------------------------------------------------------------------ */

function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '分数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;

  var ARITH_SUBS = { word: 1, addsub: 1, 'addsub-diff': 1, mix: 1, div: 1 };
  var typed = ARITH_SUBS[sub] ? arithmeticTyped(sub, qt, rng) : conceptTyped(sub, qt, rng);

  var prompt = typed.prompt;
  var answer = typed.answer;
  var options = typed.options || null;

  var data = { mode: 'fraction', subType: sub, steps: 1 };
  if (qt === 'choice' && options) {
    data.options = options;
    data.correctIndex = options.map(String).indexOf(String(answer));
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: data
  };
}

function createFractionGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:fraction-number',
    subject: 'math',
    capabilities: ['calc', 'fill', 'choice', 'apply'],
    questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'choice', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = (plan && plan.count) || 1;
      var name = plan.semanticParams && plan.semanticParams.name;
      if (!name) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(buildQuestion(plan, context, i));
      return SemanticEvidence.attachAll(VariationApply.applyToAll(out, plan), plan);
    }
  };
}

function buildAll() { return [createFractionGenerator()]; }

module.exports = {
  deriveSubtype: deriveSubtype,
  createFractionGenerator: createFractionGenerator,
  buildAll: buildAll
};
