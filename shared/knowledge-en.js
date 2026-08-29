/**
 * shared/knowledge-en.js — 英语（E 系列；当前含三年级 E1/E2）知识库数据分片
 *
 * 由入口 shared/knowledge-bank.js（查询方法 + SHARDS 路径映射表）按需加载：
 * 浏览器加载顺序必须先入口后本分片；Node 环境由入口自动 require 装配。
 */
(function (global) {
  'use strict';
  var DATA = [
      {
        grade: 3,
        modules: [
          {
            moduleId: "E1",
            knowledgePoints: [
              {
                id: "en-g3-e1-letter-recognition",
                name: "字母认读",
                pluginId: "english-alphabet",
                weight: 3,
                type: "all",
                description: "26 个字母的大小写辨认、书写规范与字母顺序。",
                example: "「Bb」的大写是 B，小写是 b，排在字母表第 2 位。",
                prerequisites: [],
                related: ["en-g3-e1-letter-sound"],
                difficulty: 1,
                spiral_level: 1,
                max_spiral_level: 1,
                cognitive_level: "掌握",
                applicable_question_types: [ { type: "all", coefficient: 1 } ],
                number_range_default: { min: 1, max: 1 },
                max_steps_default: 2,
                context_default: "standard",
                status: "active"
              },
              {
                id: "en-g3-e1-letter-sound",
                name: "字母音",
                pluginId: "english-alphabet",
                weight: 2,
                type: "all",
                description: "元音字母（a e i o u）与辅音字母的基本发音区分。",
                example: "apple 中 a 发 /æ/ 音，是元音字母。",
                prerequisites: [],
                related: ["en-g3-e1-letter-recognition"],
                difficulty: 1,
                spiral_level: 1,
                max_spiral_level: 1,
                cognitive_level: "掌握",
                applicable_question_types: [ { type: "all", coefficient: 1 } ],
                number_range_default: { min: 1, max: 1 },
                max_steps_default: 2,
                context_default: "standard",
                status: "active"
              }
            ]
          },
          {
            moduleId: "E2",
            knowledgePoints: [
              {
                id: "en-g3-e2-word-spelling",
                name: "单词拼写",
                weight: 3,
                type: "mix",
                description: "三~六年级核心词表的拼写练习（占位：待词汇拼写插件实现后激活）。",
                example: "book → b-o-o-k。",
                prerequisites: ["en-g3-e1-letter-recognition"],
                related: [],
                difficulty: 1,
                spiral_level: 1,
                max_spiral_level: 1,
                cognitive_level: "掌握",
                applicable_question_types: [ { type: "mix", coefficient: 1 } ],
                number_range_default: { min: 1, max: 1 },
                max_steps_default: 2,
                context_default: "standard",
                status: "placeholder"
              }
            ]
          }
        ]
      }
  ];

  if (!global.KnowledgeBank) {
    throw new Error('knowledge-en.js 必须在 knowledge-bank.js 之后加载');
  }
  global.KnowledgeBank.en = DATA;

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
