import type { FactorId, Confidence } from '../types';

/**
 * Eagle Vision — Scoring Rubrics
 *
 * UNIFIED SCALE: All factors score 0–100 where HIGH = MORE of what the factor measures.
 *
 * RISK FACTORS (R1–R7): High score = HIGH THREAT. Low score = SAFE.
 *   Display rule: threat meters, not grades. 15/100 = low threat = GOOD.
 *
 * READINESS FACTORS (A1–A10): High score = HIGH READINESS. Low score = needs work.
 *   Display rule: standard scale. 85/100 = strong = GOOD.
 *
 * KEY CALIBRATION FIXES vs previous version:
 * - R3: Now requires MARKET OVERLAP before scoring incumbent AI as a threat
 * - R6: Regulatory TIGHTENING now reduces erosion risk (stronger moat)
 * - A3: EVV/compliance-mandated data now scores as strong outcome labeling
 * - A8: Implicit data flywheels in vertical SaaS now credited (not just network effects)
 * - A10: New factor — SOR→SOA Transition Path (the PE value creation thesis)
 */

export interface RubricResult {
  score: number;
  rubric_applied: string;
}

// ─── R1: Competitive Window Closing ─────────────────────────────────────────
// HIGH score = window closing fast (BAD). LOW score = window still open (GOOD).
function scoreR1(signal: number, _summary: string): RubricResult {
  const rubric = 'Competitive Window: 0-20=window open >3yr, 21-40=2-3yr window, 41-60=12-24mo narrowing, 61-80=6-12mo urgent, 81-100=<6mo or already closed';
  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 28, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── R2: AI-Native Entrant Threat ────────────────────────────────────────────
// HIGH score = serious funded AI-native competitors exist (BAD).
function scoreR2(signal: number, _summary: string): RubricResult {
  const rubric = 'AI-Native Threat: 0-20=no identified entrants, 21-40=1 small pre-SeriesA, 41-60=2+ entrants none SeriesB+, 61-80=multiple with 1 SeriesB+, 81-100=3+ well-funded with real traction';
  if (signal < 0.2) return { score: 8, rubric_applied: rubric };
  if (signal < 0.4) return { score: 25, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── R3: Incumbent AI Advancement ─────────────────────────────────────────────
// HIGH score = overlapping incumbents aggressively deploying AI (BAD).
// CRITICAL FIX: Adjacent-market incumbents (different buyer/vertical) score LOW.
// Only score HIGH if the incumbent directly competes for the same customer.
function scoreR3(signal: number, summary: string): RubricResult {
  const rubric = 'Incumbent AI Advancement: 0-20=no overlapping incumbents with AI, 21-40=adjacent-market only (different buyer/payer), 41-60=overlapping incumbent with AI on roadmap, 61-80=overlapping incumbent shipped AI to shared customers, 81-100=dominant overlapping incumbent with GA AI and strong traction. NOTE: Adjacent-market players (e.g. clinical vs non-medical home care) should score 21-40 MAX regardless of AI investment.';

  // Detect adjacent-market language — cap score at 35 if no direct overlap
  const lowerSummary = summary.toLowerCase();
  const isAdjacentOnly = (
    lowerSummary.includes('adjacent') ||
    lowerSummary.includes('different market') ||
    lowerSummary.includes('different vertical') ||
    lowerSummary.includes('clinical') && lowerSummary.includes('non-medical') ||
    lowerSummary.includes('different buyer') ||
    lowerSummary.includes('different segment')
  );

  if (isAdjacentOnly) {
    // Adjacent market — cap at 35 max regardless of signal
    const adjScore = signal < 0.5 ? 18 : 32;
    return { score: adjScore, rubric_applied: rubric + ' [Adjacent market cap applied]' };
  }

  if (signal < 0.2) return { score: 8, rubric_applied: rubric };
  if (signal < 0.4) return { score: 28, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 65, rubric_applied: rubric };
  return { score: 82, rubric_applied: rubric };
}

// ─── R4: Horizontal AI Displacement Risk ────────────────────────────────────
// HIGH score = ChatGPT/Copilot actively replacing the vertical SaaS (BAD).
// Compliance/regulated workflows are naturally protected — score lower.
function scoreR4(signal: number, summary: string): RubricResult {
  const rubric = 'Horizontal AI Displacement: 0-20=regulated workflow fully protected, 21-40=theoretical threat only, 41-60=some experiments by users, 61-80=documented active displacement, 81-100=widespread replacement underway. Compliance-critical workflows (EVV, HIPAA, billing) protected by regulatory requirements.';

  const lowerSummary = summary.toLowerCase();
  const hasRegulatoryProtection = (
    lowerSummary.includes('evv') ||
    lowerSummary.includes('hipaa') ||
    lowerSummary.includes('medicaid') ||
    lowerSummary.includes('compliance') ||
    lowerSummary.includes('regulatory') ||
    lowerSummary.includes('mandate')
  );

  if (hasRegulatoryProtection && signal < 0.5) {
    // Regulated workflows get a protection discount — cap at 35
    return { score: Math.min(32, signal * 60), rubric_applied: rubric + ' [Regulatory protection discount applied]' };
  }

  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 25, rubric_applied: rubric };
  if (signal < 0.6) return { score: 45, rubric_applied: rubric };
  if (signal < 0.8) return { score: 65, rubric_applied: rubric };
  return { score: 83, rubric_applied: rubric };
}

// ─── R5: Customer Churn Vulnerability ────────────────────────────────────────
// HIGH score = easy to leave (BAD). LOW score = deeply locked in (GOOD).
function scoreR5(signal: number, _summary: string): RubricResult {
  const rubric = 'Churn Vulnerability: 0-20=extremely sticky (compliance data lock-in, multi-year contracts, high switching cost), 21-40=moderate stickiness, 41-60=some friction but manageable switch, 61-80=easy to switch, 81-100=trivial to switch/no real lock-in';
  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 28, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── R6: Regulatory Moat Erosion ─────────────────────────────────────────────
// HIGH score = regulatory moat eroding (BAD). LOW score = moat strong and tightening (GOOD).
// CRITICAL FIX: Regulatory TIGHTENING means MORE moat, not less. Score should be LOW.
function scoreR6(signal: number, summary: string): RubricResult {
  const rubric = 'Regulatory Moat Erosion: 0-20=strong tightening moat (new mandates adding, compliance complex, hard to replicate), 21-40=stable moat, 41-60=moat present but softening, 61-80=minimal regulatory protection, 81-100=deregulating or AI tools eliminating compliance barriers. TIGHTENING regulations = score moves toward 0 (stronger moat = less risk).';

  // Invert: high signal_strength on moat strength = LOW erosion risk
  const invertedSignal = 1 - signal;

  // Detect tightening language — move score further toward 0 (less risk)
  const lowerSummary = summary.toLowerCase();
  const isTightening = (
    lowerSummary.includes('tightening') ||
    lowerSummary.includes('increasing') ||
    lowerSummary.includes('new mandates') ||
    lowerSummary.includes('cms oversight') ||
    lowerSummary.includes('more states') ||
    lowerSummary.includes('expanding requirements')
  );

  let baseScore: number;
  if (invertedSignal < 0.2) baseScore = 12;
  else if (invertedSignal < 0.4) baseScore = 28;
  else if (invertedSignal < 0.6) baseScore = 48;
  else if (invertedSignal < 0.8) baseScore = 65;
  else baseScore = 82;

  // Tightening regulations reduce erosion risk by up to 15 points
  if (isTightening) {
    baseScore = Math.max(8, baseScore - 15);
  }

  return { score: baseScore, rubric_applied: rubric };
}

// ─── R7: Market Timing Risk ───────────────────────────────────────────────────
// HIGH score = bad timing (too late, over-funded, consolidating).
// LOW score = right timing window (growing market, consolidation ahead not behind).
function scoreR7(signal: number, _summary: string): RubricResult {
  const rubric = 'Market Timing Risk: 0-20=ideal timing (growing TAM, fragmented, consolidation ahead), 21-40=good timing slightly early, 41-60=neutral, 61-80=late/over-funded, 81-100=too late or market collapsing';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 65, rubric_applied: rubric };
  return { score: 82, rubric_applied: rubric };
}

// ─── A1: Workflow Embeddedness ────────────────────────────────────────────────
// HIGH = mission-critical SOR, daily use, can't operate without it (GOOD)
function scoreA1(signal: number, _summary: string): RubricResult {
  const rubric = 'Workflow Embeddedness: 0-20=peripheral nice-to-have, 21-40=used occasionally, 41-60=regular use not critical path, 61-80=daily critical workflows, 81-100=mission-critical System of Record — operations impossible without it';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 75, rubric_applied: rubric };
  return { score: 92, rubric_applied: rubric };
}

// ─── A2: Data Foundation & Quality ───────────────────────────────────────────
// HIGH = rich longitudinal proprietary dataset (GOOD)
function scoreA2(signal: number, _summary: string): RubricResult {
  const rubric = 'Data Foundation: 0-20=no structured data, 21-40=basic limited history, 41-60=multi-year structured data, 61-80=rich longitudinal data quality controls, 81-100=deep proprietary data moat years of operational history across many customers';
  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 58, rubric_applied: rubric };
  if (signal < 0.8) return { score: 75, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── A3: Outcome-Labeled Data ─────────────────────────────────────────────────
// HIGH = platform captures real outcomes, not just activity (GOOD)
// CRITICAL FIX: Regulatory mandates (EVV, billing outcomes) count as strong outcome labeling.
// EVV = federally mandated capture of visit timing, location, patient condition — that IS outcome data.
function scoreA3(signal: number, summary: string): RubricResult {
  const rubric = 'Outcome-Labeled Data: 0-20=activity only no outcomes, 21-40=minimal/implicit labeling, 41-60=partial outcome tracking, 61-80=systematic outcome capture, 81-100=comprehensive labeled outcomes including regulatory-mandated data (EVV, billing accuracy, audit trails). NOTE: Federally mandated outcome capture (EVV, OASIS, billing) scores 61-80 minimum.';

  const lowerSummary = summary.toLowerCase();
  const hasRegulatoryOutcomes = (
    lowerSummary.includes('evv') ||
    lowerSummary.includes('electronic visit verification') ||
    lowerSummary.includes('oasis') ||
    lowerSummary.includes('billing outcome') ||
    lowerSummary.includes('compliance data') ||
    lowerSummary.includes('audit trail') ||
    lowerSummary.includes('medicaid billing')
  );

  // Regulatory outcome data floors the score at 62
  if (hasRegulatoryOutcomes) {
    const baseScore = signal < 0.5 ? 62 : signal < 0.8 ? 72 : 85;
    return { score: baseScore, rubric_applied: rubric + ' [Regulatory outcome data floor applied]' };
  }

  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A4: Value Quantification ─────────────────────────────────────────────────
// HIGH = strong proven ROI data (GOOD)
function scoreA4(signal: number, _summary: string): RubricResult {
  const rubric = 'Value Quantification: 0-20=no ROI evidence, 21-40=anecdotal testimonials only, 41-60=some metrics published, 61-80=clear ROI metrics with case studies, 81-100=independently verified ROI with dollar quantification';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A5: Pricing Model Flexibility ───────────────────────────────────────────
// HIGH = can capture AI-delivered value through pricing (GOOD)
function scoreA5(signal: number, _summary: string): RubricResult {
  const rubric = 'Pricing Flexibility: 0-20=rigid per-seat only, 21-40=limited tiers, 41-60=multiple models, 61-80=usage/outcome-based available, 81-100=full flexibility with clear AI value pricing path';
  if (signal < 0.2) return { score: 20, rubric_applied: rubric };
  if (signal < 0.4) return { score: 38, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A6: AI/ML Team Capability ────────────────────────────────────────────────
// HIGH = strong AI team with shipped features (GOOD)
// CRITICAL FIX: Shipped AI features in production count heavily, not just credentials.
// A $20-40M ARR vertical SaaS with shipped AI earns at minimum a 55.
function scoreA6(signal: number, summary: string): RubricResult {
  const rubric = 'AI/ML Team Capability: 0-20=no AI staff no AI features, 21-40=1-2 ML engineers basic features, 41-60=small ML team with features in production, 61-80=strong team shipped AI customers actively using, 81-100=world-class AI team research+applied. NOTE: Shipped AI features in production score 41+ regardless of team size — execution matters more than credentials at this stage.';

  const lowerSummary = summary.toLowerCase();
  const hasShippedAI = (
    lowerSummary.includes('shipped') ||
    lowerSummary.includes('in production') ||
    lowerSummary.includes('launched') ||
    lowerSummary.includes('live feature') ||
    lowerSummary.includes('axiscare intelli') ||
    lowerSummary.includes('ai feature') ||
    lowerSummary.includes('released') ||
    lowerSummary.includes('available to customers')
  );

  // Floor at 52 if AI features have been shipped
  if (hasShippedAI && signal >= 0.3) {
    const baseScore = signal < 0.6 ? 55 : signal < 0.8 ? 68 : 82;
    return { score: baseScore, rubric_applied: rubric + ' [Shipped AI features floor applied]' };
  }

  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 32, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A7: Architecture Readiness ───────────────────────────────────────────────
// HIGH = cloud-native, API-first, ML-ready infrastructure (GOOD)
function scoreA7(signal: number, _summary: string): RubricResult {
  const rubric = 'Architecture Readiness: 0-20=legacy monolith on-prem, 21-40=partial modernization, 41-60=cloud-hosted API-accessible, 61-80=cloud-native microservices, 81-100=ML-native architecture with real-time data pipelines';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A8: Data Compounding Loop ────────────────────────────────────────────────
// HIGH = data flywheel makes product better as usage grows (GOOD)
// CRITICAL FIX: Implicit data flywheels in vertical SaaS ARE compounding loops.
// Multi-tenant operational data (scheduling patterns, outcomes, billing) that
// improves analytics, benchmarking, or model training for ALL customers = flywheel.
// This is NOT the same as network effects (social) or marketplace dynamics.
function scoreA8(signal: number, summary: string): RubricResult {
  const rubric = 'Data Compounding Loop: 0-20=single-tenant siloed data no cross-learning, 21-40=basic usage analytics, 41-60=cross-customer benchmarking or aggregate insights, 61-80=data flywheel where more customers = better models for all, 81-100=proven compounding loop with demonstrated model improvement. NOTE: Multi-tenant operational data (scheduling, EVV, outcomes) enabling benchmarking or aggregate AI training scores 41-60 minimum — vertical SaaS data flywheels are implicit, not network effects.';

  const lowerSummary = summary.toLowerCase();
  const hasImplicitFlywheel = (
    lowerSummary.includes('multi-tenant') ||
    lowerSummary.includes('aggregate') ||
    lowerSummary.includes('benchmark') ||
    lowerSummary.includes('cross-customer') ||
    lowerSummary.includes('scheduling data') ||
    lowerSummary.includes('evv data') ||
    lowerSummary.includes('operational data') ||
    lowerSummary.includes('longitudinal') ||
    lowerSummary.includes('thousands of') ||
    lowerSummary.includes('population') ||
    lowerSummary.includes('industry data')
  );

  // Implicit vertical SaaS data flywheel floors at 42
  if (hasImplicitFlywheel) {
    const baseScore = signal < 0.4 ? 42 : signal < 0.7 ? 58 : 72;
    return { score: baseScore, rubric_applied: rubric + ' [Implicit data flywheel floor applied]' };
  }

  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 50, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── A9: Leadership AI Conviction ────────────────────────────────────────────
// HIGH = CEO has demonstrated real AI commitment through actions (GOOD)
function scoreA9(signal: number, _summary: string): RubricResult {
  const rubric = 'Leadership AI Conviction: 0-20=no AI strategy mentioned, 21-40=vague AI enthusiasm no actions, 41-60=defined AI roadmap with budget, 61-80=AI-first strategy CEO publicly committed with hires, 81-100=deep conviction with AI acquisitions/partnerships/org changes proving commitment';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A10: SOR→SOA Transition Path ─────────────────────────────────────────────
// HIGH = clear credible path from System of Record to System of Action (GOOD)
// This is the core PE value creation thesis for vertical SaaS AI investments.
// Question: Does this company own the canonical workflow + data AND have a
// credible path to delivering AI-driven outcomes that command premium pricing?
function scoreA10(signal: number, summary: string): RubricResult {
  const rubric = 'SOR→SOA Path: 0-20=no SOR position (not the system of record), 21-40=SOR position exists but data too thin or fragmented for AI, 41-60=strong SOR with data foundation, AI path requires significant build, 61-80=strong SOR + early AI features + clear SOA roadmap (recommend invest + build), 81-100=SOR to SOA transition underway with AI-driven outcomes already showing. This factor captures the PE thesis: own the canonical workflow, accumulate the data, deploy AI for outcome-based value.';

  const lowerSummary = summary.toLowerCase();

  // Strong SOR signals
  const hasSOR = (
    lowerSummary.includes('system of record') ||
    lowerSummary.includes('primary system') ||
    lowerSummary.includes('core platform') ||
    lowerSummary.includes('mission critical') ||
    lowerSummary.includes('cannot operate without') ||
    lowerSummary.includes('scheduling') && lowerSummary.includes('billing') ||
    lowerSummary.includes('evv') && lowerSummary.includes('scheduling')
  );

  // Early SOA signals
  const hasSOAProgress = (
    lowerSummary.includes('predictive') ||
    lowerSummary.includes('ai-driven') ||
    lowerSummary.includes('outcome') ||
    lowerSummary.includes('automation') ||
    lowerSummary.includes('intelligent') ||
    lowerSummary.includes('ai feature') ||
    lowerSummary.includes('machine learning')
  );

  // Strong SOR + early SOA = BUILD thesis = score 65+
  if (hasSOR && hasSOAProgress) {
    const baseScore = signal < 0.5 ? 65 : signal < 0.8 ? 75 : 88;
    return { score: baseScore, rubric_applied: rubric + ' [SOR confirmed + SOA signals detected]' };
  }

  // Strong SOR alone (SOA work ahead) = score 55+
  if (hasSOR) {
    const baseScore = signal < 0.4 ? 55 : signal < 0.7 ? 65 : 75;
    return { score: baseScore, rubric_applied: rubric + ' [SOR confirmed, SOA path to build]' };
  }

  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── Master Rubric Dispatch ───────────────────────────────────────────────────
export function applyRubric(
  factorId: FactorId,
  signal_strength: number,
  evidence_summary: string
): RubricResult {
  const s = Math.max(0, Math.min(1, signal_strength));
  switch (factorId) {
    case 'R1': return scoreR1(s, evidence_summary);
    case 'R2': return scoreR2(s, evidence_summary);
    case 'R3': return scoreR3(s, evidence_summary);
    case 'R4': return scoreR4(s, evidence_summary);
    case 'R5': return scoreR5(s, evidence_summary);
    case 'R6': return scoreR6(s, evidence_summary);
    case 'R7': return scoreR7(s, evidence_summary);
    case 'A1': return scoreA1(s, evidence_summary);
    case 'A2': return scoreA2(s, evidence_summary);
    case 'A3': return scoreA3(s, evidence_summary);
    case 'A4': return scoreA4(s, evidence_summary);
    case 'A5': return scoreA5(s, evidence_summary);
    case 'A6': return scoreA6(s, evidence_summary);
    case 'A7': return scoreA7(s, evidence_summary);
    case 'A8': return scoreA8(s, evidence_summary);
    case 'A9': return scoreA9(s, evidence_summary);
    case 'A10': return scoreA10(s, evidence_summary);
    default: return { score: 50, rubric_applied: 'Default: insufficient evidence' };
  }
}

// Confidence aggregation
export function aggregateConfidence(confidences: Confidence[]): Confidence {
  if (confidences.includes('L')) return 'L';
  if (confidences.includes('M')) return 'M';
  return 'H';
}
