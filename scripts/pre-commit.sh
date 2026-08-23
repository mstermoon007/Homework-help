#!/usr/bin/env bash
# scripts/pre-commit.sh — 提交前核心校验（零依赖，无 Husky）
# 启用版本化钩子：git config core.hooksPath scripts/githooks
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/3] 项目搭建校验（verify-setup）"
npm run -s verify

echo "▶ [2/3] 知识库 ↔ 插件对齐校验（verify-knowledge-bank）"
npm run -s check-knowledge

echo "▶ [3/3] 全插件满分回归（regression-check）"
npm run -s check-regression

echo "✅ 核心校验全部通过。"
