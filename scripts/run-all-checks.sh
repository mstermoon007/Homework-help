#!/usr/bin/env bash
# scripts/run-all-checks.sh — 唯一全量检查入口（CI 等价）
#
# 此脚本与 .github/workflows/ci.yml 使用同一入口、同一脚本、同一环境要求。
# 即：npm run check-all
#
# 本地用法：bash scripts/run-all-checks.sh
# 或直接：npm run check-all
#
# pre-commit 钩子（scripts/pre-commit.sh）只跑轻量三步（lint/verify/syntax）。

set -e
cd "$(dirname "$0")/.."
exec npm run check-all
