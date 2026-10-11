// P37-02（F-TYPE-2 Frozen 归一化表修复）定向测试。
// 授权依据：docs/archive/phases/human-data-requests/README.md §H4（用户签批「授权 Frozen 修复」）。
// 修复点：
//   ① RECOGNIZE_KEYWORDS 认读子串启发式删除——不再将宽泛子串误归 geometry；
//   ② factor-multiple/factor/all → geometry 错别名物理删除；
//   ③ capability-model type 权威——rawType 全链已于 P39-01 清零（消费链 + 数据字段）；
//   ④ winning 死别名键物理删除（P36-03 已删 reasoning.js sudoku/winning 生成分支，
//      kbl/ 与运行时 375 KP 数据零命中，三方印证后删除）。
// 取证事实（2026-10-12）：canonical 375 KP 与运行时数据全为规范 7 类值，三修复点
// 在当前数据上零命中——本测试为防御性断言（防双轨回归），修复不改变现网行为。
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const CapabilityModel = require(path.join(ROOT, 'shared', 'capability', 'capability-model.js'));

// F-TYPE-2 请求单中的错别名 token（f-type-2-affected-kps.csv 旧口径取证）
const F_TYPE_TOKENS = ['factor-multiple', 'factor', 'all', 'winning'];
// RECOGNIZE_KEYWORDS 中无显式别名的纯启发式 token（修复前经子串误归 geometry）。
// 注意：pattern/tally 等同时是显式别名键（canonical 裁决，不在授权范围），见边界测试。
const RECOGNIZE_TOKENS = ['meaning', 'recall'];

test('P37-02 ①②④ F-TYPE 错别名与认读启发式已删除：严格模式不再映射 geometry', () => {
  for (const t of [...F_TYPE_TOKENS, ...RECOGNIZE_TOKENS]) {
    const r = QTR.normalizeQuestionType(t, { allowHeuristic: false });
    assert.notEqual(r.id, 'geometry', t + ' 不得再映射 geometry');
    assert.equal(r.id, null, t + ' 严格模式 unmapped（got ' + JSON.stringify(r.id) + '）');
  }
});

test('P37-02 ①②④ 未命中 token 落通用兜底：默认模式 calc，且不产生 geometry', () => {
  for (const t of [...F_TYPE_TOKENS, ...RECOGNIZE_TOKENS]) {
    const r = QTR.normalizeQuestionType(t);
    assert.notEqual(r.id, 'geometry', t + ' 默认模式也不得映射 geometry');
    assert.equal(r.id, 'calc', t + ' 默认模式走通用启发式兜底 calc');
  }
});

test('P37-02 最小修改边界：RECOGNIZE 类显式别名键保持不动（canonical 裁决不翻案）', () => {
  // pattern/tally/enum/digit/parity/divisible 等同时是显式别名键（confidence=explicit），
  // 授权范围仅为子串启发式与 factor 族错别名，显式别名保持原样（零连带）。
  for (const t of ['pattern', 'tally', 'enum', 'digit', 'parity', 'divisible']) {
    const r = QTR.normalizeQuestionType(t, { allowHeuristic: false });
    assert.equal(r.id, 'geometry', t + ' 显式别名保持 geometry');
    assert.equal(r.confidence, 'explicit', t + ' 走显式别名而非启发式');
  }
});

test('P37-02 显式 canonical 别名不受影响：oral→calc / recognize→geometry 保持', () => {
  assert.equal(QTR.normalizeQuestionType('oral', { allowHeuristic: false }).id, 'calc');
  assert.equal(QTR.normalizeQuestionType('recognize', { allowHeuristic: false }).id, 'geometry');
  assert.equal(QTR.normalizeQuestionType('open', { allowHeuristic: false }).id, 'apply');
});

test('P39-01 ③ rawType 全链清零：capability 解析只认 type，rawType 不参与（含兜底移除负断言）', () => {
  // 合成 KP：type=calc（唯一权威），rawType=factor-multiple（历史污染值——rawType 恒被忽略）
  const kp = {
    id: 'synthetic-p37-02',
    presentation: { questionTypes: [{ type: 'calc', rawType: 'factor-multiple' }] },
    generation: { capabilities: [] }
  };
  const cap = CapabilityModel.resolveCapability(kp);
  assert.equal(cap.questionTypes.length, 1, '合成 KP 只推导出 1 个题型');
  assert.equal(cap.questionTypes[0].id, 'calc', 'capability 只取 type');
});

test('P39-01 ③ rawType 全链清零：type 缺失时 rawType 不兜底（1570 行取证 rawType 恒 null，兜底语义已删）', () => {
  const kp = {
    id: 'synthetic-p39-01',
    presentation: { questionTypes: [{ rawType: 'fill' }] },
    generation: { capabilities: [] }
  };
  const cap = CapabilityModel.resolveCapability(kp);
  assert.equal(cap.questionTypes.length, 0, 'rawType 不再兜底：无 type 则不产出题型');
});

test('P39-01 防双轨回归：rawType 消费链不得复活', () => {
  // 物理删除断言（P30 死代码规则，不留壳）：rawType 在生产链零消费零产出
  // （断言匹配代码模式 .rawType 属性访问 / rawType: 键字面量；注释留档不受限）
  const fs = require('fs');
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const hasCodeRef = (s) => /\.rawType\b/.test(s) || /\brawType\s*:/.test(s);
  assert.equal(hasCodeRef(src('shared/capability/capability-model.js')), false,
    'capability-model 不得引用 rawType');
  assert.equal(hasCodeRef(src('shared/strategy/question-type-strategy.js')), false,
    'question-type-strategy 不得读取 rawType');
  assert.equal(hasCodeRef(src('shared/strategy/static-difficulty.js')), false,
    'static-difficulty 不得读取 rawType');
  assert.equal(hasCodeRef(src('shared/orchestration/knowledge-context.js')), false,
    'knowledge-context 不得输出 rawType 字段');
  assert.equal(hasCodeRef(src('tools/kbl/emit-canonical.js')), false,
    'emit-canonical 不得再派生 rawType 数据字段');
});

test('P37-02 防双轨回归：RECOGNIZE_KEYWORDS 常量不得复活', () => {
  // 物理删除断言（P30 死代码规则，不留壳）：源码中不得再出现认读启发式表声明与错别名键
  const fs = require('fs');
  const src = fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'), 'utf8');
  assert.equal(/var\s+RECOGNIZE_KEYWORDS/.test(src), false, 'RECOGNIZE_KEYWORDS 声明不得复活');
  assert.equal(/RECOGNIZE_KEYWORDS\[i\]/.test(src), false, 'RECOGNIZE_KEYWORDS 消费循环不得复活');
  assert.equal(src.includes("'factor-multiple': 'geometry'"), false, 'factor-multiple 错别名不得复活');
  assert.equal(/(^|[^-\w])all:\s*'geometry'/.test(src), false, 'all 错别名不得复活');
  assert.equal(/(^|[^-\w])factor:\s*'geometry'/.test(src), false, 'factor 错别名不得复活');
  assert.equal(/(^|[^-\w])winning:\s*'apply'/.test(src), false, 'winning 死键不得复活');
});
