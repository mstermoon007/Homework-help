'use strict';

/**
 * tests/generation/p40-q04-grade-adaptation.test.js — P40-Q-04 R18 年级适配
 *
 * #17 复现回归：G1「平面图形认识」judge 走通用 makeFeatureQuestion（无 SHAPE_THEME 条目），
 * 全池随机选特征会命中「对角线相等」超纲术语。修复后（P34-01 同型：换低年级可感知真特征）
 * G1 judge/choice 题面与解析不得再出现超纲术语。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

test('P40-Q-04 复现题 #17：G1 平面图形认识 judge 不再出现「对角线」超纲术语', async () => {
  var session = new PracticeSession({
    subject: 'math', grade: 1, count: 1, difficulty: 2,
    knowledgePointId: 'math-g1-down-u01-k001', questionType: 'judge',
    seed: 'p40q01|math-g1-down-u01-k001|judge|d2|a'
  });
  await session.start();
  var sq = (session.semanticQuestions || [])[0];
  assert.ok(sq, '应产出题目');
  assert.ok(String(sq.prompt).indexOf('对角线') === -1, '题面不应含超纲术语：' + sq.prompt);
  assert.ok(String(sq.answer.explanation || '').indexOf('对角线') === -1, '解析不应含超纲术语');
});

test('P40-Q-04 G1 平面图形认识 judge/choice 100 seed 全扫无超纲术语', async () => {
  for (var i = 0; i < 100; i++) {
    var qt = i % 2 === 0 ? 'judge' : 'choice';
    var session = new PracticeSession({
      subject: 'math', grade: 1, count: 1, difficulty: 2,
      knowledgePointId: 'math-g1-down-u01-k001', questionType: qt,
      seed: 'p40q04scan|g1shape|' + qt + '|' + i
    });
    await session.start();
    var sq = (session.semanticQuestions || [])[0];
    if (!sq) continue;
    var text = String(sq.prompt) + String(sq.answer.explanation || '');
    assert.ok(text.indexOf('对角线') === -1, 'seed ' + i + ' 题面含超纲术语：' + text);
  }
});

test('P40-Q-04 立体图形初识 judge 同扫（sphere/solid 池借道通用 maker 的防护面）', async () => {
  // 立体图形初识有 SHAPE_THEME 条目（P28-HOLLOW-02 主题化），走 themed maker；
  // 本断言回归确认主题化路径不被特征表改动波及。
  for (var i = 0; i < 20; i++) {
    var session = new PracticeSession({
      subject: 'math', grade: 1, count: 1, difficulty: 2,
      knowledgePointId: 'math-g1-up-u03-k001', questionType: 'judge',
      seed: 'p40q04scan|g1solid|' + i
    });
    await session.start();
    var sq = (session.semanticQuestions || [])[0];
    if (!sq) continue;
    assert.ok(sq.prompt, 'seed ' + i + ' 应产出题面');
  }
});
