#!/bin/bash
# Adds the 0.8.0 arm: runs/<task>-new with the single dodo-payments skill and the single dodopayments server.
set -euo pipefail
cd "$(dirname "$0")"
SKILLS="$(cd ../../skills && pwd)"  # the plugin's vendored skills/
for task in t1 t2 t3; do
  kind=express; [ $task = t1 ] && kind=next
  src=runs/$task-none; d=runs/$task-new
  rm -rf $d && mkdir -p $d
  (cd $src && git archive HEAD) | tar -x -C $d
  mkdir -p $d/.opencode/skills && cp -R $SKILLS/* $d/.opencode/skills/
  cat > $d/opencode.json <<'J'
{ "$schema": "https://opencode.ai/config.json",
  "mcp": { "dodopayments": { "type": "remote", "url": "https://mcp.dodopayments.com/mcp?auth=optional", "enabled": true } } }
J
  cp -c -R deps/$kind/node_modules deps/$kind/package-lock.json $d/ 2>/dev/null || cp -R deps/$kind/node_modules deps/$kind/package-lock.json $d/
  printf 'node_modules/\n' > $d/.gitignore
  (cd $d && git init -q && git add -A && git -c user.email=b@b -c user.name=bench commit -qm starter)
done
