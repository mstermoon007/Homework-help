'use strict';
// dev/p27/variation-observe.js — P27-09 五轴观测公共模块
//
// derive-variation-profiles.js（建剖面）与 check-variation-drift.js（漂移比对）
// 必须用同一套轴提取逻辑，否则比对无意义。本模块是唯一实现，两侧共同 require。
// 纯函数、无 IO；输入 SemanticQuestion[]，输出五轴观测（事实投影，不做推断）。

var RE_HAN = /[\u4e00-\u9fff]/g;
var RE_REPR_PATH = /graphic|svg|picture|image|diagram/i;

/** data 浅层普查（与 evidence 派生同构）：叶路径 → {t, v}；深度 3；跳过 semanticEvidence */
function census(data, out, prefix, depth) {
  if (data == null || typeof data !== 'object') return;
  Object.keys(data).forEach(function (k) {
    if (k === 'semanticEvidence') return;
    var v = data[k];
    var p = prefix ? prefix + '.' + k : k;
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) { out[p] = { t: 'array', len: v.length }; return; }
    if (typeof v === 'object') {
      if (depth <= 1) return;
      census(v, out, p, depth - 1);
      return;
    }
    out[p] = { t: typeof v, v: v };
  });
}

function answerValuesOf(q) {
  var vals = [];
  var a = q.answer || {};
  if (a.value != null) vals.push(String(a.value));
  if (Array.isArray(a.acceptable)) a.acceptable.forEach(function (v) { if (v != null) vals.push(String(v)); });
  return vals;
}

function toNum(v) {
  var n = Number(v);
  return (isFinite(n) && String(n) === String(v)) ? n : null;
}

/** 对一行样本提取五轴观测（纯事实投影，不做推断） */
function observeRow(samples) {
  var unknownPositions = {};
  var answerVals = {};
  var numericAnswers = [];
  var contextHits = 0;
  var reprValues = {};
  var reprPaths = {};
  var stepsValues = {};

  samples.forEach(function (q) {
    var flat = {};
    census(q.data, flat, 'data', 3);
    var aVals = answerValuesOf(q);
    aVals.forEach(function (v) {
      var j = JSON.stringify(v);
      answerVals[j] = (answerVals[j] || 0) + 1;
      var n = toNum(v);
      if (n !== null) numericAnswers.push(n);
    });

    if (aVals.length) {
      Object.keys(flat).forEach(function (pth) {
        var f = flat[pth];
        if (f.t === 'string' || f.t === 'number' || f.t === 'boolean') {
          if (aVals.indexOf(String(f.v)) !== -1) {
            unknownPositions[pth] = (unknownPositions[pth] || 0) + 1;
          }
        }
      });
    }

    var han = (String(q.prompt || '').match(RE_HAN) || []).length;
    if (han >= 2) contextHits++;

    Object.keys(flat).forEach(function (pth) {
      if (RE_REPR_PATH.test(pth)) {
        reprPaths[pth] = true;
        var f = flat[pth];
        if (f.t === 'string' || f.t === 'number' || f.t === 'boolean') {
          reprValues[pth] = reprValues[pth] || {};
          var j = JSON.stringify(f.v);
          reprValues[pth][j] = (reprValues[pth][j] || 0) + 1;
        }
      }
    });

    ['data.steps', 'data.stepCount', 'data.step'].forEach(function (pth) {
      if (flat[pth] && flat[pth].t === 'number') {
        var key = pth + '=' + JSON.stringify(flat[pth].v);
        stepsValues[key] = (stepsValues[key] || 0) + 1;
      }
    });
  });
  var n = samples.length;
  var unknownSorted = Object.keys(unknownPositions).sort();
  var distinctAnswers = Object.keys(answerVals).length;
  var reprPathList = Object.keys(reprPaths).sort();
  var reprValueMap = {};
  reprPathList.forEach(function (pth) {
    reprValueMap[pth] = Object.keys(reprValues[pth] || {}).sort();
  });
  var stepList = Object.keys(stepsValues).sort();

  var contextRatio = n ? contextHits / n : 0;
  var ansMin = numericAnswers.length ? Math.min.apply(null, numericAnswers) : null;
  var ansMax = numericAnswers.length ? Math.max.apply(null, numericAnswers) : null;

  return {
    variation: {
      unknown: { positions: unknownSorted },
      numeric: {
        varies: n >= 2 && distinctAnswers >= 2,
        distinctAnswers: distinctAnswers,
        answerMin: ansMin,
        answerMax: ansMax
      },
      context: { present: contextRatio >= 0.5, ratio: Math.round(contextRatio * 100) / 100 },
      representation: { present: reprPathList.length > 0, paths: reprPathList, values: reprValueMap },
      structure: { steps: stepList }
    },
    evidence: { samples: n }
  };
}

module.exports = {
  census: census,
  answerValuesOf: answerValuesOf,
  observeRow: observeRow
};
