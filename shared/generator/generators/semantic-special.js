/**
 * shared/generator/generators/semantic-special.js — 知识库专项语义生成器（V2.1）
 *
 * 专为新教材补录的语义型知识点提供「语义正确」的专用生成逻辑，
 * 避免泛型生成器（selection-fill / application-word）对非算术语义 KP 输出错误语义题。
 *
 * 本文件内两个生成器：
 *   generator:code-recognition        —— 数字编码（三上综合实践：认识数字编码/编制学号）
 *   generator:equivalent-reasoning    —— 等量代换（三上综合实践：曹冲称象 / 等量代换推理）
 *
 * 挂载点：
 *   - generators/index.js  require + buildAll 合并（frozen 清单，改动需 baseline 重锚）
 *   - generator-registry.js CORE_RECORDS 增补 2 条 native 绑定（frozen 清单，同上）
 *   - selector 无需改动：native binding 最高优先 + 新 id 不触发任何家族硬阻断
 *
 * 输出契约：SemanticQuestion[]（字段与 selection.js buildBase 一致）
 */
'use strict';

var Rng = require('../core/rng.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
}

function buildBase(plan, context, i, extra) {
  var constraints = plan.constraints || {};
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    difficultyParams: {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    data: extra || {}
  };
}

function buildQuestions(plan, context, count, make) {
  var out = [];
  for (var i = 0; i < count; i++) out.push(make(plan, context, i));
  return out;
}

/* ================================================================
 * generator:code-recognition — 数字编码
 * P25-09：名称分派 5 个编码语义子域（身份证/邮政编码/编码特点/实践活动/生活编码），
 * 每类自带 fill/choice/apply 题库（g3-up-u06-k001~k005，ALLOW=fill/choice/apply）。
 * ================================================================ */

/** 名称以 selector 注入的 semanticParams.name 为准；缺省回落生活编码（fail-safe 非 fail-open） */
function codeName(plan) {
  return (plan && plan.semanticParams && plan.semanticParams.name) || '';
}

function codeCategory(name) {
  if (name.indexOf('身份证') !== -1) return 'idcard';
  if (name.indexOf('邮政编码') !== -1 || name.indexOf('邮编') !== -1) return 'postal';
  if (name.indexOf('特点') !== -1) return 'feature';
  if (name.indexOf('实践') !== -1) return 'practice';
  return 'life';
}

