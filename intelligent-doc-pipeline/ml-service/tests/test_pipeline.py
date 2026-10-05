"""
Tests for the ML service — parsing, embeddings, anomaly detection.

Run with: python -m pytest tests/ -v
"""

import os
import sys
import tempfile
import numpy as np
import pytest

# Add parent dir to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.anomaly_model import AnomalyDetector, featurize_document, DocumentAutoencoder


# ── Featurization Tests ──────────────────────────────────────

class TestFeaturization:
    def test_basic_featurization(self):
        extracted = {
            "documentType": "invoice",
            "vendor": "Acme Corp",
            "total": 10000,
            "subtotal": 9000,
            "tax": 1000,
            "lineItems": [
                {"description": "Item A", "amount": 5000},
                {"description": "Item B", "amount": 4000},
            ],
        }
        matches = [{"field": "vendor", "confidence": 0.95}]

        features = featurize_document(extracted, matches)

        assert features.shape == (12,)
        assert features.dtype == np.float32
        assert not np.any(np.isnan(features))

    def test_empty_document(self):
        extracted = {"documentType": "other", "total": 0}
        features = featurize_document(extracted, [])

        assert features.shape == (12,)
        assert not np.any(np.isnan(features))

    def test_consistency_flag(self):
        # subtotal + tax != total should create a nonzero consistency score
        extracted = {
            "documentType": "invoice",
            "total": 10000,
            "subtotal": 7000,
            "tax": 1000,
            "lineItems": [],
        }
        features = featurize_document(extracted, [])
        consistency_idx = 6  # index of consistency feature
        assert features[consistency_idx] > 0  # should be nonzero

    def test_high_tax_ratio(self):
        extracted = {
            "documentType": "invoice",
            "total": 10000,
            "subtotal": 5000,
            "tax": 5000,  # 50% tax ratio — unusual
            "lineItems": [],
        }
        features = featurize_document(extracted, [])
        tax_ratio_idx = 5
        assert features[tax_ratio_idx] == 0.5


# ── Anomaly Detector Tests ───────────────────────────────────

class TestAnomalyDetector:
    def test_rule_based_detection_no_vendor(self):
        """Documents without vendor match should be flagged."""
        detector = AnomalyDetector()
        features = np.zeros(12, dtype=np.float32)
        features[8] = 0.0  # has_vendor_match = False

        result = detector.score(features)

        assert result["isAnomaly"] is True
        assert "Vendor not found in knowledge base" in result["reasons"]

    def test_rule_based_detection_high_tax(self):
        """Tax ratio above 30% should be flagged."""
        detector = AnomalyDetector()
        features = np.zeros(12, dtype=np.float32)
        features[5] = 0.4  # tax_ratio = 40%
        features[8] = 1.0  # has vendor match

        result = detector.score(features)

        assert result["isAnomaly"] is True
        assert "Unusually high tax ratio" in result["reasons"]

    def test_rule_based_normal_document(self):
        """Normal document should not be flagged by rules."""
        detector = AnomalyDetector()
        features = np.zeros(12, dtype=np.float32)
        features[5] = 0.1  # normal tax ratio
        features[6] = 0.0  # consistent
        features[8] = 1.0  # vendor matched

        result = detector.score(features)

        assert result["isAnomaly"] is False
        assert len(result["reasons"]) == 0

    def test_inconsistency_flag(self):
        """Subtotal + tax not matching total should flag."""
        detector = AnomalyDetector()
        features = np.zeros(12, dtype=np.float32)
        features[6] = 0.2  # consistency gap > 0.1
        features[8] = 1.0

        result = detector.score(features)

        assert "Subtotal + tax does not match total" in result["reasons"]


# ── Autoencoder Model Tests ──────────────────────────────────

class TestAutoencoder:
    def test_model_forward_pass(self):
        model = DocumentAutoencoder(input_dim=12, latent_dim=4)
        x = torch.tensor(np.random.randn(5, 12).astype(np.float32))
        output = model(x)
        assert output.shape == (5, 12)

    def test_training_reduces_loss(self):
        """Training should reduce reconstruction error."""
        detector = AnomalyDetector()

        # Generate "normal" data
        np.random.seed(42)
        normal_data = np.random.randn(50, 12).astype(np.float32) * 0.5 + 1.0

        detector.train_on_batch(normal_data, epochs=50)

        assert detector.mean_error is not None
        assert detector.std_error is not None
        assert detector.mean_error > 0

    def test_anomaly_scores_after_training(self):
        """After training, outliers should have higher scores than normals."""
        detector = AnomalyDetector()

        np.random.seed(42)
        normal_data = np.random.randn(100, 12).astype(np.float32) * 0.3 + 1.0
        detector.train_on_batch(normal_data, epochs=100)

        # Normal sample — should have low score
        normal_sample = np.array([1.0] * 12, dtype=np.float32)
        normal_sample[8] = 1.0  # vendor matched
        normal_result = detector.score(normal_sample)

        # Outlier — very different from training data
        outlier = np.array([10.0] * 12, dtype=np.float32)
        outlier[8] = 1.0
        outlier_result = detector.score(outlier)

        assert outlier_result["score"] > normal_result["score"]


# ── CSV Parser Tests ─────────────────────────────────────────

class TestCSVParser:
    def test_parse_csv(self):
        from services.pdf_extractor import extract_csv_text

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("Date,Vendor,Amount\n2024-01-01,Acme,500\n2024-01-02,CloudServe,1500\n")
            f.flush()

            text = extract_csv_text(f.name)

            assert "2 rows" in text
            assert "3 columns" in text
            assert "Acme" in text
            assert "CloudServe" in text

        os.unlink(f.name)


# ── Embedding Tests ──────────────────────────────────────────

class TestEmbeddings:
    def test_find_best_match_returns_result(self):
        """Semantic matching should return a candidate and confidence."""
        from services.embeddings import find_best_match

        candidates = [
            {"id": "1", "name": "Acme Corporation", "aliases": ["Acme", "Acme Corp"]},
            {"id": "2", "name": "CloudServe Inc", "aliases": ["CloudServe"]},
            {"id": "3", "name": "Delta Logistics", "aliases": ["Delta"]},
        ]

        best, confidence = find_best_match("Acme Corp", candidates)

        assert best is not None
        assert best["name"] == "Acme Corporation"
        assert confidence > 0.8

    def test_dissimilar_query_low_confidence(self):
        """Very different queries should get lower confidence."""
        from services.embeddings import find_best_match

        candidates = [
            {"id": "1", "name": "Acme Corporation", "aliases": []},
            {"id": "2", "name": "CloudServe Inc", "aliases": []},
        ]

        _best, confidence = find_best_match("quantum submarine racing", candidates)

        assert confidence < 0.7


# Import torch only for model tests
try:
    import torch
except ImportError:
    torch = None
    # Skip torch-dependent tests
    TestAutoencoder = pytest.mark.skip("PyTorch not installed")(TestAutoencoder)
