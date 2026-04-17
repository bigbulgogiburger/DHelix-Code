#!/usr/bin/env bash
# Usage: run-cli-turns.sh <turns.jsonl> <project-dir>
# Runs each turn in sequence using dbcode CLI, resuming the same session
set -euo pipefail

TURNS_FILE_ARG="$1"
PROJECT_DIR="$2"
DBCODE_BIN="${DBCODE_BIN:-node $(pwd)/dist/index.js}"

# Use absolute paths so redirects work correctly after cd into PROJECT_DIR
SCRIPT_CWD="$(pwd)"
TURNS_FILE="$(cd "$(dirname "$TURNS_FILE_ARG")" && pwd)/$(basename "$TURNS_FILE_ARG")"
mkdir -p "$PROJECT_DIR"
PROJECT_DIR_ABS="$(cd "$PROJECT_DIR" && pwd)"
LOG_DIR="$PROJECT_DIR_ABS/.cli-turn-logs"

mkdir -p "$LOG_DIR"

SESSION_ID=""
TURN=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  TURN=$((TURN + 1))
  PROMPT=$(echo "$line" | jq -r .prompt)
  NAME=$(echo "$line" | jq -r .name)

  echo "--- Turn $TURN: $NAME ---"

  # Helper: extract the dhelix JSON result object from raw output.
  # Looks for the LAST JSON object containing a "result" key (avoids matching
  # debug/dotenv lines like { debug: true } that appear before the real output).
  extract_json() {
    node -e "
      let d = '';
      process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        // Find all {...} blocks, pick the last one that contains \"result\"
        const blocks = [];
        let depth = 0, start = -1;
        for (let i = 0; i < d.length; i++) {
          if (d[i] === '{') { if (depth++ === 0) start = i; }
          else if (d[i] === '}') { if (--depth === 0 && start >= 0) { blocks.push(d.slice(start, i+1)); start = -1; } }
        }
        const result = blocks.reverse().find(b => { try { const p = JSON.parse(b); return 'result' in p; } catch { return false; } });
        console.log(result || '{}');
      });
    " 2>/dev/null
  }

  if [[ -z "$SESSION_ID" ]]; then
    # First turn — creates a new session
    RAW_OUT=$(cd "$PROJECT_DIR_ABS" && $DBCODE_BIN -p "$PROMPT" --output-format json 2>"$LOG_DIR/turn-$TURN.err" || true)
    OUT=$(echo "$RAW_OUT" | extract_json || echo "$RAW_OUT")
    SESSION_ID=$(echo "$OUT" | jq -r '.sessionId // empty' 2>/dev/null || echo "")
  else
    # Subsequent turns — prefer -r if sessionId known, fallback to -c (continue most recent)
    if [[ -n "$SESSION_ID" ]]; then
      RAW_OUT=$(cd "$PROJECT_DIR_ABS" && $DBCODE_BIN -r "$SESSION_ID" -p "$PROMPT" --output-format json 2>"$LOG_DIR/turn-$TURN.err" || true)
    else
      RAW_OUT=$(cd "$PROJECT_DIR_ABS" && $DBCODE_BIN -c -p "$PROMPT" --output-format json 2>"$LOG_DIR/turn-$TURN.err" || true)
    fi
    OUT=$(echo "$RAW_OUT" | extract_json || echo "$RAW_OUT")
    # Update session ID from response in case it changes
    NEW_SESSION_ID=$(echo "$OUT" | jq -r '.sessionId // empty' 2>/dev/null || echo "")
    [[ -n "$NEW_SESSION_ID" ]] && SESSION_ID="$NEW_SESSION_ID"
  fi

  echo "$OUT" > "$LOG_DIR/turn-$TURN.json"
  echo "  Session: $SESSION_ID"
  echo "  Output saved: $LOG_DIR/turn-$TURN.json"

done < "$TURNS_FILE"

echo ""
echo "=== ALL TURNS COMPLETE ==="
echo "Session ID: $SESSION_ID"
echo "Logs: $LOG_DIR"
