# ExamNexus: PDF → MCQ Offline Exam

A teacher uploads a PDF. ExamNexus generates multiple-choice questions from it with RAG + Groq. The teacher assigns exams to students, and students take them **with the internet switched off**. After submitting, the student reconnects, the answers upload and are graded, and the teacher reviews, adjusts and publishes scores.

It works as a **website** and as an **Android app**. Both use the same backend and database, so accounts, exams and results are shared.

| Part | Folder | Built with |
|---|---|---|
| Backend (API) | `backend/` | FastAPI, MongoDB Atlas, Groq (`openai/gpt-oss-120b`), fastembed `BAAI/bge-small-en-v1.5` |
| Website | `frontend/` | React + Vite |
| Mobile app | `mobile/` | React Native + Expo SDK 58 (Android APK; iOS possible) |
| Helper scripts | `scripts/` | `setup.ps1`, `start-all.ps1`, `allow-firewall.ps1`, `build-apk.ps1` |

More detail: [SETUP.md](SETUP.md) (full setup and troubleshooting) · [APK-GUIDE.md](APK-GUIDE.md) (building and sharing the app) · [mobile/README.md](mobile/README.md)

---

## How to run everything (step by step)

All commands are for **PowerShell on Windows**, run from the project folder unless a step says otherwise.

### Step 1: Install the tools (once per PC)
- **Python 3.11+**: https://www.python.org/downloads/ (tick *Add to PATH*)
- **Node.js 20+ (LTS)**: https://nodejs.org
- **Git**: https://git-scm.com

