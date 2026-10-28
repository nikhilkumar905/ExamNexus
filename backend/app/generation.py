import asyncio
import math
import re

from . import llm, rag
from .config import get_settings

QUESTIONS_PER_CALL = 5
MAX_CONTEXT_CHARS = 6000
MAX_ROUNDS = 3


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _build_context(chunks: list[dict]) -> str:
    parts, total = [], 0
    for c in chunks:
        piece = f"[page {c['page']}] {c['text']}"
        if total + len(piece) > MAX_CONTEXT_CHARS and parts:
            break
        parts.append(piece)
        total += len(piece)
    return "\n\n".join(parts)


async def generate_for_document(
    chunks: list[dict], n: int, topic: str | None, difficulty: str, existing: list[str]
) -> list[dict]:
    """Retrieve relevant chunks and generate up to n verified, de-duplicated MCQs."""
    k = min(len(chunks), max(4, math.ceil(n / 2) + 2))
    if topic:
        selected = await asyncio.to_thread(rag.top_k, topic, chunks, k)
    else:
        selected = rag.spread(chunks, k)
    # Keep retrieved chunks in reading order so each context reads naturally
    selected.sort(key=lambda c: c["index"])

    verify = get_settings().verify_questions
    seen = {_norm(q) for q in existing}
    results: list[dict] = []
    sem = asyncio.Semaphore(3)  # be gentle with Groq rate limits

    async def run_batch(batch_chunks: list[dict], count: int) -> list[tuple[dict, list[dict]]]:
        context = _build_context(batch_chunks)
        async with sem:
            qs = await llm.generate_mcqs(
                context, count, difficulty, existing + [r["question"] for r in results]
            )
        if verify:
            async def check(q):
                async with sem:
                    return q if await llm.verify_mcq(context, q) else None
            qs = [q for q in await asyncio.gather(*(check(q) for q in qs)) if q]
        return [(q, batch_chunks) for q in qs]

    for _ in range(MAX_ROUNDS):
        remaining = n - len(results)
        if remaining <= 0:
            break
        num_batches = math.ceil(remaining / QUESTIONS_PER_CALL)
        groups = [selected[i::num_batches] for i in range(num_batches)]
        groups = [g for g in groups if g] or [selected]
        per_batch = math.ceil(remaining / len(groups)) + 1  # over-ask; verification may drop some

        batch_results = await asyncio.gather(
            *(run_batch(g, per_batch) for g in groups), return_exceptions=True
        )
        errors = [r for r in batch_results if isinstance(r, Exception)]
        if errors and len(errors) == len(batch_results):
            raise errors[0]
        for batch in batch_results:
            if isinstance(batch, Exception):
                continue
            for q, used in batch:
                key = _norm(q["question"])
                if key in seen or len(results) >= n:
                    continue
                seen.add(key)
                q["source_pages"] = sorted({c["page"] for c in used})
                q["verified"] = verify
                results.append(q)
    return results
