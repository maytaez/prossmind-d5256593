# Cache Embedding Backfill Guide

## Problem

Existing cache entries in `bpmn_prompt_cache` don't have embeddings because they were created before semantic caching was implemented. This means:
- ❌ Semantic similarity search doesn't work for old entries
- ❌ Only exact hash matches work (very limited)
- ❌ Cache hit rate is lower than it should be

## Solution

We've created tools to backfill embeddings for existing cache entries.

---

## Step 1: Apply Migration

First, apply the database migration to add helper functions:

```bash
cd supabase
npx supabase migration up
```

This creates:
- `check_missing_embeddings()` - See how many entries need embeddings
- `get_prompts_needing_embeddings(batch_size)` - Get prompts to process

---

## Step 2: Check Current State

Run this SQL query to see how many entries are missing embeddings:

```sql
SELECT * FROM check_missing_embeddings();
```

Example output:
```
total_entries | entries_with_embeddings | entries_missing_embeddings | percentage_missing
--------------+------------------------+---------------------------+-------------------
     150      |           25           |            125            |       83.33
```

---

## Step 3: Deploy Backfill Function

Deploy the edge function that will generate embeddings:

```bash
cd supabase
npx supabase functions deploy backfill-cache-embeddings
```

---

## Step 4: Run Backfill (Dry Run First)

Test with a dry run to see what would be processed:

```bash
curl -X POST https://[your-project].supabase.co/functions/v1/backfill-cache-embeddings \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10, "dryRun": true}'
```

Response:
```json
{
  "success": true,
  "dryRun": true,
  "message": "Would process 10 prompts",
  "prompts": [
    {"id": "uuid-1", "text": "Employee onboarding process with HR approval..."},
    ...
  ]
}
```

---

## Step 5: Run Actual Backfill

Process a small batch first (10 entries):

```bash
curl -X POST https://[your-project].supabase.co/functions/v1/backfill-cache-embeddings \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10, "dryRun": false}'
```

Response:
```json
{
  "success": true,
  "results": {
    "total": 10,
    "successful": 10,
    "failed": 0,
    "errors": []
  },
  "message": "Processed 10 prompts: 10 successful, 0 failed"
}
```

---

## Step 6: Process Remaining Entries

Increase batch size for remaining entries:

```bash
# Process 50 at a time
curl -X POST https://[your-project].supabase.co/functions/v1/backfill-cache-embeddings \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50}'
```

Repeat until all entries are processed. Check progress:

```sql
SELECT * FROM check_missing_embeddings();
```

---

## Step 7: Verify Results

Check that embeddings were added:

```sql
-- View recent cache entries with embeddings
SELECT 
    id,
    LEFT(prompt_text, 50) as prompt_preview,
    diagram_type,
    CASE 
        WHEN prompt_embedding IS NOT NULL THEN '✅ Has embedding'
        ELSE '❌ Missing'
    END as embedding_status,
    hit_count,
    created_at
FROM bpmn_prompt_cache
ORDER BY created_at DESC
LIMIT 20;
```

Test semantic search:

```sql
-- Get an embedding to test with
SELECT prompt_embedding FROM bpmn_prompt_cache WHERE prompt_embedding IS NOT NULL LIMIT 1;

-- Test similarity search (use the embedding from above)
SELECT 
    LEFT(prompt_text, 60) as prompt,
    diagram_type,
    1 - (prompt_embedding <=> '[embedding-vector]'::vector) as similarity
FROM bpmn_prompt_cache
WHERE prompt_embedding IS NOT NULL
ORDER BY prompt_embedding <=> '[embedding-vector]'::vector
LIMIT 5;
```

---

## Important Notes

### Rate Limiting

The backfill function:
- Processes prompts **one at a time** (not parallel)
- Adds **200ms delay** between each to avoid rate limits
- Recommended batch size: **10-50** entries per call

### Cost Considerations

- **Gemini Embedding API**: Free tier = 1,500 requests/day
- Each cache entry = 1 embedding request
- For large caches (100+ entries), run backfill in batches over multiple days

### Error Handling

If some entries fail:
- Check the `errors` array in the response
- Failed entries will be retried on next backfill run
- Common issues:
  - Rate limiting (wait and retry)
  - Invalid prompt text (check database entry)
  - API key issues (verify `GOOGLE_API_KEY` env var)

---

## Automated Backfill (Optional)

Create a cron job to backfill in batches:

```bash
# Add to your CI/CD or cron
for i in {1..10}; do
  curl -X POST https://[project].supabase.co/functions/v1/backfill-cache-embeddings \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -d '{"batchSize": 50}' \
    && sleep 60  # Wait 1 minute between batches
done
```

---

## Troubleshooting

### "No prompts need embeddings"

✅ All entries already have embeddings! Check:

```sql
SELECT COUNT(*) FROM bpmn_prompt_cache WHERE prompt_embedding IS NOT NULL;
```

### "Embedding API error: 429"

❌ Rate limit exceeded. Solutions:
- Wait 1 minute and retry
- Reduce `batchSize` to 5-10
- Spread backfill over multiple days

### "Embedding dimension mismatch"

❌ Database expects 1536-dim vectors. Check:
```sql
SELECT 
    id, 
    array_length(prompt_embedding, 1) as dims 
FROM bpmn_prompt_cache 
WHERE prompt_embedding IS NOT NULL;
```

All should show `1536`.

---

## After Backfilling

Once all entries have embeddings, deploy the updated functions:

```bash
cd supabase
npx supabase functions deploy process-bpmn-job
npx supabase functions deploy generate-bpmn-combined
```

Now semantic caching will work for:
- ✅ Exact matches (hash-based, ~0ms)
- ✅ Similar prompts (vector search, ~200ms)
- ✅ New prompts (auto-cached with embeddings)

---

## Monitoring Cache Performance

Check cache hit rate:

```sql
SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE hit_count > 1) as reused_entries,
    ROUND(
        COUNT(*) FILTER (WHERE hit_count > 1) * 100.0 / COUNT(*),
        2
    ) as reuse_rate_percent,
    SUM(hit_count) as total_hits,
    AVG(hit_count) as avg_hits_per_entry
FROM bpmn_prompt_cache;
```

View most popular prompts:

```sql
SELECT 
    LEFT(prompt_text, 80) as prompt,
    diagram_type,
    hit_count,
    last_accessed_at
FROM bpmn_prompt_cache
ORDER BY hit_count DESC
LIMIT 10;
```
