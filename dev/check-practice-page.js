#!/usr/bin/env node
/**
 * dev/check-practice-page.js — P3-R04 Practice 页面职责 Gate
 *
 * practice.html 仅保留：
 *   UI State → Request → Engine → Render → Answer → Result
 *
 * 断言（页面内不得出现）：
 *   [A] 无 Strategy 判断：StrategyEngine.plan( / StrategyConfig / tryGenerateViaStrategy
 *   [B] 无 Generator 判断：GeneratorRegistry / generator-selector / GeneratorSelector
 *   [C] 无 Plugin 调用：plugin.generate( / plugin.render( / state.plugin / PluginLoader.loadPlugin
 *   [D] 无 Legacy 判断：StrategyLegacyAdapter / generateLegacy / renderLegacySet( / tryGenerateViaPresentation
 *   [E] 无难度计算：App.diffLevel / state.hasLevelSetting / adaptiveDelta 计算
 *   [F] 无 SVG 判断：svg-registry 直接调用 / SVGUtil 页面级调用 / state.presentationHtml
 *
 * 保留：
 *   - PracticeBridge.start()（关联层唯一生成入口，内部经 PracticeSession → GenerationEngine.generate）
 *   - PluginUtil.computeResult（批改判定，无 Plugin 依赖）
 *   - UIState.generationHtml（P3-R03 生成状态）
 *
 * 退出码：0 = PASS；1 = FAIL。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var htmlPath = path.join(ROOT, 'practice.html');
var src = fs.readFileSync(htmlPath, 'utf8');

function stripComments(s) {
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/^\s*\/\/.*$/gm, '');
  return s;
}
var code = stripComments(src);

var pass = [];
var fail = [];
function add(name, ok, extra) {
  if (ok) pass.push(name); else fail.push(name + (extra ? ' — ' + extra : ''));
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? (' (' + extra + ')') : ''));
}

// [A] Strategy
add('无 Strategy 判断', !/StrategyEngine\.plan\s*\(|StrategyConfig\.|tryGenerateViaStrategy|strategy-v1/.test(code));

// [B] Generator
add('无 Generator 判断', !/GeneratorRegistry\.|generator-selector\.|GeneratorSelector\./.test(code));

// [C] Plugin 调用
// 只禁止插件【生成/渲染】直连；window.PLUGIN_REGISTRY 仅作 URL plugin= 路由的索引读取（非出题），合法保留。
add('无 Plugin 调用', !/state\.plugin\b|plugin\.generate\s*\(|plugin\.render\s*\(|PluginLoader\.loadPlugin/.test(code));

// [D] Legacy 判断
add('无 Legacy 判断', !/StrategyLegacyAdapter|GenerationEngine\.generateLegacy\s*\(|renderLegacySet\s*\(|tryGenerateViaPresentation/.test(code));

// [E] 难度计算
add('无难度计算', !/App\.diffLevel|hasLevelSetting|adaptiveDelta|declaredKnowledgePoints/.test(code));

// [F] SVG 判断（SVG 渲染/描述符决策；缓存清理维护调用不算判断）
add('无 SVG 判断', !/SVGUtil\.(?:render|resolve|register|draw)\s*\(|svg-registry\.render\s*\(|state\.presentationHtml|presentationMode\s*\(/.test(code));

// 保留：统一入口 + 批改 + 状态
add('保留 PracticeBridge.start() 统一生成入口', /PracticeBridge\.start\s*\(/.test(code));
add('保留 UIState.generationHtml 生成状态', /generationHtml/.test(code));
add('批改经 PluginUtil.computeResult（无 Plugin 依赖）', /PluginUtil\.computeResult/.test(code));

console.log('\nPractice 页面职责 Gate：' + pass.length + '/' + (pass.length + fail.length) + ' 通过');
if (fail.length) {
  console.log('失败项:\n - ' + fail.join('\n - '));
  process.exitCode = 1;
} else {
  console.log('PRACTICE-PAGE: PASS（仅 UI State → Request → Engine → Render → Answer → Result）');
  process.exitCode = 0;
}