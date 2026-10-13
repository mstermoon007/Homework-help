'use strict';

/**
 * tests/generation/p40-q13-context.test.js — P40-Q-13 生成器消费情境语料库
 *
 * 层1  语料权威（T2）：kbl/teaching/context-library.json 全条目 reviewStatus=confirmed +
 *      schemaVersion 冻结口径（11 relations 与 application.js PROBLEM_TEMPLATES 逐字对齐）；
 * 层2  resolve 投影：真实 KP grade 命中（'g5' 剥前缀→数字）+ moneyEntries 空回退；
 * 层3  application 消费双证据（读信号 + 产出变化）：同 seed 有/无语料对比（叙事生效）+
 *      bare 回退面保持抽象模板；choice 走 brief 精简叙事；
 * 层4  money 消费：三 op（buy/change/total）叙事 + {a}/{b} 金额槽零残留；
 * 层5  relation×场景匹配（行程叙事不含购物词、购物叙事不含速度词）+ R20 机判回放。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev/_bundle-env.js'));
const SP = require(path.join(ROOT, 'shared/generator/core/semantic-parameters.js'));
const REG = require(path.join(ROOT, 'shared/generator/generator-registry.js'));
const appMod = require(path.join(ROOT, 'shared/generator/generators/application.js'));
const moneyMod = require(path.join(ROOT, 'shared/generator/generators/money.js'));

// 真实 KP 锚（运行时取证：registry 绑定 + grade 分布）
const G2_APP = 'math-g2-up-u08-k001';    // application-word g2
const G3_APP = 'math-g3-up-u09-k001';    // application-word g3
const G5_APP = 'math-g5-down-u03-k006';  // application-word g5
// P40-Q-13 取证修正：money-measurement 绑定的 12 KP 中仅 g1 三个人民币 KP 为 kind=rmb，
// 其余为 length/area/mass 单位 KP（kind 失配守卫正确回退）——叙事消费锚必须用 rmb KP。
const G1_RMB = 'math-g1-down-u07-k001';  // 人民币的单位（kind=rmb）
const G2_MONEY = 'math-g2-up-u05-k001';  // 认识厘米和米（kind=length，失配守卫用）

const appGen = appMod.createApplicationGenerator({});
const moneyGen = moneyMod.createMoneyGenerator({});

function mkPlan(kpId, qt, seed, sp, nrMax) {
  return {
    questionTypeId: qt, count: 3, difficulty: 2,
    knowledgePointIds: [kpId],
    constraints: { numberRange: { min: 1, max: nrMax || 20 } },
    seed: seed,
    semanticParams: (sp === undefined) ? SP.resolve(kpId, qt) : sp
  };
}

/* ------------------------------------------------------------------ *
 * 层1 语料权威（T2 冻结态）
 * ------------------------------------------------------------------ */

test('P40-Q-13 L1 语料权威：schemaVersion 冻结 + 全条目 confirmed + relation 契约对齐', () => {
  const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/context-library.json'), 'utf8'));
  assert.equal(lib.schemaVersion, 'p40-context.1', 'schemaVersion 冻结口径');
  assert.ok(Array.isArray(lib.scenes) && lib.scenes.length === 10, '10 场景');
  lib.scenes.forEach((s) => {
    assert.equal(s.reviewStatus, 'confirmed', s.id + ' 场景级 confirmed');
    Object.keys(s.narratives).forEach((rel) => {
      const cell = s.narratives[rel];
      assert.ok(cell && typeof cell.apply === 'string' && typeof cell.brief === 'string',
        s.id + ' 格 ' + rel + ' 双形态齐');
    });
  });
  assert.ok(Array.isArray(lib.moneyApp.entries), 'moneyApp.entries 存在');
  lib.moneyApp.entries.forEach((e) => {
    assert.equal(e.reviewStatus, 'confirmed', e.id + ' confirmed');
    ['buy', 'change', 'total'].forEach((op) => {
      assert.ok(Array.isArray(e.narratives[op]) && e.narratives[op].length >= 1,
        e.id + ' op=' + op + ' 叙事池非空');
    });
  });
  // relation 契约：application.js PROBLEM_TEMPLATES 的 relation 全部被语料覆盖
  const corpusRels = new Set();
  lib.scenes.forEach((s) => Object.keys(s.narratives).forEach((r) => corpusRels.add(r)));
  Object.keys(appMod.PROBLEM_TEMPLATES).forEach((k) => {
    const rel = appMod.PROBLEM_TEMPLATES[k].relation;
    assert.ok(corpusRels.has(rel), '模板 ' + k + ' 的 relation「' + rel + '」有语料覆盖');
  });
});

