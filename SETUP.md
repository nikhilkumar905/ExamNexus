# ExamNexus: setup and maintenance guide

This guide covers everything you need to install, run, update and fix ExamNexus on a Windows PC.

```
ExamNexus/
├─ backend/    FastAPI API: auth, PDF → questions (RAG + Groq), exams, grading
├─ frontend/   Website (React + Vite)
├─ mobile/     Android / iOS app (React Native + Expo)
└─ scripts/    setup.ps1, start-all.ps1, allow-firewall.ps1
```
The website and the app use the **same backend and database**. Accounts, exams and results are shared between them.

---

## 1. Install these once

| Tool | Version | Get it |
|---|---|---|
| Python | 3.11 or newer | https://www.python.org/downloads/ (tick *Add to PATH*) |
| Node.js | 20 or newer | https://nodejs.org (LTS) |
| Git | any | https://git-scm.com |
| Expo Go (on the phone) | latest | Play Store / App Store |

## 2. Create the accounts and keys (once)

### MongoDB Atlas (database, free)
1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a **free M0 cluster**.
2. Go to **Security → Database Access → Add New Database User**. Use a password with only letters and numbers, so it doesn't need URL-encoding.
3. Go to **Security → Network Access → Add IP Address**. Add your IP, or `0.0.0.0/0` while developing.
4. Go to **Database → Connect → Drivers**, choose **Python** with the latest version, and copy the `mongodb+srv://...` string. Replace `<db_password>` with your real password. Leave *network compression* off.

### Groq (AI that writes the questions, free)
Go to https://console.groq.com/keys, click **Create API Key**, and copy it (it starts with `gsk_`).

## 3. First-time setup

```powershell
git clone https://github.com/nikhilkumar905/ExamNexus.git
cd ExamNexus
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```
This creates the Python virtual environment, installs all packages for the backend, website and app, and creates the three `.env` files from their `.env.example` files.

