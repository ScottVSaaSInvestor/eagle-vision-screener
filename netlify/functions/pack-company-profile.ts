import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const PackOutputSchema = z.object({
  pack_name: z.literal('company_profile'),
  pack_version: z.literal('1.0'),
  generated_at: z.string(),
  data_quality_score: z.number().min(0).max(1),
  findings: z.array(z.object({
    key: z.string(),
    value: z.unknown(),
    confidence: z.enum(['H', 'M', 'L']),
    sources: z.array(z.string()),
    unknowns: z.array(z.string()),
  })),
  factor_inputs: z.record(z.object({
    evidence_summary: z.string(),
    signal_strength: z.number().min(0).max(1),
  })),
  red_flags: z.array(z.string()),
  v2_stub: z.literal(false),
});

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { company_name, company_url, evidence_texts, document_text } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const evidenceContext = Array.isArray(evidence_texts)
      ? evidence_texts.slice(0, 4).join('\n\n---\n\n')
      : '';
    const docContext = document_text ? `\n\nUPLOADED DOCUMENT EXCERPT:\n${document_text.slice(0, 3000)}` : '';

    const prompt = `You are an investment analyst building a structured data pack for the Eagle Vision AI Screener.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}

RESEARCH EVIDENCE:
${evidenceContext || 'No web evidence collected.'}
${docContext}

Extract a structured company profile. Return ONLY valid JSON matching this exact schema:

{
  "pack_name": "company_profile",
  "pack_version": "1.0",
  "generated_at": "<ISO8601 timestamp>",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    { "key": "company_name", "value": "<string>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "founded_year", "value": <number or null>, "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "vertical", "value": "<industry vertical>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "hq_location", "value": "<city, state/country>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "estimated_arr_range", "value": "<e.g. $10M-$50M or Unknown>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "funding_stage", "value": "<e.g. Series B, PE-backed, Bootstrapped, Unknown>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "total_funding", "value": "<dollar amount or Unknown>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "employee_count_range", "value": "<e.g. 50-200 or Unknown>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "primary_product", "value": "<one sentence description>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "customer_segments", "value": "<target customers>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "pricing_model", "value": "<seat-based/usage/outcome/unknown>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] },
    { "key": "ai_features_announced", "value": "<boolean or string summary>", "confidence": "H"|"M"|"L", "sources": ["<url>"], "unknowns": [] }
  ],
  "factor_inputs": {
    "A5": { "evidence_summary": "<pricing model flexibility evidence>", "signal_strength": <0.0-1.0> }
  },
  "red_flags": ["<string if any>"],
  "v2_stub": false
}

RULES:
- Use "Unknown" for any field you cannot confirm from evidence
- Cite real URLs from the evidence when available
- signal_strength for A5: 0=rigid seats only, 0.5=multiple tiers, 1=outcome-based or very flexible
- data_quality_score: how confident you are in this overall profile (0=no evidence, 1=highly confident)
- Never hallucinate specific numbers — use ranges or "Unknown"
- Return ONLY the JSON object, no markdown, no explanation`;

    let responseText = '';
    let attempts = 0;

    while (attempts < 2) {
      attempts++;
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.content[0].type === 'text' ? response.content[0].text : '';

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validated = PackOutputSchema.parse({
            ...parsed,
            generated_at: new Date().toISOString(),
            v2_stub: false,
          });
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validated, elapsed_ms: Date.now() - startTime }),
          };
        }
      } catch {
        if (attempts >= 2) break;
        // retry with stricter prompt
      }
    }

    // Return fallback on failure
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'company_profile',
        pack_version: '1.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [{ key: 'company_name', value: company_name, confidence: 'L', sources: [], unknowns: ['All data'] }],
        factor_inputs: { A5: { evidence_summary: 'Pack failed — no evidence', signal_strength: 0.5 } },
        red_flags: ['Company Profile pack failed — LLM returned malformed output'],
        v2_stub: false,
        status: 'failed',
        elapsed_ms: Date.now() - startTime,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Pack failed' }),
    };
  }
};

export { handler };
