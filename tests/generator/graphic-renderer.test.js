'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
const GraphicRenderer = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));

test('M4-R11：graphic 合法描述通过契约校验', () => {
  const q = {
    knowledgePointId: 'math-g1-m0-make-ten',
    questionType: 'calc',
    difficulty: 3,
    difficultyParams: { level: 3, scale: 1, steps: 2, allowBracket: false, allowMultDiv: false },
    numberRange: { min: 1, max: 20 },
    spiralLevel: 1,
    context: 'standard',
    prompt: '9 + 5 = ?',
    answer: '14',
    graphic: { type: 'make-ten', subtype: 'cushi', params: { num: 9, add: 5 } }
  };
  assert.strictEqual(Contract.validateSemanticQuestion(q).valid, true);
});

test('M4-R11：graphic 内嵌 SVG 字符串被拒绝', () => {
  const q = {
    knowledgePointId: 'math-g1-m0-make-ten',
    questionType: 'calc',
    difficulty: 3,
    difficultyParams: { level: 3, scale: 1, steps: 2, allowBracket: false, allowMultDiv: false },
    numberRange: { min: 1, max: 20 },
    spiralLevel: 1,
    context: 'standard',
    prompt: '9 + 5 = ?',
    answer: '14',
    graphic: { type: 'make-ten', svg: '<svg><rect/></svg>' }
  };
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('内嵌 SVG')));
});

test('M4-R11：graphic.type 必填', () => {
  const q = {
    knowledgePointId: 'math-g1-m0-make-ten',
    questionType: 'calc',
    difficulty: 3,
    difficultyParams: { level: 3, scale: 1, steps: 2, allowBracket: false, allowMultDiv: false },
    numberRange: { min: 1, max: 20 },
    spiralLevel: 1,
    context: 'standard',
    prompt: '9 + 5 = ?',
    answer: '14',
    graphic: { subtype: 'cushi' }
  };
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('graphic.type')));
});

test('M4-R11：GraphicRenderer 解析 graphic → SVG 渲染器', () => {
  const r = GraphicRenderer.resolveGraphicRenderer({ type: 'geometry', subtype: 'shape', params: { n: 4 } });
  assert.deepStrictEqual(r, { type: 'geometry', subtype: 'shape', params: { n: 4 }, renderer: 'svg-geometry', label: '几何图形' });
  assert.strictEqual(GraphicRenderer.isSupported('make-ten'), true);
  assert.strictEqual(GraphicRenderer.isSupported('unknown-type'), false);
  assert.strictEqual(GraphicRenderer.resolveGraphicRenderer({ type: 'nope' }), null);
});
