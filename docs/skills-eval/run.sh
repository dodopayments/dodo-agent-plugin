#!/bin/bash
# Runs every task x arm in parallel with OpenCode in a clean config. Output: runs/<id>/events.jsonl
cd "$(dirname "$0")"
MODEL=anthropic/claude-sonnet-5
# Clean OpenCode config: only opencode-clean.json, no user config, skills or Claude Code files.
CLEAN=$(mktemp -d)
mkdir -p "$CLEAN/opencode" && cp opencode-clean.json "$CLEAN/opencode/opencode.json"
pids=()
for d in runs/*/; do
  id=$(basename "$d")
  task=${id%%-*}
  prompt=$(python3 -c "import json;print(json.load(open('tasks.json'))['$task'])")
  (
    cd "$d"
    start=$(date +%s)
    XDG_CONFIG_HOME="$CLEAN" OPENCODE_DISABLE_CLAUDE_CODE=1 OPENCODE_DISABLE_EXTERNAL_SKILLS=1 \
      opencode run --auto -m "$MODEL" --format json --title "bench $id" "$prompt" > events.jsonl 2> stderr.txt
    rc=$?
    echo $(( $(date +%s) - start )) > seconds.txt
    # `opencode run` can exit 0 after an error event (expired sign-in, unknown model), so check the
    # events too. A failed run must not be scored: the starter would typecheck as "pass".
    if [ $rc -ne 0 ] || grep -q '"type":"error"' events.jsonl || ! grep -q '"step-finish"' events.jsonl; then
      echo "FAILED: $id (exit $rc); see $d/events.jsonl and $d/stderr.txt" >&2
      rm -f typecheck.txt
      exit 1
    fi
    # Build check read by score.py: PASS, or the tsc output.
    if out=$(npx tsc --noEmit 2>&1); then echo PASS > typecheck.txt; else printf '%s\n' "$out" > typecheck.txt; fi
  ) &
  pids+=($!)
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=$((failed + 1)); done
if [ $failed -gt 0 ]; then echo "$failed run(s) failed; do not score them" >&2; exit 1; fi
echo done
