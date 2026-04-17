#!/bin/bash
# pre-commit hook: Protocol pattern compliance
# Ensures new protocol messages follow the pattern:
# 1. Interface defined in src/shared/protocol.ts
# 2. Added to ClientMessage or ServerMessage union
# 3. Handler implemented in both McpServer.ts and ServerConnection.ts

set -e

PROTOCOL_FILE="src/shared/protocol.ts"
SERVER_FILE="src/server/McpServer.ts"
CONNECTION_FILE="src/client/ServerConnection.ts"

echo "Running protocol pattern compliance check..."

MODIFIED=$(git diff --cached --name-only --diff-filter=ACM)

# Check if protocol.ts was modified
PROTOCOL_MODIFIED=false
for file in $MODIFIED; do
  if [[ "$file" == "$PROTOCOL_FILE" ]]; then
    PROTOCOL_MODIFIED=true
    break
  fi
done

if [[ "$PROTOCOL_MODIFIED" == "true" ]]; then
  echo "protocol.ts modified - checking message pattern..."

  # Get the diff for protocol.ts
  PROTOCOL_DIFF=$(git diff --cached "$PROTOCOL_FILE")

  # Check if new interface was added (looks for "interface.*Message" pattern)
  if echo "$PROTOCOL_DIFF" | grep -E "^\+.*interface.*Message" > /dev/null; then
    echo "New message interface detected in protocol.ts"

    # Check that ClientMessage or ServerMessage union was also updated
    if ! echo "$PROTOCOL_DIFF" | grep -E "ClientMessage|ServerMessage" > /dev/null; then
      echo "ERROR: New message interface added but ClientMessage/ServerMessage union not updated"
      echo "Add the new message type to the appropriate union in protocol.ts"
      exit 1
    fi

    echo "Union types updated - good!"
  fi
fi

# Check if McpServer.ts or ServerConnection.ts were modified
SERVER_MODIFIED=false
CONNECTION_MODIFIED=false
for file in $MODIFIED; do
  case "$file" in
    "$SERVER_FILE") SERVER_MODIFIED=true ;;
    "$CONNECTION_FILE") CONNECTION_MODIFIED=true ;;
  esac
done

# If protocol.ts was modified, ensure both handlers were updated
if [[ "$PROTOCOL_MODIFIED" == "true" ]]; then
  if [[ "$SERVER_MODIFIED" != "true" ]] || [[ "$CONNECTION_MODIFIED" != "true" ]]; then
    echo "ERROR: protocol.ts modified but handlers not updated in both files"
    echo "When adding a new protocol message, you must implement handlers in:"
    echo "  - src/server/McpServer.ts (handleMessage switch)"
    echo "  - src/client/ServerConnection.ts (handleMessage switch)"
    exit 1
  fi
  echo "Handler implementations found in both files - good!"
fi

echo "Protocol pattern compliance check passed"
exit 0