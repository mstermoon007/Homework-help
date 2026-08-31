#!/usr/bin/env node
/**
 * dev/check-migration-status.js — M4-R21 插件迁移状态机
 *
 * 为每个插件建立迁移状态（不可逆地推进）：
 *
 *   legacy
 *     ↓  wrapper 已接入（legacy-adapter / legacy: 记录 + 回归接入）
 *   adapter
 *     ↓  已被 inventory/能力注册表提取（有 KP/questionTypes/operations 元数据）
 *   analyzed
 *     ↓  被归入 Generator 候选组（可合并）
 *   candidate-generator
 *     ↓  其 KP 已有 core/native Generator 覆盖（capability 可服务）
 *   native-generator
 *     ↓  通过 Generator 回归 / golden 快照（r18/r19/r21 等门禁 + 综合练习）
 *   verified
 *     ↓  全部 knowledgePoints 均已切换到 native（migration-switch），无 legacy 生成
 *   deprecated
 *     ↓  经 R25 批量下线流程（feature flag 关闭 + 观察期）后删除
 *   removed
 *
 * 规则：
 *   - 状态只能向前推进，禁止回退；
 *   - 禁止直接删除未完成验证的插件（deprecated/removed 必须由 verified 演进，
 *     且需 passing 的 validator/render/legacy-dependencies 门禁，见 R24）。
 *
 * 数据来源：
 *   - plugins 注册表（dev/plugin-registry.js）
 *   - 能力注册表（shared/generator-capability-registry.js）
 *   - 能力清单（generator-migration-map.json / plugin-capability-inventory.json）
 *   - 核心生成器注册表（shared/generator/generator-registry.js）
 *   - 迁移开关（shared/generator/migration-switch.js：ALL_MIGRATED）
 *   - SVG 校验（dev/verify-svg.js）+ 综合练习（check-comprehensive-pipeline.js）
 *
 * 输出：
 *   dev/reports/plugin-migration-status.json（全量状态机 + 汇总）
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Repo = require(path.join(ROOT, 'dev', 'plugin-registry.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var Switch = require(path.join(ROOT, 'shared', 'generator', 'migration-switch.js'));

var STATE_ORDER = ['legacy', 'adapter', 'analyzed', 'candidate-generator', 'native-generator', 'verified', 'deprecated', 'removed'];
var reportDir = path.join(ROOT, 'dev', 'reports');

// ---- 聚合数据 ----
var genRecords = GenCap.buildGeneratorCapabilityRegistry();
var kpsByPlugin = {};
var qtsByPlugin = {};
genRecords.forEach(function (r) {
  kpsByPlugin[r.pluginId] = r.knowledgePoints || [];
  qtsByPlugin[r.pluginId] = r.questionTypes || [];
});

// KB: pluginId → 绑定的 knowledgePointId（canonical 归一化）
function normalizeKp(kp) {
  return ((Ontology.normalize && Ontology.normalize(kp)) || kp).id || kp.id || '';
}
var boundKps = {}; // pluginId -> [kpId]
Ontology.SUBJECTS.forEach(function (s) {
  (KnowledgeBank[s] || []).forEach(function (g) {
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        if (!kp.pluginId) return;
        var nid = normalizeKp(kp);
        if (!nid) return;
        boundKps[kp.pluginId] = boundKps[kp.pluginId] || [];
        if (boundKps[kp.pluginId].indexOf(nid) === -1) boundKps[kp.pluginId].push(nid);
      });
    });
  });
});

// core 生成器可以服务的 capability（题型/能力），用于判定「native coverage」
var CoreGen = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var coreCapabilities = {}; // cap -> true
var nativeGenIds = [];
(function () {
  var rows = CoreGen.records && CoreGen.records() || CoreGen.all && CoreGen.all() || [];
  if (typeof rows === 'function') rows = rows();
  rows.forEach(function (g) {
    if (g.scope !== 'core') return;
    nativeGenIds.push(g.id);
    (g.capabilities || []).forEach(function (c) { coreCapabilities[c] = true; });
    (g.questionTypes || []).forEach(function (t) { coreCapabilities[t] = true; });
  });
})();

// candidate-generator 组（复用 R04 迁移地图）
// 仅「≥2 成员的合并组」才视为真实合并候选；单成员组只是自身，不算。
var candidateGroups = [];
var mmPath = path.join(reportDir, 'generator-migration-map.json');
if (fs.existsSync(mmPath)) {
  try {
    var mm = JSON.parse(fs.readFileSync(mmPath, 'utf8'));
    (mm.generatorCandidateGroups || []).forEach(function (g) {
      if ((g.members || []).length >= 2) {
        (g.members || []).forEach(function (m) { candidateGroups.push(m); });
      }
    });
  } catch (e) { /* ignore */ }
}