/* 题库：fill/apply 条目 { q, a }；choice 条目 { q, a, o }（o 已含正确项，展示时 shuffle） */
var CODE_BANK = {
  idcard: {
    fill: [
      { q: '身份证号 110101201008151234 中，第 7~14 位表示出生日期，持证人的出生日期是（  ）。', a: '2010年8月15日' },
      { q: '身份证号第 17 位是 3（奇数），说明持证人为（  ）性。', a: '男' },
      { q: '我国第二代居民身份证号码一共有（  ）位。', a: '18位' },
      { q: '身份证号 310104201203054528 的持证人出生日期是（  ）。', a: '2012年3月5日' }
    ],
    choice: [
      { q: '身份证号 110101201008151234 的持证人出生日期是哪一天？', a: '2010年8月15日',
        o: ['2010年8月15日', '2010年8月5日', '2011年8月15日', '2001年8月15日'] },
      { q: '身份证号第 17 位是 4（偶数），持证人性别是？', a: '女',
        o: ['男', '女', '不能确定', '既是男也是女'] },
      { q: '身份证号码的前 6 位表示什么信息？', a: '地址码（户籍地）',
        o: ['出生日期', '地址码（户籍地）', '顺序码', '校验码'] },
      { q: '身份证号码的第 18 位是什么码？', a: '校验码',
        o: ['地址码', '出生日期码', '顺序码', '校验码'] }
    ],
    apply: [
      { q: '警察捡到一张身份证，号码是 110101201008151234。请你帮忙判断：失主出生于哪一年几月几日？是男生还是女生？并写出身份证号每一部分表示的信息。',
        a: '2010年8月15日出生，男性（第17位3为奇数）；前6位地址码、第7~14位出生日期码、第15~17位顺序码、第18位校验码' },
      { q: '银行开户需要登记身份证号 310104201203054528。请说出这位同学的出生年月日，并说明身份证号为什么能唯一确定一个人？',
        a: '2012年3月5日出生；18位编码包含地址、出生日期、顺序码和校验码，全国每人唯一' },
      { q: '小明要填写学籍表，其中有“出生日期”和“性别”两栏，他只记得自己的身份证号是 440103201112200617。请帮他把这两栏填好并说明依据？',
        a: '出生日期2011年12月20日，男性（第17位1为奇数）' }
    ]
  },
  postal: {
    fill: [
      { q: '我国的邮政编码由（  ）位阿拉伯数字组成。', a: '6位' },
      { q: '邮政编码的前两位表示省（自治区、直辖市），前三位表示（  ）。', a: '邮区' },
      { q: '邮政编码的最后两位表示（  ）。', a: '投递局（所）' },
      { q: '寄信时要在信封左上角的方框内填写收信人所在地的（  ）位邮政编码。', a: '6位' }
    ],
    choice: [
      { q: '我国邮政编码一共有几位数字？', a: '6位',
        o: ['4位', '5位', '6位', '8位'] },
      { q: '邮政编码 100000 中，前两位“10”表示哪里？', a: '北京市',
        o: ['上海市', '北京市', '天津市', '重庆市'] },
      { q: '邮政编码的前四位数字表示什么？', a: '县（市）邮局',
        o: ['省（自治区、直辖市）', '邮区', '县（市）邮局', '投递局（所）'] },
      { q: '下面哪个数可能是一个正确的邮政编码？', a: '100000',
        o: ['10000', '100000', '1000000', '100'] }
    ],
    apply: [
      { q: '小红给北京的奶奶寄信，北京的邮政编码以 10 开头（如 100000）。请在信封上写清收信人邮编，并说明邮政编码的 6 位数字分别表示哪几级信息？',
        a: '前2位省（自治区、直辖市）、前3位邮区、前4位县（市）邮局、最后2位投递局（所）' },
      { q: '一封信上写的邮政编码是 310012。请你按编码规则说一说这 6 个数字分别表示什么，机器分拣信件时编码有什么好处？',
        a: '31表示浙江省、310表示所在邮区、3100表示杭州市邮局、12表示投递局；编码规范统一，分拣又快又准' },
      { q: '小明给杭州（邮编 310012）的笔友写信，请你告诉他收信人邮编应写在信封的什么位置，并完整说出 6 位邮编的含义？',
        a: '写在信封左上方框内；31省、310邮区、3100县（市）邮局、12投递局（所）' }
    ]
  },
  feature: {
    fill: [
      { q: '同一个班两位同学的学号不能相同，这体现了数字编码的（  ）性。', a: '唯一' },
      { q: '所有学号都按“入学年份+班级+序号”的统一格式编制，这体现了数字编码的（  ）性。', a: '规范' },
      { q: '用数字编号代替完整书名登记图书，检索更方便，这体现了数字编码的（  ）性。', a: '简洁' },
      { q: '门牌号沿街道从一端到另一端依次增大，这体现了数字编码的（  ）性。', a: '有序' }
    ],
    choice: [
      { q: '全校学生的学号互不相同，主要体现了数字编码的什么特点？', a: '唯一性',
        o: ['唯一性', '规范性', '简洁性', '美观性'] },
      { q: '所有学号都按统一格式“4位年份+2位班级+2位序号”编制，体现了什么特点？', a: '规范性',
        o: ['唯一性', '规范性', '保密性', '随意性'] },
      { q: '图书馆用 6 位数字给图书编号，比书写完整书名更方便快捷，体现了什么特点？', a: '简洁性',
        o: ['简洁性', '唯一性', '规范性', '有序性'] },
      { q: '门牌号按街道方向依次增大，便于查找，体现了数字编码的什么特点？', a: '有序性',
        o: ['唯一性', '规范性', '简洁性', '有序性'] }
    ],
    apply: [
      { q: '学校给每位同学编学号，要求全校不重复、格式统一、还能按入学年份排序查找。请说出这样的学号设计分别利用了数字编码的哪些特点？',
        a: '不重复体现唯一性，格式统一体现规范性，按年份排序体现有序性' },
      { q: '图书馆要给几十万册图书编号，请结合数字编码简洁、唯一、规范、有序的特点，说明为什么用数字编号比直接用书名登记更好？',
        a: '数字编号简洁好记、每书唯一、格式统一、可按顺序排列检索，借阅和盘点都更方便' },
      { q: '快递单上的单号有十几位数字且全国不重复、格式统一。请结合数字编码的特点，说明快递公司为什么要这样编号？',
        a: '唯一性保证每单可查，规范性便于各环节统一处理，简洁有序便于机器分拣和快速追踪' }
    ]
  },
  practice: {
    fill: [
      { q: '按“入学年份4位+班级2位+序号2位”的规则，2024年入学3班序号8的同学学号应编为（  ）。', a: '20240308' },
      { q: '宾馆房间号 302 中，第一位 3 表示楼层，后两位 02 表示（  ）。', a: '第2个房间' },
      { q: '图书编号 A-03-12 中，A 表示类别、03 表示书架号、12 表示（  ）。', a: '第12本书' },
      { q: '停车场车位编号 B2-15 中，B2 表示地下2层，15 表示（  ）。', a: '第15号车位' }
    ],
    choice: [
      { q: '按“年份4位+班级2位+序号2位”的规则，2023年入学5班序号12的同学学号是？', a: '20230512',
        o: ['20230512', '20235012', '05122023', '12052023'] },
      { q: '宾馆用“楼层+两位房间序号”编房号，5楼第18个房间的房号应该是？', a: '518',
        o: ['518', '185', '5018', '1805'] },
      { q: '订单按“年4位+月2位+日2位”编号，2024年3月15日的第1张订单编号可以是？', a: '2024031501',
        o: ['2024031501', '15032024', '31520241', '03150124'] },
      { q: '图书室用“楼层1位+书架2位+层1位”编号，3楼第8架第2层的编号是？', a: '3082',
        o: ['3082', '3820', '2083', '3280'] }
    ],
    apply: [
      { q: '请你为学校图书馆设计一套图书编码：要能看出图书类别、所在楼层和书架序号，并用一个具体例子说明每一位的含义。',
        a: '示例 A-3-05：A 表示类别、3 表示楼层、05 表示第5架（方案不唯一，结构清晰、唯一规范即可）' },
      { q: '请为宾馆房间设计编号规则，使客人一看房号就知道楼层和房间序号，并写出 5 楼第 8 间、12 楼第 3 间的编号。',
        a: '规则：楼层数+两位房间序号；5楼第8间为 508，12楼第3间为 1203' },
      { q: '请为全校同学设计学号，要求包含入学年份、班级、序号和性别信息（末位用 1 表示男、2 表示女），并为 2024 年入学 2 班序号 16 的女生写出一个学号。',
        a: '规则：4位年份+2位班级+2位序号+1位性别；该女生学号如 202402162' },
      { q: '小区地下车库要给每个车位编号，要求从编号能看出楼层、区域和车位序号。请设计规则并给出地下2层B区第15号车位的编号。',
        a: '示例 B2-B-15：B2 表示地下2层、B 表示区域、15 表示车位序号（方案合理即可）' }
    ]
  },
  life: {
    fill: [
      { q: '发现违法犯罪需要报警时，应拨打（  ）电话。', a: '110' },
      { q: '发生火灾时应拨打的火警电话是（  ）。', a: '119' },
      { q: '有人突发疾病需要急救时，应拨打（  ）急救电话。', a: '120' },
      { q: '“京A·12345”是汽车的（  ）号码编码。', a: '车牌' }
    ],
    choice: [
      { q: '发现房屋着火应拨打的电话是？', a: '119',
        o: ['110', '119', '120', '122'] },
      { q: '路上有人突发疾病需要急救，应拨打哪个电话？', a: '120',
        o: ['110', '119', '120', '122'] },
      { q: '下面哪一项属于生活中的数字编码？', a: '车牌号京A·12345',
        o: ['一幅风景画', '车牌号京A·12345', '一首儿歌', '一块橡皮'] },
      { q: '发生交通事故需要报警时，应拨打哪个电话？', a: '122',
        o: ['110', '119', '120', '122'] }
    ],
    apply: [
      { q: '小华在家发现厨房着火了，请你告诉他应该拨打哪个电话，并说出生活中还有哪些常见的数字编码（至少写出 3 个）？',
        a: '应拨打 119；常见数字编码有身份证号码、邮政编码、学号、门牌号、车牌号、电话号码等' },
      { q: '小区门牌号 8-3-201 表示 8 号楼 3 单元 2 层 01 室。请说说你家的住址可以怎样用数字编码表示，这样编码有什么好处？',
        a: '可用“楼号-单元-楼层房号”编码（如 12-2-502）；编码唯一、规范、简洁，便于查找、投递和救援' },
      { q: '妈妈让小明熟记三个特殊服务电话。请你分别写出报警、火警、急救的电话号码，并说明这些短号码为什么要这样编？',
        a: '报警110、火警119、急救120；号码简短规范、全国统一，便于记忆和紧急情况下快速拨打' }
    ]
  }
};

