'use strict';

/**
 * tests/presentation/practice-page-contract.test.js
 *
 * 练习页 practice.html 三模式契约（P46-07）。
 * 沿用 select-page-contract 的方式：读取真实源文件做结构与语义断言；
 * 共享层 `capabilityPlanView` 则直接 require 真实实现做行为断言。
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'practice.html');
const html = fs.readFileSync(PAGE, 'utf8');
const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
  .map(function (m) { return m[1]; });
const js = scripts.join('\n');

describe('P46-07：练习页试卷参数归一', () => {
  test('parseUrlParams 识别 examType 白名单并锁定 40 题', () => {
    assert.match(js, /var examType = \(p\.get\('examType'\) \|\| ''\)\.trim\(\) \|\| null;/);
    assert.match(js, /\['unit', 'midterm', 'final'\]\.indexOf\(examType\) === -1/);
    assert.match(js, /if \(examType\) count = 40;/);
    assert.match(js, /examType: examType,/);
  });

  test('state 增加 examType，boot 时赋值', () => {
    assert.match(js, /examType: null\s+\/\/ P46-07/);
    assert.match(js, /state\.examType = urlParams\.examType;/);
  });

  test('isExamMode 由 examType 派生', () => {
    assert.match(js, /var isExamMode = !!urlParams\.examType;/);
  });

  test('试卷模式不恢复上次练习的题量设置', () => {
    assert.match(js, /if \(!isExamMode && savedState\.lastPractice\)/);
  });
});

describe('P46-07：题量只读矩阵与难度保留', () => {
  test('setCount 在试卷模式直接返回', () => {
    const start = js.indexOf('function setCount(n)');
    const block = js.slice(start, js.indexOf('function syncCountUI', start));
    assert.match(block, /if \(isExamMode\) return;/);
  });

  test('syncCountUI 试卷模式只读并提示固定 40', () => {
    const start = js.indexOf('function syncCountUI');
    const block = js.slice(start, js.indexOf('function updateCountTip', start));
    assert.match(block, /customInp\.readOnly = isExamMode;/);
    assert.match(block, /'试卷固定 40' : '1~50'/);
    assert.match(block, /aria-readonly/);
  });

  test('难度控件不受试卷模式限制（保留可编辑）', () => {
    assert.doesNotMatch(js, /difficulty[^\n]*readOnly\s*=\s*isExamMode/);
  });
});

describe('P46-07：标题语义（屏幕与打印同源）', () => {
  test('试卷标题映射 unit/midterm/final', () => {
    assert.match(js, /var EXAM_TITLE = \{ unit: '单元测试', midterm: '期中测试', final: '期末测试' \};/);
    assert.match(js, /if \(isExamMode\) return EXAM_TITLE\[urlParams\.examType\] \|\| '测试卷';/);
  });

  test('家庭标题按大类与专项命名', () => {
    assert.match(js, /if \(urlParams\.practiceKind === 'apply'\) return '应用题练习';/);
    assert.match(js, /FOCUS_TITLE\[urlParams\.practiceFocus\]/);
    assert.match(js, /var FOCUS_TITLE = \{/);
  });

  test('屏幕标题与打印标题共用 buildTitle', () => {
    assert.match(js, /\$\('sheetTitle'\)\.textContent = buildTitle\(/);
    // 打印走 WYSIWYG 克隆：同一 #sheetTitle 即打印标题来源
    assert.match(js, /\$\('printBtn'\)\.addEventListener\('click', printFile\)/);
  });
});

describe('P46-07：计划预览与异步签名', () => {
  test('预览 sig 含难度与试卷类型（难度变化触发重算）', () => {
    assert.match(js, /\(Number\(state\.difficulty\) \|\| 1\) \+ '\|' \+ \(state\.examType \|\| ''\) \+ '\|'/);
  });

  test('capabilityPlanView 透传 examType', () => {
    assert.match(js, /examType: state\.examType \|\| null/);
  });

  test('试卷分题型输入只读且不回写显式 typeCounts', () => {
    assert.match(js, /\(isExamMode \? 'readonly aria-readonly="true" ' : ''\)/);
    const start = js.indexOf('var onCommit = function (e) {');
    assert.match(js.slice(start, start + 400), /if \(isExamMode\) \{ renderKpRatio\(\); return; \}/);
  });

  test('试卷展示 POL 容量重分配明细', () => {
    assert.match(js, /isExamMode && view && view\.ready && view\.quotaAdjustments/);
    assert.match(js, /'<span class="nm">容量重分配<\/span>/);
  });

  test('会话创建透传 examType', () => {
    assert.match(js, /examType: urlParams\.examType,/);
  });
});

describe('P46-07：共享层预览契约', () => {
  const CU = require('../../shared/catalog/catalog-utils.js');
  const KC = require('../../shared/orchestration/knowledge-context.js');
  // capabilityPlanView 从全局解析 POL（浏览器由 bundle 暴露）；node 侧注入同一实现
  global.PracticeOrchestrator = global.PracticeOrchestrator
    || require('../../shared/orchestration/practice-orchestrator.js');

  function pool(grade, n) {
    return KC.uiListForGrade('math', grade).slice(0, n || 40).map(function (k) { return k.id; });
  }

  test('capabilityPlanView 透传 examType 并返回 quotaAdjustments', async () => {
    const v = await CU.capabilityPlanView({
      subject: 'math', grade: 1, knowledgePointIds: pool(1, 40),
      questionTypes: ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'],
      count: 40, examType: 'unit'
    });
    assert.strictEqual(v.ready, true);
    assert.strictEqual(v.examType, 'unit');
    assert.strictEqual(v.requestedCount, 40);
    assert.ok(Array.isArray(v.quotaAdjustments), 'quotaAdjustments 必须为数组');
    assert.strictEqual(v.targetTotal, 40);
  });

  test('URL count=1 与 count=50 在试卷模式下均规划 40', async () => {
    for (const c of [1, 50]) {
      const v = await CU.capabilityPlanView({
        subject: 'math', grade: 1, knowledgePointIds: pool(1, 40),
        questionTypes: ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'],
        count: c, examType: 'final'
      });
      assert.strictEqual(v.ready, true);
      assert.strictEqual(v.requestedCount, 40, 'count=' + c + ' 的试卷请求应归一为 40');
      assert.strictEqual(v.examType, 'final');
    }
  });

  test('非试卷模式不返回 examType 且保持请求题量', async () => {
    const v = await CU.capabilityPlanView({
      subject: 'math', grade: 1, knowledgePointIds: pool(1, 20),
      questionTypes: ['calc'], count: 12
    });
    assert.strictEqual(v.ready, true);
    assert.strictEqual(v.examType, null);
    assert.strictEqual(v.requestedCount, 12);
  });
});
