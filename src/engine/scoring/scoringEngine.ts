/**
 * Eagle Vision Scoring Engine
 * DETERMINISTIC — No LLM calls. LLMs produce evidence. This code produces scores.
 */

import type {
  DataPack, FactorId, FactorScore, ScoreBundle,
  LetterGrade, Disposition, Quadrant, Confidence,
  PackName
} from '../types';
import { FACTOR_NAMES } from '../types';
import { RISK_WEIGHTS, READINESS_WEIGHTS, RISK_FACTOR_IDS, READINESS_FACTOR_IDS } from './weights';
import { applyRubric, aggregateConfidence } from './rubrics';

const DEFAULT_PACK_FOR_FACTOR: Record<FactorId, PackName> = {
  R1: 'competitive_landscape',
  R2: 'competitive_landscape',
  R3: 'competitive_landscape',
  R4: 'competitive_landscape',
  R5: 'workflow_product',
  R6: 'regulatory_moat',
  R7: 'market_timing',
  A1: 'workflow_product',
  A2: 'data_architecture',
  A3: 'data_architecture',
  A4: 'workflow_product',
  A5: 'company_profile',
  A6: 'team_capability',
  A7: 'data_architecture',
  A8: 'competitive_landscape',
  A9: 'team_capability',
};

function scoreToGrade(score: number): LetterGrade {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function getQuadrant(riskScore: number, readinessScore: number): Quadrant {
  const highRisk = riskScore >= 50;
  const highReadiness = readinessScore >= 50;
  if (!highRisk && highReadiness) return 'EXECUTE';
  if (highRisk && highReadiness) return 'RACE_MODE';
  if (!highRisk && !highReadiness) return 'BUILD_MODE';
  return 'DANGER_ZONE';
}

function getDisposition(
  quadrant: Quadrant,
  criticalGaps: FactorId[],
  confidenceOverall: Confidence
): Disposition {
  if (quadrant === 'DANGER_ZONE' || criticalGaps.length >= 2) return 'NO-GO';
  if ((quadrant === 'EXECUTE' || quadrant === 'RACE_MODE') && criticalGaps.length === 0) {
    // Only downgrade GO to MAYBE if confidence is LOW AND we have no strong pack coverage
    if (confidenceOverall === 'L') return 'MAYBE';
    return 'GO';
  }
  return 'MAYBE';
}

/**
 * Compute confidence for a factor from its pack data.
 * BUG FIX: Previously used data_quality_score thresholds that were too strict.
 * Failed packs return 0.1 which should be L, but non-failed packs with evidence
 * shouldn't be penalized as harshly.
 * Also: if the factor has actual evidence (non-default), bump confidence floor.
 */
function getFactorConfidence(packData: DataPack | undefined, factorId: FactorId): Confidence {
  if (!packData) return 'L';
  const input = packData.factor_inputs[factorId];
  if (!input) return 'L';
  if (packData.v2_stub) return 'L';

  // Check if this is a fallback/failed state
  const evidenceSummary = input.evidence_summary || '';
  const isFallback = (
    evidenceSummary.includes('Pack failed after') ||
    evidenceSummary.includes('No evidence collected') ||
    evidenceSummary.includes('defaulting to neutral')
  );
  if (isFallback) return 'L';

  // If we have actual evidence text, use data_quality_score with more lenient thresholds
  // data_quality_score > 0.6 → H, > 0.25 → M, else L
  // This prevents LOW confidence from cascading and downgrading GO dispositions
  // when we have real (if imperfect) evidence.
  if (packData.data_quality_score > 0.6) return 'H';
  if (packData.data_quality_score > 0.25) return 'M';
  return 'L';
}

/**
 * Build narrative lean-in reasons — full sentences, not truncated fragments.
 * Picks the most compelling positive signals and writes them as investment bullets.
 */
function getLeanInReasons(
  _factorScores: FactorScore[],
  riskScores: FactorScore[],
  readinessScores: FactorScore[]
): string[] {
  const reasons: string[] = [];

  // Strongest readiness factors (readiness >= 70 = good) — most compelling investment positives
  const strongReadiness = readinessScores
    .filter(f => f.raw_score >= 70 && !f.evidence_summary.includes('No evidence') && !f.evidence_summary.includes('Pack failed'))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 3);

  for (const f of strongReadiness) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    const grade = f.letter_grade;
    reasons.push(`${f.factor_name} [${grade}] — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  // Lowest risk factors (risk < 35 = well-protected) — structural moats
  const lowRisk = riskScores
    .filter(f => f.raw_score < 35 && !f.evidence_summary.includes('No evidence') && !f.evidence_summary.includes('Pack failed'))
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);

  for (const f of lowRisk) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`Low ${f.factor_name} risk — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  return reasons.slice(0, 4);
}

/**
 * Build narrative hesitate reasons — full sentences with context.
 * Focuses on the highest-risk and lowest-readiness factors.
 */
function getHesitateReasons(
  riskScores: FactorScore[],
  readinessScores: FactorScore[]
): string[] {
  const reasons: string[] = [];

  // Highest risk factors (risk > 60 = danger) — investment killers
  const highRisk = riskScores
    .filter(f => f.raw_score > 60 && !f.evidence_summary.includes('No evidence') && !f.evidence_summary.includes('Pack failed'))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 3);

  for (const f of highRisk) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    const grade = f.letter_grade;
    reasons.push(`${f.factor_name} elevated [${grade}/${f.raw_score}] — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  // Critical gaps in readiness (readiness <= 40) — execution blockers
  const criticalReadiness = readinessScores
    .filter(f => f.is_critical_gap && !f.evidence_summary.includes('No evidence') && !f.evidence_summary.includes('Pack failed'))
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);

  for (const f of criticalReadiness) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`Critical gap: ${f.factor_name} [${f.raw_score}/100] — ${summary.length > 180 ? summary.slice(0, 180) + '…' : summary}`);
  }

  return reasons.slice(0, 4);
}

/**
 * Validate signal_strength: clamp to [0,1] and guard against NaN/null.
 */
function safeSignal(signal: number | undefined | null): number {
  if (signal === undefined || signal === null || isNaN(signal)) return 0.5;
  return Math.max(0, Math.min(1, signal));
}

export function computeScoreBundle(
  dataPacks: Partial<Record<PackName, DataPack>>
): ScoreBundle {
  const factorScores: FactorScore[] = [];

  // ─── Score each Risk Factor ──────────────────────────────────────────────
  for (const factorId of RISK_FACTOR_IDS) {
    const packName = DEFAULT_PACK_FOR_FACTOR[factorId];
    const pack = dataPacks[packName];
    const input = pack?.factor_inputs[factorId];
    // BUG FIX: use safeSignal to guard NaN/null/undefined
    const signal = safeSignal(input?.signal_strength ?? 0.5);
    const evidence = input?.evidence_summary ?? 'No evidence collected — defaulting to neutral';
    const rubricResult = applyRubric(factorId, signal, evidence);
    const confidence = getFactorConfidence(pack, factorId);

    factorScores.push({
      factor_id: factorId,
      factor_name: FACTOR_NAMES[factorId],
      weight: RISK_WEIGHTS[factorId],
      raw_score: rubricResult.score,
      weighted_contribution: rubricResult.score * RISK_WEIGHTS[factorId],
      letter_grade: scoreToGrade(100 - rubricResult.score), // Invert: low risk = good grade
      confidence,
      evidence_summary: evidence,
      is_critical_gap: false, // Risk factors don't have critical gaps
      pack_source: packName,
      rubric_applied: rubricResult.rubric_applied,
    });
  }

  // ─── Score each Readiness Factor ─────────────────────────────────────────
  for (const factorId of READINESS_FACTOR_IDS) {
    const packName = DEFAULT_PACK_FOR_FACTOR[factorId];
    const pack = dataPacks[packName];
    const input = pack?.factor_inputs[factorId];
    // BUG FIX: use safeSignal
    const signal = safeSignal(input?.signal_strength ?? 0.5);
    const evidence = input?.evidence_summary ?? 'No evidence collected — defaulting to neutral';
    const rubricResult = applyRubric(factorId, signal, evidence);
    const confidence = getFactorConfidence(pack, factorId);
    const isCriticalGap = rubricResult.score <= 40;

    factorScores.push({
      factor_id: factorId,
      factor_name: FACTOR_NAMES[factorId],
      weight: READINESS_WEIGHTS[factorId],
      raw_score: rubricResult.score,
      weighted_contribution: rubricResult.score * READINESS_WEIGHTS[factorId],
      letter_grade: scoreToGrade(rubricResult.score),
      confidence,
      evidence_summary: evidence,
      is_critical_gap: isCriticalGap,
      pack_source: packName,
      rubric_applied: rubricResult.rubric_applied,
    });
  }

  // ─── Compute Weighted Scores ─────────────────────────────────────────────
  const riskFactorScores = factorScores.filter(f => RISK_FACTOR_IDS.includes(f.factor_id as any));
  const readinessFactorScores = factorScores.filter(f => READINESS_FACTOR_IDS.includes(f.factor_id as any));

  const riskScore = riskFactorScores.reduce((sum, f) => sum + f.weighted_contribution, 0);
  const readinessScore = readinessFactorScores.reduce((sum, f) => sum + f.weighted_contribution, 0);

  // Overall score: invert risk (lower risk = higher contribution) + readiness
  const overallScore = ((100 - riskScore) + readinessScore) / 2;

  // ─── Critical Gaps (readiness factors scoring ≤ 40) ─────────────────────
  const criticalGaps = readinessFactorScores
    .filter(f => f.is_critical_gap)
    .map(f => f.factor_id);

  // ─── Confidence Aggregation ───────────────────────────────────────────────
  // BUG FIX: Don't let a single L-confidence factor (e.g. the low-weight A9 Leadership)
  // collapse overall confidence to L when most factors have real evidence.
  // Use a majority-vote approach: H if >60% H, L only if >50% L, else M.
  const allConfidences = factorScores.map(f => f.confidence);
  const hCount = allConfidences.filter(c => c === 'H').length;
  const lCount = allConfidences.filter(c => c === 'L').length;
  const total = allConfidences.length;
  let confidenceOverall: Confidence;
  if (hCount / total > 0.6) {
    confidenceOverall = 'H';
  } else if (lCount / total > 0.5) {
    confidenceOverall = 'L';
  } else {
    confidenceOverall = 'M';
  }

  // ─── Quadrant & Disposition ───────────────────────────────────────────────
  const quadrant = getQuadrant(riskScore, readinessScore);
  const disposition = getDisposition(quadrant, criticalGaps, confidenceOverall);

  const leanInReasons = getLeanInReasons(factorScores, riskFactorScores, readinessFactorScores);
  const hesitateReasons = getHesitateReasons(riskFactorScores, readinessFactorScores);

  return {
    risk_score: Math.round(riskScore * 10) / 10,
    readiness_score: Math.round(readinessScore * 10) / 10,
    overall_score: Math.round(overallScore * 10) / 10,
    risk_grade: scoreToGrade(100 - riskScore), // Invert: low risk = high grade
    readiness_grade: scoreToGrade(readinessScore),
    overall_grade: scoreToGrade(overallScore),
    quadrant,
    disposition,
    confidence_overall: confidenceOverall,
    critical_gaps: criticalGaps,
    factor_scores: factorScores,
    lean_in_reasons: leanInReasons,
    hesitate_reasons: hesitateReasons,
    computed_at: new Date().toISOString(),
  };
}
