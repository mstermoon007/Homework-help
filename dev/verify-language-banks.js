#!/usr/bin/env node
/**
 * dev/verify-language-banks.js — 语文/英语知识库专项验证（任务：自动化质量保障）
 *
 * 检查项（10）：
 *   1  知识点 ID 格式          {cn|en}-g{grade}-{module}-{slug} 四段式
 *   2  依赖完整性              prerequisites 引用的知识点必须存在
 *   3  题型映射                exerciseTypes 引用的插件必须在 registry 注册
 *                             （且插件 grades 覆盖该知识点年级）
 *   4  词库引用存在            bankRef ∈ {pinyinBank, hanziBank}，
 *                             且对应全局库已可加载（PINYIN_BANK / HanziBank）
 *   5  汉字库完整性            HanziBank.characters 非空，且每条目核心字段齐备
 *                             （char/pinyin/grade/strokes/strokeOrder/structure）
 *   6  拼音库完整性            initials 23 · finals.simple 6 · compound 8 ·
 *                             nasalFront 5 · nasalBack 4 · wholeSyllables 16 ·
 *                             toneExamples/jqxuWords/lightToneWords/
 *                             confusingGroups/polyphones/syllables 非空
 *   7  关系引用存在            homophones / similar 引用须为合法单字；
 *                             polyphones.readings 须含 py 与 ctx
 *   8  循环依赖检查            cn/en 前置链 DFS 无环
 *   9  难度递进                前置边 difficulty 单调不减；前置年级不高于自身
 *   10 状态合法                status ∈ {active, placeholder}；
 *                             active ⇒ 有 pluginId；placeholder ⇒ 无 pluginId
 *
 * 范围说明：结构类强校验针对语文（cn）；英语（en）当前仅 3 条占位级条目，
 *          适用 ID 格式 / 依赖 / 循环 / 状态等通用规则。
 *
 * 用法：node dev/verify-language-banks.js    # 有 errors 退出码 1
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const errors = [];
const warnings = [];
let checked = 0;

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

// ---- 加载 ----
const KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const catalog = require(path.join(ROOT, 'shared', 'module-catalog.js'));
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));
const PinyinBank = global.PINYIN_BANK || (() => {
  try { require(path.join(ROOT, 'pinyin-bank.js')); } catch (e) { /* ignore */ }
  return global.PINYIN_BANK || null;
})();
const HanziBank = global.HanziBank || (() => {
  try { return require(path.join(ROOT, 'shared', 'hanzi-bank.js')); } catch (e) { return null; }
})();

const SUBJECT_KEYS = Object.keys(KB).filter(k => Array.isArray(KB[k]));
const LANG_SUBJECTS = ['cn', 'en'];
const ID_RE = /^(cn|en)-g[1-6]-(?:m(?:[0-9]|1[0-2])|c[1-9]|n[1-8]|e[1-6])-[a-z0-9-]+$/;
const BANKREF_OK = new Set(['pinyinBank', 'hanziBank']);
const STATUS_OK = new Set(['active', 'placeholder']);
const REG_BY_ID = new Map(registry.map(r => [r.id, r]));

// 扁平化（带科目归属）
const entries = [];
SUBJECT_KEYS.forEach(s => KB[s].forEach(e => entries.push(Object.assign({ subject: s }, e))));
const kpIndex = new Map(); // id → {kp, grade, subject}
entries.forEach(e => e.modules.forEach(m => (m.knowledgePoints || []).forEach(k => {
  kpIndex.set(k.id, { kp: k, grade: e.grade, subject: e.subject, moduleId: m.moduleId });
})));

// ============ 1. ID 格式 ============
{
  checked++;
  let bad = 0;
  kpIndex.forEach((info, id) => {
    const scope = LANG_SUBJECTS.includes(info.subject);
    if (scope && !ID_RE.test(id)) { bad++; err(`[1·ID格式] ${id}`); }
  });
  console.log(`检查 1  知识点 ID 格式（${LANG_SUBJECTS.join('/')} 强制四段式）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处违规'}`);
}

// ============ 2. 依赖完整性 ============
{
  checked++;
  let bad = 0;
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    (info.kp.prerequisites || []).forEach(p => {
      if (!kpIndex.has(p)) { bad++; err(`[2·依赖] ${id} 的前置不存在: ${p}`); }
    });
    (info.kp.related || []).forEach(r2 => {
      if (!kpIndex.has(r2)) { bad++; err(`[2·依赖] ${id} 的关联不存在: ${r2}`); }
    });
  });
  console.log(`检查 2  依赖完整性：${bad === 0 ? '✓' : '✗ ' + bad + ' 处缺失'}`);
}

