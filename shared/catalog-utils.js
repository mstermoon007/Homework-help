/**
 * shared/catalog-utils.js — P2-R02/R03 题型目录统一工具
 *
 * 从 KnowledgeBank 获取可用知识点，按模块分组，解析可用题型，
 * 生成 PracticeRequest，供目录页渲染与跳转使用。
 *
 * 核心原则：
 *   - 数据源唯一：KnowledgeBank（不依赖 Plugin 注册表）
 *   - 卡片绑定 knowledgePointId[]
 *   - 点击生成 PracticeRequest（subject, grade, knowledgePoints, questionType, mode）
 *   - 无可用 Generator Capability 的知识点按现状显示，不强行生成
 */
(function (global) {
  'use strict';

  var SUBJECT_CANON = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };

  function canonSubject(s) { return SUBJECT_CANON[s] || s; }

  /**
   * 获取某科目某年级的知识点条目（扁平）
   * @returns [{id,name,pluginId,moduleId,weight,type}]
   */
  function getKPEntries(subject, grade) {
    if (typeof window.KnowledgeBank === 'undefined') return [];
    return window.KnowledgeBank.getEntries(canonSubject(subject), grade) || [];
  }

  /**
   * 获取模块目录
   */
  function getModuleCatalog() {
    return (typeof window.MODULE_CATALOG !== 'undefined') ? window.MODULE_CATALOG : [];
  }

  /**
   * 按模块分组知识点
   * @returns { moduleId: { module, kps: [], questionTypes: Set } }
   */
  function groupKPsByModule(subject, grade) {
    var entries = getKPEntries(subject, grade);
    var catalog = getModuleCatalog();
    var moduleById = {};
    catalog.forEach(function (m) { moduleById[m.id] = m; });

    var grouped = {};
    entries.forEach(function (kp) {
      var mid = kp.moduleId;
      if (!mid) return;
      if (!grouped[mid]) {
        var mod = moduleById[mid] || { id: mid, name: mid, subject: canonSubject(subject) };
        grouped[mid] = { module: mod, kps: [], questionTypes: new Set() };
      }
      grouped[mid].kps.push(kp);
      if (kp.type) grouped[mid].questionTypes.add(kp.type);
    });
    return grouped;
  }

  /**
   * 检查某 KP+questionType 是否有可用生成器（通过 capability-resolver）
   * 返回 'ALLOW' | 'DEGRADE' | 'MISSING' | 'FORBID' | 'INVALID'
   */
  function checkKPCapability(kpId, questionType) {
    if (typeof window.CapabilityResolver === 'undefined') return 'UNKNOWN';
    try {
      var r = window.CapabilityResolver.resolveFinal({ knowledgePointId: kpId, questionType: questionType });
      return r && r.decision ? r.decision : 'UNKNOWN';
    } catch (e) {
      return 'UNKNOWN';
    }
  }

  /**
   * 为模块确定可用题型（过滤掉全不可用的）
   * @returns [{questionType, label, kpIds[], hasGenerator: boolean}]
   */
  function getModuleQuestionTypes(subject, grade, moduleId) {
    var grouped = groupKPsByModule(subject, grade);
    var g = grouped[moduleId];
    if (!g) return [];

    var result = [];
    g.questionTypes.forEach(function (qt) {
      var kpIds = g.kps.filter(function (kp) { return kp.type === qt; }).map(function (kp) { return kp.id; });
      var hasGen = false;
      if (kpIds.length) {
        var cap = checkKPCapability(kpIds[0], qt);
        hasGen = (cap === 'ALLOW' || cap === 'DEGRADE');
      }
      result.push({ questionType: qt, kpIds: kpIds, hasGenerator: hasGen });
    });
    return result;
  }

  /**
   * 构建 PracticeRequest URL（供卡片点击跳转）
   * 模式：
   *   - 单知识点：knowledgePointId + questionType
   *   - 多知识点（同模块）：knowledgePoints[] + questionType
   */
  function buildPracticeLink(subject, grade, moduleId, questionType) {
    var grouped = groupKPsByModule(subject, grade);
    var g = grouped[moduleId];
    if (!g || !g.kps.length) return null;

    var kpIds = g.kps.map(function (kp) { return kp.id; });
    var base = 'practice.html?subject=' + encodeURIComponent(subject) + '&grade=' + grade;

    if (kpIds.length === 1) {
      return base + '&kp=' + encodeURIComponent(kpIds[0]) + '&qt=' + encodeURIComponent(questionType);
    } else {
      return base + '&kps=' + encodeURIComponent(kpIds.join(',')) + '&qt=' + encodeURIComponent(questionType);
    }
  }

/**
 * 渲染模块卡片 HTML
 * @param {Object} opts { subject, grade, module, questionTypes[], moduleIndex }
 */
function renderModuleCard(opts) {
  var subject = opts.subject, grade = opts.grade, mod = opts.module, qts = opts.questionTypes;
  var subjectName = { math: '数学', cn: '语文', en: '英语', chinese: '语文', english: '英语' }[canonSubject(subject)] || subject;
  var hasAnyGen = qts.some(function (qt) { return qt.hasGenerator; });
  var disabled = !hasAnyGen;
  var kpCount = qts.reduce(function (sum, qt) { return sum + qt.kpIds.length; }, 0);

  // 标签：取前 3 个题型标签
  var tags = qts.slice(0, 3).map(function (qt) {
    var label = qt.questionType;
    var pretty = {
      'calc': '计算', 'oral': '口算', 'vertical': '竖式', 'mixed': '混合',
      'judge': '判断', 'choice': '选择', 'fill': '填空', 'cushi': '凑十法',
      'word': '应用题', 'geometry': '几何', 'stats': '统计', 'clock': '钟表',
      'money': '人民币', 'unit': '单位换算', 'pattern': '找规律',
      'pinyin': '拼音', 'char': '写字', 'alphabet': '字母'
    }[label] || label;
    return '<span class="t-tag" title="' + qt.kpIds.length + ' 个知识点">' + pretty + '</span>';
  }).join('');

  var moreCount = qts.length > 3 ? qts.length - 3 : 0;
  if (moreCount) tags += '<span class="t-tag more">+' + moreCount + '</span>';

  var cardClass = 'type-card' + (disabled ? ' disabled' : '');
  var titleAttr = disabled ? '该年级暂无可用生成器' : (kpCount + ' 个知识点 · ' + qts.length + ' 种题型');

  // P7: 题型卡支持 练习 + 打印 两个入口
  var practiceLink = buildPracticeLink(subject, grade, mod.id, qts[0].questionType);
  var printLink = 'practice.html?subject=' + encodeURIComponent(subject) + '&grade=' + grade +
    '&kps=' + encodeURIComponent(qts.map(function(qt){return qt.kpIds.join(',');}).join(',')) +
    '&print=1';

  var practiceBtn = disabled ? '' : '<a href="' + practiceLink + '" class="type-btn practice">练习</a>';
  var printBtn = disabled ? '' : '<a href="' + printLink + '" class="type-btn print">打印</a>';

  return '<div class="' + cardClass + '" title="' + titleAttr + '">' +
    '<span class="t-title">' + (mod.name || mod.id) + '</span>' +
    (tags ? '<span class="t-tags">' + tags + '</span>' : '') +
    (disabled ? '<span class="t-disabled">暂不可用</span>' : '') +
    '<div class="type-card-actions">' + practiceBtn + printBtn + '</div>' +
    '</div>';
  }

  // 暴露 API
  var API = {
    getKPEntries: getKPEntries,
    groupKPsByModule: groupKPsByModule,
    checkKPCapability: checkKPCapability,
    getModuleQuestionTypes: getModuleQuestionTypes,
    buildPracticeLink: buildPracticeLink,
    renderModuleCard: renderModuleCard
  };

  global.CatalogUtils = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);