#!/bin/bash
# Capture Android crash logs for Nopubly
# Usage: Connect your Android device via USB, enable USB debugging, then run this script

echo "🔍 Nopubly Crash Log Capture"
echo "=============================="
echo ""
echo "Prerequisites:"
echo "1. Connect your Android device via USB"
echo "2. Enable 'USB Debugging' in Developer Options"
echo "3. Accept the USB debugging prompt on your phone"
echo ""
echo "Press ENTER when ready..."
read

# Setup ADB path
export PATH="$PATH:/Users/alex/Library/Android/sdk/platform-tools"

# Check if device is connected
echo "Checking for connected devices..."
adb devices

echo ""
echo "Clearing old logs..."
adb logcat -c

echo ""
echo "📱 Now OPEN the Nopubly app on your phone"
echo "Monitoring logs (Press Ctrl+C to stop)..."
echo ""

# Filter for crashes and Nopubly-specific logs
adb logcat | grep -E "(AndroidRuntime|FATAL|Nopubly|com.nopubly|ReactNative|ReactNativeJS)"
