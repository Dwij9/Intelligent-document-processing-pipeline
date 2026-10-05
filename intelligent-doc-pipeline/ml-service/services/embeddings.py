"""
Embedding generation and cosine-similarity matching using sentence-transformers.
"""

import numpy as np
from functools import lru_cache
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME, cache_folder="/app/model_cache")
    return _model


def embed_text(text: str) -> list[float]:
    """Generate an embedding vector for a single string."""
    model = get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_batch(texts: list[str]) -> np.ndarray:
    """Generate embeddings for a batch of strings."""
    model = get_model()
    return model.encode(texts, normalize_embeddings=True, batch_size=64)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors (already L2-normalized)."""
    return float(np.dot(a, b))


def find_best_match(
    query: str,
    candidates: list[dict],
) -> tuple[dict | None, float]:
    """
    Find the best semantic match for `query` among `candidates`.

    Each candidate dict must have 'name' and optionally 'aliases'.
    Returns (best_candidate, confidence).
    """
    if not candidates:
        return None, 0.0

    # Build candidate text: "name | alias1 | alias2"
    candidate_texts = []
    for c in candidates:
        parts = [c["name"]] + (c.get("aliases") or [])
        candidate_texts.append(" | ".join(parts))

    # Embed everything
    all_texts = [query] + candidate_texts
    embeddings = embed_batch(all_texts)

    query_vec = embeddings[0]
    candidate_vecs = embeddings[1:]

    # Find the highest cosine similarity
    similarities = np.dot(candidate_vecs, query_vec)
    best_idx = int(np.argmax(similarities))
    best_score = float(similarities[best_idx])

    return candidates[best_idx], best_score
