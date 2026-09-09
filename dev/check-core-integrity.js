#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const coreFiles = [
  'practice.html',
  'shared/core/common.js',
  'shared/styles/tokens.css',
  'shared/styles/base.css',
  'shared/styles/components.css',
  'shared/styles/toolbar.css',
  'shared/styles/pages.css',
  'shared/presentation/print.js'
];

let allOk = true;
coreFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, '..', file))) {
    console.error(`核心文件缺失: ${file}`);
    allOk = false;
  }
});

if (allOk) {
  console.log('核心文件完整性检查通过。');
} else {
  console.error('核心文件不完整，请检查。');
  process.exit(1);
}