/* ------------------------------------------------------------------ *
 * 层2 resolve 投影（grade 剥前缀 + 空回退）
 * ------------------------------------------------------------------ */

test('P40-Q-13 L2 resolve 投影：grade 命中逐档正确 + moneyEntries 空回退', () => {
  // g2：shop-low/plant-low/stat-mid + money-shop-low
  const r2 = SP.resolve(G2_APP, 'apply');
  assert.ok(r2 && r2.contextScenes, 'g2 resolve 有 contextScenes');
  const ids2 = r2.contextScenes.scenes.map((s) => s.id).sort();
  assert.deepEqual(ids2, ['plant-low', 'shop-low', 'stat-mid'], 'g2 场景投影：' + ids2.join(','));
  assert.equal(r2.contextScenes.moneyEntries.length, 1, 'g2 moneyEntries=1');
  assert.equal(r2.contextScenes.moneyEntries[0].id, 'money-shop-low', 'g2 money 条目锚');
  // g3：shop-mid/travel-mid/plant-mid/stat-mid
  const r3 = SP.resolve(G3_APP, 'apply');
  assert.deepEqual(r3.contextScenes.scenes.map((s) => s.id).sort(),
    ['plant-mid', 'shop-mid', 'stat-mid', 'travel-mid'], 'g3 场景投影');
  // g5：4 高段场景 + moneyEntries 空回退（g5-6 无 money 语料）
  const r5 = SP.resolve(G5_APP, 'apply');
  assert.deepEqual(r5.contextScenes.scenes.map((s) => s.id).sort(),
    ['shop-high', 'stat-high', 'travel-high', 'work-high'], 'g5 场景投影');
  assert.equal(r5.contextScenes.moneyEntries.length, 0, 'g5 moneyEntries 空回退');
  // 投影结构：narratives 以 relation 字符串为键（generator 消费锚）
  const s0 = r2.contextScenes.scenes[0];
  assert.ok(s0.narratives && typeof s0.narratives === 'object', '投影带 narratives 锚表');
  Object.keys(s0.narratives).forEach((rel) => {
    assert.ok(appMod.PROBLEM_TEMPLATES && typeof rel === 'string' && rel.length > 4,
      'relation 键形态：' + rel);
  });
});

/* ------------------------------------------------------------------ *
 * 层3 application 消费双证据
 * ------------------------------------------------------------------ */

test('P40-Q-13 L3 apply 同 seed 有/无语料对比：叙事生效 + bare 回退面保持', () => {
  const spReal = SP.resolve(G2_APP, 'apply');
  const spBare = JSON.parse(JSON.stringify(spReal));
  spBare.contextScenes = { scenes: [], moneyEntries: [] };
  let changed = 0, same = 0, total = 0, abstractInReal = 0;
  for (let s = 0; s < 30; s++) {
    const a = appGen.generate(mkPlan(G2_APP, 'apply', 'q13:' + s, spReal), { seed: 'q13' });
    const b = appGen.generate(mkPlan(G2_APP, 'apply', 'q13:' + s, spBare), { seed: 'q13' });
    assert.equal(a.length, b.length, '同 seed 行数一致');
    a.forEach((q, i) => {
      total++;
      const p = String(q.prompt);
      if (p !== String(b[i].prompt)) changed++; else same++;
      if (/已知条件：/.test(p)) abstractInReal++;
    });
  }
  assert.equal(total, 90, '样本量 30 seed × 3');
  assert.ok(changed >= 60, '叙事生效行 ≥ 2/3（实得 ' + changed + '/' + total + '）');
  assert.ok(same <= 30, '回退面有限（实得 ' + same + '）');
  assert.equal(abstractInReal, 0, 'g2 真实语料下 apply 无抽象「已知条件」形态残留');
  // bare 面：无语料时必须是抽象模板（回退面不劣化）
  const b0 = appGen.generate(mkPlan(G2_APP, 'apply', 'q13bare', spBare), { seed: 'q13bare' });
  b0.forEach((q) => assert.ok(/已知条件：/.test(String(q.prompt)),
    'bare 回退面保持抽象模板：' + q.prompt));
});

