#!/bin/bash

echo "🔍 Scanning server.js for broken/malformed URL fields..."

grep -oE "url: '(/[^']+)'" server.js | cut -d"'" -f2 | while read -r url; do
  echo "$url" | grep -E '\.(m4a|wav|mp3).*\.(m4a|wav|mp3)' > /dev/null
  if [ $? -eq 0 ]; then
    echo "❌ Suspicious: $url"
  fi
done
