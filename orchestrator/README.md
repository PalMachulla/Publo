# Publo Orchestrator Backend

Python backend for the Publo creative writing platform, replacing the TypeScript frontend orchestrator.

## 🎯 What This Is

This is the backend migration of your orchestrator system:

```
BEFORE (TypeScript/Next.js):
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│  ┌─────────────────────────────────┐   │
│  │      Orchestrator Engine        │   │
│  │  ├── intentRouter.ts            │   │
│  │  ├── classifier.ts              │   │
│  │  ├── DeepAnalyzer.ts            │   │
│  │  ├── blackboard.ts              │   │
│  │  └── ... (8,000+ lines)         │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

AFTER (Python/FastAPI):
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│         (UI only, ~thin client)         │
└──────────────────┬──────────────────────┘
                   │ HTTP/WebSocket
                   ▼
┌─────────────────────────────────────────┐
│         Python Backend (this)           │
│  ├── Intent Analysis ✅                 │
│  ├── State Management (coming)          │
│  ├── LangGraph Workflows (coming)       │
│  └── Multi-Agent System (coming)        │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Set Up Python Environment

```bash
# Navigate to this directory
cd publo-backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your API keys
# At minimum, you need OPENAI_API_KEY or ANTHROPIC_API_KEY
```

### 3. Run the Server

```bash
# Start with auto-reload (like Next.js dev mode)
uvicorn main:app --reload --port 8000

# You should see:
# 🚀 Publo Orchestrator Backend starting...
# 📍 API docs available at: http://localhost:8000/docs
```

### 4. Test It

Open http://localhost:8000/docs in your browser to see the interactive API docs.

Or test with curl:

```bash
# Health check
curl http://localhost:8000/health

# Test intent analysis
curl -X POST http://localhost:8000/api/intent/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write chapter 1",
    "activeSegment": {"id": "ch1", "name": "Chapter 1", "level": 2},
    "documentPanelOpen": true
  }'
```

## 📁 Project Structure

```
publo-backend/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── api/                      # API routes (like Next.js API routes)
│   ├── health.py             # Health check endpoints
│   ├── intent.py             # Intent analysis endpoints
│   └── orchestrate.py        # Full orchestration (coming)
└── orchestrator/             # Core orchestrator logic
    └── intent/               # Intent analysis module
        ├── types.py          # Pydantic models (like Zod schemas)
        ├── classifier.py     # Pattern matching (classifier.ts)
        ├── deep_analyzer.py  # LLM analysis (DeepAnalyzer.ts)
        └── analyzer.py       # Main pipeline (intentRouter.ts)
```

## 🔄 Migration Status

| Component | TypeScript | Python | Status |
|-----------|------------|--------|--------|
| Intent Analysis | `intentRouter.ts`, `classifier.ts`, `DeepAnalyzer.ts` | `orchestrator/intent/` | ✅ Done |
| State Management | `blackboard.ts`, `worldState.ts` | `orchestrator/state/` | 🔜 Next |
| LangGraph Workflow | `MultiAgentOrchestrator.ts`, `DAGExecutor.ts` | `orchestrator/graph/` | 📋 Planned |
| Tools | `tools/*.ts` | `orchestrator/tools/` | 📋 Planned |
| Actions | `actions/*.ts` | `orchestrator/actions/` | 📋 Planned |

## 🔗 Connecting to Your Frontend

### Option 1: Direct API Calls

In your Next.js code, call the Python backend directly:

```typescript
// In your OrchestratorPanel.tsx or wherever you call analyzeIntent

const useBackendIntent = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'

async function analyzeIntent(message: string, context: PipelineContext) {
  if (useBackendIntent) {
    // Call Python backend
    const response = await fetch('http://localhost:8000/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...context })
    })
    return response.json()
  } else {
    // Use existing TypeScript code
    return originalAnalyzeIntent(message, context)
  }
}
```

### Option 2: Proxy Through Next.js API Route

Create a proxy route to avoid CORS in production:

```typescript
// app/api/backend/intent/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  
  const response = await fetch(`${process.env.BACKEND_URL}/api/intent/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  return Response.json(await response.json())
}
```

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=orchestrator

# Run specific test
pytest tests/test_intent.py -v
```

## 🚢 Deployment

### Railway (Recommended)

1. Push this code to a GitHub repo
2. Go to [railway.app](https://railway.app)
3. Connect your GitHub repo
4. Add environment variables in Railway dashboard
5. Deploy!

Railway auto-detects FastAPI and sets up the server.

### Render

Similar process - Render also auto-detects Python apps.

### Docker (Optional)

```dockerfile
# Dockerfile (if you want containerization)
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📚 Key Concepts for Frontend Developers

### Python vs TypeScript

| TypeScript | Python | Notes |
|------------|--------|-------|
| `interface` | `class` with Pydantic | Pydantic validates at runtime |
| `type X = ...` | `TypedDict` or `BaseModel` | |
| `async/await` | `async/await` | Works the same! |
| `npm install` | `pip install` | |
| `node_modules/` | `venv/` | Virtual environment |
| `package.json` | `requirements.txt` | |
| `.env` | `.env` | Same concept |
| Zod | Pydantic | Schema validation |

### FastAPI vs Next.js API Routes

```typescript
// Next.js API route
export async function POST(request: Request) {
  const body = await request.json()
  return Response.json({ result: "done" })
}
```

```python
# FastAPI equivalent
@app.post("/endpoint")
async def handler(request: MyRequestModel):
    return {"result": "done"}
```

FastAPI automatically:
- Validates request body against `MyRequestModel`
- Generates OpenAPI docs
- Returns proper error responses for validation failures

### Running Locally

```bash
# TypeScript/Next.js
npm run dev

# Python/FastAPI
uvicorn main:app --reload
```

Both auto-reload on file changes!

## 🤝 Need Help?

1. Check the API docs at http://localhost:8000/docs
2. Look at the code comments - they explain the TypeScript equivalents
3. The structure mirrors your TypeScript code intentionally
