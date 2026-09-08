#!/usr/bin/env bash
# scripts/run-all-checks.sh — 本地运行全部检查的统一入口（native-only 门禁链）
#
# 此脚本在本地开发阶段完整验证项目健康度，与 .github/workflows/ci.yml 等价，
# 耗时约 2-5 分钟。pre-commit 钩子（scripts/pre-commit.sh）只跑其中快速核心 5 步。

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "============================================"
echo "  Homework Help — 本地全量检查套件"
echo "============================================"

run() {
  echo ""
  echo "▶ $1"
  shift
  "$@"
}

# 1. 基础环境与规范
run "verify:setup" npm run -s verify:setup
run "check:sw-version" npm run -s check:sw-version
run "check:contrast" npm run -s check:contrast

# 2. UI 边界
run "verify:ui-boundary" npm run -s verify:ui-boundary
run "verify:practice-page" npm run -s verify:practice-page

# 3. 生成器契约 / 注册表 / 覆盖（549 KP / 583 QT）
run "verify:m4" npm run -s verify:m4

# 4. 聚合硬门禁 + 自批改回归
run "npm test" npm test
run "verify:golden（错误答案 0）" npm run -s verify:golden

# 5. M0-M2 统一网关
run "verify:syntax" npm run -s verify:syntax
run "verify:m0" npm run -s verify
run "verify:m1" npm run -s verify:m1
run "verify:m2" npm run -s verify:m2

# 6. 架构分层与 Frozen Core
run "verify:layers" npm run -s verify:layers
run "verify:frozen-core" npm run -s verify:frozen-core

# 7. Node 单元/契约测试全套
run "node:test 全套" node --test test/*.test.js test/unit/*.test.js tests/generator/*.test.js tests/strategy/*.test.js

echo ""
echo "============================================"
echo "  All checks passed ✅"
echo "============================================"
