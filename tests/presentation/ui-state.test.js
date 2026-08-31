'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

test('UIState.generationHtml 提供四种生成状态（P3-R03）', () => {
  const { UIState } = require(path.join(ROOT, 'shared', 'ui-state.js'));

  // 待生成
  const idle = UIState.generationHtml.idle();
  assert.match(idle, /generation-state idle/);
  assert.match(idle, /准备就绪/);

  // 生成中
  const loading = UIState.generationHtml.loading('正在生成');
  assert.match(loading, /generation-state loading/);
  assert.match(loading, /生成中/);
  assert.match(loading, /正在生成/);

  // 生成完成
  const success = UIState.generationHtml.success(12);
  assert.match(success, /generation-state success/);
  assert.match(success, /生成完成/);
  assert.match(success, /共 12 题/);

  // 生成失败
  const error = UIState.generationHtml.error('超时');
  assert.match(error, /generation-state error/);
  assert.match(error, /生成失败/);
  assert.match(error, /超时/);
});

test('UIState.generationHtml 转义不可信输入', () => {
  const { UIState } = require(path.join(ROOT, 'shared', 'ui-state.js'));
  const error = UIState.generationHtml.error('<script>alert(1)</script>');
  assert.doesNotMatch(error, /<script>alert\(1\)<\/script>/);
  assert.match(error, /&lt;script&gt;/);
});

test('UIState.generationHtml 兼容失败态重试操作 HTML', () => {
  const { UIState } = require(path.join(ROOT, 'shared', 'ui-state.js'));
  const error = UIState.generationHtml.error('x', '<button>重试</button>');
  assert.match(error, /gs-actions/);
  assert.match(error, /重试/);
});
