/**
 * KBL Source Extractor（P16-02/03/04）
 *
 * 唯一职责：只读读取 Source Excel → 标准化 Raw Record。
 * 职责边界：不承担 Generation / POL / UI / Generator 职责。
 *
 * 只读约束：本工具仅 READ/PARSE/VALIDATE/EXTRACT/HASH；绝不写回 root/*.xlsx。
 * 确定性约束（P28-05）：fingerprint 仅含内容指纹（sha256 + 字节数），不含埋时/环境字段；
 *   同一 Excel 重复运行产出 byte 级一致的 extract-raw.json（SHA256 完全一致）。
 *
 * 输出：kbl/import/extract-raw.json
 * 结构：{ schemaVersion, source, fingerprint, errors, unit, course, knowledge, stats }
 */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { readXlsx, sheetToTable } = require('./xlsx.js');

var ROOT = path.join(__dirname, '..', '..');
var SOURCE_FILE = path.join(ROOT, 'kbl', 'root', '小学G1-G6数学知识点.xlsx');
var OUT_FILE = path.join(ROOT, 'kbl', 'import', 'extract-raw.json');
var EXPECTED_SHEET = 0; // Sheet1

// ---------- 字段映射（P16-03 唯一映射表，禁止散落 row[n]） ----------
var FIELD_MAP = {
  年级: 'grade',
  版本: 'edition',
  册: 'book',
  数学分类: 'domain',
  单元: 'unitNo',
  单元名称: 'unitName',
  知识点: 'knowledgeName',
  知识点释义: 'definition'
};

// 派生字段（P16-03）：由程序产生，不反向写回 Excel
var DERIVED_FIELDS = [
  'canonicalId', 'unitId', 'knowledgeNo', 'unitOrdinal', 'status',
  'gradeNorm', 'sourceRow', 'domainNorm'
];

