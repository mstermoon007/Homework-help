/**
 * shared/knowledge-cn.js — 语文知识库数据分片（任务：n1/n2 一至三年级全量）
 *
 * 由入口 shared/knowledge-bank.js 按需加载；条目含科目扩展字段：
 * moduleId / category(pinyin|hanzi) / exerciseTypes(题型生成器 ID 数组) /
 * bankRef(pinyinBank 现存 | hanziBank 预留)。
 */
(function (global) {
  'use strict';
  var DATA =
[
    {
      "grade": 1,
      "modules": [
        {
          "moduleId": "N1",
          "knowledgePoints": [
            {
              "id": "cn-g1-n1-pinyin-basic",
              "name": "拼音基础",
              "pluginId": "chinese-pinyin",
              "weight": 3,
              "type": "mix",
              "description": "声母、韵母与整体认读音节的认读，及四声标调规则（a 母出现不放过等标调口诀）。",
              "example": "「b—a」拼读为 ba，配上第四声读作 bà。",
              "prerequisites": [],
              "related": [
                "cn-g1-n1-pinyin-to-char",
                "cn-g1-n1-char-to-pinyin"
              ],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "认识汉语拼音的 23 个声母、24 个韵母与 16 个整体认读音节，能正确认读与书写。",
              "factualContent": {"classification":"声母 23 个（b p m f d t n l g k h j q x zh ch sh r z c s y w）；韵母 24 个（a o e i u ü 及复韵母、鼻韵母）；整体认读音节 16 个（zhi chi shi ri zi ci si yi wu yu ye yue yuan yin yun ying）"},
              "graphicType": "text",
              "common_errors": [{"id":"pinyin-initial-confuse","category":"reading","description":"形近声母混淆：b/d、p/q、f/t 认读或书写混淆"},{"id":"pinyin-final-mixup","category":"reading","description":"韵母混淆：an/ang、en/eng、in/ing 前后鼻音区分不清"},{"id":"whole-syllable-misread","category":"notation","description":"整体认读音节误按两拼拆读（如把 zhi 拼成 z-i）"}],
              "moduleId": "n1",
              "category": "pinyin",
              "bankRef": "pinyinBank",
              "exerciseTypes": [
                "chinese-pinyin",
                "chinese-comprehensive"
              ]
            },
            {
              "id": "cn-g1-n1-pinyin-to-char",
              "name": "看拼音写字",
              "pluginId": "pinyin-to-char",
              "weight": 3,
              "type": "mix",
              "description": "根据拼音写出对应的生字词，巩固声韵调的分解与字音对应。",
              "example": "拼音「shū běn」对应词语「书本」。",
              "prerequisites": [
                "cn-g1-n1-pinyin-basic"
              ],
              "related": [
                "cn-g1-n1-char-to-pinyin"
              ],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "根据拼音写出对应的汉字，考查音节与字形的对应，需结合语境确定正确用字。",
              "factualContent": {"relationship":"拼音音节（声母+韵母+声调）→ 对应汉字；同音字需结合词语语境选字（如 mā→妈、mǎ→马）"},
              "graphicType": "text",
              "common_errors": [{"id":"pinyin-char-homophone","category":"concept","description":"同音字混淆：根据拼音选错同音字（如把“目”写成“木”）"},{"id":"pinyin-char-tone-miss","category":"notation","description":"忽略声调导致用字错误（如 mǎ 写成“妈”）"}],
              "moduleId": "n1",
              "category": "pinyin",
              "bankRef": "pinyinBank",
              "exerciseTypes": [
                "pinyin-to-char"
              ]
            },
            {
              "id": "cn-g1-n1-char-to-pinyin",
              "name": "看字写拼音",
              "pluginId": "chinese-comprehensive",
              "weight": 2,
              "type": "mix",
              "description": "给出生字标注拼音，反向训练字音映射与标调位置。",
              "example": "汉字「花」的拼音为 huā（一声）。",
              "prerequisites": [
                "cn-g1-n1-pinyin-basic"
              ],
              "related": [],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "根据汉字写出正确的拼音，包括完整的声母、韵母和正确的声调。",
              "factualContent": {"rule":"写拼音需声母、韵母完整且声调标对；音节符合拼写规则（如 j q x 与 ü 相拼去两点）"},
              "graphicType": "text",
              "common_errors": [{"id":"char-pinyin-tone-error","category":"notation","description":"声调标错或漏标（如把第二声标成第三声）"},{"id":"char-pinyin-umlaut-miss","category":"notation","description":"j/q/x 与 ü 相拼未去两点（如 qù 写成 qu 或 qü）"}],
              "moduleId": "n1",
              "category": "pinyin",
              "bankRef": "pinyinBank",
              "exerciseTypes": [
                "chinese-comprehensive"
              ]
            },
            {
              "id": "cn-g1-n1-tone-marks",
              "name": "标调规则",
              "pluginId": "chinese-pinyin",
              "weight": 2,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "标调位置口诀（a 母出现不放过等）与轻声初识。",
              "example": "「hǎo」调号标在 a 上；「guī」iu 相并标在后。",
              "prerequisites": [
                "cn-g1-n1-pinyin-basic"
              ],
              "related": [
                "cn-g1-n1-syllable-spelling"
              ],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "掌握汉语拼音标调规则：有 a 找 a，没 a 找 o、e，i、u 并列标在后。",
              "factualContent": {"rule":"标调口诀：有 a 不放过，没 a 找 o、e，i、u 并列标在后；i 上标调去点"},
              "graphicType": "text",
              "common_errors": [{"id":"tone-mark-position-error","category":"notation","description":"声调标在错误的位置（如标在声母上）"},{"id":"tone-iu-rule-error","category":"notation","description":"i、u 并列时标调位置选错（如 ui 标在 i 上）"},{"id":"tone-i-dot-error","category":"notation","description":"i 上标调时未去掉 i 上的点"}],
            },
            {
              "id": "cn-g1-n1-syllable-spelling",
              "name": "两拼与三拼音节",
              "pluginId": "chinese-pinyin",
              "weight": 2,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "两拼音节声韵相碰与三拼连读（声—介—韵）。",
              "example": "「xiā」为三拼音节，x—i—ā 连读。",
              "prerequisites": [
                "cn-g1-n1-pinyin-basic"
              ],
              "related": [],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "正确拼读两拼音节（声母+韵母）与三拼音节（声母+介母+韵母）。",
              "factualContent": {"rule":"两拼音节：声母+韵母（b-a→ba）；三拼音节：声母+介母+韵母（g-u-a→gua），介母多为 i、u、ü"},
              "graphicType": "text",
              "common_errors": [{"id":"syllable-mediate-miss","category":"operation","description":"三拼音节漏拼介母（如 gua 拼成 ga）"},{"id":"syllable-split-error","category":"reading","description":"拼读时声韵母分割错误导致音节拼错"}],
            }
          ]
        },
        {
          "moduleId": "N2",
          "knowledgePoints": [
            {
              "id": "cn-g1-n2-stroke-order",
              "name": "笔顺",
              "pluginId": "chinese-hanzi",
              "weight": 2,
              "type": "mix",
              "description": "基本笔画的书写顺序规则（先横后竖、先撇后捺、从上到下、从左到右）。",
              "example": "「十」的笔顺：先写横，再写竖。",
              "prerequisites": [],
              "related": [
                "cn-g1-n2-word-structure"
              ],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "掌握汉字基本笔顺规则：先横后竖、先撇后捺、从上到下、从左到右、先外后内、先中间后两边、先外后里再封口。",
              "factualContent": {"rule":"笔顺基本规则：先横后竖、先撇后捺、从上到下、从左到右、先外后内、先中间后两边、先外后里再封口"},
              "graphicType": "text",
              "common_errors": [{"id":"stroke-order-rule-error","category":"operation","description":"笔顺规则应用错误（如先写竖再写横、先内后外）"},{"id":"stroke-order-count-error","category":"writing","description":"笔画数数错（漏数或重复数笔画）"}],
              "moduleId": "n2",
              "category": "hanzi",
              "bankRef": "hanziBank",
              "exerciseTypes": []
            },
            {
              "id": "cn-g1-n2-word-structure",
              "name": "字形结构",
              "pluginId": "chinese-hanzi",
              "weight": 2,
              "type": "mix",
              "description": "独体字与合体字（上下、左右、包围结构）的辨识与偏旁部首归类。",
              "example": "「明」是左右结构，由「日」和「月」组成。",
              "prerequisites": [],
              "related": [
                "cn-g1-n2-stroke-order"
              ],
              "difficulty": 1,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active",
              "concept": "认识汉字基本结构类型：独体字、左右结构、上下结构、半包围、全包围等。",
              "factualContent": {"classification":"汉字结构：独体字（日、月、山）；左右结构（明、林、们）；上下结构（花、星、雪）；半包围（这、问、同）；全包围（回、园）"},
              "graphicType": "text",
              "common_errors": [{"id":"char-structure-misclass","category":"concept","description":"字形结构归类错误（如把左右结构归为上下结构）"},{"id":"char-structure-parts-mixup","category":"structure","description":"结构部件拆分错误，混淆部件归属"}],
              "moduleId": "n2",
              "category": "hanzi",
              "bankRef": "hanziBank",
              "exerciseTypes": []
            }
          ]
        }
      ]
    },
    {
      "grade": 2,
      "modules": [
        {
          "moduleId": "N1",
          "knowledgePoints": [
            {
              "id": "cn-g2-n1-alphabet-order",
              "name": "字母表与音序",
              "pluginId": null,
              "weight": 2,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "《汉语拼音字母表》大小写对应与音序排列。",
              "example": "「花」的音序是 H。",
              "prerequisites": [
                "cn-g1-n1-pinyin-basic"
              ],
              "related": [
                "cn-g3-n2-dictionary-lookup"
              ],
              "difficulty": 3,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "placeholder"
            },
            {
              "id": "cn-g2-n1-pinyin-review",
              "name": "易错拼音辨析",
              "pluginId": null,
              "weight": 2,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "平翘舌、前后鼻音及易混韵母对比辨析。",
              "example": "「sì」平舌与「shì」翘舌区分。",
              "prerequisites": [
                "cn-g1-n1-tone-marks",
                "cn-g1-n1-syllable-spelling"
              ],
              "related": [
                "cn-g3-n1-vowel-confusion"
              ],
              "difficulty": 3,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "placeholder"
            }
          ]
        },
        {
          "moduleId": "N2",
          "knowledgePoints": [
            {
              "id": "cn-g2-n2-radical-grouping",
              "name": "部首归类",
              "pluginId": "chinese-hanzi",
              "weight": 3,
              "type": "mix",
              "moduleId": "n2",
              "category": "hanzi",
              "exerciseTypes": [],
              "bankRef": "hanziBank",
              "description": "按部首归拢生字，理解形旁表义。",
              "example": "「江河湖」同带三点水。",
              "prerequisites": [
                "cn-g1-n2-word-structure"
              ],
              "related": [
                "cn-g3-n2-dictionary-lookup"
              ],
              "difficulty": 3,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            },
            {
              "id": "cn-g2-n2-similar-characters",
              "name": "形近字辨析",
              "pluginId": "chinese-hanzi",
              "weight": 3,
              "type": "mix",
              "moduleId": "n2",
              "category": "hanzi",
              "exerciseTypes": [],
              "bankRef": "hanziBank",
              "description": "字形相近生字的笔画差异与组词区分。",
              "example": "「未」上横短、「末」上横长。",
              "prerequisites": [
                "cn-g1-n2-word-structure"
              ],
              "related": [],
              "difficulty": 4,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            }
          ]
        }
      ]
    },
    {
      "grade": 3,
      "modules": [
        {
          "moduleId": "N1",
          "knowledgePoints": [
            {
              "id": "cn-g3-n1-multi-pronunciation",
              "name": "多音字读音",
              "pluginId": "chinese-pinyin",
              "weight": 3,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "常见多音字在不同词语中的读音选择。",
              "example": "「乐」lè（快乐）/ yuè（音乐）。",
              "prerequisites": [
                "cn-g2-n1-pinyin-review"
              ],
              "related": [
                "cn-g3-n2-homophone-chars"
              ],
              "difficulty": 5,
              "spiral_level": 2,
              "max_spiral_level": 3,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            },
            {
              "id": "cn-g3-n1-vowel-confusion",
              "name": "易混韵母辨析",
              "pluginId": "chinese-pinyin",
              "weight": 3,
              "type": "mix",
              "moduleId": "n1",
              "category": "pinyin",
              "exerciseTypes": [
                "chinese-pinyin"
              ],
              "bankRef": "pinyinBank",
              "description": "ie/ei、iu/ui 等易混韵母辨析。",
              "example": "「别 bié」与「杯 bēi」韵母差异。",
              "prerequisites": [
                "cn-g2-n1-pinyin-review"
              ],
              "related": [],
              "difficulty": 5,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            }
          ]
        },
        {
          "moduleId": "N2",
          "knowledgePoints": [
            {
              "id": "cn-g3-n2-dictionary-lookup",
              "name": "查字典",
              "pluginId": "chinese-hanzi",
              "weight": 4,
              "type": "mix",
              "moduleId": "n2",
              "category": "hanzi",
              "exerciseTypes": [],
              "bankRef": "hanziBank",
              "description": "音序查字法与部首查字法步骤及配合。",
              "example": "知读音用音序法；不知读音数部首笔画。",
              "prerequisites": [
                "cn-g2-n1-alphabet-order",
                "cn-g2-n2-radical-grouping"
              ],
              "related": [],
              "difficulty": 5,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            },
            {
              "id": "cn-g3-n2-homophone-chars",
              "name": "同音字用字",
              "pluginId": "chinese-hanzi",
              "weight": 4,
              "type": "mix",
              "moduleId": "n2",
              "category": "hanzi",
              "exerciseTypes": [],
              "bankRef": "hanziBank",
              "description": "同音异形字在词语中的正确选用。",
              "example": "「再」表又一次，「在」表地点时间。",
              "prerequisites": [
                "cn-g3-n1-multi-pronunciation"
              ],
              "related": [],
              "difficulty": 5,
              "spiral_level": 1,
              "max_spiral_level": 1,
              "cognitive_level": "掌握",
              "applicable_question_types": [ { "type": "calc", "rawType": "mix", "coefficient": 1 } ],
              "number_range_default": { "min": 1, "max": 1 },
              "max_steps_default": 2,
              "context_default": "standard",
              "status": "active"
            }
          ]
        }
      ]
    }
  ];

  if (!global.KnowledgeBank) {
    throw new Error('knowledge-cn.js 必须在 knowledge-bank.js 之后加载');
  }
  global.KnowledgeBank.cn = DATA;

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
