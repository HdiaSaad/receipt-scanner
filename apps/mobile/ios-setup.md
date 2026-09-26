# iOS Setup Guide (macOS + Xcode Required)

All steps below must be run on a Mac with Xcode installed.

## Prerequisites

- macOS 13 (Ventura) or later
- Xcode 15 or later (install from the Mac App Store)
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+ and pnpm installed
- An Apple Developer account (free or paid)

---

## Step 1: Install dependencies and build the web app

From the repo root:

```bash
pnpm install
pnpm --filter mobile build
```

---

## Step 2: Add the iOS platform

```bash
cd apps/mobile
pnpm cap:add:ios
# equivalent to: npx cap add ios
```

This creates the `ios/` directory containing the Xcode project.

---

## Step 3: Sync web assets to the iOS project

```bash
pnpm cap:sync
# equivalent to: npx cap sync ios
```

Run this command after every `pnpm build` to keep the native project in sync.

---

## Step 4: Configure Info.plist permissions

Open `ios/App/App/Info.plist` and add the following permission keys inside the root `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>Receipt Scanner utilise la caméra pour prendre en photo vos tickets de caisse.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Receipt Scanner accède à votre galerie pour importer des tickets de caisse.</string>
```

---

## Step 5: Open in Xcode and configure the target

```bash
pnpm cap:open
# equivalent to: npx cap open ios
```

In Xcode:

1. Select the `App` target in the project navigator.
2. Go to the **General** tab → set **Minimum Deployments** to `iOS 15.0`.
3. Go to **Signing & Capabilities**:
   - Enable **Automatically manage signing**.
   - Select your Apple Developer **Team**.
   - Confirm the **Bundle Identifier** is `com.yourapp.receiptscanner`.
   - Click **+ Capability** and add **Sign in with Apple**.

---

## Step 6: Set the VITE_API_URL environment variable

Copy `.env.example` to `.env` and update the URL:

```bash
cp .env.example .env
# Edit .env and set:
# VITE_API_URL=https://your-backend.railway.app
```

Rebuild and re-sync after changing the URL:

```bash
pnpm build
pnpm cap:sync
```

---

## Step 7: Run on Simulator

In Xcode, select any **iOS 15+** Simulator from the device picker and press **Run (⌘R)**.

Expected behaviour:
- App launches to the Login page.
- Navigation tabs are visible.
- Camera tab shows scanner buttons (camera capture does not work in the Simulator — test on a real device).
- No crash on launch.

---

## Step 8: Run on a physical device

1. Connect your iPhone via USB.
2. Trust the developer certificate on the device (Settings → General → VPN & Device Management).
3. Select your device in Xcode and press **Run (⌘R)**.

---

## Subsequent builds

After any code change:

```bash
# From apps/mobile
pnpm build
pnpm cap:sync
# Then build/run from Xcode
```
