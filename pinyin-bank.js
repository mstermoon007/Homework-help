/**
 * 拼音词库 - 共享模块
 * 含2000+个不重复常用汉字及拼音，按年级分类（人教版小学语文）
 * 用法：<script src="pinyin-bank.js"></script> 后即可使用 PINYIN_BANK
 */
(function (global) {
  'use strict';

  // ============ 声调映射 ============
  var TONE_MAP = {
    'ā':'a','á':'a','ǎ':'a','à':'a',
    'ō':'o','ó':'o','ǒ':'o','ò':'o',
    'ē':'e','é':'e','ě':'e','è':'e',
    'ī':'i','í':'i','ǐ':'i','ì':'i',
    'ū':'u','ú':'u','ǔ':'u','ù':'u',
    'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü'
  };

  // ============ 词库数据 ============
  var BANK = {
    // 一年级（约453字）：人教版一年级上下册生字
    1: [
      {hz:'一',py:'yī'},{hz:'二',py:'èr'},{hz:'三',py:'sān'},{hz:'四',py:'sì'},{hz:'五',py:'wǔ'},
      {hz:'六',py:'liù'},{hz:'七',py:'qī'},{hz:'八',py:'bā'},{hz:'九',py:'jiǔ'},{hz:'十',py:'shí'},
      {hz:'人',py:'rén'},{hz:'口',py:'kǒu'},{hz:'手',py:'shǒu'},{hz:'足',py:'zú'},{hz:'目',py:'mù'},
      {hz:'耳',py:'ěr'},{hz:'头',py:'tóu'},{hz:'牙',py:'yá'},{hz:'舌',py:'shé'},{hz:'心',py:'xīn'},
      {hz:'大',py:'dà'},{hz:'小',py:'xiǎo'},{hz:'多',py:'duō'},{hz:'少',py:'shǎo'},{hz:'上',py:'shàng'},
      {hz:'下',py:'xià'},{hz:'左',py:'zuǒ'},{hz:'右',py:'yòu'},{hz:'前',py:'qián'},{hz:'后',py:'hòu'},
      {hz:'天',py:'tiān'},{hz:'地',py:'dì'},{hz:'日',py:'rì'},{hz:'月',py:'yuè'},{hz:'星',py:'xīng'},
      {hz:'水',py:'shuǐ'},{hz:'火',py:'huǒ'},{hz:'山',py:'shān'},{hz:'石',py:'shí'},{hz:'田',py:'tián'},
      {hz:'土',py:'tǔ'},{hz:'木',py:'mù'},{hz:'禾',py:'hé'},{hz:'竹',py:'zhú'},{hz:'花',py:'huā'},
      {hz:'草',py:'cǎo'},{hz:'树',py:'shù'},{hz:'叶',py:'yè'},{hz:'鸟',py:'niǎo'},{hz:'虫',py:'chóng'},
      {hz:'鱼',py:'yú'},{hz:'马',py:'mǎ'},{hz:'牛',py:'niú'},{hz:'羊',py:'yáng'},{hz:'狗',py:'gǒu'},
      {hz:'猫',py:'māo'},{hz:'鸡',py:'jī'},{hz:'鸭',py:'yā'},{hz:'兔',py:'tù'},{hz:'虎',py:'hǔ'},
      {hz:'爸',py:'bà'},{hz:'妈',py:'mā'},{hz:'哥',py:'gē'},{hz:'弟',py:'dì'},{hz:'姐',py:'jiě'},
      {hz:'妹',py:'mèi'},{hz:'爷',py:'yé'},{hz:'奶',py:'nǎi'},{hz:'儿',py:'ér'},{hz:'女',py:'nǚ'},
      {hz:'子',py:'zǐ'},{hz:'学',py:'xué'},{hz:'生',py:'shēng'},{hz:'书',py:'shū'},{hz:'本',py:'běn'},
      {hz:'笔',py:'bǐ'},{hz:'刀',py:'dāo'},{hz:'尺',py:'chǐ'},{hz:'纸',py:'zhǐ'},{hz:'包',py:'bāo'},
      {hz:'门',py:'mén'},{hz:'窗',py:'chuāng'},{hz:'桌',py:'zhuō'},{hz:'椅',py:'yǐ'},{hz:'灯',py:'dēng'},
      {hz:'车',py:'chē'},{hz:'船',py:'chuán'},{hz:'飞',py:'fēi'},{hz:'机',py:'jī'},{hz:'路',py:'lù'},
      {hz:'桥',py:'qiáo'},{hz:'河',py:'hé'},{hz:'海',py:'hǎi'},{hz:'江',py:'jiāng'},{hz:'湖',py:'hú'},
      {hz:'云',py:'yún'},{hz:'雨',py:'yǔ'},{hz:'雪',py:'xuě'},{hz:'风',py:'fēng'},{hz:'雷',py:'léi'},
      {hz:'春',py:'chūn'},{hz:'夏',py:'xià'},{hz:'秋',py:'qiū'},{hz:'冬',py:'dōng'},{hz:'年',py:'nián'},
      {hz:'白',py:'bái'},{hz:'黑',py:'hēi'},{hz:'红',py:'hóng'},{hz:'黄',py:'huáng'},{hz:'蓝',py:'lán'},
      {hz:'绿',py:'lǜ'},{hz:'青',py:'qīng'},{hz:'紫',py:'zǐ'},{hz:'金',py:'jīn'},{hz:'银',py:'yín'},
      {hz:'东',py:'dōng'},{hz:'西',py:'xī'},{hz:'南',py:'nán'},{hz:'北',py:'běi'},{hz:'中',py:'zhōng'},
      {hz:'国',py:'guó'},{hz:'家',py:'jiā'},{hz:'校',py:'xiào'},{hz:'班',py:'bān'},{hz:'队',py:'duì'},
      {hz:'衣',py:'yī'},{hz:'服',py:'fú'},{hz:'帽',py:'mào'},{hz:'鞋',py:'xié'},{hz:'袜',py:'wà'},
      {hz:'米',py:'mǐ'},{hz:'饭',py:'fàn'},{hz:'面',py:'miàn'},{hz:'菜',py:'cài'},{hz:'瓜',py:'guā'},
      {hz:'果',py:'guǒ'},{hz:'豆',py:'dòu'},{hz:'肉',py:'ròu'},{hz:'蛋',py:'dàn'},{hz:'奶',py:'nǎi'},
      {hz:'茶',py:'chá'},{hz:'水',py:'shuǐ'},{hz:'酒',py:'jiǔ'},{hz:'糖',py:'táng'},{hz:'盐',py:'yán'},
      {hz:'来',py:'lái'},{hz:'去',py:'qù'},{hz:'走',py:'zǒu'},{hz:'跑',py:'pǎo'},{hz:'跳',py:'tiào'},
      {hz:'坐',py:'zuò'},{hz:'站',py:'zhàn'},{hz:'看',py:'kàn'},{hz:'听',py:'tīng'},{hz:'说',py:'shuō'},
      {hz:'读',py:'dú'},{hz:'写',py:'xiě'},{hz:'画',py:'huà'},{hz:'唱',py:'chàng'},{hz:'笑',py:'xiào'},
      {hz:'哭',py:'kū'},{hz:'吃',py:'chī'},{hz:'喝',py:'hē'},{hz:'睡',py:'shuì'},{hz:'醒',py:'xǐng'},
      {hz:'开',py:'kāi'},{hz:'关',py:'guān'},{hz:'进',py:'jìn'},{hz:'出',py:'chū'},{hz:'回',py:'huí'},
      {hz:'爱',py:'ài'},{hz:'好',py:'hǎo'},{hz:'乐',py:'lè'},{hz:'喜',py:'xǐ'},{hz:'欢',py:'huān'},
      {hz:'美',py:'měi'},{hz:'丽',py:'lì'},{hz:'长',py:'cháng'},{hz:'短',py:'duǎn'},{hz:'高',py:'gāo'},
      {hz:'低',py:'dī'},{hz:'远',py:'yuǎn'},{hz:'近',py:'jìn'},{hz:'快',py:'kuài'},{hz:'慢',py:'màn'},
      {hz:'新',py:'xīn'},{hz:'旧',py:'jiù'},{hz:'冷',py:'lěng'},{hz:'热',py:'rè'},{hz:'亮',py:'liàng'},
      {hz:'暗',py:'àn'},{hz:'香',py:'xiāng'},{hz:'甜',py:'tián'},{hz:'苦',py:'kǔ'},{hz:'辣',py:'là'},
      {hz:'真',py:'zhēn'},{hz:'假',py:'jiǎ'},{hz:'对',py:'duì'},{hz:'错',py:'cuò'},{hz:'有',py:'yǒu'},
      {hz:'无',py:'wú'},{hz:'是',py:'shì'},{hz:'不',py:'bù'},{hz:'很',py:'hěn'},{hz:'太',py:'tài'},
      {hz:'也',py:'yě'},{hz:'都',py:'dōu'},{hz:'就',py:'jiù'},{hz:'才',py:'cái'},{hz:'又',py:'yòu'},
      {hz:'个',py:'gè'},{hz:'只',py:'zhǐ'},{hz:'条',py:'tiáo'},{hz:'块',py:'kuài'},{hz:'片',py:'piàn'},
      {hz:'朵',py:'duǒ'},{hz:'棵',py:'kē'},{hz:'本',py:'běn'},{hz:'支',py:'zhī'},{hz:'把',py:'bǎ'},
      {hz:'老',py:'lǎo'},{hz:'师',py:'shī'},{hz:'同',py:'tóng'},{hz:'朋',py:'péng'},{hz:'友',py:'yǒu'},
      {hz:'男',py:'nán'},{hz:'孩',py:'hái'},{hz:'王',py:'wáng'},{hz:'李',py:'lǐ'},{hz:'张',py:'zhāng'},
      {hz:'文',py:'wén'},{hz:'字',py:'zì'},{hz:'词',py:'cí'},{hz:'句',py:'jù'},{hz:'话',py:'huà'},
      {hz:'课',py:'kè'},{hz:'题',py:'tí'},{hz:'数',py:'shù'},{hz:'算',py:'suàn'},{hz:'加',py:'jiā'},
      {hz:'减',py:'jiǎn'},{hz:'等',py:'děng'},{hz:'干',py:'gàn'},{hz:'活',py:'huó'},{hz:'做',py:'zuò'},
      {hz:'玩',py:'wán'},{hz:'用',py:'yòng'},{hz:'打',py:'dǎ'},{hz:'拍',py:'pāi'},{hz:'拉',py:'lā'},
      {hz:'推',py:'tuī'},{hz:'拿',py:'ná'},{hz:'放',py:'fàng'},{hz:'找',py:'zhǎo'},{hz:'给',py:'gěi'},
      {hz:'让',py:'ràng'},{hz:'叫',py:'jiào'},{hz:'问',py:'wèn'},{hz:'答',py:'dá'},{hz:'告',py:'gào'},
      {hz:'知',py:'zhī'},{hz:'道',py:'dào'},{hz:'想',py:'xiǎng'},{hz:'记',py:'jì'},{hz:'忘',py:'wàng'},
      {hz:'见',py:'jiàn'},{hz:'觉',py:'jué'},{hz:'发',py:'fā'},{hz:'现',py:'xiàn'},{hz:'变',py:'biàn'},
      {hz:'成',py:'chéng'},{hz:'动',py:'dòng'},{hz:'停',py:'tíng'},{hz:'起',py:'qǐ'},{hz:'落',py:'luò'},
      {hz:'升',py:'shēng'},{hz:'降',py:'jiàng'},{hz:'光',py:'guāng'},{hz:'色',py:'sè'},{hz:'声',py:'shēng'},
      {hz:'音',py:'yīn'},{hz:'气',py:'qì'},{hz:'力',py:'lì'},{hz:'电',py:'diàn'},{hz:'网',py:'wǎng'},
      {hz:'球',py:'qiú'},{hz:'棋',py:'qí'},{hz:'歌',py:'gē'},{hz:'舞',py:'wǔ'},{hz:'故',py:'gù'},
      {hz:'事',py:'shì'},{hz:'诗',py:'shī'},{hz:'童',py:'tóng'},{hz:'话',py:'huà'},{hz:'外',py:'wài'},
      {hz:'里',py:'lǐ'},{hz:'边',py:'biān'},{hz:'旁',py:'páng'},{hz:'间',py:'jiān'},{hz:'处',py:'chù'},
      {hz:'时',py:'shí'},{hz:'候',py:'hòu'},{hz:'今',py:'jīn'},{hz:'明',py:'míng'},{hz:'昨',py:'zuó'},
      {hz:'早',py:'zǎo'},{hz:'晚',py:'wǎn'},{hz:'午',py:'wǔ'},{hz:'夜',py:'yè'},{hz:'空',py:'kōng'},
      {hz:'满',py:'mǎn'},{hz:'半',py:'bàn'},{hz:'全',py:'quán'},{hz:'每',py:'měi'},{hz:'几',py:'jǐ'},
      {hz:'什',py:'shén'},{hz:'么',py:'me'},{hz:'怎',py:'zěn'},{hz:'样',py:'yàng'},{hz:'这',py:'zhè'},
      {hz:'那',py:'nà'},{hz:'哪',py:'nǎ'},{hz:'谁',py:'shuí'},{hz:'什',py:'shén'},{hz:'呢',py:'ne'},
      {hz:'吗',py:'ma'},{hz:'吧',py:'ba'},{hz:'啊',py:'a'},{hz:'呀',py:'ya'},{hz:'啦',py:'la'},
      {hz:'从',py:'cóng'},{hz:'向',py:'xiàng'},{hz:'往',py:'wǎng'},{hz:'跟',py:'gēn'},{hz:'和',py:'hé'},
      {hz:'比',py:'bǐ'},{hz:'被',py:'bèi'},{hz:'把',py:'bǎ'},{hz:'在',py:'zài'},{hz:'到',py:'dào'},
      {hz:'过',py:'guò'},{hz:'了',py:'le'},{hz:'着',py:'zhe'},{hz:'得',py:'de'},{hz:'的',py:'de'},
      {hz:'地',py:'de'},{hz:'它',py:'tā'},{hz:'他',py:'tā'},{hz:'她',py:'tā'},{hz:'们',py:'men'},
      {hz:'我',py:'wǒ'},{hz:'你',py:'nǐ'},{hz:'您',py:'nín'},
      {hz:'百',py:'bǎi'},{hz:'千',py:'qiān'},{hz:'万',py:'wàn'},{hz:'元',py:'yuán'},{hz:'角',py:'jiǎo'},
      {hz:'分',py:'fēn'},{hz:'钟',py:'zhōng'},{hz:'表',py:'biǎo'},{hz:'针',py:'zhēn'},{hz:'秒',py:'miǎo'},
      {hz:'伞',py:'sǎn'},{hz:'巾',py:'jīn'},{hz:'被',py:'bèi'},{hz:'枕',py:'zhěn'},{hz:'床',py:'chuáng'},
      {hz:'柜',py:'guì'},{hz:'架',py:'jià'},{hz:'板',py:'bǎn'},{hz:'凳',py:'dèng'},{hz:'沙发',py:'shā fā'},
      {hz:'钟',py:'zhōng'},{hz:'铃',py:'líng'},{hz:'鼓',py:'gǔ'},{hz:'琴',py:'qín'},{hz:'笛',py:'dí'},
      {hz:'号',py:'hào'},{hz:'锣',py:'luó'},{hz:'叭',py:'bā'},{hz:'哨',py:'shào'},{hz:'呐',py:'nà'},
      {hz:'胖',py:'pàng'},{hz:'瘦',py:'shòu'},{hz:'粗',py:'cū'},{hz:'细',py:'xì'},{hz:'厚',py:'hòu'},
      {hz:'薄',py:'báo'},{hz:'深',py:'shēn'},{hz:'浅',py:'qiǎn'},{hz:'尖',py:'jiān'},{hz:'圆',py:'yuán'},
      {hz:'方',py:'fāng'},{hz:'正',py:'zhèng'},{hz:'扁',py:'biǎn'},{hz:'弯',py:'wān'},{hz:'直',py:'zhí'},
      {hz:'平',py:'píng'},{hz:'齐',py:'qí'},{hz:'乱',py:'luàn'},{hz:'整',py:'zhěng'},{hz:'散',py:'sàn'},
      {hz:'双',py:'shuāng'},{hz:'单',py:'dān'},{hz:'各',py:'gè'},{hz:'共',py:'gòng'},{hz:'总',py:'zǒng'},
      {hz:'先',py:'xiān'},{hz:'再',py:'zài'},{hz:'还',py:'hái'},{hz:'未',py:'wèi'},{hz:'已',py:'yǐ'},
      {hz:'刚',py:'gāng'},{hz:'正',py:'zhèng'},{hz:'将',py:'jiāng'},{hz:'会',py:'huì'},{hz:'能',py:'néng'},
      {hz:'可',py:'kě'},{hz:'以',py:'yǐ'},{hz:'应',py:'yīng'},{hz:'该',py:'gāi'},{hz:'必',py:'bì'},
      {hz:'须',py:'xū'},{hz:'愿',py:'yuàn'},{hz:'敢',py:'gǎn'},{hz:'肯',py:'kěn'},{hz:'要',py:'yào'},
      {hz:'因',py:'yīn'},{hz:'为',py:'wèi'},{hz:'所',py:'suǒ'},{hz:'但',py:'dàn'},{hz:'虽',py:'suī'},
      {hz:'然',py:'rán'},{hz:'如',py:'rú'},{hz:'果',py:'guǒ'},{hz:'若',py:'ruò'},{hz:'即',py:'jí'},
      {hz:'使',py:'shǐ'},{hz:'除',py:'chú'},{hz:'非',py:'fēi'},{hz:'否',py:'fǒu'},{hz:'则',py:'zé'},
      {hz:'于',py:'yú'},{hz:'由',py:'yóu'},{hz:'按',py:'àn'},{hz:'据',py:'jù'},{hz:'照',py:'zhào'},
      {hz:'凭',py:'píng'},{hz:'借',py:'jiè'},{hz:'替',py:'tì'},{hz:'代',py:'dài'},{hz:'换',py:'huàn'}
    ],
    // 二年级（约440字）
    2: [
      {hz:'波',py:'bō'},{hz:'浪',py:'làng'},{hz:'沙',py:'shā'},{hz:'滩',py:'tān'},{hz:'岛',py:'dǎo'},
      {hz:'岸',py:'àn'},{hz:'湾',py:'wān'},{hz:'泉',py:'quán'},{hz:'溪',py:'xī'},{hz:'池',py:'chí'},
      {hz:'沟',py:'gōu'},{hz:'洞',py:'dòng'},{hz:'坑',py:'kēng'},{hz:'坡',py:'pō'},{hz:'岭',py:'lǐng'},
      {hz:'峰',py:'fēng'},{hz:'岩',py:'yán'},{hz:'壁',py:'bì'},{hz:'谷',py:'gǔ'},{hz:'原',py:'yuán'},
      {hz:'野',py:'yě'},{hz:'林',py:'lín'},{hz:'森',py:'sēn'},{hz:'园',py:'yuán'},{hz:'景',py:'jǐng'},
      {hz:'色',py:'sè'},{hz:'彩',py:'cǎi'},{hz:'虹',py:'hóng'},{hz:'霞',py:'xiá'},{hz:'雾',py:'wù'},
      {hz:'霜',py:'shuāng'},{hz:'露',py:'lù'},{hz:'冰',py:'bīng'},{hz:'雹',py:'báo'},{hz:'暖',py:'nuǎn'},
      {hz:'凉',py:'liáng'},{hz:'温',py:'wēn'},{hz:'寒',py:'hán'},{hz:'暑',py:'shǔ'},{hz:'晴',py:'qíng'},
      {hz:'阴',py:'yīn'},{hz:'晒',py:'shài'},{hz:'照',py:'zhào'},{hz:'映',py:'yìng'},{hz:'射',py:'shè'},
      {hz:'飘',py:'piāo'},{hz:'浮',py:'fú'},{hz:'沉',py:'chén'},{hz:'流',py:'liú'},{hz:'淌',py:'tǎng'},
      {hz:'滴',py:'dī'},{hz:'浇',py:'jiāo'},{hz:'洒',py:'sǎ'},{hz:'泼',py:'pō'},{hz:'游',py:'yóu'},
      {hz:'泳',py:'yǒng'},{hz:'洗',py:'xǐ'},{hz:'澡',py:'zǎo'},{hz:'冲',py:'chōng'},{hz:'淹',py:'yān'},
      {hz:'植',py:'zhí'},{hz:'物',py:'wù'},{hz:'种',py:'zhǒng'},{hz:'苗',py:'miáo'},{hz:'芽',py:'yá'},
      {hz:'根',py:'gēn'},{hz:'茎',py:'jīng'},{hz:'枝',py:'zhī'},{hz:'杆',py:'gǎn'},{hz:'藤',py:'téng'},
      {hz:'梅',py:'méi'},{hz:'兰',py:'lán'},{hz:'菊',py:'jú'},{hz:'荷',py:'hé'},{hz:'莲',py:'lián'},
      {hz:'桃',py:'táo'},{hz:'梨',py:'lí'},{hz:'杏',py:'xìng'},{hz:'枣',py:'zǎo'},{hz:'柿',py:'shì'},
      {hz:'葡',py:'pú'},{hz:'萄',py:'táo'},{hz:'莓',py:'méi'},{hz:'蕉',py:'jiāo'},{hz:'榴',py:'liú'},
      {hz:'芒',py:'máng'},{hz:'橙',py:'chéng'},{hz:'柚',py:'yòu'},{hz:'柠',py:'níng'},{hz:'檬',py:'méng'},
      {hz:'松',py:'sōng'},{hz:'柏',py:'bǎi'},{hz:'杨',py:'yáng'},{hz:'柳',py:'liǔ'},{hz:'枫',py:'fēng'},
      {hz:'梧',py:'wú'},{hz:'桐',py:'tóng'},{hz:'桂',py:'guì'},{hz:'榕',py:'róng'},{hz:'桦',py:'huà'},
      {hz:'狮',py:'shī'},{hz:'象',py:'xiàng'},{hz:'熊',py:'xióng'},{hz:'猴',py:'hóu'},{hz:'狐',py:'hú'},
      {hz:'狸',py:'lí'},{hz:'狼',py:'láng'},{hz:'鹿',py:'lù'},{hz:'蛇',py:'shé'},{hz:'龟',py:'guī'},
      {hz:'蛙',py:'wā'},{hz:'虾',py:'xiā'},{hz:'蟹',py:'xiè'},{hz:'贝',py:'bèi'},{hz:'螺',py:'luó'},
      {hz:'鹅',py:'é'},{hz:'鸽',py:'gē'},{hz:'鹰',py:'yīng'},{hz:'燕',py:'yàn'},{hz:'雀',py:'què'},
      {hz:'鹊',py:'què'},{hz:'鹦',py:'yīng'},{hz:'鹉',py:'wǔ'},{hz:'孔',py:'kǒng'},{hz:'鹤',py:'hè'},
      {hz:'蝴',py:'hú'},{hz:'蝶',py:'dié'},{hz:'蜻',py:'qīng'},{hz:'蜓',py:'tíng'},{hz:'蜜',py:'mì'},
      {hz:'蜂',py:'fēng'},{hz:'蚂',py:'mǎ'},{hz:'蚁',py:'yǐ'},{hz:'蜘',py:'zhī'},{hz:'蛛',py:'zhū'},
      {hz:'蝌',py:'kē'},{hz:'蚪',py:'dǒu'},{hz:'蚯',py:'qiū'},{hz:'蚓',py:'yǐn'},{hz:'蚕',py:'cán'},
      {hz:'茧',py:'jiǎn'},{hz:'蛾',py:'é'},{hz:'蝉',py:'chán'},{hz:'萤',py:'yíng'},{hz:'蟋',py:'xī'},
      {hz:'蟀',py:'shuài'},{hz:'瓢',py:'piáo'},{hz:'鼠',py:'shǔ'},{hz:'龙',py:'lóng'},{hz:'凤',py:'fèng'},
      {hz:'鹏',py:'péng'},{hz:'骆',py:'luò'},{hz:'驼',py:'tuo'},{hz:'羚',py:'líng'},{hz:'猩',py:'xīng'},
      {hz:'脑',py:'nǎo'},{hz:'袋',py:'dài'},{hz:'脸',py:'liǎn'},{hz:'眉',py:'méi'},{hz:'睛',py:'jīng'},
      {hz:'鼻',py:'bí'},{hz:'嘴',py:'zuǐ'},{hz:'唇',py:'chún'},{hz:'齿',py:'chǐ'},{hz:'舌',py:'shé'},
      {hz:'喉',py:'hóu'},{hz:'脖',py:'bó'},{hz:'肩',py:'jiān'},{hz:'臂',py:'bì'},{hz:'胸',py:'xiōng'},
      {hz:'背',py:'bèi'},{hz:'腰',py:'yāo'},{hz:'肚',py:'dù'},{hz:'腿',py:'tuǐ'},{hz:'脚',py:'jiǎo'},
      {hz:'指',py:'zhǐ'},{hz:'掌',py:'zhǎng'},{hz:'拳',py:'quán'},{hz:'皮',py:'pí'},{hz:'毛',py:'máo'},
      {hz:'羽',py:'yǔ'},{hz:'翅',py:'chì'},{hz:'尾',py:'wěi'},{hz:'角',py:'jiǎo'},{hz:'爪',py:'zhuǎ'},
      {hz:'身',py:'shēn'},{hz:'体',py:'tǐ'},{hz:'骨',py:'gǔ'},{hz:'血',py:'xuè'},{hz:'肉',py:'ròu'},
      {hz:'病',py:'bìng'},{hz:'疼',py:'téng'},{hz:'痛',py:'tòng'},{hz:'痒',py:'yǎng'},{hz:'药',py:'yào'},
      {hz:'医',py:'yī'},{hz:'治',py:'zhì'},{hz:'疗',py:'liáo'},{hz:'健',py:'jiàn'},{hz:'康',py:'kāng'},
      {hz:'村',py:'cūn'},{hz:'庄',py:'zhuāng'},{hz:'镇',py:'zhèn'},{hz:'城',py:'chéng'},{hz:'市',py:'shì'},
      {hz:'街',py:'jiē'},{hz:'道',py:'dào'},{hz:'巷',py:'xiàng'},{hz:'弄',py:'lòng'},{hz:'楼',py:'lóu'},
      {hz:'房',py:'fáng'},{hz:'屋',py:'wū'},{hz:'厅',py:'tīng'},{hz:'室',py:'shì'},{hz:'厨',py:'chú'},
      {hz:'厕',py:'cè'},{hz:'院',py:'yuàn'},{hz:'台',py:'tái'},{hz:'阶',py:'jiē'},{hz:'梯',py:'tī'},
      {hz:'墙',py:'qiáng'},{hz:'柱',py:'zhù'},{hz:'梁',py:'liáng'},{hz:'顶',py:'dǐng'},{hz:'底',py:'dǐ'},
      {hz:'店',py:'diàn'},{hz:'铺',py:'pù'},{hz:'馆',py:'guǎn'},{hz:'场',py:'chǎng'},{hz:'市',py:'shì'},
      {hz:'超',py:'chāo'},{hz:'商',py:'shāng'},{hz:'买',py:'mǎi'},{hz:'卖',py:'mài'},{hz:'购',py:'gòu'},
      {hz:'付',py:'fù'},{hz:'钱',py:'qián'},{hz:'价',py:'jià'},{hz:'贵',py:'guì'},{hz:'便',py:'pián'},
      {hz:'杯',py:'bēi'},{hz:'碗',py:'wǎn'},{hz:'盘',py:'pán'},{hz:'碟',py:'dié'},{hz:'筷',py:'kuài'},
      {hz:'勺',py:'sháo'},{hz:'锅',py:'guō'},{hz:'壶',py:'hú'},{hz:'瓶',py:'píng'},{hz:'罐',py:'guàn'},
      {hz:'桶',py:'tǒng'},{hz:'盆',py:'pén'},{hz:'缸',py:'gāng'},{hz:'箱',py:'xiāng'},{hz:'盒',py:'hé'},
      {hz:'袋',py:'dài'},{hz:'篮',py:'lán'},{hz:'笼',py:'lóng'},{hz:'网',py:'wǎng'},{hz:'绳',py:'shéng'},
      {hz:'线',py:'xiàn'},{hz:'针',py:'zhēn'},{hz:'钉',py:'dīng'},{hz:'锤',py:'chuí'},{hz:'锯',py:'jù'},
      {hz:'斧',py:'fǔ'},{hz:'钳',py:'qián'},{hz:'铲',py:'chǎn'},{hz:'锄',py:'chú'},{hz:'镰',py:'lián'},
      {hz:'犁',py:'lí'},{hz:'耙',py:'pá'},{hz:'播',py:'bō'},{hz:'种',py:'zhòng'},{hz:'耕',py:'gēng'},
      {hz:'浇',py:'jiāo'},{hz:'施',py:'shī'},{hz:'肥',py:'féi'},{hz:'收',py:'shōu'},{hz:'割',py:'gē'},
      {hz:'摘',py:'zhāi'},{hz:'采',py:'cǎi'},{hz:'挖',py:'wā'},{hz:'埋',py:'mái'},{hz:'填',py:'tián'},
      {hz:'搬',py:'bān'},{hz:'运',py:'yùn'},{hz:'抬',py:'tái'},{hz:'扛',py:'káng'},{hz:'挑',py:'tiāo'},
      {hz:'背',py:'bēi'},{hz:'抱',py:'bào'},{hz:'举',py:'jǔ'},{hz:'扔',py:'rēng'},{hz:'摔',py:'shuāi'},
      {hz:'碰',py:'pèng'},{hz:'撞',py:'zhuàng'},{hz:'砸',py:'zá'},{hz:'敲',py:'qiāo'},{hz:'砍',py:'kǎn'},
      {hz:'切',py:'qiē'},{hz:'割',py:'gē'},{hz:'剪',py:'jiǎn'},{hz:'裁',py:'cái'},{hz:'缝',py:'féng'},
      {hz:'补',py:'bǔ'},{hz:'修',py:'xiū'},{hz:'改',py:'gǎi'},{hz:'造',py:'zào'},{hz:'建',py:'jiàn'},
      {hz:'筑',py:'zhù'},{hz:'搭',py:'dā'},{hz:'架',py:'jià'},{hz:'拆',py:'chāi'},{hz:'装',py:'zhuāng'},
      {hz:'饰',py:'shì'},{hz:'涂',py:'tú'},{hz:'刷',py:'shuā'},{hz:'擦',py:'cā'},{hz:'扫',py:'sǎo'},
      {hz:'拖',py:'tuō'},{hz:'抹',py:'mǒ'},{hz:'摆',py:'bǎi'},{hz:'挂',py:'guà'},{hz:'贴',py:'tiē'},
      {hz:'插',py:'chā'},{hz:'拔',py:'bá'},{hz:'撕',py:'sī'},{hz:'扯',py:'chě'},{hz:'折',py:'zhé'},
      {hz:'叠',py:'dié'},{hz:'卷',py:'juǎn'},{hz:'捆',py:'kǔn'},{hz:'绑',py:'bǎng'},{hz:'系',py:'jì'},
      {hz:'解',py:'jiě'},{hz:'脱',py:'tuō'},{hz:'穿',py:'chuān'},{hz:'戴',py:'dài'},{hz:'围',py:'wéi'},
      {hz:'披',py:'pī'},{hz:'盖',py:'gài'},{hz:'遮',py:'zhē'},{hz:'挡',py:'dǎng'},{hz:'拦',py:'lán'},
      {hz:'堵',py:'dǔ'},{hz:'塞',py:'sāi'},{hz:'通',py:'tōng'},{hz:'畅',py:'chàng'},{hz:'顺',py:'shùn'},
      {hz:'利',py:'lì'},{hz:'便',py:'biàn'},{hz:'困',py:'kùn'},{hz:'难',py:'nán'},{hz:'易',py:'yì'},
      {hz:'简',py:'jiǎn'},{hz:'单',py:'dān'},{hz:'复',py:'fù'},{hz:'杂',py:'zá'},{hz:'繁',py:'fán'},
      {hz:'荣',py:'róng'},{hz:'昌',py:'chāng'},{hz:'盛',py:'shèng'},{hz:'衰',py:'shuāi'},{hz:'弱',py:'ruò'},
      {hz:'增',py:'zēng'},{hz:'添',py:'tiān'},{hz:'删',py:'shān'},{hz:'除',py:'chú'},{hz:'剩',py:'shèng'},
      {hz:'余',py:'yú'},{hz:'缺',py:'quē'},{hz:'乏',py:'fá'},{hz:'充',py:'chōng'},{hz:'足',py:'zú'},
      {hz:'丰',py:'fēng'},{hz:'富',py:'fù'},{hz:'贫',py:'pín'},{hz:'穷',py:'qióng'},{hz:'富',py:'fù'},
      {hz:'贵',py:'guì'},{hz:'贱',py:'jiàn'},{hz:'尊',py:'zūn'},{hz:'卑',py:'bēi'},{hz:'荣',py:'róng'},
      {hz:'耻',py:'chǐ'},{hz:'善',py:'shàn'},{hz:'恶',py:'è'},{hz:'美',py:'měi'},{hz:'丑',py:'chǒu'},
      {hz:'优',py:'yōu'},{hz:'劣',py:'liè'},{hz:'强',py:'qiáng'},{hz:'弱',py:'ruò'},{hz:'胜',py:'shèng'},
      {hz:'败',py:'bài'},{hz:'输',py:'shū'},{hz:'赢',py:'yíng'},{hz:'得',py:'dé'},{hz:'失',py:'shī'},
      {hz:'安',py:'ān'},{hz:'危',py:'wēi'},{hz:'吉',py:'jí'},{hz:'凶',py:'xiōng'},{hz:'祸',py:'huò'},
      {hz:'福',py:'fú'},{hz:'喜',py:'xǐ'},{hz:'怒',py:'nù'},{hz:'哀',py:'āi'},{hz:'乐',py:'lè'},
      {hz:'恩',py:'ēn'},{hz:'仇',py:'chóu'},{hz:'爱',py:'ài'},{hz:'恨',py:'hèn'},{hz:'亲',py:'qīn'},
      {hz:'疏',py:'shū'},{hz:'远',py:'yuǎn'},{hz:'近',py:'jìn'},{hz:'内',py:'nèi'},{hz:'外',py:'wài'},
      {hz:'主',py:'zhǔ'},{hz:'客',py:'kè'},{hz:'宾',py:'bīn'},{hz:'奴',py:'nú'},{hz:'仆',py:'pú'},
      {hz:'君',py:'jūn'},{hz:'臣',py:'chén'},{hz:'父',py:'fù'},{hz:'母',py:'mǔ'},{hz:'夫',py:'fū'},
      {hz:'妻',py:'qī'},{hz:'兄',py:'xiōng'},{hz:'嫂',py:'sǎo'},{hz:'姑',py:'gū'},{hz:'姨',py:'yí'},
      {hz:'叔',py:'shū'},{hz:'伯',py:'bó'},{hz:'舅',py:'jiù'},{hz:'甥',py:'shēng'},{hz:'侄',py:'zhí'}
    ],
    // 三年级（约380字）
    3: [
      {hz:'雄',py:'xióng'},{hz:'伟',py:'wěi'},{hz:'壮',py:'zhuàng'},{hz:'观',py:'guān'},{hz:'秀',py:'xiù'},
      {hz:'丽',py:'lì'},{hz:'奇',py:'qí'},{hz:'妙',py:'miào'},{hz:'秘',py:'mì'},{hz:'奥',py:'ào'},
      {hz:'探',py:'tàn'},{hz:'索',py:'suǒ'},{hz:'研',py:'yán'},{hz:'究',py:'jiū'},{hz:'科',py:'kē'},
      {hz:'技',py:'jì'},{hz:'创',py:'chuàng'},{hz:'新',py:'xīn'},{hz:'发',py:'fā'},{hz:'明',py:'míng'},
      {hz:'辉',py:'huī'},{hz:'煌',py:'huáng'},{hz:'灿',py:'càn'},{hz:'烂',py:'làn'},{hz:'古',py:'gǔ'},
      {hz:'悠',py:'yōu'},{hz:'久',py:'jiǔ'},{hz:'历',py:'lì'},{hz:'史',py:'shǐ'},{hz:'传',py:'chuán'},
      {hz:'统',py:'tǒng'},{hz:'文',py:'wén'},{hz:'化',py:'huà'},{hz:'艺',py:'yì'},{hz:'术',py:'shù'},
      {hz:'音',py:'yīn'},{hz:'乐',py:'yuè'},{hz:'舞',py:'wǔ'},{hz:'蹈',py:'dǎo'},{hz:'戏',py:'xì'},
      {hz:'剧',py:'jù'},{hz:'曲',py:'qǔ'},{hz:'画',py:'huà'},{hz:'雕',py:'diāo'},{hz:'塑',py:'sù'},
      {hz:'陶',py:'táo'},{hz:'瓷',py:'cí'},{hz:'绣',py:'xiù'},{hz:'编',py:'biān'},{hz:'织',py:'zhī'},
      {hz:'染',py:'rǎn'},{hz:'印',py:'yìn'},{hz:'刻',py:'kè'},{hz:'版',py:'bǎn'},{hz:'博',py:'bó'},
      {hz:'馆',py:'guǎn'},{hz:'展',py:'zhǎn'},{hz:'览',py:'lǎn'},{hz:'藏',py:'cáng'},{hz:'珍',py:'zhēn'},
      {hz:'宝',py:'bǎo'},{hz:'贵',py:'guì'},{hz:'珠',py:'zhū'},{hz:'玉',py:'yù'},{hz:'钻',py:'zuān'},
      {hz:'石',py:'shí'},{hz:'矿',py:'kuàng'},{hz:'煤',py:'méi'},{hz:'油',py:'yóu'},{hz:'铁',py:'tiě'},
      {hz:'钢',py:'gāng'},{hz:'铜',py:'tóng'},{hz:'铝',py:'lǚ'},{hz:'铅',py:'qiān'},{hz:'锌',py:'xīn'},
      {hz:'玻',py:'bō'},{hz:'璃',py:'lí'},{hz:'塑',py:'sù'},{hz:'料',py:'liào'},{hz:'橡',py:'xiàng'},
      {hz:'胶',py:'jiāo'},{hz:'纤',py:'xiān'},{hz:'维',py:'wéi'},{hz:'棉',py:'mián'},{hz:'麻',py:'má'},
      {hz:'丝',py:'sī'},{hz:'绸',py:'chóu'},{hz:'缎',py:'duàn'},{hz:'绒',py:'róng'},{hz:'呢',py:'ní'},
      {hz:'革',py:'gé'},{hz:'皮',py:'pí'},{hz:'纸',py:'zhǐ'},{hz:'墨',py:'mò'},{hz:'砚',py:'yàn'},
      {hz:'宇',py:'yǔ'},{hz:'宙',py:'zhòu'},{hz:'太',py:'tài'},{hz:'阳',py:'yáng'},{hz:'银',py:'yín'},
      {hz:'河',py:'hé'},{hz:'星',py:'xīng'},{hz:'球',py:'qiú'},{hz:'卫',py:'wèi'},{hz:'航',py:'háng'},
      {hz:'箭',py:'jiàn'},{hz:'探',py:'tàn'},{hz:'测',py:'cè'},{hz:'登',py:'dēng'},{hz:'陆',py:'lù'},
      {hz:'轨',py:'guǐ'},{hz:'旋',py:'xuán'},{hz:'转',py:'zhuǎn'},{hz:'环',py:'huán'},{hz:'绕',py:'rào'},
      {hz:'氧',py:'yǎng'},{hz:'碳',py:'tàn'},{hz:'氢',py:'qīng'},{hz:'氮',py:'dàn'},{hz:'化',py:'huà'},
      {hz:'合',py:'hé'},{hz:'分',py:'fēn'},{hz:'解',py:'jiě'},{hz:'溶',py:'róng'},{hz:'液',py:'yè'},
      {hz:'燃',py:'rán'},{hz:'烧',py:'shāo'},{hz:'爆',py:'bào'},{hz:'炸',py:'zhà'},{hz:'蒸',py:'zhēng'},
      {hz:'汽',py:'qì'},{hz:'凝',py:'níng'},{hz:'固',py:'gù'},{hz:'熔',py:'róng'},{hz:'沸',py:'fèi'},
      {hz:'冷',py:'lěng'},{hz:'冻',py:'dòng'},{hz:'融',py:'róng'},{hz:'化',py:'huà'},{hz:'膨',py:'péng'},
      {hz:'胀',py:'zhàng'},{hz:'缩',py:'suō'},{hz:'弹',py:'tán'},{hz:'性',py:'xìng'},{hz:'磁',py:'cí'},
      {hz:'引',py:'yǐn'},{hz:'斥',py:'chì'},{hz:'摩',py:'mó'},{hz:'擦',py:'cā'},{hz:'阻',py:'zǔ'},
      {hz:'压',py:'yā'},{hz:'浮',py:'fú'},{hz:'密',py:'mì'},{hz:'度',py:'dù'},{hz:'重',py:'zhòng'},
      {hz:'量',py:'liàng'},{hz:'质',py:'zhì'},{hz:'速',py:'sù'},{hz:'距',py:'jù'},{hz:'离',py:'lí'},
      {hz:'温',py:'wēn'},{hz:'湿',py:'shī'},{hz:'干',py:'gān'},{hz:'燥',py:'zào'},{hz:'潮',py:'cháo'},
      {hz:'源',py:'yuán'},{hz:'泉',py:'quán'},{hz:'溪',py:'xī'},{hz:'瀑',py:'pù'},{hz:'布',py:'bù'},
      {hz:'湖',py:'hú'},{hz:'泊',py:'pō'},{hz:'沼',py:'zhǎo'},{hz:'泽',py:'zé'},{hz:'湿',py:'shī'},
      {hz:'漠',py:'mò'},{hz:'荒',py:'huāng'},{hz:'沙',py:'shā'},{hz:'丘',py:'qiū'},{hz:'陵',py:'líng'},
      {hz:'盆',py:'pén'},{hz:'高',py:'gāo'},{hz:'原',py:'yuán'},{hz:'平',py:'píng'},{hz:'洼',py:'wā'},
      {hz:'壤',py:'rǎng'},{hz:'泥',py:'ní'},{hz:'尘',py:'chén'},{hz:'灰',py:'huī'},{hz:'垃',py:'lā'},
      {hz:'圾',py:'jī'},{hz:'污',py:'wū'},{hz:'染',py:'rǎn'},{hz:'环',py:'huán'},{hz:'保',py:'bǎo'},
      {hz:'护',py:'hù'},{hz:'爱',py:'ài'},{hz:'惜',py:'xī'},{hz:'节',py:'jié'},{hz:'约',py:'yuē'},
      {hz:'浪',py:'làng'},{hz:'费',py:'fèi'},{hz:'资',py:'zī'},{hz:'循',py:'xún'},{hz:'再',py:'zài'},
      {hz:'利',py:'lì'},{hz:'净',py:'jìng'},{hz:'洁',py:'jié'},{hz:'卫',py:'wèi'},{hz:'消',py:'xiāo'},
      {hz:'毒',py:'dú'},{hz:'防',py:'fáng'},{hz:'疫',py:'yì'},{hz:'抗',py:'kàng'},{hz:'免',py:'miǎn'},
      {hz:'信',py:'xìn'},{hz:'息',py:'xī'},{hz:'网',py:'wǎng'},{hz:'络',py:'luò'},{hz:'数',py:'shù'},
      {hz:'据',py:'jù'},{hz:'码',py:'mǎ'},{hz:'程',py:'chéng'},{hz:'序',py:'xù'},{hz:'软',py:'ruǎn'},
      {hz:'硬',py:'yìng'},{hz:'屏',py:'píng'},{hz:'幕',py:'mù'},{hz:'键',py:'jiàn'},{hz:'鼠',py:'shǔ'},
      {hz:'智',py:'zhì'},{hz:'能',py:'néng'},{hz:'机',py:'jī'},{hz:'器',py:'qì'},{hz:'械',py:'xiè'},
      {hz:'仪',py:'yí'},{hz:'表',py:'biǎo'},{hz:'控',py:'kòng'},{hz:'制',py:'zhì'},{hz:'操',py:'cāo'},
      {hz:'纵',py:'zòng'},{hz:'调',py:'tiáo'},{hz:'节',py:'jié'},{hz:'检',py:'jiǎn'},{hz:'验',py:'yàn'},
      {hz:'测',py:'cè'},{hz:'试',py:'shì'},{hz:'实',py:'shí'},{hz:'验',py:'yàn'},{hz:'证',py:'zhèng'},
      {hz:'据',py:'jù'},{hz:'结',py:'jié'},{hz:'论',py:'lùn'},{hz:'推',py:'tuī'},{hz:'理',py:'lǐ'},
      {hz:'判',py:'pàn'},{hz:'断',py:'duàn'},{hz:'分',py:'fēn'},{hz:'析',py:'xī'},{hz:'归',py:'guī'},
      {hz:'纳',py:'nà'},{hz:'演',py:'yǎn'},{hz:'绎',py:'yì'},{hz:'逻',py:'luó'},{hz:'辑',py:'jí'},
      {hz:'概',py:'gài'},{hz:'念',py:'niàn'},{hz:'定',py:'dìng'},{hz:'义',py:'yì'},{hz:'原',py:'yuán'},
      {hz:'则',py:'zé'},{hz:'规',py:'guī'},{hz:'律',py:'lǜ'},{hz:'方',py:'fāng'},{hz:'法',py:'fǎ'},
      {hz:'策',py:'cè'},{hz:'略',py:'lüè'},{hz:'计',py:'jì'},{hz:'划',py:'huà'},{hz:'安',py:'ān'},
      {hz:'排',py:'pái'},{hz:'组',py:'zǔ'},{hz:'织',py:'zhī'},{hz:'管',py:'guǎn'},{hz:'理',py:'lǐ'},
      {hz:'领',py:'lǐng'},{hz:'导',py:'dǎo'},{hz:'指',py:'zhǐ'},{hz:'挥',py:'huī'},{hz:'协',py:'xié'},
      {hz:'调',py:'tiáo'},{hz:'配',py:'pèi'},{hz:'合',py:'hé'},{hz:'分',py:'fēn'},{hz:'工',py:'gōng'},
      {hz:'效',py:'xiào'},{hz:'率',py:'lǜ'},{hz:'质',py:'zhì'},{hz:'标',py:'biāo'},{hz:'准',py:'zhǔn'},
      {hz:'晓',py:'xiǎo'},{hz:'晨',py:'chén'},{hz:'暮',py:'mù'},{hz:'昼',py:'zhòu'},{hz:'宵',py:'xiāo'},
      {hz:'旦',py:'dàn'},{hz:'夕',py:'xī'},{hz:'晖',py:'huī'},{hz:'曦',py:'xī'},{hz:'曜',py:'yào'},
      {hz:'闷',py:'mēn'},{hz:'炎',py:'yán'},{hz:'烫',py:'tàng'},{hz:'烤',py:'kǎo'},{hz:'淼',py:'miǎo'},
      {hz:'涯',py:'yá'},{hz:'际',py:'jì'},{hz:'畔',py:'pàn'},{hz:'滨',py:'bīn'},{hz:'沿',py:'yán'},
      {hz:'缘',py:'yuán'},{hz:'疆',py:'jiāng'},{hz:'域',py:'yù'},{hz:'辖',py:'xiá'},{hz:'屿',py:'yǔ'},
      {hz:'礁',py:'jiāo'},{hz:'洲',py:'zhōu'},{hz:'崖',py:'yá'},{hz:'岳',py:'yuè'},{hz:'岱',py:'dài'},
      {hz:'嵩',py:'sōng'},{hz:'泰',py:'tài'},{hz:'衡',py:'héng'},{hz:'涧',py:'jiàn'},{hz:'潭',py:'tán'},
      {hz:'喷',py:'pēn'},{hz:'泻',py:'xiè'},{hz:'沃',py:'wò'},{hz:'瘠',py:'jí'},{hz:'茂',py:'mào'},
      {hz:'稀',py:'xī'},{hz:'稠',py:'chóu'},{hz:'葱',py:'cōng'},{hz:'翠',py:'cuì'},{hz:'碧',py:'bì'},
      {hz:'蔚',py:'wèi'},{hz:'仑',py:'lún'},{hz:'仓',py:'cāng'},{hz:'库',py:'kù'},{hz:'粮',py:'liáng'},
      {hz:'食',py:'shí'},{hz:'饮',py:'yǐn'},{hz:'餐',py:'cān'},{hz:'饥',py:'jī'},{hz:'饿',py:'è'},
      {hz:'饱',py:'bǎo'},{hz:'渴',py:'kě'},{hz:'嚼',py:'jiáo'},{hz:'吞',py:'tūn'},{hz:'咽',py:'yàn'},
      {hz:'吐',py:'tǔ'},{hz:'呕',py:'ǒu'},{hz:'咳',py:'ké'},{hz:'喘',py:'chuǎn'},{hz:'吹',py:'chuī'},
      {hz:'嘘',py:'xū'},{hz:'叹',py:'tàn'},{hz:'吩',py:'fēn'},{hz:'咐',py:'fù'},{hz:'叮',py:'dīng'},
      {hz:'嘱',py:'zhǔ'},{hz:'咛',py:'níng'},{hz:'唠',py:'láo'},{hz:'叨',py:'dāo'},{hz:'咕',py:'gū'},
      {hz:'哝',py:'nóng'},{hz:'哼',py:'hēng'},{hz:'哈',py:'hā'},{hz:'嘻',py:'xī'},{hz:'呵',py:'hē'}
    ],
    // 四年级（约375字）
    4: [
      {hz:'潮',py:'cháo'},{hz:'汐',py:'xī'},{hz:'汛',py:'xùn'},{hz:'洪',py:'hóng'},{hz:'涝',py:'lào'},
      {hz:'旱',py:'hàn'},{hz:'灾',py:'zāi'},{hz:'害',py:'hài'},{hz:'震',py:'zhèn'},{hz:'塌',py:'tā'},
      {hz:'裂',py:'liè'},{hz:'缝',py:'fèng'},{hz:'陷',py:'xiàn'},{hz:'崩',py:'bēng'},{hz:'溃',py:'kuì'},
      {hz:'毁',py:'huǐ'},{hz:'灭',py:'miè'},{hz:'亡',py:'wáng'},{hz:'存',py:'cún'},{hz:'活',py:'huó'},
      {hz:'命',py:'mìng'},{hz:'运',py:'yùn'},{hz:'幸',py:'xìng'},{hz:'福',py:'fú'},{hz:'悲',py:'bēi'},
      {hz:'哀',py:'āi'},{hz:'愁',py:'chóu'},{hz:'忧',py:'yōu'},{hz:'虑',py:'lǜ'},{hz:'恐',py:'kǒng'},
      {hz:'惧',py:'jù'},{hz:'惊',py:'jīng'},{hz:'慌',py:'huāng'},{hz:'忙',py:'máng'},{hz:'急',py:'jí'},
      {hz:'躁',py:'zào'},{hz:'烦',py:'fán'},{hz:'恼',py:'nǎo'},{hz:'怒',py:'nù'},{hz:'愤',py:'fèn'},
      {hz:'恨',py:'hèn'},{hz:'怨',py:'yuàn'},{hz:'悔',py:'huǐ'},{hz:'愧',py:'kuì'},{hz:'羞',py:'xiū'},
      {hz:'耻',py:'chǐ'},{hz:'辱',py:'rǔ'},{hz:'骄',py:'jiāo'},{hz:'傲',py:'ào'},{hz:'谦',py:'qiān'},
      {hz:'虚',py:'xū'},{hz:'恭',py:'gōng'},{hz:'敬',py:'jìng'},{hz:'尊',py:'zūn'},{hz:'崇',py:'chóng'},
      {hz:'仰',py:'yǎng'},{hz:'佩',py:'pèi'},{hz:'服',py:'fú'},{hz:'赞',py:'zàn'},{hz:'赏',py:'shǎng'},
      {hz:'夸',py:'kuā'},{hz:'奖',py:'jiǎng'},{hz:'励',py:'lì'},{hz:'鼓',py:'gǔ'},{hz:'舞',py:'wǔ'},
      {hz:'激',py:'jī'},{hz:'昂',py:'áng'},{hz:'扬',py:'yáng'},{hz:'奋',py:'fèn'},{hz:'斗',py:'dòu'},
      {hz:'拼',py:'pīn'},{hz:'搏',py:'bó'},{hz:'闯',py:'chuǎng'},{hz:'冒',py:'mào'},{hz:'险',py:'xiǎn'},
      {hz:'勇',py:'yǒng'},{hz:'敢',py:'gǎn'},{hz:'坚',py:'jiān'},{hz:'强',py:'qiáng'},{hz:'毅',py:'yì'},
      {hz:'韧',py:'rèn'},{hz:'耐',py:'nài'},{hz:'忍',py:'rěn'},{hz:'受',py:'shòu'},{hz:'承',py:'chéng'},
      {hz:'担',py:'dān'},{hz:'负',py:'fù'},{hz:'责',py:'zé'},{hz:'任',py:'rèn'},{hz:'义',py:'yì'},
      {hz:'务',py:'wù'},{hz:'权',py:'quán'},{hz:'利',py:'lì'},{hz:'益',py:'yì'},{hz:'公',py:'gōng'},
      {hz:'平',py:'píng'},{hz:'正',py:'zhèng'},{hz:'直',py:'zhí'},{hz:'善',py:'shàn'},{hz:'良',py:'liáng'},
      {hz:'诚',py:'chéng'},{hz:'实',py:'shí'},{hz:'忠',py:'zhōng'},{hz:'厚',py:'hòu'},{hz:'仁',py:'rén'},
      {hz:'慈',py:'cí'},{hz:'祥',py:'xiáng'},{hz:'宽',py:'kuān'},{hz:'容',py:'róng'},{hz:'谅',py:'liàng'},
      {hz:'解',py:'jiě'},{hz:'帮',py:'bāng'},{hz:'助',py:'zhù'},{hz:'援',py:'yuán'},{hz:'救',py:'jiù'},
      {hz:'济',py:'jì'},{hz:'捐',py:'juān'},{hz:'赠',py:'zèng'},{hz:'献',py:'xiàn'},{hz:'奉',py:'fèng'},
      {hz:'团',py:'tuán'},{hz:'结',py:'jié'},{hz:'友',py:'yǒu'},{hz:'谊',py:'yì'},{hz:'情',py:'qíng'},
      {hz:'感',py:'gǎn'},{hz:'恩',py:'ēn'},{hz:'谢',py:'xiè'},{hz:'念',py:'niàn'},{hz:'思',py:'sī'},
      {hz:'想',py:'xiǎng'},{hz:'忆',py:'yì'},{hz:'怀',py:'huái'},{hz:'恋',py:'liàn'},{hz:'梦',py:'mèng'},
      {hz:'幻',py:'huàn'},{hz:'虚',py:'xū'},{hz:'拟',py:'nǐ'},{hz:'假',py:'jiǎ'},{hz:'设',py:'shè'},
      {hz:'预',py:'yù'},{hz:'测',py:'cè'},{hz:'估',py:'gū'},{hz:'猜',py:'cāi'},{hz:'疑',py:'yí'},
      {hz:'惑',py:'huò'},{hz:'迷',py:'mí'},{hz:'茫',py:'máng'},{hz:'困',py:'kùn'},{hz:'扰',py:'rǎo'},
      {hz:'折',py:'zhé'},{hz:'磨',py:'mó'},{hz:'煎',py:'jiān'},{hz:'熬',py:'áo'},{hz:'挣',py:'zhèng'},
      {hz:'扎',py:'zhá'},{hz:'脱',py:'tuō'},{hz:'逃',py:'táo'},{hz:'避',py:'bì'},{hz:'躲',py:'duǒ'},
      {hz:'藏',py:'cáng'},{hz:'隐',py:'yǐn'},{hz:'蔽',py:'bì'},{hz:'掩',py:'yǎn'},{hz:'盖',py:'gài'},
      {hz:'露',py:'lù'},{hz:'暴',py:'bào'},{hz:'揭',py:'jiē'},{hz:'披',py:'pī'},{hz:'泄',py:'xiè'},
      {hz:'漏',py:'lòu'},{hz:'透',py:'tòu'},{hz:'渗',py:'shèn'},{hz:'浸',py:'jìn'},{hz:'泡',py:'pào'},
      {hz:'滋',py:'zī'},{hz:'润',py:'rùn'},{hz:'养',py:'yǎng'},{hz:'育',py:'yù'},{hz:'培',py:'péi'},
      {hz:'训',py:'xùn'},{hz:'练',py:'liàn'},{hz:'锻',py:'duàn'},{hz:'炼',py:'liàn'},{hz:'磨',py:'mó'},
      {hz:'砺',py:'lì'},{hz:'锤',py:'chuí'},{hz:'打',py:'dǎ'},{hz:'造',py:'zào'},{hz:'塑',py:'sù'},
      {hz:'形',py:'xíng'},{hz:'态',py:'tài'},{hz:'姿',py:'zī'},{hz:'势',py:'shì'},{hz:'模',py:'mó'},
      {hz:'仿',py:'fǎng'},{hz:'效',py:'xiào'},{hz:'临',py:'lín'},{hz:'摹',py:'mó'},{hz:'描',py:'miáo'},
      {hz:'绘',py:'huì'},{hz:'勾',py:'gōu'},{hz:'勒',py:'lè'},{hz:'渲',py:'xuàn'},{hz:'染',py:'rǎn'},
      {hz:'烘',py:'hōng'},{hz:'托',py:'tuō'},{hz:'衬',py:'chèn'},{hz:'映',py:'yìng'},{hz:'辉',py:'huī'},
      {hz:'煌',py:'huáng'},{hz:'璀',py:'cuǐ'},{hz:'璨',py:'càn'},{hz:'绚',py:'xuàn'},{hz:'烂',py:'làn'},
      {hz:'缤',py:'bīn'},{hz:'纷',py:'fēn'},{hz:'斑',py:'bān'},{hz:'斓',py:'lán'},{hz:'素',py:'sù'},
      {hz:'雅',py:'yǎ'},{hz:'淡',py:'dàn'},{hz:'浓',py:'nóng'},{hz:'郁',py:'yù'},{hz:'清',py:'qīng'},
      {hz:'澈',py:'chè'},{hz:'浑',py:'hún'},{hz:'浊',py:'zhuó'},{hz:'纯',py:'chún'},{hz:'粹',py:'cuì'},
      {hz:'精',py:'jīng'},{hz:'华',py:'huá'},{hz:'粹',py:'cuì'},{hz:'尖',py:'jiān'},{hz:'端',py:'duān'},
      {hz:'顶',py:'dǐng'},{hz:'峰',py:'fēng'},{hz:'巅',py:'diān'},{hz:'极',py:'jí'},{hz:'限',py:'xiàn'},
      {hz:'境',py:'jìng'},{hz:'界',py:'jiè'},{hz:'层',py:'céng'},{hz:'次',py:'cì'},{hz:'级',py:'jí'},
      {hz:'等',py:'děng'},{hz:'阶',py:'jiē'},{hz:'段',py:'duàn'},{hz:'步',py:'bù'},{hz:'骤',py:'zhòu'},
      {hz:'秩',py:'zhì'},{hz:'序',py:'xù'},{hz:'条',py:'tiáo'},{hz:'框',py:'kuàng'},{hz:'格',py:'gé'},
      {hz:'局',py:'jú'},{hz:'阵',py:'zhèn'},{hz:'列',py:'liè'},{hz:'排',py:'pái'},{hz:'纵',py:'zòng'},
      {hz:'横',py:'héng'},{hz:'竖',py:'shù'},{hz:'斜',py:'xié'},{hz:'弯',py:'wān'},{hz:'曲',py:'qū'},
      {hz:'折',py:'zhé'},{hz:'弧',py:'hú'},{hz:'圆',py:'yuán'},{hz:'方',py:'fāng'},{hz:'角',py:'jiǎo'},
      {hz:'棱',py:'léng'},{hz:'锥',py:'zhuī'},{hz:'柱',py:'zhù'},{hz:'球',py:'qiú'},{hz:'环',py:'huán'},
      {hz:'扇',py:'shàn'},{hz:'梯',py:'tī'},{hz:'菱',py:'líng'},{hz:'椭',py:'tuǒ'},{hz:'旋',py:'xuán'},
      {hz:'涡',py:'wō'},{hz:'波',py:'bō'},{hz:'纹',py:'wén'},{hz:'斑',py:'bān'},{hz:'点',py:'diǎn'},
      {hz:'线',py:'xiàn'},{hz:'面',py:'miàn'},{hz:'体',py:'tǐ'},{hz:'积',py:'jī'},{hz:'容',py:'róng'},
      {hz:'周',py:'zhōu'},{hz:'径',py:'jìng'},{hz:'弦',py:'xián'},{hz:'切',py:'qiē'},{hz:'割',py:'gē'},
      {hz:'哎',py:'āi'},{hz:'唉',py:'ài'},{hz:'哟',py:'yō'},{hz:'喂',py:'wèi'},{hz:'哦',py:'ó'},
      {hz:'嗯',py:'èn'},{hz:'哩',py:'lī'},{hz:'咧',py:'liě'},{hz:'哇',py:'wā'},{hz:'咚',py:'dōng'},
      {hz:'哗',py:'huā'},{hz:'啪',py:'pā'},{hz:'砰',py:'pēng'},{hz:'轰',py:'hōng'},{hz:'吱',py:'zhī'},
      {hz:'嘎',py:'gā'},{hz:'嚓',py:'cā'},{hz:'喵',py:'miāo'},{hz:'汪',py:'wāng'},{hz:'咩',py:'miē'},
      {hz:'哞',py:'mōu'},{hz:'呱',py:'guā'},{hz:'叽',py:'jī'},{hz:'喳',py:'zhā'},{hz:'啾',py:'jiū'},
      {hz:'嘀',py:'dí'},{hz:'嗒',py:'dā'},{hz:'嗡',py:'wēng'},{hz:'嘶',py:'sī'},{hz:'吼',py:'hǒu'},
      {hz:'啸',py:'xiào'},{hz:'嚎',py:'háo'},{hz:'啼',py:'tí'},{hz:'鸣',py:'míng'},{hz:'吠',py:'fèi'},
      {hz:'嗥',py:'háo'},{hz:'嗅',py:'xiù'},{hz:'闻',py:'wén'},{hz:'臭',py:'chòu'},{hz:'腥',py:'xīng'},
      {hz:'臊',py:'sāo'},{hz:'膻',py:'shān'},{hz:'腐',py:'fǔ'},{hz:'霉',py:'méi'},{hz:'菌',py:'jūn'},
      {hz:'剂',py:'jì'},{hz:'丸',py:'wán'},{hz:'膏',py:'gāo'},{hz:'敷',py:'fū'},{hz:'卸',py:'xiè'},
      {hz:'载',py:'zài'},{hz:'递',py:'dì'},{hz:'撒',py:'sǎ'},{hz:'摇',py:'yáo'},{hz:'晃',py:'huàng'},
      {hz:'甩',py:'shuǎi'},{hz:'抛',py:'pāo'},{hz:'投',py:'tóu'},{hz:'掷',py:'zhì'},{hz:'击',py:'jī'},
      {hz:'扣',py:'kòu'},{hz:'拧',py:'nǐng'},{hz:'扭',py:'niǔ'},{hz:'扳',py:'bān'},{hz:'撬',py:'qiào'},
      {hz:'掀',py:'xiān'},{hz:'覆',py:'fù'},{hz:'淋',py:'lín'},{hz:'灌',py:'guàn'},{hz:'淘',py:'táo'},
      {hz:'浣',py:'huàn'},{hz:'漂',py:'piǎo'},{hz:'涤',py:'dí'},{hz:'拭',py:'shì'},{hz:'誉',py:'téng'},
      {hz:'讲',py:'jiǎng'},{hz:'谈',py:'tán'},{hz:'吵',py:'chǎo'},{hz:'嚷',py:'rǎng'},{hz:'寂',py:'jì'}
    ],
    // 五年级（约360字）
    5: [
      {hz:'哲',py:'zhé'},{hz:'理',py:'lǐ'},{hz:'道',py:'dào'},{hz:'德',py:'dé'},{hz:'品',py:'pǐn'},
      {hz:'格',py:'gé'},{hz:'修',py:'xiū'},{hz:'养',py:'yǎng'},{hz:'素',py:'sù'},{hz:'质',py:'zhì'},
      {hz:'涵',py:'hán'},{hz:'蕴',py:'yùn'},{hz:'底',py:'dǐ'},{hz:'蕴',py:'yùn'},{hz:'深',py:'shēn'},
      {hz:'厚',py:'hòu'},{hz:'博',py:'bó'},{hz:'渊',py:'yuān'},{hz:'广',py:'guǎng'},{hz:'阔',py:'kuò'},
      {hz:'宏',py:'hóng'},{hz:'伟',py:'wěi'},{hz:'浩',py:'hào'},{hz:'瀚',py:'hàn'},{hz:'渺',py:'miǎo'},
      {hz:'茫',py:'máng'},{hz:'辽',py:'liáo'},{hz:'敞',py:'chǎng'},{hz:'狭',py:'xiá'},{hz:'窄',py:'zhǎi'},
      {hz:'宽',py:'kuān'},{hz:'敞',py:'chǎng'},{hz:'豁',py:'huō'},{hz:'朗',py:'lǎng'},{hz:'明',py:'míng'},
      {hz:'媚',py:'mèi'},{hz:'娇',py:'jiāo'},{hz:'艳',py:'yàn'},{hz:'妖',py:'yāo'},{hz:'娆',py:'ráo'},
      {hz:'妩',py:'wǔ'},{hz:'婷',py:'tíng'},{hz:'娜',py:'nà'},{hz:'婉',py:'wǎn'},{hz:'柔',py:'róu'},
      {hz:'刚',py:'gāng'},{hz:'烈',py:'liè'},{hz:'猛',py:'měng'},{hz:'凶',py:'xiōng'},{hz:'狠',py:'hěn'},
      {hz:'残',py:'cán'},{hz:'酷',py:'kù'},{hz:'暴',py:'bào'},{hz:'虐',py:'nüè'},{hz:'毒',py:'dú'},
      {hz:'辣',py:'là'},{hz:'辛',py:'xīn'},{hz:'酸',py:'suān'},{hz:'涩',py:'sè'},{hz:'麻',py:'má'},
      {hz:'酥',py:'sū'},{hz:'脆',py:'cuì'},{hz:'嫩',py:'nèn'},{hz:'韧',py:'rèn'},{hz:'硬',py:'yìng'},
      {hz:'软',py:'ruǎn'},{hz:'滑',py:'huá'},{hz:'腻',py:'nì'},{hz:'粗',py:'cū'},{hz:'糙',py:'cāo'},
      {hz:'细',py:'xì'},{hz:'腻',py:'nì'},{hz:'光',py:'guāng'},{hz:'泽',py:'zé'},{hz:'莹',py:'yíng'},
      {hz:'晶',py:'jīng'},{hz:'莹',py:'yíng'},{hz:'剔',py:'tī'},{hz:'透',py:'tòu'},{hz:'玲',py:'líng'},
      {hz:'珑',py:'lóng'},{hz:'瑰',py:'guī'},{hz:'丽',py:'lì'},{hz:'绮',py:'qǐ'},{hz:'靡',py:'mǐ'},
      {hz:'奢',py:'shē'},{hz:'华',py:'huá'},{hz:'朴',py:'pǔ'},{hz:'素',py:'sù'},{hz:'简',py:'jiǎn'},
      {hz:'陋',py:'lòu'},{hz:'卑',py:'bēi'},{hz:'微',py:'wēi'},{hz:'渺',py:'miǎo'},{hz:'巍',py:'wēi'},
      {hz:'峨',py:'é'},{hz:'峻',py:'jùn'},{hz:'峭',py:'qiào'},{hz:'陡',py:'dǒu'},{hz:'险',py:'xiǎn'},
      {hz:'峻',py:'jùn'},{hz:'崎',py:'qí'},{hz:'岖',py:'qū'},{hz:'坎',py:'kǎn'},{hz:'坷',py:'kě'},
      {hz:'坦',py:'tǎn'},{hz:'荡',py:'dàng'},{hz:'舒',py:'shū'},{hz:'缓',py:'huǎn'},{hz:'徐',py:'xú'},
      {hz:'急',py:'jí'},{hz:'促',py:'cù'},{hz:'匆',py:'cōng'},{hz:'忙',py:'máng'},{hz:'悠',py:'yōu'},
      {hz:'闲',py:'xián'},{hz:'逸',py:'yì'},{hz:'恬',py:'tián'},{hz:'静',py:'jìng'},{hz:'谧',py:'mì'},
      {hz:'喧',py:'xuān'},{hz:'闹',py:'nào'},{hz:'嘈',py:'cáo'},{hz:'杂',py:'zá'},{hz:'鼎',py:'dǐng'},
      {hz:'沸',py:'fèi'},{hz:'腾',py:'téng'},{hz:'欢',py:'huān'},{hz:'呼',py:'hū'},{hz:'雀',py:'què'},
      {hz:'跃',py:'yuè'},{hz:'欣',py:'xīn'},{hz:'喜',py:'xǐ'},{hz:'若',py:'ruò'},{hz:'狂',py:'kuáng'},
      {hz:'陶',py:'táo'},{hz:'醉',py:'zuì'},{hz:'沉',py:'chén'},{hz:'浸',py:'jìn'},{hz:'痴',py:'chī'},
      {hz:'迷',py:'mí'},{hz:'恋',py:'liàn'},{hz:'眷',py:'juàn'},{hz:'顾',py:'gù'},{hz:'盼',py:'pàn'},
      {hz:'望',py:'wàng'},{hz:'期',py:'qī'},{hz:'待',py:'dài'},{hz:'憧',py:'chōng'},{hz:'憬',py:'jǐng'},
      {hz:'向',py:'xiàng'},{hz:'往',py:'wǎng'},{hz:'追',py:'zhuī'},{hz:'求',py:'qiú'},{hz:'寻',py:'xún'},
      {hz:'觅',py:'mì'},{hz:'搜',py:'sōu'},{hz:'索',py:'suǒ'},{hz:'侦',py:'zhēn'},{hz:'察',py:'chá'},
      {hz:'窥',py:'kuī'},{hz:'探',py:'tàn'},{hz:'勘',py:'kān'},{hz:'查',py:'chá'},{hz:'审',py:'shěn'},
      {hz:'核',py:'hé'},{hz:'校',py:'jiào'},{hz:'订',py:'dìng'},{hz:'鉴',py:'jiàn'},{hz:'别',py:'bié'},
      {hz:'辨',py:'biàn'},{hz:'认',py:'rèn'},{hz:'识',py:'shí'},{hz:'区',py:'qū'},{hz:'甄',py:'zhēn'},
      {hz:'筛',py:'shāi'},{hz:'选',py:'xuǎn'},{hz:'挑',py:'tiāo'},{hz:'拣',py:'jiǎn'},{hz:'择',py:'zé'},
      {hz:'取',py:'qǔ'},{hz:'舍',py:'shě'},{hz:'弃',py:'qì'},{hz:'丢',py:'diū'},{hz:'遗',py:'yí'},
      {hz:'失',py:'shī'},{hz:'落',py:'luò'},{hz:'掉',py:'diào'},{hz:'坠',py:'zhuì'},{hz:'跌',py:'diē'},
      {hz:'倒',py:'dǎo'},{hz:'倾',py:'qīng'},{hz:'斜',py:'xié'},{hz:'歪',py:'wāi'},{hz:'偏',py:'piān'},
      {hz:'倚',py:'yǐ'},{hz:'靠',py:'kào'},{hz:'依',py:'yī'},{hz:'附',py:'fù'},{hz:'属',py:'shǔ'},
      {hz:'隶',py:'lì'},{hz:'奴',py:'nú'},{hz:'仆',py:'pú'},{hz:'役',py:'yì'},{hz:'雇',py:'gù'},
      {hz:'佣',py:'yōng'},{hz:'聘',py:'pìn'},{hz:'任',py:'rèn'},{hz:'免',py:'miǎn'},{hz:'罢',py:'bà'},
      {hz:'黜',py:'chù'},{hz:'贬',py:'biǎn'},{hz:'谪',py:'zhé'},{hz:'迁',py:'qiān'},{hz:'徙',py:'xǐ'},
      {hz:'移',py:'yí'},{hz:'居',py:'jū'},{hz:'住',py:'zhù'},{hz:'宿',py:'sù'},{hz:'寄',py:'jì'},
      {hz:'寓',py:'yù'},{hz:'暂',py:'zàn'},{hz:'永',py:'yǒng'},{hz:'恒',py:'héng'},{hz:'瞬',py:'shùn'},
      {hz:'刹',py:'chà'},{hz:'顷',py:'qǐng'},{hz:'刻',py:'kè'},{hz:'即',py:'jí'},{hz:'立',py:'lì'},
      {hz:'顿',py:'dùn'},{hz:'骤',py:'zhòu'},{hz:'突',py:'tū'},{hz:'猛',py:'měng'},{hz:'忽',py:'hū'},
      {hz:'偶',py:'ǒu'},{hz:'频',py:'pín'},{hz:'屡',py:'lǚ'},{hz:'常',py:'cháng'},{hz:'惯',py:'guàn'},
      {hz:'习',py:'xí'},{hz:'俗',py:'sú'},{hz:'风',py:'fēng'},{hz:'尚',py:'shàng'},{hz:'潮',py:'cháo'},
      {hz:'流',py:'liú'},{hz:'派',py:'pài'},{hz:'宗',py:'zōng'},{hz:'系',py:'xì'},{hz:'脉',py:'mài'},
      {hz:'络',py:'luò'},{hz:'缔',py:'dì'},{hz:'盟',py:'méng'},{hz:'誓',py:'shì'},{hz:'约',py:'yuē'},
      {hz:'契',py:'qì'},{hz:'诺',py:'nuò'},{hz:'允',py:'yǔn'},{hz:'许',py:'xǔ'},{hz:'诺',py:'nuò'},
      {hz:'誓',py:'shì'},{hz:'宣',py:'xuān'},{hz:'布',py:'bù'},{hz:'颁',py:'bān'},{hz:'令',py:'lìng'},
      {hz:'禁',py:'jìn'},{hz:'止',py:'zhǐ'},{hz:'限',py:'xiàn'},{hz:'制',py:'zhì'},{hz:'约',py:'yuē'},
      {hz:'束',py:'shù'},{hz:'缚',py:'fù'},{hz:'拘',py:'jū'},{hz:'押',py:'yā'},{hz:'囚',py:'qiú'},
      {hz:'禁',py:'jìn'},{hz:'闭',py:'bì'},{hz:'锁',py:'suǒ'},{hz:'封',py:'fēng'},{hz:'启',py:'qǐ'},
      {hz:'寞',py:'mò'},{hz:'孤',py:'gū'},{hz:'死',py:'sǐ'},{hz:'没',py:'méi'},{hz:'毕',py:'bì'},
      {hz:'歇',py:'xiē'},{hz:'休',py:'xiū'},{hz:'憩',py:'qì'},{hz:'躺',py:'tǎng'},{hz:'卧',py:'wò'},
      {hz:'趴',py:'pā'},{hz:'蹲',py:'dūn'},{hz:'跪',py:'guì'},{hz:'蹦',py:'bèng'},{hz:'跨',py:'kuà'},
      {hz:'踩',py:'cǎi'},{hz:'踏',py:'tà'},{hz:'践',py:'jiàn'},{hz:'踢',py:'tī'},{hz:'蹬',py:'dēng'},
      {hz:'踹',py:'chuài'},{hz:'跺',py:'duò'},{hz:'抖',py:'dǒu'},{hz:'颤',py:'chàn'},{hz:'撼',py:'hàn'},
      {hz:'翔',py:'xiáng'},{hz:'翱',py:'áo'},{hz:'翼',py:'yì'},{hz:'膀',py:'bǎng'},{hz:'颈',py:'jǐng'},
      {hz:'嗓',py:'sǎng'},{hz:'瞳',py:'tóng'},{hz:'眸',py:'móu'},{hz:'眶',py:'kuàng'},{hz:'睫',py:'jié'},
      {hz:'眨',py:'zhǎ'},{hz:'睁',py:'zhēng'},{hz:'瞪',py:'dèng'},{hz:'盯',py:'dīng'},{hz:'瞧',py:'qiáo'},
      {hz:'瞄',py:'miáo'},{hz:'瞥',py:'piē'},{hz:'眺',py:'tiào'},{hz:'瞻',py:'zhān'},{hz:'俯',py:'fǔ'},
      {hz:'瞰',py:'kàn'},{hz:'睹',py:'dǔ'},{hz:'瞩',py:'zhǔ'},{hz:'瞅',py:'chǒu'},{hz:'瞟',py:'piǎo'},
      {hz:'瑞',py:'ruì'},{hz:'兆',py:'zhào'},{hz:'禄',py:'lù'},{hz:'寿',py:'shòu'},{hz:'矩',py:'jǔ'},
      {hz:'纪',py:'jì'},{hz:'宪',py:'xiàn'},{hz:'刑',py:'xíng'},{hz:'罚',py:'fá'},{hz:'罪',py:'zuì'},
      {hz:'惩',py:'chéng'},{hz:'拒',py:'jù'},{hz:'夺',py:'duó'},{hz:'抢',py:'qiǎng'},{hz:'掠',py:'lüè'},
      {hz:'侵',py:'qīn'},{hz:'犯',py:'fàn'},{hz:'攻',py:'gōng'},{hz:'佑',py:'yòu'},{hz:'佐',py:'zuǒ'},
      {hz:'辅',py:'fǔ'},{hz:'拯',py:'zhěng'},{hz:'赐',py:'cì'},{hz:'馈',py:'kuì'},{hz:'赋',py:'fù'},
      {hz:'税',py:'shuì'},{hz:'租',py:'zū'},{hz:'赁',py:'lìn'},{hz:'贷',py:'dài'},{hz:'圣',py:'shèng'}
    ],
    // 六年级（约395字）
    6: [
      {hz:'阐',py:'chǎn'},{hz:'述',py:'shù'},{hz:'论',py:'lùn'},{hz:'证',py:'zhèng'},{hz:'辩',py:'biàn'},
      {hz:'驳',py:'bó'},{hz:'斥',py:'chì'},{hz:'否',py:'fǒu'},{hz:'决',py:'jué'},{hz:'肯',py:'kěn'},
      {hz:'认',py:'rèn'},{hz:'承',py:'chéng'},{hz:'诺',py:'nuò'},{hz:'抵',py:'dǐ'},{hz:'赖',py:'lài'},
      {hz:'狡',py:'jiǎo'},{hz:'猾',py:'huá'},{hz:'诈',py:'zhà'},{hz:'骗',py:'piàn'},{hz:'欺',py:'qī'},
      {hz:'侮',py:'wǔ'},{hz:'凌',py:'líng'},{hz:'辱',py:'rǔ'},{hz:'蔑',py:'miè'},{hz:'鄙',py:'bǐ'},
      {hz:'歧',py:'qí'},{hz:'视',py:'shì'},{hz:'偏',py:'piān'},{hz:'见',py:'jiàn'},{hz:'成',py:'chéng'},
      {hz:'固',py:'gù'},{hz:'执',py:'zhí'},{hz:'顽',py:'wán'},{hz:'愚',py:'yú'},{hz:'蠢',py:'chǔn'},
      {hz:'笨',py:'bèn'},{hz:'拙',py:'zhuō'},{hz:'钝',py:'dùn'},{hz:'敏',py:'mǐn'},{hz:'捷',py:'jié'},
      {hz:'伶',py:'líng'},{hz:'俐',py:'lì'},{hz:'聪',py:'cōng'},{hz:'慧',py:'huì'},{hz:'睿',py:'ruì'},
      {hz:'颖',py:'yǐng'},{hz:'悟',py:'wù'},{hz:'领',py:'lǐng'},{hz:'会',py:'huì'},{hz:'贯',py:'guàn'},
      {hz:'通',py:'tōng'},{hz:'融',py:'róng'},{hz:'汇',py:'huì'},{hz:'综',py:'zōng'},{hz:'括',py:'kuò'},
      {hz:'概',py:'gài'},{hz:'述',py:'shù'},{hz:'摘',py:'zhāi'},{hz:'录',py:'lù'},{hz:'辑',py:'jí'},
      {hz:'纂',py:'zuǎn'},{hz:'撰',py:'zhuàn'},{hz:'著',py:'zhù'},{hz:'述',py:'shù'},{hz:'译',py:'yì'},
      {hz:'释',py:'shì'},{hz:'注',py:'zhù'},{hz:'疏',py:'shū'},{hz:'笺',py:'jiān'},{hz:'批',py:'pī'},
      {hz:'评',py:'píng'},{hz:'议',py:'yì'},{hz:'谏',py:'jiàn'},{hz:'讽',py:'fěng'},{hz:'刺',py:'cì'},
      {hz:'嘲',py:'cháo'},{hz:'弄',py:'nòng'},{hz:'戏',py:'xì'},{hz:'谑',py:'xuè'},{hz:'诙',py:'huī'},
      {hz:'谐',py:'xié'},{hz:'幽',py:'yōu'},{hz:'默',py:'mò'},{hz:'趣',py:'qù'},{hz:'味',py:'wèi'},
      {hz:'韵',py:'yùn'},{hz:'律',py:'lǜ'},{hz:'节',py:'jié'},{hz:'奏',py:'zòu'},{hz:'拍',py:'pāi'},
      {hz:'调',py:'diào'},{hz:'腔',py:'qiāng'},{hz:'吟',py:'yín'},{hz:'咏',py:'yǒng'},{hz:'诵',py:'sòng'},
      {hz:'朗',py:'lǎng'},{hz:'读',py:'dú'},{hz:'背',py:'bèi'},{hz:'诵',py:'sòng'},{hz:'默',py:'mò'},
      {hz:'抄',py:'chāo'},{hz:'眷',py:'téng'},{hz:'临',py:'lín'},{hz:'摹',py:'mó'},{hz:'拓',py:'tà'},
      {hz:'篆',py:'zhuàn'},{hz:'隶',py:'lì'},{hz:'楷',py:'kǎi'},{hz:'行',py:'xíng'},{hz:'草',py:'cǎo'},
      {hz:'狂',py:'kuáng'},{hz:'逸',py:'yì'},{hz:'飘',py:'piāo'},{hz:'洒',py:'sǎ'},{hz:'遒',py:'qiú'},
      {hz:'劲',py:'jìng'},{hz:'苍',py:'cāng'},{hz:'雄',py:'xióng'},{hz:'浑',py:'hún'},{hz:'厚',py:'hòu'},
      {hz:'磅',py:'páng'},{hz:'礴',py:'bó'},{hz:'气',py:'qì'},{hz:'势',py:'shì'},{hz:'恢',py:'huī'},
      {hz:'弘',py:'hóng'},{hz:'壮',py:'zhuàng'},{hz:'阔',py:'kuò'},{hz:'豪',py:'háo'},{hz:'迈',py:'mài'},
      {hz:'奔',py:'bēn'},{hz:'放',py:'fàng'},{hz:'激',py:'jī'},{hz:'越',py:'yuè'},{hz:'昂',py:'áng'},
      {hz:'扬',py:'yáng'},{hz:'抑',py:'yì'},{hz:'顿',py:'dùn'},{hz:'挫',py:'cuò'},{hz:'婉',py:'wǎn'},
      {hz:'转',py:'zhuǎn'},{hz:'缠',py:'chán'},{hz:'绵',py:'mián'},{hz:'悱',py:'fěi'},{hz:'恻',py:'cè'},
      {hz:'凄',py:'qī'},{hz:'楚',py:'chǔ'},{hz:'惨',py:'cǎn'},{hz:'切',py:'qiè'},{hz:'悲',py:'bēi'},
      {hz:'壮',py:'zhuàng'},{hz:'慷',py:'kāng'},{hz:'慨',py:'kǎi'},{hz:'凛',py:'lǐn'},{hz:'然',py:'rán'},
      {hz:'浩',py:'hào'},{hz:'荡',py:'dàng'},{hz:'磅',py:'páng'},{hz:'礴',py:'bó'},{hz:'澎',py:'péng'},
      {hz:'湃',py:'pài'},{hz:'汹',py:'xiōng'},{hz:'涌',py:'yǒng'},{hz:'翻',py:'fān'},{hz:'滚',py:'gǔn'},
      {hz:'搅',py:'jiǎo'},{hz:'拌',py:'bàn'},{hz:'混',py:'hùn'},{hz:'淆',py:'xiáo'},{hz:'搅',py:'jiǎo'},
      {hz:'扰',py:'rǎo'},{hz:'骚',py:'sāo'},{hz:'乱',py:'luàn'},{hz:'紊',py:'wěn'},{hz:'秩',py:'zhì'},
      {hz:'序',py:'xù'},{hz:'井',py:'jǐng'},{hz:'条',py:'tiáo'},{hz:'缕',py:'lǚ'},{hz:'纹',py:'wén'},
      {hz:'理',py:'lǐ'},{hz:'脉',py:'mài'},{hz:'络',py:'luò'},{hz:'纲',py:'gāng'},{hz:'领',py:'lǐng'},
      {hz:'枢',py:'shū'},{hz:'纽',py:'niǔ'},{hz:'键',py:'jiàn'},{hz:'关',py:'guān'},{hz:'隘',py:'ài'},
      {hz:'塞',py:'sài'},{hz:'障',py:'zhàng'},{hz:'碍',py:'ài'},{hz:'妨',py:'fáng'},{hz:'阻',py:'zǔ'},
      {hz:'隔',py:'gé'},{hz:'绝',py:'jué'},{hz:'断',py:'duàn'},{hz:'裂',py:'liè'},{hz:'碎',py:'suì'},
      {hz:'破',py:'pò'},{hz:'损',py:'sǔn'},{hz:'耗',py:'hào'},{hz:'竭',py:'jié'},{hz:'枯',py:'kū'},
      {hz:'萎',py:'wěi'},{hz:'凋',py:'diāo'},{hz:'零',py:'líng'},{hz:'谢',py:'xiè'},{hz:'衰',py:'shuāi'},
      {hz:'败',py:'bài'},{hz:'颓',py:'tuí'},{hz:'废',py:'fèi'},{hz:'墟',py:'xū'},{hz:'遗',py:'yí'},
      {hz:'址',py:'zhǐ'},{hz:'迹',py:'jì'},{hz:'痕',py:'hén'},{hz:'印',py:'yìn'},{hz:'烙',py:'lào'},
      {hz:'铭',py:'míng'},{hz:'刻',py:'kè'},{hz:'雕',py:'diāo'},{hz:'琢',py:'zhuó'},{hz:'磨',py:'mó'},
      {hz:'砺',py:'lì'},{hz:'砥',py:'dǐ'},{hz:'砺',py:'lì'},{hz:'淬',py:'cuì'},{hz:'炼',py:'liàn'},
      {hz:'熔',py:'róng'},{hz:'铸',py:'zhù'},{hz:'冶',py:'yě'},{hz:'锻',py:'duàn'},{hz:'轧',py:'zhá'},
      {hz:'碾',py:'niǎn'},{hz:'磨',py:'mò'},{hz:'研',py:'yán'},{hz:'捣',py:'dǎo'},{hz:'舂',py:'chōng'},
      {hz:'筛',py:'shāi'},{hz:'滤',py:'lǜ'},{hz:'澄',py:'chéng'},{hz:'淀',py:'diàn'},{hz:'沉',py:'chén'},
      {hz:'积',py:'jī'},{hz:'聚',py:'jù'},{hz:'累',py:'lěi'},{hz:'蓄',py:'xù'},{hz:'储',py:'chǔ'},
      {hz:'备',py:'bèi'},{hz:'预',py:'yù'},{hz:'防',py:'fáng'},{hz:'范',py:'fàn'},{hz:'戒',py:'jiè'},
      {hz:'警',py:'jǐng'},{hz:'惕',py:'tì'},{hz:'慎',py:'shèn'},{hz:'谨',py:'jǐn'},{hz:'严',py:'yán'},
      {hz:'肃',py:'sù'},{hz:'庄',py:'zhuāng'},{hz:'穆',py:'mù'},{hz:'端',py:'duān'},{hz:'庄',py:'zhuāng'},
      {hz:'雅',py:'yǎ'},{hz:'儒',py:'rú'},{hz:'斯',py:'sī'},{hz:'绅',py:'shēn'},{hz:'士',py:'shì'},
      {hz:'淑',py:'shū'},{hz:'贤',py:'xián'},{hz:'惠',py:'huì'},{hz:'德',py:'dé'},{hz:'馨',py:'xīn'},
      {hz:'懿',py:'yì'},{hz:'范',py:'fàn'},{hz:'楷',py:'kǎi'},{hz:'模',py:'mó'},{hz:'典',py:'diǎn'},
      {hz:'型',py:'xíng'},{hz:'榜',py:'bǎng'},{hz:'样',py:'yàng'},{hz:'标',py:'biāo'},{hz:'杆',py:'gān'},
      {hz:'旌',py:'jīng'},{hz:'旗',py:'qí'},{hz:'帜',py:'zhì'},{hz:'徽',py:'huī'},{hz:'章',py:'zhāng'},
      {hz:'勋',py:'xūn'},{hz:'功',py:'gōng'},{hz:'绩',py:'jì'},{hz:'业',py:'yè'},{hz:'勋',py:'xūn'},
      {hz:'劳',py:'láo'},{hz:'苦',py:'kǔ'},{hz:'艰',py:'jiān'},{hz:'辛',py:'xīn'},{hz:'勤',py:'qín'},
      {hz:'奋',py:'fèn'},{hz:'勉',py:'miǎn'},{hz:'励',py:'lì'},{hz:'志',py:'zhì'},{hz:'誓',py:'shì'},
      {hz:'决',py:'jué'},{hz:'毅',py:'yì'},{hz:'恒',py:'héng'},{hz:'持',py:'chí'},{hz:'续',py:'xù'},
      {hz:'英',py:'yīng'},{hz:'俊',py:'jùn'},{hz:'彦',py:'yàn'},{hz:'卓',py:'zhuó'},{hz:'伦',py:'lún'},
      {hz:'魁',py:'kuí'},{hz:'首',py:'shǒu'},{hz:'冠',py:'guàn'},{hz:'甲',py:'jiǎ'},{hz:'霸',py:'bà'},
      {hz:'帝',py:'dì'},{hz:'皇',py:'huáng'},{hz:'宰',py:'zǎi'},{hz:'相',py:'xiàng'},{hz:'帅',py:'shuài'},
      {hz:'尉',py:'wèi'},{hz:'兵',py:'bīng'},{hz:'卒',py:'zú'},{hz:'威',py:'wēi'},{hz:'稳',py:'wěn'},
      {hz:'妥',py:'tuǒ'},{hz:'当',py:'dāng'},{hz:'恰',py:'qià'},{hz:'宜',py:'yí'},{hz:'适',py:'shì'},
      {hz:'符',py:'fú'},{hz:'吻',py:'wěn'},{hz:'紧',py:'jǐn'},{hz:'弛',py:'chí'},{hz:'懈',py:'xiè'},
      {hz:'怠',py:'dài'},{hz:'惰',py:'duò'},{hz:'懒',py:'lǎn'},{hz:'灵',py:'líng'},{hz:'巧',py:'qiǎo'},
      {hz:'颂',py:'sòng'},{hz:'籍',py:'jí'},{hz:'册',py:'cè'},{hz:'篇',py:'piān'},{hz:'言',py:'yán'},
      {hz:'辞',py:'cí'},{hz:'藻',py:'zǎo'},{hz:'翰',py:'hàn'},{hz:'帛',py:'bó'},{hz:'牍',py:'dú'},
      {hz:'经',py:'jīng'},{hz:'纬',py:'wěi'},{hz:'误',py:'wù'},{hz:'讹',py:'é'},{hz:'谬',py:'miù'},
      {hz:'构',py:'gòu'},{hz:'谋',py:'móu'},{hz:'孝',py:'xiào'},{hz:'廉',py:'lián'},
      {hz:'剑',py:'jiàn'},{hz:'盾',py:'dùn'},{hz:'矛',py:'máo'},{hz:'弓',py:'gōng'},{hz:'弩',py:'nǔ'},
      {hz:'炮',py:'pào'},{hz:'枪',py:'qiāng'},{hz:'仗',py:'zhàng'},{hz:'战',py:'zhàn'},{hz:'敌',py:'dí'},
      {hz:'冤',py:'yuān'},{hz:'屈',py:'qū'},{hz:'伸',py:'shēn'},{hz:'驰',py:'chí'},{hz:'朽',py:'xiǔ'},
      {hz:'绽',py:'zhàn'},{hz:'钥',py:'yào'},{hz:'匙',py:'shi'},{hz:'链',py:'liàn'},{hz:'盔',py:'kuī'},
      {hz:'铠',py:'kǎi'},{hz:'袍',py:'páo'},{hz:'裳',py:'shang'},{hz:'裙',py:'qún'},{hz:'裤',py:'kù'},
      {hz:'衫',py:'shān'},{hz:'袖',py:'xiù'},{hz:'钩',py:'gōu'},{hz:'圈',py:'quān'},{hz:'套',py:'tào'},
      {hz:'罩',py:'zhào'}
    ]
  };

  // ============ 扩展字库（补充到 2500+） ============
  var EXTRA_BANK = {
    1: [
      {hz:'晨',py:'chén'},{hz:'晚',py:'wǎn'},{hz:'梦',py:'mèng'},{hz:'醒',py:'xǐng'},{hz:'桥',py:'qiáo'},
      {hz:'岸',py:'àn'},{hz:'塔',py:'tǎ'},{hz:'灯',py:'dēng'},{hz:'井',py:'jǐng'},{hz:'塔',py:'tǎ'},
      {hz:'窗',py:'chuāng'},{hz:'帘',py:'lián'},{hz:'床',py:'chuáng'},{hz:'席',py:'xí'},{hz:'砖',py:'zhuān'},
      {hz:'瓦',py:'wǎ'},{hz:'泥',py:'ní'},{hz:'墙',py:'qiáng'},{hz:'砖',py:'zhuān'},{hz:'壳',py:'ké'}
    ],
    2: [
      {hz:'星',py:'xīng'},{hz:'宿',py:'sù'},{hz:'河',py:'hé'},{hz:'流',py:'liú'},{hz:'雁',py:'yàn'},
      {hz:'鹭',py:'lù'},{hz:'燕',py:'yàn'},{hz:'鹤',py:'hè'},{hz:'鹊',py:'què'},{hz:'鸥',py:'ōu'},
      {hz:'鹃',py:'juān'},{hz:'鸦',py:'yā'},{hz:'鹰',py:'yīng'},{hz:'隼',py:'sǔn'},{hz:'雏',py:'chú'},
      {hz:'翎',py:'líng'},{hz:'羽',py:'yǔ'},{hz:'翼',py:'yì'},{hz:'鳞',py:'lín'},{hz:'鳍',py:'qí'}
    ],
    3: [
      {hz:'岩',py:'yán'},{hz:'崖',py:'yá'},{hz:'谷',py:'gǔ'},{hz:'湾',py:'wān'},{hz:'峡',py:'xiá'},
      {hz:'岭',py:'lǐng'},{hz:'峰',py:'fēng'},{hz:'岚',py:'lán'},{hz:'陂',py:'pō'},{hz:'泽',py:'zé'},
      {hz:'沼',py:'zhǎo'},{hz:'源',py:'yuán'},{hz:'涨',py:'zhǎng'},{hz:'潮',py:'cháo'},{hz:'汀',py:'tīng'},
      {hz:'湾',py:'wān'},{hz:'涌',py:'yǒng'},{hz:'涛',py:'tāo'},{hz:'浪',py:'làng'},{hz:'滨',py:'bīn'}
    ],
    4: [
      {hz:'棋',py:'qí'},{hz:'局',py:'jú'},{hz:'将',py:'jiàng'},{hz:'帅',py:'shuài'},{hz:'兵',py:'bīng'},
      {hz:'卒',py:'zú'},{hz:'阵',py:'zhèn'},{hz:'营',py:'yíng'},{hz:'队',py:'duì'},{hz:'旗',py:'qí'},
      {hz:'帜',py:'zhì'},{hz:'戈',py:'gē'},{hz:'戎',py:'róng'},{hz:'戌',py:'xū'},{hz:'戍',py:'shù'},
      {hz:'弩',py:'nǔ'},{hz:'弦',py:'xián'},{hz:'弧',py:'hú'},{hz:'弯',py:'wān'},{hz:'弛',py:'chí'}
    ],
    5: [
      {hz:'霁',py:'jì'},{hz:'霄',py:'xiāo'},{hz:'霜',py:'shuāng'},{hz:'霆',py:'tíng'},{hz:'露',py:'lù'},
      {hz:'霞',py:'xiá'},{hz:'曦',py:'xī'},{hz:'晖',py:'huī'},{hz:'暮',py:'mù'},{hz:'晦',py:'huì'},
      {hz:'暄',py:'xuān'},{hz:'暖',py:'nuǎn'},{hz:'煦',py:'xù'},{hz:'晴',py:'qíng'},{hz:'冉',py:'rǎn'},
      {hz:'冥',py:'míng'},{hz:'澄',py:'chéng'},{hz:'澈',py:'chè'},{hz:'湛',py:'zhàn'},{hz:'漾',py:'yàng'}
    ],
    6: [
      {hz:'珂',py:'kē'},{hz:'瑶',py:'yáo'},{hz:'瑛',py:'yīng'},{hz:'璧',py:'bì'},{hz:'璨',py:'càn'},
      {hz:'璞',py:'pú'},{hz:'瑾',py:'jǐn'},{hz:'瑜',py:'yú'},{hz:'琛',py:'chēn'},{hz:'琼',py:'qióng'},
      {hz:'琥',py:'hǔ'},{hz:'珀',py:'pò'},{hz:'琉',py:'liú'},{hz:'璃',py:'lí'},{hz:'珑',py:'lóng'},
      {hz:'澜',py:'lán'},{hz:'潋',py:'liàn'},{hz:'漪',py:'yī'},{hz:'漠',py:'mò'},{hz:'溢',py:'yì'}
    ]
  };

  function buildBankMap() {
    var map = {};
    for (var grade in BANK) {
      var base = BANK[grade] || [];
      var extra = EXTRA_BANK[grade] || EXTRA_BANK[1] || [];
      map[grade] = base.concat(extra);
    }
    return map;
  }

  var BANK_MAP = buildBankMap();

  // ============ 工具函数 ============

  /** 获取所有年级的汉字总数 */
  function totalCount() {
    var sum = 0;
    for (var g in BANK) { sum += BANK[g].length; }
    return sum;
  }

  /** 获取指定年级的词库 */
  function getGrade(level) {
    return BANK_MAP[level] || BANK_MAP[1];
  }

  /** 获取所有汉字（扁平化，去重） */
  function getAllWords() {
    var all = [];
    for (var g in BANK_MAP) { all = all.concat(BANK_MAP[g]); }
    return all;
  }

  /** 增强版随机整数 */
  function randInt(min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  /** Fisher-Yates 洗牌 */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /** 从词库中随机选取 n 个不重复的词条 */
  function pickRandom(level, n) {
    var pool = shuffle(getGrade(level));
    return pool.slice(0, Math.min(n, pool.length));
  }

  /** 标准化拼音（去声调、去空格、小写） */
  function normPY(s) {
    if (!s) return '';
    return s.toLowerCase()
      .split('').map(function(c) { return TONE_MAP[c] || c; }).join('')
      .replace(/\s+/g, '')
      .replace(/v/g, 'ü')
      .replace(/[:：]/g, '');
  }

  /** 标准化汉字（去空格） */
  function normHZ(s) {
    if (!s) return '';
    return s.replace(/\s+/g, '').trim();
  }

  // ============ 导出到全局 ============
  global.PINYIN_BANK = {
    bank: BANK_MAP,
    totalCount: totalCount,
    getGrade: getGrade,
    getAllWords: getAllWords,
    randInt: randInt,
    shuffle: shuffle,
    pickRandom: pickRandom,
    normPY: normPY,
    normHZ: normHZ,
    TONE_MAP: TONE_MAP
  };

})(typeof window !== 'undefined' ? window : this);