test('P40-Q-13 L3 apply/choice 叙事形态：场景词命中 + choice 精简叙事', () => {
  const spA = SP.resolve(G2_APP, 'apply');
  let narrativeHits = 0;
  for (let s = 0; s < 20; s++) {
    appGen.generate(mkPlan(G2_APP, 'apply', 'q13n:' + s, spA), { seed: 'q13n' }).forEach((q) => {
      const p = String(q.prompt);
      if (/植|文具店|同学|老师|超市/.test(p) && !/已知条件：/.test(p)) narrativeHits++;
    });
  }
  assert.ok(narrativeHits >= 20, 'apply 叙事词覆盖（实得 ' + narrativeHits + '/60）');
  // choice：brief 精简叙事（单行、无「已知条件」双行结构）
  const spC = SP.resolve(G2_APP, 'choice');
  let briefHits = 0;
  for (let s = 0; s < 20; s++) {
    appGen.generate(mkPlan(G2_APP, 'choice', 'q13c:' + s, spC), { seed: 'q13c' }).forEach((q) => {
      const p = String(q.prompt);
      assert.ok(!/已知条件：/.test(p), 'choice 不用抽象双行模板：' + p);
      if (/元|棵|支|个/.test(p) && p.length < 60) briefHits++;
    });
  }
  assert.ok(briefHits >= 20, 'choice 精简叙事覆盖（实得 ' + briefHits + '/60）');
});

/* ------------------------------------------------------------------ *
 * 层4 money 消费（三 op + 金额槽零残留）
 * ------------------------------------------------------------------ */

test('P40-Q-13 L4 money：三 op 叙事生效 + {a}/{b} 槽零残留', () => {
  // 运行时取证：money-measurement 12 KP 中仅 g1 三个 rmb KP（认识人民币的单位/换算/实际应用）
  // 走 kind=rmb 分支消费 moneyApp 叙事；g2 的「认识厘米和米」为 kind=length 正确失配回退。
  // 另证：money.js 叙事由 op 驱动不分 KP（三个 rmb KP 同池）+ 只吃 context.seed。
  const sp = SP.resolve(G1_RMB, 'apply');
  assert.ok(sp && sp.contextScenes.moneyEntries.length === 1, 'g1 rmb KP moneyEntries=1');
  const buckets = { buy: 0, change: 0, total: 0 };
  let residue = 0;
  const samples = [];
  for (let s = 0; s < 40; s++) {
    moneyGen.generate(mkPlan(G1_RMB, 'apply', 'q13m:' + s, sp), { seed: 'q13m:' + s }).forEach((q) => {
      const p = String(q.prompt);
      if (/\{a\}|\{b\}/.test(p)) residue++;
      if (/一共花了多少钱/.test(p)) { buckets.buy++; if (samples.length < 2) samples.push(p); }
      else if (/还剩多少钱/.test(p)) buckets.change++;
      else if (/一共需要多少钱/.test(p)) buckets.total++;
    });
  }
  assert.equal(residue, 0, '{a}/{b} 槽零残留');
  assert.ok(buckets.buy >= 1 && buckets.change >= 1 && buckets.total >= 1,
    '三 op 叙事桶全覆盖：' + JSON.stringify(buckets));
  assert.ok(/元|角|分/.test(samples[0] || ''), '金额槽已填（人民币单位）：' + samples[0]);
  // 语料词汇生效：g1 money 叙事池来自 money-shop-low（卷笔刀/铅笔/橡皮/本子等低段词）
  assert.ok(/笔|本子|橡皮|书包|文具/.test(samples.join('|')), 'money 叙事来自语料池：' + samples[0]);
  // 失配守卫：length KP（认识厘米和米）不消费 money 叙事（回退硬编码/抽象面）
  const spLen = SP.resolve(G2_MONEY, 'apply');
  let lenRmbRows = 0;
  for (let s = 0; s < 20; s++) {
    moneyGen.generate(mkPlan(G2_MONEY, 'apply', 'q13L:' + s, spLen), { seed: 'q13L:' + s }).forEach((q) => {
      const p = String(q.prompt);
      if (/一共花了多少钱|还剩多少钱|一共需要多少钱/.test(p) && /元/.test(p)) lenRmbRows++;
    });
  }
  assert.equal(lenRmbRows, 0, 'length KP 零人民币购物叙事（kind 失配守卫生效）');
});

