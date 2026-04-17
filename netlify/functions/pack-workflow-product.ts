/**
 * Eagle Vision — Workflow & Product Pack
 * Factors: A1 (Workflow Embeddedness), A4 (Value Quantification), R5 (switching — shared with regulatory)
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

    const systemPrompt = `You are a senior product and commercial analyst at a PE/growth equity firm that invests in vertical SaaS. You specialize in evaluating how deeply a software product is embedded in customer workflows and whether the company can quantify the value it delivers.

The key insight you apply: there is a massive difference between software that customers use occasionally vs. software that runs their daily operations (system of record). The more embedded, the stickier and more AI-upgradeable the product is.

CRITICAL INSTRUCTIONS:
1. "System of Record" = highest workflow embeddedness. This software IS the business for their customers.
2. Daily active use on critical workflows = high embeddedness. Used for scheduling, billing, compliance.
3. Periodic use or reporting = lower embeddedness. Can be replaced without disrupting operations.
4. Value quantification = can the company show ROI in dollars, hours saved, revenue generated, risk avoided
5. Be specific — for known companies, cite actual product features, customer quotes, case studies
6. Don't confuse pricing model complexity with pricing flexibility — flexibility means customers can pay based on outcomes`;

    const userPrompt = `Assess workflow embeddedness and value quantification for this vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Infer from context'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Limited web evidence. CRITICAL: Use your training knowledge about ${company_name}. You may know what this product does, how customers use it, what workflows it covers, and what value it delivers. Provide real analysis with specific product details. Mark confidence 'L' but give substantive answers.`
  : `Use evidence below plus your knowledge for the most accurate assessment.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "workflow_product",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "product_overview",
      "value": {
        "core_product": "<1-2 sentence description of what the product actually does>",
        "primary_user": "<who uses this software day-to-day — frontline workers, managers, billing staff?>",
        "system_category": "SYSTEM_OF_RECORD"|"OPERATIONAL_SYSTEM"|"ANALYTICAL_TOOL"|"COMMUNICATION_TOOL"|"REPORTING_TOOL",
        "modules_or_features": ["<list the main modules/features you know about>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "workflow_embeddedness_detail",
      "value": {
        "daily_usage_activities": ["<specific daily tasks this software is used for>"],
        "critical_workflows_owned": ["<mission-critical workflows — scheduling, billing, compliance, care plans, etc.>"],
        "workflow_ownership_level": "FULL_SYSTEM_OF_RECORD"|"PRIMARY_OPERATIONAL"|"SECONDARY_OPERATIONAL"|"SUPPLEMENTARY"|"PERIPHERAL",
        "integrations_that_deepen_lock_in": ["<EHR integrations, billing systems, government reporting, etc. that make it sticky>"],
        "use_frequency": "MULTIPLE_TIMES_DAILY"|"DAILY"|"WEEKLY"|"MONTHLY"|"OCCASIONAL"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "value_quantification_evidence",
      "value": {
        "roi_metrics_published": ["<specific metrics: 'reduces billing time by 40%', '$2M revenue per customer per year', etc.>"],
        "case_studies": ["<specific named customer case studies if known>"],
        "customer_testimonials": ["<relevant quotes or paraphrased testimonials>"],
        "outcome_data": "<does the software track outcomes that prove value? Visit completions, billing accuracy, compliance rates?>",
        "quantification_maturity": "OUTCOME_BASED_PRICING"|"CLEAR_ROI_METRICS"|"SOME_METRICS"|"ANECDOTAL"|"NONE"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    },
    {
      "key": "pricing_model",
      "value": {
        "current_model": "<per-seat/per-user, per-patient/per-record, per-visit, usage-based, flat fee, outcome-based, or combination>",
        "expansion_mechanics": "<how does revenue expand with customers? More users, more volume, more modules?>",
        "pricing_flexibility": "HIGH"|"MEDIUM"|"LOW",
        "ai_pricing_readiness": "<could they charge for AI features? Usage-based or outcome-based AI pricing feasible?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "customer_retention_signals",
      "value": {
        "known_retention_rate": "<any published or inferred retention/churn rate>",
        "nps_or_review_signal": "<G2, Capterra scores, NPS data, or review sentiment>",
        "expansion_revenue": "<evidence of net revenue retention or expansion revenue>",
        "customer_longevity": "<do customers stay for years? Any data on average customer tenure?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url>"],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "A1": {
      "evidence_summary": "<3-4 sentences: How embedded is this software in daily operations? Is it a true system of record? Describe specific workflows it owns. Why would a customer NOT want to rip it out? Use the product category and specific workflow details.>",
      "signal_strength": <0.0-1.0>
    },
    "A4": {
      "evidence_summary": "<3-4 sentences: Can the company quantify value for customers? What specific ROI metrics, case studies, or outcome data exist? Can they demonstrate cost savings, revenue generation, risk reduction in hard numbers?>",
      "signal_strength": <0.0-1.0>
    },
    "R5": {
      "evidence_summary": "<2-3 sentences: How easy is it to rip this software out? What's the switching cost? Data migration complexity, workflow disruption, compliance re-certification, integration complexity.>",
      "signal_strength": <0.0-1.0, where 0.0=impossible to switch, 1.0=trivially easy to switch>
    }
  },
  "red_flags": ["<Real concerns: e.g. 'Product is reporting-only, not operational — easy to replace', 'Customers can export all data in CSV in one click'>"],
  "green_flags": ["<Positive signals: e.g. 'Primary scheduling and billing system — removing it would require 6+ months of migration'>"],
  "v2_stub": false
}

SIGNAL STRENGTH CALIBRATION:
A1 (Workflow Embeddedness):
0.1 = Reporting/analytics only — nice to have, not needed to operate
0.2 = One workflow module, peripheral to operations
0.3 = Used regularly but not mission-critical, replaceable with moderate effort
0.4 = Important operational tool used daily but not the system of record
0.5 = Core operational tool — removing it would hurt but business would survive
0.6 = Primary operational system for 1-2 critical workflows
0.7 = System of record for primary operations — removing it is very painful
0.8 = Full system of record — this IS how they run their business
0.9 = System of record + compliance history + regulatory data — virtually irreplaceable
1.0 = Mission-critical system of record for heavily regulated vertical

A4 (Value Quantification):
0.1 = No ROI data, value purely qualitative
0.2 = Anecdotal customer quotes only
0.3 = Some time-savings metrics, no dollar value
0.4 = Published case studies with specific metrics
0.5 = Clear ROI metrics, some case studies with dollar impact
0.6 = Multiple published case studies, consistent ROI themes
0.7 = Strong ROI evidence with independent validation
0.8 = Outcome-tracking built into product, ROI dashboard
0.9 = Outcome-based pricing contracts with verified results
1.0 = Industry-standard ROI benchmark setter, analysts cite their data

R5 (Customer Switching Propensity) — LOWER IS BETTER:
0.1 = Multi-year compliance data locked in — switching would require regulatory re-approval
0.3 = High switching cost — data migration, staff retraining, integration reconstruction
0.5 = Moderate — feasible but takes months and significant budget
0.7 = Low cost — could switch in 2-4 weeks with minimal disruption
0.9 = Trivial — competitor offers free migration, all data in standard formats`;

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
        pack_name: 'workflow_product',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          A1: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
          A4: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
          R5: { evidence_summary: 'Pack failed after retries', signal_strength: 0.5 },
        },
        red_flags: ['Workflow Product pack failed'],
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
