/* ============================================================ */
/* 自动生成：node dev/build-knowledge-runtime.js（请勿手改）       */
/* KBL Runtime 浏览器单文件入口（方案 §23 单入口）                 */
/*                                                               */
/* 包含模块（按依赖顺序）：                                       */
/*   contract → loader → relation → policy → index → query → api */
/*                                                               */
/* 页面引入后暴露：                                               */
/*   window.App.KNOWLEDGE   — KnowledgeAPI 唯一公开入口           */
/*   window.KnowledgeAPI    — 便捷别名                            */
/*                                                               */
/* 禁止：业务层直接访问 catalog/relation/mapping/index JSON；      */
/*       只允许通过 App.KNOWLEDGE 查询（方案 §24/§44）。           */
/* ============================================================ */

// @ts-check
/**
 * shared/knowledge/runtime/knowledge-contract.js — 知识库运行时契约（新增）
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api（挂 App.KNOWLEDGE）。
 *
 * 本文件是 KBL 的对外契约唯一来源：
 *   PUBLIC_API（冻结）       —— Runtime 唯一允许暴露的公开方法白名单
 *   ID / UNIT_ID             —— 新标准（迁移一次生成后固化，禁止按数组位置推导）
 *   BOOKS / GRADES / PERM    —— 合法值域
 */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = '1.0.0';

  var ID_REGEX = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;
  var UNIT_ID_REGEX = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}$/;

  var GRADES = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  var BOOKS = ['up', 'down', 'mixed', 'advance', 'comprehensive'];
  var PERMISSIONS = ['allow', 'forbid', 'degrade', 'missing'];
  var RELATION_TYPES = ['prerequisite', 'successor', 'parent', 'child', 'same_family', 'related', 'cross_book', 'cross_grade', 'extension', 'review'];
  var STATUSES = ['active', 'draft', 'deprecated', 'inactive'];
  var PUBLICATIONS = ['published', 'draft'];

  // 唯一公开入口的方法白名单（Runtime 除白名单外不得向页面/引擎暴露其他方法）
  var PUBLIC_API = Object.freeze([
    'get', 'byGrade', 'byBook', 'byUnit', 'selectable',
    'canGenerate', 'searchByName', 'unit', 'relationsFor', 'stats'
  ].sort());

  function isKnowledgeId(id) { return typeof id === 'string' && ID_REGEX.test(id); }
  function isUnitId(id) { return typeof id === 'string' && UNIT_ID_REGEX.test(id); }

  var Contract = {
    schemaVersion: SCHEMA_VERSION,
    idRegex: ID_REGEX,
    unitIdRegex: UNIT_ID_REGEX,
    grades: Object.freeze(GRADES.slice()),
    books: Object.freeze(BOOKS.slice()),
    permissions: Object.freeze(PERMISSIONS.slice()),
    relationTypes: Object.freeze(RELATION_TYPES.slice()),
    statuses: Object.freeze(STATUSES.slice()),
    publications: Object.freeze(PUBLICATIONS.slice()),
    publicApi: PUBLIC_API,
    isKnowledgeId: isKnowledgeId,
    isUnitId: isUnitId
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_CONTRACT = Contract;

  if (typeof module !== 'undefined' && module.exports) module.exports = Contract;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
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
// @ts-check
/**
 * shared/knowledge/runtime/knowledge-relation.js — 关系查询层（挂 App.KNOWLEDGE_RELATION）
 *
 * 支持类型：prerequisite / successor / parent / child / same_family / related /
 *          cross_book / cross_grade / extension / review
 * 提供：relationsFor（入/出）、closure（BFS 闭包）、resolvePrerequisites、integrityCheck
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);

  function byId() {
    var c = Loader.loadSync();
    var map = {};
    c.ksps.forEach(function (k) { map[k.knowledgeId] = k; });
    return map;
  }

  function relationsFor(id, direction) {
    var c = Loader.loadSync();
    var out = { outgoing: [], incoming: [] };
    c.relations.forEach(function (r) {
      if (direction === 'out' || !direction) if (r.fromId === id) out.outgoing.push(r);
      if (direction === 'in' || !direction) if (r.toId === id) out.incoming.push(r);
    });
    return out;
  }

  // BFS 闭包：从 id 出发，沿给定方向与关系类型逐层扩展，返回去重有序 ID 序列
  function closure(id, opts) {
    opts = opts || {};
    var types = opts.types || null;
    var direction = opts.direction || 'out';
    var maxDepth = opts.maxDepth || Infinity;
    var c = Loader.loadSync();
    var seen = {}; var order = [];
    var frontier = [id]; var depth = 0;
    while (frontier.length && depth <= maxDepth) {
      var next = [];
      frontier.forEach(function (cur) {
        c.relations.forEach(function (r) {
          var isOut = direction === 'out' ? r.fromId === cur : r.toId === cur;
          var nxt = direction === 'out' ? r.toId : r.fromId;
          if (!isOut || nxt === id) return;
          if (types && types.indexOf(r.relation) === -1) return;
          if (seen[nxt]) return;
          seen[nxt] = true; order.push(nxt); next.push(nxt);
        });
      });
      frontier = next; depth++;
    }
    return order;
  }

  function resolvePrerequisites(id, maxDepth) {
    return closure(id, { types: ['prerequisite'], direction: 'out', maxDepth: maxDepth || 2 });
  }

  function integrityCheck() {
    var c = Loader.loadSync();
    var kpSet = {};
    c.ksps.forEach(function (k) { kpSet[k.knowledgeId] = true; });
    var issues = [];
    c.relations.forEach(function (r) {
      if (!kpSet[r.fromId]) issues.push('关系源未知: ' + r.fromId);
      if (!kpSet[r.toId]) issues.push('关系目标未知: ' + r.toId);
      if (r.fromId === r.toId) issues.push('自环: ' + r.fromId);
      if (CRT.relationTypes.indexOf(r.relation) === -1) issues.push('非法类型: ' + r.relation);
    });
    return { relations: c.relations.length, issues: issues, pass: issues.length === 0 };
  }

  var Relation = {
    byId: byId,
    relationsFor: relationsFor,
    closure: closure,
    resolvePrerequisites: resolvePrerequisites,
    integrityCheck: integrityCheck
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_RELATION = Relation;

  if (typeof module !== 'undefined' && module.exports) module.exports = Relation;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
// @ts-check
/**
 * shared/knowledge/runtime/knowledge-policy.js — 知识与生成策略层（挂 App.KNOWLEDGE_POLICY）
 *
 * 不持有难度权威（Difficulty Authority 在 shared/catalog/difficulty.js）：
 *   本层只裁决「能否出现 / 能否生成」两类问题。
 *
 * isSelectable            —— 发布态 + 非废弃（页面知识点选择器用）
 * canUseQuestionType      —— 依据 generation-contract 的 permission + 注册表权限渲染
 * isActive               —— 生命周期状态判定
 * degraded               —— permission=degrade 时降级信息（当前数据库中 forbid/degrade 恒无）
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);

  function kpMap() {
    var c = Loader.loadSync();
    var map = {};
    c.ksps.forEach(function (k) { map[k.knowledgeId] = k; });
    return map;
  }

  // 生命周期：published + active（历史 inactive 视为不可用）
  function isSelectable(kp) {
    if (!kp) return false;
    if (kp.publication !== 'published') return false;
    if (kp.status !== 'active') return false;
    return true;
  }

  function isActive(kp) { return isSelectable(kp); }

  // 权限渲染：mapping.permission ∈ {allow, forbid, degrade, missing}
  function canUseQuestionType(kpId, questionType) {
    var c = Loader.loadSync();
    var entry = null;
    c.mappingDoc.mappings.forEach(function (m) {
      if (m.knowledgeId === kpId && m.questionType === questionType) entry = m;
    });
    if (!entry) return { allowed: false, permission: 'missing', reason: '无映射', coefficient: null };
    var allowed = entry.permission === 'allow' || entry.permission === 'degrade';
    return {
      allowed: allowed,
      permission: entry.permission,
      reason: entry.permission === 'allow' ? 'registry-allow' : entry.permission === 'degrade' ? 'registry-degrade' : entry.permission === 'forbid' ? 'registry-forbid' : 'registry-missing',
      coefficient: entry.coefficient
    };
  }

  function mappingCounts() {
    var c = Loader.loadSync();
    var counts = { allow: 0, forbid: 0, degrade: 0, missing: 0 };
    c.mappingDoc.mappings.forEach(function (m) { counts[m.permission] = (counts[m.permission] || 0) + 1; });
    return counts;
  }

  var Policy = {
    isSelectable: isSelectable,
    isActive: isActive,
    canUseQuestionType: canUseQuestionType,
    mappingCounts: mappingCounts
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_POLICY = Policy;

  if (typeof module !== 'undefined' && module.exports) module.exports = Policy;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
// @ts-check
/**
 * shared/knowledge/runtime/knowledge-index.js — 索引查询层（挂 App.KNOWLEDGE_INDEX）
 *
 * 只读共享分发产物 index/index.json。索引在 Canonical Build 阶段一次生成并固化，
 * Runtime 一律读取、绝不按数组位置动态推导 ID（方案 §6 / §11 / §15）。
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 *
 * 注意：本模块是 runtime 内部实现，业务层唯一公开入口为 knowledge-api.js。
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  if (!CRT) throw new Error('knowledge-index: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-index: 缺少 App.KNOWLEDGE_LOADER');

  var _idx = null;
  function index() {
    if (!_idx) _idx = Loader.loadSync().index;
    return _idx;
  }

  function list(arr) { return arr || []; }

  function byId(id) { var e = index().byId[id]; return e || null; }

  function byGrade(grade) { return list(index().byGrade[grade]); }
  function byBook(grade, book) { return list(index().byBook[grade + '-' + book]); }
  function byUnit(unitId) { return list(index().byUnit[unitId]); }
  function byModule(module) { return list(index().byModule[module]); }
  function byFamily(family) { return list(index().byFamily[family]); }
  function byStatus(status) { return list(index().byStatus[status]); }
  function byPublication(publication) { return list(index().byPublication[publication]); }

  function sections() { return index(); }
  function count() { return Object.keys(index().byId).length; }

  var Index = {
    byId: byId,
    byGrade: byGrade,
    byBook: byBook,
    byUnit: byUnit,
    byModule: byModule,
    byFamily: byFamily,
    byStatus: byStatus,
    byPublication: byPublication,
    sections: sections,
    count: count
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_INDEX = Index;

  if (typeof module !== 'undefined' && module.exports) module.exports = Index;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
// @ts-check
/**
 * shared/knowledge/runtime/knowledge-query.js — 查询层（挂 App.KNOWLEDGE_QUERY）
 *
 * 在 Loader / Policy / Index 之上实现核心查询（方案 §19 的 knowledge-query）。
 * knowledge-api.js 是唯一公开入口，本模块为 runtime 内部实现：
 * 业务层不得直接 require 本文件，须经 App.KNOWLEDGE（KnowledgeAPI）。
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  var Policy = (global.App && global.App.KNOWLEDGE_POLICY) || (typeof module !== 'undefined' ? require('./knowledge-policy.js') : null);
  var Index = (global.App && global.App.KNOWLEDGE_INDEX) || (typeof module !== 'undefined' ? require('./knowledge-index.js') : null);
  if (!CRT) throw new Error('knowledge-query: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-query: 缺少 App.KNOWLEDGE_LOADER');

  var _kpMap = null; var _unitMap = null;
  function load() {
    var c = Loader.loadSync();
    if (!_kpMap) {
      _kpMap = {};
      c.ksps.forEach(function (k) { _kpMap[k.knowledgeId] = k; });
    }
    if (!_unitMap) {
      _unitMap = {};
      c.curriculum.units.forEach(function (u) { _unitMap[u.unitId] = u; });
    }
    return c;
  }
  function sortKps(list) {
    return list.slice().sort(function (a, b) {
      if (a.unitId !== b.unitId) return a.unitId < b.unitId ? -1 : 1;
      return a.knowledgeNo - b.knowledgeNo;
    });
  }

  function get(id) { load(); return _kpMap[id] || null; }

  function byGrade(grade) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.grade === grade; }));
  }

  function byBook(grade, book) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.grade === grade && k.book === book; }));
  }

  function byUnit(unitId) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.unitId === unitId; }));
  }

  // 可选性查询：可选条件 grade/book/unitId 过滤 + Policy 可练性门禁（发布态 + active）
  function selectable(opts) {
    opts = opts || {};
    var c = load();
    var list = c.ksps.filter(function (k) {
      if (opts.grade && k.grade !== opts.grade) return false;
      if (opts.book && k.book !== opts.book) return false;
      if (opts.unitId && k.unitId !== opts.unitId) return false;
      if (opts.includeDeprecated) return true;
      return Policy.isSelectable(k);
    });
    return sortKps(list);
  }

  function searchByName(keyword) {
    var c = load();
    var q = String(keyword || '').toLowerCase();
    if (!q) return [];
    return sortKps(c.ksps.filter(function (k) {
      if (String(k.name || '').toLowerCase().indexOf(q) !== -1) return true;
      return (k.aliases || []).some(function (a) { return String(a).toLowerCase().indexOf(q) !== -1; });
    }));
  }

  function unit(unitId) {
    load();
    var u = _unitMap[unitId];
    if (!u) return null;
    var kps = byUnit(unitId);
    return { unitId: u.unitId, grade: u.grade, book: u.book, unitNo: u.unitNo, unitName: u.unitName, unitType: u.unitType, status: u.status, knowledgePointCount: kps.length, knowledgePoints: kps.map(function (k) { return k.knowledgeId; }) };
  }

  function stats() {
    var c = load();
    var byGrade = {}; var byBook = {};
    c.ksps.forEach(function (k) {
      byGrade[k.grade] = (byGrade[k.grade] || 0) + 1;
      byBook[k.grade + '-' + k.book] = (byBook[k.grade + '-' + k.book] || 0) + 1;
    });
    return {
      knowledgePoints: c.ksps.length,
      units: c.curriculum.units.length,
      relations: c.relations.length,
      mappings: c.mappingDoc.mappings.length,
      permissions: Policy.mappingCounts(),
      byGrade: byGrade,
      byBook: byBook,
      rootHash: c.rootHash,
      schemaVersion: c.manifest.schemaVersion
    };
  }

  var Query = {
    get: get,
    byGrade: byGrade,
    byBook: byBook,
    byUnit: byUnit,
    selectable: selectable,
    searchByName: searchByName,
    unit: unit,
    stats: stats
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_QUERY = Query;

  if (typeof module !== 'undefined' && module.exports) module.exports = Query;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
// @ts-check
/**
 * shared/knowledge/runtime/knowledge-api.js — 知识库唯一公开入口（挂 App.KNOWLEDGE）
 *
 * 这是 KBL 运行时对外的“单入口”。所有查询必须经由此处（方案 §19/§20/§21）：
 *   get / byGrade / byBook / byUnit / selectable / canGenerate / searchByName / unit / relationsFor / stats
 * 白名单见 knowledge-contract.js -> publicApi。超出白名单的方法调用返回 undefined。
 *
 * 查询实现委托给内部模块：
 *   knowledge-query（get/byGrade/byBook/byUnit/selectable/searchByName/unit/stats）
 *   knowledge-policy（canGenerate 权限裁决）
 *   knowledge-relation（relationsFor）
 * 业务层不得直接 require 内部模块；唯一公开入口 = App.KNOWLEDGE。
 *
 * 加载顺序（页面/bundle）：knowledge-contract → knowledge-loader →
 * knowledge-relation → knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  var Relation = (global.App && global.App.KNOWLEDGE_RELATION) || (typeof module !== 'undefined' ? require('./knowledge-relation.js') : null);
  var Policy = (global.App && global.App.KNOWLEDGE_POLICY) || (typeof module !== 'undefined' ? require('./knowledge-policy.js') : null);
  var Query = (global.App && global.App.KNOWLEDGE_QUERY) || (typeof module !== 'undefined' ? require('./knowledge-query.js') : null);
  if (!CRT) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_LOADER');
  if (!Query) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_QUERY');

  function canGenerate(kpId, questionType) {
    var map = {};
    Loader.loadSync().ksps.forEach(function (k) { map[k.knowledgeId] = k; });
    var kp = map[kpId];
    if (!kp) return { allowed: false, reason: 'unknown-knowledge', permission: null };
    if (!Policy.isSelectable(kp)) return { allowed: false, reason: 'not-selectable', permission: null };
    return Policy.canUseQuestionType(kpId, questionType);
  }

  var KNOWLEDGE = {
    get: Query.get,
    byGrade: Query.byGrade,
    byBook: Query.byBook,
    byUnit: Query.byUnit,
    selectable: Query.selectable,
    canGenerate: canGenerate,
    searchByName: Query.searchByName,
    unit: Query.unit,
    relationsFor: function (id) { return Relation.relationsFor(id); },
    stats: Query.stats
  };

  // 白名单对齐：知识契约定义 Public API 顺序，此处仅暴露白名单内方法
  var exposed = {};
  CRT.publicApi.forEach(function (name) {
    if (typeof KNOWLEDGE[name] === 'function') exposed[name] = KNOWLEDGE[name];
  });

  global.App = global.App || {};
  global.App.KNOWLEDGE = exposed;

  if (typeof module !== 'undefined' && module.exports) module.exports = exposed;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

/* KnowledgeAPI 便捷别名：页面可直接用 KnowledgeAPI.byGrade(...) 等 */
(function (global) {
  if (global.App && global.App.KNOWLEDGE) global.KnowledgeAPI = global.App.KNOWLEDGE;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
