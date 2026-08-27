/**
 * shared/hanzi-bank.js — 汉字库（任务：语文模块化数据基础）
 *
 * 面向 N2 识字写字模块的题目生成数据源：
 *   characters   会写字条目（按 grade 分档），含笔画/笔顺/结构/部首与关系字段
 *   radicals     常用偏旁及表义
 *   polySemanticExamples   一字多义示例
 *   contextExamples        联系上下文选字（句子 + 选项 + 答案）
 *   dictionaryRules        音序/部首查字法规则与综合示例
 *   phoneticCompounds      形声字示例
 *
 * 字段约定（characters 条目）：
 *   char/pinyin/grade/strokes 必填；
 *   strokeOrder 为笔画名数组（横竖撇点捺提折钩…）；
 *   structure ∈ 独体字 | 左右结构 | 上下结构 | 全包围结构 | 半包围结构；
 *   polyphones/homophones/similar/contexts 可为空数组，逐步补充。
 *
 * 浏览器：window.HanziBank；Node：require 后即得同对象。
 */
(function (global) {
  'use strict';

  function c(char, pinyin, grade, strokes, strokeOrder, structure, radicals, extra) {
    var base = {
      char: char, pinyin: pinyin, grade: grade,
      strokes: strokes, strokeOrder: strokeOrder,
      structure: structure, radicals: radicals,
      polyphones: [], homophones: [], similar: [],
      dictionary: false, contexts: []
    };
    if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  // ============ 会写字（1–3 年级人教版节选，先录基础集再逐步扩充） ============
  var CHARACTERS = [

    // ---- 一年级 ----
    c('一', 'yī', 1, 1, ['横'], '独体字', [], { homophones: ['衣', '医'] }),
    c('二', 'èr', 1, 2, ['横', '横'], '独体字', []),
    c('三', 'sān', 1, 3, ['横', '横', '横'], '独体字', [], { similar: ['王', '丰'] }),
    c('十', 'shí', 1, 2, ['横', '竖'], '独体字', [], { homophones: ['时', '石'], similar: ['千', '土'] }),
    c('口', 'kǒu', 1, 3, ['竖', '横折', '横'], '独体字', ['口'], { similar: ['回', '日'] }),
    c('日', 'rì', 1, 4, ['竖', '横折', '横', '横'], '独体字', ['日'],
      { similar: ['目', '白', '田'], dictionary: true }),
    c('田', 'tián', 1, 5, ['竖', '横折', '横', '竖', '横'], '全包围结构', ['田'],
      { contexts: [{ sentence: '农民伯伯在（　）里种水稻。', options: ['田', '电'], answerIndex: 0 }] }),
    c('月', 'yuè', 1, 4, ['撇', '横折钩', '横', '横'], '独体字', ['月'],
      { polyphones: [{ py: 'yuè', ctx: '月亮' }], homophones: ['乐'] }),
    c('中', 'zhōng', 1, 4, ['竖', '横折', '横', '竖'], '独体字', ['丨'],
      { polyphones: [{ py: 'zhōng', ctx: '中间' }, { py: 'zhòng', ctx: '中奖' }] }),
    c('人', 'rén', 1, 2, ['撇', '捺'], '独体字', ['人'], { similar: ['入', '八'] }),
    c('大', 'dà', 1, 3, ['横', '撇', '捺'], '独体字', ['大'],
      { polyphones: [{ py: 'dà', ctx: '大小' }, { py: 'dài', ctx: '大王（旧读）' }] }),
    c('小', 'xiǎo', 1, 3, ['竖钩', '点', '点'], '独体字', ['小']),
    c('上', 'shàng', 1, 3, ['竖', '横', '横'], '独体字', [],
      { polyphones: [{ py: 'shàng', ctx: '上课' }] }),
    c('下', 'xià', 1, 3, ['横', '竖', '点'], '独体字', []),
    c('木', 'mù', 1, 4, ['横', '竖', '撇', '捺'], '独体字', ['木'],
      { similar: ['术', '本'], dictionary: true }),
    c('水', 'shuǐ', 1, 4, ['竖钩', '横撇', '撇', '捺'], '独体字', ['水']),
    c('火', 'huǒ', 1, 4, ['点', '撇', '撇', '捺'], '独体字', ['火']),
    c('山', 'shān', 1, 3, ['竖', '竖折', '竖'], '独体字', ['山']),
    c('石', 'shí', 1, 5, ['横', '撇', '竖', '横折', '横'], '半包围结构', ['石'],
      { homophones: ['十', '时'] }),
    c('土', 'tǔ', 1, 3, ['横', '竖', '横'], '独体字', ['土'], { similar: ['士', '王'] }),
    c('王', 'wáng', 1, 4, ['横', '横', '竖', '横'], '独体字', ['王'],
      { polyphones: [{ py: 'wáng', ctx: '国王' }] }),

    // ---- 二年级 ----
    c('们', 'men', 2, 5, ['撇', '竖', '点', '竖', '横折钩'], '左右结构', ['亻'],
      { contexts: [{ sentence: '我（　）一起做游戏。', options: ['们', '明'], answerIndex: 0 }] }),
    c('红', 'hóng', 2, 6, ['撇折', '撇折', '提', '横', '竖', '横'], '左右结构', ['纟'],
      { contexts: [{ sentence: '太阳升起来，天边一片（　）色。', options: ['红', '江'], answerIndex: 0 }] }),
    c('好', 'hǎo', 2, 6, ['撇点', '撇', '横', '横撇', '弯钩', '横'], '左右结构', ['女'],
      { polyphones: [{ py: 'hǎo', ctx: '好人' }, { py: 'hào', ctx: '爱好' }],
        homophones: ['郝'] }),
    c('明', 'míng', 2, 8, ['竖', '横折', '横', '横', '撇', '横折钩', '横', '横'], '左右结构',
      ['日', '月'],
      { phonetic: { shape: '日', sound: '月' },
        description: '日月相合，会意明亮。' }),
    c('早', 'zǎo', 2, 6, ['竖', '横折', '横', '横', '横', '竖'], '上下结构', ['日'],
      { homophones: ['枣', '澡'] }),
    c('时', 'shí', 2, 7, ['竖', '横折', '横', '横', '横', '竖钩', '点'], '左右结构', ['日'],
      { homophones: ['十', '石'], dictionary: true }),
    c('画', 'huà', 2, 8, ['横', '竖', '横折', '横', '竖', '横', '竖折', '竖'],
      '半包围结构', ['田'],
      { contexts: [{ sentence: '我画了一朵（　）。', options: ['花', '画'], answerIndex: 0 }] }),
    c('雪', 'xuě', 2, 11,
      ['横', '竖', '横折钩', '竖', '点', '点', '点', '点', '横折', '横', '横'],
      '上下结构', ['雨'],
      { contexts: [{ sentence: '冬天，天上飘下了（　）花。', options: ['雪', '雷'], answerIndex: 0 }] }),

    // ---- 三年级 ----
    c('查', 'chá', 3, 9, ['横', '竖', '撇', '捺', '竖', '横折', '横', '横', '横'],
      '上下结构', ['木'],
      { dictionary: true,
        contexts: [{ sentence: '遇到不认识的字要（　）字典。', options: ['查', '察'], answerIndex: 0 }] }),
    c('晴', 'qíng', 3, 12,
      ['竖', '横折', '横', '横', '横', '横', '竖', '横', '竖', '横折', '横', '横'],
      '左右结构', ['日'],
      { phonetic: { shape: '日', sound: '青' },
        similar: ['清', '睛', '请'],
        contexts: [{ sentence: '今天是个大晴天。', options: ['晴', '清'], answerIndex: 0 }] }),
    c('湖', 'hú', 3, 12,
      ['点', '点', '提', '横', '竖', '竖', '横折', '横', '撇', '横折钩', '横', '横'],
      '左中右结构', ['氵'],
      { phonetic: { shape: '氵', sound: '胡' },
        contexts: [{ sentence: '湖水清澈见底。', options: ['湖', '糊'], answerIndex: 0 }] }),
    c('请', 'qǐng', 3, 10,
      ['点', '横折提', '横', '横', '竖', '横', '竖', '横折', '横', '横'],
      '左右结构', ['讠'],
      { phonetic: { shape: '讠', sound: '青' }, similar: ['清', '晴', '情'],
        contexts: [{ sentence: '（　）你帮我开门。', options: ['请', '清'], answerIndex: 0 }] }),
    c('清', 'qīng', 3, 11,
      ['点', '点', '提', '横', '横', '竖', '横', '竖', '横折', '横', '横'],
      '左右结构', ['氵'],
      { phonetic: { shape: '氵', sound: '青' }, similar: ['请', '晴', '情'],
        contexts: [{ sentence: '小河的水真（　）啊。', options: ['清', '请'], answerIndex: 0 }] }),
    c('圆', 'yuán', 3, 10,
      ['竖', '横折', '横', '竖', '横折', '横', '点', '撇', '横折', '横'],
      '全包围结构', ['囗'],
      { contexts: [{ sentence: '十五的月亮又大又（　）。', options: ['圆', '园'], answerIndex: 0 }] }),
    c('因', 'yīn', 3, 6, ['竖', '横折', '横', '撇', '点', '横'], '全包围结构', ['囗'],
      { homophones: ['音', '阴'] }),
    c('树', 'shù', 3, 9, ['横', '竖', '撇', '捺', '横撇', '捺', '横', '竖钩', '点'],
      '左中右结构', ['木'],
      { contexts: [{ sentence: '操场边有一排大（　）。', options: ['树', '村'], answerIndex: 0 }] }),
    c('样', 'yàng', 3, 10,
      ['横', '竖', '撇', '捺', '点', '撇', '横', '横', '横', '竖'],
      '左右结构', ['木'],
      { polyphones: [{ py: 'yàng', ctx: '样子' }] })
  ];

  // ============ 常用偏旁及表义 ============
  var RADICALS = [
    { radical: '氵', name: '三点水', meaning: '与水有关', examples: ['江', '河', '湖', '清'] },
    { radical: '亻', name: '单人旁', meaning: '与人有关', examples: ['们', '借', '你'] },
    { radical: '口', name: '口字旁', meaning: '与口/说话有关', examples: ['唱', '叫', '请'] },
    { radical: '讠', name: '言字旁', meaning: '与说话/语言有关', examples: ['请', '说', '话'] },
    { radical: '木', name: '木字旁', meaning: '与树木/木质有关', examples: ['树', '林', '样'] },
    { radical: '日', name: '日字旁', meaning: '与太阳/时间有关', examples: ['明', '晴', '时'] },
    { radical: '女', name: '女字旁', meaning: '与女性有关', examples: ['好', '妈', '她'] },
    { radical: '艹', name: '草字头', meaning: '与植物有关', examples: ['花', '草', '蓝'] },
    { radical: '钅', name: '金字旁', meaning: '与金属有关', examples: ['铁', '钱', '银'] },
    { radical: '辶', name: '走之底', meaning: '与行走/移动有关', examples: ['远', '过', '送'] },
    { radical: '囗', name: '围字框', meaning: '包围、范围', examples: ['圆', '因', '国'] },
    { radical: '忄', name: '竖心旁', meaning: '与心理/情感有关', examples: ['快', '情', '惊'] }
  ];

  // ============ 一字多义示例 ============
  var POLY_SEMANTIC_EXAMPLES = [
    { char: '打', senses: [
      { meaning: '击打', example: '打球' },
      { meaning: '撑开', example: '打伞' },
      { meaning: '拨打电话', example: '打电话' } ] },
    { char: '上', senses: [
      { meaning: '位置在高处', example: '桌上' },
      { meaning: '去、到', example: '上学' },
      { meaning: '时间在前', example: '上午' } ] },
    { char: '白', senses: [
      { meaning: '颜色', example: '白雪' },
      { meaning: '明白', example: '真相大白' },
      { meaning: '徒然', example: '白跑一趟' } ] },
    { char: '花', senses: [
      { meaning: '植物的花朵', example: '开花' },
      { meaning: '用掉', example: '花钱' },
      { meaning: '模糊', example: '眼花缭乱' } ] },
    { char: '生', senses: [
      { meaning: '出生', example: '生日' },
      { meaning: '未加工', example: '生水' },
      { meaning: '学生', example: '师生' } ] }
  ];

  // ============ 联系上下文选字 ============
  var CONTEXT_EXAMPLES = [
    { sentence: '小明口（　）渴了，想喝（　　）。', options: ['喝', '渴'], answerIndex: 0,
      hint: '喝水用「喝」，缺水的感觉用「渴」。' },
    { sentence: '我今天在学（　）里上（　）课。', options: ['校', '效'], answerIndex: 0,
      hint: '学校与校园用「校」。' },
    { sentence: '公园里的花开得非常鲜（　）。', options: ['艳', '验'], answerIndex: 0,
      hint: '颜色鲜明用「艳」。' },
    { sentence: '他把手（　）干净后再吃饭。', options: ['洗', '先'], answerIndex: 0,
      hint: '清洁动作用「洗」。' },
    { sentence: '（　）天我们去了动物园。', options: ['前', '钱'], answerIndex: 0,
      hint: '表示时间在前用「前」。' },
    { sentence: '树上有一只小（　）。', options: ['鸟', '乌'], answerIndex: 0,
      hint: '泛指鸟类用「鸟」。' }
  ];

  // ============ 查字典规则 ============
  var DICTIONARY_RULES = {
    yinxu: {
      name: '音序查字法',
      when: '知道读音、不知道字形/写法时使用',
      steps: [
        '确定字的音节，写出首字母大写的音序（如 hū → H）',
        '在《汉语拼音音节索引》中找到该音序对应的页码',
        '按音节在正文里查找，找到目标字'
      ],
      example: { char: '花', steps: ['读音 huā → 音序 H', '索引定位 hua', '翻至页码查得「花」'] }
    },
    bushou: {
      name: '部首查字法',
      when: '看到字形、不知道读音时使用',
      steps: [
        '找出字的部首，数出部首几画',
        '在「部首目录」中按笔画找到该部首页码',
        '数出除去部首后的剩余笔画数',
        '在「检字表」对应位置查找，按页码到正文找字'
      ],
      example: { char: '湖', steps: ['部首氵(3画)', '部首目录→氵', '除部首外 9 画', '检字表查得「湖」'] }
    },
    combined: {
      note: '两法配合：会用音序先音序；音序相同再多字时，可结合部首快速筛选。',
      example: '「清」「请」「晴」同音 qīng，按部首部首氵/讠/日 区分语义后选择。'
    }
  };

  // ============ 形声字示例 ============
  var PHONETIC_COMPOUNDS = [
    { char: '湖', shapePart: '氵（形·与水有关）', soundPart: '胡（声·提示读音 hú）',
      siblings: ['糊', '蝴', '葫'] },
    { char: '请', shapePart: '讠（形·与说话有关）', soundPart: '青（声·提示读音 qǐng）',
      siblings: ['清', '晴', '情', '精'] },
    { char: '晴', shapePart: '日（形·与太阳有关）', soundPart: '青（声·提示读音 qíng）',
      note: '形声字家族「青」系：清/请/晴/情 各取形旁表义' },
    { char: '蚂', shapePart: '虫（形·昆虫）', soundPart: '马（声·mǎ）' },
    { char: '爸', shapePart: '父（形·父亲）', soundPart: '巴（声·bà）' }
  ];

  // ============ 导出 ============
  global.HanziBank = {
    version: '1.0',
    characters: CHARACTERS,
    radicals: RADICALS,
    polySemanticExamples: POLY_SEMANTIC_EXAMPLES,
    contextExamples: CONTEXT_EXAMPLES,
    dictionaryRules: DICTIONARY_RULES,
    phoneticCompounds: PHONETIC_COMPOUNDS,

    /** 按年级取会写字 */
    byGrade: function (grade) {
      return CHARACTERS.filter(function (c) { return c.grade === grade; });
    },
    /** 按部首取字 */
    byRadical: function (radical) {
      return CHARACTERS.filter(function (c) {
        return (c.radicals || []).indexOf(radical) !== -1;
      });
    },
    /** 取某字的易混/形近组（自身+similar 字段） */
    similarGroup: function (char) {
      var hit = CHARACTERS.filter(function (c) { return c.char === char; })[0];
      return hit ? [char].concat(hit.similar || []) : [char];
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.HanziBank;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
