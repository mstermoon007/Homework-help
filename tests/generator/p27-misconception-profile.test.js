'use strict';

/**
 * tests/generator/p27-misconception-profile.test.js — P27-10 MisconceptionProfile 易错点 overlay
 *
 * 冻结不变量：
 *   1. overlay SSOT kbl/teaching/misconception-profiles.json：schema 完整，
 *      KP id ⊆ 矩阵 375（独立 overlay，不侵入 kp-matrix.json）。
 *   2. errorType 全集对齐 shared/learner/error-model.js ERROR_TYPES（8 类）；
 *      variant 全集 ⊆ shared/strategy/adaptive-strategy.js VARIANTS（6 变体）；
 *      axis 全集 ⊆ P27-09 变式五轴。
 *   3. slot 纪律：每条 slot 必带非空 basis（KBL 事实/剖面证据引文）、
 *      triggerPattern.questionTypes ⊆ canonical 7 类、evidenceRows ≥ 1
 *      （响应轴无实测承载不产出——不伪造红线）。
 *   4. evidenceRows 可复算：按 variation-profiles.json 重算响应轴证据行数，
 *      与 slot 声明一致（机械派生，非手填）。
 *   5. 回归锚：math-g2-up-u07-k001（7~9乘除法，g2）必有 口诀混淆 slot，
 *      且 triggerPattern 命中 calc×mult。
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ErrorModel = require(path.join(ROOT, 'shared', 'learner', 'error-model.js'));
const Adaptive = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

const overlay = require(path.join(ROOT, 'kbl', 'teaching', 'misconception-profiles.json'));
const matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));
const profile = require(path.join(ROOT, 'kbl', 'teaching', 'variation-profiles.json'));

const ALL_QT = QTR.TYPES.map((t) => t.id);
const AXES = ['unknown', 'numeric', 'context', 'representation', 'structure'];
const matrixIds = new Set(matrix.kps.map((k) => k.id));

let rowsByKp;
before(() => {
  rowsByKp = {};
  profile.rows.forEach((r) => { (rowsByKp[r.knowledgePointId] = rowsByKp[r.knowledgePointId] || []).push(r); });
});

function recountAxisEvidence(kpId, axis) {
  const rows = rowsByKp[kpId] || [];
  let n = 0;
  rows.forEach((r) => {
    if (!r.variation) return;
    const v = r.variation;
    const hit =
      (axis === 'numeric' && v.numeric.varies === true) ||
      (axis === 'context' && v.context.present === true) ||
      (axis === 'representation' && v.representation.present === true) ||
      (axis === 'structure' && v.structure.steps.length >= 1) ||
      (axis === 'unknown' && v.unknown.positions.length > 0);
    if (hit) n++;
  });
  return n;
}

/* ---------------- 1. Schema 与全集对齐 ---------------- */

test('schema 完整：builtFrom 四真值源声明 + counts 覆盖', () => {
  assert.equal(overlay.schemaVersion, 'p27-misconception.1');
  assert.equal(overlay.counts.kps, 375);
  const src = overlay.builtFrom;
  ['errorTypes', 'variants', 'kblFacts', 'axisEvidence'].forEach((k) => {
    assert.equal(typeof src[k], 'string', 'builtFrom.' + k + ' 缺失');
  });
});

test('errorType/variant/axis 全集对齐（全部 slot 逐条校验）', () => {
  Object.keys(overlay.kps).forEach((kpId) => {
    overlay.kps[kpId].slots.forEach((s) => {
      assert.ok(ErrorModel.ERROR_TYPES.indexOf(s.errorType) !== -1, 'errorType 越界: ' + s.errorType);
      assert.ok(Adaptive.VARIANTS.indexOf(s.response.variant) !== -1, 'variant 越界: ' + s.response.variant);
      assert.ok(AXES.indexOf(s.response.axis) !== -1, 'axis 越界: ' + s.response.axis);
    });
  });
});

/* ---------------- 2. overlay 纪律 ---------------- */

test('KP id ⊆ 矩阵 375；不侵入 kp-matrix.json', () => {
  Object.keys(overlay.kps).forEach((kpId) => {
    assert.ok(matrixIds.has(kpId), 'overlay 引入未知 KP: ' + kpId);
  });
  matrix.kps.forEach((k) => {
    assert.deepEqual(k.misconceptionSlots, [], 'kp-matrix misconceptionSlots 必须保持 KBL 原状（overlay 才是 P27-10 SSOT）: ' + k.id);
  });
});

test('slot 纪律：basis 非空 + trigger 合法 + evidenceRows ≥ 1 且可复算', () => {
  let total = 0;
  Object.keys(overlay.kps).forEach((kpId) => {
    overlay.kps[kpId].slots.forEach((s) => {
      total++;
      assert.equal(typeof s.basis, 'string');
      assert.ok(s.basis.length > 0, 'basis 为空（伪造嫌疑）: ' + kpId + '×' + s.errorType);
      assert.ok(Array.isArray(s.triggerPattern.questionTypes));
      s.triggerPattern.questionTypes.forEach((qt) => {
        assert.ok(ALL_QT.indexOf(qt) !== -1, 'trigger questionType 非法: ' + qt);
      });
      assert.ok(s.response.evidenceRows >= 1, 'evidenceRows<1（响应轴无承载不应产出）');
      assert.equal(s.response.evidenceRows, recountAxisEvidence(kpId, s.response.axis),
        'evidenceRows 与剖面复算不一致: ' + kpId + '×' + s.errorType);
      if (s.triggerPattern.operations) {
        s.triggerPattern.operations.forEach((op) => {
          assert.ok(['add', 'sub', 'mult', 'div'].indexOf(op) !== -1, 'trigger operation 非法: ' + op);
        });
      }
    });
  });
  assert.equal(total, overlay.counts.slots);
});

/* ---------------- 3. 回归锚 ---------------- */

test('math-g2-up-u07-k001（7~9乘除法）必有 口诀混淆 slot，trigger 命中 calc×mult', () => {
  const entry = overlay.kps['math-g2-up-u07-k001'];
  assert.ok(entry, '该 KP 应有 overlay 条目');
  const slot = entry.slots.find((s) => s.errorType === '口诀混淆');
  assert.ok(slot, '表内乘除 g2 KP 必有 口诀混淆 slot');
  assert.ok(slot.triggerPattern.questionTypes.indexOf('calc') !== -1);
  assert.ok(slot.triggerPattern.operations.indexOf('mult') !== -1);
  assert.equal(slot.response.variant, '数值');
});
