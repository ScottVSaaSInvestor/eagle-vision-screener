/**
 * Eagle Vision — Market Timing Pack
 * Factor: R7 (Market Timing Risk)
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

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
    const evidenceContext = buildEvidenceContext(evidence_texts || []);
    const hasRichEvidence = evidenceContext.length > 1000;

    const systemPrompt = `You are a senior market analyst at a PE/growth equity firm specializing in vertical SaaS AI investments. You have deep knowledge of vertical SaaS market sizes, growth rates, PE deal activity, and AI adoption curves across industries.

You evaluate market timing risk — the risk that an investment is either too early (no market yet) or too late (market already consolidated with AI-native winners emerging). The ideal window is when AI adoption is beginning but before consolidation.

CRITICAL INSTRUCTIONS:
1. You have extensive knowledge of market sizes and PE deal activity through early 2026 — use it
2. For well-known verticals (home health, dental, HVAC, legal, restaurant, etc.) you know the TAM, CAGR, and investment activity
3. "Window open" means: AI adoption just beginning, clear market growth, PE deals active, no dominant AI-native winner yet
4. "Window closing" means: major AI-native Series C+ companies emerging, market consolidating
5. Be specific about TAM numbers, CAGR estimates, and recent deals you know about
6. TODAY IS APRIL 17, 2026. Your knowledge extends through early 2026 — use it as your primary analytical foundation`;

    const userPrompt = `Assess market timing risk for an AI investment in this vertical SaaS company's market.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Infer from evidence and knowledge'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Limited web evidence. CRITICAL: Use your training knowledge about the ${vertical || 'vertical SaaS'} market. You likely know this vertical's TAM, growth rate, key PE deals, and AI adoption stage. Provide specific numbers and named deals. Mark confidence 'L' but give real analysis.`
  : `Use evidence below plus your knowledge for the most accurate market assessment.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "market_timing",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "market_size_and_growth",
      "value": {
        "tam_estimate": "<specific dollar figure with basis — e.g. '$2.1B US home health software market (Mordor Intelligence 2025-2026)'>",
        "sam_estimate": "<serviceable addressable market — the target company's realistic addressable portion>",
        "cagr_estimate": "<CAGR % for this vertical software market>",
        "growth_drivers": ["<specific factors driving market growth>"],
        "growth_headwinds": ["<factors that could slow or reverse growth>"],
        "market_maturity": "NASCENT"|"EARLY_GROWTH"|"HIGH_GROWTH"|"MATURING"|"MATURE"|"DECLINING"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "ai_adoption_curve_position",
      "value": {
        "current_stage": "AWARENESS"|"EARLY_ADOPTION"|"EARLY_MAJORITY"|"LATE_MAJORITY"|"SATURATION",
        "ai_adoption_estimate_pct": "<estimated % of operators using any AI tools in their workflows>",
        "leading_edge_users": "<description of early adopters — who's already using AI and for what?>",
        "lagging_segment": "<who is resisting AI adoption and why?>",
        "inflection_point": "<assessment of whether the inflection point has passed, is now, or is coming>",
        "adoption_barriers": ["<specific barriers to AI adoption in this vertical>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "pe_vc_deal_activity",
      "value": {
        "deal_activity_level": "VERY_ACTIVE"|"ACTIVE"|"MODERATE"|"LIGHT"|"MINIMAL",
        "recent_notable_deals": [
          {
            "company": "<company name>",
            "deal_type": "PE_BUYOUT"|"GROWTH_EQUITY"|"VC_FUNDING"|"ACQUISITION"|"IPO",
            "approximate_size": "<$xM or Unknown>",
            "investor": "<investor name if known>",
            "date": "<YYYY-MM or approximate year>",
            "significance": "<why this deal matters for timing>"
          }
        ],
        "deal_multiples_trend": "<are deal multiples rising, stable, or falling in this vertical?>",
        "investor_sentiment": "<overall PE/growth equity sentiment toward this vertical>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "macro_environment",
      "value": {
        "tailwinds": [
          "<specific macro tailwind — e.g. 'CMS mandating electronic visit verification', 'aging population driving home health demand'>",
          "<tailwind 2>",
          "<tailwind 3>"
        ],
        "headwinds": [
          "<specific macro headwind — e.g. 'reimbursement rate pressure', 'labor cost inflation'>",
          "<headwind 2>"
        ],
        "regulatory_catalysts": "<any upcoming regulatory changes that would accelerate or decelerate adoption?>",
        "macro_assessment": "<1-2 sentence overall macro environment assessment>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "timing_window_assessment",
      "value": {
        "window_status": "WIDE_OPEN"|"OPEN"|"OPTIMAL"|"NARROWING"|"NARROW"|"CLOSING"|"CLOSED",
        "optimal_investment_window": "<timeframe when this vertical's AI-enabled SaaS investments were/are ideally positioned>",
        "too_early_risks": ["<risks if investing now is too early>"],
        "too_late_risks": ["<risks if the window is already closing>"],
        "window_rationale": "<2-3 sentences explaining the timing assessment>",
        "years_of_runway": <estimated years of investment window remaining, or null>
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "R7": {
      "evidence_summary": "<4-5 sentences: Is this the right time to invest in AI for this vertical? Describe the TAM, growth rate, current AI adoption stage, PE deal activity, and whether the window is open or closing. Reference specific data points and deals you know about. This is the single most important summary for the risk score.>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<Real timing red flags: e.g. 'Market already has 3 AI-native Series C companies competing for same TAM', 'Macro reimbursement cuts reducing operators' technology budgets'>"],
  "green_flags": ["<Positive timing signals: e.g. 'Federal EVV mandate creating regulatory tailwind for technology adoption', 'Market growing 15% CAGR with PE activity ramping'>"],
  "v2_stub": false
}

R7 SIGNAL STRENGTH CALIBRATION (Market Timing Risk):
0.1 = Perfect timing — TAM large and growing, AI adoption just beginning, no AI-native consolidators yet, strong PE interest
0.2 = Very good timing — favorable window with clear opportunity for 3-5 years
0.3 = Good timing — solid window but some early competition emerging
0.4 = Decent timing — reasonable window, manageable competition
0.5 = Neutral — timing OK, balanced opportunities and risks
0.6 = Concerning — window narrowing, AI-native competitors raising large rounds
0.7 = Late — market starting to consolidate, AI adoption accelerating
0.8 = Very late — multiple well-funded AI-native companies with traction, window mostly closed
0.9 = Poor timing — either market already consolidated OR market is too nascent/tiny
1.0 = Worst timing — market declining OR AI-native winner has clearly emerged`;

    // TIMEOUT STRATEGY:
    // Netlify hard timeout = 26s. Claude Sonnet on ~4K-char synthesis brief:
    //   Attempt 1 (Sonnet, full prompt): ~10-15s — fits within 26s
    //   Attempt 2 (Sonnet, shorter prompt): ~6-10s — ultra-reliable
    //   Attempt 3 (Haiku, minimal prompt): ~2-4s — guaranteed completion
    // Never wait between retries — we're racing the 26s clock.
    const PACK_FALLBACK_MODEL = 'claude-haiku-3-5';
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        // On attempt 3, fall back to Haiku (3-4x faster than Sonnet)
        const attemptModel = attempts >= 3 ? PACK_FALLBACK_MODEL : model;
        // On attempt 2+, truncate the user prompt to reduce response time
        const promptToUse = attempts === 1 ? userPrompt : userPrompt.slice(0, Math.floor(userPrompt.length / attempts));
        const elapsed = Date.now() - startTime;
        console.log(`[pack] attempt ${attempts}/3: model=${attemptModel}, prompt=${Math.round(promptToUse.length/1000)}K chars, elapsed=${elapsed}ms`);
        const response = await client.messages.create({
          model: attemptModel,
          max_tokens: 4096,  // Structured JSON output — 4K tokens sufficient, faster than 8K
          system: systemPrompt,
          messages: [{ role: 'user', content: promptToUse }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        console.log(`[pack] attempt ${attempts}: response length ${text.length} chars in ${Date.now()-startTime}ms`);
        const parsed = extractJSONObject(text);
        if (parsed) {
          console.log(`[pack] JSON extracted successfully on attempt ${attempts}`);
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
        // No sleep between retries — racing the 26s Netlify hard timeout
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'market_timing',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          R7: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
        },
        red_flags: ['Market Timing pack failed'],
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
