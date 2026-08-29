#!/usr/bin/env node
/**
 * dev/plugin-loader.js — 插件加载模块（步骤 3）
 *
 * 职责：
 *   在 Node 环境中用 vm 模拟浏览器全局对象（window），逐插件独立沙箱加载：
 *     1. 预执行共享层（shared/common.js → shared/knowledge-bank.js，模拟页面 <script> 顺序）；
 *     2. 按 registry 条目预执行 deps（如 pinyin-bank.js，相对站点根）；
 *     3. 执行插件文件本身；
 *     4. 捕获导出对象：module.exports 优先（含 generate 时），否则 window.__currentPlugin；
 *     5. 校验三大接口（generate/render/check），即 CONTRACT.md 第六节唯一运行时硬闸门。
 *
 * API：
 *   const { loadPlugin, loadAll } = require('./dev/plugin-loader.js');
 *   loadPlugin(entryOrId);   // → { plugin, compatible, missingInterfaces, source, error, ... }
 *   loadAll({ subject });    // → { results, summary }
 *
 * CLI：
 *   node dev/plugin-loader.js                    # 加载全部插件并输出体检摘要
 *   node dev/plugin-loader.js math-oral,chinese-pinyin
 *   node dev/plugin-loader.js --json
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var Module = require('module');

var ROOT = path.join(__dirname, '..');
var registryMod = require('./plugin-registry.js');

// 浏览器端共享层加载顺序（与各类页面静态 <script> 一致）：
// common/difficulty/subject-utils/print/knowledge-bank/module-catalog/svg-*/registry 先于一切插件。
// 必须与实际页面加载的共享脚本对齐，否则插件在沙箱中找不到 App.Difficulty / ChineseUtil / SVGUtil 等会误报失败。
var SHARED_SCRIPTS = [
  'shared/common.js',
  'shared/difficulty.js',
  'shared/subject-utils.js',
  'shared/print.js',
  'shared/knowledge-bank.js',
  'shared/knowledge-math.js',
  'shared/knowledge-cn.js',
  'shared/knowledge-en.js',
  'shared/module-catalog.js',
  'shared/svg-core.js',
  'shared/svg-calculation.js',
  'shared/svg-geometry.js',
  'shared/svg-make-ten.js',
  'shared/svg-chinese.js',
  'shared/svg-english.js',
  'plugins/registry.js'
];

/**
 * 可「真加载」的 document 桩：
 * - 常规元素仅满足守卫判断；
 * - head.appendChild(<script>) 时在当前会话内执行真实脚本，
 *   并异步触发 onload/onerror——与浏览器 <script> 注入语义一致，
 *   使 App.PluginLoader.loadScript 与综合插件的动态子插件装载真正可用。
 */
function makeDocument(execScript) {
  function fakeEl(tagName) {
    return {
      tagName: tagName,
      style: {},
      setAttribute: function (k, v) { this[k] = v; },
      appendChild: function (c) { return c; },
      addEventListener: function () {}
    };
  }
  function fireOnload(el) {
    setTimeout(function () {
      try {
        execScript(path.join(ROOT, String(el.src)));
        if (typeof el.onload === 'function') el.onload();
      } catch (e) {
        if (typeof el.onerror === 'function') el.onerror(e);
        else throw e;
      }
    }, 0);
  }
  return {
    createElement: fakeEl,
    createTextNode: function () { return {}; },
    head: {
      appendChild: function (el) {
        if (el && typeof el.src === 'string' && typeof el.onload === 'function') {
          fireOnload(el);
        }
        return el;
      }
    },
    body: { appendChild: function (el) { return el; } },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
  };
}

/** 生成绑定到指定脚本路径的真实 require（供脚本内相对路径兜底依赖使用） */
function makeRequire(filename) {
  var m = new Module(filename, null);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  return function (spec) { return m.require(spec); };
}

/**
 * 创建一个插件专属的「浏览器式」沙箱会话。
 *
 * 关键点：整个会话只创建【一个持久 V8 上下文】（vm.createContext + 多次
 * vm.runInContext），所有脚本共享同一全局对象——等价于浏览器里多个
 * <script> 标签：前一脚本挂到 window 的数据（PINYIN_BANK / PluginUtil 等）
 * 对后续脚本的【裸标识符】可见。若对同一 sandbox 反复 runInNewContext，
 * 每次都会新建上下文，跨脚本裸标识符解析会失败。
 */
