const express = require("express");
const Document = require("../models/Document");

const router = express.Router();

/**
 * GET /api/analytics/summary
 * High-level dashboard numbers.
 */
router.get("/summary", async (_req, res) => {
  try {
    const [total, completed, failed, anomalies] = await Promise.all([
      Document.countDocuments(),
      Document.countDocuments({ status: "completed" }),
      Document.countDocuments({ status: "failed" }),
      Document.countDocuments({ "anomaly.isAnomaly": true }),
    ]);

    const avgProcessingTime = await Document.aggregate([
      { $match: { status: "completed", processingTimeMs: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$processingTimeMs" } } },
    ]);

    const totalValue = await Document.aggregate([
      { $match: { status: "completed", "extracted.total": { $gt: 0 } } },
      { $group: { _id: null, sum: { $sum: "$extracted.total" } } },
    ]);

    res.json({
      totalDocuments: total,
      completed,
      failed,
      inProgress: total - completed - failed,
      anomalies,
      avgProcessingTimeMs: avgProcessingTime[0]?.avg || 0,
      totalValueProcessed: totalValue[0]?.sum || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/by-vendor
 * Document count and total spend grouped by vendor.
 */
router.get("/by-vendor", async (_req, res) => {
  try {
    const result = await Document.aggregate([
      { $match: { status: "completed", "extracted.vendor": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$extracted.vendor",
          count: { $sum: 1 },
          totalSpend: { $sum: "$extracted.total" },
          avgAmount: { $avg: "$extracted.total" },
          anomalyCount: { $sum: { $cond: ["$anomaly.isAnomaly", 1, 0] } },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 20 },
    ]);

    res.json(result.map((r) => ({ vendor: r._id, ...r, _id: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/by-category
 * Spend grouped by line-item category.
 */
router.get("/by-category", async (_req, res) => {
  try {
    const result = await Document.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$extracted.lineItems" },
      {
        $group: {
          _id: "$extracted.lineItems.category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$extracted.lineItems.amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json(result.map((r) => ({ category: r._id || "Uncategorized", ...r, _id: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/timeline
 * Documents processed per day over the last 30 days.
 */
router.get("/timeline", async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Document.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          anomalies: { $sum: { $cond: ["$anomaly.isAnomaly", 1, 0] } },
          totalValue: { $sum: "$extracted.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(result.map((r) => ({ date: r._id, ...r, _id: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/anomaly-breakdown
 * Anomaly reasons ranked by frequency.
 */
router.get("/anomaly-breakdown", async (_req, res) => {
  try {
    const result = await Document.aggregate([
      { $match: { "anomaly.isAnomaly": true } },
      { $unwind: "$anomaly.reasons" },
      { $group: { _id: "$anomaly.reasons", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json(result.map((r) => ({ reason: r._id, count: r.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
