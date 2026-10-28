"""Student-side: list assigned exams, download paper, submit answers, view results.

Offline exam flow:
1. Student starts the exam while online -> POST /start returns the paper
   (questions + shuffled options, never the answer key).
2. The client requires the internet to be off before showing questions and
   records any violation (coming back online, leaving the tab).
3. After finishing, the student reconnects and the client POSTs /submit.
   Grading happens here on the server against the stored answer key.
"""

import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from ..config import get_settings
from ..db import get_db, oid, serialize
from ..schemas import SubmitIn
from ..security import require_student

router = APIRouter(prefix="/api/student", tags=["student"])


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _build_paper(exam: dict, attempt: dict) -> dict:
    qmap = {q["id"]: q for q in exam["questions"]}
    questions = []
    for qid in attempt["question_order"]:
        q = qmap[qid]
        omap = {o["id"]: o for o in q["options"]}
        questions.append({
            "id": qid,
            "question": q["question"],
            "options": [omap[oid_] for oid_ in attempt["option_orders"][qid]],
        })
    return {
        "attempt_id": str(attempt["_id"]),
        "exam_id": str(exam["_id"]),
        "title": exam["title"],
        "duration_minutes": exam["duration_minutes"],
        "total_marks": exam["total_marks"],
        "downloaded_at": attempt["downloaded_at"],
        "questions": questions,
    }


@router.get("/exams")
async def my_exams(student: dict = Depends(require_student)):
    db = get_db()
    exams = await db.exams.find(
        {"assigned_student_ids": student["_id"]}, {"questions": 0}
    ).sort("created_at", -1).to_list(None)
    attempts = await db.attempts.find({"student_id": student["_id"]}).to_list(None)
    by_exam = {a["exam_id"]: a for a in attempts}
    teachers = await db.users.find(
        {"_id": {"$in": list({e["teacher_id"] for e in exams})}}, {"name": 1}
    ).to_list(None)
    tmap = {t["_id"]: t["name"] for t in teachers}

    out = []
    for e in exams:
        a = by_exam.get(e["_id"])
        out.append({
            "id": str(e["_id"]),
            "title": e["title"],
            "teacher": tmap.get(e["teacher_id"], ""),
            "duration_minutes": e["duration_minutes"],
            "total_marks": e["total_marks"],
            "created_at": e["created_at"],
            "status": a["status"] if a else "not_started",
            "attempt_id": str(a["_id"]) if a else None,
            "published": bool(a and a.get("published")),
        })
    return out


@router.post("/exams/{exam_id}/start")
async def start_exam(exam_id: str, student: dict = Depends(require_student)):
    db = get_db()
    exam = await db.exams.find_one({"_id": oid(exam_id), "assigned_student_ids": student["_id"]})
    if not exam:
        raise HTTPException(404, "Exam not found or not assigned to you")

    attempt = await db.attempts.find_one({"exam_id": exam["_id"], "student_id": student["_id"]})
    if attempt:
        if attempt["status"] == "submitted":
            raise HTTPException(409, "You have already submitted this exam")
        # Re-download (e.g. page refreshed before going offline): same paper, logged.
        await db.attempts.update_one({"_id": attempt["_id"]}, {"$inc": {"downloads": 1}})
        return _build_paper(exam, attempt)

    # Each student gets their own question order and option order.
    question_order = [q["id"] for q in exam["questions"]]
    random.shuffle(question_order)
    option_orders = {}
    for q in exam["questions"]:
        ids = [o["id"] for o in q["options"]]
        random.shuffle(ids)
        option_orders[q["id"]] = ids

    attempt = {
        "exam_id": exam["_id"],
        "student_id": student["_id"],
        "status": "started",
        "downloaded_at": datetime.now(timezone.utc),
        "downloads": 1,
        "question_order": question_order,
        "option_orders": option_orders,
    }
    try:
        res = await db.attempts.insert_one(attempt)
    except DuplicateKeyError:  # double click / two tabs
        attempt = await db.attempts.find_one({"exam_id": exam["_id"], "student_id": student["_id"]})
        return _build_paper(exam, attempt)
    attempt["_id"] = res.inserted_id
    return _build_paper(exam, attempt)


