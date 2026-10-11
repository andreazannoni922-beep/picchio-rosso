#!/bin/sh
# Scarica foto e video della bozza (generati con Higgsfield) in public/media.
# Uso: npm run fetch-media
set -e
cd "$(dirname "$0")/.."
URL="$(cat scripts/media-zip-url.txt)"
mkdir -p public/media
curl -fsSL -o /tmp/picchio-rosso-media.zip "$URL"
unzip -oq /tmp/picchio-rosso-media.zip -d /tmp/picchio-rosso-media
cp /tmp/picchio-rosso-media/media/* public/media/
echo "Media in public/media:"; ls public/media
