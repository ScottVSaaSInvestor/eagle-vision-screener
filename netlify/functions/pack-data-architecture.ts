/**
 * Eagle Vision — Data Architecture Pack
 * Factors: A2 (Data Foundation), A3 (Outcome-Labeled Data), A7 (Architecture Readiness)
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

    const systemPrompt = `You are a senior technical due diligence analyst at a PE/growth equity firm specializing in AI-ready vertical SaaS. You evaluate data foundation quality, outcome-labeled training data assets, and architecture readiness for AI deployment.

Key insight you apply: Vertical SaaS companies that are systems of record typically sit on extraordinary longitudinal datasets that become proprietary training data advantages when paired with the right architecture. The question is whether they have:
1. Volume + breadth of data (many customers × long history × rich fields)
2. Outcome labels (not just what happened, but what the RESULT was)
3. Modern architecture that can actually leverage this data for AI

CRITICAL INSTRUCTIONS:
1. For healthcare/field service/fintech verticals, you know these systems collect rich operational + outcome data
2. Infer data richness from the product description — a home health SOR collects visit notes, medications, outcomes, billing codes, etc.
3. Distinguish between "we have data" and "we have AI-training-ready labeled outcome data"
4. Architecture signals: job postings for ML engineers, cloud infrastructure, APIs, engineering blogs
5. Be specific — name the types of data, the architecture signals, the AI features shipped`;

    const userPrompt = `Assess data foundation quality, outcome-labeled data assets, and architecture readiness for AI at this vertical SaaS company.

COMPANY: ${company_name}
URL: ${company_url || 'Not provided'}
VERTICAL: ${vertical || 'Infer from context'}

${!hasRichEvidence && use_knowledge_fallback
  ? `KNOWLEDGE FALLBACK: Limited web evidence. CRITICAL: Use your training knowledge about ${company_name} and the ${vertical || 'vertical SaaS'} market. You can infer the data types this system collects from knowing what category of software it is. A home health SOR collects patient demographics, visit records, care plans, medication adherence, billing codes, and outcomes. Use this reasoning. Mark confidence 'L' but give real substantive assessments.`
  : `Use evidence below plus your knowledge for the most accurate assessment.`}

RESEARCH EVIDENCE (${evidenceContext.length} chars):
${evidenceContext || 'Limited web evidence — use training knowledge as instructed.'}

Return ONLY valid JSON with NO markdown fences:

{
  "pack_name": "data_architecture",
  "pack_version": "2.0",
  "generated_at": "${new Date().toISOString()}",
  "data_quality_score": <0.0-1.0>,
  "findings": [
    {
      "key": "data_asset_profile",
      "value": {
        "estimated_customer_count": "<e.g. '500+ agencies', '2000+ practices', 'Unknown' — use your knowledge>",
        "data_types_collected": ["<specific data types: patient records, visit notes, billing codes, schedules, outcomes, medications, etc.>"],
        "longitudinal_depth": "<how long is the historical record? Years of data per customer?>",
        "data_volume_assessment": "LARGE"|"MEDIUM"|"SMALL"|"UNKNOWN",
        "proprietary_data_advantage": "<what data does this company have that competitors building from scratch would NOT have?>",
        "data_density": "<how information-rich are records? Structured vs unstructured? Labeled fields vs free text?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst inference from product category'>"],
      "unknowns": []
    },
    {
      "key": "outcome_labeled_data_assessment",
      "value": {
        "outcome_capture_level": "SYSTEMATIC"|"PARTIAL"|"MINIMAL"|"NONE"|"UNKNOWN",
        "outcome_examples": ["<specific outcomes this system tracks — e.g. patient readmission, visit completion, care plan adherence, billing collection rate>"],
        "ground_truth_quality": "<how reliable and complete are the outcome labels? Manual entry? Auto-captured? Third-party verified?>",
        "ml_training_readiness": "READY"|"NEEDS_WORK"|"SIGNIFICANT_GAP"|"NOT_READY",
        "ai_training_examples": "<if you know about existing AI features, what data presumably trained them?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "current_ai_features",
      "value": {
        "shipped_ai_features": ["<specific AI features that are in production — predictive scheduling, risk flagging, billing automation, NLP notes, etc.>"],
        "ai_feature_maturity": "PRODUCTION_WITH_PROVEN_VALUE"|"PRODUCTION_EARLY"|"BETA"|"ANNOUNCED"|"NONE",
        "ai_use_cases_obvious": ["<AI use cases that seem obvious given the data they collect but haven't been confirmed shipped yet>"],
        "third_party_ai_integrations": ["<any AI tool integrations: OpenAI, AWS Bedrock, Azure AI, etc.>"]
      },
      "confidence": "H"|"M"|"L",
      "sources": ["<url or 'Analyst knowledge'>"],
      "unknowns": []
    },
    {
      "key": "architecture_signals",
      "value": {
        "deployment_model": "CLOUD_NATIVE"|"CLOUD_HOSTED"|"HYBRID"|"ON_PREMISE"|"UNKNOWN",
        "api_maturity": "FULL_API"|"PARTIAL_API"|"BASIC_INTEGRATION"|"NONE"|"UNKNOWN",
        "tech_stack_signals": ["<evidence of tech stack from job postings, engineering blog, integrations, etc.>"],
        "scalability_architecture": "<description of scalability architecture if known>",
        "ml_infrastructure": "<any known ML pipeline, MLOps, feature stores, etc.>",
        "legacy_risk": "<assessment of legacy technical debt that would block AI deployment>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    },
    {
      "key": "data_network_effects",
      "value": {
        "network_effect_present": <boolean>,
        "flywheel_description": "<does more customers = better models = better product? Describe the specific flywheel.>",
        "cross_customer_learning": "<is data from multiple customers used to improve outcomes for all? Benchmarking? Aggregate analytics?>",
        "competitive_data_advantage": "<in 3-5 years, if this company builds AI on its data, how defensible is that advantage?>"
      },
      "confidence": "H"|"M"|"L",
      "sources": [],
      "unknowns": []
    }
  ],
  "factor_inputs": {
    "A2": {
      "evidence_summary": "<3-4 sentences: What data does this company sit on? Estimated volume, breadth, longitudinal depth. Is this a rich proprietary dataset that would take competitors years to replicate? Be specific about the types of records collected.>",
      "signal_strength": <0.0-1.0>
    },
    "A3": {
      "evidence_summary": "<3-4 sentences: Does this system capture outcome-labeled data? Does it record what actually happened — not just the input (care plan) but the output (patient outcome, readmission, billing result)? Is this data structured for ML training use?>",
      "signal_strength": <0.0-1.0>
    },
    "A7": {
      "evidence_summary": "<3-4 sentences: Is the architecture ready to leverage the data for AI? Cloud-native? API-first? Any ML infrastructure? Or is it a legacy monolith that would require years of architectural work before AI can be deployed at scale?>",
      "signal_strength": <0.0-1.0>
    }
  },
  "red_flags": ["<Real concerns: e.g. 'On-premise deployment limits cross-customer data aggregation', 'Data primarily unstructured free text with no outcome labels'>"],
  "green_flags": ["<Positive signals: e.g. 'Cloud-native SOR with 10+ years of structured patient + outcome data across 2000+ agencies'>"],
  "v2_stub": false
}

SIGNAL STRENGTH CALIBRATION:
A2 (Data Foundation Quality):
0.1 = No meaningful data, thin/sparse records
0.2 = Basic operational data, limited history, few fields
0.3 = Multi-year operational data but siloed, inconsistent quality
0.4 = Decent structured dataset, growing over time
0.5 = Solid multi-year operational dataset with reasonable breadth
0.6 = Rich longitudinal dataset across many customers and years
0.7 = Industry-leading data volume with quality controls
0.8 = Exceptional proprietary dataset that would take 5+ years for competitors to replicate
0.9 = Best-in-class data asset, network effects growing the moat
1.0 = Dominant data position, de facto industry standard

A3 (Outcome-Labeled Data):
0.1 = No outcome data — only inputs recorded, no results tracked
0.2 = Very minimal implicit outcomes, hard to extract labels
0.3 = Some outcomes tracked but not systematically or at scale
0.4 = Partial outcome tracking — some modules capture outcomes
0.5 = Reasonable outcome tracking in core workflows
0.6 = Systematic outcome capture across most workflows
0.7 = Rich outcome-labeled dataset with clear input-output structure
0.8 = Comprehensive longitudinal outcome data, structured for ML
0.9 = Gold-standard outcome-labeled training data, regularly audited
1.0 = Industry benchmark for outcome measurement, published results

A7 (Architecture Readiness):
0.1 = Legacy on-premise monolith, years away from AI deployment
0.2 = Mostly legacy, some modernization in progress
0.3 = Partially modernized, basic APIs, moving to cloud
0.4 = Primarily cloud-hosted (not native), reasonable APIs
0.5 = Modern cloud deployment, REST APIs available
0.6 = Cloud-native with good API coverage, scalable
0.7 = Cloud-native, microservices, ML-friendly infrastructure
0.8 = Modern ML stack — MLOps, feature stores, model serving
0.9 = AI-native architecture, purpose-built for ML deployment
1.0 = Best-in-class ML infrastructure, production AI at scale`;

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
        pack_name: 'data_architecture',
        pack_version: '2.0',
        generated_at: new Date().toISOString(),
        data_quality_score: 0.1,
        findings: [],
        factor_inputs: {
          A2: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
          A3: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
          A7: { evidence_summary: 'Pack failed after retries', signal_strength: 0.4 },
        },
        red_flags: ['Data Architecture pack failed'],
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