function createSession(entry) {
  var win = {
    console: console,
    crypto: globalThis.crypto,
    performance: globalThis.performance,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    navigator: { userAgent: 'NodePluginLoader/1.0' },
    localStorage: (function () {
      var store = {};
      return {
        getItem: function (k) { return k in store ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      };
    })()
  };
  // 浏览器式循环引用与 CommonJS 环境（module 随脚本切换，见 exec）
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.global = win;
  win.module = { exports: {} };
  win.exports = win.module.exports;

  var context = vm.createContext(win);

  /** 在当前会话内执行一个脚本（模拟 <script src>），返回其 module.exports */
  function exec(absPath) {
    var code = fs.readFileSync(absPath, 'utf8');
    // 每个脚本一份新的 module/exports，其余全局全部共享
    win.module = { exports: {} };
    win.exports = win.module.exports;
    win.require = makeVmRequire(absPath);
    var result = win.module.exports;
    vm.runInContext(code, context, { filename: absPath, timeout: 15000 });
    return result;
  }

  /**
   * 沙箱感知的 require：相对路径（./ ../）在【同一 vm 上下文】内执行，
   * 使子模块（core.js / render.js 等）对 global.PluginUtil 的赋值落到沙箱 win 上，
   * 而非 Node 全局——否则插件在沙箱中看不到 PluginUtil.createPlugin / randInt 等。
   * 内置模块（fs/path/crypto…）回退到 Node require。
   */
  function makeVmRequire(absPath) {
    return function (spec) {
      if (typeof spec === 'string' && spec.charAt(0) === '.') {
        var resolved = path.resolve(path.dirname(absPath), spec);
        return exec(resolved); // 递归走同一沙箱；子模块重新挂到 win 全局
      }
      return require(spec);
    };
  }

  win.document = makeDocument(exec);

  /** 按浏览器顺序装载：共享层 → deps → 插件本体，返回最终 module.exports */
  function boot() {
    SHARED_SCRIPTS.forEach(function (rel) { exec(path.join(ROOT, rel)); });
    (entry.deps || []).forEach(function (d) { exec(path.join(ROOT, d)); });
    return exec(entry.absolutePath);
  }

  return { window: win, exec: exec, boot: boot };
}

/**
 * 加载单个插件并做接口校验。
 * @param {Object|string} entryOrId registry 条目或插件 id
 */
function loadPlugin(entryOrId) {
  var entry = typeof entryOrId === 'string'
    ? registryMod.getEntry(entryOrId)
    : entryOrId;

  var res = {
    id: entry ? entry.id : String(entryOrId),
    file: entry ? entry.file : '',
    plugin: null,
    source: null,
    compatible: false,
    missingInterfaces: [],
    warnings: [],
    error: null
  };
  if (!entry) {
    res.error = '注册表中不存在该插件';
    return res;
  }

  var mod = null, win = null;
  try {
    var session = createSession(entry);
    mod = session.boot();
    win = session.window;
  } catch (e) {
    res.error = '执行失败：' + e.message;
    return res;
  }

  // 导出解析：module.exports 优先（与 dev/regression-check.js 口径一致），
  // 否则回退 window.__currentPlugin，最后兜底扫描 window 上含三大接口的对象
  var pick = null;
  if (mod && typeof mod.generate === 'function') {
    pick = mod;
    res.source = 'module.exports';
  } else if (win.__currentPlugin && typeof win.__currentPlugin.generate === 'function') {
    pick = win.__currentPlugin;
    res.source = 'window.__currentPlugin';
  } else {
    for (var k in win) {
      var v = win[k];
      if (v && typeof v === 'object' &&
          typeof v.generate === 'function' &&
          typeof v.render === 'function' &&
          typeof v.check === 'function') {
        pick = v;
        res.source = 'window.' + k;
        break;
      }
    }
  }
  if (!pick) {
    res.error = '无法捕获导出对象（module.exports 与 __currentPlugin 均无 generate）';
    return res;
  }

  // 三大接口硬闸门（CONTRACT.md 第六节）
  ['generate', 'render', 'check'].forEach(function (fn) {
    if (typeof pick[fn] !== 'function') res.missingInterfaces.push(fn);
  });

  // 必填元数据提醒（不阻断加载，供上层审计）
  ['id', 'name', 'subject', 'grades'].forEach(function (f) {
    var val = pick[f];
    if (val == null || (Array.isArray(val) && !val.length)) {
      res.warnings.push('缺少元数据字段 ' + f);
    }
  });
  if (pick.id !== entry.id) {
    res.warnings.push('id 不一致：registry=' + entry.id + '，插件对象=' + pick.id);
  }

  res.plugin = pick;
  res.compatible = res.missingInterfaces.length === 0;
  return res;
}

/**
 * 批量加载全部（或筛选后）插件。
 * @param {{subject?: string, ids?: string[]}} [options]
 */
function loadAll(options) {
  options = options || {};
  var list = registryMod.readRegistry();

  if (options.subject) {
    list = list.filter(function (e) { return e.subject === options.subject; });
  }
  if (options.ids && options.ids.length) {
    var wanted = {};
    options.ids.forEach(function (id) { wanted[id] = true; });
    list = list.filter(function (e) { return wanted[e.id] || wanted[e.runtimeId]; });
  }

  var results = [];
  list.forEach(function (e) { results.push(loadPlugin(e)); });

  var compatible = 0, incompatible = 0, failed = 0;
  results.forEach(function (r) {
    if (r.error) failed++;
    else if (r.compatible) compatible++;
    else incompatible++;
  });

  return {
    results: results,
    summary: { total: results.length, compatible: compatible, incompatible: incompatible, failed: failed }
  };
}

module.exports = { loadPlugin: loadPlugin, loadAll: loadAll };

// ---- CLI ----
if (require.main === module) {
  var args = process.argv.slice(2);
  var asJson = args.indexOf('--json') !== -1;
  var idsArg = args.filter(function (a) { return a !== '--json'; })[0];
  var options = idsArg ? { ids: idsArg.split(',') } : {};

  var out = loadAll(options);
  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    out.results.forEach(function (r) {
      if (r.error) {
        console.log('  ✗ ' + r.id + ' — ' + r.error);
      } else if (!r.compatible) {
        console.log('  ✗ ' + r.id + ' — 接口缺失：' + r.missingInterfaces.join('/'));
      } else {
        var extra = r.warnings.length ? '  ⚠ ' + r.warnings.join('；') : '';
        console.log('  ✓ ' + r.id + '  [' + r.source + ']' + extra);
      }
    });
    console.log('\n汇总：共 ' + out.summary.total +
      '，兼容 ' + out.summary.compatible +
      '，接口不兼容 ' + out.summary.incompatible +
      '，加载失败 ' + out.summary.failed);
  }
  if (out.summary.failed > 0 || out.summary.incompatible > 0) process.exitCode = 1;
}
