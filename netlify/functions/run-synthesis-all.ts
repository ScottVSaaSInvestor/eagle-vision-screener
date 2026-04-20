/**
 * Eagle Vision — Bulk Synthesis (All 7 Dimensions in One Server-Side Call)
 *
 * WHY THIS EXISTS:
 * The orchestrator runs in the browser. When it made 7 individual fetch calls
 * to /api/research-synthesize, each waiting 30-60s, the browser killed them
 * with "signal aborted without reason". Browser fetch is unreliable beyond ~20s.
 *
 * THIS ENDPOINT:
 * Receives all 7 evidence corpora in one request. Runs all 7 synthesis calls
 * server-to-server (Vercel → Anthropic) with no browser timeout risk.
 * Returns all 7 briefs in one response. Browser waits for ONE call (~90s max).
 * Vercel Pro allows 300s — plenty of headroom.
 *
 * INPUT:
 * {
 *   company_name: string,
 *   vertical: string,
 *   corpora: {
 *     company_profile: string,
 *     competitive_landscape: string,
 *     team_capability: string,
 *     regulatory_moat: string,
 *     workflow_product: string,
 *     data_architecture: string,
 *     market_timing: string,
 *   }
 * }
 *
 * OUTPUT:
 * {
 *   briefs: {
 *     company_profile: string,
 *     competitive_landscape: string,
 *     ... (all 7)
 *   },
 *   meta: { [dimension]: { model_used, elapsed_ms, chars, fallback } }
 * }
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const SYNTHESIS_MODEL         = 'claude-sonnet-4-6';
const SYNTHESIS_FALLBACK_MODEL = 'claude-haiku-3-5-20241022';

// Per-attempt evidence caps. Server-side so we can be more generous than browser version.
// Sonnet handles 30K in ~12-18s. 3 attempts × 7 dims = worst case ~7min still under 300s.
const EVIDENCE_CAPS = [30000, 15000, 8000];

const DIMENSIONS = [
  'company_profile',
  'competitive_landscape',
  'team_capability',
  'regulatory_moat',
  'workflow_product',
  'data_architecture',
  'market_timing',
] as const;

type Dimension = typeof DIMENSIONS[number];

const SYNTHESIS_FOCUS: Record<Dimension, string> = {
  company_profile: `Extract and structure the following:
1. COMPANY OVERVIEW: Official name, founded, HQ, description, vertical/industry, target customer segment
2. FINANCIALS & SCALE: ARR estimates (with basis), funding stage, total raised, investors, last round date, employee count, customer count
3. PRODUCT & PRICING: Core product, modules, pricing model (per-seat/per-patient/per-visit/etc.), pricing flexibility, contract structure, expansion mechanics
4. MARKET POSITION: Leader/Challenger/Niche status, estimated market share, key differentiators, main competitors, G2/Capterra scores
5. GROWTH MOMENTUM: Growth signals, recent milestones (last 18 months through April 2026), press coverage, awards
6. PRICING FLEXIBILITY (A5): Can they charge for AI-delivered value? Can they move to usage-based or outcome-based pricing?`,

  competitive_landscape: `Extract and structure the following:
1. VERTICAL HEAT: How competitive is this vertical? What's driving competition? Score 0-100.
2. AI-NATIVE ENTRANTS: For each startup — name, founded, funding, last raise ($, date, investors), traction, threat level
3. INCUMBENT AI POSTURE: For each major incumbent — AI shipped (GA), announced (roadmap), customer response
4. HORIZONTAL AI THREAT: Is OpenAI/Microsoft/Google disrupting this vertical? What workflows are at risk vs protected?
5. RECENT NEWS: Key funding, acquisitions, product launches, partnerships, regulatory changes in last 18 months
6. COMPETITIVE WINDOW: How long does the target company have before the competitive landscape closes in?
7. COMPOUNDING LOOP: Is there a data/network flywheel? Does more usage = better product = more customers?`,

  team_capability: `Extract and structure the following:
1. KEY LEADERS: For CEO, CTO, CPO, Head of AI/ML, VP Engineering — name, background, prior companies, AI/ML credentials, public AI statements
2. AI/ML TEAM SIZE: How many dedicated AI/ML staff? Any ML PhDs, ex-FAANG, published researchers?
3. SHIPPED AI FEATURES: What AI features are currently in production? Not roadmap — what's live and being used by customers?
4. HIRING SIGNALS: Job postings for AI/ML roles? What seniority, what skills?
5. BUILD vs BUY: Building AI models internally or using OpenAI/Azure APIs? Or both?
6. CEO AI CONVICTION: Specific quotes, commitments, structural actions (AI hires, acquisitions, partnerships) — not just "we're excited about AI"
7. TECHNICAL MOAT INDICATORS: Patents, published research, open source contributions, engineering blog depth`,

  regulatory_moat: `Extract and structure the following:
1. REGULATORY FRAMEWORK: Specific regulations (HIPAA, OASIS, EVV, SOC2, PCI-DSS, etc.), enforcement level, trend direction
2. CERTIFICATIONS HELD: Confirmed certifications — SOC2 Type II, HIPAA BAA, HITRUST, ISO 27001, state licenses
3. SWITCHING COSTS: Specific friction factors — data migration complexity, compliance history resets, integration reconstruction, retraining cost
4. DATA PORTABILITY: Can customers easily export data? What effort to migrate to a competitor?
5. DATA MOAT: What proprietary data accumulates? Does it become more valuable over time? AI training advantage?
6. MOAT DURABILITY: How long can this moat hold? What would erode it?
7. COMPETITIVE BARRIERS: How hard is it for a new entrant to match the compliance posture? Time/cost estimates.`,

  workflow_product: `Extract and structure the following:
1. PRODUCT CATEGORY: Is this genuinely a System of Record, operational tool, or analytics/reporting layer?
2. DAILY WORKFLOWS OWNED: What specific daily tasks do users do in this software?
3. WORKFLOW EMBEDDEDNESS: How critical is this software? What happens if it goes down for a day?
4. INTEGRATIONS: What systems is it integrated with? EHR/EMR, billing, payroll, CRM? Number and depth.
5. VALUE QUANTIFICATION: Specific ROI metrics, case studies, time-savings data, revenue impact numbers
6. CUSTOMER RETENTION SIGNALS: Known retention/churn rates, NPS, G2 ratings, multi-year relationship evidence
7. PRICING & EXPANSION: How does revenue grow with a customer? More users, volume, modules? Outcome-based pricing?`,

  data_architecture: `Extract and structure the following:
1. TECH STACK: Cloud provider (AWS/Azure/GCP), database architecture, API structure, mobile vs web
2. DATA VOLUME & DEPTH: Estimated records, years of longitudinal data, breadth per customer record
3. OUTCOME LABELING: Does the software capture what happened AFTER service delivery? Outcomes, billing accuracy?
4. AI FEATURES IN PRODUCTION: Specific AI/ML features live in the product — NLP, predictive analytics, scheduling optimization, documentation automation, risk scoring
5. AI BUILD vs WRAP: Building proprietary models or wrapping OpenAI/Azure APIs? Long-term data moat strategy?
6. ARCHITECTURE READINESS: Cloud-native? Microservices? Real-time data pipeline? Modern enough to build AI on?
7. PROPRIETARY DATA ADVANTAGE: What data do they have that competitors can't replicate?`,

  market_timing: `Extract and structure the following:
1. MARKET SIZE: TAM/SAM estimates with source and methodology. Growth rate (CAGR). Confidence in estimates.
2. PE/VC DEAL FLOW: Specific deals in this vertical in last 18 months — who raised, how much, at what stage, from whom
3. M&A ACTIVITY: Acquisitions in the vertical — who bought whom, at what multiples, strategic rationale
4. AI ADOPTION RATE: Survey data, operator reports — what % of operators use AI tools? Adoption trajectory?
5. MACRO TAILWINDS: Demographics, labor shortages, reimbursement changes, regulatory mandates, consolidation trends
6. COMPARABLE TRANSACTION MULTIPLES: Relevant PE/M&A comps — EV/Revenue multiples for similar vertical SaaS
7. TIMING ASSESSMENT: Is this the right time to invest? Too early? Right timing? Too late? What catalysts ahead?`,
};

const SYSTEM_PROMPT = `You are a senior investment analyst building a structured research brief for a PE/growth equity investment team evaluating AI Risk and AI Readiness of vertical SaaS companies. You are the "Research Synthesis Associate" — your job is to read raw web evidence and extract the most investment-relevant facts in a structured format.

FUNDAMENTAL RULES:
1. FACTUAL PRECISION — Label every claim: [CONFIRMED: source] / [INFERRED: reasoning] / [ANALYST KNOWLEDGE] / [UNKNOWN]
2. SPECIFICITY — "$4.2M ARR growing 40% YoY" beats "growing revenues". Names, numbers, dates, quotes.
3. HONEST ABOUT GAPS — "[UNKNOWN — not found. Recommend: {specific question to ask management}]" is valuable.
4. CALIBRATION — If evidence is sparse, use training knowledge (labeled [ANALYST KNOWLEDGE]) rather than leaving sections empty.
5. INVESTMENT LENS — Every fact should connect to: AI risk, AI readiness, competitive position, or value creation potential.

TODAY IS APRIL 17, 2026. Your training knowledge extends through early 2026. Treat this as the current date for all assessments, timeline analysis, and recent event references.

Follow the numbered sections in the SYNTHESIS FOCUS exactly. Be concise but thorough. Target 800-1200 words per brief.`;

async function synthesizeOne(
  dimension: Dimension,
  companyName: string,
  vertical: string,
  rawEvidence: string,
): Promise<{ brief: string; model: string; elapsed: number; fallback: boolean; chars: number }> {
  const start = Date.now();
  const evidenceLength = rawEvidence.length;
  let lastError = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const evidenceCap = EVIDENCE_CAPS[attempt] ?? 8000;
    const model = attempt < 2 ? SYNTHESIS_MODEL : SYNTHESIS_FALLBACK_MODEL;
    const evidenceSlice = rawEvidence.slice(0, evidenceCap);
    const truncNote = evidenceLength > evidenceCap
      ? `\n\n[NOTE: Total evidence was ${Math.round(evidenceLength / 1000)}K chars. Showing first ${Math.round(evidenceCap / 1000)}K.]`
      : '';

    const userPrompt = `Synthesize research evidence for ${companyName} (${vertical || 'vertical SaaS'}) — dimension: "${dimension}".

Evidence: ${Math.round(Math.min(evidenceLength, evidenceCap) / 1000)}K chars from 5 research passes.

RAW EVIDENCE:
${evidenceSlice}${truncNote}

━━━ SYNTHESIS FOCUS ━━━
${SYNTHESIS_FOCUS[dimension]}

Write a structured analyst brief following the numbered sections above. Label every fact. Be specific — name names, give numbers, cite sources.`;

    try {
      console.log(`[synth-all] ${dimension} attempt ${attempt + 1}/3: model=${model}, evidence=${Math.round(evidenceCap / 1000)}K`);
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content.find((b: any) => b.type === 'text')?.text ?? '';
      if (response.stop_reason === 'max_tokens') { console.warn(`[synth-all] WARNING: ${dimension} truncated at max_tokens — retrying`); continue; }
      const elapsed = Date.now() - start;
      console.log(`[synth-all] ${dimension} attempt ${attempt + 1} OK: ${text.length} chars in ${elapsed}ms`);

      if (text && text.length > 200) {
        return { brief: text, model, elapsed, fallback: false, chars: text.length };
      }
      lastError = `Response too short (${text.length} chars)`;
    } catch (e: any) {
      lastError = e?.message || 'unknown';
      console.error(`[synth-all] ${dimension} attempt ${attempt + 1} failed (${Date.now() - start}ms):`, lastError);
    }
  }

  // All attempts failed — return labeled raw evidence so packs still work
  console.warn(`[synth-all] ${dimension} all 3 attempts failed. Using raw evidence. Last: ${lastError}`);
  const fallback = `[SYNTHESIS FAILED — ${dimension} | ${lastError}]\n\nRAW EVIDENCE:\n${rawEvidence.slice(0, 25000)}`;
  return { brief: fallback, model: 'fallback', elapsed: Date.now() - start, fallback: true, chars: 0 };
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const globalStart = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { company_name, vertical, corpora } = body;

    if (!company_name || !corpora) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'company_name and corpora required' }),
      };
    }

    console.log(`[synth-all] Starting bulk synthesis for ${company_name} (${vertical})`);
    console.log(`[synth-all] Corpora sizes: ${DIMENSIONS.map(d => `${d}=${Math.round((corpora[d] || '').length / 1000)}K`).join(', ')}`);

    // Run all 7 syntheses in PARALLEL — server-to-server, no browser timeout risk
    // Parallel execution: all 7 start simultaneously, total time = slowest single dim (~15-25s)
    // vs sequential which would be 7 × 15s = 105s
    const results = await Promise.all(
      DIMENSIONS.map(dim =>
        synthesizeOne(dim, company_name, vertical || 'vertical SaaS', corpora[dim] || '')
      )
    );

    const briefs: Record<string, string> = {};
    const meta: Record<string, object> = {};

    DIMENSIONS.forEach((dim, i) => {
      const r = results[i];
      briefs[dim] = r.brief;
      meta[dim] = {
        model_used: r.model,
        elapsed_ms: r.elapsed,
        synthesis_chars: r.chars,
        fallback: r.fallback,
      };
    });

    const totalElapsed = Date.now() - globalStart;
    const successCount = results.filter(r => !r.fallback).length;
    console.log(`[synth-all] Complete: ${successCount}/7 succeeded in ${totalElapsed}ms`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        briefs,
        meta,
        total_elapsed_ms: totalElapsed,
        success_count: successCount,
        company_name,
        vertical,
      }),
    };
  } catch (err: any) {
    console.error('[synth-all] Fatal error:', err?.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Bulk synthesis failed' }),
    };
  }
};

export { handler };