// ---------- 归一辅助 ----------
/* Excel 富文本互通标记（phoneticPr）清洗：属解析职责，非改源数据 */
function stripXmlInterop(s) {
  return String(s == null ? '' : s)
    .replace(/<phoneticPr[^>]*\/>/g, '')
    .replace(/<[a-zA-Z]+\s+[^>]*\/>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normGrade(v) {
  var s = stripXmlInterop(v);
  var m = /g(\d)/i.exec(s);
  return m ? ('g' + m[1]) : null;
}

function normBook(v) {
  var s = stripXmlInterop(v).toLowerCase();
  if (s === 'up' || s === '上册' || s === '上') return 'up';
  if (s === 'down' || s === '下册' || s === '下') return 'down';
  return s || null;
}

function normEdition(v) {
  var s = stripXmlInterop(v).replace(/版/g, '');
  return s || null;
}

function normDomain(v) {
  var s = stripXmlInterop(v);
  var m = { '数与代数': 'algebra', '图形与几何': 'geometry', '统计与概率': 'statistics', '综合与实践': 'practice' };
  return m[s] || s || null;
}

// ---------- 错误码（P16-02） ----------
var ERRORS = {
  SOURCE_001: 'Sheet Missing：缺少 Sheet1 或不可读',
  SOURCE_002: 'Required Header Missing：缺少必需表头（年级/册/单元/单元名称/知识点）',
  SOURCE_003: 'Invalid Grade：年级非法（须 g1-g6）',
  SOURCE_004: 'Empty Knowledge Name：知识点名称为空',
  SOURCE_005: 'Duplicate Row：年级+册+单元+知识点 重复'
};

// ---------- Extractor 主流程 ----------
function extract() {
  var errors = [];
  var warnings = [];

  if (!fs.existsSync(SOURCE_FILE)) {
    return { ok: false, errors: [{ code: 'SOURCE_001', message: '源文件不存在: ' + SOURCE_FILE }] };
  }

  var wb;
  try { wb = readXlsx(fs.readFileSync(SOURCE_FILE)); }
  catch (e) { return { ok: false, errors: [{ code: 'SOURCE_001', message: 'Workbook 无法打开: ' + e.message }] }; }

  if (!wb.sheets || !wb.sheets[EXPECTED_SHEET]) {
    return { ok: false, errors: [{ code: 'SOURCE_001', message: ERRORS.SOURCE_001 }] };
  }
  var sheet = wb.sheets[EXPECTED_SHEET];
  var table = sheetToTable(sheet);

  // 1) 表头识别（去 XML 互通噪声后）→ KBL 字段
  var rawHeaders = (table.headers || []);
  var headerClean = rawHeaders.map(stripXmlInterop);
  var headerMap = {}; // KBL.name -> source header 下标
  for (var i = 0; i < rawHeaders.length; i++) {
    var raw = rawHeaders[i];
    var clean = headerClean[i];
    var kbl = FIELD_MAP[clean];
    if (kbl) headerMap[kbl] = i;
  }
  ['grade', 'book', 'unitNo', 'unitName', 'knowledgeName'].forEach(function (req) {
    if (headerMap[req] === undefined) errors.push({ code: 'SOURCE_002', message: ERRORS.SOURCE_002 + ': ' + req, header: req });
  });
  if (errors.length) return { ok: false, errors: errors };

  // 2) 行读取 → 标准化记录
  var data = table.data;
  var records = [];
  var seen = {};
  data.forEach(function (row, i) {
    var rec = {};
    Object.keys(FIELD_MAP).forEach(function (ch) {
      var kbl = FIELD_MAP[ch];
      if (headerMap[kbl] !== undefined) {
        var v = row[rawHeaders[headerMap[kbl]]] != null ? stripXmlInterop(row[rawHeaders[headerMap[kbl]]]) : null;
        rec[kbl] = v;
      }
    });
    rec.grade = normGrade(rec.grade);
    var grade = rec.grade;
    rec.book = normBook(rec.book);
    rec.edition = normEdition(rec.edition);
    rec.domainNorm = normDomain(rec.domain);
    rec.sourceRow = i + 2; // 行号自 2 起（1 为表头），供链路溯源

    // SOURCE-003
    if (!grade || !/^g[1-6]$/.test(grade)) {
      errors.push({ code: 'SOURCE_003', message: ERRORS.SOURCE_003 + ': ' + grade + ' @row ' + rec.sourceRow, row: rec.sourceRow });
      return;
    }
    // SOURCE-004
    if (!rec.knowledgeName) {
      errors.push({ code: 'SOURCE_004', message: ERRORS.SOURCE_004 + ' @row ' + rec.sourceRow, row: rec.sourceRow });
      return;
    }
    var uNo = stripXmlInterop(row[rawHeaders[headerMap.unitNo]]);
    rec.unitNoRaw = uNo; // 保留 Excel 原文
    rec.unitName = rec.unitName || ('单元 ' + uNo);

    // SOURCE-005
    var dupKey = [grade, rec.book, uNo, rec.knowledgeName].join('|');
    if (seen[dupKey] !== undefined) {
      errors.push({ code: 'SOURCE_005', message: ERRORS.SOURCE_005 + ': ' + dupKey + ' @row ' + rec.sourceRow, row: rec.sourceRow, firstRow: seen[dupKey] });
      return;
    }
    seen[dupKey] = rec.sourceRow;
    records.push(rec);
  });

  if (errors.length) return { ok: false, errors: errors };

  // 3) 分级派生：course / unit / knowledge（P16-04）
  //  unitId = math-g{grade}-{book}-u{nn}（u{nn} = 册内单元序号，由 Excel 行序派生、确定且无冲突）
  var unitOrdTable = {};   // grade|book -> 已派发单元序号
  var unitIdByKey = {};    // grade|book|unitNoRaw|unitName -> unitId
  var kCountByUnit = {};   // unitId -> knowledge 序号
  var knowledge = records.map(function (r) {
    var uk = r.grade + '|' + r.book;
    var ukey = uk + '|' + r.unitNoRaw + '|' + r.unitName;
    var unitId;
    if (unitIdByKey[ukey] === undefined) {
      if (!(uk in unitOrdTable)) unitOrdTable[uk] = 0;
      unitOrdTable[uk]++;
      unitId = 'math-' + r.grade + '-' + r.book + '-u' + pad2(unitOrdTable[uk]);
      unitIdByKey[ukey] = unitId;
    } else {
      unitId = unitIdByKey[ukey];
    }
    unitOrdTable['__unitById__'] = unitOrdTable['__unitById__'] || {};
    unitOrdTable['__unitById__'][unitId] = unitOrdTable['__unitById__'][unitId] || parseInt(unitId.slice(-2), 10);
    if (!(unitId in kCountByUnit)) kCountByUnit[unitId] = 0;
    var kIdx = ++kCountByUnit[unitId];
    var canonId = unitId + '-k' + pad3(kIdx);
    r.unitOrdinal = unitOrdTable['__unitById__'][unitId];
    r.unitId = unitId;
    r.knowledgeNo = r.unitOrdinal + '.' + kIdx;
    r.canonicalId = canonId;
    r.status = 'active'; // P16-03 derived：root 无状态列 → 教材清单条目默认 active（派生登记，非人工猜测）
    r.gradeNorm = r.grade;
    return r;
  });

  // course（Grade → Book）
  var course = [];
  var cMap = {};
  knowledge.forEach(function (r) {
    var ck = r.grade + '|' + r.book;
    if (cMap[ck] === undefined) {
      cMap[ck] = { grade: r.grade, book: r.book, unitCount: 0, knowledgeCount: 0 };
      course.push(cMap[ck]);
    }
    cMap[ck].unitCount = 0;
    cMap[ck].knowledgeCount++;
  });
  // unit 集合
  var units = [];
  var uMap = {};
  knowledge.forEach(function (r) {
    if (!uMap[r.unitId]) { uMap[r.unitId] = { unitId: r.unitId, grade: r.grade, book: r.book, unitOrdinal: r.unitOrdinal, unitNoRaw: r.unitNoRaw, unitName: r.unitName, domain: r.domainNorm, knowledgeCount: 0, status: r.status }; units.push(uMap[r.unitId]); }
    uMap[r.unitId].knowledgeCount++;
  });
  Object.keys(uMap).forEach(function (uid) {
    var cu = cMap[uMap[uid].grade + '|' + uMap[uid].book];
    if (cu) cu.unitCount++;
  });

  // 4) 指纹（P16-10 基础；P28-05 确定性：仅内容指纹，禁 generatedAt/modifiedTime 等环境字段）
  var fpr = {
    fileHash: sha256(fs.readFileSync(SOURCE_FILE)),
    fileSize: fs.statSync(SOURCE_FILE).size,
    extractVersion: 'root-v1'
  };

  var stats = {
    sourceRows: records.length,
    unitCount: units.length,
    courseCount: course.length,
    gradeDistribution: {},
    bookDistribution: {}
  };
  records.forEach(function (r) {
    stats.gradeDistribution[r.grade] = (stats.gradeDistribution[r.grade] || 0) + 1;
    stats.bookDistribution[r.book] = (stats.bookDistribution[r.book] || 0) + 1;
  });

  var out = {
    ok: true,
    errors: [],
    warnings: warnings,
    schemaVersion: '1.0.0',
    source: { file: 'kbl/root/小学G1-G6数学知识点.xlsx', readonly: true },
    fingerprint: fpr,
    course: course,
    units: units,
    knowledge: knowledge,
    stats: stats,
    idRule: { pattern: '^math-g[1-6]-(up|down)-u\\d{2}-k\\d{3}$', derived: true }
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  return out;
}

function pad2(n) { return ('00' + n).slice(-2); }
function pad3(n) { return ('000' + n).slice(-3); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

var result = extract();
if (!result.ok) {
  console.error('[KBL-EXTRACT] FAIL');
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log('[KBL-EXTRACT] OK');
console.log(JSON.stringify({ stats: result.stats, fingerprint: result.fingerprint }, null, 2));