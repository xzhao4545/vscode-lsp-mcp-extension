#!/bin/bash
# pre-commit hook: Test compliance check
# Ensures tests are updated when source code changes

set -e

echo "Running test compliance check..."

MODIFIED=$(git diff --cached --name-only --diff-filter=ACM)

# Files that require test updates
declare -A TEST_MAP=(
  ["src/client/tools/"]="src/test/mcp.test.ts"
  ["src/server/MCPTools.ts"]="src/test/mcp.test.ts"
  ["src/server/"]="src/test/mcp.test.ts"
  ["src/client/commands/"]="src/test/extension.test.ts"
  ["src/client/ServerConnection.ts"]="src/test/mcp.test.ts"
  ["src/server/McpServer.ts"]="src/test/mcp.test.ts"
)

# Check if source files were modified without test updates
for file in $MODIFIED; do
  # Skip if file is a test itself
  if [[ "$file" == src/test/* ]]; then
    continue
  fi

  # Check each source pattern
  for pattern in "${!TEST_MAP[@]}"; do
    if [[ "$file" == $pattern* ]]; then
      test_file="${TEST_MAP[$pattern]}"
      # Check if test file was modified
      if ! echo "$MODIFIED" | grep -q "$test_file"; then
        echo "WARNING: $file modified but $test_file not updated"
        echo "Consider adding/updating tests for this change"
      fi
    fi
  done
done

# Run type check on staged files
echo "Running type check..."
if ! git diff --cached --name-only | xargs -I {} sh -c 'test -f "{}" && echo "{}"' | grep -E '\.ts$' > /dev/null; then
  echo "No TypeScript files staged, skipping type check"
else
  npx tsc --noEmit 2>/dev/null || {
    echo "Type check failed. Run 'pnpm run check-types' for details"
    exit 1
  }
fi

echo "Test compliance check passed"
exit 0
