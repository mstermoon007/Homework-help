#!/usr/bin/env bash
# scripts/run-all-checks.sh — 本地运行所有检查脚本的统一入口
# 
# 此脚本旨在在 pre-commit 钩子或本地开发阶段快速验证项目健康度。
# 完整 CI 包含更多检查，本脚本精选核心项，耗时约 2-5 分钟。

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "============================================"
echo "  Homework Help — 本地检查套件"
echo "============================================"
echo ""

# 1. verify-setup.js — 项目结构与基础完整性
echo "▶ Running verify-setup.js ..."
node dev/verify-setup.js
echo ""

# 2. regression-check.js — 回归测试（生成/批试/难度）
echo "▶ Running regression-check.js ..."
node dev/regression-check.js
echo ""

echo "============================================"
echo "  All core checks passed ✅"
echo "============================================"
echo ""
echo "提示：完整 CI 还包含 verify-knowledge-bank.js、check-plugin-interfaces.js 等。
如需运行全部，请使用：npm test"