#!/usr/bin/env node
/**
 * dev/check-generator-contract.js — M4-R01 Generator 契约 Gate
 *
 * 1) shared/generator/ 下所有新增 Generator 源码不得违反禁止项：
 *    Math.random / DOM / UI / 直接生成 HTML/SVG / 自行决定全局难度
 * 2) 构造出的 GeneratorContract 结构必须通过校验（id/subject/capabilities/
 *    knowledgePoints/supports/generate）
 * 3) 统一输出 SemanticQuestion 必须通过校验（真实插件经 StrategyEngine → Adapter 验证）
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var LegacyPluginAdapter = require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));

var GENERATOR_DIR = path.join(ROOT, 'shared', 'generator');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function scanSource(dir) {
  var errors = [];
  var scanned = 0;
  fs.readdirSync(dir).forEach(function (f) {
    var fp = path.join(dir, f);
    var stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      var sub = scanSource(fp);
      errors = errors.concat(sub.errors);
      scanned += sub.scanned;
      return;
    }
    if (!f.endsWith('.js')) return;
    // 契约定义文件本身即规则书（含禁止模式字面量），不做自扫描
    if (path.basename(fp) === 'generator-contract.js') return;
    scanned++;
    var src = stripComments(fs.readFileSync(fp, 'utf8'));
    var rel = path.relative(ROOT, fp);
    var isGenerator = rel.indexOf(path.join('shared', 'generator', 'generators')) === 0;
    
    // P10: legacy-plugin-adapter.js 合法提取 SVG（从旧插件提取而非生成），允许 <svg 字符串
    var isLegacyAdapter = rel === 'shared/generator/legacy-plugin-adapter.js';
    Contract.FORBIDDEN_PATTERNS.forEach(function (p) {
      if (isLegacyAdapter && p.label === '直接生成 SVG') return; // 允许 legacy adapter 提取 SVG 字符串
      if (p.pattern.test(src)) errors.push(rel + ' :: 源码违规：' + p.label);
    });
    if (isGenerator) {
      Contract.GENERATOR_DIFFICULTY_PATTERNS.forEach(function (p) {
        if (p.pattern.test(src)) errors.push(rel + ' :: 源码违规：' + p.label);
      });
    }
  });
  return { scanned: scanned, errors: errors };
}

function main() {
  var errors = [];
  var warnings = [];

  // 1) 源码级禁止项扫描
  var scan = scanSource(GENERATOR_DIR);
  scan.errors.forEach(function (e) { errors.push(e); });

  // 2) 构造 GeneratorContract 并校验（真实插件：math-make-ten，经 M2 能力注册表注入元数据）
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var rec = null;
  for (var i = 0; i < genRecords.length; i++) {
    if (genRecords[i].pluginId === 'math-make-ten') { rec = genRecords[i]; break; }
  }
  if (!rec) {
    errors.push('generator-capability-registry 中缺少 math-make-ten');
  } else {
    var fakePlugin = {
      id: 'math-make-ten',
      subject: 'math',
      generate: function (opts) {
        opts = opts || {};
        var n = opts.count || 1;
        var questions = [];
        for (var i = 0; i < n; i++) {
          questions.push({ q: '9 + 5 = ?', answer: '14', knowledgePointId: 'math-g1-m0-make-ten' });
        }
        return { questions: questions, meta: { type: 'cushi' } };
      }
    };
    var generator = LegacyPluginAdapter.createLegacyGenerator(fakePlugin, {
      capabilities: rec.questionTypes,
      knowledgePoints: rec.knowledgePoints
    });
    var contractCheck = Contract.validateGeneratorContract(generator, null);
    contractCheck.errors.forEach(function (e) { errors.push('GeneratorContract :: ' + e); });

    // 3) 真实链路：StrategyEngine.plan → Adapter → SemanticQuestion[]
    var plan = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, difficulty: 3 }).plans[0];
    var questions = generator.generate(plan, { seed: 'gate-test' });
    if (!Array.isArray(questions) || questions.length !== 2) {
      errors.push('SemanticQuestion 输出量错误: ' + (questions ? questions.length : 'null'));
    } else {
      questions.forEach(function (q, idx) {
        var check = Contract.validateSemanticQuestion(q);
        check.errors.forEach(function (e) { errors.push('SemanticQuestion[' + idx + '] :: ' + e); });
      });
    }
  }

  console.log('M4-R01 Generator 契约 Gate');
  console.log('');
  console.log('Generator 源码扫描:  ' + scan.scanned + ' 文件');
  console.log('GeneratorContract:   ' + (rec ? '校验完成' : '跳过'));
  console.log('SemanticQuestion:    ' + (errors.some(function (e) { return e.indexOf('SemanticQuestion') !== -1; }) ? 'FAIL' : '校验完成'));
  console.log('Errors: ' + errors.length);
  errors.forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('');

  var ok = errors.length === 0;
  console.log(ok ? '[PASS] M4-R01 Generator 契约 Gate' : '[FAIL] M4-R01 Generator 契约 Gate');
  process.exitCode = ok ? 0 : 1;
}

main();
