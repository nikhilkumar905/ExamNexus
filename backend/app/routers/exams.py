"""Teacher-side exam management, results analytics and score assignment."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db, oid, serialize
from ..schemas import AssignIn, ExamCreate, GradeIn
from ..security import require_teacher

router = APIRouter(prefix="/api", tags=["exams"])


async def _validate_students(student_ids: list[str]) -> list:
    ids = [oid(s) for s in dict.fromkeys(student_ids)]
    found = await get_db().users.count_documents({"_id": {"$in": ids}, "role": "student"})
    if found != len(ids):
        raise HTTPException(400, "One or more students not found")
    return ids


async def _own_exam(exam_id: str, teacher: dict) -> dict:
    exam = await get_db().exams.find_one({"_id": oid(exam_id), "teacher_id": teacher["_id"]})
    if not exam:
        raise HTTPException(404, "Exam not found")
    return exam


@router.get("/students")
async def list_students(teacher: dict = Depends(require_teacher)):
    users = await get_db().users.find({"role": "student"}, {"name": 1, "email": 1}).sort("name", 1).to_list(None)
    return [serialize(u) for u in users]


@router.post("/exams")
async def create_exam(body: ExamCreate, teacher: dict = Depends(require_teacher)):
    db = get_db()
    qids = [oid(q) for q in dict.fromkeys(body.question_ids)]
    found = await db.questions.find({"_id": {"$in": qids}, "teacher_id": teacher["_id"]}).to_list(None)
    if len(found) != len(qids):
        raise HTTPException(400, "Some questions were not found")
    by_id = {q["_id"]: q for q in found}

    # Snapshot the questions + answer key so later question-bank edits can't change this exam.
    snapshot = [
        {
            "id": str(qid),
            "question": by_id[qid]["question"],
            "options": by_id[qid]["options"],
            "correct_option_id": by_id[qid]["correct_option_id"],
            "explanation": by_id[qid].get("explanation", ""),
        }
        for qid in qids
    ]
    exam = {
        "teacher_id": teacher["_id"],
        "title": body.title.strip(),
        "questions": snapshot,
        "duration_minutes": body.duration_minutes,
        "marks_per_question": body.marks_per_question,
        "total_marks": body.marks_per_question * len(snapshot),
        "auto_publish": body.auto_publish,
        "assigned_student_ids": await _validate_students(body.student_ids),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.exams.insert_one(exam)
    exam["_id"] = res.inserted_id
    return serialize(exam)


@router.get("/exams")
async def list_exams(teacher: dict = Depends(require_teacher)):
    db = get_db()
    exams = await db.exams.find({"teacher_id": teacher["_id"]}, {"questions": 0}).sort("created_at", -1).to_list(None)
    out = []
    for e in exams:
        s = serialize(e)
        s["num_assigned"] = len(e["assigned_student_ids"])
        s["num_submitted"] = await db.attempts.count_documents({"exam_id": e["_id"], "status": "submitted"})
        out.append(s)
    return out


@router.get("/exams/{exam_id}")
async def get_exam(exam_id: str, teacher: dict = Depends(require_teacher)):
    return serialize(await _own_exam(exam_id, teacher))


@router.put("/exams/{exam_id}/assign")
async def assign(exam_id: str, body: AssignIn, teacher: dict = Depends(require_teacher)):
    exam = await _own_exam(exam_id, teacher)
    ids = await _validate_students(body.student_ids)
    await get_db().exams.update_one({"_id": exam["_id"]}, {"$set": {"assigned_student_ids": ids}})
    return {"ok": True, "assigned": len(ids)}


@router.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, teacher: dict = Depends(require_teacher)):
    exam = await _own_exam(exam_id, teacher)
    db = get_db()
    await db.attempts.delete_many({"exam_id": exam["_id"]})
    await db.exams.delete_one({"_id": exam["_id"]})
    return {"ok": True}


@router.get("/exams/{exam_id}/results")
async def exam_results(exam_id: str, teacher: dict = Depends(require_teacher)):
    db = get_db()
    exam = await _own_exam(exam_id, teacher)
    attempts = await db.attempts.find({"exam_id": exam["_id"]}).to_list(None)
    students = await db.users.find(
        {"_id": {"$in": exam["assigned_student_ids"] + [a["student_id"] for a in attempts]}},
        {"name": 1, "email": 1},
    ).to_list(None)
    student_map = {s["_id"]: s for s in students}

    rows = []
    for a in attempts:
        s = student_map.get(a["student_id"], {})
        row = serialize(a)
        row.pop("question_order", None)
        row.pop("option_orders", None)
        row["student_name"] = s.get("name", "Unknown")
        row["student_email"] = s.get("email", "")
        rows.append(row)
    rows.sort(key=lambda r: r["student_name"].lower())

    submitted = [a for a in attempts if a["status"] == "submitted"]
    total = exam["total_marks"]
    scores = [a["auto_score"] if a.get("final_score") is None else a["final_score"] for a in submitted]

    buckets = [0] * 10  # 0-10%, 10-20%, ... 90-100%
    for sc in scores:
        pct = (sc / total * 100) if total else 0
        buckets[min(int(pct // 10), 9)] += 1

    per_question = []
    for q in exam["questions"]:
        picks = {o["id"]: 0 for o in q["options"]}
        answered = correct = 0
        for a in submitted:
            choice = a.get("answers", {}).get(q["id"])
            if choice:
                answered += 1
                picks[choice] = picks.get(choice, 0) + 1
                correct += choice == q["correct_option_id"]
        per_question.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "correct_option_id": q["correct_option_id"],
            "answered": answered,
            "correct": correct,
            "accuracy": round(correct / len(submitted) * 100, 1) if submitted else 0,
            "picks": picks,
        })

    attempted_ids = {a["student_id"] for a in attempts}
    not_started = [
        {"id": str(sid), "name": student_map.get(sid, {}).get("name", "Unknown"),
         "email": student_map.get(sid, {}).get("email", "")}
        for sid in exam["assigned_student_ids"] if sid not in attempted_ids
    ]

    return {
        "exam": {k: v for k, v in serialize(exam).items() if k != "questions"},
        "attempts": rows,
        "not_started": not_started,
        "stats": {
            "assigned": len(exam["assigned_student_ids"]),
            "submitted": len(submitted),
            "average": round(sum(scores) / len(scores), 2) if scores else 0,
            "highest": max(scores) if scores else 0,
            "lowest": min(scores) if scores else 0,
            "pass_rate": round(sum(1 for s in scores if total and s / total >= 0.4) / len(scores) * 100, 1) if scores else 0,
            "distribution": buckets,
        },
        "per_question": per_question,
    }


@router.put("/attempts/{attempt_id}/grade")
async def grade_attempt(attempt_id: str, body: GradeIn, teacher: dict = Depends(require_teacher)):
    db = get_db()
    attempt = await db.attempts.find_one({"_id": oid(attempt_id)})
    if not attempt or attempt["status"] != "submitted":
        raise HTTPException(404, "Submitted attempt not found")
    exam = await _own_exam(str(attempt["exam_id"]), teacher)
    if body.final_score > exam["total_marks"]:
        raise HTTPException(400, f"Score cannot exceed total marks ({exam['total_marks']})")
    await db.attempts.update_one(
        {"_id": attempt["_id"]},
        {"$set": {
            "final_score": body.final_score,
            "remarks": body.remarks,
            "published": body.published,
            "graded_at": datetime.now(timezone.utc),
        }},
    )
    return {"ok": True}


@router.post("/exams/{exam_id}/publish-all")
async def publish_all(exam_id: str, teacher: dict = Depends(require_teacher)):
    exam = await _own_exam(exam_id, teacher)
    db = get_db()
    # Attempts the teacher hasn't graded get their auto score as the final score
    await db.attempts.update_many(
        {"exam_id": exam["_id"], "status": "submitted", "final_score": None},
        [{"$set": {"final_score": "$auto_score"}}],
    )
    res = await db.attempts.update_many(
        {"exam_id": exam["_id"], "status": "submitted"}, {"$set": {"published": True}}
    )
    return {"ok": True, "published": res.modified_count}
