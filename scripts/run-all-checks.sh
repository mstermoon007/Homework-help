#!/usr/bin/env bash
# scripts/run-all-checks.sh — 本地运行全部检查的统一入口（冻结基线门禁链）
#
# 此脚本在本地开发阶段完整验证项目健康度，与 .github/workflows/ci.yml 等价，
# 耗时约 3-6 分钟（含 verify:allow-gen 1570 对串行真实生成）。pre-commit 钩子（scripts/pre-commit.sh）只跑其中 lint / verify / syntax 三步。

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

# 1. 版本一致性
run "check:sw-version" npm run -s check:sw-version

# 2. 静态质量与语法
run "check-lint" npm run -s check-lint
run "verify:syntax" npm run -s verify:syntax

# 3. Node 单元/契约测试全套
run "npm test" npm test

# 4. M0 聚合门禁（kbl validate + runtime + uniqueness + access + dir）
run "verify" npm run -s verify

# 5. P24-02 ALLOW 真实性门禁（1570 个 KBL ALLOW 映射逐个真实生成，串行约 2-4 分钟）
run "verify:allow-gen" npm run -s verify:allow-gen

echo ""
echo "============================================"
echo "  All checks passed ✅"
echo "============================================"
