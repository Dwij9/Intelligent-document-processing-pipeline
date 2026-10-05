require("dotenv").config();
const mongoose = require("mongoose");
const KnowledgeBase = require("../models/KnowledgeBase");

const SEED_DATA = [
  {
    entityType: "vendor",
    name: "Acme Corporation",
    aliases: ["Acme Corp", "ACME", "Acme Inc."],
    category: "Office Supplies",
    glCode: "6100",
    metadata: { avgInvoice: 2500, paymentTerms: "Net 30" },
  },
  {
    entityType: "vendor",
    name: "CloudServe Inc",
    aliases: ["CloudServe", "Cloud Serve"],
    category: "Cloud Infrastructure",
    glCode: "6200",
    metadata: { avgInvoice: 15000, paymentTerms: "Net 60" },
  },
  {
    entityType: "vendor",
    name: "Delta Logistics",
    aliases: ["Delta", "Delta Shipping", "DL Freight"],
    category: "Shipping & Logistics",
    glCode: "6300",
    metadata: { avgInvoice: 5000, paymentTerms: "Net 30" },
  },
  {
    entityType: "category",
    name: "Software Licenses",
    aliases: ["SaaS", "software subscription", "license fee"],
    category: "Technology",
    glCode: "6250",
    metadata: { budgetCap: 100000 },
  },
  {
    entityType: "category",
    name: "Professional Services",
    aliases: ["consulting", "advisory", "contractor"],
    category: "Services",
    glCode: "6400",
    metadata: { budgetCap: 250000 },
  },
  {
    entityType: "category",
    name: "Travel & Expenses",
    aliases: ["travel", "airfare", "hotel", "meals", "T&E"],
    category: "Operations",
    glCode: "6500",
    metadata: { budgetCap: 50000 },
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/docpipeline";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB for seeding");

  await KnowledgeBase.deleteMany({});
  const docs = await KnowledgeBase.insertMany(SEED_DATA);
  console.log(`Seeded ${docs.length} knowledge base entries`);

  await mongoose.disconnect();
  console.log("Done");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
