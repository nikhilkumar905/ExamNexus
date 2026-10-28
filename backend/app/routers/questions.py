from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db, oid, serialize
from ..schemas import QuestionUpdate
from ..security import require_teacher

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("")
async def list_questions(document_id: str | None = None, teacher: dict = Depends(require_teacher)):
    query = {"teacher_id": teacher["_id"]}
    if document_id:
        query["document_id"] = oid(document_id)
    qs = await get_db().questions.find(query).sort("created_at", -1).to_list(None)
    return [serialize(q) for q in qs]


@router.put("/{question_id}")
async def update_question(question_id: str, body: QuestionUpdate, teacher: dict = Depends(require_teacher)):
    ids = [o.id for o in body.options]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Option ids must be unique")
    if body.correct_option_id not in ids:
        raise HTTPException(400, "correct_option_id must match one of the options")
    res = await get_db().questions.find_one_and_update(
        {"_id": oid(question_id), "teacher_id": teacher["_id"]},
        {"$set": {**body.model_dump(), "edited": True}},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Question not found")
    return serialize(res)


@router.delete("/{question_id}")
async def delete_question(question_id: str, teacher: dict = Depends(require_teacher)):
    res = await get_db().questions.delete_one({"_id": oid(question_id), "teacher_id": teacher["_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Question not found")
    return {"ok": True}
