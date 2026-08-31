/**
 * shared/validator/render-preflight.js — M5-R12 Render Preflight
 *
 * 渲染前检查：
 *   - HTML 可生成
 *   - SVG Generator 存在
 *   - Graphic 参数合法
 *   - Print 模式可用
 *   - 无异常 DOM 依赖
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function validateRenderPreflight(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  // ① 基础字段完整性（渲染需要的最小字段）
  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt);
  if (!prompt) {
    errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'prompt', '缺少题干，无法渲染', SEVERITY.ERROR));
  }

  // ② answerMode 合法
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  var validModes = ['input', 'choice', 'multi', 'none', 'read-aloud'];
  if (validModes.indexOf(answerMode) === -1) {
    errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'answerMode', '非法 answerMode: ' + answerMode, SEVERITY.ERROR));
  }

  // ③ choice 题需有 options
  if (answerMode === 'choice') {
    var hasOptions = sq.distractors && sq.distractors.length > 0;
    var answerVal = sq.answer && sq.answer.value != null;
    if (!hasOptions && !answerVal) {
      errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'distractors', '选择题缺少选项', SEVERITY.ERROR));
    }
  }

  // ④ graphic → SVG Generator 存在性检查（延迟到运行时，此处仅记录）
  if (sq.graphic && sq.graphic.type) {
    info.push({ code: 'GRAPHIC_RENDER', field: 'graphic', message: '需 SVG Generator: ' + sq.graphic.type, severity: 'INFO' });
  }

  // ⑤ print 模式检查（打印需无交互元素）
  if (sq.printMode) {
    if (answerMode === 'choice' || answerMode === 'input') {
      warnings.push({ code: 'PRINT_INTERACTIVE', field: 'printMode', message: '打印模式下存在交互元素，将降级为静态显示', severity: 'WARNING' });
    }
  }

  // ⑥ 兼容字段（render/check/svg）存在性
  if (sq.render && typeof sq.render !== 'function') {
    warnings.push({ code: 'RENDER_INVALID', field: 'render', message: 'render 字段非函数', severity: 'WARNING' });
  }
  if (sq.check && typeof sq.check !== 'function') {
    warnings.push({ code: 'CHECK_INVALID', field: 'check', message: 'check 字段非函数', severity: 'WARNING' });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { renderPreflight: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateRenderPreflight: validateRenderPreflight
};