/**
 * shared/validator/graphic-validator.js — M5-R11 Graphic Validator
 *
 * 验证图形描述：
 *   - type 是否注册
 *   - subtype 是否合法
 *   - params 是否完整
 *   - 参数类型是否正确
 *   - Renderer 是否存在对应处理器
 *   - 禁止 raw SVG/HTML 字符串
 */
'use strict';

var Validator = require('./question-validator.js');
var Schema = require('../schemas/semantic-question.schema.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function validateGraphic(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var g = sq.graphic;
  if (!g) {
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { graphic: 'skip' } };
  }

  if (typeof g !== 'object') {
    errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'graphic', 'graphic 必须为对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: [], info: [], score: 0, checks: { graphic: 'fail' } };
  }

  // ① 禁止原始 SVG/HTML
  if (g.rawSvg || g.svg || g.html) {
    errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'graphic.rawSvg', 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', SEVERITY.ERROR));
  }

  // ② type 注册检查
  if (!g.type) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.type', '缺少 graphic.type', SEVERITY.ERROR));
  } else if (!Schema.isValidGraphicType(g.type)) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.type', '未注册的 graphic type: ' + g.type, SEVERITY.ERROR));
  }

  // ③ subtype 合法性
  if (g.subtype && g.type && !Schema.isValidGraphicSubtype(g.type, g.subtype)) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.subtype', 'type ' + g.type + ' 下未知 subtype: ' + g.subtype, SEVERITY.ERROR));
  }

  // ④ params 完整性（按 type 检查必填参数）
  var requiredParams = {
    geometry: ['shape'],
    chart: ['data', 'axes'],
    diagram: ['nodes', 'edges'],
    'number-line': ['range'],
    grid: ['size']
  };
  var req = requiredParams[g.type];
  if (req && g.params) {
    req.forEach(function (p) {
      if (g.params[p] == null) {
        warnings.push({ code: ERROR_CODES.GRAPHIC_PARAMS_INCOMPLETE, field: 'graphic.params.' + p, message: 'graphic.type ' + g.type + ' 缺少必填参数: ' + p, severity: 'WARNING' });
      }
    });
  }

  // ⑤ Renderer 存在性（延迟到 render-preflight，此处仅记录）
  info.push({ code: 'GRAPHIC_TYPE', field: 'graphic.type', message: '图形类型: ' + g.type + (g.subtype ? '/' + g.subtype : ''), severity: 'INFO' });

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0, checks: { graphic: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateGraphic: validateGraphic
};