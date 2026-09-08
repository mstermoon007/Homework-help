#!/usr/bin/env bash
# scripts/pre-commit.sh — 提交前核心校验（零依赖，无 Husky）
# 启用版本化钩子：git config core.hooksPath scripts/githooks
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/5] 静态质量检查（lint-check）"
npm run -s check-lint

echo "▶ [2/5] native 生成器契约/注册表/覆盖校验（verify:m4）"
npm run -s verify:m4

echo "▶ [3/5] 项目搭建校验（verify:m0）"
npm run -s verify

echo "▶ [4/5] 知识库 ↔ 生成器对齐校验（check-knowledge）"
npm run -s check-knowledge

echo "▶ [5/5] 标准答案自批改回归（verify:golden，错误答案 0）"
npm run -s verify:golden

echo "✅ 核心校验全部通过。"
