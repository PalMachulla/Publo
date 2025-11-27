# RAG Implementation Guide for Publo Orchestrator

## Overview

This guide outlines the implementation of **Retrieval-Augmented Generation (RAG)** for the Publo orchestrator to enable intelligent querying of story documents when in canvas/node view.

## The Problem

When the orchestrator is in canvas view (nodes collapsed), it cannot "see" the full content of connected Story Structure nodes. The content exists in Supabase's `document_sections` table but isn't efficiently accessible for LLM context.

## The Solution: Supabase + pgvector

### Why Supabase pgvector?

**✅ Best Choice for Publo:**

1. **Already integrated** - You're using Supabase for all data storage
2. **Native PostgreSQL** - No additional services to manage
3. **Row-level security** - Inherits your existing RLS policies
4. **Cost-effective** - Free tier includes vector operations
5. **Fast semantic search** - Optimized for similarity search
6. **Real-time updates** - Can auto-embed on content changes

**❌ Why NOT local storage:**
- No multi-user support
- Doesn't scale with your cloud architecture
- Requires separate sync mechanism
- More complex deployment

**❌ Why NOT separate vector DB (Pinecone, Weaviate):**
- Additional service to manage & pay for
- Data duplication issues
- More complex security model
- Overkill for current scale

## Embedding Model Recommendation

**Primary Choice: OpenAI `text-embedding-3-small`**

**Why:**
- **Dimension**: 1536 (good balance)
- **Cost**: $0.02 per 1M tokens (10x cheaper than 3-large)
- **Performance**: Excellent for narrative text
- **Speed**: Fast enough for real-time embedding
- **Compatibility**: Widely supported, proven in production

**Alternatives:**
- `text-embedding-3-large` (3072 dim) - If you need higher accuracy, 10x more expensive
- `Cohere embed-v4` (1024 dim) - Slightly cheaper, great multilingual support
- `voyage-2` (1536 dim) - Good for domain-specific tuning

**For Publo**: Start with `text-embedding-3-small`. You can always upgrade later, and OpenAI's models are battle-tested for narrative content.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User in Canvas View                      │
│     "Make an interview with the characters in screenplay"    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrator                             │
│  1. Detects canvas view + connected Story Structure node    │
│  2. Calls RAG Service for relevant content                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   RAG Retrieval Service                      │
│  1. Embed user query with OpenAI                             │
│  2. Search document_embeddings table (cosine similarity)     │
│  3. Return top K relevant chunks with metadata               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase: document_embeddings table             │
│  ┌──────────┬──────────┬────────────┬───────────────────┐   │
│  │ chunk_id │ content  │ embedding  │ section_metadata  │   │
│  │ (UUID)   │ (TEXT)   │ (vector)   │ (JSONB)           │   │
│  └──────────┴──────────┴────────────┴───────────────────┘   │
│                    pgvector extension                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│               Embedding Pipeline (Background)                │
│  1. Listen to document_sections changes                      │
│  2. Chunk content intelligently (by scene/beat)              │
│  3. Embed each chunk with OpenAI                             │
│  4. Store in document_embeddings with metadata               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Supabase Migration (Create pgvector table)
- Enable pgvector extension
- Create `document_embeddings` table
- Add indexes for fast similarity search
- Set up RLS policies

### 2. Embedding Service
- API route: `/api/embeddings/generate`
- Uses OpenAI `text-embedding-3-small`
- Handles batching for efficiency
- Rate limiting and error handling

### 3. Chunking Strategy
- **Smart chunking**: Split by story structure (Scene/Beat boundaries)
- **Chunk size**: ~500-1000 tokens per chunk
- **Overlap**: 50-100 tokens between chunks for context
- **Metadata**: Include structure hierarchy (Act -> Sequence -> Scene)

### 4. Retrieval Service
- API route: `/api/embeddings/search`
- Takes query text, returns top K chunks
- Uses cosine similarity
- Returns chunks with metadata + scores