function makeCodeByKind(plan, context, i, qt) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var cat = codeCategory(codeName(plan));
  var bank = CODE_BANK[cat][qt];
  var item = bank[i % bank.length];
  var q = buildBase(plan, context, i, { mode: qt, codeType: cat });
  q.prompt = item.q;
  q.answer = { value: item.a, acceptable: [] };
  if (qt === 'choice') {
    var options = Rng.shuffle(rng, item.o.slice());
    q.data.options = options;
    q.data.correctIndex = options.indexOf(item.a);
    q.answerMode = 'choice';
  }
  return q;
}

function makeCodeFill(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'fill');
}

function makeCodeChoice(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'choice');
}

function makeCodeApply(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'apply');
}

function makeCodeJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var statements = [
    { text: '数字编码的每一位都有特定的含义，不能随意改变。', value: true },
    { text: '数字编码可以用来表示学号、身份证号等信息。', value: true },
    { text: '数字编码的位数越少，表示的信息就越准确。', value: false },
    { text: '同一所学校里，两位同学的学号可以完全相同。', value: false }
  ];
  var s = Rng.pick(rng, statements);
  var q = buildBase(plan, context, i, { mode: 'judge', codeType: 'concept' });
  q.prompt = '判断对错：' + s.text + '（  ）';
  q.answer = { value: s.value, acceptable: [] };
  return q;
}

function createCodeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:code-recognition';
  var generator = {
    id: id,
    subject: 'math',
    // P25-09：摘除 recognize（normList 归一即 geometry，编码题无图形），补 apply；
    // 注册表 CORE_RECORDS 须同步为 fill/choice/judge/apply。
    capabilities: ['fill', 'choice', 'judge', 'apply'],
    questionTypes: ['fill', 'choice', 'judge', 'apply'],
    // P25-06 H2：原 fallback 'math-g3-m10-g3-code' 为模块制 历史 ID（canonical 绑定
    // math-g4-up-u01-k002 在 generator-registry.js CORE_RECORDS，是 SSOT）。
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = plan.count || 1;
      var qt = plan.questionTypeId;
      if (qt === 'choice') return buildQuestions(plan, context, count, makeCodeChoice);
      if (qt === 'apply') return buildQuestions(plan, context, count, makeCodeApply);
      if (qt === 'judge') return buildQuestions(plan, context, count, makeCodeJudge);
      return buildQuestions(plan, context, count, makeCodeFill);
    }
  };
  return generator;
}

function buildAll() {
  return [
    createCodeGenerator()
  ];
}

module.exports = {
  createCodeGenerator: createCodeGenerator,
  buildAll: buildAll
};
