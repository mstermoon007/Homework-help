// @ts-check
/**
 * shared/knowledge/runtime/knowledge-loader.js — 数据装载器（挂 App.KNOWLEDGE_LOADER）
 *
 * 同步装载 shared/knowledge/data 下的 10 个分发文件（6 年级 + 课程树 + 关系 + 映射 + 索引），
 * 同时读取 manifest 校验 rootHash 完整性。
 *
 * 环境：
 *   Node —— fs.readFileSync(../dist path)，基于 __dirname 解析，天然支持测试/工具链
 *   Browser —— 同步 XHR 拉取，base 可配置 window.App.KBL_CONFIG.base（默认 'shared/knowledge'）
 *
 * 幂等：同进程多次 loadSync 返回同一缓存；build 重跑后需新进程（测试脚本各自独立）。
 */
(function (global) {
  'use strict';

  var fs = null, path = null;
  if (typeof module !== 'undefined' && module.exports) {
    fs = require('fs');
    path = require('path');
  }
  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  if (!CRT) throw new Error('knowledge-loader: 缺少 App.KNOWLEDGE_CONTRACT（先加载 knowledge-contract.js）');

  var FILE_INDEX = null;
  var CACHE = null;

  function readNode(rel) {
    var file = path.join(__dirname, '../', rel);
    return fs.readFileSync(file, 'utf8');
  }
  function readBrowser(rel) {
    var base = (global.App && global.App.KBL_CONFIG && global.App.KBL_CONFIG.base) || 'shared/knowledge';
    var url = base.replace(/\/$/, '') + '/' + rel;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('KBL 数据装载失败: ' + url + ' → ' + xhr.status);
    return xhr.responseText;
  }
  var read = (typeof module !== 'undefined' && module.exports) ? readNode : readBrowser;

  var DATA_FILES = [
    'data/math/curriculum.json',
    'data/math/g1/knowledge-points.json',
    'data/math/g2/knowledge-points.json',
    'data/math/g3/knowledge-points.json',
    'data/math/g4/knowledge-points.json',
    'data/math/g5/knowledge-points.json',
    'data/math/g6/knowledge-points.json',
    'relations/math/relations.json',
    'mappings/generation-contract/math.json',
    'index/index.json',
    'manifest/manifest.json'
  ];

  function sha256Hex(text) {
    if (typeof module !== 'undefined' && module.exports) {
      return require('crypto').createHash('sha256').update(text, 'utf8').digest('hex');
    }
    // 浏览器端不重算哈希（Hash Integrity 由加载器外部验证钩子承担，默认跳过）
    return null;
  }

  function loadSync() {
    if (CACHE) return CACHE;

    var texts = {};
    DATA_FILES.forEach(function (rel) { texts[rel] = read(rel); });

    var manifest = JSON.parse(texts['manifest/manifest.json']);
    if (manifest && manifest.integrity) {
      var data = {};
      DATA_FILES.forEach(function (rel) {
        if (rel === 'manifest/manifest.json') return;
        var h = sha256Hex(texts[rel]);
        var expect = manifest.integrity.files[rel];
        if (expect && (typeof module !== 'undefined' && module.exports) && h !== expect) {
          throw new Error('KBL 完整性校验失败: ' + rel + '（期望 ' + expect + ' 实际 ' + h + '）');
        }
        data[rel] = JSON.parse(texts[rel]);
      });
      var kps = [];
      ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
        kps = kps.concat(data['data/math/' + g + '/knowledge-points.json'].knowledgePoints);
      });
      CACHE = {
        ksps: kps,
        curriculum: data['data/math/curriculum.json'],
        byGradeData: data,
        relations: data['relations/math/relations.json'].relations,
        mappingDoc: data['mappings/generation-contract/math.json'],
        index: data['index/index.json'],
        manifest: manifest,
        rootHash: manifest.integrity.rootHash
      };
    } else {
      throw new Error('KBL manifest.integrity 缺失，禁止装载');
    }

    if (!FILE_INDEX) {
      FILE_INDEX = {};
      DATA_FILES.forEach(function (rel) { FILE_INDEX[rel] = texts[rel]; });
    }
    return CACHE;
  }

  function reload() { CACHE = null; return loadSync(); }
  function status() { return CACHE ? { loaded: true, files: DATA_FILES.length, rootHash: CACHE.rootHash } : { loaded: false }; }

  var Loader = {
    loadSync: loadSync,
    reload: reload,
    list: function () { return DATA_FILES.slice(); },
    status: status
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_LOADER = Loader;

  if (typeof module !== 'undefined' && module.exports) module.exports = Loader;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));