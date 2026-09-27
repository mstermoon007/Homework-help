'use strict';

/**
 * tests/presentation/select-page-contract.test.js
 *
 * 二级选择页 select.html 的 UI 改造契约测试（P28-UI-SELECT-LAYOUT-01~17）。
 * 项目无 jsdom/DOM 测试栈，沿用 tests/presentation 既有方式：读取真实源文件，
 * 对稳定 ID、语义类名、CSS 规则与内联 JS 关键逻辑做契约断言（锚定语义而非行号）。
 * 交互行为由 dev/e2e/browser-e2e.js 真实浏览器链路兜底，本文件只锁结构与回归。
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE_PATH = path.join(ROOT, 'select.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SW_PATH = path.join(ROOT, 'sw.js');

const html = fs.readFileSync(PAGE_PATH, 'utf8');
const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
const sw = fs.readFileSync(SW_PATH, 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1] : '';
// 仅收集无 src 的内联脚本块
const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
  .map(function (m) { return m[1]; });
const js = scripts.join('\n');

function rangeSection() {
  const m = html.match(/<section[^>]*config-range[\s\S]*?<\/section>/);
  return m ? m[0] : '';
}

describe('select.html 页面接入', () => {
  test('页面文件存在且标题正确', () => {
    assert.ok(fs.existsSync(PAGE_PATH), 'select.html 必须存在');
    assert.match(html, /<title>选择练习 · 小学练习本<\/title>/);
  });

  test('canonical 指向正式域（sitemap 冻结门禁依赖）', () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/home\.modouyu\.top\/select\.html">/);
  });

  test('sitemap 与 SW 预缓存均已收录', () => {
    assert.ok(sitemap.indexOf('<loc>https://home.modouyu.top/select.html</loc>') !== -1, 'sitemap 必须收录');
    assert.match(sw, /'select\.html'/, 'SW CORE 预缓存必须收录');
  });
});

describe('LAYOUT-06/10/16：已删除元素不回归', () => {
  test('练习参数下拉（题量/难度）DOM 不存在', () => {
    assert.doesNotMatch(html, /id="countSelect"/);
    assert.doesNotMatch(html, /id="difficultySelect"/);
    assert.doesNotMatch(html, /config-params/);
  });

  test('卡片上方模式提示行已移除', () => {
    assert.doesNotMatch(html, /id="modeDesc"/);
    assert.doesNotMatch(css, /\.mode-desc\b/);
  });

  test('顶部导航栏已移除', () => {
    assert.doesNotMatch(html, /class="top-nav"/);
  });

  test('不包含深色模式媒体块（保持主页浅色风格）', () => {
    assert.doesNotMatch(css, /prefers-color-scheme\s*:\s*dark/);
  });
});

describe('LAYOUT-01/07/11/12：布局与摘要侧栏', () => {
  test('关键元素 ID 齐全', () => {
    [
      'gradeSelect', 'subjectSelect', 'modeSelect',
      'bookSegQuick', 'bookSegTeacher', 'bookWrapQuick', 'bookWrapTeacher',
      'typeGridQuick', 'unitGridQuick',
      'teacherTypeGrid', 'teacherUnitGrid', 'teacherKpGrid',
      'compModuleGrid',
      'startBtnQuick', 'startBtnTeacher', 'startBtnCompetition',
      'summaryBody', 'modeSwitchHint', 'subjectNotice'
    ].forEach(function (id) {
      assert.ok(html.indexOf('id="' + id + '"') !== -1, '缺少 #' + id);
    });
  });

  test('摘要栏位于配置列左侧（DOM 顺序）', () => {
    const iSummary = html.indexOf('class="sel-block config-summary"');
    const iColumn = html.indexOf('class="config-column"');
    assert.ok(iSummary !== -1 && iColumn !== -1);
    assert.ok(iSummary < iColumn, '摘要 aside 必须在配置列之前（左栏）');
  });

  test('摘要栏内含三个模式的开始按钮与主页入口', () => {
    const aside = html.match(/<aside[^>]*config-summary[\s\S]*?<\/aside>/);
    assert.ok(aside, '摘要 aside 存在');
    const body = aside[0];
    ['startBtnQuick', 'startBtnTeacher', 'startBtnCompetition'].forEach(function (id) {
      assert.ok(body.indexOf(id) !== -1, '摘要栏必须含 #' + id);
    });
    assert.match(body, /class="home-link" href="index\.html"/);
  });
});

describe('LAYOUT-17：固定顺序 + 其余自由', () => {
  test('范围卡顺序固定为 年级 → 科目 → 模式 → 册别', () => {
    const sec = rangeSection();
    assert.ok(sec, '范围卡 section 存在');
    const iGrade = sec.indexOf('for="gradeSelect"');
    const iSubject = sec.indexOf('for="subjectSelect"');
    const iMode = sec.indexOf('for="modeSelect"');
    const iBook = sec.indexOf('id="bookWrapQuick"');
    [iGrade, iSubject, iMode, iBook].forEach(function (i) { assert.ok(i !== -1); });
    assert.ok(iGrade < iSubject && iSubject < iMode && iMode < iBook,
      '实际顺序必须为 年级→科目→模式→册别');
  });

  test('册别快速/教师两套控件均在范围卡内', () => {
    const sec = rangeSection();
    assert.ok(sec.indexOf('bookWrapQuick') !== -1);
    assert.ok(sec.indexOf('bookWrapTeacher') !== -1);
  });

  test('hero 副文案为不限先后顺序的自由选择说明', () => {
    assert.match(html, /不限先后顺序/);
  });

  test('教师模式知识点默认全展平（未选单元时 renderBuckets 取全量 buckets）', () => {
    assert.match(js, /var renderBuckets\s*=\s*selectedUnits\.length\s*\?\s*selectedUnits\s*:\s*buckets/);
  });

  test('题型计数直接基于已选知识点（不依赖单元聚焦）', () => {
    assert.match(js, /selectedKps\s*=\s*state\.teacherKps\.map/);
  });

  test('取消单元聚焦不级联清空已选知识点', () => {
    const start = js.indexOf('teacherUnitGrid.addEventListener');
    assert.ok(start !== -1);
    const end = js.indexOf('renderTeacherTypeGrid();', start);
    assert.ok(end !== -1);
    const handler = js.slice(start, end);
    assert.doesNotMatch(handler, /teacherKps\.splice/, '单元点击处理不得清除已选 KP');
  });

  test('模式切换提示为 inline 轻提示，不使用 confirm 弹窗', () => {
    assert.match(js, /getElementById\('modeSwitchHint'\)/);
    assert.doesNotMatch(js, /\bconfirm\s*\(/, '产品承诺无弹窗');
  });
});

describe('LAYOUT-04/12/13/14：题型、单元、知识点样式契约', () => {
  test('快速与教师题型网格共用同一套单行等列规则', () => {
    assert.match(css, /#typeGridQuick\s*,\s*#teacherTypeGrid/);
  });

  test('快速模式单元为三列网格（≥768px）', () => {
    const m = css.match(/#unitGridQuick\s*\{([\s\S]*?)\}/);
    assert.ok(m, '存在 #unitGridQuick 规则');
    assert.match(m[1], /repeat\(\s*3\s*,\s*minmax\(0,\s*1fr\)\s*\)/);
  });

  test('教师知识点胶囊后的题型标签隐藏', () => {
    assert.match(css, /\.kp-chip\s+\.kp-hint\s*\{[^}]*display:\s*none/);
  });
});

describe('BUG-01：跨册同名单元必须按复合 key 精确区分', () => {
  test('存在 unitKey/unitNameOf 复合标识辅助函数', () => {
    assert.match(js, /function unitKey\(book, unit\)/);
    assert.match(js, /function unitNameOf\(key\)/);
  });

  test('unitBuckets 输出 key 字段，且内部分桶使用复合 key', () => {
    assert.match(js, /key:\s*key,\s*kps:\s*\[\]/);
  });

  test('单元卡 data-unit 绑定的是 bkt.key 而非单元名', () => {
    assert.match(js, /data-unit="' \+ esc\(bkt\.key\) \+ '"/);
    assert.doesNotMatch(js, /data-unit="' \+ esc\(bkt\.unit\) \+ '"/);
  });

  test('快速模式候选池与 collectKps 均按 unitKey(k.book, k.unit) 匹配（不少于 2 处）', () => {
    const occurrences = js.match(/state\.quickUnits\.indexOf\(unitKey\(k\.book \|\| 'all', k\.unit\)\)/g) || [];
    assert.ok(occurrences.length >= 2, 'renderQuick 与 collectKps 两处都必须按复合 key 过滤');
  });

  test('教师模式聚焦/展示池按 bkt.key 匹配，不残留 bkt.unit 名称匹配', () => {
    assert.match(js, /state\.teacherUnits\.indexOf\(bkt\.key\)/);
    assert.doesNotMatch(js, /state\.teacherUnits\.indexOf\(bkt\.unit\)/);
    assert.doesNotMatch(js, /state\.quickUnits\.indexOf\(k\.unit\)/);
    assert.doesNotMatch(js, /state\.quickUnits\.indexOf\(bkt\.unit\)/);
  });

  test('不限册别时单元卡角标带册别，用于区分跨册同名单元', () => {
    assert.match(js, /state\.quickBook === 'all' && UNIT_BOOK_LABEL\[bkt\.book\]/);
  });

  test('摘要栏单元行由复合 key 映射回名称，不直接展示 key', () => {
    assert.match(js, /var label = unitNameOf\(key\)/);
    assert.doesNotMatch(js, /units\.map\(esc\)\.join/);
  });

  test('传给生成请求的 unit 参数为单元中文名数组（保持下游历史口径）', () => {
    assert.match(js, /state\.quickUnits\.map\(unitNameOf\)/);
  });
});

describe('LAYOUT-06 兜底：生成参数默认值', () => {
  test('题量/难度下拉缺失时回退 20 / normal（生成链不变）', () => {
    assert.match(js, /var count = countSel \? Number\(countSel\.value\) : 20;/);
    assert.match(js, /var difficulty = diffSel \? diffSel\.value : 'normal';/);
  });

  test('MODE_DESC 仅保留模式标题，不再含步骤描述', () => {
    const start = js.indexOf('var MODE_DESC');
    assert.ok(start !== -1);
    const block = js.slice(start, js.indexOf('};', start));
    assert.doesNotMatch(block, /\bdesc\b/);
    ['quick', 'teacher', 'competition'].forEach(function (m) {
      assert.ok(block.indexOf(m) !== -1);
    });
  });
});

describe('安全基线', () => {
  test('保留 esc() HTML 转义函数（动态文本注入边界）', () => {
    assert.match(js, /function esc\(s\)/);
  });
});