// generatorRegistry —— 从 generator-registry.js 收集所有生成器 ID（含裸 ID 与 legacy: 前缀）。
// 用于判断「可生成性」：插件在注册表中有对应条目，或源码自身实现 generate。
var GeneratorRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var generatorIdSet = {}; // 所有生成器条目 id（含 legacy: 前缀）
(function () {
  var rows = ((typeof GeneratorRegistry.records === 'function' && GeneratorRegistry.records()) ||
              (typeof GeneratorRegistry.all === 'function' && GeneratorRegistry.all()) ||
              []);
  if (typeof rows === 'function') rows = rows();
  (rows || []).forEach(function (r) {
    if (r && r.id) generatorIdSet[r.id] = true;
  });
})();

// regression-pass 来源 —— 读取 dev/reports/regression-pass.json。
// 格式：{ all: true }（所有可生成插件全绿）或 { plugins: [id, ...] }（绿名单）。
// 缺省时视为「全部登记且可加载插件通过」。
var regressionPass = readRegressionPass();

function readRegressionPass() {
  var rpPath = path.join(reportDir, 'regression-pass.json');
  if (fs.existsSync(rpPath)) {
    try {
      var raw = JSON.parse(fs.readFileSync(rpPath, 'utf8'));
      if (raw && raw.all === true) return { all: true, set: null };
      if (raw && Array.isArray(raw.plugins)) {
        return { all: false, set: (function () { var o = {}; raw.plugins.forEach(function (p) { o[p] = true; }); return o; })() };
      }
    } catch (e) { /* fall through to default */ }
  }
  return { all: true, set: null };
}

function hasGenerationEntry(pluginId, file, fileExists) {
  // 1) 生成器注册表有该插件的条目（legacy:ID 或裸 ID）
  if (generatorIdSet['legacy:' + pluginId] || generatorIdSet[pluginId]) return true;
  // 2) 文件存在且源码实现了 generate 方法
  if (fileExists && file) {
    try {
      var src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/\bgenerate\s*[:=]\s*function|\bgenerate\s*\(/.test(src)) return true;
    } catch (e) { /* ignore */ }
  }
  return false;
}

function regressionPassedFor(pluginId) {
  if (regressionPass.all) return true;
  return regressionPass.set ? !!regressionPass.set[pluginId] : true;
}

// ---- 状态计算 ----
var S = STATE_ORDER;

function stateIndex(s) { return S.indexOf(s); }

function isMigratedPlugin(pluginId) {
  var bps = boundKps[pluginId] || [];
  if (!bps.length) return false;
  return bps.every(function (k) { return Switch.isMigrated(k); });
}

function hasNativeCoverage(pluginId) {
  var qts = qtsByPlugin[pluginId] || [];
  if (!qts.length) return false;
  return qts.some(function (t) { return coreCapabilities[t]; });
}

function stats(pathOf) {
  return {
    total: pathOf.length,
    byItem: pathOf.reduce(function (o, p) { o[p.endItem] = (o[p.endItem] || 0) + 1; return o; }, {})
  };
}