/* ------------------------------------------------------------------ *
 * 层5 relation×场景匹配 + R20 回放
 * ------------------------------------------------------------------ */

test('P40-Q-13 L5 匹配校验：行程叙事与购物叙事互斥（语义失配零混入）', () => {
  // g3-g5 app KP 全扫（nr.max=100 放开 complex 模板池，distance/work 可达）。
  // relation 锚天然互斥：'distance = speed × time' 只存在于 travel 场景 narratives，
  // shop 场景无此键 → 行程叙事只能来自 travel 语料，购物词混入即 fail。
  const appKps = [];
  (REG.all() || []).forEach((r) => {
    if (r && r.id === 'generator:application-word') (r.knowledgePoints || []).forEach((k) => appKps.push(k));
  });
  assert.ok(appKps.length >= 20, 'application KP 池非空（' + appKps.length + '）');
  const SHOP = /元|文具|超市|笔袋|橡皮|铅笔|书包|本子|橡皮擦|卷笔刀|水彩笔/;
  const TRAVEL = /千米|行驶|速度/;
  let travelRows = 0, shopRows = 0, scanned = 0;
  appKps.forEach((kpId) => {
    const kp = global.KnowledgeContext.get(kpId);
    if (!kp || !/^g[3-5]$/.test(String(kp.grade))) return;
    const sp = SP.resolve(kpId, 'apply');
    if (!sp) return;
    for (let s = 0; s < 20; s++) {
      appGen.generate(mkPlan(kpId, 'apply', 'q13t:' + kpId + ':' + s, sp, 100), { seed: 'q13t' }).forEach((q) => {
        const p = String(q.prompt);
        if (!p) return;
        scanned++;
        if (TRAVEL.test(p)) {
          travelRows++;
          assert.ok(!SHOP.test(p), '行程叙事不含购物词：' + p);
        }
        if (SHOP.test(p)) {
          shopRows++;
          assert.ok(!TRAVEL.test(p), '购物叙事不含行程词：' + p);
        }
      });
    }
  });
  assert.ok(scanned >= 300, '扫描面充足（' + scanned + ' 行）');
  assert.ok(travelRows >= 1, 'travel 叙事真实出现（实得 ' + travelRows + '）');
  assert.ok(shopRows >= 1, 'shop 叙事真实出现（实得 ' + shopRows + '）');
});

test('P40-Q-13 L5 R20 机判回放：同 seed 双跑逐字节一致', () => {
  [[appGen, G2_APP, 'apply'], [appGen, G3_APP, 'apply'], [moneyGen, G1_RMB, 'apply'],
   [appGen, G2_APP, 'choice']].forEach(([gen, kp, qt]) => {
    for (let s = 0; s < 8; s++) {
      const a = JSON.stringify(gen.generate(mkPlan(kp, qt, 'q13r:' + s), { seed: 'q13r' }));
      const b = JSON.stringify(gen.generate(mkPlan(kp, qt, 'q13r:' + s), { seed: 'q13r' }));
      assert.equal(a, b, kp + ' ' + qt + ' seed=' + s + ' 回放一致');
    }
  });
});
