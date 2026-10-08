'use strict';

/**
 * shared/generator/generators/stats.js — Statistics / Data Generator
 *
 * 统计族 Generator：数据收集、统计表、条形图、折线图、扇形图、平均数、可能性
 */

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
  if (context && context.seed != null) return context.seed + ':stats:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':stats:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':stats:' + i;
}

/* ==================================================================
 * P28-HOLLOW-01：25 个统计/分类/概率 KP 的原生形态组
 *
 * 旧 generator:classification 仅有「数字排序」单模板，85 个非 classify 行与统计 KP
 * 语义全部空心。退役后按 kbl/teaching/evidence-rules.json 的形态组在 stats 内原生承接。
 * 形态分派用 STAT_SHAPE 精确查 canonical KP（plan.semanticParams.knowledgePointId 同源），
 * 教学内容由 STAT_THEMES 逐 KP 提供（分类标准/互异标准/结论），题干均带 KP 名称。
 * 同名 KP（g4-down-u08-k003 与 g4-up-u06-k002 均名「复式条形统计图」）证据形态不同，
 * 名称分派无法区分，故形态表按精确 ID 声明，非猜测子串。
 * ================================================================== */

// 形态组 id 与证据规则一一对应（见 kbl/teaching/evidence-rules.json）
var STAT_SHAPE = {
  'math-g2-up-u01-k001': 'classify-geo',   // 分类的含义（低年级几何表征行）
  'math-g2-up-u01-k002': 'classify-geo',   // 单一标准分类
  'math-g2-up-u01-k003': 'classify',       // 不同标准分类
  'math-g2-up-u01-k004': 'classify',       // 逐层分类
  'math-g2-up-u01-k005': 'classify',       // 统计方法
  'math-g2-up-u01-k006': 'classify',       // 简单统计表
  'math-g3-down-u05-k001': 'classify-geo', // 数据的收集方法（几何表征行）
  'math-g3-down-u05-k002': 'classify',     // 数据的整理方法
  'math-g3-down-u05-k003': 'classify',     // 复式统计表
  'math-g3-down-u05-k004': 'classify',     // 统计的应用
  'math-g4-down-u08-k001': 'classify',     // 平均数的意义（禁止 data.operation）
  'math-g4-down-u08-k002': 'classify',     // 求平均数的方法（禁止 data.operation）
  'math-g4-down-u08-k003': 'classify',     // 复式条形统计图（同名 KP，形态=classify）
  'math-g4-down-u08-k004': 'lunch-chart',  // 解决问题——营养午餐
  'math-g4-up-u06-k001': 'bar-single',     // 单式条形统计图（mode=qt/steps=1）
  'math-g4-up-u06-k002': 'bar-double',     // 复式条形统计图（同名 KP，形态=template/operation）
  'math-g4-up-u06-k003': 'bar-double',     // 横向与纵向复式条形统计图
  'math-g4-up-u06-k004': 'classify',       // 读图与数据分析
  'math-g5-up-u07-k001': 'classify',       // 事件发生的确定性与不确定性
  'math-g5-up-u07-k002': 'probability-size',   // 可能性的大小
  'math-g5-up-u07-k003': 'probability-infer',  // 根据可能性大小进行推测（apply 行要 diagram）
  'math-g5-up-u07-k004': 'classify',       // 掷一掷（选学）
  'math-g5-down-u07-k001': 'line-chart',   // 单式折线统计图（steps=1）
  'math-g5-down-u07-k002': 'line-double',  // 复式折线统计图（steps=2）
  'math-g5-down-u07-k003': 'line-analyze'  // 读图与分析（steps=1）
};

// 每个 KP 一套真实分类教学内容：标准、3 个干扰标准、事物、分组、应用结论
function statTheme(criterion, altCriteria, items, groups, conclusion) {
  return { criterion: criterion, altCriteria: altCriteria, items: items,
    groups: groups, conclusion: conclusion };
}

var STAT_THEMES = {
  'math-g2-up-u01-k001': statTheme('颜色', ['形状', '大小', '用途'],
    ['红圆卡', '红方卡', '蓝圆卡', '黄三角卡', '红三角卡', '黄方卡'],
    { '红色': ['红圆卡', '红方卡', '红三角卡'], '蓝色': ['蓝圆卡'], '黄色': ['黄三角卡', '黄方卡'] },
    '分类后不用逐个数，就能很快说出每种颜色的卡片各有几张。'),
  'math-g2-up-u01-k002': statTheme('用途', ['颜色', '长短', '价格'],
    ['铅笔', '橡皮', '尺子', '转笔刀', '水彩笔', '文具盒'],
    { '用来书写': ['铅笔', '水彩笔'], '用来测量': ['尺子'], '用来擦拭或收纳': ['橡皮', '转笔刀', '文具盒'] },
    '全组自始至终只用一个标准分类，结果不重复、不遗漏。'),
  'math-g2-up-u01-k003': statTheme('颜色', ['大小', '材质', '扣眼个数'],
    ['红圆扣', '红方扣', '蓝圆扣', '蓝方扣', '黄圆扣', '黄方扣'],
    { '红色': ['红圆扣', '红方扣'], '蓝色': ['蓝圆扣', '蓝方扣'], '黄色': ['黄圆扣', '黄方扣'] },
    '同一堆纽扣按颜色分是一种结果，还可以换一个标准（形状）再分一次。'),
  'math-g2-up-u01-k004': statTheme('先分动物和植物、再分鱼类和鸟类', ['颜色', '体重', '叫声'],
    ['鲫鱼', '麻雀', '杨树', '鲤鱼', '柳树', '老鹰'],
    { '会游的鱼': ['鲫鱼', '鲤鱼'], '会飞的鸟': ['麻雀', '老鹰'], '树木': ['杨树', '柳树'] },
    '先分成动物、植物两大类，再把动物细分成鱼类和鸟类，这就是逐层分类。'),
  'math-g2-up-u01-k005': statTheme('调查的场合', ['卡片颜色', '同学的身高', '当天的日期'],
    ['举手计数', '画正字记录', '投票表决', '逐个询问', '问卷调查'],
    { '现场快速统计': ['举手计数', '画正字记录', '逐个询问'], '正式调查': ['投票表决', '问卷调查'] },
    '不同统计方法适合不同场合，人少时举手、画正字最快，人多且分散时用问卷。'),
  'math-g2-up-u01-k006': statTheme('天气情况', ['气温高低', '风向', '日期单双'],
    ['周一晴', '周二阴', '周三晴', '周四雨', '周五晴', '周六阴'],
    { '晴天': ['周一晴', '周三晴', '周五晴'], '阴天': ['周二阴', '周六阴'], '雨天': ['周四雨'] },
    '把每天的天气分类填入统计表，一眼就能看出哪种天气最多。'),
  'math-g3-down-u05-k001': statTheme('数据的来源', ['数据的大小', '记录的速度', '纸张的颜色'],
    ['举手统计', '投票统计', '实地测量', '上网查询', '问卷调查'],
    { '直接收集的数据': ['举手统计', '投票统计', '实地测量', '问卷调查'], '间接获取的数据': ['上网查询'] },
    '统计前要先确定收集方法：可以直接调查测量，也可以查阅现成资料。'),
  'math-g3-down-u05-k002': statTheme('喜欢的水果类别', ['姓名笔画', '性别', '所在年级'],
    ['小红喜欢苹果', '小明喜欢香蕉', '小丽喜欢苹果', '小强喜欢葡萄', '小美喜欢香蕉', '小军喜欢苹果'],
    { '喜欢苹果': ['小红喜欢苹果', '小丽喜欢苹果', '小军喜欢苹果'], '喜欢香蕉': ['小明喜欢香蕉', '小美喜欢香蕉'], '喜欢葡萄': ['小强喜欢葡萄'] },
    '原始记录按类别整理并计数后，才能看出喜欢每种水果的各有几人。'),
  'math-g3-down-u05-k003': statTheme('性别加运动项目', ['年龄大小', '当天天气', '器材颜色'],
    ['男生跳绳', '女生跳绳', '男生跑步', '女生踢毽', '男生篮球', '女生跑步'],
    { '男生项目': ['男生跳绳', '男生跑步', '男生篮球'], '女生项目': ['女生跳绳', '女生踢毽', '女生跑步'] },
    '把男生、女生两类数据按同一项目合到一张复式统计表里，才便于比较。'),
  'math-g3-down-u05-k004': statTheme('问题是否需要统计', ['问题字数', '提问时间', '同学性别'],
    ['全班最爱吃什么水果', '1加1等于几', '一个月里雨天有几天', '自己的名字'],
    { '需要统计才能回答': ['全班最爱吃什么水果', '一个月里雨天有几天'], '不用统计就知道': ['1加1等于几', '自己的名字'] },
    '只有需要收集大量数据回答的问题才做统计，不是每个问题都要调查。'),
  'math-g4-down-u08-k001': statTheme('与平均身高130cm比较', ['同学姓氏', '鞋码大小', '头发长短'],
    ['身高125cm', '身高130cm', '身高135cm', '身高140cm', '身高120cm'],
    { '高于平均数': ['身高135cm', '身高140cm'], '等于平均数': ['身高130cm'], '低于平均数': ['身高125cm', '身高120cm'] },
    '平均数代表一组数据的整体水平，数据可以围绕它上下波动。'),
  'math-g4-down-u08-k002': statTheme('分数段', ['考试科目', '字迹是否工整', '考试日期'],
    ['85分', '90分', '95分', '80分', '100分'],
    { '90分及以上': ['90分', '95分', '100分'], '90分以下': ['85分', '80分'] },
    '先求总数再除以人数得到平均数，用分数段整理可以检验平均成绩落在哪一段。'),
  'math-g4-down-u08-k003': statTheme('性别加图书类别', ['图书厚薄', '封面颜色', '借书日期'],
    ['男生借故事书8本', '女生借故事书10本', '男生借科普书6本', '女生借科普书7本'],
    { '男生借书': ['男生借故事书8本', '男生借科普书6本'], '女生借书': ['女生借故事书10本', '女生借科普书7本'] },
    '复式条形图要按两个类别（性别、图书种类）整理数据，长条才能成对比较。'),
  'math-g4-down-u08-k004': statTheme('荤素搭配', ['菜品价格', '餐具颜色', '餐厅名称'],
    ['红烧肉', '清蒸鱼', '炒青菜', '拌黄瓜', '炸鸡腿', '烧豆腐'],
    { '荤菜': ['红烧肉', '清蒸鱼', '炸鸡腿'], '素菜': ['炒青菜', '拌黄瓜', '烧豆腐'] },
    '配菜要荤素搭配，再对照热量和脂肪标准判断套餐是否合格。'),
  'math-g4-up-u06-k001': statTheme('答案的获取方式', ['月份名称', '条形的颜色', '标题的字数'],
    ['哪个月借出最多', '四个月一共借出多少', '最多比最少多多少', '哪个月借出最少'],
    { '看图直接读出': ['哪个月借出最多', '哪个月借出最少'], '需要计算得到': ['四个月一共借出多少', '最多比最少多多少'] },
    '读条形统计图时要分清哪些信息直接读、哪些要先计算。'),
  'math-g4-up-u06-k002': statTheme('是否需要跨组计算', ['项目名称', '图例颜色', '调查年份'],
    ['男生参加篮球的有几人', '男女生参加篮球相差几人', '篮球组一共有几人', '女生参加哪项最多'],
    { '单组直接读取': ['男生参加篮球的有几人', '女生参加哪项最多'], '两组计算得到': ['男女生参加篮球相差几人', '篮球组一共有几人'] },
    '复式条形图既能读单组数据，也能把男女生成对比较或求合计。'),
  'math-g4-up-u06-k003': statTheme('读图步骤的先后', ['直条的颜色', '纸张的大小', '学校名称'],
    ['先看标题知道统计内容', '看图例分清两组直条', '比较成对直条的长短', '读出对应的数据'],
    { '读图准备': ['先看标题知道统计内容', '看图例分清两组直条'], '比较与读数': ['比较成对直条的长短', '读出对应的数据'] },
    '横向和纵向复式条形图只是直条方向不同，数据和读法完全一致。'),
  'math-g4-up-u06-k004': statTheme('统计图能否回答', ['直条粗细', '版面位置', '标点符号'],
    ['喜欢苹果的有多少人', '明天谁会来买水果', '香蕉比梨多几人', '下周气温是多少'],
    { '图中数据能回答': ['喜欢苹果的有多少人', '香蕉比梨多几人'], '图中数据不能回答': ['明天谁会来买水果', '下周气温是多少'] },
    '数据分析只能基于统计图中的数据，没有根据的猜测不能当作结论。'),
  'math-g5-up-u07-k001': statTheme('事件发生的可能性', ['事件字数', '发生地点', '记录方式'],
    ['太阳从东方升起', '明天本地会下雨', '掷一枚硬币正面朝上', '标准大气压下水加热到100℃沸腾', '买彩票中一等奖'],
    { '一定发生': ['太阳从东方升起', '标准大气压下水加热到100℃沸腾'], '可能发生': ['明天本地会下雨', '掷一枚硬币正面朝上', '买彩票中一等奖'] },
    '确定事件一定发生或一定不发生，不确定事件可能发生也可能不发生。'),
  'math-g5-up-u07-k002': statTheme('可能性的大小', ['球的颜色名称', '摸球的先后', '盒子的形状'],
    ['10红1白摸到红球', '10红1白摸到白球', '5红5白摸到红球', '5红5白摸到白球'],
    { '可能性大': ['10红1白摸到红球'], '可能性小': ['10红1白摸到白球'], '可能性相等': ['5红5白摸到红球', '5红5白摸到白球'] },
    '个体在总数中所占数量越多，出现的可能性越大；数量相等时可能性相等。'),
  'math-g5-up-u07-k003': statTheme('由出现次数推测数量多少', ['球的颜色深浅', '球的大小', '摸球的时间'],
    ['摸20次红球16次白球4次', '转指针红色8次蓝色2次', '掷骰子6点只出现1次', '抽奖100次一等奖1次'],
    { '推测数量（机会）多': ['摸20次红球16次白球4次', '转指针红色8次蓝色2次'], '推测数量（机会）少': ['掷骰子6点只出现1次', '抽奖100次一等奖1次'] },
    '重复试验中某结果出现次数多，可以推测它对应的数量可能更多，但推测不是确定结论。'),
  'math-g5-up-u07-k004': statTheme('点数和的可能性大小', ['骰子颜色', '投掷姿势', '桌面材质'],
    ['点数和是2', '点数和是3', '点数和是5', '点数和是7', '点数和是9', '点数和是12'],
    { '可能性大（和为5至9）': ['点数和是5', '点数和是7', '点数和是9'], '可能性小（和为2、3、11、12）': ['点数和是2', '点数和是3', '点数和是12'] },
    '两个骰子点数和的组合数不同，和为5、6、7、8、9的组合多，掷出的可能性更大。'),
  'math-g5-down-u07-k001': statTheme('折线描述的变化方式', ['数据颜色', '网格线粗细', '标题长短'],
    ['周一到周三气温持续上升', '周三到周五气温持平', '周五到周六气温下降', '全周最高气温在周六'],
    { '描述上升、下降或持平': ['周一到周三气温持续上升', '周三到周五气温持平', '周五到周六气温下降'], '描述极值': ['全周最高气温在周六'] },
    '折线的升降陡缓直接反映数据随时间的变化趋势，最高点最低点也要读准。'),
  'math-g5-down-u07-k002': statTheme('单条趋势与双线比较', ['图例颜色', '纸张大小', '城市名称'],
    ['第一条线整体在上升', '两条线的差距在变大', '两条线在周三相交', '只有第二条线在下降'],
    { '描述单条折线趋势': ['第一条线整体在上升', '只有第二条线在下降'], '两条折线对比': ['两条线的差距在变大', '两条线在周三相交'] },
    '复式折线图既要分别看每条线的趋势，又要比较两条线的差距和交点。'),
  'math-g5-down-u07-k003': statTheme('结论是否有数据支撑', ['折线颜色', '坐标格数', '星期的顺序'],
    ['本周气温先降后升', '周末两天温度最低', '周三到周四温差最大', '下周一定会更热'],
    { '有数据支撑的结论': ['本周气温先降后升', '周末两天温度最低', '周三到周四温差最大'], '没有根据的推测': ['下周一定会更热'] },
    '根据折线图分析要对图上每一个点说话，趋势可描述，未来数据不能凭空断定。')
};

