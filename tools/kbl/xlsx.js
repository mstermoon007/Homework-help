'use strict';
/**
 * tools/kbl/xlsx.js — 零依赖 .xlsx 读写工具（Node 内置 zlib；Node ≥ 20.15 需 zlib.crc32）
 *
 * 仅覆盖本项目自产/受控 Excel 的结构：
 *   - 写入：zip(store) 容器 + [Content_Types].xml + _rels/.rels +
 *           xl/workbook.xml + xl/_rels/workbook.xml.rels +
 *           xl/sharedStrings.xml + xl/worksheets/sheetN.xml
 *   - 读取：顺序扫描 Local File Header，inflateRaw，供 workbook/rels/sharedStrings/sheet 解析
 *
 * 单元格类型：文本 → shared string（t="s"）；数字 → 原生（t="n"）。
 */
var zlib = require('zlib');
var CRC32 = zlib.crc32;

// ============ ZIP 写入 ============
function storeEntry(name, data) {
  var buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  var header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);      // PK\x03\x04
  header.writeUInt16LE(20, 4);             // version needed
  header.writeUInt16LE(0, 6);              // flags
  header.writeUInt16LE(0, 8);              // method 0 = store
  header.writeUInt16LE(0, 10);             // mod time
  header.writeUInt16LE(0x21, 12);          // mod date 2020-01-01
  header.writeUInt32LE(CRC32(buf), 14);
  header.writeUInt32LE(buf.length, 18);
  header.writeUInt32LE(buf.length, 22);
  var nameBuf = Buffer.from(name, 'utf8');
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  var offset = 0;
  var out = Buffer.concat([header, nameBuf, buf]);
  var central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);    // PK\x01\x02
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(CRC32(buf), 16);
  central.writeUInt32LE(buf.length, 20);
  central.writeUInt32LE(buf.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
central.writeUInt32LE(0, 38);            // external attrs
  central.writeUInt32LE(0, 42);            // 偏移在 writeZip 内修正
  var centralBuf = Buffer.concat([central, nameBuf]);
  return { local: out, central: centralBuf, size: buf.length + nameBuf.length + 30 };
}

function writeZip(files) {
  // files: [{name, data}]
  var locals = []; var centrals = []; var offset = 0;
  files.forEach(function (f) {
    var e = storeEntry(f.name, f.data);
    e.central.writeUInt32LE(offset, 42);   // 实际 Local Header 起始偏移
    locals.push(e.local);
    centrals.push(e.central);
    offset += e.local.length;
  });
  var centralStart = offset;
  var centralSize = centrals.reduce(function (n, c) { return n + c.length; }, 0);
  var eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // PK\x05\x06
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat(locals.concat(centrals, [eocd]));
}

