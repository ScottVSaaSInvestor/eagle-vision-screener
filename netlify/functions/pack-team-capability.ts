/**
 * Eagle Vision — Team Capability Pack
 * Factors: A6 (AI/ML Team Capability), A9 (Leadership AI Clarity)
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

    const systemPrompt = `You are a senior investment analyst at a PE/growth equity firm with deep expertise in evaluating technical leadership and AI capabilities at vertical SaaS companies. You have assessed hundreds of companies and know how to distinguish genuine AI capability from marketing speak.

CRITICAL INSTRUCTIONS:
1. You likely have training knowledge about ${company_name} — use it
2. Look for: CEO/CTO backgrounds, LinkedIn profiles, job postings, engineering blog posts, product announcements, conference talks
3. Be specific — name actual people, their backgrounds, and what they've built
4. Distinguish between "AI features" (product) and "AI capability" (team that can build AI)
5. A company hiring AI engineers shows intent; a company that HAS shipped AI features shows execution
6. Never give 0.5 neutral defaults — make a real assessment with real reasoning
7. TODAY IS APRIL 17, 2026. Your knowledge extends through early 2026 — use it for all assessments.`;

    const userPrompt = `Assess the AI/ML team capability and leadership AI clarity for this vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Infer from context'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Web research returned limited results. CRITICAL: Use your training knowledge about ${company_name}. You may know the founders, CEO, CTO, key executives, their backgrounds, and what AI-related work they've done. Draw on everything. Mark confidence 'L' but provide REAL names and assessments — not "Unknown" for everything.`
  : `Use the research evidence below combined with your knowledge to provide the most accurate assessment possible.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "team_capability",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "leadership_team",
      "value": [
        {
          "name": "<full name or 'Unknown'>",
          "role": "<CEO/CTO/CPO/VP Engineering/Chief AI Officer/etc>",
          "ai_ml_background": "<describe their AI/ML experience — degrees, prior companies, projects, publications>",
          "notable_prior_experience": "<most relevant prior roles and companies>",
          "linkedin": "<url or null>",
          "ai_conviction_level": "HIGH"|"MEDIUM"|"LOW"|"UNKNOWN",
          "notes": "<any other relevant context>"
        }
      ],
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst training knowledge'>"],
      "unknowns": ["<what we couldn't determine>"]
    },
    {
      "key": "ai_ml_team_assessment",
      "value": {
        "dedicated_ai_staff_estimate": "<e.g. '0', '1-2', '3-5', '5-10', '10-20', '20+', 'Unknown'>",
        "team_quality_assessment": "<description of team quality — any top-tier researchers, ML PhDs, ex-FAANG, published work?>",
        "ai_feature_evidence": "<specific AI features that have been shipped and are in production>",
        "hiring_signals": "<evidence from job postings or LinkedIn that they're hiring AI/ML talent>",
        "build_vs_buy": "<are they building AI internally or using third-party APIs/tools?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst training knowledge'>"],
      "unknowns": []
    },
    {
      "key": "ceo_ai_stance",
      "value": {
        "public_statements": "<direct quotes or paraphrases of CEO's public AI statements — conferences, interviews, blog posts>",
        "strategic_actions_taken": "<concrete actions the CEO has taken: AI hires, product announcements, partnerships, investments>",
        "timeline_commitment": "<has the CEO committed to specific AI milestones or timelines?>",
        "overall_stance": "AI_FIRST"|"AI_STRATEGIC"|"AI_AWARE"|"AI_RELUCTANT"|"AI_DISMISSIVE"|"UNKNOWN"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst training knowledge'>"],
      "unknowns": []
    },
    {
      "key": "research_and_ip",
      "value": {
        "published_papers": "<any published ML/AI research papers or blog posts>",
        "patents": "<any AI-related patents filed or granted>",
        "open_source": "<any open source AI contributions>",
        "overall": "<summary>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "ai_product_roadmap_signals",
      "value": "<Based on evidence and knowledge, what is the company's apparent AI product trajectory? What have they shipped, what have they announced, what do they seem to be building next?>",
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "A6": {
      "evidence_summary": "<3-4 sentences: Who leads AI at this company? What's their technical depth? What AI features have been shipped? What's the ML headcount signal? Be specific — name names and features.>",
      "signal_strength": <0.0-1.0>
    },
    "A9": {
      "evidence_summary": "<3-4 sentences: What has leadership publicly committed to on AI? Is the CEO driving AI strategy or delegating? Are they making structural investments (hires, partnerships, acquisitions) or just talking about AI?  Be specific.>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<Only real red flags: e.g. 'CEO has publicly dismissed AI', 'No AI hires despite 3+ years of AI hype', 'CTO has zero ML background'>"],
  "green_flags": ["<Positive signals: e.g. 'CEO has prior ML company exit', 'Shipped 5 AI features in 18 months'>"],
  "v2_stub": false
}

A6 SIGNAL STRENGTH CALIBRATION:
0.1 = No dedicated AI/ML staff, no AI features shipped
0.2 = Generic engineers may experiment with ML but no dedicated capacity
0.3 = 1-2 ML engineers, basic AI features in beta or early
0.4 = Small AI team (3-5), some shipped features but early stage
0.5 = Dedicated AI team (5+), meaningful features shipped and used
0.6 = Strong AI team, several production AI features with measurable impact
0.7 = Strong AI team with published work or ex-FAANG/research background
0.8 = Deep AI capability with track record of novel AI product innovation
0.9 = World-class AI team with published research + proven applied AI products
1.0 = Industry-leading AI team (e.g. ex-OpenAI/DeepMind research + applied)

A9 SIGNAL STRENGTH CALIBRATION:
0.1 = No AI strategy, CEO dismissive or unaware
0.2 = Vague "we're exploring AI" statements only
0.3 = Generic AI roadmap announced, no specific commitments
0.4 = Clear AI strategy articulated, some concrete actions
0.5 = CEO personally driving AI agenda, specific product milestones committed
0.6 = CEO demonstrates deep AI understanding, making structural changes
0.7 = CEO has prior AI track record or co-authored AI strategy publicly
0.8 = CEO is AI-first, company restructuring around AI capabilities
0.9 = CEO conviction backed by major hires/acquisitions and shipped results
1.0 = Visionary AI leadership with proven track record at prior companies`;

    // TIMEOUT STRATEGY:
    // Netlify hard timeout = 26s. Claude Sonnet on ~4K-char synthesis brief:
    //   Attempt 1 (Sonnet, full prompt): ~10-15s — fits within 26s
    //   Attempt 2 (Sonnet, shorter prompt): ~6-10s — ultra-reliable
    //   Attempt 3 (Haiku, minimal prompt): ~2-4s — guaranteed completion
    // Never wait between retries — we're racing the 26s clock.
    const PACK_FALLBACK_MODEL = 'claude-haiku-3-5-20241022';
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
        pack_name: 'team_capability',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          A6: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.3 },
          A9: { evidence_summary: 'Pack failed after 3 retries', signal_strength: 0.3 },
        },
        red_flags: ['Team Capability pack failed after retries'],
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
