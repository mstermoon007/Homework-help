const test = require('node:test');
const assert = require('node:assert');
const KnowledgeBank = require('../../shared/knowledge-bank.js');
const Ontology = require('../../shared/knowledge-ontology.js');
const Schema = require('../../shared/schemas/knowledge-point.schema.js');

test('574 KP 全部能归一化为合法 Canonical（ERROR=0）', () => {
  let errCount = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          const c = Ontology.normalize(kp);
          const v = Ontology.validate(c);
          if (!v.valid) errCount++;
        });
      });
    });
  });
  assert.strictEqual(errCount, 0, '存在非法 Canonical KP');
});

test('KB Contract 基本完整性：574 + 分科正确', () => {
  const math = KnowledgeBank.math.reduce((n, g) => n + g.modules.reduce((m, mm) => m + mm.knowledgePoints.length, 0), 0);
  const cn = KnowledgeBank.cn.reduce((n, g) => n + g.modules.reduce((m, mm) => m + mm.knowledgePoints.length, 0), 0);
  const en = KnowledgeBank.en.reduce((n, g) => n + g.modules.reduce((m, mm) => m + mm.knowledgePoints.length, 0), 0);
  assert.strictEqual(math + cn + en, 574);
  assert.strictEqual(math, 556);
  assert.strictEqual(cn, 15);
  assert.strictEqual(en, 3);
});

test('未知 questionType 不升级为 ERROR（仅 WARNING）', () => {
  const c = Ontology.create({
    id: 'x', subject: 'math', grade: 1,
    identity: { id: 'x', name: 'X', description: '' },
    spiral: { level: 1, maxLevel: 1 },
    cognition: { level: 0, targets: [], raw: null },
    structure: { minSteps: 1, maxSteps: 1, allowBracket: false, allowMultDiv: false },
    presentation: { questionTypes: [{ type: 'pingshi' }], graphicType: null },
    numeric: { range: { min: null, max: null }, integerOnly: true, decimalPlaces: 0 },
    context: { defaults: [], allowPure: true, allowContextual: true }
  });
  const v = Ontology.validate(c);
  assert.strictEqual(v.valid, true);
  assert.ok(v.warnings.some((w) => /questionType/.test(w)));
});

test('格式非法才为 ERROR（numberRange.min>max）', () => {
  const c = Ontology.create({ id: 'x', subject: 'math', grade: 1, numeric: { range: { min: 10, max: 1 } } });
  const v = Ontology.validate(c);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some((e) => /numberRange/.test(e)));
});

test('knowledge-bank.js 查询方法行为不变', () => {
  assert.strictEqual(typeof KnowledgeBank.findGrade, 'function');
  assert.strictEqual(typeof KnowledgeBank.getEntries, 'function');
  assert.strictEqual(typeof KnowledgeBank.getCoverage, 'function');
  assert.strictEqual(typeof KnowledgeBank.coverageFromRegistry, 'function');
  assert.strictEqual(typeof KnowledgeBank.ensureKnowledgeData, 'function');
});

test('Canonical 不引入 generateFunction（铁律）', () => {
  const c = Ontology.normalize({ id: 'x', name: 'X' });
  assert.strictEqual(c.generateFunction, undefined);
});
