#!/usr/bin/env bash
# scripts/pre-commit.sh — 提交前快速校验（零依赖，无 Husky）
# 启用版本化钩子：git config core.hooksPath scripts/githooks
#
# P28-42 · Pre-commit 与 Full Gate 分层
#
# Pre-commit（本脚本）：快速，只检查 syntax + lint + changed files
# Full Gate：npm run check-all（含 1570 generation / crawler / SVG / security 等）
#
# 开发时提交只跑本脚本；CI 和发版前跑 npm run check-all。

set -e
cd "$(dirname "$0")/.."

# ── 获取 staged .js 文件 ──
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM -- '*.js' 2>/dev/null || true)
if [ -z "$STAGED_JS" ]; then
  STAGED_COUNT=0
else
  STAGED_COUNT=$(echo "$STAGED_JS" | wc -l | tr -d ' ')
fi

# ── 1. Lint（全量，regex 扫描，快速）──
echo "▶ [1/2] 静态质量检查（lint-check）"
npm run -s check-lint

# ── 2. Syntax（仅 changed files）──
if [ "$STAGED_COUNT" -eq 0 ]; then
  echo "▶ [2/2] 语法检查：无 staged .js 文件，跳过"
else
  echo "▶ [2/2] 语法检查（$STAGED_COUNT 个 staged .js 文件）"
  FAILED=0
  echo "$STAGED_JS" | while IFS= read -r f; do
    if [ -f "$f" ]; then
      node --check "$f" 2>/dev/null || {
        echo "  ✗ FAIL: $f"
        node --check "$f" 2>&1 | sed 's/^/    /'
        FAILED=1
      }
    fi
  done
  if [ "$FAILED" -ne 0 ]; then
    echo "✗ 语法检查失败"
    exit 1
  fi
  echo "  ✓ $STAGED_COUNT 个文件语法正确"
fi

echo "✅ Pre-commit 通过。Full gate: npm run check-all"
