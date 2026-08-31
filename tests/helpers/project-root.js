/**
 * tests/helpers/project-root.js — 测试项目根路径解析（环境无关）
 *
 * M2-R02-B：禁止在测试中硬编码绝对路径。
 * 统一通过本 helper 解析项目根目录，供 tests/ 下所有测试引用 shared/ 模块。
 */
'use strict';

var path = require('node:path');

// __dirname = <project>/tests/helpers -> 上两级为项目根
var ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  root: ROOT,
  shared: path.join(ROOT, 'shared'),
  sharedModule: function (name) {
    return require(path.join(ROOT, 'shared', name));
  }
};
