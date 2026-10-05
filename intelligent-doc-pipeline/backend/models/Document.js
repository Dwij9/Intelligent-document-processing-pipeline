const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema(
  {
    description: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number,
    category: String,
    glCode: String,
  },
  { _id: false }
);

const anomalySchema = new mongoose.Schema(
  {
    score: { type: Number, default: 0 },
    isAnomaly: { type: Boolean, default: false },
    reasons: [String],
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const matchResultSchema = new mongoose.Schema(
  {
    field: String,
    matchedEntity: String,
    matchedEntityId: mongoose.Schema.Types.ObjectId,
    confidence: Number,
    matchType: { type: String, enum: ["exact", "semantic", "fuzzy"] },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: String,
    fileType: { type: String, enum: ["pdf", "csv"], required: true },
    fileSize: Number,
    filePath: String,

    status: {
      type: String,
      enum: ["uploaded", "parsing", "extracting", "matching", "analyzing", "completed", "failed"],
      default: "uploaded",
    },
    statusMessage: String,

    rawText: String,

    extracted: {
      documentType: String,
      vendor: String,
      invoiceNumber: String,
      date: Date,
      dueDate: Date,
      subtotal: Number,
      tax: Number,
      total: Number,
      currency: { type: String, default: "USD" },
      lineItems: [lineItemSchema],
      notes: String,
      confidence: Number,
      rawResponse: mongoose.Schema.Types.Mixed,
    },

    matches: [matchResultSchema],

    anomaly: anomalySchema,

    processedAt: Date,
    processingTimeMs: Number,
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ status: 1 });
documentSchema.index({ "extracted.vendor": 1 });
documentSchema.index({ "anomaly.isAnomaly": 1 });
documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);
