/**
 * Eagle Vision — Research Synthesis
 *
 * Called by the orchestrator in Phase 5 (Evidence Synthesis).
 * Given a dimension and raw evidence, Claude condenses it into a structured
 * analyst brief that pack functions then receive.
 *
 * TIMEOUT ARCHITECTURE:
 * Netlify hard timeout = 26s. Claude Opus on 85K chars takes 40-90s → always fails.
 * Fix: use claude-sonnet (3-5× faster), cap evidence at 40K, max_tokens 4096.
 * On retry, halve the evidence again. This ensures we ALWAYS complete in < 20s.
 *
 * WHY THIS MATTERS:
 * Asking an LLM to simultaneously parse raw web evidence AND score investment
 * factors is like asking an analyst to read 200 pages of 10-K and immediately
 * write the investment memo. Professional analysts read first, take notes, THEN write.
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// SYNTHESIS MODEL STRATEGY:
// Synthesis is the note-taking step — speed matters more than depth here.
// Packs (the scoring step) use Opus for full analytical reasoning.
// Sonnet finishes 40K-char synthesis in 8-15s — well within 26s Netlify limit.
// Fallback to haiku if sonnet also fails (haiku finishes in 3-6s).
const SYNTHESIS_MODEL = 'claude-sonnet-4-6';
const SYNTHESIS_FALLBACK_MODEL = 'claude-haiku-3-5-20241022';

// Max chars to feed synthesizer per attempt.
// On Vercel Pro (300s): attempt 1 gets full 50K — Sonnet finishes in 15-25s.
// On Netlify (26s): orchestrator already caps at 30K, so attempt 1 sees ≤30K (~8-12s).
// Retry ladder ensures completion even on overloaded API:
// Attempt 1: 50K chars  — ~15-25s on Sonnet (Vercel) / ~8-12s on 30K (Netlify)
// Attempt 2: 25K chars  — ~8-12s, reliable fallback
// Attempt 3: 10K chars  — ~3-5s on Haiku, guaranteed completion
const EVIDENCE_CAPS = [20000, 12000, 6000]; // Kept low so Vercel function completes in <20s per attempt

// What each dimension's synthesis should focus on extracting
const SYNTHESIS_FOCUS: Record<string, string> = {
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

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      dimension,
      company_name,
      vertical,
      raw_evidence,
    } = body;

    if (!dimension || !company_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'dimension and company_name required' }),
      };
    }

    const evidenceLength = (raw_evidence || '').length;
    const focusInstructions = SYNTHESIS_FOCUS[dimension] || `Extract all investment-relevant facts about ${dimension} for ${company_name}.`;

    const systemPrompt = `You are a senior investment analyst building a structured research brief for a PE/growth equity investment team. You are the "Research Synthesis Associate" — your job is to read all evidence and extract the most investment-relevant facts in a structured format.

FUNDAMENTAL RULES:
1. FACTUAL PRECISION — Label every claim: [CONFIRMED: source] / [INFERRED: reasoning] / [ANALYST KNOWLEDGE] / [UNKNOWN]
2. SPECIFICITY — "$4.2M ARR growing 40% YoY" beats "growing revenues". Names, numbers, dates, quotes.
3. HONEST ABOUT GAPS — "[UNKNOWN — not found. Recommend: {specific question to ask management}]" is valuable.
4. CALIBRATION — If evidence is sparse, use training knowledge (labeled [ANALYST KNOWLEDGE]) rather than leaving sections empty.
5. INVESTMENT LENS — Every fact should connect to: risk, value, competitive position, or AI readiness.

TODAY IS APRIL 17, 2026. Your training knowledge extends through early 2026. Use this as the current date for all assessments and time-based analysis.

Follow the numbered sections in the SYNTHESIS FOCUS exactly. Be concise but thorough. Target 800-1200 words.`;

    // Attempt loop: each retry uses less evidence and faster model
    let attempt = 0;
    let lastError = '';

    while (attempt < 3) {
      const evidenceCap = EVIDENCE_CAPS[attempt] ?? 10000;
      const model = attempt < 2 ? SYNTHESIS_MODEL : SYNTHESIS_FALLBACK_MODEL;
      const evidenceToSynth = (raw_evidence || 'No evidence provided — use analyst training knowledge').slice(0, evidenceCap);
      const truncationNote = evidenceLength > evidenceCap
        ? `\n\n[NOTE: Total evidence was ${Math.round(evidenceLength/1000)}K chars. This synthesis shows the first ${Math.round(evidenceCap/1000)}K chars.]`
        : '';

      const userPrompt = `Synthesize research evidence for ${company_name} (${vertical || 'vertical SaaS'}) — dimension: "${dimension}".

Evidence: ${Math.round(Math.min(evidenceLength, evidenceCap)/1000)}K chars from ${evidenceLength > evidenceCap ? 'first portion of' : ''} 5 research passes.

RAW EVIDENCE:
${evidenceToSynth}${truncationNote}

━━━ SYNTHESIS FOCUS ━━━
${focusInstructions}

Write a structured analyst brief following the numbered sections above. Label every fact with [CONFIRMED: source], [INFERRED: reason], [ANALYST KNOWLEDGE], or [UNKNOWN]. Be specific — name names, give numbers, cite sources.`;

      attempt++;
      try {
        console.log(`[synthesize] attempt ${attempt}/3: model=${model}, evidence=${Math.round(evidenceCap/1000)}K, dimension=${dimension}`);
        const response = await client.messages.create({
          model,
          max_tokens: 4096,  // Synthesis is notes, not the final report — 4K is sufficient
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const elapsed = Date.now() - startTime;
        console.log(`[synthesize] attempt ${attempt} succeeded: ${text.length} chars in ${elapsed}ms`);

        if (text && text.length > 200) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              synthesis: text,
              dimension,
              evidence_input_chars: evidenceLength,
              evidence_fed_chars: Math.min(evidenceLength, evidenceCap),
              synthesis_chars: text.length,
              model_used: model,
              attempt_number: attempt,
              elapsed_ms: elapsed,
            }),
          };
        }
        lastError = `Response too short: ${text.length} chars`;
      } catch (e: any) {
        lastError = e?.message || 'unknown error';
        const elapsed = Date.now() - startTime;
        console.error(`[synthesize] attempt ${attempt}/3 failed for ${dimension} at ${elapsed}ms:`, lastError);
        // Don't wait between retries — we're racing the 26s clock
      }
    }

    // All 3 attempts failed — return structured raw evidence so packs still work
    console.warn(`[synthesize] All 3 attempts failed for ${dimension}. Returning raw evidence. Last error: ${lastError}`);
    const fallbackContent = `[SYNTHESIS FAILED — ${dimension} | Error: ${lastError}]\n\nRAW EVIDENCE FOR PACK ANALYSIS:\n${(raw_evidence || '').slice(0, 25000)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synthesis: fallbackContent,
        dimension,
        evidence_input_chars: evidenceLength,
        evidence_fed_chars: 25000,
        synthesis_chars: 0,
        model_used: 'fallback',
        fallback: true,
        fallback_reason: lastError,
        elapsed_ms: Date.now() - startTime,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Synthesis failed' }),
    };
  }
};

export { handler };
