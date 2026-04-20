/**
 * PERCH — Research Plan Generator
 *
 * Claude generates targeted, company-specific search queries for all 7 dimensions
 * BEFORE any Tavily searches run. This ensures Tavily is directed by Claude's
 * investment-grade reasoning rather than generic hardcoded queries.
 *
 * Claude knows: company name, URL, vertical, competitor hints, and uploaded docs.
 * Claude outputs: 5 targeted queries per dimension = 35 total searches.
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

function extractJSONObject(text: string): Record<string, any> | null {
  if (!text || text.length < 2) return null;
  try { const t = text.trim(); if (t.startsWith('{')) return JSON.parse(t); } catch {}
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch {} }
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (inString && ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end > firstBrace) { try { return JSON.parse(text.slice(firstBrace, end + 1)); } catch {} }
  return null;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      company_name,
      company_url,
      vertical,
      competitor_hints = [],
      document_summary = '',
      queries_per_dim = 5,
    } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const competitorContext = competitor_hints.length > 0
      ? `\nKnown competitors to research: ${competitor_hints.join(', ')}`
      : '';

    const docContext = document_summary
      ? `\nDocument context provided: ${document_summary.slice(0, 500)}`
      : '';

    const systemPrompt = `You are a senior investment analyst at a PE/growth equity firm specializing in vertical SaaS.
Your job is to design a targeted research plan for PERCH — an AI-powered investment screening tool.

Given a company name, URL, and vertical, generate the most valuable search queries across 7 investment dimensions.
These queries will be sent to Tavily (a web search API) to gather investment-grade evidence.

TODAY IS APRIL 2026. Generate queries with current date context.

QUERY QUALITY RULES:
1. Be SPECIFIC — include the company name in most queries
2. Target INVESTMENT-CRITICAL information: ARR, growth, AI features, competitive position, team
3. Include varied query types: news searches, G2/review searches, LinkedIn signals, job postings, technical content
4. For competitive/market dims, include vertical-specific terms AND company-specific comparisons
5. Queries should complement each other — don't repeat the same search in different words
6. Make queries that a top-tier investment bank analyst would run on day 1 of diligence`;

    const userPrompt = `Generate a targeted research plan for:

COMPANY: ${company_name}
URL: ${company_url || 'unknown'}
VERTICAL: ${vertical || 'vertical SaaS'}${competitorContext}${docContext}

Generate exactly ${queries_per_dim} search queries for each of the 7 investment dimensions below.
Each query must be specific, concrete, and investment-grade.

Return ONLY valid JSON (no markdown, no explanation):
{
  "company_profile": [
    "query 1 — company overview, history, scale",
    "query 2 — ARR, revenue, growth metrics",
    "query 3 — funding, investors, raise history",
    "query 4 — customers, case studies, market presence",
    "query 5 — recent news, press releases, announcements"
  ],
  "competitive_landscape": [
    "query 1 — direct competitors and alternatives",
    "query 2 — AI-native entrants in ${vertical || 'vertical SaaS'}",
    "query 3 — market leaders and recent funding in ${vertical || 'vertical SaaS'}",
    "query 4 — AI disruption threat to ${vertical || 'vertical SaaS'} incumbents",
    "query 5 — PE/M&A activity in ${vertical || 'vertical SaaS'} 2024 2025 2026"
  ],
  "team_capability": [
    "query 1 — CEO/founder background and prior companies",
    "query 2 — technical leadership, CTO, AI/ML hires",
    "query 3 — AI product roadmap and strategy statements",
    "query 4 — engineering culture, job postings for AI/ML roles",
    "query 5 — team depth and advisor/investor operating partners"
  ],
  "regulatory_moat": [
    "query 1 — compliance certifications HIPAA SOC2",
    "query 2 — integration depth and switching costs",
    "query 3 — regulatory requirements in ${vertical || 'vertical SaaS'}",
    "query 4 — customer contract terms and retention evidence",
    "query 5 — data moat and proprietary advantage"
  ],
  "workflow_product": [
    "query 1 — core product features and daily workflow",
    "query 2 — system of record evidence and mission criticality",
    "query 3 — customer ROI and outcome metrics",
    "query 4 — G2 or Capterra reviews describing actual usage",
    "query 5 — recent product updates, releases, new features"
  ],
  "data_architecture": [
    "query 1 — AI features and machine learning capabilities",
    "query 2 — technology stack and cloud infrastructure",
    "query 3 — data assets, longitudinal records, proprietary dataset",
    "query 4 — AI product announcements and launches 2024 2025 2026",
    "query 5 — engineering blog, technical architecture, API integrations"
  ],
  "market_timing": [
    "query 1 — market size TAM and growth rate for ${vertical || 'vertical SaaS'}",
    "query 2 — AI adoption trends and statistics in ${vertical || 'vertical SaaS'}",
    "query 3 — PE deal volume and M&A multiples in ${vertical || 'vertical SaaS'}",
    "query 4 — macro tailwinds: demographics, labor, reimbursement for ${vertical || 'vertical SaaS'}",
    "query 5 — investor and analyst reports on ${vertical || 'vertical SaaS'} 2025 2026"
  ]
}

IMPORTANT: Replace the placeholder descriptions above with REAL, SPECIFIC queries for ${company_name} in ${vertical || 'vertical SaaS'}.
Every query in company_profile, team_capability, regulatory_moat, workflow_product, and data_architecture should include "${company_name}" by name.
Market and competitive queries should include "${vertical || 'vertical SaaS'}" vertical-specific terms.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', // Sonnet is fast and sharp for query generation
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content.find((b: any) => b.type === 'text')?.text ?? '';
    const parsed = extractJSONObject(text);

    if (parsed) {
      // Validate structure — ensure all 7 dims are present
      const dims = ['company_profile', 'competitive_landscape', 'team_capability', 'regulatory_moat', 'workflow_product', 'data_architecture', 'market_timing'];
      const validPlan: Record<string, string[]> = {};
      for (const dim of dims) {
        validPlan[dim] = Array.isArray(parsed[dim]) ? parsed[dim].slice(0, queries_per_dim) : [];
      }
      const totalQueries = Object.values(validPlan).reduce((s, qs) => s + qs.length, 0);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: validPlan,
          total_queries: totalQueries,
          model_used: 'claude-sonnet-4-6',
          elapsed_ms: Date.now() - startTime,
        }),
      };
    }

    // Claude failed to return valid JSON — fall back to empty plan
    // The orchestrator will use its hardcoded fallback queries
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {},
        total_queries: 0,
        error: 'Claude did not return valid JSON — orchestrator will use fallback queries',
        elapsed_ms: Date.now() - startTime,
      }),
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Research plan generation failed' }),
    };
  }
};

export { handler };
