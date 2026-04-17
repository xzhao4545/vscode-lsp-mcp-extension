#!/bin/bash
# SessionStart hook: Add bilingual EN/CN comments to modified .ts files
# Runs once per Claude Code session

set -euo pipefail

# Get .ts files modified since last commit
MODIFIED=$(git diff --name-only --diff-filter=ACM HEAD -- '*.ts' 2>/dev/null || echo "")

if [ -z "$MODIFIED" ]; then
  echo "{}"
  exit 0
fi

for FILE in $MODIFIED; do
  if [ -f "$FILE" ]; then
    claude --print "Add bilingual EN/CN comments to this file. For each class, method, and inline comment:
- Keep all existing code unchanged
- JSDoc format: /** English description // CN: 中文描述 */
- Inline format: // EN: English // CN: 中文
- Property JSDoc: /** propertyName - EN description // CN: 中文描述 */
Only add/modify comments, do not change any code logic." "$FILE" > /dev/null 2>&1 || true
  fi
done

echo "{}"
