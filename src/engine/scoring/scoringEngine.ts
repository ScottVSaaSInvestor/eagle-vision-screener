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
    // Downgrade GO to MAYBE if confidence is LOW
    if (confidenceOverall === 'L') return 'MAYBE';
    return 'GO';
  }
  return 'MAYBE';
}

function getFactorConfidence(packData: DataPack | undefined, factorId: FactorId): Confidence {
  if (!packData) return 'L';
  const input = packData.factor_inputs[factorId];
  if (!input) return 'L';
  if (packData.v2_stub) return 'L';
  if (packData.data_quality_score > 0.7) return 'H';
  if (packData.data_quality_score > 0.4) return 'M';
  return 'L';
}

function getLeanInReasons(factorScores: FactorScore[], riskScores: FactorScore[], readinessScores: FactorScore[]): string[] {
  const reasons: string[] = [];
  // Low risk factors (risk < 40 = good)
  const lowRiskFactors = riskScores
    .filter(f => f.raw_score < 40)
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);
  lowRiskFactors.forEach(f => {
    if (f.evidence_summary) reasons.push(`Low ${f.factor_name} risk: ${f.evidence_summary.slice(0, 80)}...`);
  });
  // High readiness factors (readiness >= 70 = good)
  const highReadinessFactors = readinessScores
    .filter(f => f.raw_score >= 70)
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 2);
  highReadinessFactors.forEach(f => {
    if (f.evidence_summary) reasons.push(`Strong ${f.factor_name}: ${f.evidence_summary.slice(0, 80)}...`);
  });
  return reasons.slice(0, 3);
}

function getHesitateReasons(riskScores: FactorScore[], readinessScores: FactorScore[]): string[] {
  const reasons: string[] = [];
  // High risk factors (risk > 65 = bad)
  const highRiskFactors = riskScores
    .filter(f => f.raw_score > 65)
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 2);
  highRiskFactors.forEach(f => {
    if (f.evidence_summary) reasons.push(`Elevated ${f.factor_name}: ${f.evidence_summary.slice(0, 80)}...`);
  });
  // Low readiness factors (readiness < 50 = bad)
  const lowReadinessFactors = readinessScores
    .filter(f => f.raw_score < 50)
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);
  lowReadinessFactors.forEach(f => {
    if (f.evidence_summary) reasons.push(`Weak ${f.factor_name}: ${f.evidence_summary.slice(0, 80)}...`);
  });
  return reasons.slice(0, 3);
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
    const signal = input?.signal_strength ?? 0.5;
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
    const signal = input?.signal_strength ?? 0.5;
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
  const allConfidences = factorScores.map(f => f.confidence);
  const confidenceOverall = aggregateConfidence(allConfidences);

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
