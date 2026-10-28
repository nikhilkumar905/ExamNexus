import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from groq import AuthenticationError

from .. import rag
from ..db import get_db, oid, serialize
from ..generation import generate_for_document
from ..schemas import GenerateIn
from ..security import require_teacher

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_PDF_BYTES = 25 * 1024 * 1024


@router.post("/upload")
async def upload(file: UploadFile = File(...), teacher: dict = Depends(require_teacher)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(400, "PDF is larger than 25 MB")

    try:
        pages = await asyncio.to_thread(rag.extract_pages, data)
    except Exception:
        raise HTTPException(400, "Could not read this PDF")
    chunks = rag.chunk_pages(pages)
    if not chunks:
        raise HTTPException(
            400, "No text found in this PDF. Scanned/image-only PDFs need OCR first."
        )
    embeddings = await asyncio.to_thread(rag.embed, [c["text"] for c in chunks])

    db = get_db()
    doc = {
        "teacher_id": teacher["_id"],
        "filename": file.filename,
        "num_pages": len(pages),
        "num_chunks": len(chunks),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.documents.insert_one(doc)
    await db.chunks.insert_many(
        [{**c, "embedding": e, "document_id": res.inserted_id} for c, e in zip(chunks, embeddings)]
    )
    doc["_id"] = res.inserted_id
    return serialize(doc)


@router.get("")
async def list_documents(teacher: dict = Depends(require_teacher)):
    db = get_db()
    docs = await db.documents.find({"teacher_id": teacher["_id"]}).sort("created_at", -1).to_list(None)
    out = []
    for d in docs:
        s = serialize(d)
        s["num_questions"] = await db.questions.count_documents({"document_id": d["_id"]})
        out.append(s)
    return out


async def _own_document(doc_id: str, teacher: dict) -> dict:
    doc = await get_db().documents.find_one({"_id": oid(doc_id), "teacher_id": teacher["_id"]})
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, teacher: dict = Depends(require_teacher)):
    doc = await _own_document(doc_id, teacher)
    db = get_db()
    await db.chunks.delete_many({"document_id": doc["_id"]})
    await db.questions.delete_many({"document_id": doc["_id"]})
    await db.documents.delete_one({"_id": doc["_id"]})
    return {"ok": True}


@router.post("/{doc_id}/generate")
async def generate(doc_id: str, body: GenerateIn, teacher: dict = Depends(require_teacher)):
    doc = await _own_document(doc_id, teacher)
    db = get_db()
    chunks = await db.chunks.find({"document_id": doc["_id"]}).sort("index", 1).to_list(None)
    existing = await db.questions.find({"document_id": doc["_id"]}, {"question": 1}).to_list(None)

    try:
        questions = await generate_for_document(
            chunks, body.num_questions, body.topic, body.difficulty, [q["question"] for q in existing]
        )
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except AuthenticationError:
        raise HTTPException(500, "Groq rejected the API key. Set a valid GROQ_API_KEY in backend/.env and restart the backend.")
    except Exception as e:
        raise HTTPException(502, f"Question generation failed: {e}")
    if not questions:
        raise HTTPException(502, "The model did not return any valid questions. Try again.")

    now = datetime.now(timezone.utc)
    for q in questions:
        q.update(
            document_id=doc["_id"],
            teacher_id=teacher["_id"],
            difficulty=body.difficulty,
            topic=body.topic,
            created_at=now,
        )
    await db.questions.insert_many(questions)
    return [serialize(q) for q in questions]
