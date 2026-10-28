# Android APK: build and share

The app is built in Expo's cloud (EAS Build). You don't need Android Studio. The free plan is enough.

## One-time setup
1. Create a free account at https://expo.dev/signup.
2. Install the build tool: `npm install -g eas-cli`
3. Log in: `eas login`

The project is already linked to Expo (`extra.eas.projectId` in `mobile/app.json`). The signing key (keystore) is stored on Expo's servers, so every future build uses the same key and phones can install updates over the old version. Don't delete it from the Expo dashboard.

## Build
```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```
The build takes about 10–15 minutes. Download the `.apk` from
https://expo.dev/accounts/nikhilsah/projects/pdf-mcq-exam/builds
or run `eas build:list --platform android --limit 3`. Add `-Wait` to the script to keep the window open until the build finishes.

## The server address inside the APK
The APK does **not** read `mobile/.env`, because that file is never uploaded. The address is set in **`mobile/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`**.

- `http://192.168.0.246:8000` only works on your own Wi-Fi, with the backend running on your PC.
- If your PC's IP changes, or you deploy the backend online, edit that value and **build again**. An installed APK can't change its address.
- Plain `http://` is allowed by `expo-build-properties` (`usesCleartextTraffic`) in `app.json`. Once the backend is on HTTPS, you can remove that setting.

## Share it
- Send the `.apk` by WhatsApp, email, Google Drive, or attach it to a GitHub Release. Don't commit it to the repo.
- On the phone: open the file, allow **Install unknown apps** for that app when Android asks, then tap **Install**.
- iPhones can't install `.apk` files. An iPhone build needs an Apple Developer account ($99/year).

## Updating the app
1. Change the code and test it with Expo Go (`scripts\start-all.ps1`).
2. Raise `"version"` in `mobile/app.json` (for example `1.0.1`). EAS raises the internal build number by itself.
3. Run `build-apk.ps1` again and share the new `.apk`. Installing it replaces the old app and keeps the student's login.

## Google Play (optional)
A Play Console account costs $25 once. Set the real HTTPS backend in `eas.json` → `build.production.env`, then run `eas build --platform android --profile production`. That makes an `.aab` file to upload in the Play Console.

## Problems
| Error | Fix |
|---|---|
| `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` | An EAS prompt crashed on Windows. Always build with `--non-interactive`; the script already does |
| `Unexpected argument` | Use `--profile preview`, not `--local=false` |
| The APK says "Cannot reach the server" | Check `EXPO_PUBLIC_API_URL` in `eas.json`, check that the phone is on the same Wi-Fi and the backend is running with `--host 0.0.0.0`, then rebuild if the address changed |
| `Not logged in` | Run `eas login` |
| The APK downloads but tapping it does nothing | Open it from the **Files** app and choose **Package installer**, not TeraBox or WPS. Allow *Install unknown apps* for that app. If Play Protect warns you, tap **Install anyway** |
| Login works but PDF upload says it can't reach the server | Install version 1.0.2 or later; the login screen shows the version. Older builds sent the file with `fetch`, which Expo SDK 58 can't do for phone files |
| Build fails in *Install dependencies* with `npm error Missing: … from lock file` | `package-lock.json` is out of date. In `mobile/`, run `npm install`, commit the lock file, and build again. `mobile/.npmrc` keeps peer dependencies in the lock file, which Expo's servers need |
| Build fails with any other error | Open the build on expo.dev and read the first red phase in the log |
