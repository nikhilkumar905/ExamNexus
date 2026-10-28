"""PDF -> chunks -> embeddings -> retrieval.

Chunks and their embeddings are stored in MongoDB (collection `chunks`).
Similarity search is done in-process with numpy, which is plenty fast for the
few hundred chunks a single PDF produces and needs no Atlas Search index setup.
"""

import io
import re
from functools import lru_cache

import numpy as np
from pypdf import PdfReader

from .config import get_settings


def extract_pages(pdf_bytes: bytes) -> list[str]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        pages.append(text)
    return pages


def chunk_pages(pages: list[str]) -> list[dict]:
    """Split page text into overlapping chunks, preferring sentence boundaries."""
    settings = get_settings()
    size, overlap = settings.chunk_size, settings.chunk_overlap
    chunks: list[dict] = []

    for page_no, text in enumerate(pages, start=1):
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            if end < len(text):
                # Back up to the last sentence end inside the window, if there is one
                window = text[start:end]
                cut = max(window.rfind(". "), window.rfind("\n"), window.rfind("? "), window.rfind("! "))
                if cut > size * 0.5:
                    end = start + cut + 1
            piece = text[start:end].strip()
            if len(piece) > 80:  # skip near-empty fragments (headers, page numbers)
                chunks.append({"page": page_no, "text": piece})
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)

    for i, c in enumerate(chunks):
        c["index"] = i
    return chunks


@lru_cache
def _embedder():
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=get_settings().embedding_model)


def embed(texts: list[str]) -> list[list[float]]:
    vectors = list(_embedder().embed(texts))
    return [v.astype(np.float32).tolist() for v in vectors]


def top_k(query: str, chunks: list[dict], k: int) -> list[dict]:
    """Return the k chunks most similar to `query` (cosine similarity)."""
    if not chunks:
        return []
    q = np.array(embed([query])[0], dtype=np.float32)
    m = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    sims = (m @ q) / (np.linalg.norm(m, axis=1) * np.linalg.norm(q) + 1e-9)
    order = np.argsort(-sims)[:k]
    return [chunks[i] for i in order]


def spread(chunks: list[dict], k: int) -> list[dict]:
    """Pick k chunks evenly spaced through the document, for whole-document coverage."""
    if len(chunks) <= k:
        return list(chunks)
    step = len(chunks) / k
    return [chunks[int(i * step)] for i in range(k)]