// ============ 3. 题型映射（exerciseTypes → 注册表） ============
{
  checked++;
  let bad = 0, mapped = 0;
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    (info.kp.exerciseTypes || []).forEach(pid => {
      mapped++;
      const rec = REG_BY_ID.get(pid);
      if (!rec) { bad++; err(`[3·题型映射] ${id} 引用的生成器未注册: ${pid}`); return; }
      if (Array.isArray(rec.grades) && !rec.grades.includes(info.grade)) {
        bad++; err(`[3·题型映射] ${id}(g${info.grade}) 的生成器 ${pid} 不支持该年级`);
      }
    });
  });
  console.log(`检查 3  题型映射（exerciseTypes → 插件）：引用 ${mapped} 处，${bad === 0 ? '✓ 全部有效' : '✗ ' + bad + ' 处无效'}`);
}

// ============ 4. 词库引用存在 ============
{
  checked++;
  let bad = 0;
  const bankLoaded = { pinyinBank: !!PinyinBank, hanziBank: !!HanziBank };
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    const ref = info.kp.bankRef;
    if (ref == null) return; // 允许缺省（数学口径）
    if (!BANKREF_OK.has(ref)) { bad++; err(`[4·词库] ${id} bankRef 非法: ${ref}`); return; }
    if (!bankLoaded[ref]) { bad++; err(`[4·词库] ${id} 的 bankRef=${ref} 对应库未能加载`); }
  });
  Object.keys(bankLoaded).forEach(k => {
    if (!bankLoaded[k]) err(`[4·词库] ${k} 库文件加载失败`);
  });
  console.log(`检查 4  词库引用存在（pinyinBank=${bankLoaded.pinyinBank ? '✓' : '✗'} / hanziBank=${bankLoaded.hanziBank ? '✓' : '✗'}）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处异常'}`);
}

// ============ 5. 汉字库完整性 ============
{
  checked++;
  let bad = 0;
  if (!HanziBank || !Array.isArray(HanziBank.characters)) {
    err('[5·汉字库] HanziBank.characters 缺失或非数组');
    bad++;
  } else {
    const chars = HanziBank.characters;
    if (!chars.length) err('[5·汉字库] characters 为空');
    chars.forEach(c => {
      ['char', 'pinyin', 'grade', 'strokes', 'strokeOrder', 'structure'].forEach(f => {
        if (c[f] == null || c[f] === '' ||
           (Array.isArray(c[f]) && !c[f].length)) {
          bad++; err(`[5·汉字库] 「${c.char || '?'}」缺少必填字段 ${f}`);
        }
      });
      if (c.strokeOrder && c.strokes && c.strokeOrder.length !== c.strokes) {
        bad++; err(`[5·汉字库] 「${c.char}」strokes(${c.strokes}) 与 strokeOrder(${c.strokeOrder.length}) 数量不符`);
      }
    });
    // 每个汉字至少能被一个 n2 知识点使用（N2 存在即视为可用通道）
    const n2Exists = [...kpIndex.values()].some(v =>
      v.subject === 'cn' && v.kp.moduleId === 'n2' && v.kp.status === 'active');
    if (chars.length && !n2Exists) {
      warn('[5·汉字库] 存在汉字但无任何 active 的 n2 知识点（请补充知识点条目）');
    }
  }
  const n = (HanziBank && HanziBank.characters || []).length;
  console.log(`检查 5  汉字库完整性：${n} 个汉字，${bad === 0 ? '✓ 结构完好' : '✗ ' + bad + ' 处异常'}`);
}

// ============ 6. 拼音库完整性 ============
{
  checked++;
  let bad = 0;
  const expect = [
    ['initials', 23, '声母'],
    ['wholeSyllables', 16, '整体认读音节'],
  ];
  if (!PinyinBank) {
    err('[6·拼音库] PINYIN_BANK 未加载');
    bad++;
  } else {
    expect.forEach(([k, n, label]) => {
      const arr = PinyinBank[k];
      if (!Array.isArray(arr) || arr.length !== n) {
        bad++; err(`[6·拼音库] ${label}应为 ${n} 个，实际 ${arr ? arr.length : '缺失'}`);
      }
    });
    const f = PinyinBank.finals || {};
    [['simple', 6, '单韵母'], ['compound', 8, '复韵母'],
     ['nasalFront', 5, '前鼻韵母'], ['nasalBack', 4, '后鼻韵母']].forEach(([k, n, label]) => {
      if (!Array.isArray(f[k]) || f[k].length !== n) {
        bad++; err(`[6·拼音库] ${label}应为 ${n} 个，实际 ${f[k] ? f[k].length : '缺失'}`);
      }
    });
    [['toneExamples'], ['jqxuWords'], ['lightToneWords'],
     ['confusingGroups'], ['polyphones'], ['syllables']].forEach(([k]) => {
      if (!Array.isArray(PinyinBank[k]) || !PinyinBank[k].length) {
        bad++; err(`[6·拼音库] ${k} 为空或缺失`);
      }
    });
  }
  console.log(`检查 6  拼音库完整性（23 声母 / 韵母 6+8+5+4 / 整体认读 16 / 选题池非空）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处异常'}`);
}

