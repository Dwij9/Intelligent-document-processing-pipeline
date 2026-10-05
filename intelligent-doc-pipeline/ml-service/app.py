"""
FastAPI ML service for the Intelligent Document Processing Pipeline.

Endpoints:
  POST /parse           — extract raw text from a PDF or CSV
  POST /extract         — LLM function-calling to get structured data
  POST /semantic-match  — embedding-based entity matching
  POST /detect-anomaly  — autoencoder + rules anomaly scoring
  POST /train-anomaly   — retrain the autoencoder on labeled normals
"""

import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np

from services.pdf_extractor import parse_document
from services.llm_extractor import extract_structured_data
from services.embeddings import find_best_match
from models.anomaly_model import AnomalyDetector, featurize_document

app = FastAPI(title="IDP ML Service", version="1.0.0")

# Singleton anomaly detector
detector = AnomalyDetector()


# ── Request / Response models ────────────────────────────────

class ParseRequest(BaseModel):
    filePath: str
    fileType: str  # "pdf" | "csv"


class ExtractRequest(BaseModel):
    text: str
    fileType: str


class SemanticMatchRequest(BaseModel):
    query: str
    candidates: list[dict]


class AnomalyRequest(BaseModel):
    extracted: dict
    matches: list[dict] = []


class TrainRequest(BaseModel):
    documents: list[dict]  # list of {extracted, matches}


# ── Endpoints ────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": detector.mean_error is not None}


@app.post("/parse")
async def parse(req: ParseRequest):
    """Step 1: Extract raw text from the uploaded file."""
    try:
        text = parse_document(req.filePath, req.fileType)
        return {"text": text, "length": len(text)}
    except FileNotFoundError:
        raise HTTPException(404, f"File not found: {req.filePath}")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/extract")
async def extract(req: ExtractRequest):
    """Step 2: LLM function-calling extraction."""
    try:
        result = await extract_structured_data(req.text, req.fileType)
        return {"extracted": result}
    except Exception as e:
        raise HTTPException(500, f"LLM extraction failed: {e}")


@app.post("/semantic-match")
async def semantic_match(req: SemanticMatchRequest):
    """Step 3: Find the best knowledge-base match for a query string."""
    try:
        best, confidence = find_best_match(req.query, req.candidates)
        return {
            "bestMatch": best,
            "confidence": round(confidence, 4),
        }
    except Exception as e:
        raise HTTPException(500, f"Semantic matching failed: {e}")


@app.post("/detect-anomaly")
async def detect_anomaly(req: AnomalyRequest):
    """Step 4: Score a document for anomalies."""
    try:
        features = featurize_document(req.extracted, req.matches)
        result = detector.score(features)
        return result
    except Exception as e:
        raise HTTPException(500, f"Anomaly detection failed: {e}")


@app.post("/train-anomaly")
async def train_anomaly(req: TrainRequest):
    """Retrain the autoencoder on a batch of known-good documents."""
    try:
        feature_matrix = np.array(
            [featurize_document(d["extracted"], d.get("matches", [])) for d in req.documents]
        )
        detector.train_on_batch(feature_matrix)
        return {
            "message": f"Trained on {len(req.documents)} documents",
            "meanError": detector.mean_error,
            "stdError": detector.std_error,
        }
    except Exception as e:
        raise HTTPException(500, f"Training failed: {e}")
