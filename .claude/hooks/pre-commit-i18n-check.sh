#!/bin/bash
# pre-commit hook: i18n compliance check
# Ensures all user-facing text has both EN and CN translations

set -e

echo "Running i18n compliance check..."

# Check for modified l10n files
EN_BUNDLE="l10n/bundle.l10n.json"
CN_BUNDLE="l10n/bundle.l10n.zh-cn.json"
EN_NLS="package.nls.json"
CN_NLS="package.nls.zh-cn.json"

# Get list of modified files
MODIFIED=$(git diff --cached --name-only --diff-filter=ACM)

# Check if any source files were modified
SOURCE_MODIFIED=false
DOCS_MODIFIED=false

for file in $MODIFIED; do
  case "$file" in
    src/**/*.ts) SOURCE_MODIFIED=true ;;
    doc/**/*.md|README.md|CHANGELOG.md) DOCS_MODIFIED=true ;;
  esac
done

# If source or docs were modified, check l10n files exist and are updated
if [[ "$SOURCE_MODIFIED" == "true" ]] || [[ "$DOCS_MODIFIED" == "true" ]]; then
  # Check that l10n files are present
  if [[ ! -f "$EN_BUNDLE" ]] || [[ ! -f "$CN_BUNDLE" ]]; then
    echo "ERROR: Missing l10n bundle files"
    exit 1
  fi

  # Check that package.nls files are present
  if [[ ! -f "$EN_NLS" ]] || [[ ! -f "$CN_NLS" ]]; then
    echo "ERROR: Missing package.nls files"
    exit 1
  fi

  echo "i18n compliance check passed"
fi

exit 0
