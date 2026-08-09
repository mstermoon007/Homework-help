/**
 * MathWordProblemAgent — 小学1-2年级数学应用题模板化生成器
 *
 * 基于结构化模板，支持变量约束解析、难度分级、特殊答案格式。
 * 无状态设计：每个实例仅通过 generate() 返回数据。
 *
 * 用法：
 *   const agent = new MathWordProblemAgent({ grade: 1, difficulty: 'mix' });
 *   const pool = agent.getPool(); // 返回生成器函数数组，兼容现有 generate()
 */
var MathWordProblemAgent = (function () {
  'use strict';

  // ── 随机工具 ──
  function randInt(min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

  // ── 表达式标准化：×→*  ÷→/ ──
  function normalizeExpr(expr) {
    return expr.replace(/×/g, '*').replace(/÷/g, '/');
  }

  // ── 解析变量范围 "1-19" / "1-{20-a}" / "2-81 (是b的整数倍)" ──
  function parseRange(rangeStr, resolved) {
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
      return { min: parseInt(parts[0], 10) || 1, max: parseInt(parts[1], 10) || 1 };
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
    // 分割
    var parts = constraint.split(/[，,]/);
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
      resolved.c = randInt(ab + 1, Math.max(ab + 1, 100));
    },
    'G2H02': function (resolved) {
      // total = b * k + c, k ∈ [1, 20]，total > c
      var k = randInt(1, 20);
      resolved.total = resolved.b * k + resolved.c;
    },
    'G2H04': function (resolved) {
      // b = a + (c-1) * k, k > a（使 years = k - a > 0）
      var k = resolved.a + randInt(1, 5);
      resolved.b = resolved.a + (resolved.c - 1) * k;
    }
  };

  // ── 一年级14个模板 ──
  var G1_TEMPLATES = [
    {
      id: 'T01', difficulty: 'basic', name: '求总数（合并）',
      template: '小明有{a}个{obj}，小华有{b}个{obj}，他们一共有多少个{obj}？',
      vars: { a: '1-19', b: '1-{20-a}', obj: ['苹果','铅笔','气球','糖果','橡皮','尺子','本子','贴纸','花朵','星星'] },
      answer: '{a}+{b}', hint: '把两部分合起来，用加法：{a}+{b}={ans}',
      unit: '个', constraint: 'a+b<=20'
    },
    {
      id: 'T02', difficulty: 'basic', name: '求剩余',
      template: '{place}原来有{total}个{obj}，{person}拿走了{take}个，还剩几个？',
      vars: { total: '2-20', take: '1-{total-1}', obj: ['积木','饼干','本子','糖果','鸡蛋','橘子'], place: ['桌子上','篮子里','盒子里','盘子里'], person: ['妈妈','爸爸','老师','小明','小红'] },
      answer: '{total}-{take}', hint: '从总数里去掉拿走的，用减法：{total}-{take}={ans}',
      unit: '个', constraint: 'total>take'
    },
    {
      id: 'T03', difficulty: 'basic', name: '求相差数（比多少）',
      template: '{A}有{a}个{obj}，{B}有{b}个{obj}，{A}比{B}多几个？',
      vars: { A: ['哥哥','小明','小华','小红'], B: ['弟弟','小丽','小刚','小美'], a: '2-20', b: '1-{a-1}', obj: ['糖','卡片','花','气球','铅笔','贴纸'] },
      answer: '{a}-{b}', hint: '求谁比谁多，用减法：{a}-{b}={ans}',
      unit: '个', constraint: 'a>b'
    },
    {
      id: 'T04', difficulty: 'basic', name: '求比一个数多几的数',
      template: '小红做了{a}朵花，小丽比小红多做了{b}朵，小丽做了多少朵？',
      vars: { a: '1-18', b: '1-{20-a}' },
      answer: '{a}+{b}', hint: '比{a}多{b}，用加法：{a}+{b}={ans}',
      unit: '朵', constraint: 'a+b<=20'
    },
    {
      id: 'T05', difficulty: 'basic', name: '加减混合',
      template: '树上有{a}只鸟，飞走了{b}只，又飞来{c}只，现在树上有多少只鸟？',
      vars: { a: '2-20', b: '1-{a-1}', c: '1-{20-a+b}' },
      answer: '{a}-{b}+{c}', hint: '先减去飞走的，再加上飞来的：{a}-{b}+{c}={ans}',
      unit: '只', constraint: 'a-b>=0 and a-b+c<=20'
    },
    {
      id: 'T06', difficulty: 'adv', name: '逆向求原来（反向加法）',
      template: '妈妈买来一些{obj}，吃了{a}个，还剩{b}个，妈妈原来买了多少个{obj}？',
      vars: { a: '1-19', b: '1-{20-a}', obj: ['苹果','橘子','草莓','饼干','糖'] },
      answer: '{a}+{b}', hint: '吃了的加上剩下的就是原来的：{a}+{b}={ans}',
      unit: '个', constraint: 'a+b<=20'
    },
    {
      id: 'T07', difficulty: 'adv', name: '连加',
      template: '{place}原来有{a}辆{obj}，先开来{b}辆，又开来{c}辆，现在有多少辆{obj}？',
      vars: { a: '1-18', b: '1-{20-a}', c: '1-{20-a-b}', obj: ['车'], place: ['停车场','车库'] },
      answer: '{a}+{b}+{c}', hint: '把三部分加起来：{a}+{b}+{c}={ans}',
      unit: '辆', constraint: 'a+b+c<=20'
    },
    {
      id: 'T08', difficulty: 'adv', name: '连减',
      template: '篮子里有{total}个{obj}，奶奶做菜用了{a}个，妈妈又用了{b}个，还剩几个？',
      vars: { total: '3-20', a: '1-{total-2}', b: '1-{total-a-1}', obj: ['鸡蛋','土豆','番茄','苹果'] },
      answer: '{total}-{a}-{b}', hint: '连减两次：{total}-{a}-{b}={ans}',
      unit: '个', constraint: 'total-a-b>=0'
    },
    {
      id: 'T09', difficulty: 'adv', name: '排队问题（含自己）',
      template: '同学们排队，小明前面有{a}人，后面有{b}人，这一队一共有多少人？',
      vars: { a: '1-18', b: '1-{19-a}' },
      answer: '{a}+{b}+1', hint: '前面{a}人+小明自己+后面{b}人：{a}+1+{b}={ans}',
      unit: '人', constraint: 'a+b+1<=20'
    },
    {
      id: 'T10', difficulty: 'adv', name: '同数连加（乘法雏形）',
      template: '每个小朋友折了{a}只纸鹤，{n}个小朋友一共折了多少只纸鹤？',
      vars: { a: '2-9', n: '2-5' },
      answer: '{a}*{n}', hint: '{n}个{a}相加：{a}出现了{n}次，一共{ans}只',
      unit: '只', constraint: 'a*n<=100'
    },
    {
      id: 'T11', difficulty: 'adv', name: '人民币简单计算',
      template: '一个{goods}的价格是{price}元，小明付了{pay}元，应找回多少元？',
      vars: { goods: ['文具盒','橡皮','尺子','笔记本','铅笔刀'], price: '1-49', pay: '{price+1}-50' },
      answer: '{pay}-{price}', hint: '付的钱减去商品价格：{pay}-{price}={ans}',
      unit: '元', constraint: 'pay>price'
    },
    {
      id: 'T12', difficulty: 'high', name: '含多余条件',
      template: '小明养了{pet1}{a}条，{pet2}{b}只，死了{c}条{pet1}，还剩几条{pet1}？',
      vars: { pet1: ['金鱼','蚕'], pet2: ['乌龟','小鸡','兔子'], a: '5-20', b: '1-10', c: '1-{a-1}' },
      answer: '{a}-{c}', hint: '注意！{pet2}的数量是多余条件。只算{pet1}：{a}-{c}={ans}',
      unit: '条', constraint: 'a>c'
    },
    {
      id: 'T13', difficulty: 'high', name: '两步计算（先求部分再求总数）',
      template: '小红有{a}本故事书，小丽比小红多{b}本，两人一共有多少本书？',
      vars: { a: '1-48', b: '1-{50-a}' },
      answer: '{a}+({a}+{b})', hint: '先求小丽：{a}+{b}={a+b}，再求两人：{a}+{a+b}={ans}',
      unit: '本', constraint: 'a+b<=50'
    },
    {
      id: 'T14', difficulty: 'high', name: '移多补少问题',
      template: '哥哥有{a}块糖，弟弟有{b}块糖，哥哥给弟弟几块后两人同样多？',
      vars: { a: '2-20', b: '1-{a-2}' },
      answer: '({a}-{b})/2', hint: '先求相差：{a}-{b}={a-b}，再平分：{a-b}÷2={ans}',
      unit: '块', constraint: 'a>b and (a-b)%2==0'
    }
  ];

  // ── 二年级19个模板 ──
  var G2_TEMPLATES = [
    {
      id: 'G2B01', difficulty: 'basic', name: '乘法求总数',
      template: '每组有{a}个{object}，有{b}组，一共有多少个{object}？',
      vars: { a: '2-9', b: '2-9', object: ['同学','气球','铅笔','橡皮','本子','草莓','糖果'] },
      answer: '{a}×{b}',
      hint: '{b}个{a}相加，用乘法：{a}×{b}={ans}',
      unit: '个', constraint: 'a×b<=81'
    },
    {
      id: 'G2B02', difficulty: 'basic', name: '除法（平均分）',
      template: '有{total}个{object}，平均分成{groups}份，每份几个？',
      vars: { total: '2-81', groups: '2-9', object: ['糖果','本子','苹果','橘子','饼干','铅笔'] },
      answer: '{total}÷{groups}',
      hint: '把{total}平均分成{groups}份：{total}÷{groups}={ans}',
      unit: '个', constraint: 'total能被groups整除，total÷groups<=9'
    },
    {
      id: 'G2B03', difficulty: 'basic', name: '除法（包含除）',
      template: '有{total}个{object}，每{per}个放一盘，可以放几盘？',
      vars: { total: '2-81', per: '2-9', object: ['草莓','积木','苹果','橘子','鸡蛋','糖果'] },
      answer: '{total}÷{per}',
      hint: '求{total}里面有几个{per}：{total}÷{per}={ans}',
      unit: '盘', constraint: 'total能被per整除，total÷per<=9'
    },
    {
      id: 'G2B04', difficulty: 'basic', name: '求一个数是另一个数的几倍',
      template: '{A}有{a}{unit}，{B}有{b}{unit}，{A}的{unit}是{B}的几倍？',
      vars: { a: '2-81', b: '1-9', unit: ['朵','张','元','本','只','个'], A: ['小丽','小红','小明','小华','小军'], B: ['小刚','小美','小杰','小芳','小涛'] },
      answer: '{a}÷{b}',
      hint: '求{a}是{b}的几倍：{a}÷{b}={ans}',
      unit: '倍', constraint: 'a是b的整数倍，a÷b<=9'
    },
    {
      id: 'G2B05', difficulty: 'basic', name: '求一个数的几倍是多少',
      template: '{A}有{a}{unit}，{B}的{unit}是{A}的{b}倍，{B}有多少{unit}？',
      vars: { a: '1-9', b: '2-9', unit: ['本','只','张','朵','个'], A: ['小华','小明','小红','小丽'], B: ['小芳','小刚','小杰','小美'] },
      answer: '{a}×{b}',
      hint: '求{a}的{b}倍：{a}×{b}={ans}',
      unit: '', constraint: 'a×b<=81'
    },
    {
      id: 'G2B06', difficulty: 'basic', name: '有余数除法（分物余数）',
      template: '有{total}个{object}，每{per}个分一份，可以分几份？还剩几个？',
      vars: { total: '10-81', per: '2-9', object: ['纽扣','羽毛球','苹果','糖果','积木','鸡蛋'] },
      answer: '{total}÷{per}',
      answer_format: 'remainder',
      hint: '商={q}，余数={r}：{total}÷{per}={q}...{r}',
      unit: '', constraint: 'total不能被per整除，total÷per<=9'
    },
    {
      id: 'G2A01', difficulty: 'adv', name: '乘减问题（付钱找零）',
      template: '笔记本每本{a}元，买了{b}本，付了{c}元，应找回多少元？',
      vars: { a: '2-9', b: '2-9' },
      answer: '{c} - {a}×{b}',
      hint: '总价：{a}×{b}={a*b}，找回：{c}-{a*b}={ans}',
      unit: '元', constraint: 'c>a×b, c<=100'
    },
    {
      id: 'G2A02', difficulty: 'adv', name: '乘加问题（求总钱数）',
      template: '每个{object}{a}元，买了{b}个，又买了1个{object2}花{c}元，一共花了多少钱？',
      vars: { object: ['羽毛球','贴纸','本子','橡皮'], a: '2-9', b: '2-9', c: '1-20', object2: ['球拍','彩笔','书包','文具盒'] },
      answer: '{a}×{b} + {c}',
      hint: '先算买{b}个{object}：{a}×{b}={a*b}，再加{object2}：{a*b}+{c}={ans}',
      unit: '元', constraint: 'a×b+c<=100'
    },
    {
      id: 'G2A03', difficulty: 'adv', name: '乘减问题（比几个几少几）',
      template: '果园里有{a}行桃树，每行{b}棵，梨树比桃树少{c}棵，梨树有多少棵？',
      vars: { a: '2-9', b: '2-9', c: '1-{a*b-1}' },
      answer: '{a}×{b} - {c}',
      hint: '桃树共{a}×{b}={a*b}棵，梨树少{c}棵：{a*b}-{c}={ans}',
      unit: '棵', constraint: 'c<a×b, a×b-c>=0'
    },
    {
      id: 'G2A04', difficulty: 'adv', name: '求比一个数的几倍多几',
      template: '{A}有{a}张贴纸，{B}的贴纸张数是{A}的{b}倍多{c}张，{B}有多少张贴纸？',
      vars: { a: '1-9', b: '2-9', c: '1-20', A: ['小军','小明','小红','小华'], B: ['小杰','小刚','小美','小芳'] },
      answer: '{a}×{b} + {c}',
      hint: '{a}的{b}倍是{a}×{b}={a*b}，再多{c}：{a*b}+{c}={ans}',
      unit: '张', constraint: 'a×b+c<=100'
    },
    {
      id: 'G2A05', difficulty: 'adv', name: '进一法（至少需要几个容器）',
      template: '有{total}个{object}，每个盒子最多装{per}个，至少需要几个盒子才能全部装下？',
      vars: { total: '10-81', per: '2-9', object: ['苹果','橘子','积木','糖果'] },
      answer: 'Math.ceil({total}/{per})',
      hint: '{total}÷{per}={Math.floor(total/per)}...{total%per}，余下的也需要1个盒子，所以至少需要{ans}个',
      unit: '个', constraint: '通常total不能被per整除'
    },
    {
      id: 'G2A06', difficulty: 'adv', name: '去尾法（最多能买几个）',
      template: '每个{object}{price}元，小明有{money}元，最多能买几个？',
      vars: { object: ['面包','玩具','本子','橡皮','铅笔'], price: '3-9', money: '10-50' },
      answer: 'Math.floor({money}/{price})',
      hint: '{money}÷{price}={Math.floor(money/price)}...{money%price}，剩下的钱不够买1个，所以最多买{ans}个',
      unit: '个', constraint: '通常money不能被price整除'
    },
    {
      id: 'G2A07', difficulty: 'adv', name: '两步计算（先加后除）',
      template: '一班有{a}人，二班有{b}人，做操时每{per}人站一排，一共要站几排？',
      vars: { a: '10-45', b: '10-45', per: '3-9' },
      answer: '({a}+{b})÷{per}',
      hint: '总人数：{a}+{b}={a+b}，每{per}人一排：{a+b}÷{per}={ans}',
      unit: '排', constraint: 'a+b能被per整除，(a+b)÷per<=10'
    },
    {
      id: 'G2H01', difficulty: 'high', name: '两步计算（先乘后加，求总和）',
      template: '花园里有{a}行郁金香，每行{b}株，还有{c}株百合，一共有多少株花？',
      vars: { a: '2-9', b: '2-9', c: '1-50' },
      answer: '{a}×{b}+{c}',
      hint: '郁金香：{a}×{b}={a*b}株，加百合：{a*b}+{c}={ans}',
      unit: '株', constraint: 'a×b+c<=200'
    },
    {
      id: 'G2H02', difficulty: 'high', name: '逆向问题（已知几倍多几和结果，求原数）',
      template: '文具店里的书包价格是一个文具盒的{b}倍还多{c}元，书包{total}元，文具盒多少元？',
      vars: { b: '2-6', c: '1-20' },
      answer: '({total}-{c})÷{b}',
      hint: '先减去多的{c}元：{total}-{c}={total-c}，再除以{b}倍：{total-c}÷{b}={ans}',
      unit: '元', constraint: 'total>c, (total-c)能被b整除'
    },
    {
      id: 'G2H03', difficulty: 'high', name: '搭配问题（排列组合）',
      template: '有{a}件上衣，{b}条裤子，每次穿1件上衣和1条裤子，有几种不同的穿法？',
      vars: { a: '2-6', b: '2-6' },
      answer: '{a}×{b}',
      hint: '每件上衣可以搭配{b}条裤子，共{a}×{b}={ans}种穿法',
      unit: '种', constraint: 'a×b<=36'
    },
    {
      id: 'G2H04', difficulty: 'high', name: '年龄问题（年龄差不变）',
      template: '小明今年{a}岁，爸爸今年{b}岁，几年后爸爸的年龄是小明的{c}倍？',
      vars: { a: '5-8', c: '2-5' },
      answer: '({b}-{a})÷({c}-1) - {a}',
      hint: '年龄差{b}-{a}={b-a}岁不变，{c}倍时分母为{c}-1={c-1}，{b-a}÷{c-1}={(b-a)/(c-1)}，再减{a}得{ans}年',
      unit: '年', constraint: '答案为正整数'
    },
    {
      id: 'G2H05', difficulty: 'high', name: '周期问题（找规律）',
      template: '按照△△□○△△□○……的规律排列，第{n}个图形是什么？',
      vars: { n: '10-50' },
      answer: '{n}%4',
      answer_format: 'periodic',
      hint: '周期是4个图形：△△□○。{n}÷4={q}...{r}，余数{r}对应第{r}个图形，即{ans}',
      unit: ''
    },
    {
      id: 'G2H06', difficulty: 'high', name: '移多补少（求移动数）',
      template: '哥哥有{a}块糖，弟弟有{b}块糖，哥哥给弟弟几块后，两人的糖同样多？',
      vars: { a: '10-50', b: '2-{a-2}' },
      answer: '({a}-{b})÷2',
      hint: '先求相差：{a}-{b}={a-b}，再平分：{a-b}÷2={ans}',
      unit: '块', constraint: 'a>b, 差为偶数'
    }
  ];

  // ── 构造函数 ──
  function MathWordProblemAgent(options) {
    options = options || {};
    this.grade = options.grade || 1;
    this.difficulty = options.difficulty || 'mix';
    var templatesByGrade = { 1: G1_TEMPLATES, 2: G2_TEMPLATES };
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
        var range = parseRange(def, resolved);
        var min = Math.max(0, range.min);
        var max = Math.max(min, range.max);
        resolved[k] = randInt(min, max);
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
      depth: tpl.difficulty
    };
  };

  // ── 获取生成器函数池 ──
  MathWordProblemAgent.prototype.getPool = function () {
    var self = this;
    var templates = this._templates;

    if (this.difficulty !== 'mix') {
      templates = templates.filter(function (t) { return t.difficulty === self.difficulty; });
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
      var fn = pool[randInt(0, pool.length - 1)];
      var q = fn();
      attempts++;
      if (!seen[q.q]) {
        seen[q.q] = true;
        questions.push(q);
      }
    }

    while (questions.length < count) {
      var fn2 = pool[randInt(0, pool.length - 1)];
      questions.push(fn2());
    }

    return questions;
  };

  return MathWordProblemAgent;
})();