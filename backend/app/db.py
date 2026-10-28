from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri)
    return _client[get_settings().mongodb_db]


async def create_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.chunks.create_index("document_id")
    await db.questions.create_index("document_id")
    await db.exams.create_index("teacher_id")
    await db.exams.create_index("assigned_student_ids")
    await db.attempts.create_index([("exam_id", 1), ("student_id", 1)], unique=True)


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid id")


def serialize(doc: dict | None) -> dict | None:
    """Convert a Mongo document into JSON-friendly dict (ObjectId -> str, _id -> id)."""
    if doc is None:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, ObjectId):
            out[key] = str(value)
        elif isinstance(value, list):
            out[key] = [str(v) if isinstance(v, ObjectId) else v for v in value]
        else:
            out[key] = value
    return out