Then open **`backend\.env`** and fill in:

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string |
| `GROQ_API_KEY` | your Groq key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (see [Changing the AI model](#changing-the-ai-model)) |
| `JWT_SECRET` | any long random text. Generate one with: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `TEACHER_INVITE_CODE` | optional. If set, registering as a teacher requires this code |

`.env` files hold secrets and are **never committed** (`.gitignore` excludes them). Only the `.env.example` files are in the repo.

## 4. Run everything

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
```
This opens three windows:

| Window | What it is | Open |
|---|---|---|
| Backend :8000 | API | http://localhost:8000/docs |
| Website :5173 | website | http://localhost:5173 |
| Mobile (Expo) | app dev server | scan its QR code with Expo Go |

Options: add `-NoMobile` or `-NoWebsite` to skip one. To stop everything, close the windows, or press **Ctrl+C** in each one.

The first time, register **one teacher** and **one student** account.

### Running parts by hand

```powershell
# Backend
cd backend
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# Website
cd frontend
npm run dev
# Mobile
cd mobile
npx expo start
```
Add `--reload` to the backend command to restart it automatically when you edit Python files.

## 5. Using the app on a phone

1. The phone and the PC must be on the **same Wi-Fi**.
2. **Once per PC**, let the phone reach the PC through Windows Firewall. In an **administrator** PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\allow-firewall.ps1
   ```
   This marks your Wi-Fi as *Private* and opens ports 8000 (backend) and 8081 (Expo) on private networks only.
3. Run `start-all.ps1`. It writes the PC's current Wi-Fi IP into `mobile\.env` (`EXPO_PUBLIC_API_URL`) for you.
4. Scan the QR code in the *Mobile (Expo)* window with Expo Go (Android), or with the Camera app (iPhone).
5. To check the phone can reach the backend, open `http://<PC-IP>:8000/api/health` in the phone's browser. It should show `{"ok":true}`. The login screen also shows which server address the app is using.

To build an installable `.apk` that works without Expo Go, see [mobile/README.md](mobile/README.md#build-an-installable-app-apk--app-store).

## 6. Updating the project

### Get the latest code (on any PC)
```powershell
git pull
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1   # installs any new packages; keeps your .env files
```

### Make a change and publish it
```powershell
git checkout -b my-change        # optional: work on a branch
# ... edit code, test with start-all.ps1 ...
git add -A
git status                       # check that no .env file is listed
git commit -m "Describe the change"
git push                         # or: git push -u origin my-change
```

### Where to change things

| You want to… | Edit |
|---|---|
| Change an API endpoint or grading | `backend/app/routers/*.py` |
| Change how questions are generated | `backend/app/llm.py` (prompts), `backend/app/generation.py` (batching / verification) |
| Change chunking or retrieval | `backend/app/rag.py`, `CHUNK_SIZE` / `CHUNK_OVERLAP` in `.env` |
| Change a website page | `frontend/src/pages/...` |
| Change an app screen | `mobile/src/app/...` (each file is a screen) |
| Change app colours or sizing | `mobile/src/theme.js` |
| Add an API call (both clients) | `frontend/src/lib/api.js` **and** `mobile/src/lib/api.js` |

When you add a backend feature, update both clients. The two `api.js` files list the same endpoints.

### Adding packages
- **Backend:** `.venv\Scripts\pip install <pkg>`, then add it with its version to `backend/requirements.txt`.
- **Website:** run `npm install <pkg>` in `frontend/`.
- **Mobile:** run **`npx expo install <pkg>`** in `mobile/`, not `npm install`. It picks the version that matches the Expo SDK.

### Upgrading the Expo SDK (about once a year)
Expo Go on the phone only supports the newest SDK. When it says the project is incompatible:
```powershell
cd mobile
npx expo install expo@latest
npx expo install --fix
npx expo-doctor
```
Read the Expo SDK release notes, because some APIs get renamed. Then test the app on a phone.

### Changing the AI model
Groq retires models from time to time. To list the models your key can use:
```powershell
cd backend
.venv\Scripts\python -c "from groq import Groq; from app.config import get_settings; print([m.id for m in Groq(api_key=get_settings().groq_api_key).models.list().data])"
```
Pick a large chat model that supports JSON mode, set `GROQ_MODEL=` in `backend\.env`, and restart the backend.

## 7. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Website: "Cannot reach the server" | Backend not running | Start it (`start-all.ps1`) and check http://localhost:8000/api/health |
| Backend won't start: `ServerSelectionTimeoutError` … `localhost:27017` | `backend\.env` missing, or `MONGODB_URI` empty | Create or fill in `backend\.env` |
| Backend won't start: `CERTIFICATE_VERIFY_FAILED` … `certificate is not yet valid` | The PC clock is wrong | Settings → Time & language → Date & time: turn on *Set time automatically*, pick the right time zone, click *Sync now* |
| Backend won't start: timeout to `*.mongodb.net` | Your IP isn't allowed in Atlas | Atlas → Network Access → add your current IP |
| "Groq rejected the API key" | Wrong or placeholder `GROQ_API_KEY` | Paste a real key and restart the backend |
| "model … does not exist" (`model_not_found`) | Groq retired the model | See [Changing the AI model](#changing-the-ai-model) |
| Changes to `backend\.env` have no effect | `.env` is only read at startup | Restart the backend |
| Login says "Incorrect email or password" but the password is right | The email has a typo (for example `gmaill.com`) | Log in with the exact email you registered with |
| Phone: `java.io.IOException: Failed to download remote update` | Windows Firewall blocks Expo (Node.js) | Run `scripts\allow-firewall.ps1` as admin. If an old **Node.js JavaScript Runtime** rule says *Block*, open `wf.msc` → Inbound Rules and set it to *Allow*, or in an admin terminal run: `netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" new action=allow` |
| Phone: "Cannot reach the server at http://…" | Firewall blocks port 8000, the IP changed, or the phone is on a different network | Run `allow-firewall.ps1` as admin, restart with `start-all.ps1` (it refreshes the IP), and test `http://<PC-IP>:8000/api/health` in the phone browser |
| Expo: "Port 8081 is being used by another process" | An old Expo server is still running | Close old Expo windows, or find it with `netstat -ano \| findstr :8081` and run `taskkill /PID <pid> /T /F` |
| Expo: "Xcode must be fully installed…" | `i` (iOS simulator) was pressed on Windows | Answer **no**. On an iPhone, scan the QR code instead |
| Expo Go: "Project is incompatible with this version of Expo Go" | Expo Go is newer than the project's SDK | [Upgrade the Expo SDK](#upgrading-the-expo-sdk-about-once-a-year) |
| Two backends answer differently / changes don't show | Several backend windows are running | Close them all and start one |

## 8. Putting it online (optional, for real use)

For students to use the app outside your Wi-Fi:
1. **Database:** already online (Atlas). In Network Access, allow your server's IP.
2. **Backend:** deploy `backend/` to Render, Railway, Fly.io or a VPS. Use the start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and set the same variables as `backend\.env` in the host's dashboard. Add your website's address to `CORS_ORIGINS`.
3. **Website:** in `frontend/`, set `VITE_API_URL=https://your-backend` and run `npm run build`. Upload `frontend/dist/` to Netlify, Vercel or GitHub Pages.
4. **App:** set `EXPO_PUBLIC_API_URL=https://your-backend` in `mobile\.env`, then build with EAS (see [mobile/README.md](mobile/README.md)).

Always use **HTTPS** for the deployed backend. Never commit `.env` files or put keys in the code.
