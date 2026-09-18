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