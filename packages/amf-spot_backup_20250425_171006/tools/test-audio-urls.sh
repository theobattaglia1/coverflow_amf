#!/bin/bash

artist="hudson-ingram"
base="http://localhost:3000"

echo "🔍 Fetching audio URLs for $artist..."

urls=$(curl -s "$base/api/$artist/audio-files" | grep -oE '"/audio/[^"]+' | tr -d '"')

echo "🎧 Checking each audio URL..."
for url in $urls; do
  full="$base$url"
  status=$(curl -s -o /dev/null -w "%{http_code}" -I "$full")
  echo "$url → $status"
done
