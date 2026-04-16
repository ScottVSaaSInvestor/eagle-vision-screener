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
    const { company_name, company_url, vertical, evidence_texts } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const evidenceContext = Array.isArray(evidence_texts)
      ? evidence_texts.slice(0, 4).join('\n\n---\n\n')
      : '';

    const prompt = `You are a regulatory and competitive moat analyst for a vertical SaaS investment fund.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Unknown — infer from evidence'}

RESEARCH EVIDENCE:
${evidenceContext || 'No evidence — use general industry knowledge with LOW confidence.'}

Assess the regulatory environment, compliance requirements, and moat durability. Return ONLY valid JSON:

{
  "pack_name": "regulatory_moat",
  "pack_version": "1.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "regulatory_frameworks",
      "value": ["<e.g. HIPAA, SOC2, PCI-DSS, FCA, FDA, FINRA, etc. or None identified>"],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "compliance_certifications",
      "value": ["<certifications held, e.g. SOC2 Type II, ISO 27001, or Unknown>"],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "switching_friction_score",
      "value": "<HIGH|MEDIUM|LOW — how hard is it for customers to switch away>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "data_moat_strength",
      "value": "<description of proprietary data advantages or None>",
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "regulatory_risk_trend",
      "value": "<INCREASING_PROTECTION|STABLE|DECREASING — trend for this vertical>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "ai_regulation_exposure",
      "value": "<description of how AI regulation affects this vertical>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "R5": {
      "evidence_summary": "<customer switching propensity evidence>",
      "signal_strength": <0.0-1.0>
    },
    "R6": {
      "evidence_summary": "<regulatory moat durability evidence>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<string if there are material regulatory risks or no moat>"],
  "v2_stub": false
}

SIGNAL STRENGTH:
- R5 (Customer Switching Propensity): 0=locked in/high friction, 1=trivial to switch
- R6 (Regulatory Moat Durability): 0=no reg protection, 1=strong durable regulatory moat (NOTE: HIGH signal here = GOOD moat = LOW risk — scoring engine inverts this)

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
        pack_name: 'regulatory_moat',
        pack_version: '1.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          R5: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
          R6: { evidence_summary: 'Pack failed', signal_strength: 0.5 },
        },
        red_flags: ['Regulatory Moat pack failed'],
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
