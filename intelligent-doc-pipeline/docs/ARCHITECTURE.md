# Architecture Decision Record

## System Design

### Why two backend services?

The system splits into a **Node.js API** (Express) and a **Python ML service** (FastAPI) rather than consolidating into one:

- **Language strengths**: Python owns the ML ecosystem — PyTorch, sentence-transformers, pdfplumber, pandas. Node.js owns real-time WebSocket communication, fast JSON APIs, and the npm ecosystem for middleware.
- **Independent scaling**: The ML service is CPU/memory-intensive (embedding generation, autoencoder inference). On Kubernetes or ECS, it can scale horizontally based on queue depth while the API layer scales on request rate.
- **Deployment isolation**: A PyTorch dependency update shouldn't require redeploying the API, and vice versa.

### Pipeline Orchestration

The pipeline is **choreography-based**, not orchestrated by a separate workflow engine:

```
Upload → Node API (save to disk + MongoDB)
           ↓
         calls ML service /parse
           ↓
         calls ML service /extract  (LLM function-calling)
           ↓
         runs semantic matching     (Node + ML service)
           ↓
         calls ML service /detect-anomaly
           ↓
         saves results + broadcasts via WebSocket
```

Each step updates the document status in MongoDB and pushes a WebSocket event. If a step fails, the document is marked `failed` with the error message, and the user can retry.

**Trade-off**: For production at scale, consider replacing the synchronous chain with a message queue (SQS, RabbitMQ) and a step-function orchestrator (AWS Step Functions, Temporal) for retry logic, dead-letter queues, and parallel processing.

### LLM Extraction Strategy

We use **function-calling** (tool-use) rather than free-text prompting for structured extraction:

- The LLM is forced to return data conforming to a JSON schema (vendor, total, line items, etc.)
- No regex parsing of free-text responses needed
- Both OpenAI and Anthropic support this pattern
- The schema acts as documentation and a validation contract

The extraction schema is defined once in `llm_extractor.py` and serves as both the function definition and the implicit documentation of what fields we extract.

### Semantic Matching — Three-Tier Strategy

Matching extracted data against the knowledge base uses a fallback chain:

1. **Exact match** — regex on `name` and `aliases` fields. O(1) via MongoDB index. Confidence: 1.0.
2. **Fuzzy match** — MongoDB `$text` search index. Handles typos, partial names. Confidence: scaled by text score.
3. **Semantic match** — sentence-transformers embeddings with cosine similarity. Catches conceptually related but lexically different terms ("AWS hosting" → "Cloud Infrastructure"). Confidence: raw cosine score.

This layered approach avoids the cost of embedding computation for easy matches while still catching hard cases.

### Anomaly Detection — Hybrid Model

The anomaly detector combines **rule-based checks** with a **PyTorch autoencoder**:

**Rule-based** (always runs):
- Tax ratio > 30% → flag
- Negative tax → flag
- Subtotal + tax ≠ total (> 10% gap) → flag
- No vendor match in knowledge base → flag

**Autoencoder** (runs when trained):
- 12-dimensional feature vector per document
- Encoder: 12 → 32 → 16 → 4 (latent)
- Decoder: 4 → 16 → 32 → 12
- Anomaly score = z-score of reconstruction error vs. training baseline
- Threshold: z-score > 2.0

The autoencoder learns the distribution of "normal" documents. Documents that are hard to reconstruct (high MSE) are outliers. This catches subtle patterns that rules miss — for example, a vendor that normally invoices $5K suddenly submitting a $50K invoice.

**Training**: Call `POST /train-anomaly` with a batch of known-good documents. In production, this should run nightly on the last 30 days of verified (non-anomalous) documents.

### Data Model

```
Document
├── filename, fileType, fileSize, filePath
├── status (uploaded → parsing → extracting → matching → analyzing → completed | failed)
├── rawText (full extracted text)
├── extracted
│   ├── documentType, vendor, invoiceNumber, date, dueDate
│   ├── subtotal, tax, total, currency
│   ├── lineItems[] { description, quantity, unitPrice, amount, category, glCode }
│   └── confidence
├── matches[] { field, matchedEntity, matchedEntityId, confidence, matchType }
├── anomaly { score, isAnomaly, reasons[], detectedAt }
└── processingTimeMs, timestamps

KnowledgeBase
├── entityType (vendor | category | glCode | department | costCenter)
├── name, aliases[]
├── category, glCode
├── embedding[] (for semantic matching)
└── metadata (flexible, e.g. avgInvoice, paymentTerms)
```

### Security Considerations (Production)

- **File uploads**: Validated by extension and MIME type. Stored on disk (or S3 in production) with UUID filenames to prevent path traversal.
- **LLM API keys**: Stored in AWS SSM Parameter Store, injected via environment variables. Never committed to git.
- **MongoDB**: Use authentication in production. The Docker Compose setup runs without auth for local dev only.
- **CORS**: Currently wide open (`*`). Lock down to the frontend domain in production.
- **Rate limiting**: Add express-rate-limit to the API. The ML service should also rate-limit LLM calls to stay within provider quotas.
- **Input sanitization**: The raw text sent to the LLM is truncated to 12K characters to prevent prompt injection via adversarial document content.