function statGroupsArr(theme) {
  return Object.keys(theme.groups).map(function (label) {
    return { label: label, members: theme.groups[label] };
  });
}

function statPartitionText(theme) {
  return statGroupsArr(theme).map(function (g) {
    return g.label + '：' + g.members.join('、');
  }).join('；');
}

function statSq(plan, context, i, prompt, answerVal, answerMode, data, explanation) {
  var answerObj = (typeof answerVal === 'boolean')
    ? { value: answerVal, acceptable: [] }
    : { value: String(answerVal), acceptable: [] };
  if (explanation) answerObj.explanation = explanation;
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: answerMode,
    data: data
  };
}

function statName(plan) {
  return (plan && plan.semanticParams && plan.semanticParams.name) || '统计';
}

/**
 * 纯分类形态组（groups B/C 及 chart/probability 组的 judge/classify 行）：
 * 证据规则要求 fill/apply/judge/choice 也以 data.mode='classify' 承载分类语义，
 * choice 另需 data.sort=true；classify 三件套由 mode=classify+sort+items 自动派生。
 * 每个分支 3 个 i 确定性变式（v=i%3），保证 count=3 的练习不产生重复题。
 */
function makeClassifyShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  var groupsArr = statGroupsArr(theme);
  var list = theme.items.join('、');
  var data = { mode: 'classify', steps: 1, questionType: qt };
  var prompt, answer, explanation, mode = 'input';
  var countsText = groupsArr.map(function (g) { return '「' + g.label + '」' + g.members.length + ' 项'; }).join('，');
  var gMax = groupsArr.slice().sort(function (a, b) { return b.members.length - a.members.length; })[0];

  if (qt === 'classify') {
    data.sort = { by: theme.criterion };
    data.items = theme.items.slice();
    data.groups = theme.groups;
    data.steps = 2;
    if (v === 0) {
      prompt = name + '：把下面的事物按「' + theme.criterion + '」分类整理：' + list
        + '。请写出分类结果。';
      answer = statPartitionText(theme);
    } else if (v === 1) {
      prompt = name + '：把下面的事物按「' + theme.criterion + '」分类：' + list
        + '。分好后数一数，每一类各有多少项？';
      answer = countsText;
    } else {
      prompt = name + '：把下面的事物按「' + theme.criterion + '」分类：' + list
        + '。一共分成几类？哪一类包含的事物最多？';
      answer = '一共 ' + groupsArr.length + ' 类，「' + gMax.label + '」最多，有 ' + gMax.members.length + ' 项';
    }
  } else if (qt === 'fill') {
    // P30-GEN-06（P30-16）：去掉与 classify 共享的「把下面的事物按 criterion 分类」引导前缀，
    // 改用「已知下列事物」起句，只保留项目列表与问式，打散与 classify 的共享 3-gram。
    if (v === 0) {
      prompt = name + '：已知下列事物：' + list
        + '。按「' + theme.criterion + '」划分，「' + groupsArr[0].label + '」这一类有 ____ 项。';
      answer = String(groupsArr[0].members.length);
    } else if (v === 1) {
      prompt = name + '：已知下列事物：' + list
        + '。按「' + theme.criterion + '」划分，「' + groupsArr[1].label + '」这一类有 ____ 项。';
      answer = String(groupsArr[1].members.length);
    } else {
      prompt = name + '：已知下列事物：' + list
        + '。全部参与划分的事物合起来共有 ____ 项。';
      answer = String(theme.items.length);
    }
  } else if (qt === 'apply') {
    data.steps = 2;
    if (v === 0) {
      // P32-AS-16：原句把结论 theme.conclusion 直接写在题面（自问自答）。改为只给任务，
      // 结论作为参考答案/解析在提交后通道呈现；说理任务经 AS-14 边界走家长检查（grade=null）。
      prompt = name + '：先把下面的事物按「' + theme.criterion + '」分类：' + list
        + '。先写出分类结果，再说一说按这个标准分类说明了什么。';
      answer = statPartitionText(theme) + '。' + theme.conclusion;
    } else if (v === 1) {
      prompt = name + '：把下面的事物按「' + theme.criterion + '」分类：' + list
        + '。先完成分类，再数出每一类各有多少项。';
      answer = countsText;
    } else {
      prompt = name + '：把下面的事物按「' + theme.criterion + '」分类：' + list
        + '。哪一类包含的事物最多？比最少的一类多几项？';
      var gMin = groupsArr.slice().sort(function (a, b) { return a.members.length - b.members.length; })[0];
      answer = '「' + gMax.label + '」最多（' + gMax.members.length + ' 项），比「' + gMin.label
        + '」多 ' + (gMax.members.length - gMin.members.length) + ' 项';
    }
  } else if (qt === 'judge') {
    var flat = [];
    groupsArr.forEach(function (g) {
      g.members.forEach(function (m) { flat.push({ item: m, group: g.label }); });
    });
    var pick = flat[v];
    var otherLabels = groupsArr.map(function (g) { return g.label; }).filter(function (l) { return l !== pick.group; });
    var isTrue = v !== 1;
    var shownGroup = isTrue ? pick.group : otherLabels[v % otherLabels.length];
    prompt = name + '：按「' + theme.criterion + '」分类，「' + pick.item + '」应该分到「'
      + shownGroup + '」这一类。这个说法对吗？';
    answer = isTrue;
    mode = 'judge';
    explanation = isTrue
      ? '「' + pick.item + '」按' + theme.criterion + '确实属于「' + pick.group + '」，分类正确。'
      : '「' + pick.item + '」按' + theme.criterion + '应属于「' + pick.group + '」，不是「' + shownGroup + '」，分类错误。';
    if (!isTrue) data.misconception = '分类标准混淆：「' + pick.item + '」按' + theme.criterion
      + '应分到「' + pick.group + '」，误分到了「' + shownGroup + '」。';
  } else { // choice
    data.sort = true;
    data.items = theme.items.slice();
    mode = 'choice';
    if (v === 0) {
      var opts0 = theme.altCriteria.slice(0, 3).concat([theme.criterion]);
      data.options = opts0;
      data.correctIndex = opts0.indexOf(theme.criterion);
      var partition = groupsArr.map(function (g) { return g.label + '（' + g.members.length + '项）'; }).join('、');
      prompt = name + '：小明把下面的事物分成了几组（' + partition + '）：' + list
        + '。他最可能是按哪个标准分类的？';
      answer = theme.criterion;
    } else if (v === 1) {
      var opts1 = [theme.altCriteria[0]].concat(theme.altCriteria.slice(1, 3), [theme.criterion]);
      data.options = opts1;
      data.correctIndex = opts1.indexOf(theme.altCriteria[0]);
      prompt = name + '：对下面的事物做分类：' + list
        + '。下面四个标准中，哪一个最不适合用来给这组事物分类？';
      answer = theme.altCriteria[0];
    } else {
      // 同组配对：锚点取最大类的首个成员，正确项=同类另一成员，干扰项取其他类成员
      var anchorGroup = gMax;
      var anchor = anchorGroup.members[0];
      var partner = anchorGroup.members[1];
      var outsiders = [];
      groupsArr.forEach(function (g) {
        if (g.label === anchorGroup.label) return;
        g.members.forEach(function (m) { outsiders.push(m); });
      });
      var opts2 = [partner].concat(outsiders.slice(0, 3));
      data.options = opts2;
      data.correctIndex = 0;
      prompt = name + '：按「' + theme.criterion + '」分类时，「' + anchor
        + '」所在的那一类还有哪个事物？';
      answer = partner;
    }
  }
  return statSq(plan, context, i, prompt, answer, mode, data, explanation);
}

