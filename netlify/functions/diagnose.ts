/**
 * Eagle Vision — Diagnostic Endpoint
 * GET /api/diagnose
 * Tests all required API keys and returns their status.
 * Use this to verify your deployment is configured correctly.
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const handler: Handler = async (event) => {
  // Allow GET or POST
  const startTime = Date.now();

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    checks: {},
  };

  // ─── Check 1: ANTHROPIC_API_KEY ─────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

  if (!anthropicKey) {
    results.checks.anthropic = { status: 'MISSING', message: 'ANTHROPIC_API_KEY env var not set' };
  } else {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const response = await client.messages.create({
        model: anthropicModel,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with only the word "OK"' }],
      });
      const reply = response.content.find((b: any) => b.type === 'text')?.text ?? '';
      results.checks.anthropic = {
        status: 'OK',
        model: anthropicModel,
        reply: reply.trim(),
        key_prefix: `${anthropicKey.slice(0, 12)}...`,
        elapsed_ms: Date.now() - startTime,
      };
    } catch (e: any) {
      results.checks.anthropic = {
        status: 'ERROR',
        error: e?.message || 'Unknown error',
        key_prefix: `${anthropicKey.slice(0, 12)}...`,
        hint: e?.status === 401 ? 'Invalid API key — check ANTHROPIC_API_KEY in Netlify env vars' :
              e?.status === 429 ? 'Rate limited — too many requests' :
              e?.message?.includes('model') ? `Model "${anthropicModel}" not found — check ANTHROPIC_MODEL` : '',
      };
    }
  }

  // ─── Check 2: TAVILY_API_KEY ─────────────────────────────────────────────
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    results.checks.tavily = { status: 'MISSING', message: 'TAVILY_API_KEY env var not set — search will not work' };
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query: 'test query site:example.com',
          max_results: 1,
          search_depth: 'basic',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        results.checks.tavily = {
          status: 'OK',
          results_returned: data.results?.length || 0,
          key_prefix: `${tavilyKey.slice(0, 8)}...`,
          elapsed_ms: Date.now() - t0,
        };
      } else {
        const body = await res.text();
        results.checks.tavily = {
          status: 'ERROR',
          http_status: res.status,
          response: body.slice(0, 200),
          hint: res.status === 401 ? 'Invalid Tavily API key' :
                res.status === 429 ? 'Tavily rate limit exceeded' : '',
        };
      }
    } catch (e: any) {
      results.checks.tavily = {
        status: 'ERROR',
        error: e?.message || 'Unknown error',
      };
    }
  }

  // ─── Check 3: BRAVE_SEARCH_API_KEY (optional) ────────────────────────────
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!braveKey) {
    results.checks.brave = { status: 'NOT_SET', message: 'Optional — Brave Search not configured (Tavily is primary)' };
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
        headers: { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        results.checks.brave = { status: 'OK', elapsed_ms: Date.now() - t0 };
      } else {
        results.checks.brave = { status: 'ERROR', http_status: res.status };
      }
    } catch (e: any) {
      results.checks.brave = { status: 'ERROR', error: e?.message };
    }
  }

  // ─── Check 4: ACCESS_PASSCODE ────────────────────────────────────────────
  results.checks.passcode = process.env.ACCESS_PASSCODE
    ? { status: 'SET', length: process.env.ACCESS_PASSCODE.length }
    : { status: 'MISSING', message: 'ACCESS_PASSCODE not set — login will not work' };

  // ─── Summary ─────────────────────────────────────────────────────────────
  const allOk = results.checks.anthropic?.status === 'OK' && results.checks.tavily?.status === 'OK';
  results.summary = allOk
    ? '✅ All critical services operational — Eagle Vision should work correctly'
    : '❌ One or more critical services are not configured correctly — see checks above';
  results.elapsed_ms = Date.now() - startTime;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  };
};

export { handler };
