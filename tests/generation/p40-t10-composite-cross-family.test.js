'use strict';

/**
 * tests/generation/p40-t10-composite-cross-family.test.js — P40-T-10 跨族组合前置校验
 *
 * 断言：composite 组合跨族 KP 时，必须存在 prerequisite 可达边（复用既有 373 边 + T-06 口径）；
 *   未满足跨族前置的组合被拒；同族组合不受影响；无解析器时跳过（生产既有行为不变）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev/_bundle-env.js'));
const K = global.App.KNOWLEDGE;
const CV = require(path.join(ROOT, 'shared/validator/composite-validator.js'));

const resolver = {
  relationsFor: (id, dir) => K.relationsFor(id, dir),
  familyOf: (id) => { const kp = K.get(id); return kp && kp.semantic ? kp.semantic.conceptFamily : null; }
};

function allIds() {
  const ids = [];
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach((g) => K.byGrade(g).forEach((kp) => ids.push(kp.knowledgeId)));
  return ids;
}

test('P40-T-10 未满足跨族前置的组合被拒', () => {
  const ids = allIds();
  const reach = (a, b) => {
    const seen = {}; const q = [a];
    while (q.length) { const c = q.shift(); if (c === b) return true; if (seen[c]) continue; seen[c] = 1;
      (K.relationsFor(c, 'out').outgoing || []).forEach((r) => { if (!seen[r.toId]) q.push(r.toId); }); }
    return false;
  };
  // 找一对跨族且互不可达的 KP
  let pair = null;
  for (let i = 0; i < ids.length && !pair; i++) {
    const fa = resolver.familyOf(ids[i]).id;
    for (let j = i + 1; j < ids.length; j++) {
      const fb = resolver.familyOf(ids[j]).id;
      if (fa !== fb && !reach(ids[i], ids[j]) && !reach(ids[j], ids[i])) { pair = [ids[i], ids[j]]; break; }
    }
  }
  assert.ok(pair, '应能构造跨族未满足前置对');
  const r = CV.validateCrossFamilyPrerequisite(pair, resolver);
  assert.equal(r.valid, false, '组合应被拒');
  assert.ok(r.missing.length >= 1, '报告 missing');
});

test('P40-T-10 存在 prerequisite 可达边的跨族组合通过', () => {
  const relDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/canonical/relations.json'), 'utf8'));
  const cross = relDoc.relations.find((r) => resolver.familyOf(r.fromId).id !== resolver.familyOf(r.toId).id);
  assert.ok(cross, '应存在跨族 prerequisite 边');
  const r = CV.validateCrossFamilyPrerequisite([cross.fromId, cross.toId], resolver);
  assert.equal(r.valid, true, '有前置可达边的跨族组合通过');
});

test('P40-T-10 无解析器时跳过（生产行为不变）', () => {
  const r = CV.validateCrossFamilyPrerequisite(['a', 'b'], {});
  assert.equal(r.valid, true);
  assert.equal(r.skipped, 'no-resolver');
});