### 5. Orchestrator Integration
- Modify `canvasContextProvider.ts`
- When in canvas view + story structure node detected:
  - Call RAG search with user query
  - Inject retrieved chunks into LLM prompt
  - Add citation metadata for transparency

### 6. Auto-Embedding Pipeline
- Trigger on `document_sections` INSERT/UPDATE
- Debounce to avoid spam (30s delay)
- Background job or Edge Function
- Status tracking in `document_embeddings`

## Database Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main embeddings table
CREATE TABLE document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  story_structure_node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  
  -- Content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER,
  
  -- Vector (1536 dimensions for text-embedding-3-small)
  embedding vector(1536) NOT NULL,
  
  -- Metadata for retrieval
  metadata JSONB DEFAULT '{}', -- {act, sequence, scene, beat, hierarchy_path}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(document_section_id, chunk_index)
);

-- Index for fast similarity search (HNSW = Hierarchical Navigable Small World)
CREATE INDEX document_embeddings_embedding_idx 
  ON document_embeddings 
  USING hnsw (embedding vector_cosine_ops);

-- Index for filtering by story
CREATE INDEX document_embeddings_node_idx 
  ON document_embeddings(story_structure_node_id);
```

## Cost Estimation

**Assumptions:**
- Average story: 50,000 words ≈ 65,000 tokens
- Chunking: 500 tokens/chunk ≈ 130 chunks
- Embedding model: `text-embedding-3-small` @ $0.02 per 1M tokens

**Per Story:**
- Embedding cost: 65,000 tokens × $0.02 / 1M = **$0.0013 (0.13 cents)**
- Storage: 130 chunks × 1536 dims × 4 bytes ≈ 800KB ≈ **$0.00024/month**

**Per 1000 stories:**
- Initial embedding: **$1.30**
- Monthly storage: **$0.24**

**Query costs:**
- Per query: ~30 tokens × $0.02 / 1M = **$0.0000006 (negligible)**

**Conclusion**: Extremely cost-effective, even at scale.

## Retrieval Strategy

### Query Flow
1. User sends message in canvas view
2. System detects reference node (Story Structure)
3. Embed user query (1 API call)
4. Search embeddings table (cosine similarity > 0.7)
5. Return top 5-10 chunks (~5000 tokens)
6. Inject into orchestrator prompt with metadata

### Optimization Techniques
- **Metadata filtering**: Only search embeddings from target story node
- **Hybrid search**: Combine vector similarity + keyword matching
- **Re-ranking**: Use LLM to re-rank top 20 results to best 5
- **Caching**: Cache embeddings for 24h to avoid re-embedding

## Testing Plan

1. **Unit Tests**
   - Chunking logic preserves structure boundaries
   - Embedding generation handles errors
   - Similarity search returns relevant results

2. **Integration Tests**
   - End-to-end: Upload story → Auto-embed → Query → Retrieve
   - RLS: Users can only query their own stories
   - Performance: Search completes in < 500ms

3. **Quality Tests**
   - Semantic search accuracy: "Interview with characters" retrieves character scenes
   - Boundary cases: Empty documents, very large documents
   - Update handling: Edited sections re-embed correctly

## Security Considerations

1. **RLS Policies**: Inherit from `document_sections` - users can only query their own embeddings
2. **API Key Security**: OpenAI key stored in Supabase secrets, not exposed to client
3. **Rate Limiting**: Prevent abuse of embedding generation
4. **Input Validation**: Sanitize query text, limit length

## Future Enhancements

1. **Conversational Memory**: Store query-response pairs for context
2. **Citation UI**: Show which chunks were used in response
3. **Feedback Loop**: Users rate relevance, improve retrieval
4. **Multi-modal**: Embed images (character art, scene boards)
5. **Cross-story Search**: "Find all scenes with betrayal across my stories"

## Next Steps

1. ✅ Create Supabase migration for pgvector
2. Build embedding service API
3. Implement chunking logic
4. Create retrieval service
5. Integrate with orchestrator
6. Add auto-embedding pipeline
7. Test and optimize

---

**Ready to implement? Let's start with the database migration!**

