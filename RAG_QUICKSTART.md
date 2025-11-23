# RAG Quick Start Guide

## 🎉 What's New

Your orchestrator can now **semantically search** through story documents using AI embeddings! When you ask questions like "Make an interview with the characters in the screenplay," the orchestrator will:

1. **Detect** which story node you're referencing
2. **Search** through embedded content to find relevant scenes/sections
3. **Retrieve** the most relevant chunks (characters, dialogue, plot points)
4. **Answer** your request with full context and understanding

## 🚀 Getting Started

### Step 1: Run the Database Migration

First, apply the new migration to enable pgvector:

```bash
cd /Users/palmac/Aiakaki/Code/publo

# If using Supabase CLI locally:
supabase migration up

# Or manually apply the migration:
# Run the SQL in supabase/migrations/013_create_document_embeddings.sql
# in your Supabase SQL Editor
```

This creates:
- `document_embeddings` table for storing vectors
- `embedding_queue` table for async processing
- pgvector extension with HNSW indexes for fast search
- Auto-trigger to queue new content for embedding

### Step 2: Configure OpenAI API Key

The RAG system uses OpenAI's `text-embedding-3-small` model ($0.02 per 1M tokens).

**Your API key should already be configured** in Supabase's `user_api_keys` table from Settings → API Keys.

Verify:
```sql
SELECT provider, is_active FROM user_api_keys WHERE provider = 'openai';
```

### Step 3: Generate Embeddings for a Story

#### Option A: Manual Generation (API Route)

```typescript
// Call from your UI or console:
await fetch('/api/embeddings/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'batch',
    nodeId: 'your-story-structure-node-id',
    sections: [
      {
        documentSectionId: 'section-uuid-1',
        content: 'Your story content here...',
        structureItem: { id: 'act-1', level: 1, type: 'act' }
      },
      // ... more sections
    ]
  })
})
```

#### Option B: Automatic Generation (Trigger)

The system **automatically queues** content for embedding when you:
- Create a new `document_section` with content > 50 characters
- Update an existing section's content

Check queue status:
```sql
SELECT * FROM embedding_queue WHERE status = 'pending';
```

Process queue manually:
```typescript
// You'd typically run this in a cron job or edge function
import { processEmbeddingQueue } from '@/lib/embeddings/embeddingPipeline'

const result = await processEmbeddingQueue()
console.log(`Processed ${result.successful} embeddings`)
```

### Step 4: Use RAG in Canvas View

1. **Open your story** in canvas view
2. **Connect your Story Structure node** to the Orchestrator
3. **Ask questions** like:
   - "Make an interview with the characters in this screenplay"
   - "What happens in Act 2?"
   - "Summarize the conflict between Alice and Bob"
   - "Create a podcast discussing the themes"

The orchestrator will **automatically**:
- Detect you're referencing the screenplay
- Check if embeddings exist
- Perform semantic search to find relevant content
- Inject that content into its reasoning
- Generate an informed response

## 📊 Monitoring & Debugging

### Check Embedding Status

```typescript
// GET /api/embeddings/generate?nodeId=your-node-id
const response = await fetch('/api/embeddings/generate?nodeId=your-node-id')
const status = await response.json()
console.log(status)
// {
//   exists: true,
//   chunkCount: 45,
//   queueStatus: 'completed'
// }
```

### View Chat Logs

The orchestrator chat now shows:
- `🔍 Checking for semantic search availability...`
- `✅ Semantic search active: Found 8 relevant chunks`
- `📊 Average relevance: 87%`

### Supabase Dashboard

Query embeddings:
```sql
-- See all embeddings for a story
SELECT 
  id, 
  chunk_index, 
  token_count,
  metadata->>'hierarchy_path' as location,
  embedding_status
FROM document_embeddings
WHERE story_structure_node_id = 'your-node-id'
ORDER BY chunk_index;

-- Check similarity between query and content
SELECT 
  chunk_text,
  metadata->>'hierarchy_path',
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM document_embeddings
WHERE story_structure_node_id = 'your-node-id'
ORDER BY similarity DESC
LIMIT 5;
```