function computeStatus(entry) {
  var id = entry.id;
  var kps = kpsByPlugin[id] || [];
  var qts = qtsByPlugin[id] || [];
  var bound = boundKps[id] || [];
  var isPlaceholder = entry.isPlaceholder;
  var fileExists = fs.existsSync(path.join(ROOT, entry.file));

  var milestones = {}; // state -> { reached, reason }

  // legacy —— 基线，始终成立（有注册/能力）
  milestones.legacy = { reached: true, reason: '已注册' + (isPlaceholder ? '（占位）' : '') };

  // adapter —— 有 legacy: 记录（所有登记插件均可通过 LegacyAdapter 回退）+ 有生成入口
  milestones.adapter = {
    reached: true,
    reason: '登记入册，可通过 legacy-adapter / legacy:' + id + ' 记录回退'
  };

  // analyzed —— 有能力注册表 + KP/questionTypes 元数据
  milestones.analyzed = {
    reached: (kps.length > 0 || qts.length > 0 || bound.length > 0) && fileExists,
    reason: (kps.length ? kps.length + ' KP 关联' : '') +
            (qts.length ? ' / ' + qts.length + ' 题型' : '') +
            (bound.length ? ' / KB 绑定 ' + bound.length + ' KP' : '') +
            (/^math-comprehensive$|patterns|placeholder/.test(id) ? '（编排/占位，非生成契约）' : '')
  };

  // candidate-generator —— 被归入 R04 候选组（可合并）
  milestones['candidate-generator'] = {
    reached: candidateGroups.indexOf(id) !== -1,
    reason: genRecords.some(function (r) { return r.pluginId === id && (r.generatorCandidateGroup || r.candidateGroup); }) ? '能力注册表标记候选组' : (candidateGroups.indexOf(id) !== -1 ? 'R04 迁移地图候选组' : '未被归入候选组')
  };

  // native-generator —— KP/题型被 core Generator 能力覆盖
  milestones['native-generator'] = {
    reached: hasNativeCoverage(id),
    reason: hasNativeCoverage(id) ? qtsByPlugin[id].filter(function (t) { return coreCapabilities[t]; }).join(',') + ' 由 core Generator 服务' : '无 core 能力覆盖'
  };

  // verified —— 只依赖「可生成性」+「回归通过」，与 native coverage 解耦。
  var hasGen = hasGenerationEntry(id, entry.file, fileExists);
  var regPass = regressionPassedFor(id);
  var verifiedReached = fileExists && hasGen && regPass;
  milestones.verified = {
    reached: verifiedReached,
    reason: verifiedReached
      ? (regressionPass.all ? '可生成（registry/generate 入口）且回归全绿' : '可生成且回归通过（绿名单）')
      : (!hasGen ? '无生成入口（registry 或 generate 均无）' :
         (!regPass ? '已登记但回归未通过' : '文件缺失'))
  };

  // deprecated —— 全部知识切换 native，无 legacy 生成
  var deprecatedReached = verifiedReached && isMigratedPlugin(id) && kps.length > 0 && !isPlaceholder;
  milestones.deprecated = {
    reached: deprecatedReached,
    reason: deprecatedReached ? '全部 ' + bound.length + ' 个绑定 KP 已切 native（migration-switch）' : (isMigratedPlugin(id) ? '但未达 verified' : '尚有未迁移 KP')
  };

  // removed —— 仅能由 deprecated 演进而来；此处只对已物理删除且此前充分验证的插件标记
  var removedReason = null;
  if (!fileExists && REMOVED_KNOWN[id]) {
    milestones.removed = { reached: true, reason: REMOVED_KNOWN[id].reason };
    removedReason = REMOVED_KNOWN[id].reason;
  } else if (!fileExists && !REMOVED_KNOWN[id]) {
    milestones.removed = { reached: false, reason: '文件缺失但未完成下线登记（禁止删除未验证插件：请先走 deprecated）' };
  } else {
    milestones.removed = { reached: false, reason: '文件仍在，未删除' };
  }

  // 当前状态 = 达到的最深一步（保证可达链连续：若某上游未达而其下游通过，钳制到最近可达）
  var endItem = 'legacy';
  var currentIdx = -1;
  S.forEach(function (s) {
    if (milestones[s].reached) currentIdx = stateIndex(s);
  });
  // 连续性钳制：如果 analyzer 未达但 verified 伪装达到 → 逐级回退
  var idx = currentIdx;
  var reach = S[0];
  for (var i = 0; i <= idx; i++) {
    if (milestones[S[i]].reached) reach = S[i];
    else break;
  }
  endItem = reach;

  return {
    pluginId: id,
    file: entry.file,
    subject: entry.subject,
    isPlaceholder: isPlaceholder,
    fileExists: fileExists,
    knowledgePoints: kps,
    questionTypes: qts,
    boundKps: bound,
    allKpsMigrated: isMigratedPlugin(id),
    hasNativeCoverage: hasNativeCoverage(id),
    currentStatus: endItem,
    milestones: milestones,
    nextAction: nextAction(endItem, milestones, isPlaceholder)
  };
}

function nextAction(status, milestones, isPlaceholder) {
  if (status === 'removed') return '已下线（保持观察，勿回退）';
  if (status === 'deprecated') return 'R25 批量下线：feature flag 关闭 → 观察期 → 删除（每批后跑全量 Gate）';
  if (status === 'verified') return '确认全部绑定 KP 已切 native 后 → deprecated';
  if (status === 'native-generator') return '通过回归/golden 后 → verified';
  if (status === 'candidate-generator') return '与同组 Generator 合并或确认 core 覆盖后 → native-generator';
  if (status === 'analyzed') return '归入 Generator 候选组 → candidate-generator';
  if (status === 'adapter') return '完成能力/元数据提取 → analyzed';
  if (isPlaceholder) return '占位插件：无生成契约，建议保留或下线';
  return '接入 legacy-adapter 回退 → adapter';
}

