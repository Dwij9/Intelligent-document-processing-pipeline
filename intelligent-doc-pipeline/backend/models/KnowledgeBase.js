const mongoose = require("mongoose");

const knowledgeBaseSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["vendor", "category", "glCode", "department", "costCenter"],
      required: true,
    },
    name: { type: String, required: true },
    aliases: [String],
    category: String,
    glCode: String,
    embedding: [Number],
    metadata: mongoose.Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

knowledgeBaseSchema.index({ entityType: 1, name: 1 });
knowledgeBaseSchema.index({ aliases: 1 });
knowledgeBaseSchema.index({ name: "text", aliases: "text" });

module.exports = mongoose.model("KnowledgeBase", knowledgeBaseSchema);
