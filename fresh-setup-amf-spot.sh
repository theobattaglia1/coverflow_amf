#!/usr/bin/env bash
set -e

############################################################
# CONFIG
############################################################
AMF_SPOT_DIR="packages/amf-spot"
BACKUP_DIR="${AMF_SPOT_DIR}_backup_$(date +%Y%m%d_%H%M%S)"

############################################################
# 1) BACK UP OLD FOLDER
############################################################
echo "Renaming '$AMF_SPOT_DIR' to '$BACKUP_DIR'..."
mv "$AMF_SPOT_DIR" "$BACKUP_DIR"

############################################################
# 2) CREATE FRESH NEXT.JS APP
############################################################
echo "Creating fresh Next.js (TypeScript) project in '$AMF_SPOT_DIR'..."
npx create-next-app@latest "$AMF_SPOT_DIR" --use-npm --ts

# If you want to add Tailwind at creation, you can either:
# 1) Answer the prompt after create-next-app asks you
#    (like "Would you like to use Tailwind? (Y/n)") 
# 2) OR pass a flag (sometimes: --tailwind), depending on the create-next-app version.

############################################################
# 3) PRESERVE ENV FILE (OPTIONAL)
############################################################
# Example: if you used a .env file directly in packages/amf-spot
if [ -f "$BACKUP_DIR/.env" ]; then
  cp "$BACKUP_DIR/.env" "$AMF_SPOT_DIR/.env"
  echo "Copied .env from backup to new project."
fi

# If your environment variables or config files live elsewhere,
# replicate them here similarly.

############################################################
# DONE
############################################################
echo "Fresh setup for amf-spot complete."
echo "Your old project is now in '$BACKUP_DIR'."
