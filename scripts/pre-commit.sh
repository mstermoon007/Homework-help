#!/usr/bin/env bash
# scripts/pre-commit.sh — 提交前核心校验（零依赖，无 Husky）
# 启用版本化钩子：git config core.hooksPath scripts/githooks
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/5] 静态质量检查（lint-check）"
npm run -s check-lint

echo "▶ [2/5] 全插件接口合规性检查（check-plugin-interfaces）"
node dev/check-plugin-interfaces.js || exit 1

echo "▶ [3/5] 项目搭建校验（verify-setup）"
npm run -s verify

echo "▶ [4/5] 知识库 ↔ 插件对齐校验（verify-knowledge-bank）"
npm run -s check-knowledge

echo "▶ [5/5] 全插件满分回归 + 边界用例（regression-check）"
npm run -s check-regression

echo "✅ 核心校验全部通过。"
