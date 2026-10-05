const express = require("express");
const KnowledgeBase = require("../models/KnowledgeBase");

const router = express.Router();

/** GET /api/knowledge — list all KB entries */
router.get("/", async (req, res) => {
  try {
    const { entityType, search } = req.query;
    const filter = { isActive: true };

    if (entityType) filter.entityType = entityType;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { aliases: { $regex: search, $options: "i" } },
      ];
    }

    const entries = await KnowledgeBase.find(filter).sort("name").lean();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/knowledge — create a new entry */
router.post("/", async (req, res) => {
  try {
    const entry = await KnowledgeBase.create(req.body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** PUT /api/knowledge/:id — update an entry */
router.put("/:id", async (req, res) => {
  try {
    const entry = await KnowledgeBase.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** DELETE /api/knowledge/:id — soft-delete */
router.delete("/:id", async (req, res) => {
  try {
    const entry = await KnowledgeBase.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deactivated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
