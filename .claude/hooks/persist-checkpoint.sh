#!/usr/bin/env bash
# Stop — 세션 종료 시 체크포인트 저장 (/harness-resume 에서 복원)
# 브랜치명에서 ISSUE-KEY 패턴 감지 실패 시 조용히 exit.

HARNESS_MODE="${HARNESS_MODE:-suggest}"
[[ "$HARNESS_MODE" == "off" ]] && exit 0
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
ISSUE_KEY=$(echo "$BRANCH" | grep -oE "[A-Z]+-[0-9]+" || echo "")
[[ -z "$ISSUE_KEY" ]] && exit 0
mkdir -p .claude/runtime
cat > ".claude/runtime/checkpoint.md" << EOF
# Harness Checkpoint
- **Issue**: $ISSUE_KEY
- **Branch**: $BRANCH
- **Timestamp**: $(date -Iseconds)
- **Last Commit**: $(git log --oneline -1 2>/dev/null || echo "none")
## 복원
\`/harness-resume\` 로 workflow-state.json + checkpoint.md 재적용.
EOF
echo "[Harness] 체크포인트 저장됨 ($ISSUE_KEY)" >&2
exit 0
