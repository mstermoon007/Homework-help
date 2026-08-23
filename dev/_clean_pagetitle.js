// 批量清理：移除插件中冗余的 pageTitle 字段（恒等于 年级+name，已由 practice.html 的 buildTitle 推导）
const fs = require('fs');
const path = require('path');
const dir = '/Users/zhanggaozhang/Code/Homework Help/plugins';

// 匹配 standalone 的 pageTitle 行：  pageTitle: '...',
const re = /^[ \t]*pageTitle:[ \t]*'[^']*',[ \t]*\r?\n/m;

let removed = 0;
fs.readdirSync(dir)
  .filter(f => f.endsWith('.js'))
  .forEach(f => {
    const p = path.join(dir, f);
    let s = fs.readFileSync(p, 'utf8');
    if (re.test(s)) {
      s = s.replace(re, '');
      fs.writeFileSync(p, s);
      removed++;
      console.log('removed pageTitle ->', f);
    }
  });
console.log('total removed:', removed);
