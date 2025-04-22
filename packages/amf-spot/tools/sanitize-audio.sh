#!/bin/bash

audio_dir="public/audio"
map_file="tools/audio_rename_map.txt"
> "$map_file"

echo "🔍 Renaming audio files in $audio_dir ..."

find "$audio_dir" -type f | while read -r filepath; do
  filename=$(basename "$filepath")
  dir=$(dirname "$filepath")

  # Sanitize: lowercase, remove special chars, replace spaces with dashes
  cleaned=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9.]+/-/g' | sed 's/-\+/-/g')

  if [ "$filename" != "$cleaned" ]; then
    mv "$filepath" "$dir/$cleaned"
    echo "$filename -> $cleaned" | tee -a "$map_file"
  fi
done

echo "✅ Done. Mapping saved to $map_file"
