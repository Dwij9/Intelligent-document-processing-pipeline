const express = require("express");
const path = require("path");
const Document = require("../models/Document");
const upload = require("../middleware/upload");
const { processDocument } = require("../services/documentProcessor");

const router = express.Router();

// Broadcast helper — set by server.js via router.setBroadcast
let broadcast = null;
router.setBroadcast = (fn) => {
  broadcast = fn;
};

/**
 * POST /api/documents/upload
 * Upload one or more files and kick off the pipeline.
 */
router.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    const docs = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

      const doc = await Document.create({
        filename: file.filename,
        originalName: file.originalname,
        fileType: ext,
        fileSize: file.size,
        filePath: file.path,
      });

      docs.push(doc);

      // Fire-and-forget pipeline
      processDocument(doc._id, broadcast).catch((err) =>
        console.error(`Background pipeline error [${doc._id}]:`, err.message)
      );
    }

    res.status(201).json({ uploaded: docs.length, documents: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents
 * List documents with optional filters.
 */
router.get("/", async (req, res) => {
  try {
    const { status, anomaly, page = 1, limit = 20, sort = "-createdAt" } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (anomaly === "true") filter["anomaly.isAnomaly"] = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      Document.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Document.countDocuments(filter),
    ]);

    res.json({
      documents: docs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:id
 * Single document with full details.
 */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/:id/reprocess
 * Re-run the pipeline on an existing document.
 */
router.post("/:id/reprocess", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    doc.status = "uploaded";
    doc.statusMessage = "Re-processing";
    doc.anomaly = undefined;
    doc.matches = [];
    await doc.save();

    processDocument(doc._id, broadcast).catch((err) =>
      console.error(`Reprocess error [${doc._id}]:`, err.message)
    );

    res.json({ message: "Re-processing started", document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/documents/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
