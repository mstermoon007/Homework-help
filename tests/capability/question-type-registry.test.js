'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const QR = require(path.join(ROOT, 'shared', 'question-type-registry.js'));

test('题型 ID 唯一', () => {
  const ids = QR.all().map(t => t.id);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size, '存在重复题型 ID');
});

test('所有题型拥有有效 name', () => {
  QR.all().forEach(t => assert.ok(t.name, '题型 ' + t.id + ' 缺少 name'));
});

test('所有题型拥有有效 category', () => {
  QR.all().forEach(t => assert.ok(t.category, '题型 ' + t.id + ' 缺少 category'));
});

test('cognitiveLevels 中的每项都在 COGNITIVE_LEVELS 中', () => {
  QR.all().forEach(t => t.cognitiveLevels.forEach(c => {
    assert.ok(QR.COGNITIVE_LEVELS.includes(c), '非法 cognitiveLevel: ' + c);
  }));
});

test('difficultyRange 格式正确', () => {
  QR.all().forEach(t => {
    assert.ok(Array.isArray(t.difficultyRange) && t.difficultyRange.length === 2,
      'difficultyRange 格式错误: ' + t.id);
    assert.ok(t.difficultyRange[0] >= 1 && t.difficultyRange[1] <= 6,
      'difficultyRange 越界: ' + t.id);
    assert.ok(t.difficultyRange[0] <= t.difficultyRange[1], 'difficultyRange min > max: ' + t.id);
  });
});

test('supports 对象结构正确', () => {
  QR.all().forEach(t => {
    assert.ok(t.supports && typeof t.supports === 'object', 'supports 非法: ' + t.id);
    ['context', 'graphic', 'distractors'].forEach(k => {
      assert.ok(typeof t.supports[k] === 'boolean', 'supports.' + k + ' 必须为布尔: ' + t.id);
    });
  });
});

test('normalizeQuestionType 结果符合预期', () => {
  assert.strictEqual(QR.normalizeQuestionType('oral').id, 'oral');
  assert.strictEqual(QR.normalizeQuestionType('calc').id, 'calc');
  assert.strictEqual(QR.normalizeQuestionType('angle').id, 'geometry');
  assert.strictEqual(QR.normalizeQuestionType('read').id, 'recognize');
  assert.strictEqual(QR.normalizeQuestionType('absolutely_unknown').id, 'calc');
});
