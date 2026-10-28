# PDF Exam: mobile app (React Native / Expo)

The Android and iOS app for PDF → MCQ Offline Exam. It uses the same backend and database as the website in `frontend/`, so the same accounts, exams and results work in both.

- **Expo SDK 58**, Expo Router (screens live in `src/app/`)
- Teacher and student screens, the same as the website
- The layout adapts to the screen width: one column on phones, two or three on tablets and in landscape, and text that scales with the screen

## Run it on your phone (development)

1. **Start the backend so the phone can reach it.** From `backend/`:
   ```powershell
   .venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   `--host 0.0.0.0` makes the backend reachable from other devices on your Wi-Fi. The first time, Windows Firewall may ask about Python: allow it on **Private networks**.

2. **Point the app at your PC.** Copy `.env.example` to `.env` and set your PC's Wi-Fi IP (find it with `ipconfig`, under *Wireless LAN adapter Wi-Fi → IPv4 Address*):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.0.246:8000
   ```
   Don't use `localhost`. On a phone, `localhost` means the phone itself.

3. **Start the app.** From `mobile/`:
   ```powershell
   npm install
   npx expo start
   ```

4. **Open it on the phone.** Install **Expo Go** from the Play Store or App Store. The phone must be on the **same Wi-Fi** as the PC. Then:
   - **Android:** scan the QR code in the terminal with Expo Go.
   - **iPhone:** scan it with the Camera app.

   If the login screen says it can't reach the server, check the address shown at the bottom of the login screen, and make sure the backend is running with `--host 0.0.0.0`.

## Taking an exam on the phone

The flow is the same as the website:
1. Download the paper.
2. Turn on **Airplane mode**, or switch off Wi-Fi and mobile data. The questions appear and the timer starts.
3. Answer the questions. Every answer is saved on the phone.
4. Submit, then turn the internet back on. The answers upload automatically.

The phone app adds two protections:
- The Android back button is disabled during the exam.
- Switching to another app is recorded as a violation, like leaving the tab on the website.

## Build an installable app (APK / App Store)

From the project root:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```
This builds the app in Expo's cloud in about 10–15 minutes. Download the `.apk` from your Expo dashboard and share it. The APK uses the server address in **`eas.json` → `build.preview.env`**, not `.env`.

See [APK-GUIDE.md](../APK-GUIDE.md) for sharing, updating, Google Play and troubleshooting.

## Project layout

```
src/
  app/                    screens (Expo Router: every file is a route)
    _layout.js            root stack and auth provider
    login.js, register.js
    teacher/              tabs: Documents, Question bank, Exams
    student/              tabs: My exams, My results
    exam-results/[examId].js   teacher: results & grading
    result/[attemptId].js      student: answer review
    take-exam/[examId].js      student: the offline exam
  components/             shared UI (ui.js, Sheet, StudentPicker, OptionList, RoleTabs)
  lib/                    api, auth, storage (AsyncStorage), connectivity (NetInfo), examStore
  theme.js                colours and useLayout() for screen-size scaling
```

`src/lib/` mirrors `frontend/src/lib/`. The differences: storage is async (AsyncStorage), internet detection uses NetInfo, and leaving the app is detected with `AppState`.
