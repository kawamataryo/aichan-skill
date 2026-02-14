#!/bin/bash

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# TypeScriptファイル以外はスキップ
if [[ -z "$FILE_PATH" || ( "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ) ]]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

REL_PATH="${FILE_PATH#$(pwd)/}"

# lambda/src/ 以外のファイルはスキップ
if [[ "$REL_PATH" != lambda/src/* ]]; then
  exit 0
fi

# Format（自動修正）
npx oxfmt "$FILE_PATH" 2>/dev/null || true

# Lint（自動修正）
LINT_OUTPUT=$(npx oxlint --fix "$FILE_PATH" 2>&1) || true
if echo "$LINT_OUTPUT" | grep -q "Found [1-9]"; then
  echo "Lint issues (auto-fixed where possible):"
  echo "$LINT_OUTPUT"
fi

# Typecheck（エラー報告）
TC_OUTPUT=$(npm run typecheck 2>&1)
if [[ $? -ne 0 ]]; then
  echo "TypeCheck errors:"
  echo "$TC_OUTPUT"
fi

exit 0
