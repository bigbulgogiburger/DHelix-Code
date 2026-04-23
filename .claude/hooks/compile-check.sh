#!/usr/bin/env bash
# Node.js/TypeScript/Ink — PostToolUse(Edit|Write) 변경 파일 추적
# tsc --noEmit는 프로젝트 규모가 커 매 수정마다 실행하지 않는다.
# harness-review 또는 pre-commit 시 일괄 검사 대상을 위해 파일 목록만 누적.

HARNESS_MODE="${HARNESS_MODE:-suggest}"
[[ "$HARNESS_MODE" == "off" ]] && exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/' 2>/dev/null || echo "")
if [[ -n "$FILE_PATH" ]] && echo "$FILE_PATH" | grep -qiE "\.(tsx|jsx|ts|mts|cts)$"; then
  mkdir -p .claude/runtime
  echo "$FILE_PATH" >> .claude/runtime/changed-files.txt
  sort -u .claude/runtime/changed-files.txt -o .claude/runtime/changed-files.txt
fi
exit 0
