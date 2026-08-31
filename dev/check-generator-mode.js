#!/usr/bin/env node
/**
 * dev/check-generator-mode.js — M4-R14 Generator 双轨许可 Gate
 *
 * 验收：
 *   - generatorMode（legacy/hybrid/native）默认 hybrid；
 *   - 四级覆盖（plugin/knowledgePoint/questionType/subject）解析链正确；
 *   - GeneratorSelector 双轨过滤：legacy 只产出旧插件轨道，native 只产出核心轨道（无匹配回退），
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
  assertEq('默认 generatorMode', Mode.getGlobal(), 'hybrid');
  assertEq('默认解析', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'hybrid');
  try { Mode.setGlobal('turbo'); errors.push('非法 mode 未被拦截'); } catch (e) { /* ok */ }
  try { Mode.override('badScope', 'x', 'native'); errors.push('非法 scope 未被拦截'); } catch (e) { /* ok */ }

  // 2) 解析链：plugin > knowledgePoint > questionType > subject > global
  Mode.setGlobal('native');
  Mode.override('subject', 'math', 'legacy');
  Mode.override('questionType', 'calc', 'hybrid');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'native');
  Mode.override('plugin', 'math-oral', 'legacy');
  assertEq('plugin 覆盖优先', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc' }), 'legacy');
  Mode.clearOverride('plugin');
  assertEq('KP 覆盖优先于 questionType', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc' }), 'native');
  assertEq('questionType 覆盖优先于 subject', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc' }), 'hybrid');
  Mode.setGlobal('hybrid');
  assertEq('subject 覆盖优先于 global', Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10' }), 'legacy');

  // 3) 双轨选择
  Mode.clearAll();
  Mode.setGlobal('legacy');
  var l = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assertEq('legacy 模式选中 old track', l.record.scope, 'legacy');

  Mode.setGlobal('native');
  var n = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assertEq('native 模式选中 core track', n.record.scope, 'core');

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

  console.log('M4-R14 Generator 双轨许可 Gate');
  console.log('');
  console.log('默认 mode:     ' + Mode.getGlobal());
  console.log('覆盖层级:      plugin/knowledgePoint/questionType/subject（更具体优先）');
  console.log('双轨选择:      legacy→旧插件 / native→核心(无匹配回退) / hybrid→并轨');
  console.log('Errors: ' + errors.length);
  errors.forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('');
  var ok = errors.length === 0;
  console.log(ok ? '[PASS] M4-R14 Generator 双轨许可 Gate' : '[FAIL] M4-R14 Generator 双轨许可 Gate');
  process.exitCode = ok ? 0 : 1;
}

run();