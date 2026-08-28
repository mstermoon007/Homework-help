/**
 * plugins/math-word-problems.js — 数学应用题插件（一年级：解决问题/连加连减与加减混合）
 *
 * 使用 shared/common.js 的 PluginUtil.createPlugin 工厂（标准契约）：
 * 通过 generateQuestions + meta 实现 generate/render/check。
 * 设置项：
 *   · 题型（type）：解决问题 / 连加连减题 / 混合练习（一年级模板按 cat 分桶）
 *   · 难度（level）：初级 / 中级 / 高级 / 综合（对应 basic/adv/high/mix 模板桶）
 * 一年级新增 T15-T20 模板：连加三数、连减、先加后减混合、比一个数少几、排队从前后数、逆向求部分。
 * 解题思路（hint）只描述方法，不给出答案或中间计算结果。
 * 随机数统一使用 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-word-problems.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ── 表达式标准化：×→*  ÷→/ ──
  function normalizeExpr(expr) {
    return expr.replace(/×/g, '*').replace(/÷/g, '/');
  }

  // ── 解析变量范围 "1-19" / "1-{20-a}" / "2-81 (是b的整数倍)" ──
  function parseRange(rangeStr, resolved, scale) {
    // 去掉括号内的描述性文字
    var str = rangeStr.replace(/[（(][^)）]*[)）]/g, '').trim();
    // 替换已解析的变量引用
    str = str.replace(/\{([^}]+)\}/g, function (_, expr) {
      try {
        var val = evalExpr(expr, resolved);
        return String(val);
      } catch (e) { return '0'; }
    });
    var parts = str.split('-');
    if (parts.length === 2) {
      var min = parseInt(parts[0], 10) || 1;
      var max = parseInt(parts[1], 10) || 1;
      if (scale && scale !== 1) {
        min = Math.max(1, Math.round(min * scale));
        max = Math.max(min, Math.round(max * scale));
      }
      return { min: min, max: max };
    }
    return { min: 1, max: 1 };
  }

  // ── 简单表达式求值 ──
  function evalExpr(expr, vars) {
    var s = normalizeExpr(expr);
    // 先替换 {var} 和 {expr} 模式
    s = s.replace(/\{([^}]+)\}/g, function (_, inner) {
      // inner 可能是简单变量名或表达式
      if (vars.hasOwnProperty(inner)) {
        return String(vars[inner]);
      }
      // 尝试作为表达式求值
      var innerExpr = normalizeExpr(inner);
      Object.keys(vars).forEach(function (k) {
        innerExpr = innerExpr.replace(new RegExp('\\b' + k + '\\b', 'g'), vars[k]);
      });
      try {
        return String(Function('"use strict"; return (' + innerExpr + ')')());
      } catch (e) { return '0'; }
    });
    // 再替换裸变量名
    Object.keys(vars).forEach(function (k) {
      s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), vars[k]);
    });
    try {
      return Function('"use strict"; return (' + s + ')')();
    } catch (e) { return 0; }
  }

  // ── 检查约束 ──
  function checkConstraint(constraint, vars, answerExpr) {
    if (!constraint) return true;
    // 先处理"结果"引用：计算 answerExpr 并替换
    var resultVal;
    if (constraint.indexOf('结果') !== -1 && answerExpr) {
      resultVal = evalExpr(answerExpr, vars);
    }
    // 分割（支持逗号与 and 两种连接符）
    var parts = constraint.split(/\s+and\s+|[，,]/);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;

      // 处理 "X能被Y整除"
      var divMatch = part.match(/(\w+)能被(\w+)整除/);
      if (divMatch) {
        if (vars[divMatch[1]] % vars[divMatch[2]] !== 0) return false;
        continue;
      }

      // 处理 "X不能被Y整除"
      var notDivMatch = part.match(/(\w+)不能被(\w+)整除/);
      if (notDivMatch) {
        if (vars[notDivMatch[1]] % vars[notDivMatch[2]] === 0) return false;
        continue;
      }

      // 处理 "X是Y的整数倍"
      var multMatch = part.match(/(\w+)是(\w+)的整数倍/);
      if (multMatch) {
        if (vars[multMatch[1]] % vars[multMatch[2]] !== 0) return false;
        continue;
      }

      // 处理 "答案为正整数"
      if (part.indexOf('答案为正整数') !== -1) {
        if (resultVal == null) resultVal = evalExpr(answerExpr, vars);
        if (!Number.isInteger(resultVal) || resultVal <= 0) return false;
        continue;
      }

      // 处理 "通常X不能被Y整除" → 当作硬约束
      var usuallyMatch = part.match(/通常(\w+)不能被(\w+)整除/);
      if (usuallyMatch) {
        if (vars[usuallyMatch[1]] % vars[usuallyMatch[2]] === 0) return false;
        continue;
      }

      // 处理 "差为偶数"
      if (part.indexOf('差为偶数') !== -1) {
        // 查找 a 和 b 的差
        if (vars.a !== undefined && vars.b !== undefined) {
          if ((vars.a - vars.b) % 2 !== 0) return false;
        }
        continue;
      }

      // 处理 "商≤9" 等
      var simplified = part
        .replace(/≤/g, '<=')
        .replace(/≥/g, '>=')
        .replace(/商/g, '');
      // 如果简化后为空，跳过
      if (!simplified.replace(/[<>=!\d\s]/g, '')) continue;

      var expr = normalizeExpr(simplified);
      // 替换变量
      Object.keys(vars).forEach(function (k) {
        expr = expr.replace(new RegExp('\\b' + k + '\\b', 'g'), vars[k]);
      });
      // 替换"结果"
      if (resultVal != null) {
        expr = expr.replace(/结果/g, String(resultVal));
      }
      // 移除只含中文的残留
      if (/[\u4e00-\u9fff]/.test(expr.replace(/[<>=!\d\s+\-*/().]/g, ''))) continue;
      try {
        if (!Function('"use strict"; return (' + expr + ')')()) return false;
      } catch (e) { /* skip unparseable */ }
    }
    return true;
  }

  // ── 格式化 hint ──
  function formatHint(hintTpl, vars, ansDisplay) {
    return hintTpl.replace(/\{([^}]+)\}/g, function (_, expr) {
      if (expr === 'ans') return String(ansDisplay);
      // 直接变量名（包括文本变量）→ 返回变量值
      if (vars.hasOwnProperty(expr)) return String(vars[expr]);
      try {
        return String(evalExpr(expr, vars));
      } catch (e) { return '?'; }
    });
  }

  // ── 特殊变量解析（针对特定模板ID） ──
  var SPECIAL_VARS = {
    'G2A01': function (resolved) {
      // c = a*b + 1 到 100
      var ab = resolved.a * resolved.b;
      resolved.c = rnd(ab + 1, Math.max(ab + 1, 100));
    },
    'G2H02': function (resolved) {
      // total = b * k + c, k ∈ [1, 20]，total > c
      var k = rnd(1, 20);
      resolved.total = resolved.b * k + resolved.c;
    },
    'G2H04': function (resolved) {
      // b = a + (c-1) * k, k > a（使 years = k - a > 0）
      var k = resolved.a + rnd(1, 5);
      resolved.b = resolved.a + (resolved.c - 1) * k;
    },
    'G2B07': function (resolved) {
      // 估算购物：a、b 取整十数（10/20/.../90）
      resolved.a = Math.round(resolved.a / 10) * 10 || 10;
      resolved.b = Math.round(resolved.b / 10) * 10 || 10;
      if (resolved.a + resolved.b > 100) { resolved.a = Math.max(10, resolved.a - 10); }
      if (resolved.a + resolved.b > 100) { resolved.b = Math.max(10, resolved.b - 10); }
    },
    'G3P01': function (resolved) {
      // 铁丝围正方形：周长必须是 4 的倍数
      resolved.perim -= resolved.perim % 4;
      if (resolved.perim < 20) resolved.perim = 20;
    },
    'G3P06': function (resolved) {
      // 铁丝改围长方形：周长是偶数，且长 < 周长的一半
      if (resolved.perim % 2) resolved.perim -= 1;
      if (resolved.l >= resolved.perim / 2) resolved.l = resolved.perim / 2 - 1;
    }
  };

  // ── 一年级 20 个模板（cat: solve=解决问题 / chain=连加连减与加减混合） ──
  var G1_TEMPLATES = [
    {
      id: 'T01', difficulty: 'basic', cat: 'solve', name: '求总数（合并）',
      template: '小明有{a}个{obj}，小华有{b}个{obj}，他们一共有多少个{obj}？',
      vars: { a: '1-19', b: '1-{20-a}', obj: ['苹果','铅笔','气球','糖果','橡皮','尺子','本子','贴纸','花朵','星星'] },
      answer: '{a}+{b}', hint: '把两部分合起来，用加法：{a}+{b}=（  ）',
      unit: '个', constraint: 'a+b<=20'
    },
    {
      id: 'T02', difficulty: 'basic', cat: 'solve', name: '求剩余',
      template: '{place}原来有{total}个{obj}，{person}拿走了{take}个，还剩几个？',
      vars: { total: '2-20', take: '1-{total-1}', obj: ['积木','饼干','本子','糖果','鸡蛋','橘子'], place: ['桌子上','篮子里','盒子里','盘子里'], person: ['妈妈','爸爸','老师','小明','小红'] },
      answer: '{total}-{take}', hint: '从总数里去掉拿走的，用减法：{total}-{take}=（  ）',
      unit: '个', constraint: 'total>take'
    },
    {
      id: 'T03', difficulty: 'basic', cat: 'solve', name: '求相差数（比多少）',
      template: '{A}有{a}个{obj}，{B}有{b}个{obj}，{A}比{B}多几个？',
      vars: { A: ['哥哥','小明','小华','小红'], B: ['弟弟','小丽','小刚','小美'], a: '2-20', b: '1-{a-1}', obj: ['糖','卡片','花','气球','铅笔','贴纸'] },
      answer: '{a}-{b}', hint: '求谁比谁多，用减法：{a}-{b}=（  ）',
      unit: '个', constraint: 'a>b'
    },
    {
      id: 'T04', difficulty: 'basic', cat: 'solve', name: '求比一个数多几的数',
      template: '小红做了{a}朵花，小丽比小红多做了{b}朵，小丽做了多少朵？',
      vars: { a: '1-18', b: '1-{20-a}' },
      answer: '{a}+{b}', hint: '比{a}多{b}，用加法：{a}+{b}=（  ）',
      unit: '朵', constraint: 'a+b<=20'
    },
    {
      id: 'T05', difficulty: 'basic', cat: 'chain', name: '加减混合',
      template: '树上有{a}只鸟，飞走了{b}只，又飞来{c}只，现在树上有多少只鸟？',
      vars: { a: '2-20', b: '1-{a-1}', c: '1-{20-a+b}' },
      answer: '{a}-{b}+{c}', hint: '先减去飞走的，再加上飞来的：{a}-{b}+{c}=（  ）',
      unit: '只', constraint: 'a-b>=0 and a-b+c<=20'
    },
    {
      id: 'T06', difficulty: 'adv', cat: 'solve', name: '逆向求原来（反向加法）',
      template: '妈妈买来一些{obj}，吃了{a}个，还剩{b}个，妈妈原来买了多少个{obj}？',
      vars: { a: '1-19', b: '1-{20-a}', obj: ['苹果','橘子','草莓','饼干','糖'] },
      answer: '{a}+{b}', hint: '吃了的加上剩下的就是原来的：{a}+{b}=（  ）',
      unit: '个', constraint: 'a+b<=20'
    },
    {
      id: 'T07', difficulty: 'adv', cat: 'chain', name: '连加',
      template: '{place}原来有{a}辆{obj}，先开来{b}辆，又开来{c}辆，现在有多少辆{obj}？',
      vars: { a: '1-18', b: '1-{20-a}', c: '1-{20-a-b}', obj: ['车'], place: ['停车场','车库'] },
      answer: '{a}+{b}+{c}', hint: '把三部分加起来：{a}+{b}+{c}=（  ）',
      unit: '辆', constraint: 'a+b+c<=20'
    },
    {
      id: 'T08', difficulty: 'adv', cat: 'chain', name: '连减',
      template: '篮子里有{total}个{obj}，奶奶做菜用了{a}个，妈妈又用了{b}个，还剩几个？',
      vars: { total: '3-20', a: '1-{total-2}', b: '1-{total-a-1}', obj: ['鸡蛋','土豆','番茄','苹果'] },
      answer: '{total}-{a}-{b}', hint: '连减两次：{total}-{a}-{b}=（  ）',
      unit: '个', constraint: 'total-a-b>=0'
    },
    {
      id: 'T09', difficulty: 'adv', cat: 'solve', name: '排队问题（含自己）',
      template: '同学们排队，小明前面有{a}人，后面有{b}人，这一队一共有多少人？',
      vars: { a: '1-18', b: '1-{19-a}' },
      answer: '{a}+{b}+1', hint: '前面的人加上小明自己，再加上后面的人：{a}+1+{b}=（  ）',
      unit: '人', constraint: 'a+b+1<=20'
    },
    {
      id: 'T10', difficulty: 'adv', cat: 'chain', name: '同数连加（乘法雏形）',
      template: '每个小朋友折了{a}只纸鹤，{n}个小朋友一共折了多少只纸鹤？',
      vars: { a: '2-9', n: '2-5' },
      answer: '{a}*{n}', hint: '每个小朋友折{a}只，{n}个小朋友一共是{n}个{a}相加。',
      unit: '只', constraint: 'a*n<=100'
    },
    {
      id: 'T11', difficulty: 'high', cat: 'solve', name: '人民币简单计算',
      template: '一个{goods}的价格是{price}元，小明付了{pay}元，应找回多少元？',
      vars: { goods: ['文具盒','橡皮','尺子','笔记本','铅笔刀'], price: '1-49', pay: '{price+1}-50' },
      answer: '{pay}-{price}', hint: '付的钱减去商品价格：{pay}-{price}=（  ）',
      unit: '元', constraint: 'pay>price'
    },
    {
      id: 'T12', difficulty: 'high', cat: 'solve', name: '含多余条件',
      template: '小明养了{pet1}{a}条，{pet2}{b}只，死了{c}条{pet1}，还剩几条{pet1}？',
      vars: { pet1: ['金鱼','蚕'], pet2: ['乌龟','小鸡','兔子'], a: '5-20', b: '1-10', c: '1-{a-1}' },
      answer: '{a}-{c}', hint: '注意！{pet2}的数量是多余条件，只算{pet1}：{a}-{c}=（  ）',
      unit: '条', constraint: 'a>c'
    },
    {
      id: 'T13', difficulty: 'high', cat: 'solve', name: '两步计算（先求部分再求总数）',
      template: '小红有{a}本故事书，小丽比小红多{b}本，两人一共有多少本书？',
      vars: { a: '1-48', b: '1-{50-a}' },
      answer: '{a}+({a}+{b})', hint: '先求小丽有多少本：{a}+{b}=（  ）；再把两人的本数合起来。',
      unit: '本', constraint: 'a+b<=50'
    },
    {
      id: 'T14', difficulty: 'high', cat: 'solve', name: '移多补少问题',
      template: '哥哥有{a}块糖，弟弟有{b}块糖，哥哥给弟弟几块后两人同样多？',
      vars: { a: '2-20', b: '1-{a-2}' },
      answer: '({a}-{b})/2', hint: '先求相差几块：{a}-{b}=（  ）；再把这相差的块数平均分成两份，给弟弟一份。',
      unit: '块', constraint: 'a>b and (a-b)%2==0'
    },
    {
      id: 'T15', difficulty: 'adv', cat: 'chain', name: '连加三数',
      template: '小明第一天看{a}页书，第二天看{b}页，第三天看{c}页，三天一共看了多少页？',
      vars: { a: '1-6', b: '1-6', c: '1-{20-a-b}' },
      answer: '{a}+{b}+{c}', hint: '三天看的页数合起来，用连加：{a}+{b}+{c}=（  ）',
      unit: '页', constraint: 'a+b+c<=20'
    },
    {
      id: 'T16', difficulty: 'adv', cat: 'chain', name: '连减（连续分两次）',
      template: '小红有{a}颗糖，分给弟弟{b}颗，又分给妹妹{c}颗，还剩多少颗？',
      vars: { a: '5-20', b: '1-{a-2}', c: '1-{a-b-1}' },
      answer: '{a}-{b}-{c}', hint: '连续减去两次：{a}-{b}-{c}=（  ）',
      unit: '颗', constraint: 'a-b-c>=0'
    },
    {
      id: 'T17', difficulty: 'adv', cat: 'chain', name: '先加后减（进出混合）',
      template: '停车场原来有{a}辆车，又开来{b}辆，开走{c}辆，现在有多少辆车？',
      vars: { a: '1-10', b: '1-{20-a}', c: '1-{a+b-1}' },
      answer: '{a}+{b}-{c}', hint: '先加上开来的，再减去开走的：{a}+{b}-{c}=（  ）',
      unit: '辆', constraint: 'a+b-c>=0'
    },
    {
      id: 'T18', difficulty: 'basic', cat: 'solve', name: '求比一个数少几的数',
      template: '小华有{a}朵花，小丽比小华少{b}朵，小丽有多少朵花？',
      vars: { a: '2-20', b: '1-{a-1}' },
      answer: '{a}-{b}', hint: '比{a}少{b}，用减法：{a}-{b}=（  ）',
      unit: '朵', constraint: 'a>b'
    },
    {
      id: 'T19', difficulty: 'adv', cat: 'solve', name: '排队（从前后数第几个）',
      template: '从前往后数，小明排在第{a}个；从后往前数，小明也排在第{b}个。这一队一共有多少人？',
      vars: { a: '2-10', b: '2-10' },
      answer: '{a}+{b}-1', hint: '前后两个数相加，小明被数了两次，要减去1：{a}+{b}-1=（  ）',
      unit: '人', constraint: 'a+b-1<=20'
    },
    {
      id: 'T20', difficulty: 'high', cat: 'solve', name: '逆向求部分（已知总数与一部分）',
      template: '小明和小红一共有{a}本书，小明有{b}本，小红有多少本书？',
      vars: { a: '2-20', b: '1-{a-1}' },
      answer: '{a}-{b}', hint: '总本数减去小明的那部分，就是小红的：{a}-{b}=（  ）',
      unit: '本', constraint: 'a>b'
    }
  ];

  // ── 二年级 24 个模板（hint 已去除答案） ──
  var G2_TEMPLATES = [
    {
      id: 'G2B01', difficulty: 'basic', name: '乘法求总数',
      template: '每组有{a}个{object}，有{b}组，一共有多少个{object}？',
      vars: { a: '2-9', b: '2-9', object: ['同学','气球','铅笔','橡皮','本子','草莓','糖果'] },
      answer: '{a}×{b}',
      hint: '{b}个{a}相加，用乘法：{a}×{b}=（  ）',
      unit: '个', constraint: 'a×b<=81'
    },
    {
      id: 'G2B02', difficulty: 'basic', name: '除法（平均分）',
      template: '有{total}个{object}，平均分成{groups}份，每份几个？',
      vars: { total: '2-81', groups: '2-9', object: ['糖果','本子','苹果','橘子','饼干','铅笔'] },
      answer: '{total}÷{groups}',
      hint: '把{total}平均分成{groups}份：{total}÷{groups}=（  ）',
      unit: '个', constraint: 'total能被groups整除，total÷groups<=9'
    },
    {
      id: 'G2B03', difficulty: 'basic', name: '除法（包含除）',
      template: '有{total}个{object}，每{per}个放一盘，可以放几盘？',
      vars: { total: '2-81', per: '2-9', object: ['草莓','积木','苹果','橘子','鸡蛋','糖果'] },
      answer: '{total}÷{per}',
      hint: '求{total}里面有几个{per}：{total}÷{per}=（  ）',
      unit: '盘', constraint: 'total能被per整除，total÷per<=9'
    },
    {
      id: 'G2B04', difficulty: 'basic', name: '求一个数是另一个数的几倍',
      template: '{A}有{a}{unit}，{B}有{b}{unit}，{A}的{unit}是{B}的几倍？',
      vars: { a: '2-81', b: '1-9', unit: ['朵','张','元','本','只','个'], A: ['小丽','小红','小明','小华','小军'], B: ['小刚','小美','小杰','小芳','小涛'] },
      answer: '{a}÷{b}',
      hint: '求{a}是{b}的几倍：{a}÷{b}=（  ）',
      unit: '倍', constraint: 'a是b的整数倍，a÷b<=9'
    },
    {
      id: 'G2B05', difficulty: 'basic', name: '求一个数的几倍是多少',
      template: '{A}有{a}{unit}，{B}的{unit}是{A}的{b}倍，{B}有多少{unit}？',
      vars: { a: '1-9', b: '2-9', unit: ['本','只','张','朵','个'], A: ['小华','小明','小红','小丽'], B: ['小芳','小刚','小杰','小美'] },
      answer: '{a}×{b}',
      hint: '求{a}的{b}倍：{a}×{b}=（  ）',
      unit: '', constraint: 'a×b<=81'
    },
    {
      id: 'G2B06', difficulty: 'basic', name: '有余数除法（分物余数）',
      template: '有{total}个{object}，每{per}个分一份，可以分几份？还剩几个？',
      vars: { total: '10-81', per: '2-9', object: ['纽扣','羽毛球','苹果','糖果','积木','鸡蛋'] },
      answer: '{total}÷{per}',
      answer_format: 'remainder',
      hint: '{total}÷{per}，商和余数各是几：填「商...余数」。',
      unit: '', constraint: 'total不能被per整除，total÷per<=9'
    },
    {
      id: 'G2A01', difficulty: 'adv', name: '乘减问题（付钱找零）',
      template: '笔记本每本{a}元，买了{b}本，付了{c}元，应找回多少元？',
      vars: { a: '2-9', b: '2-9' },
      answer: '{c} - {a}×{b}',
      hint: '先算总价：{a}×{b}=（  ）；再用付的{c}元减去总价。',
      unit: '元', constraint: 'c>a×b, c<=100'
    },
    {
      id: 'G2A02', difficulty: 'adv', name: '乘加问题（求总钱数）',
      template: '每个{object}{a}元，买了{b}个，又买了1个{object2}花{c}元，一共花了多少钱？',
      vars: { object: ['羽毛球','贴纸','本子','橡皮'], a: '2-9', b: '2-9', c: '1-20', object2: ['球拍','彩笔','书包','文具盒'] },
      answer: '{a}×{b} + {c}',
      hint: '先算买{b}个要花多少：{a}×{b}=（  ）；再加上{object2}的{c}元。',
      unit: '元', constraint: 'a×b+c<=100'
    },
    {
      id: 'G2A03', difficulty: 'adv', name: '乘减问题（比几个几少几）',
      template: '果园里有{a}行桃树，每行{b}棵，梨树比桃树少{c}棵，梨树有多少棵？',
      vars: { a: '2-9', b: '2-9', c: '1-{a*b-1}' },
      answer: '{a}×{b} - {c}',
      hint: '先算桃树总数：{a}×{b}=（  ）；梨树比桃树少{c}棵，再减去{c}。',
      unit: '棵', constraint: 'c<a×b, a×b-c>=0'
    },
    {
      id: 'G2A04', difficulty: 'adv', name: '求比一个数的几倍多几',
      template: '{A}有{a}张贴纸，{B}的贴纸张数是{A}的{b}倍多{c}张，{B}有多少张贴纸？',
      vars: { a: '1-9', b: '2-9', c: '1-20', A: ['小军','小明','小红','小华'], B: ['小杰','小刚','小美','小芳'] },
      answer: '{a}×{b} + {c}',
      hint: '先算{a}的{b}倍：{a}×{b}=（  ）；再多{c}张，再加{c}。',
      unit: '张', constraint: 'a×b+c<=100'
    },
    {
      id: 'G2A05', difficulty: 'adv', name: '进一法（至少需要几个容器）',
      template: '有{total}个{object}，每个盒子最多装{per}个，至少需要几个盒子才能全部装下？',
      vars: { total: '10-81', per: '2-9', object: ['苹果','橘子','积木','糖果'] },
      answer: 'Math.ceil({total}/{per})',
      hint: '先算能装几盒：{total}÷{per}=（  ）；余下的也需要1个盒子，所以商再加1。',
      unit: '个', constraint: '通常total不能被per整除'
    },
    {
      id: 'G2A06', difficulty: 'adv', name: '去尾法（最多能买几个）',
      template: '每个{object}{price}元，小明有{money}元，最多能买几个？',
      vars: { object: ['面包','玩具','本子','橡皮','铅笔'], price: '3-9', money: '10-50' },
      answer: 'Math.floor({money}/{price})',
      hint: '先算能买几个：{money}÷{price}=（  ）；剩下的钱不够再买1个，商就是最多能买的个数。',
      unit: '个', constraint: '通常money不能被price整除'
    },
    {
      id: 'G2A07', difficulty: 'adv', name: '两步计算（先加后除）',
      template: '一班有{a}人，二班有{b}人，做操时每{per}人站一排，一共要站几排？',
      vars: { a: '10-45', b: '10-45', per: '3-9' },
      answer: '({a}+{b})÷{per}',
      hint: '先算总人数：{a}+{b}=（  ）；再算每{per}人一排能站几排。',
      unit: '排', constraint: 'a+b能被per整除，(a+b)÷per<=10'
    },
    {
      id: 'G2H01', difficulty: 'high', name: '两步计算（先乘后加，求总和）',
      template: '花园里有{a}行郁金香，每行{b}株，还有{c}株百合，一共有多少株花？',
      vars: { a: '2-9', b: '2-9', c: '1-50' },
      answer: '{a}×{b}+{c}',
      hint: '先算郁金香：{a}×{b}=（  ）株；再加百合{c}株。',
      unit: '株', constraint: 'a×b+c<=200'
    },
    {
      id: 'G2H02', difficulty: 'high', name: '逆向问题（已知几倍多几和结果，求原数）',
      template: '文具店里的书包价格是一个文具盒的{b}倍还多{c}元，书包{total}元，文具盒多少元？',
      vars: { b: '2-6', c: '1-20' },
      answer: '({total}-{c})÷{b}',
      hint: '先减去多的{c}元：{total}-{c}=（  ）；再除以{b}倍。',
      unit: '元', constraint: 'total>c, (total-c)能被b整除'
    },
    {
      id: 'G2H03', difficulty: 'high', name: '搭配问题（排列组合）',
      template: '有{a}件上衣，{b}条裤子，每次穿1件上衣和1条裤子，有几种不同的穿法？',
      vars: { a: '2-6', b: '2-6' },
      answer: '{a}×{b}',
      hint: '每件上衣可以搭配{b}条裤子：{a}×{b}=（  ）种穿法',
      unit: '种', constraint: 'a×b<=36'
    },
    {
      id: 'G2H04', difficulty: 'high', name: '年龄问题（年龄差不变）',
      template: '小明今年{a}岁，爸爸今年{b}岁，几年后爸爸的年龄是小明的{c}倍？',
      vars: { a: '5-8', c: '2-5' },
      answer: '({b}-{a})÷({c}-1) - {a}',
      hint: '年龄差不变：{b}-{a}=（  ）；爸爸是小明的{c}倍时，年龄差除以（{c}-1）就是几年后的岁数，再减小明今年岁数。',
      unit: '年', constraint: '答案为正整数'
    },
    {
      id: 'G2H05', difficulty: 'high', name: '周期问题（找规律）',
      template: '按照△△□○△△□○……的规律排列，第{n}个图形是什么？',
      vars: { n: '10-50' },
      answer: '{n}%4',
      answer_format: 'periodic',
      hint: '周期是4个图形：△△□○。看{n}÷4余几，余几就是第几个图形。',
      unit: ''
    },
    {
      id: 'G2H06', difficulty: 'high', name: '移多补少（求移动数）',
      template: '哥哥有{a}块糖，弟弟有{b}块糖，哥哥给弟弟几块后，两人的糖同样多？',
      vars: { a: '10-50', b: '2-{a-2}' },
      answer: '({a}-{b})÷2',
      hint: '先求相差：{a}-{b}=（  ）；再平分，÷2。',
      unit: '块', constraint: 'a>b, 差为偶数'
    },
    {
      id: 'G2B07', difficulty: 'basic', name: '估算购物（整十估算）',
      template: '文具店里，一个书包约{a}元，一个文具盒约{b}元，买这两样大约需要多少元？',
      vars: { a: '10-90 (整十)', b: '10-{100-a} (整十)' },
      answer: '{a}+{b}',
      hint: '价格都是大约的整十数，直接相加估算：{a}+{b}=（  ）',
      unit: '元', constraint: 'a+b<=100'
    },
    {
      id: 'G2B08', difficulty: 'basic', name: '质量计算（同数累加）',
      template: '一箱苹果重{a}千克，{n}箱这样的苹果一共重多少千克？',
      vars: { a: '2-9', n: '2-9' },
      answer: '{a}×{n}',
      hint: '{n}箱就是{n}个{a}千克：{a}×{n}=（  ）',
      unit: '千克', constraint: 'a×n<=81'
    },
    {
      id: 'G2B09', difficulty: 'basic', name: '质量计算（相差）',
      template: '一只兔子重{a}千克，一只小羊比兔子重{b}千克，小羊重多少千克？',
      vars: { a: '5-20', b: '1-30' },
      answer: '{a}+{b}',
      hint: '小羊比兔子重{b}千克，用加法：{a}+{b}=（  ）',
      unit: '千克', constraint: 'a+b<=50'
    }
  ];

  // ── 三年级模板（hint 已去除答案；年月日事实类保留知识点） ──
  var G3_TEMPLATES = [
    // ---- 倍的认识 ----
    {
      id: 'G3B01', difficulty: 'basic', name: '求一个数的几倍',
      template: '书店有故事书{a}本，科技书的本数是故事书的{b}倍，科技书有多少本？',
      vars: { a: '3-15', b: '2-6' },
      answer: '{a}×{b}',
      hint: '求{a}的{b}倍，用乘法：{a}×{b}=（  ）',
      unit: '本', constraint: 'a×b<=100'
    },
    {
      id: 'G3B02', difficulty: 'basic', name: '求一个数是另一个数的几倍',
      template: '三(1)班男生有{a}人，女生有{b}人，男生人数是女生的几倍？',
      vars: { a: '8-48', b: '2-8' },
      answer: '{a}÷{b}',
      hint: '求{a}是{b}的几倍：{a}÷{b}=（  ）',
      unit: '倍', constraint: 'a能被b整除，a÷b<=8'
    },
    {
      id: 'G3A01', difficulty: 'adv', name: '倍少几',
      template: '合唱队有{a}人，体操队人数是合唱队的{b}倍少{c}人，体操队有多少人？',
      vars: { a: '3-12', b: '2-5', c: '1-{a*b-1}' },
      answer: '{a}×{b}-{c}',
      hint: '先算合唱队的{b}倍：{a}×{b}=（  ）；再少{c}人，减去{c}。',
      unit: '人', constraint: 'c<a×b'
    },
    // ---- 周长（长方形/正方形/靠墙/拼图） ----
    {
      id: 'G3P01', difficulty: 'basic', name: '铁丝围正方形求边长',
      template: '一根铁丝长{perim}厘米，正好围成一个正方形，正方形的边长是多少厘米？',
      vars: { perim: '20-80' },
      answer: '{perim}÷4',
      hint: '正方形的四条边一样长：{perim}÷4=（  ）',
      unit: '厘米', constraint: 'perim÷4<=20'
    },
    {
      id: 'G3P02', difficulty: 'basic', name: '求长方形周长',
      template: '一个长方形篮球场，长{l}米，宽{w}米，沿着它的边跑一圈是多少米？',
      vars: { l: '20-50', w: '10-25' },
      answer: '({l}+{w})×2',
      hint: '长方形周长=（长+宽）×2：({l}+{w})×2=（  ）',
      unit: '米', constraint: '({l}+{w})×2<=200'
    },
    {
      id: 'G3P03', difficulty: 'basic', name: '求正方形周长',
      template: '正方形毛巾的边长是{d}厘米，它的周长是多少厘米？',
      vars: { d: '5-40' },
      answer: '{d}×4',
      hint: '正方形周长=边长×4：{d}×4=（  ）',
      unit: '厘米', constraint: 'd×4<=160'
    },
    {
      id: 'G3P04', difficulty: 'adv', name: '靠墙围篱笆（长边靠墙）',
      template: '靠墙围一块长方形菜地，长{l}米，宽{w}米，长边靠墙（靠墙的一边长边不围篱笆），需要篱笆多少米？',
      vars: { l: '8-20', w: '4-10' },
      answer: '{l}+{w}×2',
      hint: '长边靠墙不用围，只需要围 1 条长边和 2 条宽边：{l}+{w}×2=（  ）',
      unit: '米', constraint: 'l>w'
    },
    {
      id: 'G3P05', difficulty: 'adv', name: '两个正方形拼成长方形',
      template: '两个边长{d}厘米的正方形拼成一个长方形，这个长方形的周长是多少厘米？',
      vars: { d: '3-10' },
      answer: '{d}×6',
      hint: '拼在一起的两条边重合不露在外面，周长=6 条边长：{d}×6=（  ）',
      unit: '厘米', constraint: 'd×6<=80'
    },
    {
      id: 'G3P06', difficulty: 'high', name: '铁丝改围长方形求宽',
      template: '一根{perim}厘米长的铁丝，可以围成一个长方形的框架，已知长是{l}厘米，宽是多少厘米？',
      vars: { perim: '30-90', l: '10-20' },
      answer: '{perim}÷2-{l}',
      hint: '周长÷2=长+宽：{perim}÷2=（  ）；再减去长{l}就是宽。',
      unit: '厘米', constraint: 'perim÷2>l'
    },
    // ---- 面积（铺地砖/求长宽） ----
    {
      id: 'G3S01', difficulty: 'basic', name: '求长方形面积（铺地砖）',
      template: '一间长方形教室长{l}米，宽{w}米，用边长 1 米的正方形地砖铺地（1 块地砖的面积是 1 平方米），一共需要多少块地砖？',
      vars: { l: '5-12', w: '3-8' },
      answer: '{l}×{w}',
      hint: '教室面积=长×宽：{l}×{w}=（  ）平方米；每块地砖 1 平方米，需要几块就填几。',
      unit: '块', constraint: 'l×w<=100'
    },
    {
      id: 'G3S02', difficulty: 'basic', name: '求正方形面积',
      template: '正方形手帕的边长是{d}厘米，它的面积是多少平方厘米？',
      vars: { d: '4-20' },
      answer: '{d}×{d}',
      hint: '正方形面积=边长×边长：{d}×{d}=（  ）',
      unit: '平方厘米', constraint: 'd×d<=400'
    },
    {
      id: 'G3S03', difficulty: 'adv', name: '已知面积求宽',
      template: '长方形菜地的面积是{area}平方米，长是{l}米，宽是多少米？',
      vars: { area: '18-90', l: '3-9' },
      answer: '{area}÷{l}',
      hint: '宽=面积÷长：{area}÷{l}=（  ）',
      unit: '米', constraint: 'area能被l整除，area÷l<=15'
    },
    {
      id: 'G3S04', difficulty: 'high', name: '铺地砖（面积换算）',
      template: '客厅长{l}米、宽{w}米，用边长 1 分米、面积 1 平方分米的小方砖把地面铺满，一共需要多少块小方砖？',
      vars: { l: '3-6', w: '2-4' },
      answer: '{l}×{w}×100',
      hint: '先算客厅面积：{l}×{w}=（  ）平方米；1 平方米=100 平方分米，再乘 100。',
      unit: '块', constraint: 'l×w<=20'
    },
    // ---- 年月日 ----
    {
      id: 'G3T01', difficulty: 'basic', name: '年与月',
      template: '一年有（ ）个月。',
      vars: {},
      answer: '12',
      hint: '一年有 12 个月。',
      unit: '个月'
    },
    {
      id: 'G3T02', difficulty: 'basic', name: '闰年全年天数',
      template: '2024 年是闰年，闰年全年有多少天？',
      vars: {},
      answer: '366',
      hint: '闰年 2 月有 29 天，全年 366 天。',
      unit: '天'
    },
    {
      id: 'G3T03', difficulty: 'basic', name: '平年全年天数',
      template: '2025 年是平年，平年全年有多少天？',
      vars: {},
      answer: '365',
      hint: '平年 2 月有 28 天，全年 365 天。',
      unit: '天'
    },
    {
      id: 'G3T04', difficulty: 'basic', name: '几周是几天',
      template: '一个星期有 7 天，{n} 个星期合起来有多少天？',
      vars: { n: '2-6' },
      answer: '{n}×7',
      hint: '{n}个 7 天：{n}×7=（  ）',
      unit: '天', constraint: 'n×7<=42'
    },
    {
      id: 'G3T05', difficulty: 'adv', name: '同月经过几天（含起止）',
      template: '小明 7 月{a}日去外婆家，7 月{b}日回家，他这趟一共住了几天？',
      vars: { a: '5-18', b: '{a+2}-28' },
      answer: '{b}-{a}+1',
      hint: '起止两天都算：{b}-{a}+1=（  ）天。',
      unit: '天', constraint: 'b>a'
    },
    // ---- 小数购物（角作单位，答为元） ----
    {
      id: 'G3M01', difficulty: 'basic', name: '小数加（角→元）',
      template: '一支铅笔{a}角，一块橡皮{b}角，买这两样一共要多少元？',
      vars: { a: '3-9', b: '3-9' },
      answer: '({a}+{b})/10',
      hint: '先把角加起来：{a}角+{b}角=（  ）角；1 元=10 角，再除以 10 换成元。',
      unit: '元', constraint: 'a+b<=18'
    },
    {
      id: 'G3M02', difficulty: 'adv', name: '小数加（元+角）',
      template: '一本本子{c}元，一支钢笔{b}元5角，一共要付多少元？',
      vars: { c: '1-8', b: '5-9' },
      answer: '{c}+{b}+5/10',
      hint: '5 角=0.5 元：{c}+{b}+0.5=（  ）',
      unit: '元', constraint: 'c+b+0.5<=20'
    },
    {
      id: 'G3M03', difficulty: 'adv', name: '小数差（角→元）',
      template: '一个文具盒{price}元，一支钢笔{pen}元5角，文具盒比钢笔贵多少元？',
      vars: { price: '6-12', pen: '3-8' },
      answer: '{price}-{pen}-5/10',
      hint: '先把钢笔价换成小数：{pen}元5角={pen}+0.5=（  ）元；再求差。',
      unit: '元', constraint: 'price>pen+5/10'
    },
    // ---- 搭配与集合 ----
    {
      id: 'G3C01', difficulty: 'basic', name: '搭配（饮品×主食）',
      template: '早餐店有{a}种饮品、{b}种主食，选 1 种饮品和 1 种主食，一共有几种不同的搭配？',
      vars: { a: '2-5', b: '2-5' },
      answer: '{a}×{b}',
      hint: '每种饮品可配 {b} 种主食：{a}×{b}=（  ）种。',
      unit: '种', constraint: 'a×b<=25'
    },
    {
      id: 'G3C02', difficulty: 'basic', name: '集合（只喜欢苹果的人数）',
      template: '三(2)班有{a}人喜欢苹果，{c}人喜欢香蕉，其中有{b}人两种都喜欢。只喜欢苹果的有多少人？',
      vars: { a: '15-40', b: '3-12', c: '10-30' },
      answer: '{a}-{b}',
      hint: '喜欢苹果的 {a} 人中，去掉两种都喜欢的 {b} 人：{a}-{b}=（  ）',
      unit: '人', constraint: 'b<a, b<=c'
    }
  ];

  // ── 引擎（模板解析 / 生成器池） ──
  function MathWordProblemAgent(options) {
    options = options || {};
    this.grade = options.grade || 1;
    // 题型分桶：solve / chain / null（null=不限，混合练习）
    this.cat = options.cat || null;
    // 难度：支持字符串桶（basic/adv/high/mix）与数值 1-10
    if (typeof options.level === 'string') {
      this.difficulty = options.level;
      this._numScale = 1;
    } else if (typeof options.difficulty === 'string') {
      this.difficulty = options.difficulty;
      this._numScale = 1;
    } else {
      var diff = _PU.diffLevel(options.difficulty);
      this._numScale = _PU.diffScale(diff);
      // 难度越高 → 题型逻辑越复杂：basic < adv < high 单调递进（数值由 _numScale 同步放大）
      this.difficulty = diff <= 3 ? 'basic' : (diff <= 6 ? 'adv' : 'high');
    }
    var templatesByGrade = { 1: G1_TEMPLATES, 2: G2_TEMPLATES, 3: G3_TEMPLATES };
    this._templates = templatesByGrade[this.grade] || G1_TEMPLATES;
  }

  // ── 解析模板变量，生成一个题目 ──
  MathWordProblemAgent.prototype._resolveTemplate = function (tpl) {
    var resolved = {};
    var varDefs = tpl.vars;
    var maxRetries = 30;
    var retry = 0;
    var self = this;

    while (retry < maxRetries) {
      resolved = {};
      var valid = true;

      var keys = Object.keys(varDefs);
      var numKeys = [], objKeys = [];
      keys.forEach(function (k) {
        if (Array.isArray(varDefs[k])) {
          objKeys.push(k);
        } else {
          numKeys.push(k);
        }
      });

      // 解析数值变量
      for (var i = 0; i < numKeys.length; i++) {
        var k = numKeys[i];
        var def = varDefs[k];
        var range = parseRange(def, resolved, this._numScale);
        var min = Math.max(0, range.min);
        var max = Math.max(min, range.max);
        resolved[k] = rnd(min, max);
      }

      // 特殊变量解析（如 G2A01 的 c、G2H02 的 total、G2H04 的 b）
      if (SPECIAL_VARS[tpl.id]) {
        SPECIAL_VARS[tpl.id](resolved);
      }

      // 解析对象变量（始终在约束检查前完成，确保即使 retry 耗尽也能正确渲染）
      for (var j = 0; j < objKeys.length; j++) {
        var ok = objKeys[j];
        resolved[ok] = pick(varDefs[ok]);
      }

      // 检查约束（传入 answerExpr 用于解析"结果"引用）
      if (tpl.constraint && !checkConstraint(tpl.constraint, resolved, tpl.answer)) {
        retry++;
        continue;
      }

      break;
    }

    // 生成题目文本
    var question = tpl.template.replace(/\{([^}]+)\}/g, function (_, key) {
      return resolved.hasOwnProperty(key) ? resolved[key] : '{' + key + '}';
    });

    // 计算答案
    var answerExpr = tpl.answer;
    var ans, ansDisplay;

    if (tpl.answer_format === 'remainder') {
      // 有余数除法：商...余数
      var total = resolved.total;
      var per = resolved.per;
      var q = Math.floor(total / per);
      var r = total % per;
      ans = q + '...' + r;
      ansDisplay = ans;
      // 同时把 q 和 r 存入 resolved 供 hint 使用
      resolved.q = q;
      resolved.r = r;
    } else if (tpl.answer_format === 'periodic') {
      // 周期问题：根据余数映射图形
      var n = resolved.n;
      var rem = n % 4;
      var shapeMap = { 0: '○', 1: '△', 2: '△', 3: '□' };
      ans = shapeMap[rem] || '?';
      ansDisplay = ans;
      resolved.q = Math.floor(n / 4);
      resolved.r = rem === 0 ? 4 : rem;
    } else {
      try {
        ans = evalExpr(answerExpr, resolved);
      } catch (e) {
        ans = 0;
      }
      ansDisplay = ans;
    }

    // 生成提示
    var hint = '';
    if (tpl.hint) {
      hint = formatHint(tpl.hint, resolved, ansDisplay);
    }

    // 确保 hint 中的 {a*b} 等表达式被正确计算
    hint = hint.replace(/\{([^}]+)\}/g, function (_, expr) {
      try {
        return String(evalExpr(expr, resolved));
      } catch (e) { return '?'; }
    });

    return {
      q: question,
      a: ans,
      unit: tpl.unit || '',
      hint: hint,
      depth: tpl.difficulty,
      cat: tpl.cat || null
    };
  };

  // ── 获取生成器函数池（按难度桶 + cat 分桶；cat 过滤为空时回退全量） ──
  MathWordProblemAgent.prototype.getPool = function () {
    var self = this;
    var templates = this._templates;

    // 难度桶过滤
    if (this.difficulty !== 'mix') {
      templates = templates.filter(function (t) { return t.difficulty === self.difficulty; });
    }
    // cat 分桶（一年级模板带 cat；2/3 年级无 cat，过滤为空则回退全量）
    if (this.cat) {
      var catTpl = templates.filter(function (t) { return t.cat === self.cat; });
      if (catTpl.length) templates = catTpl;
    }

    return templates.map(function (tpl) {
      return function () {
        return self._resolveTemplate(tpl);
      };
    });
  };

  // ── 直接生成题目集 ──
  MathWordProblemAgent.prototype.generate = function (count) {
    var pool = this.getPool();
    if (pool.length === 0) return [];

    var questions = [];
    var seen = {};
    var maxAttempts = Math.max(count * 3, 50);
    var attempts = 0;

    while (questions.length < count && attempts < maxAttempts) {
      var fn = pool[rnd(0, pool.length - 1)];
      var q = fn();
      attempts++;
      if (!seen[q.q]) {
        seen[q.q] = true;
        questions.push(q);
      }
    }

    while (questions.length < count) {
      var fn2 = pool[rnd(0, pool.length - 1)];
      questions.push(fn2());
    }

    return questions;
  };

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderWordCard(question, idx) {
    return '<div class="question-card" data-index="' + idx + '" style="border:1px solid var(--line);border-radius:12px;padding:14px 12px;text-align:center;position:relative;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header">' +
        '<span class="num">' + (idx + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        '<span class="q-text" style="font-size:15px;font-weight:700;color:var(--ink);display:inline;vertical-align:middle;margin:4px 0 6px;line-height:1.5;">' + question.question + '</span>' +
      '</div>' +
      (question.hint ? '<div class="q-hint">💡 ' + question.hint + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">' +
      '<input type="text" class="answer-input" data-index="' + idx + '" autocomplete="off" style="width:64px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
      (question.unit ? '<span class="unit">' + question.unit + '</span>' : '') +
      '</div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkWordQuestion(question, userAnswers, idx) {
    var user = String(userAnswers[idx] == null ? '' : userAnswers[idx]).trim();
    return user === String(question.answer).trim();
  }

  // ============ 题型/难度元数据 ============
  var TYPE_NAMES = { solve: '解决问题', chain: '连加连减题', mix: '混合练习' };
  var LEVEL_NAMES = { basic: '初级', adv: '中级', high: '高级', mix: '综合' };

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  // meta 为 createPlugin 保留字段，不挂载到插件对象；这里单独定义，供 generate / meta 复用
  function buildMeta(opts) {
    var grade = (opts && opts.grade) || 1;
    var type = (opts && opts.type) || 'solve';
    var level = (opts && opts.level) || 'basic';
    var typeLabel = TYPE_NAMES[type] || '混合练习';
    var levelLabel = LEVEL_NAMES[level] || '';
    return {
      type: type,
      level: level,
      count: (opts && opts.count) || 8,
      columns: 2,
      title: '小学' + gradeName(grade) + '数学应用题（' + typeLabel + (levelLabel ? ' · ' + levelLabel : '') + '）'
    };
  }

  function buildQuestions(options) {
    var opts = options || {};
    var grade = opts.grade || 1;
    var count = opts.count || 8;
    // 题型分桶：mix → null（不限）；solve/chain 按 cat 过滤
    var cat = (opts.type && opts.type !== 'mix') ? opts.type : null;
    var agent = new MathWordProblemAgent({ grade: grade, cat: cat, level: opts.level || 'basic' });
    var list = agent.generate(count);
    // 知识点标注（按年级 + 模板桶；本插件自带 level 分档，难度消费按规范跳过，
    // 未标注 q.difficulty 时按标准档 3 计权）
    var KP_BY_GRADE_CAT = {
      1: { solve: 'math-g1-m8-solve-problems', chain: 'math-g1-m8-chain-mixed' },
      2: { solve: 'math-g2-m8-solve-problems', chain: 'math-g2-m8-solve-problems' },
      3: { solve: 'math-g3-m8-g3-times', chain: 'math-g3-m8-g3-times' }
    };
    var kpMap = KP_BY_GRADE_CAT[grade] || null;
    var questions = list.map(function (q) {
      return {
        type: 'word',
        question: q.q,
        q: q.q,
        answer: String(q.a),
        unit: q.unit || '',
        hint: q.hint || '',
        knowledgePointId: (kpMap && q.cat) ? (kpMap[q.cat] || undefined) : undefined,
        render: function (idx) { return renderWordCard(this, idx); },
        check: function (userAnswers, idx) { return checkWordQuestion(this, userAnswers, idx); }
      };
    });
    plugin._lastType = TYPE_NAMES[opts.type || 'solve'] || '混合练习';
    plugin._lastLevel = LEVEL_NAMES[opts.level || 'basic'] || '';
    return questions;
  }

  // ============ 用工厂创建插件（标准契约） ============
  var plugin = _PU.createPlugin({
    id: 'math-word-problems',
    moduleId: 'M8',
    name: '应用题',
    pageSubtitle: '解决实际问题：解决问题、连加连减与加减混合',
    grades: [1, 2, 3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'word' },
    // 声明本插件覆盖的知识点（按年级区分：一年级用 solve-problems/chain-mixed，二年级用 wp-solve，三年级用 g3-m8-g3-times）
    knowledgePoints: {
      1: ['math-g1-m8-solve-problems', 'math-g1-m8-chain-mixed'],
      2: ['math-g2-m8-solve-problems'],
      3: ['math-g3-m8-g3-times']
    },
    columns: 2,

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'solve',
        options: [
          { value: 'solve', label: '解决问题' },
          { value: 'chain', label: '连加连减题' },
          { value: 'mix',   label: '混合练习' }
        ]
      },
      {
        key: 'level',
        label: '难度',
        default: 'basic',
        options: [
          { value: 'basic', label: '初级' },
          { value: 'adv',   label: '中级' },
          { value: 'high',  label: '高级' },
          { value: 'mix',   label: '综合' }
        ]
      }
    ],

    // 标准同步生成
    generateQuestions: function (options) {
      return buildQuestions(options);
    },

    meta: function (opts) {
      return buildMeta(opts);
    }
  });

  // ============ 导出 ============
  global.MathWordProblemAgent = MathWordProblemAgent;  // 引擎（供 Node 测试 / 复用）
  global.__currentPlugin = plugin;             // practice.html / dev/plugin-check.html

  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);