/** 组 A：低年级几何表征行——分类任务配 unit=cm 的 segment 几何描述符；v=i%3 三变式 */
function makeClassifyGeoShape(plan, context, i, name, theme) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);

  var groupsArr = statGroupsArr(theme);
  var total = theme.items.length;
  var gMax = groupsArr.slice().sort(function (a, b) { return b.members.length - a.members.length; })[0];
  var part = gMax.members.length;
  var rest = total - part;
  // P32-AS-18 延伸：所求段标注遮蔽——线段图只标注已知段，问哪段哪段标 '?'，
  // 防图形把所求量化为已知（§9.2 L2 口径）；judge 的标注是判断主张材料，不遮。
  function geo(unitPx, mask) {
    var params = { total: total, part: part, unit: 'cm',
      partLabel: mask === 'part' ? '?' : String(part),
      totalLabel: mask === 'total' ? '?' : String(total) };
    if (unitPx) params.unitPx = unitPx;
    return { type: 'geometry', subtype: 'segment', role: 'calculation-support', params: params };
  }
  var list = theme.items.join('、');
  var mask = null;
  if (qt === 'fill' || qt === 'choice') mask = v === 0 ? 'part' : (v === 2 ? 'total' : null);
  else if (qt === 'apply') mask = v === 0 ? 'total' : (v === 2 ? 'part' : null);
  var data = { mode: qt, steps: 1, questionType: qt, graphic: geo(qt === 'judge' || qt === 'apply' ? 25 : null, mask) };
  var prompt, answer, explanation, mode = 'input';
  // 三个读数目标：第一段 part / 第二段 rest / 整条 total
  var targets = [
    { label: '第一段', n: part },
    { label: '第二段（另一类）', n: rest },
    { label: '整条线段（一共）', n: total }
  ];

  if (qt === 'fill') {
    var t = targets[v];
    // P32-AS-16：原题面先用文字给出 total/part（「全部 N 个」「红的 N 个分在第一段」），
    // 再问第一段/整条表示几个，自问自答。改由事物清单（list）与线段图承载数据，学生点数作答。
    prompt = name + '：看图，按「' + theme.criterion + '」把事物分成两段，「' + gMax.label
      + '」的事物在第一段。事物：' + list + '。' + t.label + '表示 ____ 个。';
    answer = String(t.n);
  } else if (qt === 'choice') {
    var numPool = [part];
    [rest, total, part - 1, part + 2, rest + 1, total + 1].forEach(function (n) {
      if (n >= 1 && numPool.indexOf(n) === -1 && numPool.length < 4) numPool.push(n);
    });
    var numericOpts = Rng.shuffle(rng, numPool.map(function (n) { return n + '个'; }));
    var tc = targets[v];
    prompt = name + '：看图，线段按「' + theme.criterion + '」把 ' + total + ' 个事物分成两段，'
      + '第一段是「' + gMax.label + '」。' + tc.label + '表示多少个？';
    answer = tc.n + '个';
    data.options = numericOpts;
    data.correctIndex = numericOpts.indexOf(tc.n + '个');
    mode = 'choice';
  } else if (qt === 'judge') {
    var tj = targets[v];
    var isTrue = v !== 1;
    var shownCount = isTrue ? tj.n : tj.n + 1;
    prompt = name + '：看图，有人说' + tj.label + '表示 '
      + shownCount + ' 个' + (tj.label === '第一段' ? '（标出 ' + shownCount + 'cm）' : '') + '。这个说法对吗？';
    answer = isTrue;
    mode = 'judge';
    explanation = isTrue
      ? '图上' + tj.label + '对应的数量就是 ' + tj.n + ' 个，说法正确。'
      : '图上' + tj.label + '对应 ' + tj.n + ' 个，不是 ' + shownCount + ' 个，说法错误。';
    if (!isTrue) data.misconception = '线段图读数错误：' + tj.label + '对应 ' + tj.n
      + ' 个，题中读成了 ' + shownCount + ' 个。';
  } else { // apply，steps=2
    data.steps = 2;
    if (v === 0) {
      // P32-AS-16：原句两次写明 total（问的正是 total），删数量文字，数据走清单与线段图
      prompt = name + '：看图，线段图按「' + theme.criterion + '」分成两段，第一段表示「'
        + gMax.label + '」的事物。事物：' + list + '。先数出另一类有几个，再求两类事物一共多少个。';
      answer = String(total);
    } else if (v === 1) {
      prompt = name + '：看图，整条线段表示 ' + total + ' 个事物，第一段表示「' + gMax.label
        + '」的 ' + part + ' 个。两段表示的数量相差几个？';
      answer = String(Math.abs(part - rest));
    } else {
      // P32-AS-16：原句直接给出第一段数量 part（答案前半），同上改由清单/线段图承载
      prompt = name + '：看图，线段图按「' + theme.criterion + '」分成两段，第一段表示「'
        + gMax.label + '」的事物。事物：' + list + '。两段分别表示多少个？';
      answer = part + '个和' + rest + '个';
    }
  }
  return statSq(plan, context, i, prompt, answer, mode, data, explanation);
}

/** 组 E：单式条形统计图（mode=qt、steps=1，无 graphic 强制；带 chart 增强真实读题） */
var BAR_SINGLE_SERIES = [
  { label: '一月', value: 12 }, { label: '二月', value: 18 },
  { label: '三月', value: 9 }, { label: '四月', value: 15 }
];
function makeBarSingleShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var series = BAR_SINGLE_SERIES;
  var max = series.slice().sort(function (a, b) { return b.value - a.value; })[0];
  var min = series.slice().sort(function (a, b) { return a.value - b.value; })[0];
  var sum = series.reduce(function (acc, s) { return acc + s.value; }, 0);
  var mar = series[2]; // 三月 9 本
  var apr = series[3];
  var graphic = { type: 'chart', subtype: 'bar',
    role: 'data-comparison',
    params: { title: '四年级各班图书角月借阅量', yLabel: '本', data: series } };
  var data = { mode: qt, steps: 1, questionType: qt, graphic: graphic };
  var prompt, answer, explanation, mode = 'input';

  if (qt === 'apply') {
    if (v === 0) {
      prompt = name + '：观察条形统计图，哪个月借出的图书最多？借出多少本？';
      answer = max.label + '，' + max.value + '本';
    } else if (v === 1) {
      prompt = name + '：观察条形统计图，哪个月借出的图书最少？借出多少本？';
      answer = min.label + '，' + min.value + '本';
    } else {
      prompt = name + '：观察条形统计图，这四个月一共借出图书多少本？';
      answer = sum + '本';
    }
  } else if (qt === 'choice') {
    if (v === 2) {
      var optsN = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：观察条形统计图，借出 ' + mar.value + ' 本图书的是哪个月？';
      answer = mar.label;
      data.options = optsN;
      data.correctIndex = optsN.indexOf(mar.label);
    } else {
      var target = v === 0 ? max : min;
      var opts = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：观察条形统计图，借出图书最' + (v === 0 ? '多' : '少') + '的是哪个月？';
      answer = target.label;
      data.options = opts;
      data.correctIndex = opts.indexOf(target.label);
    }
    mode = 'choice';
  } else if (qt === 'fill') {
    if (v === 0) {
      prompt = name + '：观察条形统计图，借出图书最多的月份是____，这个月借出 ____ 本。';
      answer = max.label + '，' + max.value + '本';
    } else if (v === 1) {
      prompt = name + '：观察条形统计图，借出图书最少的月份是____，这个月借出 ____ 本。';
      answer = min.label + '，' + min.value + '本';
    } else {
      prompt = name + '：观察条形统计图，四月借出图书 ____ 本。';
      answer = String(apr.value);
    }
  } else { // judge：三个确定性读数断言
    var claims = [
      { s: apr, shown: apr.value, isTrue: true },
      { s: series[0], shown: apr.value, isTrue: false }, // 一月 12 本≠15
      { s: series[1], shown: series[1].value, isTrue: true } // 二月 18 本
    ];
    var c = claims[v];
    prompt = name + '：看条形图判断：「' + c.s.label + '借出图书 ' + c.shown + ' 本」——对吗？';
    answer = c.isTrue;
    mode = 'judge';
    explanation = c.isTrue
      ? '条形图中' + c.s.label + '对应的借阅量就是 ' + c.s.value + ' 本，说法正确。'
      : '条形图中' + c.s.label + '借阅量是 ' + c.s.value + ' 本，不是 ' + c.shown + ' 本，说法错误。';
    if (!c.isTrue) data.misconception = '条形图读数错误：' + c.s.label + '借阅量应为 ' + c.s.value
      + ' 本，题中读成了 ' + c.shown + ' 本。';
  }
  return statSq(plan, context, i, prompt, answer, mode, data, explanation);
}

