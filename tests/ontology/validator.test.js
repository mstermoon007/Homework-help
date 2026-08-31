const test = require('node:test');
const assert = require('node:assert');
const O = require('../../shared/knowledge-ontology.js');

test('valid canonical', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, identity: { name: 'X' } });
  const v = O.validate(c);
  assert.strictEqual(v.valid, true);
  assert.deepStrictEqual(v.errors, []);
});

test('missing id', () => {
  const c = O.create({ subject: 'math', grade: 2 });
  const v = O.validate(c);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.includes('id 缺失'));
});

test('invalid grade', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 99 });
  const v = O.validate(c);
  assert.ok(v.errors.includes('grade 非法'));
});

test('invalid spiral', () => {
  let v = O.validate(O.create({ id: 'x', subject: 'math', grade: 2, spiral: { level: 0, maxLevel: 1 } }));
  assert.ok(v.errors.includes('spiral.level 非法'));
  v = O.validate(O.create({ id: 'x', subject: 'math', grade: 2, spiral: { level: 3, maxLevel: 1 } }));
  assert.ok(v.errors.includes('spiral.maxLevel < spiral.level'));
});

test('invalid range', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, numeric: { range: { min: 10, max: 5 } } });
  const v = O.validate(c);
  assert.ok(v.errors.includes('numberRange min > max'));
});

test('invalid question type (非数组)', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, presentation: { questionTypes: 'nope' } });
  const v = O.validate(c);
  assert.ok(v.errors.includes('questionTypes 非数组'));
});

test('invalid steps', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, structure: { minSteps: 3, maxSteps: 1 } });
  const v = O.validate(c);
  assert.ok(v.errors.includes('structure.maxSteps < minSteps'));
});

test('valid 但带 WARNING（operations 为空）', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, identity: { name: 'X' } });
  const v = O.validate(c);
  assert.strictEqual(v.valid, true);
  assert.ok(v.warnings.includes('operations 为空'));
});
