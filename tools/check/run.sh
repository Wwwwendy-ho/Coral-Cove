#!/bin/sh
# Runs every check on the GitHub copy: lint and dead code, the style audit, the word-help unit tests and the
# browser smoke test. Serves the site itself on a spare port while the smoke test runs.
# Usage (from the repository):  sh tools/check/run.sh
# First time: (cd tools/check && npm install && npx playwright install chromium) and pip install tinycss2
cd "$(dirname "$0")" || exit 1
ROOT=../..
PORT=${PORT:-8830}
fail=0
echo "== lint";        node lint.js || fail=1
echo "== styles";      python3 css_audit.py || fail=1
echo "== mirror";      for f in index.html library.js words.js words-data.js storage.js sw.js seed-data.js; do
                         cmp -s "$ROOT/$f" "$ROOT/coral-cove/$f" || { echo "coral-cove/$f differs: run sh tools/mirror.sh"; fail=1; }; done
echo "== word help";   node "$ROOT/tools/words/test_words.js" | tail -1 || fail=1
echo "== browser";
( cd "$ROOT" && exec python3 -m http.server "$PORT" >/dev/null 2>&1 ) & SERVER=$!
sleep 1
node smoke.js "$PORT" || fail=1
kill "$SERVER" 2>/dev/null
[ "$fail" = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit "$fail"
