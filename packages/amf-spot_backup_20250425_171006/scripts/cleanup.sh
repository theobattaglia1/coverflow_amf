#!/usr/bin/env bash
set -e
echo "→ Cleaning JS files (excluding node_modules) in $(pwd)"
export LC_CTYPE=C

# 1. Remove BOM
find . -type f -name '*.js' -not -path './node_modules/*' \
  -exec perl -i -pe 's/^\x{FEFF}//;' {} +

# 2. Replace curly quotes
find . -type f -name '*.js' -not -path './node_modules/*' \
  -exec perl -i -pe 's/[“”]/"/g; s/[‘’]/'\''/g;' {} +

# 3. Remove patch markers
find . -type f -name '*.js' -not -path './node_modules/*' \
  -exec sed -i '' \
    -e '/^--- /d' \
    -e '/^\+\+\+ /d' \
    -e '/^@@ /d' {} \;

echo "✓ Cleanup complete"
