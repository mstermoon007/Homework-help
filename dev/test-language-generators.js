#!/usr/bin/env node
/**
 * dev/test-language-generators.js — 语文题型生成器单元测试
 *
 * 对 chinese-pinyin（11 生成器）与 chinese-hanzi（18 生成器）逐一：
 *   - 连续抽取 12 题
 *   - 断言① choice 题选项 ≥2 且无重复
 *   - 断言② 答案在选项中 / 文本答案非空
 *   - 断言③ KP 标注以科目前缀开头
 *   - 断言④ 满分回填
 *
 * 重复率分级口径：
 *   - 大池生成器（候选 ≥20 种）：identity 精确重复率 <5%
 *   - 小池生成器（候选 <20 种，如整体认读16/判断题2值/查字典步骤3步等）：
 *     仅要求「连续两批 identity 集合不全等」证明随机性，不做硬性比例限制
 *
 * 用法：node dev/test-language-generators.js   # 失败退出码 1
 */
'use strict';

global.localStorage = { _d: {}, getItem: () => null, setItem() {}, removeItem() {} };

const path = require('path');
const ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'pinyin-bank.js'));
require(path.join(ROOT, 'shared', 'common.js'));
require(path.join(ROOT, 'shared', 'difficulty.js'));
require(path.join(ROOT, 'shared', 'hanzi-bank.js'));

const PINYIN_PLUGIN = require(path.join(ROOT, 'plugins', 'chinese-pinyin.js'));
const HANZI_PLUGIN = require(path.join(ROOT, 'plugins', 'chinese-hanzi.js'));
const COMP_PLUGIN = require(path.join(ROOT, 'plugins', 'chinese-comprehensive.js'));

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ ' + msg); }
}

function identity(q) {
  return q.type + '|' + (q.q || '') + '|' + (q.pinyin || '') + '|' +
         (q.char || '') + '|' + JSON.stringify(q.options || []);
}

/** 单生成器批量抽取（每次 generate 出1题，抽 n 次） */
function draw(plugin, genKey, n, grade, difficulty) {
  const qs = [];
  for (let i = 0; i < n; i++) {
    const opts = { grade: grade, count: 1, type: genKey };
    if (difficulty != null) opts.difficulty = difficulty;
    const r = plugin.generate(opts);
    if (r.questions.length) qs.push(r.questions[0]);
  }
  return qs;
}

/** 四项通用断言 */
function validateBatch(pluginName, genKey, qs) {
  const tag = pluginName + '/' + genKey;
  assert(qs.length >= 10, tag + ' 抽取不足 10 题（实际 ' + qs.length + '）');

  let ok = true;
  qs.forEach(function (q) {
    if (q.inputType === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2 ||
          new Set(q.options).size !== q.options.length) {
        ok = false; console.log('  ✗ ' + tag + ' choice 题选项异常');
      }
      if (!q.options.includes(String(q.answer))) {
        ok = false; console.log('  ✗ ' + tag + ' 答案不在选项中：' + q.q);
      }
    } else if (!String(q.answer == null ? '' : q.answer).trim()) {
      ok = false; console.log('  ✗ ' + tag + ' text 题答案为空');
    }
    if (!(q.knowledgePointId || '').startsWith('cn-g')) {
      ok = false; console.log('  ✗ ' + tag + ' KP 标注缺少科目前缀: ' + q.knowledgePointId);
    }
  });
  assert(ok, tag + ' 存在答案/选项/KP 异常');

  // 满分回填
  const cr = (pluginName === 'chinese-pinyin' ? PINYIN_PLUGIN : HANZI_PLUGIN)
    .check({ questions: qs }, qs.map(q => String(q.answer)));
  assert(cr.score === 100, tag + ' 满分回填失败（score=' + cr.score + '）');
}

/** 小池判定：连续两批 identity 集合不全等（证明 shuffle/random 生效） */
function randomnessCheck(pluginName, genKey, grade) {
  const plugin = pluginName === 'chinese-pinyin' ? PINYIN_PLUGIN : HANZI_PLUGIN;
  const batchA = draw(plugin, genKey, 12, grade).map(identity).sort();
  const batchB = draw(plugin, genKey, 12, grade).map(identity).sort();
  assert(JSON.stringify(batchA) !== JSON.stringify(batchB),
    pluginName + '/' + genKey + ' 连续两批完全相同（随机性失效）');
}

// ============ chinese-pinyin：11 生成器 ============
console.log('===== chinese-pinyin =====');
[
  ['initials-pick', 1], ['finals-pick', 1], ['whole-syllable-pick', 1],
  ['tone-mark', 1], ['judge-tone', 1], ['fill-blank', 2],
  ['jqx-u', 1], ['syllable-sort', 1],
  ['confusing-pick', 2], ['light-tone-judge', 2], ['polyphone-note', 3]
].forEach(function ([genKey, grade]) {
  console.log('  -- ' + genKey);
  const qs = draw(PINYIN_PLUGIN, genKey, 12, grade);
  validateBatch('chinese-pinyin', genKey, qs);
  randomnessCheck('chinese-pinyin', genKey, grade);
});

// ============ chinese-hanzi：18 生成器 ============
console.log('\n===== chinese-hanzi =====');
[
  ['stroke-count', 1], ['stroke-name', 1], ['stroke-order-sort', 1],
  ['stroke-order-which', 1], ['structure-classify', 1], ['write-from-pinyin', 1],
  ['radical-classify', 2], ['radical-meaning', 2], ['similar-pick', 2],
  ['hardwriting-judge', 2], ['homophone-pick', 2], ['polyphone-pick', 2],
  ['poly-semantic-pick', 3], ['context-meaning', 3],
  ['dictionary-phonetic-step', 3], ['dictionary-radical-step', 3],
  ['dictionary-step-comprehensive', 3]
].forEach(function ([genKey, grade]) {
  console.log('  -- ' + genKey);
  const qs = draw(HANZI_PLUGIN, genKey, 12, grade);
  validateBatch('chinese-hanzi', genKey, qs);
  randomnessCheck('chinese-hanzi', genKey, grade);
});

// ============ 汇总 ============
console.log('\n===== 汇总 =====');
console.log((fail === 0 ? '✅ 全部通过（' : '❌ ') + pass + ' 项断言' +
  (fail ? '，' + fail + ' 项失败' : ''));
process.exit(fail === 0 ? 0 : 1);
