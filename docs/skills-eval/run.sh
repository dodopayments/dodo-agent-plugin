#!/bin/bash
# Runs every task x arm in parallel with OpenCode in a clean config. Output: runs/<id>/events.jsonl
cd "$(dirname "$0")"
MODEL=anthropic/claude-sonnet-5
# Clean OpenCode config: only opencode-clean.json, no user config, skills or Claude Code files.
CLEAN=$(mktemp -d)
mkdir -p "$CLEAN/opencode" && cp opencode-clean.json "$CLEAN/opencode/opencode.json"
for d in runs/*/; do
  id=$(basename "$d")
  task=${id%%-*}
  prompt=$(python3 -c "import json;print(json.load(open('tasks.json'))['$task'])")
  (
    cd "$d"
    start=$(date +%s)
    XDG_CONFIG_HOME="$CLEAN" OPENCODE_DISABLE_CLAUDE_CODE=1 OPENCODE_DISABLE_EXTERNAL_SKILLS=1 \
      opencode run --auto -m "$MODEL" --format json --title "bench $id" "$prompt" > events.jsonl 2> stderr.txt
    echo $(( $(date +%s) - start )) > seconds.txt
  ) &
done
wait
echo done