### Step 2: Get the accounts and keys (once)
1. **MongoDB Atlas** (free database): create an M0 cluster, add a database user, allow your IP in *Network Access*, and copy the `mongodb+srv://…` connection string. Full steps are in [SETUP.md](SETUP.md#mongodb-atlas-database-free).
2. **Groq** (free AI): create a key at https://console.groq.com/keys. It starts with `gsk_`.
3. **Expo** (free, only needed to build the Android app): sign up at https://expo.dev/signup.

### Step 3: Download and install the project (once per PC)
```powershell
git clone https://github.com/nikhilkumar905/ExamNexus.git
cd ExamNexus
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```
This installs all packages for the backend, website and app, and creates the `.env` files from their `.env.example` files.

### Step 4: Fill in the backend secrets (once)
Open `backend\.env` and set:
```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
JWT_SECRET=<any long random text>
```
To generate a JWT secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. `.env` files are never committed to Git.

### Step 5: Allow phones through the Windows Firewall (once per PC, as admin)
Open PowerShell as **Administrator** in the project folder and run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\allow-firewall.ps1
```
This sets your Wi-Fi to *Private* and opens ports 8000 (backend) and 8081 (Expo) on private networks only. You can skip this step if you only use the website on this PC.

### Step 6: Start the servers (every time)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1 -NoMobile
```
Two windows open. **Keep them open** while the website or app is in use.

| Window | Address | Check |
|---|---|---|
| Backend | http://localhost:8000 | http://localhost:8000/api/health shows `{"ok":true}` |
| Website | http://localhost:5173 | the login page opens |

Leave out `-NoMobile` to also start the Expo dev server (only needed for development with Expo Go, see Step 8). To stop everything, close the windows.

### Step 7: Use the website
1. Open http://localhost:5173.
2. Register a **teacher** account and a **student** account.
3. Teacher: **Documents** → upload a PDF → **Generate** questions → **Question bank** → select questions → **Create exam** → assign students.
4. Student: **My exams** → **Download paper** → turn Wi-Fi off → answer → **Submit** → turn Wi-Fi on. The answers upload automatically.
5. Teacher: **Exams & results** → **Results & grading** → review, set the final score → **Publish** (or **Publish all results**).

### Step 8: Use the Android app
**Option A: installed app (APK)**
1. Build it, which takes about 20 minutes in Expo's cloud plus any queue time:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
   ```
2. Download the `.apk` from https://expo.dev/accounts/nikhilsah/projects/pdf-mcq-exam/builds and send it to the phone, for example by WhatsApp, Drive or a USB cable.
3. On the phone, uninstall any older "PDF Exam", open the `.apk` from the **Files** app, choose **Package installer**, and allow *Install unknown apps* if asked. If Play Protect warns you, tap **Install anyway**.
4. The phone must be on the **same Wi-Fi** as the PC, with the backend running (Step 6).
5. The login screen shows `Server: http://<PC-IP>:8000 · v<version>`. Check that it shows your PC's IP and the latest version.

The server address is built into the APK from `mobile/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`. If your PC's IP changes (check with `ipconfig`), update it there and build again.

**Option B: development with Expo Go** (instant reload while coding)
1. Install **Expo Go** from the Play Store or App Store.
2. Run `scripts\start-all.ps1` without `-NoMobile`. It writes the PC's current Wi-Fi IP into `mobile\.env` for you.
3. Scan the QR code in the *Mobile (Expo)* window: with Expo Go on Android, or with the Camera app on iPhone.

### Step 9: Check it from the phone (if something fails)
Open `http://<PC-IP>:8000/api/health` in the phone's browser.
- `{"ok":true}` means the network is fine. Restart the app and look at the exact error message it shows.
- If it doesn't load, the phone isn't reaching the PC. Check that both are on the same Wi-Fi, mobile data is off on the phone, the backend window is open, and Step 5 was done.

### Step 10: Update the project and publish changes
```powershell
git pull                                                        # get the latest code
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1      # install any new packages (keeps your .env files)
# ...make changes, test with start-all.ps1...
git add -A
git status                                                      # make sure no .env file is listed
git commit -m "Describe the change"
git push
```
After changing the mobile app, raise `"version"` in `mobile/app.json` and run `build-apk.ps1` again.

---

## How it works

### Question generation (RAG)
1. **Upload:** the PDF text is extracted (pypdf), split into overlapping chunks, embedded, and stored in the `chunks` collection.
2. **Retrieve:** with a topic, the most similar chunks are found by cosine similarity. Without one, chunks are sampled evenly across the whole PDF.
3. **Generate:** Groq writes MCQs grounded in the retrieved text, in strict JSON mode at low temperature.
4. **Verify:** a second, independent Groq call answers each question from the same text. Questions where the two answers disagree are discarded. You can turn this off with `VERIFY_QUESTIONS=false`.

### Keeping the correct answer fixed
- The correct answer is stored as an **option id** (`a`–`d`) tied to the option text, never as a position. Options are shuffled per student, and grading still compares ids, so the correct answer stays the same.
- Creating an exam **snapshots** its questions and answer key. Later edits to the question bank never change an existing exam or its grades.
- The answer key is never sent to the student's device. Grading happens on the server.

### Offline exam flow (student)
1. **Download paper** (online). The server returns questions with a per-student shuffle and no answers.
2. **Turn off Wi-Fi.** Questions appear and the timer starts only after the app detects there is no internet.
3. Answer offline. Every answer is saved to the device, so nothing is lost.
4. Reconnecting during the exam blocks the screen and is **logged as a violation**. Leaving the tab is logged too.
5. **Submit**, then turn the Wi-Fi back on. The answers upload automatically and the server grades them.
6. If the upload fails, the answers stay saved and upload the next time the dashboard opens with internet.

Internet detection uses `navigator.onLine` plus a probe to a public URL (`VITE_CONNECTIVITY_URL`). The probe is needed because a backend on `localhost` stays reachable even with Wi-Fi off.

### Teacher panel
- **Documents:** upload PDFs and generate questions (count, optional topic, difficulty).
- **Question bank:** review questions (the correct one is shown in green), edit them, change the correct option, delete, and select questions to create an exam.
- **Exams & results:** assign or reassign students. View the average, highest, lowest, pass rate, score distribution, per-question accuracy and how often each option was picked. Review integrity flags and violations. **Set the final score** with remarks, and publish per student or all at once.

## Limitations
- A website cannot switch Wi-Fi off or on by itself. It can only detect the change and enforce the rules. A native app has the same limit on iOS.
- Do not refresh the page while offline. There is no service worker, so the page can't reload without internet. Answers already given are kept and resume once you're back online.
- Violations are recorded on the client. A technical student could tamper with them, which is why the teacher reviews flags before publishing.
- Scanned (image-only) PDFs have no text layer and need OCR first.

## Mobile app notes
- The app's code lives in `mobile/src/` (screens in `src/app/`, API client in `src/lib/api.js`). It mirrors the website: `api.js` lists the same endpoints, so add new endpoints to both clients.
- On Android, PDF uploads use Expo's native uploader (`expo-file-system` `uploadAsync`), because Expo SDK 58's `fetch` can't send files picked on the phone.
- During an exam, the Android back button is disabled, and leaving the app is recorded as a violation.
- Build and sharing details, and fixes for build errors, are in [APK-GUIDE.md](APK-GUIDE.md).