/** 组 F：复式条形统计图（apply/fill 要 data.operation；choice/judge 要 data.template） */
var BAR_DOUBLE_SERIES = [
  { label: '篮球', a: 18, b: 10 }, { label: '跳绳', a: 12, b: 16 },
  { label: '跑步', a: 9, b: 7 }, { label: '踢毽', a: 6, b: 13 }
];
function makeBarDoubleShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var series = BAR_DOUBLE_SERIES;
  var basketball = series[0]; // a18 b10
  var rope = series[1];       // a12 b16
  var run = series[2];        // a9 b7
  var kick = series[3];       // a6 b13
  var girlMax = series.slice().sort(function (x, y) { return y.b - x.b; })[0];
  var boyMax = series.slice().sort(function (x, y) { return y.a - x.a; })[0];
  var graphic = { type: 'chart', subtype: 'bar',
    role: 'data-comparison',
    params: { title: '五年级男女生最喜欢的运动', yLabel: '人数', data: series } };
  var data = { mode: qt, steps: 1, questionType: qt, graphic: graphic, template: 'double-bar-compare' };
  var prompt, answer, explanation, mode = 'input';

  if (qt === 'apply') {
    data.operation = 'add';
    data.steps = 2;
    if (v === 0) {
      prompt = name + '：复式条形统计图中，篮球项目男生 ' + basketball.a + ' 人、女生 ' + basketball.b
        + ' 人。参加篮球项目的一共有多少人？列式：' + basketball.a + ' + ' + basketball.b + ' = ？';
      answer = String(basketball.a + basketball.b);
    } else if (v === 1) {
      prompt = name + '：复式条形统计图中，跳绳项目男生 ' + rope.a + ' 人、女生 ' + rope.b
        + ' 人。参加跳绳项目的一共有多少人？列式：' + rope.a + ' + ' + rope.b + ' = ？';
      answer = String(rope.a + rope.b);
    } else {
      var boysTotal = basketball.a + rope.a + run.a + kick.a;
      prompt = name + '：复式条形统计图给出了四个项目的男女生人数。男生参加这四个项目的一共有多少人？'
        + '列式：' + basketball.a + ' + ' + rope.a + ' + ' + run.a + ' + ' + kick.a + ' = ？';
      answer = String(boysTotal);
    }
  } else if (qt === 'fill') {
    data.operation = 'add';
    data.steps = 2;
    if (v === 0) {
      prompt = name + '：复式条形图显示篮球项目男生 ' + basketball.a + ' 人、女生 ' + basketball.b + ' 人，合计 ____ 人';
      answer = String(basketball.a + basketball.b);
    } else if (v === 1) {
      prompt = name + '：复式条形图显示跳绳项目男生 ' + rope.a + ' 人、女生 ' + rope.b + ' 人，合计 ____ 人';
      answer = String(rope.a + rope.b);
    } else {
      var boysTwo = run.a + kick.a;
      prompt = name + '：复式条形图显示跑步男生 ' + run.a + ' 人、踢毽男生 ' + kick.a + ' 人，合计 ____ 人';
      answer = String(boysTwo);
    }
  } else if (qt === 'choice') {
    mode = 'choice';
    if (v === 0) {
      var opts = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：看复式条形统计图，女生参加人数最多的是哪个项目？';
      answer = girlMax.label;
      data.options = opts;
      data.correctIndex = opts.indexOf(girlMax.label);
    } else if (v === 1) {
      var optsB = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：看复式条形统计图，男生参加人数最多的是哪个项目？';
      answer = boyMax.label;
      data.options = optsB;
      data.correctIndex = optsB.indexOf(boyMax.label);
    } else {
      var totalB = basketball.a + basketball.b;
      var numOpts = Rng.shuffle(rng, [totalB, totalB - 2, totalB + 2, totalB + 4].map(function (n) { return n + '人'; }));
      prompt = name + '：看复式条形统计图，参加篮球项目的一共有多少人？';
      answer = totalB + '人';
      data.options = numOpts;
      data.correctIndex = numOpts.indexOf(totalB + '人');
    }
  } else { // judge：三个确定性断言；data.template + data.shownAnswer
    var gap = basketball.a - basketball.b;
    var ropeGap = rope.b - rope.a;
    var claims = [
      { text: '篮球项目男生比女生多 ' + gap + ' 人', shownAnswer: gap, isTrue: true },
      { text: '篮球项目男生比女生多 ' + (gap + 1) + ' 人', shownAnswer: gap + 1, isTrue: false },
      { text: '跳绳项目女生比男生多 ' + ropeGap + ' 人', shownAnswer: ropeGap, isTrue: true }
    ];
    var c = claims[v];
    prompt = name + '：看复式条形图判断：「' + c.text + '」——对吗？';
    answer = c.isTrue;
    data.shownAnswer = c.shownAnswer;
    mode = 'judge';
    explanation = c.isTrue
      ? '对照复式条形图读数，' + c.text + '，说法正确。'
      : '对照复式条形图，篮球男女生相差 ' + gap + ' 人，不是 ' + c.shownAnswer + ' 人，说法错误。';
    if (!c.isTrue) data.misconception = '复式条形图比较错误：篮球男女生相差 ' + gap
      + ' 人，题中说成了 ' + c.shownAnswer + ' 人。';
  }
  return statSq(plan, context, i, prompt, answer, mode, data, explanation);
}

/** 组 D：营养午餐（apply/choice/fill 行 mode=apply + questionType + chart；judge/classify 走分类） */
var LUNCH_SERIES = [
  { label: '猪肉炖粉条', value: 2462 }, { label: '炸鸡排', value: 1254 },
  { label: '香菇油菜', value: 911 }, { label: '韭菜豆芽', value: 755 }
];
function makeLunchChartShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'judge' || qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var series = LUNCH_SERIES;
  var pork = series[0], fry = series[1], veg = series[2], bean = series[3];
  var max = series.slice().sort(function (a, b) { return b.value - a.value; })[0];
  var min = series.slice().sort(function (a, b) { return a.value - b.value; })[0];
  var graphic = { type: 'chart', subtype: 'bar',
    role: 'data-comparison',
    params: { title: '常见菜热量（千焦）', yLabel: '千焦', data: series } };
  var data = { mode: 'apply', steps: 1, questionType: qt, graphic: graphic };
  var prompt, answer, mode = 'input';

  if (qt === 'apply') {
    if (v === 0) {
      prompt = name + '：条形图给出了四种菜每份的热量。搭配一份套餐，选炸鸡排和香菇油菜，'
        + '这两个菜一共有多少千焦？';
      answer = String(fry.value + veg.value);
    } else if (v === 1) {
      prompt = name + '：条形图给出了四种菜每份的热量。一份猪肉炖粉条加一份韭菜豆芽，'
        + '这两个菜一共有多少千焦？';
      answer = String(pork.value + bean.value);
    } else {
      prompt = name + '：条形图给出了四种菜每份的热量。热量最高的菜比热量最低的菜多多少千焦？';
      answer = String(max.value - min.value);
    }
  } else if (qt === 'choice') {
    mode = 'choice';
    if (v === 0) {
      var opts = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：看条形图，四种菜中热量最高的是哪一种？';
      answer = max.label;
      data.options = opts;
      data.correctIndex = opts.indexOf(max.label);
    } else if (v === 1) {
      var optsMin = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：看条形图，四种菜中热量最低的是哪一种？';
      answer = min.label;
      data.options = optsMin;
      data.correctIndex = optsMin.indexOf(min.label);
    } else {
      var optsV = Rng.shuffle(rng, series.map(function (s) { return s.label; }));
      prompt = name + '：看条形图，每份热量是 ' + fry.value + ' 千焦的是哪一种菜？';
      answer = fry.label;
      data.options = optsV;
      data.correctIndex = optsV.indexOf(fry.label);
    }
    data.choiceForm = true;
  } else { // fill
    var fills = [
      { dish: bean, ask: '韭菜豆芽' },
      { dish: veg, ask: '香菇油菜' },
      { dish: pork, ask: '猪肉炖粉条' }
    ];
    var f = fills[v];
    prompt = name + '：看条形图，' + f.ask + '每份的热量是 ____ 千焦。';
    answer = String(f.dish.value);
  }
  return statSq(plan, context, i, prompt, answer, mode, data);
}