// ============ ZIP 读取 ============
function readZip(buf) {
  var files = {};
  for (var i = 0; i + 30 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    var nameLen = buf.readUInt16LE(i + 26);
    var extraLen = buf.readUInt16LE(i + 28);
    var name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    var dataStart = i + 30 + nameLen + extraLen;
    var method = buf.readUInt16LE(i + 8);
    var usize = buf.readUInt32LE(i + 22);
    var csize = buf.readUInt32LE(i + 18);
    var comp = buf.slice(dataStart, dataStart + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(comp) : comp;
    i = dataStart + csize - 1;
  }
  return files;
}

// ============ Excel 写 ============
function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function unesc(s) {
  return String(s).replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function xmlHeader() { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'; }

function buildSheetXml(rows, strings) {
  // rows: array of rows; each row = array of {v: value(null=empty), t:'s'|'n'|'inline'}
  var out = [xmlHeader(), '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
  rows.forEach(function (row, r) {
    out.push('<row r="' + (r + 1) + '">');
    row.forEach(function (cell, c) {
      if (cell == null || cell.v === null || cell.v === undefined || cell.v === '') return;
      var ref = colName(c) + (r + 1);
      var v = cell.v, t = cell.t || 's';
      if (t === 's') {
        if (typeof strings[v] === 'undefined') throw new Error('工作表引用缺失共享串: ' + v);
        out.push('<c r="' + ref + '" t="s"><v>' + v + '</v></c>');
      } else if (t === 'inline') {
        out.push('<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + escXml(v) + '</t></is></c>');
      } else {
        out.push('<c r="' + ref + '" t="n"><v>' + v + '</v></c>');
      }
    });
    out.push('</row>');
  });
  out.push('</sheetData></worksheet>');
  return out.join('');
}
function colName(c) {
  var s = '';
  c = c + 1;
  while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

/**
 * writeXlsx(sheets, outPath)
 *   sheets: [{name, rows}]  rows: 每行数组，元素 {v, t}（t 缺省 's' 文本；t='n' 数字；t='inline' 原样文本）
 */
function writeXlsx(sheets, outPath) {
  var strings = [];
  var strIndex = {};
  function idx(val) {
    var s = String(val);
    if (typeof strIndex[s] === 'undefined') { strIndex[s] = strings.length; strings.push(s); }
    return strIndex[s];
  }
  // 预收集所有文本，避免 sheet 复用冲突
  sheets.forEach(function (sheet) {
    sheet.rows.forEach(function (row) {
      row.forEach(function (cell) {
        if (cell && (cell.t === 's' || (!cell.t && typeof cell.v !== 'number'))) idx(cell.v);
      });
    });
  });

  var sheetXmls = sheets.map(function (sheet) {
    var rows = sheet.rows.map(function (row) {
      return row.map(function (cell) {
        if (cell == null || cell.v === null || cell.v === undefined) return null;
        var isNum = cell.t === 'n' || (typeof cell.v === 'number' && cell.t !== 'inline');
        if (isNum) return { v: cell.v, t: 'n' };
        if (cell.t === 'inline') return { v: cell.v, t: 'inline' };
        return { v: idx(cell.v), t: 's' };
      });
    });
    return buildSheetXml(rows, strings);
  });

  var files = [];
  files.push({ name: '[Content_Types].xml', data: xmlHeader() + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
    '</Types>' });
  files.push({ name: '_rels/.rels', data: xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
  files.push({ name: 'xl/workbook.xml', data: xmlHeader() + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map(function (s, i) { return '<sheet name="' + escXml(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
    '</Relationships>' });
  var sst = xmlHeader() + '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">' +
    strings.map(function (s) { return '<si><t xml:space="preserve">' + escXml(s) + '</t></si>'; }).join('') + '</sst>';
  files.push({ name: 'xl/sharedStrings.xml', data: sst });
  sheetXmls.forEach(function (xml, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: xml }); });

  var fs = require('fs');
  require('path');
  fs.writeFileSync(outPath, writeZip(files));
}

// ============ Excel 读 ============
function readXlsx(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  var files = readZip(buf);
  function xml(name) { var b = files[name]; if (!b) throw new Error('缺包内文件: ' + name); return b.toString('utf8'); }

  var workbook = xml('xl/workbook.xml');
  var rels = xml('xl/_rels/workbook.xml.rels');
  var sheetRid = {};
  var reSheet = /<sheet[^>]*name="([^"]*)"[^>]*r:id="rId(\d+)"/g;
  var m;
  while ((m = reSheet.exec(workbook))) sheetRid[m[1]] = 'rId' + m[2];
  var ridTarget = {};
  var reRel = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  while ((m = reRel.exec(rels))) ridTarget[m[1]] = m[2];

  var shared = [];
  var sstXml = files['xl/sharedStrings.xml'] ? xml('xl/sharedStrings.xml') : '<sst/>';
  var reSi = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  while ((m = reSi.exec(sstXml))) {
    var inner = m[1];
    // 剔除拼音注音块（WPS/Excel 中文输入回存），再剥标签保留文本；空串目（<t/>、<si/>）→ ''
    var txt = inner
      .replace(/<rPh[\s\S]*?<\/rPh>/g, '')
      .replace(/<[^>]+>/g, '');
    shared.push(unesc(txt));
  }

  var sheets = [];
  var names = Object.keys(sheetRid);
  names.forEach(function (sheetName) {
    var target = (ridTarget[sheetRid[sheetName]] || '').replace(/^\//, '');
    var pathNorm = target.indexOf('xl/') === 0 ? target : ('xl/' + target);
    var sheetXml = xml(pathNorm);
    var rows = [];
    var reRow = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    var rm;
    while ((rm = reRow.exec(sheetXml))) {
      var cells = [];
      var rowInner = rm[2];
      var reC = /<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g;
      var cm;
      while ((cm = reC.exec(rowInner))) {
        var col = colToIdx(cm[1]);
        var attrs = cm[2] || '';
        var t = /t="([^"]+)"/.exec(attrs);
        var tval = t ? t[1] : '';
        var inner = cm[3] || '';
        var v = null;
        if (tval === 's') {
          var mSv = /<v>([\s\S]*?)<\/v>/.exec(inner);
          v = mSv ? shared[Number(mSv[1])] : null;
        } else if (tval === 'inlineStr') {
          var mIv = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
          v = mIv ? unesc(mIv[1]) : '';
        } else if (tval === 'n') {
          var mNv = /<v>([\s\S]*?)<\/v>/.exec(inner);
          v = mNv ? Number(mNv[1]) : null;
        } else {
          var mSv2 = /<v>([\s\S]*?)<\/v>/.exec(inner);
          v = mSv2 ? unesc(mSv2[1]) : null;
        }
        cells[col] = v;
      }
      rows.push(cells);
    }
    sheets.push({ name: sheetName, rows: rows });
  });
  // 按 workbook 声明顺序（zip 顺序不可靠）
  return { sheets: sheets, files: Object.keys(files) };
}
function colToIdx(col) {
  var n = 0;
  for (var i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

// ============ 表辅助 ============
function sheetToTable(sheet) {
  // 首行表头 → {headers, data: [{header: value}]}；空行剔除；O/○/空白 → null
  var data = sheet.rows;
  if (!data.length) return { headers: [], data: [] };
  var headers = (data[0] || []).filter(function (h, i) { return h !== null && h !== undefined; });
  var hIdx = [];
  (data[0] || []).forEach(function (h, i) { if (h !== null && h !== undefined) hIdx[i] = String(h).trim(); });
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r] || [];
    var obj = {};
    var any = false;
    for (var c = 0; c < row.length; c++) {
      var header = hIdx[c];
      if (header === undefined) continue;
      var v = row[c];
      var norm;
      if (typeof v === 'number') {
        norm = v;
      } else {
        var s = v === null || v === undefined ? '' : String(v).trim();
        if (s === '' || s === 'O' || s === 'o' || s === '○') norm = null;
        else norm = s;
      }
      if (norm !== null) any = true;
      obj[header] = norm;
    }
    if (any) out.push(obj);
  }
  return { headers: headers, data: out };
}

module.exports = { writeXlsx: writeXlsx, readXlsx: readXlsx, sheetToTable: sheetToTable, colToIdx: colToIdx };