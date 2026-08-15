#!/bin/bash
# Resolve Project Root
cd "$(dirname "$0")/.."

echo "🚀 Starting Nopubly Release Build..."
echo "📂 Project Root: $(pwd)"

# 1. Setup Java
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"

if ! command -v keytool &> /dev/null; then
    echo "❌ Error: Java is not installed or not in PATH."
    exit 1
fi

# 2. Generate Keystore if missing
KEYSTORE_PATH="android/app/release.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "🔑 Generating new Release Keystore..."
    keytool -genkey -v -keystore "$KEYSTORE_PATH" -alias nopubly-key -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Nopubly User, OU=App Dev, O=Nopubly, L=City, S=State, C=US"
else
    echo "✅ Keystore found."
fi

# 3. Build APK
echo "🏗️ Building signed APK..."
cd android
./gradlew clean
./gradlew assembleRelease

echo "\n✅ BUILD COMPLETE!"
echo "📂 APK Location: android/app/build/outputs/apk/release/app-release.apk"

echo "\n✅ BUILD COMPLETE!"
echo "📂 APK Location: android/app/build/outputs/apk/release/app-release.apk"
