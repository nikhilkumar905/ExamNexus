# ExamNexus: PDF → MCQ Offline Exam

A teacher uploads a PDF. The app generates multiple-choice questions from it with RAG + Groq. The teacher assigns exams to students, and students take them **with the internet switched off**. After submitting, the student reconnects, the answers upload and are graded, and the teacher reviews, adjusts and publishes scores.

- **Frontend (website):** React (Vite), in `frontend/`
- **Mobile app:** React Native (Expo), in `mobile/`. See [mobile/README.md](mobile/README.md)
- **Backend:** FastAPI, in `backend/`
- **Database:** MongoDB Atlas
- **LLM:** Groq (`openai/gpt-oss-120b` by default)
- **Embeddings:** `BAAI/bge-small-en-v1.5`, run locally via fastembed (free, no API key)

## Quick start

**[SETUP.md](SETUP.md) has the full guide:** accounts and keys, first-time setup, running on a phone, updating, and fixes for common errors.

```powershell
git clone https://github.com/nikhilkumar905/ExamNexus.git
cd ExamNexus
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1       # install everything, create .env files
# fill in backend\.env (MONGODB_URI, GROQ_API_KEY, JWT_SECRET)
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1   # backend + website + mobile
```
- Website: http://localhost:5173
- API docs: http://localhost:8000/docs
- Phone: scan the QR code in the "Mobile (Expo)" window with Expo Go

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

## Mobile app
The React Native app in `mobile/` is built. To run it on your phone with Expo Go, see [mobile/README.md](mobile/README.md). It talks to the same backend, so start the backend with `--host 0.0.0.0` to make it reachable from the phone.

The table below shows how the website's browser-specific code maps to the app:

| File | Replace with |
|---|---|
| `src/lib/storage.js` | `@react-native-async-storage/async-storage` |
| `src/lib/connectivity.js` | `@react-native-community/netinfo` (`isInternetReachable`) |
| `visibilitychange` in `TakeExam.jsx` | `AppState` change events (`background`) |
| `react-router-dom` | `@react-navigation/native` |

`src/lib/api.js`, `src/lib/examStore.js` and the exam state machine in `TakeExam.jsx` carry over almost unchanged. The backend needs no changes.
