# Research Node Implementation Guide

## Overview

The Research node has been successfully transformed from the Link node to provide AI-powered web research capabilities. It intelligently generates search queries, scrapes content, and synthesizes findings.

## What's Been Implemented

### ✅ Frontend Components

1. **Node Type Definition** (`src/types/nodes.ts`)
   - Changed from `link` to `research`
   - Added comprehensive data structure for research results
   - Status tracking: `idle`, `researching`, `completed`, `error`

2. **UI Updates**
   - Updated menu icon and description
   - New cyan color scheme for research nodes
   - Search icon with magnifying glass and plus

3. **Research Panel** (`src/components/panels/ResearchPanel.tsx`)
   - Prompt input textarea
   - Real-time status indicators
   - Expandable search results
   - Scraped content preview
   - AI-generated summary display

4. **Integration**
   - Fully integrated into NodeDetailsPanel
   - Works seamlessly with existing canvas system

### ✅ Backend API

**Current Status: Mock Implementation**

The API route (`/api/research/route.ts`) is functional with mock data. It demonstrates the complete flow:

1. Query Generation: Creates multiple search queries from user prompt
2. Search Execution: Performs web searches (mock)
3. Content Scraping: Extracts content from URLs (mock)
4. Summary Generation: Synthesizes findings (mock)

## Production Implementation Steps

### 1. Integrate Real Search APIs

**Option A: Google Custom Search API**

```bash
# Install dependencies
npm install googleapis
```

```typescript
// Update route.ts
import { google } from 'googleapis';

const customsearch = google.customsearch('v1');

async function performSearch(query: string): Promise<any[]> {
  const res = await customsearch.cse.list({
    auth: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
    q: query,
    num: 5
  });

  return res.data.items || [];
}
```

**Option B: SerpAPI (Recommended for Simplicity)**

```bash
npm install serpapi
```

```typescript
import { getJson } from 'serpapi';

async function performSearch(query: string): Promise<any[]> {
  const response = await getJson({
    engine: "google",
    api_key: process.env.SERPAPI_KEY,
    q: query,
    num: 5
  });

  return response.organic_results || [];
}
```

**Option C: Bing Search API**

```bash
npm install @azure/cognitiveservices-websearch
```

### 2. Implement Real Web Scraping

**Recommended: Jina AI Reader API (No scraping needed)**

```bash
npm install node-fetch
```

```typescript
async function scrapeContent(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`
    }
  });

  const text = await response.text();
  return text.substring(0, 5000); // Limit content
}
```

**Alternative: Puppeteer for Direct Scraping**

```bash
npm install puppeteer
```

```typescript
import puppeteer from 'puppeteer';

async function scrapeContent(url: string): Promise<string> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  const content = await page.evaluate(() => {
    const article = document.querySelector('article') || document.body;
    return article.innerText;
  });
  
  await browser.close();
  return content.substring(0, 5000);
}
```

### 3. Add AI-Powered Query Generation

**Using OpenAI**

```bash
npm install openai
```

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateSearchQueries(prompt: string): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a research assistant. Generate 3-5 diverse search queries to comprehensively research the given topic. Return only the queries, one per line."
      },
      {
        role: "user",
        content: `Generate search queries for: ${prompt}`
      }
    ],
    temperature: 0.7,
  });

  const queries = completion.choices[0].message.content
    ?.split('\n')
    .filter(q => q.trim().length > 0)
    .map(q => q.replace(/^\d+\.\s*/, '').trim());

  return queries || [prompt];
}
```

### 4. Add AI-Powered Summary Generation

```typescript
async function generateSummary(results: SearchResult[], prompt: string): Promise<string> {
  const context = results.map(r => 
    `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.scrapedContent?.substring(0, 1000)}`
  ).join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a research analyst. Synthesize the provided research into a comprehensive summary with key findings, insights, and conclusions."
      },
      {
        role: "user",
        content: `Research topic: ${prompt}\n\nSources:\n${context}\n\nProvide a comprehensive research summary.`
      }
    ],
    temperature: 0.5,
    max_tokens: 1000
  });

  return completion.choices[0].message.content || 'Failed to generate summary';
}
```

## Environment Variables Needed

Add to your `.env` file:

```bash
# Choose one or more search APIs
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# OR
SERPAPI_KEY=your_serpapi_key

# OR
BING_SEARCH_API_KEY=your_bing_api_key

# For content extraction
JINA_API_KEY=your_jina_api_key

# For AI features
OPENAI_API_KEY=your_openai_api_key
```

## API Costs (Approximate)

| Service | Free Tier | Paid Pricing |
|---------|-----------|--------------|
| Google Custom Search | 100 queries/day | $5 per 1000 queries |
| SerpAPI | 100 searches/month | $50/month for 5000 searches |
| Bing Search API | 1000 queries/month | $3-7 per 1000 queries |
| Jina AI Reader | Free for reasonable use | Contact for enterprise |
| OpenAI GPT-4 | N/A | ~$0.03 per 1K tokens |

## Recommended Stack for Production

1. **Search**: SerpAPI (easiest to implement, good results)
2. **Scraping**: Jina AI Reader (no infrastructure needed, clean text)
3. **AI**: OpenAI GPT-4 (best quality) or Claude (Anthropic)

## Testing the Current Implementation

1. Start the dev server: `npm run dev`
2. Create a new Research node on the canvas
3. Enter a research prompt (e.g., "latest developments in quantum computing")
4. Click "Start Research"
5. The mock API will return sample results

## Next Steps

1. Choose your preferred APIs based on budget and requirements
2. Sign up for API keys
3. Add environment variables
4. Replace mock functions in `/api/research/route.ts`
5. Test with real queries
6. Add rate limiting and error handling
7. Consider caching results to reduce API costs

## Advanced Features (Future)

- **Export**: Export research to PDF/Markdown
- **Citations**: Automatic citation formatting
- **Collaborative**: Multiple users researching same topic
- **Incremental**: Add more sources to existing research
- **Filters**: Filter by date, domain, content type
- **Visualization**: Knowledge graph of research connections

## Support

For questions or issues, refer to:
- Google Custom Search API: https://developers.google.com/custom-search
- SerpAPI: https://serpapi.com/
- Jina AI: https://jina.ai/
- OpenAI: https://platform.openai.com/docs

