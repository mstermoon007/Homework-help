'use strict';
// dev/p42/participation-checker.js — P42-2B 教学目标本质参与度检查器（静态规则，只读审计层）
//
// 定位（P42-BASELINE §6.3/§7 + 缺陷登记 P42-023/025）：
//   既有 kp-semantic-validator 仅做声明制检查（KP ID/题型/运算/范围/证据声明），
//   不验证「目标 KP 是否本质参与题目」。本检查器为 dev/ 审计层纯函数，零生产链改动，
//   三族静态规则：
//
//   P1 Prompt 跨 KP 复用指标（P42-023 工具缺口，P42-3 阈值治理）——
//      同一题面（精确 / 数字归一模板）跨 KP 分组计数 + 分级阈值告警：
//      精确组 ≥2 KP 即 alert（基线 §3「64 组」已知设计口径，漂移须关注）；
//      模板组 ≥2 KP 仅 watch（小数字域自然撞车噪声，如 2-KP 组占九成），
//      ≥10 KP 升 alert（超过精确组历史最大扇出 9 = 数字归一后仍广泛共模板，
//      模板签名缺失强信号）。阈值依据见 REUSE_THRESHOLDS 注释。
//
//   P2 概念回指差分（基线 §7「解释必须引用目标 KP 核心概念/运算」静态化）——
//      由 KP 名称机械提取概念词（长词优先、正查命中），同 KP 内差分判定：
//      有题回指、有题不回指 → 不回指行 FAIL（候选缺陷，须人工甄别，不得顺手修）；
//      全 KP 零回指或名称无内容词 → UNVERIFIED（描述性名称无信号，不判错）。
//
//   P3 Apply 非数值答案结构化分类（P42-025 工具缺口）——
//      数值/分数/百分数/占位指令/定义复述等机械分类计数，不做真伪判定
//      （基线 §3 已定性「规范，非缺陷」；显式占位行对应 P42-024 待人工）。
//
// 纪律对齐（P42-1C 先例）：
//   - 处理不了记 UNVERIFIED 不判错，不猜测填充；
//   - 功能词表属审计工具解析知识（同 truth-verifier 的记法规则），非生产语义表，
//     不内联进 shared/，不参与生成/校验决策；
//   - FAIL = 候选（需甄别），非最终裁决。

// ---- 功能词表（机械剥离，仅审计层） ----
// 教学功能性词汇：出现在 KP 名称中不构成「题目须回指」的内容信号。
var FUNCTION_WORDS = [
  '解决问题', '综合运用', '整理和复习', '整理', '复习', '综合', '本册', '知识',
  '认识', '初识', '初步', '简单', '实际', '生活', '应用', '运用', '解决', '问题',
  '计算', '口算', '估算', '竖式', '掌握', '理解', '探索', '发现', '规律发现',
  '方法', '策略', '练习', '读写', '模型', '单元', '换算'
];
// 名称分隔符：顿号/逗号/括号/连字/与/和/及/的/、
var NAME_SPLIT_RE = /[、，,（）()\-—－\s与和及的]+/;

// 元词逃逸（UNVERIFIED 纪律）：活动/类目描述词——题目以实例层面本质参与时，
// 字面回指本就不该要求；静态文本匹配不可判定实例↔类目从属，一律不计信号、不判候选。
var META_TOKENS = [
  '分类', '度量', '适用场景', '场景', '拼图游戏', '拼图', '设计图案', '观察正方体',
  '从不同角度观察立体图形', '根据平面视图搭建立体图形', '在方格纸上画旋转图形',
  '平均分', '周期', '规律', '编码规则', '平面图形', '立体图形', '单位', '从小到大',
  '大小比较', '关系', '含义', '意义', '读法', '写法', '地图上', '方向', '位置',
  '选择合适', '选学'
];

// 记法/符号映射（审计解析知识）：概念词的「实例形态」——题面含对应记法即本质参与。
//   四则运算名 → 运算符号；数概念 → 数记法；度量族 → 族内单位词。
var NOTATION_MAP = [
  { token: '加法', re: /[+＋]/ },
  { token: '减法', re: /[−－\-]/ },
  { token: '乘法', re: /[×＊]/ },
  { token: '除法', re: /[÷／]/ },
  { token: '小数', re: /\d\.\d/ },
  { token: '分数', re: /\d+\/\d+/ },
  { token: '百分数', re: /%/ },
  { token: '人民币', re: /(元|角|分)/ },
  { token: '长度单位', re: /(毫米|厘米|米|千米)/ },
  { token: '质量单位', re: /(克|千克|吨)/ },
  { token: '时间单位', re: /(时|分|秒)/ }
];