/** 组 G：折线统计图（apply/choice/fill 行 mode=apply + questionType + chart；judge/classify 走分类） */
var LINE_HIGH = [
  { label: '周一', value: 24 }, { label: '周二', value: 22 }, { label: '周三', value: 26 },
  { label: '周四', value: 28 }, { label: '周五', value: 25 }, { label: '周六', value: 30 },
  { label: '周日', value: 27 }
];
var LINE_LOW = [16, 15, 18, 19, 17, 21, 20];
function makeLineShape(plan, context, i, name, theme, isDouble, isAnalyze) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'judge' || qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var series = isDouble
    ? LINE_HIGH.map(function (s, si) { return { label: s.label, a: s.value, b: LINE_LOW[si] }; })
    : LINE_HIGH.slice();
  var hi = LINE_HIGH.slice().sort(function (x, y) { return y.value - x.value; })[0];
  var lo = LINE_HIGH.slice().sort(function (x, y) { return x.value - y.value; })[0];
  var graphic = { type: 'chart', subtype: 'line',
    role: 'data-comparison',
    params: { title: isDouble ? '一周最高气温与最低气温' : '一周气温变化', data: series } };
  var applySteps = isDouble ? 2 : 1;
  var data = { mode: 'apply', steps: applySteps, questionType: qt, graphic: graphic };
  var prompt, answer, mode = 'input';
  var highSum = LINE_HIGH.reduce(function (acc, s) { return acc + s.value; }, 0); // 182
  var fri = LINE_HIGH[4]; // 周五 25

  if (qt === 'apply') {
    if (isDouble) {
      var satA = series[5].a, satB = series[5].b;
      if (v === 0) {
        prompt = name + '：看复式折线统计图（实线最高气温、虚线最低气温）。'
          + '先读出周六的两个气温，再算周六最高气温比最低气温高多少℃？';
        answer = (satA - satB) + '℃';
      } else if (v === 1) {
        prompt = name + '：看复式折线统计图（实线最高气温、虚线最低气温）。'
          + '周六的最高气温和最低气温分别是多少℃？这两个气温一共是多少℃？';
        answer = satA + '℃和' + satB + '℃，一共' + (satA + satB) + '℃';
      } else {
        prompt = name + '：看复式折线统计图，这一周出现过的最高气温和最低气温各是多少℃？相差多少℃？';
        var wHi = LINE_HIGH.slice().sort(function (x, y) { return y.value - x.value; })[0].value;
        var wLo = LINE_LOW.slice().sort(function (x, y) { return x - y; })[0];
        answer = '最高 ' + wHi + '℃，最低 ' + wLo + '℃，相差 ' + (wHi - wLo) + '℃';
      }
    } else if (isAnalyze) {
      if (v === 0) {
        prompt = name + '：看折线统计图，说一说这一周气温整体怎样变化？最高、最低分别出现在哪天、是多少℃？';
        answer = '周二降到最低 ' + lo.value + '℃，随后波动上升，周六最高 ' + hi.value + '℃';
      } else if (v === 1) {
        prompt = name + '：看折线统计图，这一周气温最高的是星期几？是多少℃？';
        answer = hi.label + '，' + hi.value + '℃';
      } else {
        prompt = name + '：看折线统计图，这一周气温最低的是星期几？是多少℃？';
        answer = lo.label + '，' + lo.value + '℃';
      }
    } else {
      if (v === 0) {
        prompt = name + '：看折线统计图，气温最高的是星期几？是多少℃？';
        answer = hi.label + '，' + hi.value + '℃';
      } else if (v === 1) {
        prompt = name + '：看折线统计图，气温最低的是星期几？是多少℃？';
        answer = lo.label + '，' + lo.value + '℃';
      } else {
        prompt = name + '：看折线统计图，这一周的最高气温（每天一个）加起来一共是多少℃？';
        answer = highSum + '℃';
      }
    }
  } else if (qt === 'choice') {
    mode = 'choice';
    data.choiceForm = true;
    var target;
    if (v === 0) target = hi;
    else if (v === 1) target = lo;
    else target = fri;
    var opts = Rng.shuffle(rng, LINE_HIGH.map(function (s) { return s.label; }));
    prompt = v === 2
      ? name + '：看折线统计图，最高气温是 ' + fri.value + '℃ 的是星期几？'
      : name + '：看折线统计图，' + (v === 0 ? '最高气温' : '最低气温') + '出现在星期几？';
    answer = target.label;
    data.options = opts;
    data.correctIndex = opts.indexOf(target.label);
  } else { // fill
    if (v === 0) {
      prompt = name + '：看折线统计图填空：这一周的最高气温是 ____ ℃，出现在星期____。';
      answer = hi.value + '℃，' + hi.label;
    } else if (v === 1) {
      prompt = name + '：看折线统计图填空：这一周的最低气温是 ____ ℃，出现在星期____。';
      answer = lo.value + '℃，' + lo.label;
    } else {
      prompt = name + '：看折线统计图填空：周四的最高气温是 ____ ℃。';
      answer = LINE_HIGH[3].value + '℃';
    }
  }
  return statSq(plan, context, i, prompt, answer, mode, data);
}

/** 组 H：可能性的大小（apply/choice/fill 行 mode=apply + questionType；judge/classify 走分类） */
function makeProbabilitySizeShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt === 'judge' || qt === 'classify') return makeClassifyShape(plan, context, i, name, theme);
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var bag = { '红球': 8, '白球': 3, '黄球': 1 };
  var colors = Object.keys(bag);
  var maxColor = colors.slice().sort(function (a, b) { return bag[b] - bag[a]; })[0];
  var minColor = colors.slice().sort(function (a, b) { return bag[a] - bag[b]; })[0];
  var data = { mode: 'apply', steps: 1, questionType: qt };
  var prompt, answer, mode = 'input';
  var desc = colors.map(function (c) { return bag[c] + '个' + c; }).join('、');
  var total = colors.reduce(function (acc, c) { return acc + bag[c]; }, 0);
  // P30-GEN-06（P30-16）：同 KP 跨题型共享「盒子里有…」长前缀会导致 sim≥0.85，
  // 按题型换容器措辞打散共享 3-gram。
  var boxLead = qt === 'apply' ? '盒子里有 ' : (qt === 'choice' ? '袋中有 ' : '一个盒里放着 ');
  var touch = qt === 'apply' ? '任意摸出' : '随便摸';

  if (qt === 'apply') {
    if (v === 0) {
      prompt = name + '：' + boxLead + desc + '（球除颜色外完全相同），' + touch + '一个球，'
        + '摸到哪种颜色球的可能性最大？为什么？';
      answer = maxColor + '；' + maxColor + '数量最多，所以摸到的可能性最大';
    } else if (v === 1) {
      prompt = name + '：' + boxLead + desc + '（球除颜色外完全相同），' + touch + '一个球，'
        + '摸到哪种颜色球的可能性最小？为什么？';
      answer = minColor + '；' + minColor + '数量最少，所以摸到的可能性最小';
    } else {
      prompt = name + '：' + boxLead + desc + '（球除颜色外完全相同），' + touch + '一个球，'
        + '摸到可能性最大的球和可能性最小的球各是什么颜色？';
      answer = '可能性最大的是' + maxColor + '，可能性最小的是' + minColor;
    }
  } else if (qt === 'choice') {
    mode = 'choice';
    data.choiceForm = true;
    if (v === 0) {
      var opts = Rng.shuffle(rng, colors.slice());
      prompt = name + '：' + boxLead + desc + '，' + touch + '一个球，摸到哪种球的可能性最大？';
      answer = maxColor;
      data.options = opts;
      data.correctIndex = opts.indexOf(maxColor);
    } else if (v === 1) {
      var optsMin = Rng.shuffle(rng, colors.slice());
      prompt = name + '：' + boxLead + desc + '，' + touch + '一个球，摸到哪种球的可能性最小？';
      answer = minColor;
      data.options = optsMin;
      data.correctIndex = optsMin.indexOf(minColor);
    } else {
      var optsN = Rng.shuffle(rng, colors.slice());
      prompt = name + '：' + boxLead + desc + '，' + touch + '一个球，摸到数量有 ' + bag['白球'] + ' 个的是哪种球？';
      answer = '白球';
      data.options = optsN;
      data.correctIndex = optsN.indexOf('白球');
    }
  } else { // fill
    if (v === 0) {
      prompt = name + '：' + boxLead + desc + '，' + touch + '一个球，摸到____球的可能性最大。';
      answer = maxColor;
    } else if (v === 1) {
      prompt = name + '：' + boxLead + desc + '，' + touch + '一个球，摸到____球的可能性最小。';
      answer = minColor;
    } else {
      prompt = name + '：' + boxLead + desc + '，一共有 ____ 个球。';
      answer = String(total);
    }
  }
  return statSq(plan, context, i, prompt, answer, mode, data);
}

/** 组 I：根据可能性推测——apply 行要 diagram 图（unit=个）；其余走分类形态；v=i%3 三变式 */
function makeProbabilityInferShape(plan, context, i, name, theme) {
  var qt = plan.questionTypeId;
  var v = ((i % 3) + 3) % 3;
  if (qt !== 'apply') return makeClassifyShape(plan, context, i, name, theme);
  var red = 16, white = 4;
  var graphic = { type: 'diagram', subtype: 'brace',
    role: 'calculation-support',
    params: { left: red, right: white, unit: '个' } };
  var data = { mode: 'apply', steps: 1, questionType: 'apply', graphic: graphic };
  var intro = name + '：盒子里装有红球和白球（每组小球表示 1 个，左组●是红球 ' + red
    + ' 个，右组○是白球 ' + white + ' 个，见下图）。小组做摸球试验，每次摸一个、记下颜色后放回，'
    + '重复 20 次，结果摸到红球 16 次、白球 4 次。';
  var prompt, answer;
  if (v === 0) {
    prompt = intro + '根据试验结果推测：盒中哪种球可能更多？再摸一次最可能摸到什么球？';
    answer = '红球可能更多，再摸一次最可能摸到红球';
  } else if (v === 1) {
    prompt = intro + '根据试验结果推测：盒中红球和白球哪种可能更少？为什么？';
    answer = '白球可能更少；试验中摸到白球只有 4 次，明显少于红球的 16 次';
  } else {
    prompt = intro + '20 次试验中摸到红球的次数比白球多几次？据此推测盒中哪种球可能更多？';
    answer = '多 ' + (red - white) + ' 次；推测红球可能更多';
  }
  return statSq(plan, context, i, prompt, answer, 'input', data);
}

function makeShapedStatsQuestion(plan, context, i) {
  var kpId = (plan.semanticParams && plan.semanticParams.knowledgePointId) || pkp(plan);
  var shape = STAT_SHAPE[kpId];
  var name = statName(plan);
  var theme = STAT_THEMES[kpId];
  switch (shape) {
    case 'classify':
      return makeClassifyShape(plan, context, i, name, theme);
    case 'classify-geo':
      return makeClassifyGeoShape(plan, context, i, name, theme);
    case 'bar-single':
      return makeBarSingleShape(plan, context, i, name, theme);
    case 'bar-double':
      return makeBarDoubleShape(plan, context, i, name, theme);
    case 'lunch-chart':
      return makeLunchChartShape(plan, context, i, name, theme);
    case 'line-chart':
      return makeLineShape(plan, context, i, name, theme, false, false);
    case 'line-double':
      return makeLineShape(plan, context, i, name, theme, true, false);
    case 'line-analyze':
      return makeLineShape(plan, context, i, name, theme, false, true);
    case 'probability-size':
      return makeProbabilitySizeShape(plan, context, i, name, theme);
    case 'probability-infer':
      return makeProbabilityInferShape(plan, context, i, name, theme);
    default:
      return null;
  }
}

