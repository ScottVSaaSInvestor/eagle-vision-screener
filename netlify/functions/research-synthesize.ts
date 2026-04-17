/**
 * Eagle Vision — Research Synthesis
 *
 * Called by the orchestrator in Phase 5 (Evidence Synthesis).
 * Given a dimension and ALL raw evidence collected (up to 60K chars), Claude
 * condenses it into a structured analyst brief that pack functions then receive.
 *
 * WHY THIS MATTERS:
 * Asking an LLM to simultaneously parse raw web evidence AND score investment
 * factors is like asking an analyst to read 200 pages of 10-K and immediately
 * write the investment memo. Professional analysts read first, take notes, THEN write.
 *
 * This function is the "note-taking" step. Pack functions are the "memo-writing" step.
 * The separation dramatically improves output quality.
 *
 * Expected runtime: 10-20s per dimension (called in parallel for all 7).
 */
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// What each dimension's synthesis should focus on extracting
const SYNTHESIS_FOCUS: Record<string, string> = {
  company_profile: `Extract and structure the following:
1. COMPANY OVERVIEW: Official name, founded, HQ, description, vertical, target customer
2. FINANCIALS & SCALE: ARR estimates (with basis), funding stage, total raised, investors, last round date, employee count, customer count
3. PRODUCT & PRICING: Core product, modules, pricing model (per-seat/per-patient/per-visit/etc.), pricing flexibility, contract structure, expansion mechanics
4. MARKET POSITION: Leader/Challenger/Niche status, estimated market share, key differentiators, main competitors, G2/Capterra scores
5. GROWTH MOMENTUM: Growth signals, recent milestones (last 2 years), press coverage, awards
6. PRICING FLEXIBILITY (A5): Can they charge for AI-delivered value? Can they move to usage-based or outcome-based pricing?`,

  competitive_landscape: `Extract and structure the following:
1. VERTICAL HEAT: How competitive is this vertical? What's driving competition? Score 0-100.
2. AI-NATIVE ENTRANTS: For each startup in this space — name, founded, funding stage, last raise ($, date, investors), traction evidence, specific threat level and rationale
3. INCUMBENT AI POSTURE: For each major incumbent — what AI have they shipped (GA), announced (roadmap), or signaled? How are customers responding?
4. HORIZONTAL AI THREAT: Is OpenAI/Microsoft/Google disrupting this vertical? What workflows are at risk vs protected?
5. RECENT NEWS: Key funding, acquisitions, product launches, partnerships, regulatory changes in the last 18 months
6. COMPETITIVE WINDOW: How long does the target company have before the competitive landscape closes in? What would close the window?
7. COMPOUNDING LOOP: Is there a data/network flywheel? Does more usage = better product = more customers?`,

  team_capability: `Extract and structure the following:
1. KEY LEADERS: For CEO, CTO, CPO, Head of AI/ML, VP Engineering — name, background, prior companies, AI/ML credentials, public AI statements
2. AI/ML TEAM SIZE: How many dedicated AI/ML staff? Any ML PhDs, ex-FAANG, published researchers?
3. SHIPPED AI FEATURES: What AI features are currently in production? Not roadmap — what's live and being used?
4. HIRING SIGNALS: Job postings for AI/ML roles? What seniority, what skills are they seeking?
5. BUILD vs BUY: Are they building AI models internally or using OpenAI/Azure APIs? Or both?
6. CEO AI CONVICTION: Specific quotes, commitments, structural actions (AI hires, acquisitions, partnerships) — not just "we're excited about AI"
7. TECHNICAL MOAT INDICATORS: Patents, published research, open source contributions, engineering blog depth`,

  regulatory_moat: `Extract and structure the following:
1. REGULATORY FRAMEWORK: Specific regulations that apply (HIPAA, OASIS, EVV, SOC2, PCI-DSS, etc.), enforcement level, trend direction
2. CERTIFICATIONS HELD: Confirmed certifications the company holds — SOC2 Type II, HIPAA BAA, HITRUST, ISO 27001, state licenses
3. SWITCHING COSTS: Specific friction factors — data migration complexity, compliance history resets, integration reconstruction, staff retraining time and cost, contract terms and exit provisions
4. DATA PORTABILITY: Can customers easily export their data? What format? What effort to migrate to a competitor?
5. DATA MOAT: What proprietary data accumulates in the platform? Does it become more valuable over time? Does it advantage AI model training?
6. MOAT DURABILITY: How long can this moat hold? What would erode it? Is regulation tightening or loosening?
7. COMPETITIVE BARRIERS: How hard is it for a new entrant to match the compliance posture? Time and cost estimates.`,

  workflow_product: `Extract and structure the following:
1. PRODUCT CATEGORY: Is this genuinely a System of Record, or an operational tool, or an analytics/reporting layer?
2. DAILY WORKFLOWS OWNED: What specific daily tasks do users do in this software? Scheduling, billing, clinical documentation, compliance reporting, payroll?
3. WORKFLOW EMBEDDEDNESS: How critical is this software to daily operations? What happens if it goes down for a day?
4. INTEGRATIONS: What systems is it integrated with? EHR/EMR, billing, government reporting, payroll, CRM? Number and depth of integrations.
5. VALUE QUANTIFICATION: Specific ROI metrics, case studies with named customers, time-savings data, revenue impact, risk reduction numbers
6. CUSTOMER RETENTION SIGNALS: Known retention/churn rates, NPS scores, G2/Capterra ratings and review themes, evidence of multi-year customer relationships
7. PRICING & EXPANSION: How does revenue grow with a customer? More users, more volume, more modules? Any outcome-based pricing?`,

  data_architecture: `Extract and structure the following:
1. TECH STACK: Cloud provider (AWS/Azure/GCP), database architecture, API structure, mobile vs web
2. DATA VOLUME & DEPTH: Estimated records in the system, years of longitudinal data, breadth of data captured per customer record
3. OUTCOME LABELING: Does the software capture what happened AFTER the service was delivered? Visit completions, health outcomes, billing accuracy, compliance results?
4. AI FEATURES IN PRODUCTION: Specific AI/ML features live in the product (not roadmap) — NLP, predictive analytics, scheduling optimization, documentation automation, risk scoring, etc.
5. AI BUILD vs WRAP: Building proprietary models on their data? Or wrapping OpenAI/Azure APIs? What's the long-term data moat strategy?
6. ARCHITECTURE READINESS: Cloud-native? Microservices? Real-time data pipeline? ML feature store? Modern enough to build AI on top of?
7. PROPRIETARY DATA ADVANTAGE: What data do they have that competitors can't replicate? How does this translate to model performance advantage?`,

  market_timing: `Extract and structure the following:
1. MARKET SIZE: TAM/SAM estimates with source and methodology. Growth rate (CAGR). Confidence in estimates.
2. PE/VC DEAL FLOW: Specific deals in this vertical in last 18 months — who raised, how much, at what stage, from whom
3. M&A ACTIVITY: Acquisitions in the vertical — who bought whom, at what multiples, strategic rationale
4. AI ADOPTION RATE: Survey data, operator reports, conference research — what % of operators in this vertical use AI tools? What's the adoption trajectory?
5. MACRO TAILWINDS: Demographics, labor shortages, reimbursement changes, regulatory mandates, consolidation trends that are driving demand
6. COMPARABLE TRANSACTION MULTIPLES: Relevant PE/M&A comps — EV/Revenue multiples for similar vertical SaaS companies
7. TIMING ASSESSMENT: Is this the right time to invest? Too early (market not ready)? Right timing? Too late (peak multiples)? What catalysts are ahead?`,
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

    const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
    const evidenceLength = (raw_evidence || '').length;
    const focusInstructions = SYNTHESIS_FOCUS[dimension] || `Extract all investment-relevant facts about ${dimension} for ${company_name}.`;

    // V4: Feed up to 85K chars (up from 55K) — Claude Opus handles 200K context
    const evidenceToSynth = (raw_evidence || 'No evidence provided — use analyst training knowledge').slice(0, 85000);
    const truncationNote = evidenceLength > 85000
      ? `\n\n[NOTE: Total evidence was ${Math.round(evidenceLength/1000)}K chars. Showing first 85K chars to synthesizer. Remaining ${Math.round((evidenceLength-85000)/1000)}K chars not shown — ensure the most critical sources were ranked first.]`
      : '';

    const systemPrompt = `You are a senior investment analyst at a PE/growth equity firm specializing in vertical SaaS acquisitions. Your role today is "Research Synthesis Associate" — you read everything so the deal team partner doesn't have to.

Your synthesis will directly feed into 7 investment scoring packs that determine whether we recommend GO, MAYBE, or NO-GO on this company. High-quality synthesis = accurate scoring = better investment decisions.

FUNDAMENTAL RULES:
1. FACTUAL PRECISION — Every claim needs a basis. Use one of: [CONFIRMED: source] / [INFERRED: reasoning] / [ANALYST KNOWLEDGE] / [UNKNOWN]
2. SPECIFICITY OVER VAGUENESS — "$4.2M ARR growing 40% YoY" beats "growing revenues". Names, numbers, dates, quotes.
3. COMPLETENESS — Surface every investment-relevant fact, even minor ones. The packs will decide what matters.
4. HONEST ABOUT GAPS — "Unknown / not found" is valuable. It tells the deal team what to diligence. Never fabricate.
5. CALIBRATION — If evidence is sparse, lead with training knowledge (labeled) rather than leaving sections empty.
6. INVESTMENT LENS — Every fact should answer: does this make the company MORE or LESS attractive? More or less valuable? More or less risky?

STRUCTURE REQUIREMENT: Your output must follow the numbered sections in the SYNTHESIS FOCUS exactly. Do not skip sections. If evidence is absent, write "[UNKNOWN — not found in evidence. Recommend direct inquiry.]" and note what would change the assessment.`;

    const userPrompt = `Synthesize this research evidence for ${company_name} (${vertical || 'vertical SaaS'}) — dimension: "${dimension}".

EVIDENCE VOLUME: ${Math.round(evidenceLength/1000)}K characters collected across 5 research passes (broad search, deep crawl, gap analysis, gap fill, second pass).

RAW EVIDENCE:
${evidenceToSynth}${truncationNote}

━━━ SYNTHESIS FOCUS FOR THIS DIMENSION ━━━
${focusInstructions}

━━━ OUTPUT FORMAT ━━━
Write a comprehensive analyst brief with numbered sections EXACTLY matching the focus areas above. For each section:
- Lead with the most important finding
- Include supporting facts with source citations
- Label every fact: [CONFIRMED: URL] or [INFERRED: reason] or [ANALYST KNOWLEDGE] or [UNKNOWN]
- If multiple conflicting sources: note the conflict and which you find more credible

After all sections, add THREE REQUIRED APPENDICES:

## APPENDIX A: TOP 15 INVESTMENT-RELEVANT FACTS
Bulleted list of the single most important facts for this dimension, ranked by investment significance. Each bullet: the fact + confidence label + why it matters to valuation/risk.

## APPENDIX B: CRITICAL UNKNOWNS & DATA GAPS
Facts that are materially missing and would change our view if answered. For each: what we don't know, why it matters, how to find out (management call question, data room request, or reference check).

## APPENDIX C: SIGNAL SUMMARY
A single paragraph (5-8 sentences) summarizing the overall investment signal for this dimension. Is it a positive, negative, or neutral signal? What is the key driver? What would flip the signal?

Target length: 1500-2500 words. Be thorough — this is the backbone of the investment analysis.`;

    let attempt = 0;
    let lastError = '';
    while (attempt < 3) {  // 3 attempts for synthesis (more important than packs)
      attempt++;
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';

        if (text && text.length > 200) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              synthesis: text,
              dimension,
              evidence_input_chars: evidenceLength,
              synthesis_chars: text.length,
              model_used: model,
              elapsed_ms: Date.now() - startTime,
            }),
          };
        }
      } catch (e: any) {
        lastError = e?.message || 'unknown error';
        console.error(`Synthesis attempt ${attempt}/3 failed for ${dimension}:`, lastError);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));  // 2s, 4s backoff
      }
    }

    // Fallback: return raw evidence (still useful for packs, better than nothing)
    console.warn(`Synthesis failed for ${dimension} after 3 attempts. Last error: ${lastError}. Returning raw evidence.`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synthesis: `[SYNTHESIS FAILED AFTER 3 ATTEMPTS — ${dimension}]\nLast error: ${lastError}\nReturning raw evidence for pack analysis.\n\n${(raw_evidence || '').slice(0, 30000)}`,
        dimension,
        evidence_input_chars: evidenceLength,
        synthesis_chars: 0,
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
