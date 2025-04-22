#!/bin/bash

artist="hudson-ingram"
base="http://localhost:3000"

echo "🖼 Fetching image filenames for $artist..."

urls=$(curl -s "$base/api/$artist/image-files" | grep -oE '"[^"]+"' | tr -d '"')

echo "🔍 Checking each image URL..."
for file in $urls; do
  full="$base/images/$file"
  status=$(curl -s -o /dev/null -w "%{http_code}" -I "$full")
  echo "/images/$file → $status"
done
