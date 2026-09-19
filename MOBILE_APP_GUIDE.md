# Turf & Taste — Mobile App (Android & iOS) Deployment Guide

This project is configured with **Capacitor** to reuse the entire web frontend, UI components, business logic, routing, and backend API across **Web, Android, and iOS**.

---

## 1. System Environment & Installed Dependencies

The following native toolchains and SDKs are installed and configured on your Windows machine:

| Component | Version / Location | Status |
| :--- | :--- | :--- |
| **Java JDK** | OpenJDK 17 (Eclipse Temurin 17.0.20.1) at `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot` | Installed & `JAVA_HOME` configured |
| **Official Android CLI** | `android.exe` at `C:\Users\devan\AppData\AndroidCLI` | Installed & added to PATH |
| **Android SDK** | `C:\Users\devan\AppData\Local\Android\Sdk` | Configured via `local.properties` |
| **Android Platforms** | Android 14 (API 34) & Android 15 (API 35) | Installed |
| **Android Build-Tools** | 34.0.0 & 35.0.0 | Installed |
| **Android Platform-Tools** | ADB 37.0.1 | Installed |
| **Capacitor CLI & Plugins** | Core, Android, iOS, SplashScreen, StatusBar, App | Installed |

---

## 2. Quick Command Reference

All commands should be executed from the project root:

```bash
# 1. Build the web app and copy assets into both android/ and ios/ native projects
npm run cap:sync

# 2. Build Android Debug APK from command line (No Android Studio required!)
cd android
.\gradlew.bat assembleDebug

# Output APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. Backend API Connection for Mobile

When running on the web, the app connects to `/api` (local Vite proxy). On mobile apps, the app runs locally inside a native Webview (`https://localhost`).

To connect the mobile app to your Express backend:
1. In development on an Android Emulator:
   Set `VITE_API_URL=http://10.0.2.2:5000/api` in your `.env.local`
2. In development on a physical device on the same Wi-Fi:
   Set `VITE_API_URL=http://<YOUR_PC_LAN_IP>:5000/api` (e.g. `http://192.168.1.10:5000/api`)
3. In production:
   Set `VITE_API_URL=https://your-domain.com/api` before running `npm run cap:sync`.

---

## 4. Google Play Store Submission (Android)

Google Play Store requires an **Android App Bundle (.aab)** signed with an upload keystore and targeting the latest Android SDK (API 34 or 35).

### Step 1: Generate your Upload Keystore
Run the following command in PowerShell inside the `android` folder:
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore turf-and-taste-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Remember the passwords you enter.

### Step 2: Configure Signing Properties
Open `android/release-signing.properties` (this file is already gitignored for security) and fill in:
```properties
storeFile=turf-and-taste-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

### Step 3: Build Release Android App Bundle (.aab)
Run:
```powershell
cd android
.\gradlew.bat bundleRelease
```
The output file will be generated at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 4: Upload to Google Play Console
1. Log in to [Google Play Console](https://play.google.com/console).
2. Create a new App:
   - **App name**: Turf & Taste
   - **Default language**: English (United States / India)
   - **App or Game**: App
   - **Free or Paid**: Free
3. Navigate to **Production** (or **Closed testing**) -> **Create new release**.
4. Drag and drop `app-release.aab`.
5. Fill out store listing details (Descriptions, Screenshots, Privacy Policy URL).
6. Submit for review!

---

## 5. Apple App Store Submission (iOS)

iOS apps must be compiled on **macOS** using **Xcode**. The project structure is already fully prepared under `ios/`.

### Step 1: Push Project to GitHub & Clone on a Mac
Push the repository to GitHub:
```bash
git add .
git commit -m "Configure mobile native apps for Android and iOS"
git push origin main
```
Clone the repository on your Mac and install npm dependencies:
```bash
npm install
npm run cap:sync
```

### Step 2: Open iOS Project in Xcode
Run:
```bash
npm run cap:ios
# Or manually open: ios/App/App.xcworkspace in Xcode
```

### Step 3: Configure Signing & Capabilities in Xcode
1. In Xcode, click on the **App** project in the left navigator.
2. Select the **Signing & Capabilities** tab.
3. Check **Automatically manage signing**.
4. Select your **Apple Developer Team**.
5. The Bundle Identifier is preset to `com.turfandtaste.app`.

### Step 4: Archive and Upload to App Store Connect
1. In the Xcode top toolbar, choose **Any iOS Device (arm64)** as the target.
2. From the top menu, select **Product** -> **Archive**.
3. Once the archive completes, the Organizer window will appear.
4. Click **Distribute App** -> **App Store Connect** -> **Upload**.
5. Follow the prompts to upload your build to TestFlight and the App Store.

---

## 6. Directory Structure Overview

```
TurfAndTaste/
├── android/                   # Native Android project
│   ├── app/
│   │   ├── build.gradle      # Package ID, SDK versions (35), signing config, AAB bundle config
│   │   └── src/main/         # AndroidManifest.xml, icons, res assets
│   ├── release-signing.properties  # Local release keystore config (gitignored)
│   ├── local.properties      # Android SDK directory path (gitignored)
│   └── gradlew.bat           # Gradle build tool executable
├── ios/                       # Native iOS project
│   └── App/
│       ├── App/Info.plist    # iOS permissions, display name, orientations
│       └── App.xcworkspace   # Xcode workspace to open on Mac
├── capacitor.config.json      # Capacitor global config (appId, appName, splash/status styling)
├── src/                       # Shared React Web + Mobile Codebase
│   ├── services/api.js       # Dynamic API base URL handling Web & Native
│   └── styles/variables.css  # Safe-area insets for notches & home bars
└── package.json               # cap:sync, cap:android, cap:ios scripts
```