function makeStatsQuestion(plan, context, i, kp) {
  var shapedId = (plan.semanticParams && plan.semanticParams.knowledgePointId) || pkp(plan);
  if (STAT_SHAPE[shapedId]) return makeShapedStatsQuestion(plan, context, i);
  // P30-GEN-06（P30-16）：把问句改写为填空题面。去掉疑问词「多少/几」并把「=（ ）」
  // 改为「等于____」，使 fill 的 coreStem 与 apply 问句骨架互异（sim<0.85），
  // 同时保留 ____ 以满足 fill 的 blankPresent 契约。长条件块再做同义换词打散共享 3-gram。
  function fillStem(q) {
    return String(q)
      .replace(/是平年还是闰年/g, '属于____年')
      .replace(/哪一年/g, '____年')
      .replace(/哪个/g, '____')
      .replace(/\s*=\s*（\s*）/g, '折合____')
      .replace(/（\s*）/g, '____')
      .replace(/多少/g, '____')
      .replace(/几/g, '____')
      .replace(/指向/g, '指着')
      .replace(/现在/g, '此时')
      .replace(/一共/g, '总共')
      .replace(/从家出发/g, '由家动身')
      .replace(/到达/g, '抵达')
      .replace(/出发/g, '动身')
      .replace(/任意摸出/g, '随便摸')
      .replace(/[？?]\s*$/g, '');
  }
  // apply：把「A = （ ）B」等式题面改写为文字问法，避免与 choice 的等式选项骨架相撞。
  // 用「合多少」而非「等于多少」，与 calc 的「等于多少？列式：…」区分（sim<0.85）。
  function applyStem(q) {
    return String(q).replace(/(\S+)\s*=\s*（\s*）(\S+)/g, '$1合多少$2？');
  }
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // P25-09：名称以 selector 注入的 semanticParams.name 为准（kp={} 占位曾使分派恒落 chart-read）。
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '统计问题';

  var qt = plan.questionTypeId;
  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  // P25-09：复式（复式折线/复式条形）须先于单式折线，否则被「折线」截胡成单式
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  // P25-09：时间/日历族（顺序敏感：经过→平闰→钟面→单位换算→年月日兜底；
  // 平年闰年含「年」字须先于日历，时间单位先于图表兜底）
  else if (name.indexOf('经过') !== -1) type = 'elapsed-time';
  else if (name.indexOf('平年') !== -1 || name.indexOf('闰年') !== -1) type = 'leap-year';
  else if (name.indexOf('钟面') !== -1 || name.indexOf('时针') !== -1 || name.indexOf('分针') !== -1 || name.indexOf('秒针') !== -1) type = 'clock';
  else if (name.indexOf('时间单位') !== -1 || name.indexOf('时、分、秒') !== -1) type = 'time-convert';
  else if (name.indexOf('年') !== -1 || name.indexOf('月') !== -1) type = 'calendar';
  else if (name.indexOf('统计表') !== -1 || name.indexOf('正字') !== -1 || name.indexOf('收集') !== -1) type = 'data-collect';
  else type = 'chart-read';

  // 确定性数据序列（图表类型共用）
  var PEOPLE_LABELS = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
  var FRUIT_LABELS = ['苹果', '香蕉', '西瓜', '葡萄'];
  var SUBJECT_LABELS = ['语文', '数学', '英语', '科学'];
  var series;
  function buildSeries(labels, lo, hi) {
    return labels.map(function (l) { return { label: l, value: Rng.randInt(rng, lo, hi) }; });
  }
  // P25-09：互异取值序列（choice 问最高/最低时保证答案唯一，选项串也互不相同）
  function distinctSeries(labels, lo, hi) {
    var pool = [];
    for (var v = lo; v <= hi; v++) pool.push(v);
    var picked = Rng.shuffle(rng, pool).slice(0, labels.length);
    return labels.map(function (l, li) { return { label: l, value: picked[li] }; });
  }

  var prompt, answer, steps, graphic;
  var judgeExplanation = null;
  var chOpts = null;
  var data = { mode: 'apply', steps: steps, questionType: qt };
  if (type === 'average') {
    var nums = [];
    for (var ai = 0; ai < 4; ai++) nums.push(Rng.randInt(rng, 20, 100));
    var avg = Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
    prompt = name + '：四个同学的身高分别是' + nums.join('cm、') + 'cm，求他们的平均身高。';
    answer = avg; steps = 2;
  } else if (type === 'probability') {
    var total = Rng.randInt(rng, 6, 12);
    var favorable = Rng.randInt(rng, 1, total - 1);
    prompt = '盒子里有' + total + '个球，其中' + favorable + '个红球，摸到红球的可能性是多少？';
    answer = favorable + '/' + total; steps = 1;
    if (qt === 'choice') {
      // P25-09：分数答案非纯数值，finisher 无法机械建项，源码自建 4 个互异分数选项
      var pPool = [favorable, favorable - 1, favorable + 1, favorable + 2];
      var pSeen = {};
      var pUniq = [];
      pPool.forEach(function (x) {
        if (x >= 1 && x <= total - 1 && !pSeen[x]) { pSeen[x] = 1; pUniq.push(x); }
      });
      var pPad = 1;
      while (pUniq.length < 4) {
        var pCand = ((favorable + pPad * 2) % (total - 1)) + 1;
        if (!pSeen[pCand]) { pSeen[pCand] = 1; pUniq.push(pCand); }
        pPad++;
      }
      chOpts = Rng.shuffle(rng, pUniq.slice(0, 4).map(function (x) { return x + '/' + total; }));
      answer = favorable + '/' + total;
      prompt = name + '：盒子里有' + total + '个球，其中' + favorable + '个红球，其余是白球。摸到红球的可能性是多少？';
      data.choiceForm = true;
    }
  } else if (type === 'line-chart') {
    var wdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    series = distinctSeries(wdays, 18, 35);
    series.sort(function (x, y) { return wdays.indexOf(x.label) - wdays.indexOf(y.label); });
    var hi = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var lo = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var LC_Q = [
      { q: '哪一天的温度最高？最高温度是多少？', a: hi.label + '，' + hi.value + '℃' },
      { q: '哪一天的温度最低？最低温度是多少？', a: lo.label + '，' + lo.value + '℃' },
      { q: '温度最高的一天比最低的一天高多少℃？', a: (hi.value - lo.value) + '℃' }
    ];
    var lcq = LC_Q[i % LC_Q.length];
    prompt = name + '：根据折线图回答：' + lcq.q;
    answer = lcq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'line', role: 'data-comparison', params: { title: '一周气温变化', data: series } };
    if (qt === 'choice') {
      // P25-09：最高/最低日选项取自 7 个数据点（标签互异⇒选项串互异），答案值约定
      var lcTarget = (i % 2 === 0) ? hi : lo;
      chOpts = Rng.shuffle(rng, series.map(function (s) { return s.label + '，' + s.value + '℃'; }));
      answer = lcTarget.label + '，' + lcTarget.value + '℃';
      prompt = name + '：根据折线图回答：' + ((i % 2 === 0) ? '哪一天的温度最高？' : '哪一天的温度最低？') + '（  ）';
      data.choiceForm = true;
    }
  } else if (type === 'bar-chart' || type === 'chart-read') {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiBar = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loBar = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var BAR_Q = [
      { q: '哪个年级的人数最多？多多少？', a: hiBar.label + '，' + hiBar.value + '人' },
      { q: '哪个年级的人数最少？少多少？', a: loBar.label + '，' + loBar.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiBar.value - loBar.value) + '人' }
    ];
    var bq = BAR_Q[i % BAR_Q.length];
    var barLead = qt === 'choice' ? '看条形统计图，' : (qt === 'fill' ? '读条形图填空：' : '根据条形图回答：');
    var barQ = qt === 'fill' ? fillStem(bq.q) : bq.q;
    prompt = name + '：' + barLead + barQ;
    answer = bq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', role: 'data-comparison', params: { title: '各年级人数统计', yLabel: '人数', data: series } };

    // P25-07 题型形态适配：choice/judge/calc 计划下产出对应教育形态
    //（原生只产「读图问答题」，choice 无选项、judge 非布尔、calc 无算式，均不合规）。
    if (plan.questionTypeId === 'choice') {
      var chOpts, chAns;
      if (i % 3 === 2) {
        var diffV = hiBar.value - loBar.value;
        chAns = diffV + '人';
        chOpts = [chAns, (diffV + 1) + '人', (diffV - 1) + '人', (diffV + 2) + '人'];
      } else {
        var targetC = (i % 3 === 0) ? hiBar : loBar;
        chAns = targetC.label + '，' + targetC.value + '人';
        chOpts = series.map(function (s) { return s.label + '，' + s.value + '人'; });
      }
      chOpts = Rng.shuffle(rng, chOpts);
      prompt = name + '：看条形统计图，' + bq.q;
      answer = chAns;
      data.choiceForm = true;
    } else if (plan.questionTypeId === 'judge') {
      var targetJ = (i % 3 === 0) ? hiBar : loBar;
      var isTrueJ = rng() < 0.5;
      var deltaJ = (targetJ.value > 21 && rng() < 0.5) ? -1 : 1;
      var shownJ = isTrueJ ? targetJ.value : targetJ.value + deltaJ;
      prompt = name + '：根据条形图判断：「' + targetJ.label + '有 ' + shownJ + ' 人」——对还是错？';
      answer = isTrueJ;
      judgeExplanation = isTrueJ
        ? '条形图中' + targetJ.label + '对应的人数就是 ' + targetJ.value + ' 人，说法正确。'
        : '条形图中' + targetJ.label + '对应的人数是 ' + targetJ.value + ' 人，不是 ' + shownJ + ' 人，说法错误。';
      if (!isTrueJ) {
        data.misconception = '条形图读数错误：' + targetJ.label + '的人数应为 ' + targetJ.value + ' 人，题中读成了 ' + shownJ + ' 人。';
      }
      data.judgeForm = true;
    } else if (plan.questionTypeId === 'calc') {
      // 列式计算形态：问法收敛为「最多 − 最少」差值，题干内嵌可求值算式
      prompt = name + '：根据条形图列式计算，人数最多的年级比最少的年级多多少人？'
        + '列式：' + hiBar.value + ' − ' + loBar.value + ' = ？';
      answer = hiBar.value - loBar.value;
      data.calcForm = true;
    }
  } else if (type === 'pie-chart') {
    var PIE = [
      { p: [30, 25, 25, 20], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [30, 25, 25, 20], ask: '喜欢数学和英语的一共有多少人？', idx: -1, extra: 45 },
      { p: [40, 20, 25, 15], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [20, 30, 30, 20], ask: '喜欢英语的有多少人？', idx: 2 }
    ];
    // P25-09：choice 改问「占比最大的科目」，只在最大值唯一的变体上轮换（避免双解）
    var pie = (qt === 'choice') ? ((i % 2 === 0) ? PIE[0] : PIE[2]) : PIE[i % PIE.length];
    var pieData = SUBJECT_LABELS.map(function (l, pi) { return { label: l, percent: pie.p[pi] }; });
    var pieAns = pie.idx < 0 ? pie.extra + '人' : pieData[pie.idx].percent + '人';
    prompt = name + '：根据扇形图，如果总人数是100人，' + pie.ask;
    answer = pieAns; steps = 2;
    graphic = { type: 'chart', subtype: 'pie', role: 'data-comparison', params: { title: '最喜欢的科目', data: pieData } };
    if (qt === 'choice') {
      var pieMax = pieData.slice().sort(function (x, y) { return y.percent - x.percent; })[0];
      chOpts = Rng.shuffle(rng, SUBJECT_LABELS.slice());
      answer = pieMax.label;
      prompt = name + '：根据扇形图，最喜欢哪一科的人数所占百分比最大？';
      data.choiceForm = true;
    }
  } else if (type === 'double-chart') {
    var dLabels = ['跳绳', '跑步', '踢毽', '篮球'];
    // P25-09：男/女各自取互异且彼此分离的取值，保证「人数最多项」与差距极值唯一
    var aVals = Rng.shuffle(rng, [16, 22, 28, 35]);
    var bVals = Rng.shuffle(rng, [18, 24, 31, 37]);
    series = dLabels.map(function (l, di) {
      return { label: l, a: aVals[di], b: bVals[di] };
    });
    var gapMax = series.slice().sort(function (x, y) {
      return Math.abs(y.a - y.b) - Math.abs(x.a - x.b);
    })[0];
    var gapMin = series.slice().sort(function (x, y) {
      return Math.abs(x.a - x.b) - Math.abs(y.a - y.b);
    })[0];
    var DC_Q = [
      { q: '男生和女生在哪一项上的差距最大？', a: gapMax.label + '（差 ' + Math.abs(gapMax.a - gapMax.b) + ' 人）' },
      { q: '男生和女生在哪一项上的差距最小？', a: gapMin.label + '（差 ' + Math.abs(gapMin.a - gapMin.b) + ' 人）' },
      { q: '男生在哪一项上参加的人数最多？', a: series.slice().sort(function (x, y) { return y.a - x.a; })[0].label + '（' + series.slice().sort(function (x, y) { return y.a - x.a; })[0].a + ' 人）' }
    ];
    var dcq = DC_Q[i % DC_Q.length];
    prompt = name + '：复式统计图中，' + dcq.q;
    answer = dcq.a; steps = 2;
    graphic = {
      type: 'chart',
      subtype: name.indexOf('折线') !== -1 ? 'line' : 'bar',
      role: 'data-comparison',
      params: { title: '男生女生运动情况', yLabel: '人数', data: series }
    };
    if (qt === 'choice') {
      // P25-09：文本答案无法靠 finisher 建项；问男/女生参加人数最多的项目（4 个互异标签）
      var dcIsBoy = (i % 2 === 0);
      var dcPick = series.slice().sort(function (x, y) {
        return dcIsBoy ? (y.a - x.a) : (y.b - x.b);
      })[0];
      chOpts = Rng.shuffle(rng, dLabels.slice());
      answer = dcPick.label;
      prompt = name + '：复式统计图中，' + (dcIsBoy ? '男生' : '女生') + '参加人数最多的是哪一项？';
      data.choiceForm = true;
    }
  } else if (type === 'data-collect') {
    // R6：数据收集类增加真实语义变体（不同统计对象 / 不同记录方式 / 不同单位），
    // 提升 Effective Capacity（原仅单一水果正字模板 → 去重后容量 ≈1~2）。
    // P25-09：按题型形态产出——choice 问最多/最少类别（标签互异），
    // fill 问合计数值，apply 保留「整理统计表」任务并回答具体结论。
    var TALLY_VARIANTS = [
      { labels: FRUIT_LABELS, title: '最喜欢的果汁', unit: '人', ask: '用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。' },
      { labels: ['跳绳', '跑步', '踢毽', '篮球', '乒乓球'], title: '喜欢的运动', unit: '人', ask: '调查同学们喜欢的运动项目，用画“√”的方法记录，请整理成数据表。' },
      { labels: ['故事书', '科普书', '漫画', '作文书'], title: '图书角类别', unit: '本', ask: '图书角有各类图书，分类清点数量后请填入统计表。' },
      { labels: ['晴', '阴', '雨', '雪'], title: '一周天气', unit: '天', ask: '记录一周的天气情况，用统计表整理各类天气的天数。' }
    ];
    var tv = TALLY_VARIANTS[i % TALLY_VARIANTS.length];
    // 分段取值 + 段内抖动，保证各类数量互异（最多/最少结论唯一）
    var tallyBase = Rng.shuffle(rng, tv.labels.map(function (_, ti) {
      return 12 + ti * 7 + Rng.randInt(rng, 0, 4);
    }));
    series = tv.labels.map(function (l, ti) { return { label: l, value: tallyBase[ti] }; });
    var dcMax = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var dcMin = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var dcTotal = series.reduce(function (acc, s) { return acc + s.value; }, 0);
    graphic = { type: 'chart', subtype: 'bar', role: 'data-comparison', params: { title: tv.title, yLabel: tv.unit, data: series } };
    if (qt === 'choice') {
      var dcAskMax = (i % 2 === 0);
      chOpts = Rng.shuffle(rng, tv.labels.slice());
      answer = dcAskMax ? dcMax.label : dcMin.label;
      prompt = name + '：调查记录整理成统计表后，数量' + (dcAskMax ? '最多' : '最少') + '的是哪一类？';
      data.choiceForm = true;
      steps = 2;
    } else if (qt === 'fill') {
      answer = dcTotal;
      prompt = name + '：' + tv.ask + '表中各类数量一共有多少' + tv.unit + '？（合计：____）';
      steps = 2;
    } else {
      answer = dcMax.label + '（' + dcMax.value + tv.unit + '）';
      prompt = name + '：' + tv.ask + '并回答：数量最多的是哪一类，有多少' + tv.unit + '？';
      steps = 2;
    }
  } else if (type === 'clock') {
    // P25-09：钟面结构 native maker（g2-down-u01-k001，calc/fill/choice/apply）
    steps = 1;
    if (qt === 'calc') {
      var CLK_CALC = [
        { q: '钟面上有12个大格，每个大格有5个小格，整个钟面总共有多少个小格？列式：12 × 5 = ？', a: 60 },
        { q: '分针从12走到6，走了6个大格，一共走了多少分钟？列式：6 × 5 = ？', a: 30 },
        { q: '时针从2走到5，走了几个大格、是多少小时？列式：(5 − 2) × 1 = ？', a: 3 }
      ];
      var clkC = CLK_CALC[i % CLK_CALC.length];
      prompt = name + '：' + clkC.q; answer = clkC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CLK_OPTS = [
        { q: '钟面上一共有多少个大格？', a: '12个', o: ['10个', '11个', '12个', '24个'] },
        { q: '分针走1个大格是多少分钟？', a: '5分钟', o: ['1分钟', '5分钟', '15分钟', '60分钟'] },
        { q: '时针从3走到7，经过了几小时？', a: '4小时', o: ['3小时', '4小时', '5小时', '7小时'] },
        { q: '时针指向8、分针指向12，这时是几时？', a: '8时', o: ['7时', '8时', '9时', '12时'] }
      ];
      var clkO = CLK_OPTS[i % CLK_OPTS.length];
      prompt = name + '：' + clkO.q; answer = clkO.a;
      chOpts = Rng.shuffle(rng, clkO.o); data.choiceForm = true;
    } else {
      var CLK_FILL = [
        { q: '看钟面：时针指向9、分针指向12，现在是几时？', a: '9时' },
        { q: '看钟面：时针走过3、分针指向6，现在是几时几分？', a: '3时30分' },
        { q: '分针从12走到4，走了几个大格？是多少分钟？', a: '4个大格，20分钟' },
        { q: '钟面上一共有多少个大格？每个大格分成几个小格？', a: '12个大格，每个大格5个小格' }
      ];
      var clkF = CLK_FILL[i % CLK_FILL.length];
      prompt = name + '：' + (qt === 'fill' ? fillStem(clkF.q) : applyStem(clkF.q)); answer = clkF.a;
    }
  } else if (type === 'time-convert') {
    // P25-09：时、分、秒单位换算 native maker（g2-down-u01-k002）
    steps = 1;
    if (qt === 'calc') {
      var TC_CALC = [
        { q: '3时等于多少分？列式：3 × 60 = ？', a: 180 },
        { q: '2分等于多少秒？列式：2 × 60 = ？', a: 120 },
        { q: '1时20分等于多少分？列式：60 + 20 = ？', a: 80 },
        { q: '180秒等于多少分？列式：180 ÷ 60 = ？', a: 3 }
      ];
      var tcC = TC_CALC[i % TC_CALC.length];
      prompt = name + '：' + tcC.q; answer = tcC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var TC_OPTS = [
        { q: '3时换算成分是多少？', a: '180分', o: ['30分', '60分', '180分', '300分'] },
        { q: '2分换算成秒是多少？', a: '120秒', o: ['12秒', '60秒', '120秒', '200秒'] },
        { q: '180秒换算成分是多少？', a: '3分', o: ['2分', '3分', '4分', '18分'] },
        { q: '1时15分换算成分是多少？', a: '75分', o: ['60分', '75分', '115分', '150分'] }
      ];
      var tcO = TC_OPTS[i % TC_OPTS.length];
      prompt = name + '：' + tcO.q; answer = tcO.a;
      chOpts = Rng.shuffle(rng, tcO.o); data.choiceForm = true;
    } else {
      var TC_FILL = [
        { q: '4时 = （ ）分', a: '240分' },
        { q: '5分 = （ ）秒', a: '300秒' },
        { q: '120秒 = （ ）分', a: '2分' },
        { q: '1分40秒 = （ ）秒', a: '100秒' }
      ];
      var tcF = TC_FILL[i % TC_FILL.length];
      prompt = name + '：' + (qt === 'fill' ? fillStem(tcF.q) : applyStem(tcF.q)); answer = tcF.a;
    }
  } else if (type === 'elapsed-time') {
    // P25-09：计算简单经过时间 native maker（g2-down-u01-k003）
    steps = 2;
    if (qt === 'calc') {
      var ET_CALC = [
        { q: '小明7:30从家出发，7:45到达学校，经过了多少分钟？列式：45 − 30 = ？', a: 15 },
        { q: '一列火车8:40从甲站开出，9:10到达乙站，经过了多少分钟？列式：(60 − 40) + 10 = ？', a: 30 },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了多少小时？列式：4 − 2 = ？', a: 2 }
      ];
      var etC = ET_CALC[i % ET_CALC.length];
      prompt = name + '：' + etC.q; answer = etC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var ET_OPTS = [
        { q: '小明7:30从家出发，7:45到达学校，他路上用了多长时间？', a: '15分钟', o: ['10分钟', '15分钟', '20分钟', '25分钟'] },
        { q: '一节课8:50开始，9:30结束，这节课有多少分钟？', a: '40分钟', o: ['30分钟', '40分钟', '50分钟', '60分钟'] },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了几小时？', a: '2小时', o: ['1小时', '2小时', '3小时', '4小时'] },
        { q: '小红晚上8:00睡觉，第二天早上6:00起床，她睡了几小时？', a: '10小时', o: ['8小时', '9小时', '10小时', '12小时'] }
      ];
      var etO = ET_OPTS[i % ET_OPTS.length];
      prompt = name + '：' + etO.q; answer = etO.a;
      chOpts = Rng.shuffle(rng, etO.o); data.choiceForm = true;
    } else {
      var ET_FILL = [
        { q: '小明7:30由家动身，7:45抵达学校，路上经过了多少分钟？', a: '15分钟' },
        { q: '一节课8:50开始，9:30结束，这节课上了多少分钟？', a: '40分钟' },
        { q: '妈妈上午8:00上班，在公司工作8小时，妈妈下午几时下班？', a: '下午4:00（16:00）' },
        { q: '一列火车9:10进站，9:55开出，在车站停靠了多少分钟？', a: '45分钟' }
      ];
      var etF = ET_FILL[i % ET_FILL.length];
      // P30-GEN-06（P30-16）：apply 与 fill 共享同一段故事题干会导致 sim≥0.85，
      // apply 单独换词（由家动身→离家、抵达→到达）打散共享 3-gram。
      var etApply = String(etF.q).replace(/由家动身/g, '离家').replace(/抵达/g, '到达');
      prompt = name + '：' + (qt === 'fill' ? fillStem(etF.q) : applyStem(etApply)); answer = etF.a;
    }
  } else if (type === 'calendar') {
    // P25-09：年、月、日基本知识 native maker（g3-down-u06-k001）
    steps = 2;
    if (qt === 'calc') {
      var CAL_CALC = [
        { q: '7月和8月都是大月，两个月一共有多少天？列式：31 + 31 = ？', a: 62 },
        { q: '平年的2月有28天，4月有30天，4月比2月多多少天？列式：30 − 28 = ？', a: 2 },
        { q: '一年有4个小月，每个小月都是30天，4个小月一共有多少天？列式：4 × 30 = ？', a: 120 }
      ];
      var calC = CAL_CALC[i % CAL_CALC.length];
      prompt = name + '：' + calC.q; answer = calC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CAL_OPTS = [
        { q: '下面的月份中，哪个月是有31天的大月？', a: '7月', o: ['4月', '6月', '7月', '11月'] },
        { q: '一年一共有多少个月？', a: '12个月', o: ['10个月', '11个月', '12个月', '24个月'] },
        { q: '11月一共有多少天？', a: '30天', o: ['28天', '29天', '30天', '31天'] },
        { q: '平年全年一共有多少天？', a: '365天', o: ['364天', '365天', '366天', '400天'] }
      ];
      var calO = CAL_OPTS[i % CAL_OPTS.length];
      prompt = name + '：' + calO.q; answer = calO.a;
      chOpts = Rng.shuffle(rng, calO.o); data.choiceForm = true;
    } else {
      var CAL_FILL = [
        { q: '一年有多少个月？哪几个月是有31天的大月？', a: '12个月；1月、3月、5月、7月、8月、10月、12月是大月' },
        { q: '4月有多少天？它是大月还是小月？', a: '30天，是小月' },
        { q: '6月1日的前一天是几月几日？', a: '5月31日' },
        { q: '7月和8月是连续的两个大月，两个月一共有多少天？', a: '62天' }
      ];
      var calF = CAL_FILL[i % CAL_FILL.length];
      prompt = name + '：' + (qt === 'fill' ? fillStem(calF.q) : applyStem(calF.q)); answer = calF.a;
    }
  } else if (type === 'leap-year') {
    // P25-09：平年与闰年判断 native maker（g3-down-u06-k002）
    steps = 2;
    if (qt === 'calc') {
      var LY_CALC = [
        { q: '闰年全年有多少天？（7个大月、4个小月，2月29天）列式：7 × 31 + 4 × 30 + 29 = ？', a: 366 },
        { q: '平年全年有多少天？（7个大月、4个小月，2月28天）列式：7 × 31 + 4 × 30 + 28 = ？', a: 365 },
        { q: '闰年的2月比平年的2月多多少天？列式：29 − 28 = ？', a: 1 }
      ];
      var lyC = LY_CALC[i % LY_CALC.length];
      prompt = name + '：' + lyC.q; answer = lyC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var LY_OPTS = [
        { q: '下面哪一年是闰年？', a: '2024年', o: ['2021年', '2022年', '2023年', '2024年'] },
        { q: '下面哪一年是平年？', a: '2023年', o: ['2016年', '2020年', '2023年', '2024年'] },
        { q: '下面哪个整百年份是闰年？', a: '2000年', o: ['1900年', '2000年', '2100年', '2200年'] },
        { q: '闰年的2月有多少天？', a: '29天', o: ['28天', '29天', '30天', '31天'] }
      ];
      var lyO = LY_OPTS[i % LY_OPTS.length];
      prompt = name + '：' + lyO.q; answer = lyO.a;
      chOpts = Rng.shuffle(rng, lyO.o); data.choiceForm = true;
    } else {
      // P32-AS-14：fill 只判可判短答（short/acc），完整说理放 explanation（提交后通道）；
      // apply 保留完整参考答案（说理开放题，gradeUserAnswer 依长文本边界返回 null→家长检查）。
      // 第 3 题原题含两问（多少天+多几天），fill 只有一个作答位，收敛为单问。
      var LY_FILL = [
        { q: '2024年是平年还是闰年？写出判断理由。', short: '闰年', acc: [], a: '闰年；2024 ÷ 4 = 506，没有余数，公历年份是4的倍数的一般是闰年' },
        { q: '1900年是平年还是闰年？为什么？', short: '平年', acc: [], a: '平年；整百年份必须是400的倍数才是闰年，1900不是400的倍数' },
        { q: '闰年全年有多少天？', short: '366', acc: ['366天'], a: '闰年全年有 366 天（7×31+4×30+29），比平年多 1 天' },
        { q: '小明是2016年2月29日出生的，他下一次能在2月29日过生日是哪一年？', short: '2020年', acc: ['2020'], a: '2020 年（2016 + 4 = 2020，4 年一闰）' }
      ];
      var lyF = LY_FILL[i % LY_FILL.length];
      prompt = name + '：' + (qt === 'fill' ? fillStem(lyF.q) : applyStem(lyF.q));
      if (qt === 'fill') {
        answer = lyF.short;
        var lyAcceptable = lyF.acc.slice();
        var lyExplain = lyF.a;
      } else {
        answer = lyF.a;
      }
    }
  } else {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiRead = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loRead = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var READ_Q = [
      { q: '人数最多的年级是哪一年级？有多少人？', a: hiRead.label + '，' + hiRead.value + '人' },
      { q: '人数最少的年级是哪一年级？有多少人？', a: loRead.label + '，' + loRead.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiRead.value - loRead.value) + '人' }
    ];
    var rq = READ_Q[i % READ_Q.length];
    var readStem;
    if (qt === 'fill') readStem = fillStem(rq.q);
    else if (qt === 'choice') readStem = '看条形统计图，' + rq.q;
    else readStem = '根据统计表中的数据，' + applyStem(rq.q);
    prompt = name + '：' + readStem;
    answer = rq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', role: 'data-comparison', params: { title: '各年级人数统计', yLabel: '人数', data: series } };
  }

  if (graphic) data.graphic = graphic;
  data.steps = steps;
  if (data.choiceForm) {
    data.options = chOpts;
    data.correctIndex = chOpts.indexOf(String(answer));
  }
  // V5.1.0：judge 解析挂到 answer.explanation（非 judge 题为 null，不污染其他形态）
  var answerObj = typeof answer === 'boolean'
    ? { value: answer, acceptable: [] }
    : { value: String(answer), acceptable: lyAcceptable || [] };
  if (judgeExplanation) answerObj.explanation = judgeExplanation;
  if (lyExplain) answerObj.explanation = lyExplain; // P32-AS-14：说理 fill 的完整理由走解析通道

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: data.choiceForm ? 'choice' : (data.judgeForm ? 'judge' : 'input'),
    data: data
  };
}

// P25-06 H2：原 STATS_KPS（math-gN-mN-* 模块制 历史 ID）已随旧体系 KP 全部剔除，
// 对 canonical 375 永不命中；绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function createStatsGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:stats';

  return {
    id: id,
    subject: 'math',
    // P25-09：补 fill/choice——数据收集/时间类 native KP 的 ALLOW 含 fill/choice；
    // fill 由 finisher 补空位，choice 读图题在源码内自建选项（bar-chart/chart-read 分支）。
    // P28-HOLLOW-01：25 个统计/分类/概率 KP 的 judge/classify 行由 stats 形态组原生承接。
    capabilities: ['apply', 'calc', 'fill', 'choice', 'judge', 'classify'],
    questionTypes: ['apply', 'calc', 'fill', 'choice', 'judge', 'classify'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeStatsQuestion(plan, context, i, kp));
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

function buildAll() {
  return [createStatsGenerator()];
}

module.exports = {
  createStatsGenerator: createStatsGenerator,
  buildAll: buildAll
};
