/**
 * Eagle Vision — Research Gap Fill
 *
 * Called by the orchestrator after Phase 1 broad search.
 * Given a dimension (e.g. "team_capability") and the raw evidence collected so far,
 * Claude identifies what critical information is MISSING and generates targeted
 * follow-up search queries to fill those gaps.
 *
 * This is the "analyst asking 'what don't we know yet?'" step.
 * It is the secret sauce that separates deep research from a single-pass search.
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// Robust JSON extractor — bracket-counting, immune to nested {} in strings
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

// Dimension-specific gap analysis instructions
const DIMENSION_CONTEXT: Record<string, string> = {
  company_profile: `You are identifying gaps in company profile research. Critical unknowns that need gap-fill include:
- Exact ARR or revenue range (look for press releases, job postings with pay ranges that imply scale, customer count × ASP estimates)
- Funding round details (exact amounts, lead investors, dates)
- Employee count and growth trajectory (LinkedIn, job boards)
- Customer logos and case studies (press releases, award submissions)
- G2/Capterra review scores and volume
- Founding team background and prior exits`,

  competitive_landscape: `You are identifying gaps in competitive landscape research. Critical unknowns that need gap-fill include:
- Specific AI-native entrants: name, funding, traction, differentiator
- Incumbent AI roadmaps: what specific features have incumbents shipped vs announced?
- Recent funding rounds in the vertical (last 12 months)
- Acquisition activity in the vertical (who is buying whom?)
- Horizontal AI tools (ChatGPT, Copilot) adoption in this vertical among operators
- Head-to-head comparison articles or analyst reports`,

  team_capability: `You are identifying gaps in team capability research. Critical unknowns that need gap-fill include:
- CEO and CTO names, backgrounds, prior companies
- Head of AI/ML role if exists — who holds it?
- Specific AI features that have been shipped to production
- Job postings for AI/ML roles (signal of AI investment)
- Engineering blog posts or technical talks
- CEO public statements on AI strategy (podcasts, press interviews)
- LinkedIn profiles of key technical leaders`,

  workflow_product: `You are identifying gaps in workflow/product research. Critical unknowns that need gap-fill include:
- Specific product modules and what workflows they own
- Whether it is genuinely a system of record vs an add-on tool
- Customer ROI metrics, time-savings, revenue impact quantification
- Specific case studies with named customers and measurable outcomes
- Daily active use evidence (users describe daily workflow)
- Integration depth: how many integrations, with what systems?
- G2/Capterra reviews that describe actual day-to-day product usage`,

  data_architecture: `You are identifying gaps in data architecture research. Critical unknowns that need gap-fill include:
- Technology stack: cloud provider, database choices, API architecture
- Specific AI/ML features already in production (not roadmap)
- Data volume: how many records, customers, longitudinal years of data
- Outcome labeling: does the software capture what happened after the service/product was delivered?
- Engineering blog posts describing AI/ML systems
- Whether they are building AI internally or wrapping third-party APIs
- Architecture readiness: cloud-native, microservices, data lake, ML pipeline`,

  regulatory_moat: `You are identifying gaps in regulatory moat research. Critical unknowns that need gap-fill include:
- Specific compliance certifications held (SOC2 Type II, HIPAA BAA, HITRUST, ISO 27001)
- Regulatory framework details for this vertical (specific agencies, requirements)
- Customer switching cost evidence (migration complexity, compliance history, integration complexity)
- Data portability and export capabilities
- Contract term lengths and exit provisions
- Evidence of actual customer longevity (multi-year case studies, customer anniversary announcements)
- New or emerging regulations that strengthen the moat`,

  market_timing: `You are identifying gaps in market timing research. Critical unknowns that need gap-fill include:
- Specific market size estimates with source and methodology
- Recent PE/VC deal flow in this vertical (last 12-18 months)
- AI adoption statistics for this vertical (survey data, operator reports)
- Comparable transaction multiples and recent M&A deals
- Macro tailwinds: demographic trends, reimbursement changes, labor shortages
- Industry analyst reports (Gartner, Forrester, CB Insights, Pitchbook) on this vertical
- Conference keynote themes from vertical-specific conferences`,
};

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      dimension,
      company_name,
      vertical,
      raw_evidence,
      num_queries = 5,
    } = body;

    if (!dimension || !company_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'dimension and company_name required' }),
      };
    }

    // Gap-fill just generates search queries — speed is critical, depth is not.
    // Sonnet is 3-4x faster than Opus and more than sufficient for query generation.
    // This keeps gap-fill well within the 26s Netlify timeout.
    const model = 'claude-sonnet-4-6';

    const dimensionContext = DIMENSION_CONTEXT[dimension] || `You are identifying research gaps for ${dimension} analysis.`;

    const systemPrompt = `You are a senior investment research analyst at a PE/growth equity firm. Your job is to analyze partial research evidence and identify the most critical gaps that prevent a thorough investment-grade assessment.

${dimensionContext}

RULES:
1. Generate SPECIFIC, searchable queries — not vague ones
2. Each query should target a specific unknown that would materially change the investment assessment
3. Prioritize queries most likely to yield investable signal
4. Queries should be Google-searchable (include company name, specific terms)
5. Vary query structure: include some with quotes for exact phrases, some without
6. Do NOT generate queries for things already well-covered in the evidence
7. TODAY IS APRIL 17, 2026. Your knowledge extends through early 2026 — use current date context when generating queries.`;

    const evidenceLen = (raw_evidence || '').length;
    const userPrompt = `Analyze this research evidence for ${company_name} (${vertical || 'vertical SaaS'}) in the "${dimension}" dimension.

EVIDENCE COLLECTED SO FAR (${Math.round(evidenceLen/1000)}K chars from multi-pass deep research):
${(raw_evidence || '').slice(0, 20000)}
${evidenceLen > 20000 ? `\n[... ${Math.round((evidenceLen - 20000)/1000)}K more chars truncated for gap analysis focus ...]` : ''}

Based on this evidence, identify the MOST CRITICAL GAPS that prevent an investment-grade assessment of this dimension. Focus on:
1. Missing financial metrics that affect valuation (ARR, growth rate, churn, NRR)
2. Missing competitive intelligence that affects risk assessment
3. Missing technical/product facts that affect readiness scoring
4. Missing people/team facts that affect conviction
5. Missing market/timing data that affects entry attractiveness

Return ONLY valid JSON (no markdown, no extra text):
{
  "gaps_identified": [
    "<specific gap 1 - what we don't know, why it materially affects the investment decision>",
    "<specific gap 2>",
    "<specific gap 3>"
  ],
  "queries": [
    "<targeted search query 1 - specific, searchable, designed to fill gap>",
    "<targeted search query 2>",
    "<targeted search query 3>",
    "<targeted search query 4>",
    "<targeted search query 5>",
    "<targeted search query 6>",
    "<targeted search query 7>",
    "<targeted search query 8>"
  ]
}

Generate exactly ${num_queries} queries in the "queries" array. Make them:
- Specific and concrete (include company name, exact search terms)
- Varied in approach (news, LinkedIn, job boards, G2, analyst reports, Crunchbase)
- Targeted at the most investment-critical gaps first
- NOT duplicating queries already answered by the evidence above`;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,  // Larger budget for richer gap analysis and more queries
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = extractJSONObject(text);

      if (parsed) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: Array.isArray(parsed.queries) ? parsed.queries : [],
            gaps_identified: Array.isArray(parsed.gaps_identified) ? parsed.gaps_identified : [],
            dimension,
            elapsed_ms: Date.now() - startTime,
          }),
        };
      }
    } catch (e: any) {
      console.error('Gap fill generation failed:', e?.message);
    }

    // Fallback: return empty (orchestrator handles gracefully)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [],
        gaps_identified: ['Gap analysis failed — proceeding with available evidence'],
        dimension,
        elapsed_ms: Date.now() - startTime,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Gap fill failed' }),
    };
  }
};

export { handler };
