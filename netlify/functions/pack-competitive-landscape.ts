import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { company_name, company_url, vertical, competitor_hints, evidence_texts } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const evidenceContext = Array.isArray(evidence_texts)
      ? evidence_texts.slice(0, 6).join('\n\n---\n\n')
      : '';
    const hintStr = Array.isArray(competitor_hints) && competitor_hints.length > 0
      ? `\nCOMPETITOR HINTS FROM ANALYST: ${competitor_hints.join(', ')}`
      : '';

    const prompt = `You are a competitive intelligence analyst for a vertical SaaS growth equity fund.

TARGET COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Unknown — infer from evidence'}
${hintStr}

RESEARCH EVIDENCE:
${evidenceContext || 'No web evidence collected — use general knowledge with LOW confidence.'}

Analyze the AI competitive landscape for this company. Return ONLY valid JSON:

{
  "pack_name": "competitive_landscape",
  "pack_version": "1.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "vertical_heat_index",
      "value": { "score": <0-100>, "grade": "A"|"B"|"C"|"D"|"F", "summary": "<one sentence>" },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "ai_native_entrants",
      "value": [
        { "company": "<name>", "founded": <year or null>, "stage": "<Seed/Series A/B/C>", "last_raise": "<$xM or Unknown>", "traction_signal": "<string>", "threat_level": "HIGH"|"MEDIUM"|"LOW", "url": "<string or null>" }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "incumbent_postures",
      "value": [
        { "company": "<name>", "status": "ACTIVE"|"SIGNALING"|"SILENT", "evidence": "<string>", "url": "<string or null>" }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "horizontal_ai_threat",
      "value": { "level": "HIGH"|"MEDIUM"|"LOW", "threat_actors": ["ChatGPT", "Copilot", "Claude", "Gemini", "Other"], "use_cases_at_risk": ["<string>"] },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "recent_vertical_news",
      "value": [
        { "headline": "<string>", "date": "<YYYY-MM or Unknown>", "url": "<string>", "significance": "<string>" }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "competitive_window_months",
      "value": <number or null>,
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": ["string if any"]
    }
  ],
  "factor_inputs": {
    "R1": { "evidence_summary": "<competitive window evidence>", "signal_strength": <0.0-1.0> },
    "R2": { "evidence_summary": "<AI-native entrant threat evidence>", "signal_strength": <0.0-1.0> },
    "R3": { "evidence_summary": "<incumbent AI posture evidence>", "signal_strength": <0.0-1.0> },
    "R4": { "evidence_summary": "<horizontal AI encroachment evidence>", "signal_strength": <0.0-1.0> },
    "A8": { "evidence_summary": "<compounding loop potential evidence>", "signal_strength": <0.0-1.0> }
  },
  "red_flags": ["<string if any — be specific>"],
  "v2_stub": false
}

SIGNAL STRENGTH GUIDANCE:
- R1 (Competitive Window): 0=window wide open, 1=window closed/closing fast
- R2 (AI-Native Entrant): 0=no entrants, 1=multiple well-funded entrants with traction
- R3 (Incumbent AI Posture): 0=incumbents silent, 1=incumbents GA with traction
- R4 (Horizontal AI): 0=no horizontal threat, 1=widespread adoption displacing SaaS
- A8 (Compounding Loop): 0=no feedback loops, 1=proven compounding data effects

DATA QUALITY RULES:
- If evidence is thin: lower data_quality_score, mark findings as LOW confidence
- If no evidence for a company: be honest, use "Unknown" values
- NEVER invent funding amounts, founding dates, or traction claims
- Always try to include source URLs

Return ONLY the JSON object, no markdown fences, no explanation.`;

    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...parsed, elapsed_ms: Date.now() - startTime }),
          };
        }
      } catch {
        if (attempts >= 2) break;
      }
    }

    // Fallback
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'competitive_landscape',
        pack_version: '1.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          R1: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          R2: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          R3: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          R4: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          A8: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
        },
        red_flags: ['Competitive Landscape pack failed — returned malformed JSON'],
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
