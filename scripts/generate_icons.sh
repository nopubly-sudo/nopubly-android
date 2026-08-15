#!/bin/bash
# Generate Android Icons from source image
# Usage: ./scripts/generate_icons.sh <source_image_path>

# Resolve Project Root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

SOURCE="$1"
if [ -z "$SOURCE" ]; then
    echo "Usage: $0 <source_image>"
    exit 1
fi

RES_DIR="android/app/src/main/res"

# Sizes
# mdpi: 48x48
# hdpi: 72x72
# xhdpi: 96x96
# xxhdpi: 144x144
# xxxhdpi: 192x192

echo "🎨 Generating Icons from $SOURCE..."

sips -s format png -z 48 48   "$SOURCE" --out "$RES_DIR/mipmap-mdpi/ic_launcher.png"
sips -s format png -z 72 72   "$SOURCE" --out "$RES_DIR/mipmap-hdpi/ic_launcher.png"
sips -s format png -z 96 96   "$SOURCE" --out "$RES_DIR/mipmap-xhdpi/ic_launcher.png"
sips -s format png -z 144 144 "$SOURCE" --out "$RES_DIR/mipmap-xxhdpi/ic_launcher.png"
sips -s format png -z 192 192 "$SOURCE" --out "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png"

# Round icons (approximation)
sips -s format png -z 48 48   "$SOURCE" --out "$RES_DIR/mipmap-mdpi/ic_launcher_round.png"
sips -s format png -z 72 72   "$SOURCE" --out "$RES_DIR/mipmap-hdpi/ic_launcher_round.png"
sips -s format png -z 96 96   "$SOURCE" --out "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png"
sips -s format png -z 144 144 "$SOURCE" --out "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png"
sips -s format png -z 192 192 "$SOURCE" --out "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png"

echo "✅ Icons updated!"
