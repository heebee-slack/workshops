#!/bin/bash
# Stamp a fresh version on every app file reference (so phones never mix old and new files), commit, push.
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M%S)
# ./x.js, './x.js?v=…'  →  './x.js?v=$V'   (relative imports, dynamic imports, index.html refs)
perl -pi -e "s#((?:\\./|js/|css/)[\\w-]+\\.(?:js|css))(\\?v=\\w+)?#\$1?v=$V#g" index.html js/*.js
perl -pi -e "s#const VERSION = 'hbw-[\\w]+';#const VERSION = 'hbw-$V';#" sw.js
git add -A
git -c user.name="heebee-slack" -c user.email="gavish@heebeecoffee.com" commit -qm "${1:-Deploy} (v$V)"
GIT_TERMINAL_PROMPT=0 git push -q
echo "Deployed v$V — live on https://heebee-slack.github.io/workshops/ in about a minute"
