/**
 * Eagle Vision — Competitive Landscape Pack
 * Factors: R1 (Competitive Window), R2 (AI-Native Entrant), R3 (Incumbent AI),
 *          R4 (Horizontal AI Encroachment), A8 (Compounding Loop)
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

// Join evidence intelligently, capping total context to avoid token overflow
function buildEvidenceContext(evidenceTexts: string[], maxChars = 50000): string {
  if (!Array.isArray(evidenceTexts)) return '';
  let combined = '';
  for (const chunk of evidenceTexts) {
    if (!chunk) continue;
    if (combined.length + chunk.length > maxChars) {
      // Add a partial chunk to fill remaining space
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
    const { company_name, company_url, vertical, competitor_hints, evidence_texts, use_knowledge_fallback } = body;

    if (!company_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'company_name required' }) };
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
    const evidenceContext = buildEvidenceContext(evidence_texts || []);
    const hintStr = Array.isArray(competitor_hints) && competitor_hints.length > 0
      ? `\nKNOWN COMPETITORS/PEERS (analyst-provided): ${competitor_hints.join(', ')}`
      : '';

    const hasRichEvidence = evidenceContext.length > 1000;

    const systemPrompt = `You are a senior competitive intelligence analyst at a top-tier PE/growth equity firm specializing in vertical SaaS AI investments. You have deep expertise in the B2B software competitive landscape and AI disruption patterns. Your job is to produce a professional-grade competitive analysis that an investment committee would rely on.

CRITICAL INSTRUCTIONS:
1. If web evidence is provided, extract and cite specific facts from it
2. If web evidence is limited, ALWAYS use your training knowledge — you have extensive knowledge of vertical SaaS companies, competitive landscapes, and AI investment trends through early 2025
3. NEVER return empty findings or neutral 0.5 defaults just because evidence is thin
4. Mark confidence honestly (H/M/L) but always provide substantive analysis
5. When naming competitors, use real company names you know — do not make up companies
6. Be specific about funding amounts, founding dates, and traction when you know them`;

    const userPrompt = `Analyze the AI competitive landscape for this vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Unknown — infer from evidence and your knowledge'}
${hintStr}

KNOWLEDGE FALLBACK INSTRUCTION: ${!hasRichEvidence && use_knowledge_fallback
  ? `Web research returned limited results. CRITICAL: Use your training knowledge about ${company_name} and the ${vertical || 'vertical SaaS'} market. You likely know this company, its competitors, and the AI investment landscape in this space. Draw on everything you know. Mark confidence 'L' but provide REAL analysis — not empty findings.`
  : `Use the research evidence below plus your own knowledge to provide the most accurate assessment possible.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed above.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "competitive_landscape",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0, based on evidence richness>,
  "findings": [
    {
      "key": "vertical_heat_index",
      "value": {
        "score": <0-100, where 100=extremely hot/competitive>,
        "grade": "A"|"B"|"C"|"D"|"F",
        "summary": "<2-3 sentence assessment of competitive heat in this vertical>",
        "key_drivers": ["<driver1>", "<driver2>", "<driver3>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "ai_native_entrants",
      "value": [
        {
          "company": "<real company name>",
          "founded": <year or null>,
          "stage": "<Seed/Pre-Seed/Series A/Series B/Series C/PE-backed>",
          "last_raise": "<$xM or Unknown>",
          "last_raise_date": "<YYYY-MM or Unknown>",
          "key_investors": ["<investor names>"],
          "traction_signal": "<specific evidence of traction — customers, revenue, growth>",
          "threat_level": "HIGH"|"MEDIUM"|"LOW",
          "threat_rationale": "<why this is or isn't a threat to the target company>",
          "url": "<string or null>"
        }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "incumbent_postures",
      "value": [
        {
          "company": "<incumbent name>",
          "market_position": "<leader/challenger/niche>",
          "status": "GA_WITH_TRACTION"|"LAUNCHED"|"BETA"|"ROADMAP"|"SIGNALING"|"SILENT",
          "ai_products": "<specific AI features/products if known>",
          "evidence": "<specific evidence of AI posture>",
          "threat_to_target": "<HIGH/MEDIUM/LOW and why>",
          "url": "<string or null>"
        }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "horizontal_ai_threat",
      "value": {
        "overall_level": "HIGH"|"MEDIUM"|"LOW",
        "threat_actors": ["<e.g. OpenAI, Microsoft Copilot, Salesforce Einstein, Google>"],
        "use_cases_at_risk": ["<specific workflows that horizontal AI could replace>"],
        "use_cases_protected": ["<workflows that require vertical-specific data/integration>"],
        "assessment": "<2-3 sentence nuanced assessment>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "recent_vertical_news",
      "value": [
        {
          "headline": "<specific headline>",
          "date": "<YYYY-MM or Unknown>",
          "url": "<string>",
          "significance": "<why this matters for the investment thesis>",
          "category": "FUNDING"|"ACQUISITION"|"PRODUCT_LAUNCH"|"PARTNERSHIP"|"REGULATORY"|"OTHER"
        }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "competitive_window",
      "value": {
        "months_estimate": <number or null>,
        "assessment": "OPEN"|"NARROWING"|"NARROW"|"CLOSED",
        "rationale": "<specific reasoning for window assessment>",
        "key_risks": ["<what could close the window>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "compounding_loop_assessment",
      "value": {
        "has_flywheel": <boolean>,
        "flywheel_description": "<describe the data/network flywheel if it exists, or why it doesn't>",
        "strength": "STRONG"|"MODERATE"|"WEAK"|"NONE",
        "evidence": "<specific evidence>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "R1": {
      "evidence_summary": "<2-3 sentences on competitive window. How long before AI-native competitors or incumbents close the window? Cite specific companies and timelines.>",
      "signal_strength": <0.0-1.0, where 0=window fully open 3+ years, 1=window already closed>
    },
    "R2": {
      "evidence_summary": "<2-3 sentences on AI-native entrant threat. Name specific companies, their funding, traction, and threat level.>",
      "signal_strength": <0.0-1.0, where 0=no entrants, 1=multiple well-funded entrants with real traction>
    },
    "R3": {
      "evidence_summary": "<2-3 sentences on incumbent AI posture. What are the 2-3 largest incumbents doing with AI? Have they shipped? Do customers use it?>",
      "signal_strength": <0.0-1.0, where 0=incumbents completely silent on AI, 1=incumbents have shipped GA AI features with traction>
    },
    "R4": {
      "evidence_summary": "<2-3 sentences on horizontal AI encroachment. Is ChatGPT/Copilot/etc. being used by this vertical's operators instead of purpose-built software?>",
      "signal_strength": <0.0-1.0, where 0=no horizontal threat, 1=widespread horizontal adoption displacing vertical SaaS>
    },
    "A8": {
      "evidence_summary": "<2-3 sentences on compounding loop potential. Does more data = better product = more customers? Is there a data flywheel?>",
      "signal_strength": <0.0-1.0, where 0=no flywheel at all, 1=proven strong compounding data network effects>
    }
  },
  "red_flags": ["<specific red flags — e.g. 'Well-funded AI-native competitor X raised $50M Series B targeting exact same buyers'>"],
  "green_flags": ["<specific positive signals — e.g. 'Incumbents are legacy on-prem with no credible AI roadmap'>"],
  "v2_stub": false
}

SIGNAL STRENGTH CALIBRATION — BE PRECISE, NOT MIDDLE:
- R1: Most vertical SaaS windows are narrowing (0.3-0.5). Only score 0.1 if truly no competition.
- R2: If you know of 2+ funded AI-native entrants, score 0.6+. If none known, score 0.1-0.2.
- R3: If incumbents have shipped AI features, score 0.5+. If only roadmap, 0.3-0.4.
- R4: For most vertical SaaS, horizontal AI threat is moderate (0.3-0.5). Score 0.7+ only if operators are actively using ChatGPT instead of the SaaS.
- A8: Most vertical SaaS has some flywheel potential (0.3-0.6). Score 0.8+ only if there's clear evidence of data network effects.`;

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

        // Extract JSON — handle markdown fences if Claude includes them
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

    // Fallback
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_name: 'competitive_landscape',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          R1: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.4 },
          R2: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.3 },
          R3: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.4 },
          R4: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.3 },
          A8: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.4 },
        },
        red_flags: ['Competitive Landscape pack failed — LLM returned malformed output after 3 retries'],
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
