import type { Handler } from '@netlify/functions';
import { z } from 'zod';

const RequestSchema = z.object({
  query: z.string().min(1).max(500),
  max_results: z.number().min(1).max(10).default(8),
  search_depth: z.enum(['basic', 'advanced']).default('advanced'),
  topic: z.string().optional(),
});

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request', details: parsed.error.errors }),
      };
    }

    const { query, max_results, search_depth } = parsed.data;
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY;

    // Try Tavily first — with include_raw_content for maximum context
    if (TAVILY_KEY) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TAVILY_KEY}`,
          },
          body: JSON.stringify({
            query,
            max_results,
            search_depth,
            include_answer: true,
            include_raw_content: true, // Full page content, not just snippets
            include_images: false,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'tavily',
              query,
              results: (data.results || []).map((r: any) => ({
                title: r.title,
                url: r.url,
                // Use raw_content if available (full page), fall back to snippet
                content: (r.raw_content || r.content || '').slice(0, 3000),
                score: r.score || 0,
              })),
              answer: data.answer || null,
              elapsed_ms: Date.now() - startTime,
            }),
          };
        }
      } catch (tavilyErr: any) {
        // Tavily failed — fall through to Brave
        console.error('Tavily failed:', tavilyErr?.message);
      }
    }

    // Fallback to Brave Search
    if (BRAVE_KEY) {
      try {
        const braveRes = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max_results}&result_filter=web`,
          {
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip',
              'X-Subscription-Token': BRAVE_KEY,
            },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (braveRes.ok) {
          const data = await braveRes.json();
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'brave',
              query,
              results: (data.web?.results || []).map((r: any) => ({
                title: r.title,
                url: r.url,
                content: (r.description || r.extra_snippets?.join(' ') || '').slice(0, 1500),
                score: 0.5,
              })),
              answer: null,
              elapsed_ms: Date.now() - startTime,
            }),
          };
        }
      } catch (braveErr: any) {
        console.error('Brave failed:', braveErr?.message);
      }
    }

    // No search API available — return empty
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'none',
        query,
        results: [],
        answer: null,
        elapsed_ms: Date.now() - startTime,
        warning: 'No search API keys configured',
      }),
    };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'timeout',
          query: '',
          results: [],
          answer: null,
          elapsed_ms: Date.now() - startTime,
          warning: 'Search timed out',
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Search failed', message: err?.message }),
    };
  }
};

export { handler };