@router.post("/attempts/{attempt_id}/submit")
async def submit(attempt_id: str, body: SubmitIn, student: dict = Depends(require_student)):
    db = get_db()
    attempt = await db.attempts.find_one({"_id": oid(attempt_id), "student_id": student["_id"]})
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    if attempt["status"] == "submitted":
        # Idempotent: the client may retry the sync after a flaky reconnect.
        return {"ok": True, "already_submitted": True, "published": attempt.get("published", False)}
    exam = await db.exams.find_one({"_id": attempt["exam_id"]})
    if not exam:
        raise HTTPException(404, "Exam no longer exists")

    # Grade against the snapshotted answer key.
    results = []
    correct_count = 0
    for q in exam["questions"]:
        chosen = body.answers.get(q["id"])
        is_correct = chosen == q["correct_option_id"]
        correct_count += is_correct
        results.append({"question_id": q["id"], "chosen": chosen, "correct": is_correct})
    auto_score = correct_count * exam["marks_per_question"]

    # Flags for the teacher to review (we don't reject, the teacher decides).
    now = datetime.now(timezone.utc)
    duration = timedelta(minutes=exam["duration_minutes"])
    grace = timedelta(minutes=get_settings().submission_grace_minutes)
    flags = []
    if now > _aware(attempt["downloaded_at"]) + duration + grace:
        flags.append("late_upload")
    if body.offline_started_at and _aware(body.submitted_at) - _aware(body.offline_started_at) > duration + timedelta(minutes=1):
        flags.append("over_time")
    if not body.offline_started_at:
        flags.append("never_offline")
    if attempt.get("downloads", 1) > 1:
        flags.append("paper_redownloaded")

    update = {
        "status": "submitted",
        "answers": {k: v for k, v in body.answers.items()},
        "results": results,
        "correct_count": correct_count,
        "total_questions": len(exam["questions"]),
        "auto_score": auto_score,
        "final_score": auto_score if exam.get("auto_publish") else None,
        "published": bool(exam.get("auto_publish")),
        "remarks": "",
        "offline_started_at": body.offline_started_at,
        "submitted_at": body.submitted_at,
        "synced_at": now,
        "violations": [v.model_dump() for v in body.violations],
        "flags": flags,
    }
    await db.attempts.update_one({"_id": attempt["_id"], "status": "started"}, {"$set": update})
    return {"ok": True, "published": update["published"]}


@router.get("/results")
async def my_results(student: dict = Depends(require_student)):
    db = get_db()
    attempts = await db.attempts.find({"student_id": student["_id"], "status": "submitted"}).sort("synced_at", -1).to_list(None)
    exams = await db.exams.find({"_id": {"$in": [a["exam_id"] for a in attempts]}}, {"title": 1, "total_marks": 1}).to_list(None)
    emap = {e["_id"]: e for e in exams}
    out = []
    for a in attempts:
        e = emap.get(a["exam_id"])
        if not e:
            continue
        published = a.get("published", False)
        out.append({
            "attempt_id": str(a["_id"]),
            "exam_id": str(a["exam_id"]),
            "title": e["title"],
            "total_marks": e["total_marks"],
            "submitted_at": a.get("submitted_at"),
            "published": published,
            "score": a.get("final_score") if published else None,
            "remarks": a.get("remarks", "") if published else "",
        })
    return out


@router.get("/results/{attempt_id}")
async def result_detail(attempt_id: str, student: dict = Depends(require_student)):
    db = get_db()
    a = await db.attempts.find_one({"_id": oid(attempt_id), "student_id": student["_id"], "status": "submitted"})
    if not a:
        raise HTTPException(404, "Result not found")
    if not a.get("published"):
        raise HTTPException(403, "Your teacher hasn't published this result yet")
    exam = await db.exams.find_one({"_id": a["exam_id"]})
    review = [
        {
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "correct_option_id": q["correct_option_id"],
            "chosen": a["answers"].get(q["id"]),
            "explanation": q.get("explanation", ""),
        }
        for q in exam["questions"]
    ]
    return {
        "title": exam["title"],
        "total_marks": exam["total_marks"],
        "score": a["final_score"],
        "auto_score": a["auto_score"],
        "correct_count": a["correct_count"],
        "total_questions": a["total_questions"],
        "remarks": a.get("remarks", ""),
        "review": review,
    }
