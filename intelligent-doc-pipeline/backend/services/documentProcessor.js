const axios = require("axios");
const Document = require("../models/Document");
const { matchEntities } = require("./semanticMatcher");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Full pipeline: parse → extract → match → anomaly-detect
 */
async function processDocument(docId, broadcast) {
  const start = Date.now();
  const doc = await Document.findById(docId);
  if (!doc) throw new Error(`Document ${docId} not found`);

  const notify = (status, message) => {
    doc.status = status;
    doc.statusMessage = message;
    doc.save();
    if (broadcast) broadcast({ docId, status, message });
  };

  try {
    // ── Step 1: Parse raw text ──────────────────────────────
    notify("parsing", "Extracting raw text from file");

    const parseRes = await axios.post(`${ML_URL}/parse`, {
      filePath: doc.filePath,
      fileType: doc.fileType,
    });

    doc.rawText = parseRes.data.text;
    await doc.save();

    // ── Step 2: LLM structured extraction ───────────────────
    notify("extracting", "Running LLM extraction with function-calling");

    const extractRes = await axios.post(`${ML_URL}/extract`, {
      text: doc.rawText,
      fileType: doc.fileType,
    });

    doc.extracted = extractRes.data.extracted;
    await doc.save();

    // ── Step 3: Semantic matching ───────────────────────────
    notify("matching", "Matching against knowledge base");

    const matches = await matchEntities(doc.extracted);
    doc.matches = matches;
    await doc.save();

    // ── Step 4: Anomaly detection ───────────────────────────
    notify("analyzing", "Running anomaly detection");

    const anomalyRes = await axios.post(`${ML_URL}/detect-anomaly`, {
      extracted: doc.extracted,
      matches: doc.matches,
    });

    doc.anomaly = anomalyRes.data;
    doc.processedAt = new Date();
    doc.processingTimeMs = Date.now() - start;
    notify("completed", "Processing complete");
  } catch (err) {
    doc.status = "failed";
    doc.statusMessage = err.response?.data?.detail || err.message;
    doc.processingTimeMs = Date.now() - start;
    await doc.save();
    if (broadcast) broadcast({ docId, status: "failed", message: doc.statusMessage });
    console.error(`Pipeline failed for ${docId}:`, err.message);
  }
}

module.exports = { processDocument };
