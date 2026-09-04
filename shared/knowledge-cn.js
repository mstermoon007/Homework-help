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
              "difficulty": 2,
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
              "difficulty": 2,
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
