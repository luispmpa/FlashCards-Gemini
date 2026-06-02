#!/bin/bash
# Installs project dependencies so linters, type-checks, tests and builds work
# in Claude Code on the web sessions (used by the nightly improvement routine).
set -euo pipefail

# Only needed in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm install (not ci) so the container's cached state can be reused on resume.
npm install --no-audit --no-fund
