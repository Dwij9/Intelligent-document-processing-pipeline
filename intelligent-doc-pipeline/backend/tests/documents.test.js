/**
 * Unit tests for the Document API and processing pipeline.
 *
 * Run with: npx jest tests/documents.test.js
 * Requires: npm i -D jest supertest mongodb-memory-server
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");

// Models
const Document = require("../models/Document");
const KnowledgeBase = require("../models/KnowledgeBase");

// Build a minimal app with routes
const app = express();
app.use(express.json());

// Mount analytics route (no external deps)
const analyticsRoutes = require("../routes/analytics");
app.use("/api/analytics", analyticsRoutes);

const knowledgeRoutes = require("../routes/knowledge");
app.use("/api/knowledge", knowledgeRoutes);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Document.deleteMany({});
  await KnowledgeBase.deleteMany({});
});

// ── Document Model Tests ────────────────────────────────────

describe("Document Model", () => {
  test("creates a document with required fields", async () => {
    const doc = await Document.create({
      filename: "test-invoice.pdf",
      fileType: "pdf",
    });
    expect(doc._id).toBeDefined();
    expect(doc.status).toBe("uploaded");
    expect(doc.createdAt).toBeDefined();
  });

  test("validates fileType enum", async () => {
    await expect(
      Document.create({ filename: "test.docx", fileType: "docx" })
    ).rejects.toThrow();
  });

  test("stores extracted data", async () => {
    const doc = await Document.create({
      filename: "test.pdf",
      fileType: "pdf",
      extracted: {
        documentType: "invoice",
        vendor: "Acme Corp",
        total: 12450,
        lineItems: [
          { description: "Standing desks", quantity: 5, unitPrice: 850, amount: 4250 },
        ],
      },
    });
    expect(doc.extracted.vendor).toBe("Acme Corp");
    expect(doc.extracted.lineItems).toHaveLength(1);
    expect(doc.extracted.total).toBe(12450);
  });

  test("stores anomaly results", async () => {
    const doc = await Document.create({
      filename: "test.pdf",
      fileType: "pdf",
      anomaly: {
        score: 3.2,
        isAnomaly: true,
        reasons: ["Unusually high tax ratio", "Vendor not found"],
      },
    });
    expect(doc.anomaly.isAnomaly).toBe(true);
    expect(doc.anomaly.reasons).toHaveLength(2);
  });
});

// ── Analytics API Tests ─────────────────────────────────────

describe("Analytics API", () => {
  beforeEach(async () => {
    // Seed test documents
    await Document.insertMany([
      {
        filename: "inv-1.pdf",
        fileType: "pdf",
        status: "completed",
        extracted: { vendor: "Acme Corp", total: 5000, lineItems: [{ description: "Item A", amount: 5000, category: "Office" }] },
        anomaly: { score: 0.5, isAnomaly: false, reasons: [] },
        processingTimeMs: 2500,
      },
      {
        filename: "inv-2.pdf",
        fileType: "pdf",
        status: "completed",
        extracted: { vendor: "Acme Corp", total: 3000, lineItems: [{ description: "Item B", amount: 3000, category: "Office" }] },
        anomaly: { score: 3.1, isAnomaly: true, reasons: ["Vendor not found"] },
        processingTimeMs: 3200,
      },
      {
        filename: "inv-3.pdf",
        fileType: "pdf",
        status: "completed",
        extracted: { vendor: "CloudServe", total: 15000, lineItems: [{ description: "Hosting", amount: 15000, category: "Cloud" }] },
        anomaly: { score: 0.2, isAnomaly: false, reasons: [] },
        processingTimeMs: 1800,
      },
      {
        filename: "inv-4.pdf",
        fileType: "pdf",
        status: "failed",
        statusMessage: "Parse error",
      },
    ]);
  });

  test("GET /api/analytics/summary returns correct counts", async () => {
    const res = await request(app).get("/api/analytics/summary");
    expect(res.status).toBe(200);
    expect(res.body.totalDocuments).toBe(4);
    expect(res.body.completed).toBe(3);
    expect(res.body.failed).toBe(1);
    expect(res.body.anomalies).toBe(1);
    expect(res.body.totalValueProcessed).toBe(23000);
    expect(res.body.avgProcessingTimeMs).toBeCloseTo(2500, -2);
  });

  test("GET /api/analytics/by-vendor groups correctly", async () => {
    const res = await request(app).get("/api/analytics/by-vendor");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const acme = res.body.find((v) => v.vendor === "Acme Corp");
    expect(acme.count).toBe(2);
    expect(acme.totalSpend).toBe(8000);
  });

  test("GET /api/analytics/by-category groups line items", async () => {
    const res = await request(app).get("/api/analytics/by-category");
    expect(res.status).toBe(200);
    const office = res.body.find((c) => c.category === "Office");
    expect(office.totalAmount).toBe(8000);
    expect(office.count).toBe(2);
  });

  test("GET /api/analytics/anomaly-breakdown lists reasons", async () => {
    const res = await request(app).get("/api/analytics/anomaly-breakdown");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reason).toBe("Vendor not found");
    expect(res.body[0].count).toBe(1);
  });
});

// ── Knowledge Base API Tests ────────────────────────────────

describe("Knowledge Base API", () => {
  test("POST /api/knowledge creates an entry", async () => {
    const res = await request(app).post("/api/knowledge").send({
      entityType: "vendor",
      name: "Test Vendor",
      aliases: ["TV", "TestV"],
      category: "Supplies",
      glCode: "6100",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Vendor");
    expect(res.body.aliases).toContain("TV");
  });

  test("GET /api/knowledge returns entries with search", async () => {
    await KnowledgeBase.create({
      entityType: "vendor",
      name: "Acme Corporation",
      aliases: ["Acme"],
    });
    await KnowledgeBase.create({
      entityType: "vendor",
      name: "CloudServe Inc",
      aliases: ["CloudServe"],
    });

    const res = await request(app).get("/api/knowledge?search=Acme");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Acme Corporation");
  });

  test("DELETE /api/knowledge/:id soft-deletes", async () => {
    const entry = await KnowledgeBase.create({
      entityType: "vendor",
      name: "To Delete",
    });
    const res = await request(app).delete(`/api/knowledge/${entry._id}`);
    expect(res.status).toBe(200);

    const updated = await KnowledgeBase.findById(entry._id);
    expect(updated.isActive).toBe(false);
  });
});