/** KP 名称 → 概念词数组（机械剥离功能词后 ≥2 字段；空数组 = 名称无信号）
 * 保守口径（UNVERIFIED 纪律）：单字概念词（米/元/角/分/时/秒…）一律丢弃——
 * 单字正查命中噪声大（数/形/点/线等泛字）；含数字碎片（11/20数/5以内）丢弃。 */
function extractNameTokens(name) {
  if (!name || typeof name !== 'string') return [];
  var segs = name.split(NAME_SPLIT_RE);
  var out = [];
  segs.forEach(function (seg) {
    var s = String(seg);
    FUNCTION_WORDS.forEach(function (w) { s = s.split(w).join(''); });
    // 尾随单运算字剥离（「小数加、减法」→「小数」+「减法」）：碎片词转记法映射可判
    if (/[加减乘除]$/.test(s) && s.length - 1 >= 2) s = s.slice(0, -1);
    // 方位/动词前后缀剥离：「四边形之间」→「四边形」、「解比例」→「比例」
    s = s.replace(/之间$/, '').replace(/^解/, '');
    s = s.trim();
    if (s.length >= 2 && !/^\d/.test(s) && out.indexOf(s) === -1) out.push(s);
  });
  return out;
}

/** 题目可检索文本（题面 + 选项 + 解析 + 结构化语义字段），只读拼接 */
function searchableText(q) {
  var d = (q && q.data) || {};
  var opts = Array.isArray(q && q.options) ? q.options.join(' ') : (q && q.options);
  return [
    q && q.prompt,
    opts,
    q && q.answer && q.answer.explanation,
    q && q.answer && q.answer.value,
    d.kind, d.template, d.shapeName, d.feature,
    d.graphic && d.graphic.type, d.graphic && d.graphic.subtype
  ].filter(Boolean).join(' ');
}

/** 概念词命中：字面回指，或经记法/符号映射（NOTATION_MAP）命中实例形态 */
function tokenHitOne(token, text) {
  if (text.indexOf(token) !== -1) return true;
  for (var i = 0; i < NOTATION_MAP.length; i++) {
    if (NOTATION_MAP[i].token === token && NOTATION_MAP[i].re.test(text)) return true;
  }
  return false;
}

/** P2 单行回指判定：返回命中的概念词（空数组 = 本行零回指）；META 词（含含 META 子串的活动描述）不计 */
function tokenHits(tokens, q) {
  var text = searchableText(q);
  return tokens.filter(function (t) {
    for (var i = 0; i < META_TOKENS.length; i++) {
      if (t.indexOf(META_TOKENS[i]) !== -1) return false;
    }
    return tokenHitOne(t, text);
  });
}

/**
 * P2 差分判定（按 KP 聚合）：
 * rows: [{ rowId, q }]（同 KP 的全部产出行）
 * 返回 { status: 'PASS'|'UNVERIFIED', tokens, missingRows, reason }
 *   UNVERIFIED — 名称无内容词（tokens 空）或全 KP 零回指（描述性名称）
 *   PASS       — 全行回指，或差分出 FAIL 行（missingRows 非空，status 仍 PASS 但携带候选）
 *   missingRows 非空时以 missingCount>0 表达「存在候选」，不并入 status（甄别前非定论）
 */
function differentialCheck(rows, kpName) {
  var tokens = extractNameTokens(kpName);
  if (!tokens.length) {
    return { status: 'UNVERIFIED', tokens: tokens, missingRows: [], reason: 'name-no-signal' };
  }
  var missingRows = [];
  var anyHit = false;
  rows.forEach(function (r) {
    var hits = tokenHits(tokens, r.q);
    if (hits.length) anyHit = true;
    else missingRows.push({ rowId: r.rowId, tokens: tokens });
  });
  if (!anyHit) {
    return { status: 'UNVERIFIED', tokens: tokens, missingRows: [], reason: 'no-token-any-row' };
  }
  return { status: 'PASS', tokens: tokens, missingRows: missingRows, missingCount: missingRows.length, reason: null };
}

// ---- P1 归一化 ----