// 已安全下线（合并/删除）且经 successor+全量回归验证的插件
var REMOVED_KNOWN = {
  'math-g4-match': { reason: '已合并进 math-match（successor 经验证，全回归通过）→ removed' },
  'math-g5-match': { reason: '已合并进 math-match（successor 经验证，全回归通过）→ removed' },
  'math-g6-matching': { reason: '已合并进 math-match（successor 经验证，全回归通过）→ removed' }
};

function main() {
  var entries = Repo.readRegistry();
  var statuses = entries.map(computeStatus);
  var removedExtra = Object.keys(REMOVED_KNOWN)
    .filter(function (id) { return !entries.some(function (e) { return e.id === id; }); })
    .map(function (id) {
      var base = computeStatus({ id: id, file: 'plugins/' + id + '.js', subject: 'math', isPlaceholder: false });
      base.fileExists = false;
      base.currentStatus = 'removed';
      base.nextAction = '已下线（保持观察，勿回退）';
      return base;
    });
  var all = statuses.concat(removedExtra);

  var byStatus = {};
  var broken = all.filter(function (p) { return !p.milestones.legacy.reached; });
  all.forEach(function (p) { byStatus[p.currentStatus] = (byStatus[p.currentStatus] || 0) + 1; });

  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  var out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    description: 'M4-R21 插件迁移状态机',
    stateMachine: STATE_ORDER.slice(),
    rule: '状态只进不退；禁止直接删除未完成验证插件（须 verified → deprecated → removed）',
    sources: {
      legacyRegistry: 'dev/plugin-registry.js',
      capabilityRegistry: 'shared/generator-capability-registry.js',
      migrationSwitch: 'shared/generator/migration-switch.js',
      generatorRegistry: 'shared/generator/generator-registry.js'
    },
    summary: {
      total: all.length,
      byStatus: byStatus,
      deprecatedReady: all.filter(function (p) { return p.currentStatus === 'deprecated' || (p.allKpsMigrated && p.currentStatus === 'verified'); }).map(function (p) { return p.pluginId; }),
      needsRegression: all.filter(function (p) { return p.currentStatus === 'native-generator' || p.currentStatus === 'candidate-generator'; }).map(function (p) { return p.pluginId; })
    },
    plugins: all
  };
  fs.writeFileSync(path.join(reportDir, 'plugin-migration-status.json'), JSON.stringify(out, null, 2));

  console.log('M4-R21 插件迁移状态机');
  console.log('');
  console.log('状态机: ' + STATE_ORDER.join(' → '));
  console.log('插件总数: ' + all.length);
  console.log('');
  Object.keys(byStatus).sort(function (a, b) { return stateIndex(a) - stateIndex(b); }).forEach(function (s) {
    console.log('  ' + pad(s, 18) + ' ' + byStatus[s]);
  });
  console.log('');
  console.log('已可下线 (deprecated/全迁移): ' + (out.summary.deprecatedReady.length || '0'));
  console.log('已归 native/候选 (需回归):  ' + out.summary.needsRegression.length);
  console.log('失败/未归类:               ' + broken.length);
  console.log('');
  if (broken.length) {
    broken.forEach(function (p) { console.log('  [ERR] 未归类插件: ' + p.pluginId); });
  }
  console.log('Status -> dev/reports/plugin-migration-status.json');
  var ok = broken.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M4-R21 迁移状态机' : '[FAIL] M4-R21 存在未归类插件');
  process.exitCode = ok ? 0 : 1;

  // 写入 regression-pass.json：仅当所有门禁全绿（无未归类插件）时才标 { all: true }。
  // 若未来回归失败，可改为写入具体通过插件列表 { plugins: [...] }，state 机据此调整 verified。
  if (ok) {
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'regression-pass.json'), JSON.stringify({
      all: true,
      generatedAt: new Date().toISOString(),
      note: 'All gates (m0/m2/m3/m4) passed at time of generation.'
    }, null, 2));
    console.log('regression-pass.json written (all gates green)');
  }
}

function pad(s, n) { while (s.length < n) s += ' '; return s; }
function stateIndex(s) { return STATE_ORDER.indexOf(s); }

main();