## 🔧 Troubleshooting

### "No embeddings found for this node"

**Solution**: Generate embeddings first:
```bash
# Option 1: Use the API
POST /api/embeddings/generate
{
  "mode": "single",
  "nodeId": "your-node-id",
  "documentSectionId": "section-id"
}

# Option 2: Trigger auto-embedding by editing content in the UI
```

### "Embeddings are still being generated"

**Solution**: Wait for the queue to process, or manually process:
```sql
-- Check queue
SELECT status, error_message FROM embedding_queue;

-- Retry failed items
UPDATE embedding_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed';
```

### "Semantic search unavailable"

**Possible causes**:
1. No story structure node connected to orchestrator
2. Embeddings not generated yet
3. OpenAI API key missing/invalid
4. Network error

**Check logs**: Look for `[RAG]` prefix in browser console

### High Costs

**Don't worry!** Embeddings are dirt cheap:
- 50,000 word story ≈ $0.0013 (0.13 cents) to embed
- Queries are essentially free (~$0.0000006 per query)

**Storage**: ~800KB per story (negligible cost)

## 🎨 Advanced Usage

### Custom Chunking

Modify `chunkingService.ts` to adjust:
```typescript
const config = {
  maxTokensPerChunk: 800,    // Smaller = more precise, more chunks
  minTokensPerChunk: 100,    // Avoid tiny chunks
  overlapTokens: 50,         // Context overlap between chunks
  respectBoundaries: true    // Don't split scenes/beats
}
```

### Hybrid Search (Semantic + Keywords)

```typescript
const response = await fetch('/api/embeddings/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'characters betrayal',
    nodeId: 'story-id',
    searchMode: 'hybrid', // Combines vector + keyword search
    matchCount: 10
  })
})
```

### Re-ranking Results

Implement LLM-based re-ranking in `retrievalService.ts`:
```typescript
export async function reRankResults(
  query: string,
  results: RetrievalResult[],
  topK: number = 5
): Promise<RetrievalResult[]> {
  // Use LLM to judge relevance
  // Return top K most relevant
}
```

## 📈 Performance Optimization

### Index Tuning

HNSW index parameters (in migration):
```sql
-- Current settings (balanced):
CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For better recall (slower build):
WITH (m = 32, ef_construction = 128);

-- For faster search (lower recall):
WITH (m = 8, ef_construction = 32);
```

### Vacuum After Bulk Import

After embedding many stories:
```sql
VACUUM ANALYZE document_embeddings;
```

### Caching

Embeddings are stored permanently. Re-query them without re-embedding!

## 🔮 Future Enhancements

Ideas to implement:
1. **Conversational memory**: Store query history for better context
2. **Citation UI**: Show which chunks were used in response
3. **Feedback loop**: Let users rate relevance, improve retrieval
4. **Multi-modal**: Embed images (character art, scene boards)
5. **Cross-story search**: "Find all betrayal scenes across my stories"
6. **Streaming**: Stream chunks as they're retrieved
7. **Edge Functions**: Background embedding processing

## 🆘 Need Help?

1. **Check the logs**: Browser console has `[RAG]` prefix logs
2. **Inspect database**: 
   ```sql
   SELECT * FROM document_embeddings WHERE embedding_status = 'failed';
   ```
3. **Test API routes**: Use Postman/curl to test `/api/embeddings/*`
4. **Review migration**: Ensure `013_create_document_embeddings.sql` applied successfully

## 📚 Further Reading

- [RAG Implementation Guide](./RAG_IMPLEMENTATION_GUIDE.md) - Full technical details
- [OpenAI Embeddings Docs](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Vector Docs](https://supabase.com/docs/guides/ai/vector-columns)

---

**Happy semantic searching! 🚀**

