#!/usr/bin/env node
/**
 * dev/difficulty-anchor-table.js — 年级难度锚点表（Q6 确认）
 *
 * 依据 docs/AI_REFACTOR_PLAN.html R2「难度锚点标定」与用户确认的 Q6 锚点表：
 *   G1 1-2 / G2 2-4 / G3 3-5 / G4 4-7 / G5 5-8 / G6 6-10
 * 语义：该年级 KP 的基础难度应落在锚点区间 [min,max]；区间随年级螺旋上升（相邻年级区间有重叠）。
 *
 * 映射公式（1-5 相对难度 → 年级锚点区间绝对难度，线性展开、四舍五入）：
 *   abs = gMin + round((d - 1) * (gMax - gMin) / 4)
 * 性质：确定性可复算；保持相对排序（d 越大绝对难度越大）；结果恒 ∈ [gMin, gMax]。
 */
'use strict';

const ANCHOR = {
  1: [1, 2],
  2: [2, 4],
  3: [3, 5],
  4: [4, 7],
  5: [5, 8],
  6: [6, 10]
};

function anchorOf(grade) {
  return ANCHOR[Number(grade)] || null;
}

/**
 * 1-5 相对难度 → 年级锚点区间绝对难度（1-10）。
 * @param {number} grade 年级
 * @param {number} d 相对难度 1-5
 * @returns {number|null} 绝对难度（1-10）；年级或 d 非法时返回 null
 */
function mapToAbs(grade, d) {
  const a = anchorOf(grade);
  const dd = Number(d);
  if (!a || !isFinite(dd) || dd < 1 || dd > 5) return null;
  const [gMin, gMax] = a;
  return gMin + Math.round((dd - 1) * (gMax - gMin) / 4);
}

module.exports = { ANCHOR, anchorOf, mapToAbs };
