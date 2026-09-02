#!/usr/bin/env node
/**
 * dev/check-generator-mode.js — M4-R14 Generator 双轨许可 Gate (P2 Task 2.1 简化)
 *
 * 验收：
 *   - generatorMode（hybrid/native）默认 native；
 *   - 两级覆盖（global/knowledgePoint）解析链正确；
 *   - GeneratorSelector 双轨过滤：native 只产出核心轨道（无匹配回退），
 *     hybrid 双轨并轨按优先级选优；选择结果携带 mode；
 *   - instantiate 可实例化 core 生成器。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));

var errors = [];

function assertEq(label, actual, expected) {
  if (actual !== expected) errors.push(label + ': 期望 ' + expected + '，实际 ' + actual);
}

function run() {
  // 1) 默认值与合法性
  Mode.clearAll();
  assertEq('默认 generatorMode', Mode.getGlobal(), 'native');
  assertEq('默认解析', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'native');
  try { Mode.setGlobal('turbo'); errors.push('非法 mode 未被拦截'); } catch (e) { /* ok */ }
  try { Mode.override('badScope', 'x', 'native'); errors.push('非法 scope 未被拦截'); } catch (e) { /* ok */ }
  try { Mode.override('plugin', 'x', 'native'); errors.push('已移除 plugin scope 未拦截'); } catch (e) { /* ok */ }

  // 2) 解析链：knowledgePoint > global
  Mode.setGlobal('hybrid');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'native');
  assertEq('KP 覆盖优先', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'native');
  Mode.clearOverride('knowledgePoint');
  assertEq('无 KP 覆盖 → global', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10' }), 'hybrid');

  // 3) 双轨选择
  Mode.clearAll();
  Mode.setGlobal('native');
  var n = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assertEq('native 模式选中 core track', n.record && n.record.scope, 'core');

  var f = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assertEq('native 无候选回退 legacy', f.source, 'fallback:legacy');

  Mode.setGlobal('hybrid');
  var h = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, difficulty: 3 }).plans[0].generator;
  assertEq('hybrid 并轨选择（KP 绑定优先）', h.generatorId, 'legacy:math-make-ten');
  assertEq('选择结果携带 mode', h.mode, 'hybrid');

  // 4) instantiate
  var inst = Selector.instantiate(n);
  var qs = inst.generate({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3, count: 2 }, { seed: 'gate' });
  assertEq('instantiate 生成题量', qs.length, 2);

  console.log('M4-R14 Generator 双轨许可 Gate (P2 简化)');
  console.log('');
  console.log('默认 mode:     ' + Mode.getGlobal());
  console.log('覆盖层级:      knowledgePoint > global（仅两级）');
  console.log('双轨选择:      native→核心(无匹配回退) / hybrid→并轨');
  console.log('Errors: ' + errors.length);
  errors.forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('');
  var ok = errors.length === 0;
  console.log(ok ? '[PASS] M4-R14 Generator 双轨许可 Gate' : '[FAIL] M4-R14 Generator 双轨许可 Gate');
  process.exitCode = ok ? 0 : 1;
}

run();