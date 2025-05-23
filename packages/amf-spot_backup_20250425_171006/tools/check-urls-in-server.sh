#!/bin/bash

echo "🔍 Checking all 'url:' entries in server.js..."

grep -oE "url: '(/[^']+)'" server.js | cut -d"'" -f2 | while read -r url; do
  path="public$url"
  if [ -f "$path" ]; then
    echo "✅ $url → OK"
  else
    echo "❌ $url → MISSING"
  fi
done
