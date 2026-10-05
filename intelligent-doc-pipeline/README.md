# Intelligent Document Processing Pipeline

An LLM-powered system that ingests messy PDFs and CSVs (invoices, reports, receipts), extracts structured data via function-calling, runs semantic matching against a MongoDB knowledge base, flags anomalies with a PyTorch model, and serves everything through a React dashboard. The entire stack is containerized with Docker and deployable on AWS ECS or Kubernetes.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React UI  │────▶│  Node.js API     │────▶│  Python ML Svc   │
│  (Dashboard)│◀────│  (Express)       │◀────│  (FastAPI)       │
└─────────────┘     └───────┬──────────┘     └───────┬──────────┘
                            │                        │
                    ┌───────▼──────────┐     ┌───────▼──────────┐
                    │    MongoDB       │     │  PyTorch Models  │
                    │  (Knowledge Base │     │  (Anomaly Det.)  │
                    │   + Documents)   │     │  (Embeddings)    │
                    └──────────────────┘     └──────────────────┘
```

## Tech Stack

| Layer             | Technology                        |
|-------------------|-----------------------------------|
| Frontend          | React.js, Recharts, Tailwind CSS  |
| Backend API       | Node.js, Express, Mongoose        |
| ML Service        | Python, FastAPI, PyTorch          |
| Database          | MongoDB                           |
| Containerization  | Docker, Docker Compose            |
| Orchestration     | Kubernetes / AWS ECS              |
| CI/CD             | GitHub Actions                    |
| Visualization     | Tableau (connects to MongoDB)     |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local dev)
- Python 3.11+ (for local dev)
- MongoDB (or use the Docker container)
- An LLM API key (OpenAI or Anthropic)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/intelligent-doc-pipeline.git
cd intelligent-doc-pipeline
cp .env.example .env
# Edit .env with your API keys and MongoDB URI
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

This starts all four services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **ML Service**: http://localhost:8000
- **MongoDB**: localhost:27017

### 3. Run locally (without Docker)

```bash
# Terminal 1 — MongoDB
mongod --dbpath ./data

# Terminal 2 — ML Service
cd ml-service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3 — Backend
cd backend
npm install
npm run dev

# Terminal 4 — Frontend
cd frontend
npm install
npm start
```

## Pipeline Flow

1. **Upload** — User drops a PDF or CSV into the React dashboard.
2. **Parse** — The ML service extracts raw text (PDFs via pdfplumber, CSVs via pandas).
3. **LLM Extract** — Extracted text is sent to an LLM with function-calling to produce structured JSON (vendor, amount, date, line items, etc.).
4. **Semantic Match** — Embeddings are generated and compared against the MongoDB knowledge base to match vendors, categories, and GL codes.
5. **Anomaly Detection** — A PyTorch autoencoder scores each document; outliers are flagged.
6. **Store & Serve** — Structured data, match results, and anomaly scores are stored in MongoDB and pushed to the React dashboard in real time.

## Project Structure

```
intelligent-doc-pipeline/
├── backend/                 # Node.js Express API
│   ├── config/db.js
│   ├── models/              # Mongoose schemas
│   ├── routes/              # REST endpoints
│   ├── services/            # Business logic
│   ├── middleware/           # Upload handling
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── ml-service/              # Python FastAPI ML service
│   ├── services/            # PDF/CSV parsing, embeddings, anomaly
│   ├── models/              # PyTorch model definitions
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # React dashboard
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── services/        # API client
│   │   └── hooks/           # Custom React hooks
│   ├── Dockerfile
│   └── package.json
├── infra/                   # Deployment configs
│   ├── aws/                 # ECS task defs, CloudFormation
│   └── k8s/                 # Kubernetes manifests
├── .github/workflows/       # CI/CD
├── docker-compose.yml
└── .env.example
```

## Deployment

### AWS ECS

```bash
# Build and push images to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build -t idp-backend ./backend
docker tag idp-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/idp-backend:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/idp-backend:latest

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file infra/aws/cloudformation.yml \
  --stack-name idp-pipeline \
  --capabilities CAPABILITY_IAM
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/
```

## Tableau Integration

Connect Tableau to the MongoDB instance using the MongoDB BI Connector or Tableau's native MongoDB driver. Key collections to visualize:
- `documents` — processing status, extraction results
- `anomalies` — flagged documents with scores
- `knowledge_base` — vendor/category reference data

## Environment Variables

| Variable              | Description                          |
|-----------------------|--------------------------------------|
| `MONGODB_URI`         | MongoDB connection string            |
| `LLM_API_KEY`         | OpenAI or Anthropic API key          |
| `LLM_MODEL`           | Model name (gpt-4o, claude-sonnet)   |
| `ML_SERVICE_URL`      | URL of the Python ML service         |
| `AWS_REGION`           | AWS region for deployment            |
| `AWS_S3_BUCKET`        | S3 bucket for document storage       |
| `JWT_SECRET`           | Secret for auth tokens               |

## License

MIT
