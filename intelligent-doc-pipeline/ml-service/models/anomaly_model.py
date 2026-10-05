"""
PyTorch autoencoder for anomaly detection on financial document features.

The model learns a compressed representation of "normal" documents.
Documents with high reconstruction error are flagged as anomalous.
"""

import torch
import torch.nn as nn
import numpy as np
from pathlib import Path

MODEL_PATH = Path("/app/model_cache/anomaly_autoencoder.pt")


class DocumentAutoencoder(nn.Module):
    """Simple autoencoder for document feature vectors."""

    def __init__(self, input_dim: int = 12, latent_dim: int = 4):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.Linear(32, input_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        z = self.encoder(x)
        return self.decoder(z)


def featurize_document(extracted: dict, matches: list[dict]) -> np.ndarray:
    """
    Convert extracted document data + match results into a fixed-length
    numeric feature vector for the autoencoder.
    """
    total = extracted.get("total") or 0
    subtotal = extracted.get("subtotal") or 0
    tax = extracted.get("tax") or 0
    num_items = len(extracted.get("lineItems") or [])
    item_amounts = [i.get("amount", 0) for i in (extracted.get("lineItems") or [])]
    avg_item = np.mean(item_amounts) if item_amounts else 0
    max_item = max(item_amounts) if item_amounts else 0
    std_item = np.std(item_amounts) if len(item_amounts) > 1 else 0

    # Tax ratio: unusual if tax is > 30% or negative
    tax_ratio = tax / total if total > 0 else 0

    # Match quality
    match_confidences = [m.get("confidence", 0) for m in (matches or [])]
    avg_confidence = np.mean(match_confidences) if match_confidences else 0
    has_vendor_match = 1.0 if any(m.get("field") == "vendor" for m in (matches or [])) else 0.0

    # Consistency: does subtotal + tax ≈ total?
    consistency = abs((subtotal + tax) - total) / total if total > 0 else 0

    # Document type encoding (one-hot simplified to a single ordinal)
    doc_types = ["invoice", "receipt", "purchase_order", "expense_report", "statement", "other"]
    doc_type_val = doc_types.index(extracted.get("documentType", "other")) / len(doc_types)

    features = np.array(
        [
            np.log1p(total),
            np.log1p(avg_item),
            np.log1p(max_item),
            np.log1p(std_item),
            num_items,
            tax_ratio,
            consistency,
            avg_confidence,
            has_vendor_match,
            doc_type_val,
            np.log1p(subtotal),
            np.log1p(tax),
        ],
        dtype=np.float32,
    )

    return features


class AnomalyDetector:
    """Wraps the autoencoder with training and inference logic."""

    def __init__(self, input_dim: int = 12, threshold: float = 2.0):
        self.model = DocumentAutoencoder(input_dim=input_dim)
        self.threshold = threshold  # z-score threshold
        self.mean_error: float | None = None
        self.std_error: float | None = None
        self._load_if_exists()

    def _load_if_exists(self):
        if MODEL_PATH.exists():
            checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
            self.model.load_state_dict(checkpoint["model_state"])
            self.mean_error = checkpoint.get("mean_error", 0.1)
            self.std_error = checkpoint.get("std_error", 0.05)
            self.model.eval()

    def train_on_batch(self, feature_vectors: np.ndarray, epochs: int = 100, lr: float = 1e-3):
        """Train / retrain the autoencoder on a batch of normal documents."""
        X = torch.tensor(feature_vectors, dtype=torch.float32)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.MSELoss()

        self.model.train()
        for epoch in range(epochs):
            optimizer.zero_grad()
            recon = self.model(X)
            loss = criterion(recon, X)
            loss.backward()
            optimizer.step()

        # Compute baseline reconstruction errors
        self.model.eval()
        with torch.no_grad():
            recon = self.model(X)
            errors = torch.mean((recon - X) ** 2, dim=1).numpy()
            self.mean_error = float(np.mean(errors))
            self.std_error = float(np.std(errors)) + 1e-8

        # Save checkpoint
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {
                "model_state": self.model.state_dict(),
                "mean_error": self.mean_error,
                "std_error": self.std_error,
            },
            MODEL_PATH,
        )

    def score(self, features: np.ndarray) -> dict:
        """
        Score a single document.
        Returns { score, isAnomaly, reasons }.
        """
        reasons = []

        # Rule-based checks that run regardless of model state
        if features[5] > 0.3:  # tax_ratio
            reasons.append("Unusually high tax ratio")
        if features[5] < 0:
            reasons.append("Negative tax amount")
        if features[6] > 0.1:  # consistency
            reasons.append("Subtotal + tax does not match total")
        if features[8] < 0.5:  # has_vendor_match
            reasons.append("Vendor not found in knowledge base")

        # Model-based scoring
        if self.mean_error is not None:
            x = torch.tensor(features, dtype=torch.float32).unsqueeze(0)
            self.model.eval()
            with torch.no_grad():
                recon = self.model(x)
                error = float(torch.mean((recon - x) ** 2))

            z_score = (error - self.mean_error) / self.std_error
            if z_score > self.threshold:
                reasons.append(f"Reconstruction error z-score={z_score:.2f} exceeds threshold")

            return {
                "score": round(z_score, 4),
                "isAnomaly": len(reasons) > 0,
                "reasons": reasons,
            }

        # No trained model yet — rely on rules only
        return {
            "score": len(reasons) * 0.5,
            "isAnomaly": len(reasons) > 0,
            "reasons": reasons if reasons else [],
        }
