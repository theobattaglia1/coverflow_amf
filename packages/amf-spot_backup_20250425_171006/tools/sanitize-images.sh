#!/bin/bash

image_dir="public/images"
map_file="tools/image_rename_map.txt"
> "$map_file"

echo "🖼 Renaming image files in $image_dir ..."

find "$image_dir" -type f | while read -r filepath; do
  filename=$(basename "$filepath")
  dir=$(dirname "$filepath")

  cleaned=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9.]+/-/g' | sed 's/-\+/-/g')

  if [ "$filename" != "$cleaned" ]; then
    mv "$filepath" "$dir/$cleaned"
    echo "$filename -> $cleaned" | tee -a "$map_file"
  fi
done

echo "✅ Done. Mapping saved to $map_file"
