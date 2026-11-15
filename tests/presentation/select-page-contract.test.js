'use strict';

/**
 * tests/presentation/select-page-contract.test.js
 *
 * 二级选择页 select.html 的 UI 契约测试（P46-04 三模式 home/exam/teacher）。
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

describe('P46-04：旧模式 DOM 已物理清理', () => {
  test('题量/难度下拉 DOM 不存在', () => {
    assert.doesNotMatch(html, /id="countSelect"/);
    assert.doesNotMatch(html, /id="difficultySelect"/);
    assert.doesNotMatch(html, /config-params/);
  });

  test('旧快速/竞赛 stage 与开始按钮不存在', () => {
    ['stageQuick', 'stageCompetition', 'startBtnQuick', 'startBtnTeacher', 'startBtnCompetition']
      .forEach(function (id) {
        assert.doesNotMatch(html, new RegExp('id="' + id + '"'), '旧 ID #' + id + ' 必须删除');
      });
  });

  test('JS 内无旧 quick/competition 模式分支与状态', () => {
    ['quickBook', 'quickUnits', 'quickTypes', 'competitionModules',
     'renderQuick', 'renderCompetition', 'QUICK_TYPE_DEFS'].forEach(function (sym) {
      assert.doesNotMatch(js, new RegExp('\\b' + sym + '\\b'), '旧符号 ' + sym + ' 不得残留');
    });
  });
});

describe('P46-04：三模式 DOM 与摘要结构', () => {
  test('关键元素 ID 齐全（三模式）', () => {
    [
      'gradeSelect', 'subjectSelect', 'modeSelect',
      'bookSegHome', 'bookSegExam', 'bookSegTeacher',
      'bookWrapHome', 'bookWrapExam', 'bookWrapTeacher',
      'homeKindGrid', 'homeFocusGrid', 'homeUnitGrid',
      'examTypeSeg', 'examUnitGrid',
      'teacherTypeGrid', 'teacherUnitGrid', 'teacherKpGrid',
      'startBtnPractice', 'summaryBody', 'modeSwitchHint', 'subjectNotice'
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

  test('摘要栏含唯一公共开始按钮与主页入口', () => {
    const aside = html.match(/<aside[^>]*config-summary[\s\S]*?<\/aside>/);
    assert.ok(aside, '摘要 aside 存在');
    const body = aside[0];
    assert.ok(body.indexOf('startBtnPractice') !== -1, '摘要栏必须含 #startBtnPractice');
    assert.match(body, /class="home-link" href="index\.html"/);
  });

  test('模式选项仅含 home/exam/teacher', () => {
    const sel = html.match(/<select id="modeSelect">[\s\S]*?<\/select>/);
    assert.ok(sel, 'modeSelect 存在');
    ['home', 'exam', 'teacher'].forEach(function (m) {
      assert.match(sel[0], new RegExp('value="' + m + '"'), '必须含 ' + m);
    });
    assert.doesNotMatch(sel[0], /value="quick"/);
    assert.doesNotMatch(sel[0], /value="competition"/);
  });
});

describe('P46-04：范围卡顺序与册别控件', () => {
  test('范围卡顺序固定为 年级 → 科目 → 模式 → 册别', () => {
    const sec = rangeSection();
    assert.ok(sec, '范围卡 section 存在');
    const iGrade = sec.indexOf('for="gradeSelect"');
    const iSubject = sec.indexOf('for="subjectSelect"');
    const iMode = sec.indexOf('for="modeSelect"');
    const iBook = sec.indexOf('id="bookWrapHome"');
    [iGrade, iSubject, iMode, iBook].forEach(function (i) { assert.ok(i !== -1); });
    assert.ok(iGrade < iSubject && iSubject < iMode && iMode < iBook,
      '实际顺序必须为 年级→科目→模式→册别');
  });

  test('三模式册别控件均在范围卡内', () => {
    const sec = rangeSection();
    ['bookWrapHome', 'bookWrapExam', 'bookWrapTeacher'].forEach(function (id) {
      assert.ok(sec.indexOf(id) !== -1, '范围卡必须含 ' + id);
    });
  });

  test('试卷册别控件无"不限"选项', () => {
    const sec = rangeSection();
    const examStart = sec.indexOf('bookWrapExam');
    const examEnd = sec.indexOf('</div>', sec.indexOf('bookSegExam'));
    const examSeg = sec.slice(examStart, examEnd);
    assert.doesNotMatch(examSeg, /data-book="all"/, '试卷模式不得有"不限"册别');
  });

  test('hero 副文案为不限先后顺序的自由选择说明', () => {
    assert.match(html, /不限先后顺序/);
  });
});

describe('P46-04：教师模式交互契约', () => {
  test('教师知识点默认全展平（未选单元时 renderBuckets 取全量 buckets）', () => {
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
});

describe('P46-04：单元稳定标识与课本顺序', () => {
  test('unitBuckets 以 unitId 分桶并含 unitNo', () => {
    assert.match(js, /var uid = k\.unitId/);
    assert.match(js, /unitNo:\s*k\.unitNo/);
  });

  test('单元卡 data-unit 绑定 unitId', () => {
    assert.match(js, /data-unit="' \+ esc\(bkt\.unitId\) \+ '"/);
  });

  test('家庭/试卷/教师单元选择均按 unitId 匹配（不按单元名）', () => {
    assert.match(js, /state\.homeUnitIds\.indexOf\(k\.unitId\)/);
    // P46-06 起试卷范围匹配上移到 examScopeBuckets（按单元桶的 unitId）
    assert.match(js, /state\.examUnitIds\.indexOf\(b\.unitId\)/);
    assert.match(js, /state\.teacherUnitIds\.indexOf\(bkt\.unitId\)/);
  });

  test('不限册别时单元卡角标带册别，用于区分跨册同名单元', () => {
    assert.match(js, /state\.homeBook === 'all' && UNIT_BOOK_LABEL\[bkt\.book\]/);
  });

  test('unitBuckets 按课本顺序 unitNo 升序排序', () => {
    assert.match(js, /if \(an !== bn\) return an - bn;/);
  });
});

describe('P46-04：题型网格与单元网格样式', () => {
  test('家庭与教师题型网格共用同一套单行等列规则', () => {
    assert.match(css, /#homeKindGrid\s*,\s*#homeFocusGrid\s*,\s*#teacherTypeGrid/);
  });

  test('家庭/试卷单元为三列网格（≥768px）', () => {
    const m = css.match(/#homeUnitGrid\s*,\s*#examUnitGrid\s*\{([\s\S]*?)\}/);
    assert.ok(m, '存在 #homeUnitGrid, #examUnitGrid 规则');
    assert.match(m[1], /repeat\(\s*3\s*,\s*minmax\(0,\s*1fr\)\s*\)/);
  });

  test('教师知识点胶囊后的题型标签隐藏', () => {
    assert.match(css, /\.kp-chip\s+\.kp-hint\s*\{[^}]*display:\s*none/);
  });
});

describe('P46-05：家庭模式专项与空能力交互', () => {
  test('六专项规则表齐全（all + 五个关键词规则）', () => {
    const start = js.indexOf('var FOCUS_RULES');
    assert.ok(start !== -1, 'FOCUS_RULES 必须存在');
    const block = js.slice(start, js.indexOf('};', start));
    ['make-ten', 'break-ten', 'add-sub-oral', 'four-ops-oral', 'vertical'].forEach(function (k) {
      assert.ok(block.indexOf("'" + k + "'") !== -1, 'FOCUS_RULES 缺少 ' + k);
    });
    assert.match(block, /凑十/);
    assert.match(block, /破十\|平十/);
    assert.match(block, /竖式\|笔算/);
  });

  test('专项判定基于知识点名称与单元名，不硬编码 KP ID', () => {
    assert.match(js, /function focusMatch\(kp, focusKey\)/);
    assert.match(js, /kp\.name/);
    assert.match(js, /kp\.unit/);
    assert.doesNotMatch(js, /math-g\d/, 'JS 内不得硬编码 KP ID');
    assert.doesNotMatch(js, /u\d{2}-k\d{3}/, 'JS 内不得硬编码知识点编码');
  });

  test('家庭候选池按大类能力（calc/apply）过滤', () => {
    assert.match(js, /function homePool\(entries\)/);
    assert.match(js, /kpMatchesType\(k, \{ types: \[kindType\] \}, null\)/);
    assert.match(js, /state\.homeKind === 'calc' && !focusMatch\(k, state\.homeFocus\)/);
  });

  test('collectKps 家庭分支复用 homePool（消除第二套筛选）', () => {
    assert.match(js, /var pool = homePool\(entries\)\.filter/);
  });

  test('专项在本年级本册无 KP 时置灰并标注"本年级暂无"', () => {
    assert.match(js, /avail === 0 \? ' disabled' : ''/);
    assert.match(js, /avail === 0 \? '本年级暂无'/);
  });

  test('当前专项变为空能力时自动回退"计算综合"', () => {
    assert.match(js, /state\.homeFocus !== 'all' && !focusAvailable\(entries, state\.homeFocus\)/);
    assert.match(js, /state\.homeFocus = 'all';/);
  });

  test('单元卡数量与可用性按当前大类+专项统计', () => {
    assert.match(js, /homePool\(entries\)\.forEach\(function \(k\) \{\s*poolByUnit\[k\.unitId\]/);
    assert.match(js, /avail === 0 \? '当前范围暂无'/);
  });

  test('空态门禁：家庭无可用 KP 时不开始', () => {
    assert.match(js, /state\.mode === 'home' && kps\.length === 0/);
    assert.match(js, /当前范围暂无可生成的题目/);
  });

  test('空态门禁：试卷单元测试未选单元不开始', () => {
    // P46-06 起试卷空态细分为「未选单元」与「范围为空」两档
    assert.match(js, /else if \(state\.mode === 'exam'\) \{/);
    assert.match(js, /state\.examType === 'unit' && !state\.examUnitIds\.length/);
    assert.match(js, /请选择测试单元后再开始/);
  });

  test('切换大类/专项清空已选单元，避免残留不可用范围', () => {
    const kindHandler = js.slice(js.indexOf("homeKindGrid.querySelectorAll"), js.indexOf('// 计算专项卡'));
    assert.match(kindHandler, /state\.homeUnitIds = \[\];/);
    const focusHandler = js.slice(js.indexOf("homeFocusGrid.querySelectorAll"), js.indexOf('// 单元卡'));
    assert.match(focusHandler, /state\.homeUnitIds = \[\];/);
  });

  test('空能力专项按钮不绑定点击（disabled 且排除监听）', () => {
    assert.match(js, /\.type-card\[data-focus\]:not\(\[disabled\]\)/);
    assert.match(js, /\.type-card\[data-unit\]:not\(\[disabled\]\)/);
  });

  test('摘要展示可生成知识点数', () => {
    assert.match(js, /\['知识点', homeKps\.length \? homeKps\.length \+ ' 个可生成' : '当前范围暂无'\]/);
  });
});

describe('P46-06：试卷范围与摘要交互', () => {
  test('范围算法单点：examScopeBuckets / examScopeKps 存在', () => {
    assert.match(js, /function examScopeBuckets\(entries\)/);
    assert.match(js, /function examScopeKps\(entries\)/);
  });

  test('期中取前半册且奇数向上取整，期末取整册', () => {
    const start = js.indexOf('function examScopeBuckets');
    const block = js.slice(start, js.indexOf('function examScopeKps', start));
    assert.match(block, /state\.examType === 'unit'/);
    assert.match(block, /buckets\.slice\(0, Math\.ceil\(buckets\.length \/ 2\)\)/);
    assert.match(block, /return buckets;/);
  });

  test('单元测试未选单元时范围为 0（不静默取全册）', () => {
    const start = js.indexOf('function examScopeBuckets');
    const block = js.slice(start, js.indexOf('function examScopeKps', start));
    assert.match(block, /if \(!state\.examUnitIds\.length\) return \[\];/);
  });

  test('examScopeKps 按 KP id 去重', () => {
    const start = js.indexOf('function examScopeKps');
    const block = js.slice(start, js.indexOf('// ---------- 试卷模式', start));
    assert.match(block, /if \(k && k\.id && !seen\[k\.id\]\)/);
  });

  test('collectKps 试卷分支复用 examScopeKps（摘要/请求同一 KP 池）', () => {
    assert.match(js, /out = examScopeKps\(entries\);/);
  });

  test('期中/期末范围以只读范围卡展示，不绑定选择事件', () => {
    assert.match(js, /data-scope-unit="' \+ esc\(bkt\.unitId\)/);
    assert.doesNotMatch(js, /\[data-scope-unit\]'\)\.forEach/, '范围卡不得绑定点击');
  });

  test('试卷摘要含覆盖单元数、前半册/全册与 40 题', () => {
    assert.match(js, /\['覆盖', examScope\.length \+ ' 个单元（'/);
    assert.match(js, /state\.examType === 'midterm' \? '前半册' : '全册'/);
    assert.match(js, /examKps\.length \+ ' 个 · 40 题'/);
  });

  test('单元测试摘要显示所选单元名，未选提示选择', () => {
    assert.match(js, /examScope\.length \? esc\(examScope\[0\]\.unitName\) : '请选择测试单元'/);
  });

  test('未选单元与范围为空给出不同空态提示', () => {
    assert.match(js, /state\.examType === 'unit' && !state\.examUnitIds\.length/);
    assert.match(js, /请选择测试单元后再开始。/);
    assert.match(js, /当前范围暂无可生成的题目，请更换册别或试卷类型。/);
  });

  test('试卷范围标题显示单元数与知识点数', () => {
    assert.match(js, /'期中范围 · 前半册' : '期末范围 · 全册'/);
    assert.match(js, /' 个单元 · ' \+ scopeKpCount \+ ' 个知识点）'/);
  });
});

describe('P46-04：请求与状态契约', () => {
  test('MODE_DESC 仅含 home/exam/teacher 三模式标题', () => {
    const start = js.indexOf('var MODE_DESC');
    assert.ok(start !== -1);
    const block = js.slice(start, js.indexOf('};', start));
    assert.doesNotMatch(block, /\bdesc\b/);
    ['home', 'exam', 'teacher'].forEach(function (m) {
      assert.ok(block.indexOf(m) !== -1, 'MODE_DESC 必须含 ' + m);
    });
    ['quick', 'competition'].forEach(function (m) {
      assert.ok(block.indexOf(m) === -1, 'MODE_DESC 不得含 ' + m);
    });
  });

  test('状态模型三模式独立（home/exam/teacher 字段分离）', () => {
    assert.match(js, /homeBook:\s*'all',\s*homeKind:\s*'calc',\s*homeFocus:\s*'all',\s*homeUnitIds:\s*\[\]/);
    assert.match(js, /examBook:\s*'up',\s*examType:\s*'unit',\s*examUnitIds:\s*\[\]/);
    assert.match(js, /teacherBook:\s*'all',\s*teacherUnitIds:\s*\[\],\s*teacherKps:\s*\[\],\s*teacherTypes:\s*\[\]/);
  });

  test('URL 初态白名单仅 home/exam/teacher', () => {
    assert.match(js, /\['home',\s*'exam',\s*'teacher'\]\.indexOf\(m\[1\]\)/);
  });

  test('试卷模式请求 count=40', () => {
    assert.match(js, /count = 40;/);
  });

  test('试卷模式传全部七题型（POL 模板分配）', () => {
    assert.match(js, /types = POL_CANONICAL_TYPES\.slice\(\)/);
  });

  test('createPracticeRequest 透传 practiceKind/practiceFocus/examType', () => {
    assert.match(js, /practiceKind:\s*practiceKind/);
    assert.match(js, /practiceFocus:\s*practiceFocus/);
    assert.match(js, /examType:\s*examType/);
  });

  test('模式切换提示为 inline 轻提示，不使用 confirm 弹窗', () => {
    assert.match(js, /getElementById\('modeSwitchHint'\)/);
    assert.doesNotMatch(js, /\bconfirm\s*\(/, '产品承诺无弹窗');
  });
});

describe('P46-08：旧模式物理清理证据', () => {
  const fsRepo = fs;
  const root = path.join(__dirname, '..', '..');

  test('select.html 无竞赛模块卡死 CSS（.module-card / .mc-icon / .mc-desc）', () => {
    assert.doesNotMatch(html, /\.module-card/);
    assert.doesNotMatch(html, /\.mc-icon/);
    assert.doesNotMatch(html, /\.mc-desc/);
  });

  test('全站页面与浏览器 E2E 不再使用 mode=quick / mode=competition', () => {
    const files = [
      'select.html', 'practice.html', 'index.html', 'common.js', 'sw.js',
      'dev/e2e/browser-e2e.js'
    ];
    files.forEach(function (rel) {
      const p = path.join(root, rel);
      if (!fsRepo.existsSync(p)) return;
      const src = fsRepo.readFileSync(p, 'utf8');
      assert.doesNotMatch(src, /mode=quick/, rel + ' 不得残留 mode=quick');
      assert.doesNotMatch(src, /mode=competition/, rel + ' 不得残留 mode=competition');
    });
  });

  test('E2E 家庭模式用例已切换为 mode=home', () => {
    const e2e = fsRepo.readFileSync(path.join(root, 'dev/e2e/browser-e2e.js'), 'utf8');
    assert.match(e2e, /mode=home&practiceKind=calc/);
  });

  test('保留项：编排层内部模式（quick/competition）未被误删', () => {
    // §11.3：Strategy/Generation 内部模式属合法能力，不满足三方零消费证据，保留
    const st = fsRepo.readFileSync(path.join(root, 'shared/strategy/strategy-engine.js'), 'utf8');
    assert.match(st, /quick/);
    assert.match(st, /competition/);
  });

  test('竞赛 KP 过滤能力保留（level === competition）', () => {
    assert.match(js, /catalog\[i\]\.level === 'competition'/);
  });
});

describe('安全基线', () => {
  test('保留 esc() HTML 转义函数（动态文本注入边界）', () => {
    assert.match(js, /function esc\(s\)/);
  });
});
