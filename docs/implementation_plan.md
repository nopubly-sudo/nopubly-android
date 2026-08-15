# Viral Growth: "Share Your Safety"

## Goal Description
To drive organic growth, we need users to share the app. The best moment is **right after they clean their phone** (Relief/Pride moment). We will add a "Share Result" feature.

## Proposed Changes

### [MODIFY] [App.tsx](file:///Users/alex/Library/Mobile%20Documents/com~apple~CloudDocs/nopubly/App.tsx)
-   **Add React Native Share**: Import `Share` from `react-native`.
-   **"Spread the Word" Button**:
    -   When scan is clean (or cleaned), show a button: "🎉 Tell Friends I'm Safe".
    -   **Message**: "I just cleaned 3 spyware apps from my phone with Nopubly! Check if your phone is listening to you: [App Link]"
-   **"Panic Share"**:
    -   In the emergency section: "⚠️ Alert Friends about Spyware".

### [MODIFY] [i18n.ts](file:///Users/alex/Library/Mobile%20Documents/com~apple~CloudDocs/nopubly/i18n.ts)
-   Add `shareMsg`, `spreadWord`, `cleanSuccess` keys.

## Verification Plan
1.  **Mock Scan**: Run a scan.
2.  **Click Share**: Verify the native Android share sheet opens with the pre-filled viral text.