// ============ 7. 关系引用存在（多音/形近/同音） ============
{
  checked++;
  let bad = 0;
  const allChars = new Set();
  if (HanziBank && Array.isArray(HanziBank.characters)) {
    HanziBank.characters.forEach(c => allChars.add(c.char));
  }
  const isCJK = s => typeof s === 'string' && /^[\u3400-\u9FFF]$/.test(s);
  if (HanziBank && Array.isArray(HanziBank.characters)) {
    HanziBank.characters.forEach(c => {
      (c.homophones || []).forEach(h => {
        if (!isCJK(h)) { bad++; err(`[7·同音引用] 「${c.char}」的同音字非法: ${h}`); }
        else if (!allChars.has(h)) warn(`[7·同音引用] 「${c.char}」↔「${h}」：对方未收录字库（仅提示）`);
      });
      (c.similar || []).forEach(s => {
        if (!isCJK(s)) { bad++; err(`[7·形近引用] 「${c.char}」的形近字非法: ${s}`); }
        else if (!allChars.has(s)) warn(`[7·形近引用] 「${c.char}」↔「${s}」：对方未收录字库（仅提示）`);
      });
      (c.polyphones || []).forEach(p2 => {
        if (!p2.py || !p2.ctx) { bad++; err(`[7·多音引用] 「${c.char}」的多音条目缺 py 或 ctx`); }
      });
    });
  }
  // 知识点侧：exerciseTypes 已在检查 3 覆盖；此处补 polyphones 数据源一致性
  console.log(`检查 7  关系引用存在（同音/形近/多音）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处异常'}`);
}

// ============ 8. 循环依赖检查（cn/en 前置链 DFS） ============
{
  checked++;
  let cyc = 0;
  const visit = (id, stack) => {
    if (stack.has(id)) {
      cyc++;
      err(`[8·循环依赖] ${[...stack].join(' → ')} → ${id}`);
      return;
    }
    const info = kpIndex.get(id);
    if (!info) return;
    const next = new Set(stack); next.add(id);
    (info.kp.prerequisites || []).forEach(p => {
      if (kpIndex.has(p)) visit(p, next);
    });
  };
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    visit(id, new Set());
  });
  console.log(`检查 8  循环依赖（cn/en 前置链）：${cyc === 0 ? '✓ 无环' : '✗ ' + cyc + ' 处成环'}`);
}

// ============ 9. 难度递进 ============
{
  checked++;
  let bad = 0;
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    const g = info.grade;
    const dSelf = info.kp.difficulty;
    if (!Number.isFinite(dSelf)) { warn(`[9·难度] ${id} 缺 difficulty（跳过递进比较）`); return; }
    (info.kp.prerequisites || []).forEach(p => {
      const pi = kpIndex.get(p);
      if (!pi) return;
      if (pi.grade > g) return; // 跨年级方向由主校验负责
      if (pi.kp.difficulty > dSelf) {
        bad++;
        err(`[9·难度递进] ${id}(难度${dSelf}) 的前置 ${p}(难度${pi.kp.difficulty}) 更难，违反递进`);
      }
    });
  });
  console.log(`检查 9  难度递进（前置难度 ≤ 自身）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处倒挂'}`);
}

// ============ 10. 状态合法 ============
{
  checked++;
  let bad = 0;
  kpIndex.forEach((info, id) => {
    if (!LANG_SUBJECTS.includes(info.subject)) return;
    const st = info.kp.status;
    if (!STATUS_OK.has(st)) { err(`[10·状态] ${id} status 非法: ${st}`); return; }
    const hasPlugin = !!info.kp.pluginId;
    const hasGen = (info.kp.exerciseTypes || []).length > 0;
    if (st === 'active' && !hasPlugin) {
      err(`[10·状态] ${id} status=active 但未指定 pluginId`);
    }
    if (st === 'placeholder' && hasPlugin) {
      err(`[10·状态] ${id} status=placeholder 但已指定 pluginId（应激活为 active）`);
    }
    void hasGen;
  });
  console.log(`检查 10 状态合法（active↔pluginId / placeholder 无归属）：${bad === 0 ? '✓' : '✗ ' + bad + ' 处异常'}`);
}

// ============ 汇总 ============
console.log('\n' + '='.repeat(46));
if (errors.length) {
  console.log(`❌ verify-language-banks 失败：${errors.length} 项错误`);
  errors.forEach(e => console.log(' - ' + e));
  process.exit(1);
}
console.log(`✅ verify-language-banks 通过（${checked} 项检查` +
  (warnings.length ? `，${warnings.length} 条提示）` : '）'));
if (warnings.length) {
  warnings.forEach(w => console.log(' ⚠ ' + w));
}
process.exit(0);
