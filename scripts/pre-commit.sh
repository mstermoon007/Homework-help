#!/usr/bin/env bash
# scripts/pre-commit.sh — 提交前核心校验（零依赖，无 Husky）
# 启用版本化钩子：git config core.hooksPath scripts/githooks
#
# 冻结基线（v4.3.0）门禁链：lint → M0 聚合门禁 → 全量语法检查。
# M0（npm run verify）= kbl-validate + kbl-runtime + kbl-uniqueness + kbl-access + kbl-dir，
# 为原 verify:kbl 迁移门禁的超集。
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/3] 静态质量检查（lint-check）"
npm run -s check-lint

echo "▶ [2/3] M0 聚合门禁（verify = kbl validate+runtime+uniqueness+access+dir）"
npm run -s verify

echo "▶ [3/3] JS 语法检查（check-syntax）"
npm run -s verify:syntax

echo "✅ 冻结基线门禁通过。"
