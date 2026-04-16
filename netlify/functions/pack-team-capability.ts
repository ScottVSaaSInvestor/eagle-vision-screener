import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { company_name, company_url, evidence_texts } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const evidenceContext = Array.isArray(evidence_texts)
      ? evidence_texts.slice(0, 4).join('\n\n---\n\n')
      : '';

    const prompt = `You are an investment analyst assessing AI/ML team capability for a vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}

RESEARCH EVIDENCE:
${evidenceContext || 'No web evidence collected — use general knowledge with LOW confidence.'}

Assess the team's AI capability and leadership AI clarity. Return ONLY valid JSON:

{
  "pack_name": "team_capability",
  "pack_version": "1.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "leadership_team",
      "value": [{ "name": "<string>", "role": "<CEO/CTO/etc>", "ai_background": "<description or Unknown>", "linkedin": "<url or null>" }],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "ai_ml_headcount",
      "value": "<estimate e.g. 0, 1-2, 3-5, 5-10, 10+, Unknown>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "ceo_ai_stance",
      "value": "<quote or description of CEO's AI position, or Unknown>",
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "published_research_or_patents",
      "value": "<description or None>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "hiring_signal",
      "value": "<AI-related job openings if found, or None found>",
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "A6": {
      "evidence_summary": "<AI/ML team capability evidence — be specific>",
      "signal_strength": <0.0-1.0>
    },
    "A9": {
      "evidence_summary": "<leadership AI clarity evidence>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<string if leadership has no AI background, no ML hires, or actively dismisses AI>"],
  "v2_stub": false
}

SIGNAL STRENGTH:
- A6 (AI/ML Team): 0=no dedicated AI/ML staff, 0.5=small team exists, 1=world-class AI team
- A9 (Leadership AI Clarity): 0=CEO dismisses AI/no strategy, 0.5=some AI roadmap, 1=deep AI conviction + track record

Return ONLY the JSON object.`;

    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 2000,
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'team_capability',
        pack_version: '1.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          A6: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          A9: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
        },
        red_flags: ['Team Capability pack failed'],
        v2_stub: false,
        status: 'failed',
        elapsed_ms: Date.now() - startTime,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message }),
    };
  }
};

export { handler };
