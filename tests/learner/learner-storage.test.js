'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');

const LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
const PracticeResult = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));

const LS_PATH = path.join(ROOT, 'shared', 'learner', 'learner-storage.js');
function freshLS() {
  delete require.cache[require.resolve(LS_PATH)];
  return require(LS_PATH);
}

// 内存假 StorageManager：配置顶层 usedKey 模拟旧的 difficultyState 并存
function makeFake() {
  let backing = null;
  return {
    isAvailable() { return true; },
    load() { return backing || {}; },
    save(partial) {
      backing = Object.assign({}, backing, partial);
      // 旧全局状态（difficultyState 等）必须保留 → 合并式 save 契约
      if (!backing.difficultyState) backing.difficultyState = { 'p1': { emaRate: 0.9 } };
    },
    _state() { return backing; }
  };
}

test('M6-R03 读写 LearnerModel 状态（含保留旧全局状态）', () => {
  global.StorageManager = makeFake();
  const LearnerStorage = freshLS();

  assert.strictEqual(Object.keys(LearnerStorage.load().knowledgePoints).length, 0);

  let state = LearnerModel.update(null, PracticeResult.create({
    questionId: 'q1', knowledgePointId: 'KP-加法', correct: true,
    questionDifficulty: 3, questionType: 'calc'
  }), { now: 1000 });
  LearnerStorage.save(state);

  // 新会话读取
  const kp = LearnerStorage.getKnowledgePoint('KP-加法');
  assert.strictEqual(kp.mastery, 0.3);
  assert.strictEqual(kp.attempts, 1);

  // 旧全局难度状态未被覆盖
  assert.strictEqual(LearnerStorage.load().difficultyState, undefined, 'learnerState 独立存储于 difficultyState 之外');

  LearnerStorage.updateKnowledgePoint('KP-加法', { attempts: 5, correct: 4, mastery: 0.5 });
  assert.strictEqual(LearnerStorage.getKnowledgePoint('KP-加法').attempts, 5);

  delete global.StorageManager;
});

test('M6-R03 数据损坏 → 自动恢复默认状态（不崩溃）', () => {
  const fake = makeFake();
  fake.save({ learnerState: { knowledgePoints: 'garbage', updatedAt: 'x' } });
  global.StorageManager = fake;
  const LearnerStorage = freshLS();
  const state = LearnerStorage.load();
  assert.deepEqual(state.knowledgePoints, {});
  assert.strictEqual(typeof state, 'object');
  assert.strictEqual(Object.keys(state.knowledgePoints).length, 0);
  delete global.StorageManager;
});

test('M6-R03 Storage 不可用 → 内存降级模式', () => {
  delete global.StorageManager; // 真实 storage.js 在无 localStorage 的 Node 中 isAvailable()=false
  const LearnerStorage = freshLS();
  assert.strictEqual(LearnerStorage.storageAvailable(), false);
  let s = LearnerModel.update(null, PracticeResult.create({
    questionId: 'q', knowledgePointId: 'KP-内存', correct: true
  }));
  LearnerStorage.save(s);
  assert.strictEqual(LearnerStorage.getKnowledgePoint('KP-内存').mastery, 0.3, '内存模式仍可读写');
  delete global.StorageManager;
});

test('M6-R03 clear 清空学习者数据', () => {
  global.StorageManager = makeFake();
  const LearnerStorage = freshLS();
  LearnerStorage.save(LearnerModel.update(null, PracticeResult.create({
    questionId: 'q', knowledgePointId: 'KP-清空', correct: true
  })));
  assert.strictEqual(LearnerStorage.getKnowledgePoint('KP-清空', false).attempts, 1);
  const cleared = LearnerStorage.clear();
  assert.strictEqual(Object.keys(cleared.knowledgePoints).length, 0);
  assert.strictEqual(LearnerStorage.getKnowledgePoint('KP-清空', false), null);
  delete global.StorageManager;
});