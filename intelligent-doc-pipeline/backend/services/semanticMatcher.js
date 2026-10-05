const axios = require("axios");
const KnowledgeBase = require("../models/KnowledgeBase");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Match extracted fields against the knowledge base.
 *
 * Strategy (in priority order):
 *   1. Exact name / alias match
 *   2. MongoDB text-index fuzzy match
 *   3. Semantic (embedding cosine similarity) via the ML service
 */
async function matchEntities(extracted) {
  const results = [];

  // ── Vendor matching ──────────────────────────────────────
  if (extracted.vendor) {
    const vendorMatch = await findBestMatch(extracted.vendor, "vendor");
    if (vendorMatch) results.push({ field: "vendor", ...vendorMatch });
  }

  // ── Category matching for each line item ─────────────────
  if (extracted.lineItems?.length) {
    for (const item of extracted.lineItems) {
      const desc = item.description || item.category;
      if (!desc) continue;

      const catMatch = await findBestMatch(desc, "category");
      if (catMatch) {
        item.category = catMatch.matchedEntity;
        item.glCode = (await KnowledgeBase.findById(catMatch.matchedEntityId))?.glCode || item.glCode;
        results.push({ field: `lineItem:${desc}`, ...catMatch });
      }
    }
  }

  return results;
}

async function findBestMatch(query, entityType) {
  // 1. Exact match on name or alias
  const exact = await KnowledgeBase.findOne({
    entityType,
    isActive: true,
    $or: [
      { name: { $regex: new RegExp(`^${escapeRegex(query)}$`, "i") } },
      { aliases: { $regex: new RegExp(`^${escapeRegex(query)}$`, "i") } },
    ],
  });

  if (exact) {
    return {
      matchedEntity: exact.name,
      matchedEntityId: exact._id,
      confidence: 1.0,
      matchType: "exact",
    };
  }

  // 2. Text-index fuzzy match
  const textHits = await KnowledgeBase.find(
    { $text: { $search: query }, entityType, isActive: true },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(3);

  if (textHits.length && textHits[0]._doc.score > 1.5) {
    return {
      matchedEntity: textHits[0].name,
      matchedEntityId: textHits[0]._id,
      confidence: Math.min(textHits[0]._doc.score / 5, 0.95),
      matchType: "fuzzy",
    };
  }

  // 3. Semantic match via embeddings
  try {
    const candidates = await KnowledgeBase.find({ entityType, isActive: true }).lean();
    if (!candidates.length) return null;

    const res = await axios.post(`${ML_URL}/semantic-match`, {
      query,
      candidates: candidates.map((c) => ({ id: c._id, name: c.name, aliases: c.aliases })),
    });

    if (res.data.bestMatch && res.data.confidence > 0.6) {
      return {
        matchedEntity: res.data.bestMatch.name,
        matchedEntityId: res.data.bestMatch.id,
        confidence: res.data.confidence,
        matchType: "semantic",
      };
    }
  } catch (err) {
    console.warn("Semantic match unavailable:", err.message);
  }

  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { matchEntities };
