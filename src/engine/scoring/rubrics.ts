import type { FactorId, Confidence } from '../types';

// Each rubric maps signal_strength (0–1) to a score 0–100
// signal_strength comes from pack factor_inputs

export interface RubricResult {
  score: number;
  rubric_applied: string;
}

// ─── R1: Competitive Window ──────────────────────────────────────────────────
// Higher score = more risky (window is closing fast)
function scoreR1(signal: number, summary: string): RubricResult {
  const rubric = 'Competitive Window: 0-20=protected window >3yr, 21-40=2-3yr window, 41-60=12-24mo, 61-80=6-12mo, 81-100=<6mo or already closed';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 32, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── R2: AI-Native Entrant Threat ────────────────────────────────────────────
// Higher score = more entrants / more threatening
function scoreR2(signal: number, _summary: string): RubricResult {
  const rubric = 'AI-Native Entrant Threat: 0-20=no identified entrants, 21-40=1 small sub-SeriesA, 41-60=2+ entrants none SeriesB+, 61-80=multiple with 1 SeriesB+, 81-100=3+ well-funded with traction';
  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 50, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── R3: Incumbent AI Posture ─────────────────────────────────────────────────
// Higher score = incumbents are more aggressively deploying AI
function scoreR3(signal: number, _summary: string): RubricResult {
  const rubric = 'Incumbent AI Posture: 0-20=no AI initiatives, 21-40=roadmap only/signaling, 41-60=beta feature shipped, 61-80=launched product marketed to customers, 81-100=GA feature with customer traction';
  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 50, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── R4: Horizontal AI Encroachment ─────────────────────────────────────────
// Higher score = more risk from horizontal AI replacing vertical SaaS
function scoreR4(signal: number, _summary: string): RubricResult {
  const rubric = 'Horizontal AI Encroachment: 0-20=no credible horizontal threat, 21-40=theoretical only, 41-60=experiments by users, 61-80=active use cases documented, 81-100=widespread adoption displacing SaaS';
  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 28, rubric_applied: rubric };
  if (signal < 0.6) return { score: 48, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 86, rubric_applied: rubric };
}

// ─── R5: Customer Switching Propensity ──────────────────────────────────────
// Higher score = customers more likely to switch
function scoreR5(signal: number, _summary: string): RubricResult {
  const rubric = 'Customer Switching Propensity: 0-20=high switching costs/locked data, 21-40=moderate friction, 41-60=some integrations but manageable, 61-80=low switching costs, 81-100=trivial to switch/no lock-in';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── R6: Regulatory Moat Durability ─────────────────────────────────────────
// Higher score = regulation is eroding / not protective (higher risk)
function scoreR6(signal: number, _summary: string): RubricResult {
  const rubric = 'Regulatory Moat Durability (risk): 0-20=strong durable reg moat, 21-40=meaningful regulations but softening, 41-60=moderate reg barriers, 61-80=minimal regulatory protection, 81-100=no moat/deregulating';
  // Invert: high signal_strength on moat = lower risk
  const invertedSignal = 1 - signal;
  if (invertedSignal < 0.2) return { score: 15, rubric_applied: rubric };
  if (invertedSignal < 0.4) return { score: 35, rubric_applied: rubric };
  if (invertedSignal < 0.6) return { score: 52, rubric_applied: rubric };
  if (invertedSignal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 84, rubric_applied: rubric };
}

// ─── R7: Market Timing Risk ───────────────────────────────────────────────────
// Higher score = worse timing (too early or market already consolidating)
function scoreR7(signal: number, _summary: string): RubricResult {
  const rubric = 'Market Timing Risk: 0-20=perfect timing window, 21-40=good timing slightly early, 41-60=neutral timing, 61-80=late timing or over-funded, 81-100=too late/market collapsing';
  if (signal < 0.2) return { score: 18, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 68, rubric_applied: rubric };
  return { score: 85, rubric_applied: rubric };
}

// ─── A1: Workflow Embeddedness ────────────────────────────────────────────────
// Higher score = more embedded in daily workflows (good)
function scoreA1(signal: number, _summary: string): RubricResult {
  const rubric = 'Workflow Embeddedness: 0-20=peripheral/nice-to-have, 21-40=used occasionally, 41-60=regular use but not critical path, 61-80=daily use on critical workflows, 81-100=mission-critical system of record';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── A2: Data Foundation & Quality ───────────────────────────────────────────
function scoreA2(signal: number, _summary: string): RubricResult {
  const rubric = 'Data Foundation: 0-20=no structured data, 21-40=basic structured data limited history, 41-60=multi-year structured data, 61-80=rich longitudinal data with quality controls, 81-100=proprietary data moat with feedback loops';
  if (signal < 0.2) return { score: 12, rubric_applied: rubric };
  if (signal < 0.4) return { score: 32, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── A3: Outcome-Labeled Data ─────────────────────────────────────────────────
function scoreA3(signal: number, _summary: string): RubricResult {
  const rubric = 'Outcome-Labeled Data: 0-20=no labeled outcomes, 21-40=minimal labeling, 41-60=partial labeling, 61-80=systematic outcome tracking, 81-100=comprehensive labeled dataset with business outcomes';
  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── A4: Value Quantification ─────────────────────────────────────────────────
function scoreA4(signal: number, _summary: string): RubricResult {
  const rubric = 'Value Quantification: 0-20=no ROI evidence, 21-40=anecdotal value, 41-60=partial metrics, 61-80=clear ROI metrics published, 81-100=independently verified ROI with case studies';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A5: Pricing Model Flexibility ───────────────────────────────────────────
function scoreA5(signal: number, _summary: string): RubricResult {
  const rubric = 'Pricing Flexibility: 0-20=rigid seat-only pricing, 21-40=limited tiers, 41-60=multiple models, 61-80=usage/outcome-based available, 81-100=full flexibility with AI pricing options';
  if (signal < 0.2) return { score: 20, rubric_applied: rubric };
  if (signal < 0.4) return { score: 38, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A6: AI/ML Team Capability ────────────────────────────────────────────────
function scoreA6(signal: number, _summary: string): RubricResult {
  const rubric = 'AI/ML Team: 0-20=no dedicated AI/ML, 21-40=1-2 ML engineers, 41-60=small ML team, 61-80=strong ML team with published work, 81-100=world-class AI team research+applied';
  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 72, rubric_applied: rubric };
  return { score: 90, rubric_applied: rubric };
}

// ─── A7: Architecture Readiness ───────────────────────────────────────────────
function scoreA7(signal: number, _summary: string): RubricResult {
  const rubric = 'Architecture Readiness: 0-20=legacy monolith, 21-40=partial APIs, 41-60=API-first modern stack, 61-80=microservices with ML infrastructure, 81-100=ML-native architecture cloud-native';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A8: Compounding Loop Potential ──────────────────────────────────────────
function scoreA8(signal: number, _summary: string): RubricResult {
  const rubric = 'Compounding Loop: 0-20=no feedback loops, 21-40=basic usage data, 41-60=some learning loops, 61-80=clear flywheel design, 81-100=proven compounding data/network effects';
  if (signal < 0.2) return { score: 10, rubric_applied: rubric };
  if (signal < 0.4) return { score: 30, rubric_applied: rubric };
  if (signal < 0.6) return { score: 52, rubric_applied: rubric };
  if (signal < 0.8) return { score: 70, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
}

// ─── A9: Leadership AI Clarity ────────────────────────────────────────────────
function scoreA9(signal: number, _summary: string): RubricResult {
  const rubric = 'Leadership AI Clarity: 0-20=no AI strategy, 21-40=vague AI mentions, 41-60=defined AI roadmap, 61-80=AI-first strategy with CEO alignment, 81-100=deep AI conviction with track record';
  if (signal < 0.2) return { score: 15, rubric_applied: rubric };
  if (signal < 0.4) return { score: 35, rubric_applied: rubric };
  if (signal < 0.6) return { score: 55, rubric_applied: rubric };
  if (signal < 0.8) return { score: 73, rubric_applied: rubric };
  return { score: 88, rubric_applied: rubric };
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
    default: return { score: 50, rubric_applied: 'Default: insufficient evidence' };
  }
}

// Confidence aggregation: if multiple factors have confidence, take the lowest
export function aggregateConfidence(confidences: Confidence[]): Confidence {
  if (confidences.includes('L')) return 'L';
  if (confidences.includes('M')) return 'M';
  return 'H';
}