/** 数字序列归一（含全角数字）：供模板级复用分组 */
function normalizeTemplate(prompt) {
  return String(prompt || '')
    .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeExact(prompt) {
  return String(prompt || '').replace(/\s+/g, ' ').trim();
}

// P1 分级阈值（P42-3 阈值治理，具名常量；面实测依据见注释）：
//   EXACT   = 2 —— 精确同字面跨 KP 本身即需关注（基线 §3 口径），面稳态 62 组；
//   TEMPLATE= 10 —— 数字归一模板组 ≥2 仅 watch（面实测 178 组中 2-KP 组 91 个、
//                    3~9 KP 组多为小数字域自然撞车，告警无行动意义）；
//                    ≥10 升 alert（精确组历史最大扇出 9，归一后仍跨 ≥10 KP =
//                    超出任何同字面共享，模板签名缺失强信号；面实测 14 组）。
var REUSE_THRESHOLDS = {
  EXACT_ALERT_MIN_KP: 2,
  TEMPLATE_ALERT_MIN_KP: 10
};

/**
 * P1 分组指标：rows: [{ rowId, kp, grade, qt, prompt }]
 * 返回 { exact, template }，各为 { groups, alerts, watch }：
 *   组结构 { key, kps[], grades[], rows[], alert, watch }；
 *   alerts = 跨 KP 数 ≥ alertMin（行动级）；watch = ≥2 但 < alertMin（记录级，
 *   仅模板组产生——精确组 alertMin=2 时 watch 恒空）。
 */
function reuseMetrics(rows) {
  function group(keyFn, alertMin) {
    var map = {};
    rows.forEach(function (r) {
      var key = keyFn(r.prompt);
      if (!key) return;
      (map[key] = map[key] || { key: key, kps: [], grades: {}, rows: [] });
      if (map[key].kps.indexOf(r.kp) === -1) map[key].kps.push(r.kp);
      map[key].grades[r.grade] = true;
      map[key].rows.push(r.rowId);
    });
    var groups = Object.keys(map).map(function (k) {
      var g = map[k];
      g.grades = Object.keys(g.grades).map(Number);
      g.alert = g.kps.length >= alertMin;
      g.watch = !g.alert && g.kps.length >= 2;
      return g;
    });
    return {
      groups: groups,
      alerts: groups.filter(function (g) { return g.alert; }),
      watch: groups.filter(function (g) { return g.watch; })
    };
  }
  return {
    exact: group(normalizeExact, REUSE_THRESHOLDS.EXACT_ALERT_MIN_KP),
    template: group(normalizeTemplate, REUSE_THRESHOLDS.TEMPLATE_ALERT_MIN_KP)
  };
}

// ---- P3 apply 答案结构化分类 ----

/** 答案形态分类：numeric/fraction/percent/placeholder/definition/short-text/text */
function classifyApplyAnswer(value) {
  var v = String(value == null ? '' : value).trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'numeric';
  if (/^-?\d+\/\d+$/.test(v)) return 'fraction';
  if (/^-?\d+(\.\d+)?%$/.test(v)) return 'percent';
  if (/举例|合理即可|答案不唯一|不唯一|如：|如:/.test(v)) return 'placeholder';
  if (/叫做|定义为|特征|定义|意义/.test(v)) return 'definition';
  return v.length <= 6 ? 'short-text' : 'text';
}

/**
 * P3 面分类：rows: [{ rowId, kp, qt, answerValue }]（qt==='apply' 的行）
 * 返回 { counts, byClass }；仅统计，不做真伪判定（025 定性：规范非缺陷）。
 */
function classifyApplyFace(rows) {
  var counts = {}, byClass = {};
  rows.forEach(function (r) {
    var c = classifyApplyAnswer(r.answerValue);
    counts[c] = (counts[c] || 0) + 1;
    (byClass[c] = byClass[c] || []).push({ rowId: r.rowId, kp: r.kp, value: String(r.answerValue).slice(0, 40) });
  });
  return { counts: counts, byClass: byClass };
}

module.exports = {
  FUNCTION_WORDS: FUNCTION_WORDS,
  META_TOKENS: META_TOKENS,
  NOTATION_MAP: NOTATION_MAP,
  extractNameTokens: extractNameTokens,
  searchableText: searchableText,
  tokenHitOne: tokenHitOne,
  tokenHits: tokenHits,
  differentialCheck: differentialCheck,
  normalizeTemplate: normalizeTemplate,
  normalizeExact: normalizeExact,
  reuseMetrics: reuseMetrics,
  classifyApplyAnswer: classifyApplyAnswer,
  classifyApplyFace: classifyApplyFace
};
