/**
 * Eagle Vision — Company Profile Pack
 * Factor: A5 (Pricing Model Flexibility)
 * Also provides foundational company data for other packs
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
    const { company_name, company_url, evidence_texts, document_text, use_knowledge_fallback } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
    const evidenceContext = buildEvidenceContext(evidence_texts || []);
    const docContext = document_text
      ? `\n\nUPLOADED DOCUMENT EXCERPT:\n${document_text.slice(0, 6000)}`
      : '';
    const hasRichEvidence = evidenceContext.length > 1000;

    const systemPrompt = `You are a senior investment analyst building a structured company profile for a PE/growth equity investment committee. You are highly resourceful — if web evidence is limited, you draw on your extensive training knowledge about vertical SaaS companies.

CRITICAL INSTRUCTIONS:
1. For well-known companies (even small/mid-market), you likely have training knowledge — use it
2. Never use "Unknown" when you can make a reasonable inference — use "Est." or provide a range
3. For funding stage, infer from company age, size, and any known investors
4. Be specific about pricing models — seat-based, per-patient, per-visit, usage-based, etc.
5. Pricing flexibility (A5) is critical — can they charge outcome-based or AI-usage-based fees?
6. Red flags should be material investment risks, not minor data gaps`;

    const userPrompt = `Build a structured company profile for Eagle Vision investment screening.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Limited web evidence returned. CRITICAL: Use your training knowledge about ${company_name}. Provide specific, substantive answers for all fields. For fields you genuinely don't know, use informed ranges or "Unknown" — but try to know. Mark data_quality_score 0.3 to flag reliance on training knowledge.`
  : `Use the research evidence below as primary source, supplemented by your knowledge.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — rely on training knowledge.'}
${docContext}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "company_profile",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0, be honest about evidence quality>,
  "findings": [
    {
      "key": "company_overview",
      "value": {
        "company_name": "<official name>",
        "founded_year": <year or null>,
        "headquarters": "<city, state or country>",
        "website": "<url>",
        "description": "<2-3 sentence description of what the company does and who it serves>",
        "vertical": "<specific industry vertical — e.g. 'Home Health Software', 'Dental Practice Management', 'HVAC Field Service'>",
        "target_customer": "<specific customer segment — e.g. 'Home health agencies with 10-500 caregivers'>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "financials_and_scale",
      "value": {
        "estimated_arr_range": "<e.g. '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M+', 'Unknown' — never 'Unknown' if you can estimate>",
        "arr_basis": "<how was this estimated? Known funding, headcount, customer count, public statements?>",
        "funding_stage": "<Bootstrap/Seed/Series A/Series B/Series C/PE-backed/Public/Unknown>",
        "total_funding_raised": "<$XM or Unknown>",
        "known_investors": ["<investor names if known>"],
        "last_funding_date": "<YYYY-MM or Unknown>",
        "employee_count_range": "<e.g. '50-100', '100-250', '250-500', '500-1000', '1000+', 'Unknown'>",
        "customer_count_estimate": "<e.g. '200+ agencies', '1000+ practices', 'Unknown'>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "product_and_pricing",
      "value": {
        "primary_product": "<description of core product>",
        "product_modules": ["<list of major product modules>"],
        "pricing_model": "<per-seat/per-user/per-patient/per-visit/usage-based/outcome-based/flat-fee/combination>",
        "pricing_flexibility_level": "HIGH"|"MEDIUM"|"LOW",
        "pricing_flexibility_rationale": "<can they charge more when delivering more value? Can they capture AI value creation through pricing?>",
        "contract_structure": "<typical contract length and terms if known>",
        "expansion_model": "<how do customers expand spend? More users, more volume, more modules?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "market_position",
      "value": {
        "market_position": "LEADER"|"STRONG_CHALLENGER"|"CHALLENGER"|"NICHE"|"NEW_ENTRANT"|"UNKNOWN",
        "estimated_market_share": "<% or 'Unknown'>",
        "differentiators": ["<key competitive differentiators cited by company or customers>"],
        "known_competitors": ["<main competitors — name them>"],
        "g2_or_review_score": "<G2/Capterra rating if known, or 'Not available'>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "growth_and_momentum",
      "value": {
        "growth_signals": ["<any evidence of growth — new customers, revenue announcements, headcount growth>"],
        "recent_milestones": ["<product launches, partnerships, expansions, awards in last 2 years>"],
        "press_coverage": ["<notable press, analyst coverage, or awards>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "A5": {
      "evidence_summary": "<3-4 sentences: What is the pricing model? Is it flexible enough to charge for AI-delivered value? Can they move to outcome-based or usage-based pricing as AI features are added? What's the expansion revenue potential from AI upsell?>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<Material investment-level concerns, not minor data gaps>"],
  "green_flags": ["<Notable positive investment signals>"],
  "v2_stub": false
}

A5 SIGNAL STRENGTH (Pricing Flexibility):
0.1 = Rigid per-seat only, no usage or outcome dimension, no AI pricing path
0.2 = Very limited flexibility — locked into annual seat contracts
0.3 = Some tier flexibility but fundamentally seat-based
0.4 = Multiple tiers, some module-based expansion available
0.5 = Reasonable flexibility — per-patient or per-unit model with module expansion
0.6 = Usage-based component available, outcome metrics tracked
0.7 = Can price on outcomes, flexible contract structures available
0.8 = Outcome-based pricing available, AI features priced separately
0.9 = Full pricing flexibility — can charge for AI-delivered value, usage spikes, outcomes
1.0 = Best-in-class pricing with full AI value capture mechanisms`;

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
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'company_profile',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [{ key: 'company_name', value: company_name, confidence: 'L', sources: [], unknowns: ['All data'] }],
        factor_inputs: { A5: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 } },
        red_flags: ['Company Profile pack failed after 3 retries'],
        green_flags: [],
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
