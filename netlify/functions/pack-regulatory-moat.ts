/**
 * Eagle Vision — Regulatory Moat Pack
 * Factors: R5 (Customer Switching Propensity), R6 (Regulatory Moat Durability)
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';


// Robust JSON extractor — handles raw JSON, ```json``` blocks, and JSON embedded in prose.
// Uses bracket-counting to find the true outermost object, immune to nested {} in strings.
function extractJSONObject(text: string): Record<string, any> | null {
  if (!text || text.length < 2) return null;
  // Method 1: whole text is valid JSON
  try { const t = text.trim(); if (t.startsWith('{')) return JSON.parse(t); } catch {}
  // Method 2: ```json ... ``` fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch {} }
  // Method 3: bracket-count to find outermost { ... }
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
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

function buildEvidenceContext(evidenceTexts: string[], maxChars = 50000): string {
  if (!Array.isArray(evidenceTexts)) return '';
  let combined = '';
  for (const chunk of evidenceTexts) {
    if (!chunk) continue;
    if (combined.length + chunk.length > maxChars) {
      const remaining = maxChars - combined.length;
      if (remaining > 200) combined += '\n\n---\n\n' + chunk.slice(0, remaining);
      break;
    }
    combined += (combined ? '\n\n---\n\n' : '') + chunk;
  }
  return combined;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { company_name, company_url, vertical, evidence_texts, use_knowledge_fallback } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
    const evidenceContext = buildEvidenceContext(evidence_texts || []);
    const hasRichEvidence = evidenceContext.length > 1000;

    const systemPrompt = `You are a senior regulatory and competitive moat analyst at a vertical SaaS PE/growth equity firm. You deeply understand regulatory compliance requirements across healthcare, financial services, field services, and other regulated industries where vertical SaaS operates. You can accurately assess switching costs, data lock-in, and moat durability.

CRITICAL INSTRUCTIONS:
1. For well-known verticals (home health, healthcare, fintech, etc.) you have deep knowledge of regulations — use it
2. Switching costs in vertical SaaS are often underestimated — consider: data migration, compliance history, staff retraining, integration complexity, workflow disruption
3. Regulatory moats are real and durable in many verticals — be specific about which regulations matter
4. Be specific: name the actual regulations (HIPAA, OASIS, EVV, SOC2, etc.) and explain their impact
5. A high switching propensity (R5 high) is BAD for investment. A strong regulatory moat (R6 high) is GOOD.`;

    const userPrompt = `Assess the regulatory environment, switching costs, and moat durability for this vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Infer from evidence and knowledge'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Limited web evidence. CRITICAL: Use your training knowledge about ${company_name} and the ${vertical || 'vertical SaaS'} market. You know the regulatory frameworks for this industry, the switching costs involved, and the competitive dynamics. Provide a substantive analysis. Mark confidence 'L' but give real, specific answers.`
  : `Use evidence below plus your knowledge to provide the most accurate assessment.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "regulatory_moat",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "regulatory_landscape",
      "value": {
        "primary_frameworks": ["<list actual regulations: HIPAA, OASIS, EVV, SOC2, PCI-DSS, FCA, FINRA, etc.>"],
        "enforcement_level": "HIGH"|"MEDIUM"|"LOW",
        "trend": "TIGHTENING"|"STABLE"|"LOOSENING",
        "ai_regulation_impact": "<how AI regulation (EU AI Act, state AI laws, etc.) affects this vertical>",
        "key_regulatory_bodies": ["<agencies/bodies that regulate this vertical>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "compliance_certifications",
      "value": {
        "confirmed_certifications": ["<certifications the company is known to hold: SOC2 Type II, HIPAA BAA, ISO 27001, HITRUST, etc.>"],
        "likely_certifications": ["<certifications likely required/held but not explicitly confirmed>"],
        "compliance_as_moat": "<does compliance certification create a moat? How hard is it for a competitor to achieve the same?>",
        "assessment": "<overall compliance posture>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "switching_cost_analysis",
      "value": {
        "switching_cost_level": "VERY_HIGH"|"HIGH"|"MEDIUM"|"LOW"|"VERY_LOW",
        "cost_drivers": [
          "<specific switching cost factor — e.g. 'Patient/customer data migration requires months of reconciliation'>",
          "<factor 2>",
          "<factor 3>"
        ],
        "data_portability": "<how easy is it to export data? Is it in standard formats?>",
        "integration_complexity": "<how many integrations does this software have that would need to be replicated?>",
        "historical_churn_signal": "<any evidence of actual customer retention rates, NPS, or churn behavior?>",
        "typical_contract_terms": "<what are typical contract lengths and exit provisions?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "data_moat",
      "value": {
        "proprietary_data_description": "<what proprietary data does this company accumulate that competitors don't have?>",
        "data_moat_strength": "STRONG"|"MODERATE"|"WEAK"|"NONE",
        "network_effect": "<does the data improve with more users/customers? Network effect present?>",
        "ai_advantage": "<how does this data advantage translate to better AI models/features?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "competitive_moat_summary",
      "value": {
        "overall_moat_rating": "EXCEPTIONAL"|"STRONG"|"MODERATE"|"WEAK"|"MINIMAL",
        "moat_durability": "<how long can this moat be expected to hold? 1yr/3yr/5yr/10yr+?>",
        "moat_components": ["<list the specific moat components in order of strength>"],
        "key_vulnerabilities": ["<what could erode this moat?>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "R5": {
      "evidence_summary": "<3-4 sentences: How easy is it for a customer to switch away from this software? What are the specific friction points? Data migration, compliance history, integrations, workflow disruption? What does retention/churn data suggest?>",
      "signal_strength": <0.0-1.0, where 0.0=virtually impossible to switch/maximum lock-in, 1.0=trivially easy to switch/no lock-in>
    },
    "R6": {
      "evidence_summary": "<3-4 sentences: How strong and durable is the regulatory moat? Name specific regulations that create barriers. Is this vertical getting MORE regulated over time? Does compliance certification create meaningful competitive advantage?>",
      "signal_strength": <0.0-1.0, where 0.0=no regulatory protection at all, 1.0=exceptional regulatory moat highly durable>
    }
  },
  "red_flags": ["<Real concerns: e.g. 'No data export friction — customers can leave in days', 'Vertical being deregulated'>"],
  "green_flags": ["<Positive moat signals: e.g. 'HIPAA BAA with historical compliance record creates massive switching friction'>"],
  "v2_stub": false
}

SIGNAL STRENGTH CALIBRATION:
R5 (Customer Switching Propensity) — LOWER IS BETTER FOR INVESTMENT:
0.1 = Essentially impossible to switch — multi-year compliance history locked in, massive data migration
0.2 = Very high switching cost — significant workflow disruption, compliance re-certification required
0.3 = High switching cost — data migration complex, staff retraining significant
0.4 = Moderate-high switching cost — takes months and meaningful budget
0.5 = Moderate switching cost — feasible but painful
0.6 = Low-moderate — could switch in weeks with effort
0.7 = Low — competitors offer easy migration tools
0.8 = Very low — data in standard formats, easy to migrate
0.9 = Trivial — customers switch routinely, no meaningful lock-in

R6 (Regulatory Moat Durability) — HIGHER IS BETTER FOR INVESTMENT:
0.1 = No regulatory protection, unregulated vertical
0.2 = Very light regulation, easily overcome by new entrants
0.3 = Some compliance requirements but not differentiating
0.4 = Moderate compliance requirements — some barrier but manageable
0.5 = Meaningful compliance requirements — takes time and money
0.6 = Significant regulatory compliance — SOC2/HIPAA creates real moat
0.7 = Strong regulatory moat — multiple certifications + compliance track record
0.8 = Very strong moat — regulators actively favor established compliant vendors
0.9 = Exceptional moat — regulatory framework essentially requires long-term vendor relationships
1.0 = Maximum regulatory protection — switching away requires regulatory re-approval`;

    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        console.log(`[pack] attempt ${attempts}: response length ${text.length} chars`);
        const parsed = extractJSONObject(text);
        if (parsed) {
          console.log(`[pack] JSON extracted successfully`);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...parsed, elapsed_ms: Date.now() - startTime }),
          };
        } else {
          console.error(`[pack] JSON extraction failed on attempt ${attempts}. Text preview: ${text.slice(0, 300)}`);
        }
      } catch (e: any) {
        console.error(`Attempt ${attempts} failed:`, e?.message);
        if (attempts >= 3) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'regulatory_moat',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          R5: { evidence_summary: 'Pack failed after retries', signal_strength: 0.5 },
          R6: { evidence_summary: 'Pack failed after retries', signal_strength: 0.5 },
        },
        red_flags: ['Regulatory Moat pack failed'],
        green_flags: [],
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
