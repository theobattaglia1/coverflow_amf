#!/bin/bash

map_file="$1"

if [ ! -f "$map_file" ]; then
  echo "❌ Map file not found: $map_file"
  exit 1
fi

echo "🔍 Replacing references using $map_file (excluding node_modules)..."

cat "$map_file" | while read -r line; do
  OLD=$(echo "$line" | cut -d' ' -f1)
  NEW=$(echo "$line" | cut -d'>' -f2 | sed 's/^ *//')

  echo "🔁 $OLD → $NEW"

  find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.html" \) \
    -not -path "./node_modules/*" \
    -exec sed -i '' "s|$OLD|$NEW|g" {} +
done

echo "✅ All safe references updated."
