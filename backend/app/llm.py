"""MCQ generation and answer verification with Groq.

How the answer key is kept consistent:
1. The model must return the correct answer as an index into its own options,
   in strict JSON mode, at low temperature.
2. Options are shuffled once here (to remove the LLM's "answer is always A"
   bias) and given fixed ids a/b/c/d. The correct answer is stored as an option
   id, so it stays tied to the option text no matter how options are later
   shuffled for each student.
3. Optionally, a second independent call answers each question using only the
   source text; questions where the two answers disagree are discarded.
4. When an exam is created, its questions (with the answer key) are
   snapshotted, so later edits to the question bank never change an exam.
"""

import json
import random

from groq import AsyncGroq

from .config import get_settings

OPTION_IDS = ["a", "b", "c", "d"]

GEN_SYSTEM = (
    "You are an expert exam setter. You write multiple-choice questions strictly "
    "from the supplied study material. Every question must be answerable from the "
    "material alone, have exactly one correct option, and three plausible but clearly "
    "wrong distractors. Never use 'All of the above' or 'None of the above'. "
    "Reply with JSON only."
)

GEN_TEMPLATE = """Study material:
\"\"\"
{context}
\"\"\"

Write {n} {difficulty} multiple-choice questions based ONLY on the study material above.
{avoid}
Return JSON in exactly this shape:
{{"questions": [
  {{"question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_index": 0,
    "explanation": "one sentence on why the answer is correct, citing the material"}}
]}}
Rules: exactly 4 options per question, all different; correct_index is 0-3 and points to the single correct option."""

VERIFY_SYSTEM = (
    "You answer multiple-choice questions using ONLY the supplied study material. "
    "Reply with JSON only."
)

VERIFY_TEMPLATE = """Study material:
\"\"\"
{context}
\"\"\"

Question: {question}
{options}

Which option is correct according to the material? Reply as {{"answer": "<letter>"}}. If the material does not support any option, reply {{"answer": "none"}}."""


def _client() -> AsyncGroq:
    key = get_settings().groq_api_key
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return AsyncGroq(api_key=key)


async def _chat_json(system: str, user: str, temperature: float) -> dict:
    resp = await _client().chat.completions.create(
        model=get_settings().groq_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content or "{}")


def _normalize(raw: dict) -> dict | None:
    """Validate one generated question and convert it to the stored format."""
    question = str(raw.get("question", "")).strip()
    options = [str(o).strip() for o in raw.get("options", []) if str(o).strip()]
    try:
        correct_index = int(raw.get("correct_index"))
    except (TypeError, ValueError):
        return None
    if not question or len(options) != 4 or not 0 <= correct_index < 4:
        return None
    if len({o.lower() for o in options}) != 4:
        return None

    correct_text = options[correct_index]
    random.shuffle(options)
    labelled = [{"id": OPTION_IDS[i], "text": t} for i, t in enumerate(options)]
    correct_id = next(o["id"] for o in labelled if o["text"] == correct_text)
    return {
        "question": question,
        "options": labelled,
        "correct_option_id": correct_id,
        "explanation": str(raw.get("explanation", "")).strip(),
    }


async def generate_mcqs(context: str, n: int, difficulty: str, avoid: list[str]) -> list[dict]:
    avoid_text = ""
    if avoid:
        listed = "\n".join(f"- {q}" for q in avoid[-30:])
        avoid_text = f"Do NOT repeat or rephrase any of these existing questions:\n{listed}\n"
    data = await _chat_json(
        GEN_SYSTEM,
        GEN_TEMPLATE.format(context=context, n=n, difficulty=difficulty, avoid=avoid_text),
        temperature=0.3,
    )
    out = []
    for raw in data.get("questions", []):
        if isinstance(raw, dict) and (q := _normalize(raw)):
            out.append(q)
    return out


async def verify_mcq(context: str, q: dict) -> bool:
    options = "\n".join(f"{o['id']}) {o['text']}" for o in q["options"])
    try:
        data = await _chat_json(
            VERIFY_SYSTEM,
            VERIFY_TEMPLATE.format(context=context, question=q["question"], options=options),
            temperature=0,
        )
    except Exception:
        return False
    return str(data.get("answer", "")).strip().lower().rstrip(")") == q["correct_option_id"]
