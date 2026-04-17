/**
 * Perch Scoring Engine — V18
 * DETERMINISTIC — No LLM calls. LLMs produce evidence. This code produces scores.
 *
 * V18 REDESIGN:
 * - Journey framing: every output is instructive, not a verdict
 * - Disposition: ADVANCE (strong signal, go now) | DILIGENCE (real opportunity, here's what to resolve) | PASS (extreme risk + zero foundation — rare)
 * - PASS only when riskScore >= 80 AND readinessScore < 25 simultaneously
 * - DILIGENCE replaces MAYBE — it's actionable, not ambiguous
 * - what_to_fix: roadmap to reach Stage 3 (AI-Native) in the hold period
 */

import type {
  DataPack, FactorId, FactorScore, ScoreBundle, StageAssessment,
  LetterGrade, Disposition, Quadrant, Confidence, ThreatLevel, ReadinessStage,
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
  A10: 'workflow_product',  // SOR→SOA Path — workflow pack has the most relevant evidence
};

function scoreToGrade(score: number): LetterGrade {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

/**
 * Convert risk score (0-100, higher = more threat) → ThreatLevel label.
 * These thresholds are calibrated for PE/growth-equity investment decisions.
 */
function getThreatLevel(riskScore: number): ThreatLevel {
  if (riskScore < 30) return 'LOW';
  if (riskScore < 50) return 'MODERATE';
  if (riskScore < 70) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Convert readiness score (0-100, higher = more ready) → Stage (1-4).
 *
 * Stage 1: Data Foundation — owns workflow, accumulating data, no AI yet
 * Stage 2: AI-Enabled — shipped AI features, early team, clear roadmap
 * Stage 3: AI-Native — AI is core to product, drives measurable outcomes
 * Stage 4: System of Action — autonomous workflows, outcome-based pricing dominant
 *
 * A PE buyer at Stage 1-2 is buying the BUILD thesis.
 * A PE buyer at Stage 3+ is buying an already-valuable AI asset.
 */
function getReadinessStage(readinessScore: number): ReadinessStage {
  if (readinessScore < 40) return 1;
  if (readinessScore < 58) return 2;
  if (readinessScore < 75) return 3;
  return 4;
}

function buildStageAssessment(
  stage: ReadinessStage,
  readinessFactors: FactorScore[]
): StageAssessment {
  const STAGE_LABELS: Record<ReadinessStage, string> = {
    1: 'Stage 1: Data Foundation',
    2: 'Stage 2: AI-Enabled',
    3: 'Stage 3: AI-Native',
    4: 'Stage 4: System of Action',
  };
  const STAGE_DESCRIPTIONS: Record<ReadinessStage, string> = {
    1: 'The company owns the core operational workflow and is accumulating longitudinal data, but has not yet shipped meaningful AI features. The investment thesis is: own the SOR, build the AI layer.',
    2: 'The company has shipped early AI features, is assembling an AI team, and has a credible roadmap. The data foundation is in place. The investment thesis is: accelerate the AI roadmap and drive to Stage 3 in the hold period.',
    3: 'AI is core to the product — it drives measurable operational outcomes for customers. The data flywheel is visible. The investment thesis is: scale the AI advantage and evolve toward outcome-based pricing.',
    4: 'The company has reached System of Action maturity — autonomous workflow execution, outcome-based pricing, self-improving models. The investment thesis is: protect and extend the moat.',
  };

  // Evidence for current stage — factors scoring above 60
  const evidenceForStage: string[] = readinessFactors
    .filter(f => f.raw_score >= 60 && f.evidence_summary &&
      !f.evidence_summary.includes('No evidence') && !f.evidence_summary.includes('defaulting'))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 4)
    .map(f => `${f.factor_name} (${f.raw_score}/100): ${f.evidence_summary.slice(0, 120)}${f.evidence_summary.length > 120 ? '…' : ''}`);

  // Gaps to next stage — lowest-scoring factors
  const gapsToNextStage: string[] = readinessFactors
    .filter(f => f.raw_score < 60)
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 4)
    .map(f => {
      const gapLabel = f.raw_score < 40 ? '⚡ CRITICAL' : '⚠ NEEDS WORK';
      return `${gapLabel} — ${f.factor_name} (${f.raw_score}/100)`;
    });

  // Hold period achievable: can they reach Stage 3 in 3-5yr?
  // Not achievable only if at Stage 1 with multiple critical gaps AND high threat
  const criticalGapCount = readinessFactors.filter(f => f.raw_score < 40).length;
  const holdPeriodAchievable = !(stage === 1 && criticalGapCount >= 4);

  return {
    stage,
    stage_label: STAGE_LABELS[stage],
    stage_description: STAGE_DESCRIPTIONS[stage],
    evidence_for_stage: evidenceForStage,
    gaps_to_next_stage: gapsToNextStage,
    hold_period_achievable: holdPeriodAchievable,
  };
}

function getQuadrant(riskScore: number, readinessScore: number): Quadrant {
  const highRisk = riskScore >= 50;
  const highReadiness = readinessScore >= 50;
  if (!highRisk && highReadiness) return 'EXECUTE';
  if (highRisk && highReadiness) return 'RACE_MODE';
  if (!highRisk && !highReadiness) return 'BUILD_MODE';
  return 'DANGER_ZONE';
}

/**
 * V18 Disposition Logic — journey framing, not verdict framing.
 *
 * PHILOSOPHY: Perch is a fast-pass screener used at top-of-funnel, before management
 * meetings or data room access. At this stage, almost every company either:
 *   ADVANCE  → Strong enough signal to take to the next stage of diligence immediately
 *   DILIGENCE → Real opportunity with specific open questions — here's exactly what to resolve
 *
 * PASS is reserved for structurally broken cases only:
 *   - AI risk is extreme (riskScore >= 80) AND readiness is critically low (readinessScore < 25)
 *     → the competitive window has already closed AND the company has no foundation to recover
 *   This is genuinely rare and requires both conditions simultaneously.
 *
 * Everything else — including DANGER_ZONE — goes to DILIGENCE with a specific plan.
 * A DANGER_ZONE company with Stage 2 readiness is not a pass; it's a focused diligence question.
 */
function getDisposition(
  quadrant: Quadrant,
  threatLevel: ThreatLevel,
  stage: ReadinessStage,
  criticalGaps: FactorId[],
  readinessFactors: FactorScore[],
  confidenceOverall: Confidence,
  riskScore: number,
  readinessScore: number
): Disposition {

  // PASS: only when AI risk is extreme AND readiness is structurally unrecoverable
  // This means: threat window has already closed (risk 80+) AND company has almost no foundation (readiness <25)
  // Both conditions must be true simultaneously — either alone is not enough to PASS
  const extremeRisk = riskScore >= 80;
  const criticallyLowReadiness = readinessScore < 25;
  if (extremeRisk && criticallyLowReadiness) return 'PASS';

  // ADVANCE: strong signal — move to full diligence now
  // EXECUTE or RACE_MODE with solid readiness foundation and no extreme risk
  if (quadrant === 'EXECUTE' && criticalGaps.length <= 2) return 'ADVANCE';
  if (quadrant === 'RACE_MODE' && stage >= 2 && criticalGaps.length <= 2 && threatLevel !== 'CRITICAL') return 'ADVANCE';
  if (quadrant === 'BUILD_MODE' && stage >= 2 && criticalGaps.length <= 2) return 'ADVANCE';

  // Everything else: DILIGENCE — there's a thesis here, here's what to resolve
  // DANGER_ZONE, high gap counts, low confidence, CRITICAL threat — all go to DILIGENCE not PASS
  return 'DILIGENCE';
}

/**
 * Compute confidence for a factor from its pack data.
 */
function getFactorConfidence(packData: DataPack | undefined, factorId: FactorId): Confidence {
  if (!packData) return 'L';
  const input = packData.factor_inputs[factorId];
  if (!input) return 'L';
  if (packData.v2_stub) return 'L';

  const evidenceSummary = input.evidence_summary || '';
  const isFallback = (
    evidenceSummary.includes('Pack failed after') ||
    evidenceSummary.includes('No evidence collected') ||
    evidenceSummary.includes('defaulting to neutral')
  );
  if (isFallback) return 'L';

  if (packData.data_quality_score > 0.6) return 'H';
  if (packData.data_quality_score > 0.25) return 'M';
  return 'L';
}

/**
 * Build Investment Positives — things that make this a compelling opportunity.
 * For BUILD_MODE: emphasize the low-risk open window + foundation strengths.
 */
function getLeanInReasons(
  _factorScores: FactorScore[],
  riskScores: FactorScore[],
  readinessScores: FactorScore[]
): string[] {
  const reasons: string[] = [];
  const hasRealEvidence = (s: string) => s && !s.includes('No evidence') && !s.includes('Pack failed') && !s.includes('defaulting to neutral') && s.length > 20;

  // Strongest readiness factors — investment positives
  const strongReadiness = readinessScores
    .filter(f => f.raw_score >= 65 && hasRealEvidence(f.evidence_summary))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 3);

  for (const f of strongReadiness) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`${f.factor_name} [${f.raw_score}/100] — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  // Lowest risk factors — structural moats / open windows
  const lowRisk = riskScores
    .filter(f => f.raw_score < 35 && hasRealEvidence(f.evidence_summary))
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);

  for (const f of lowRisk) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`Low ${f.factor_name} risk [${f.raw_score}/100] — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  return reasons.slice(0, 4);
}

/**
 * Build Risk & Hesitation Signals.
 */
function getHesitateReasons(
  riskScores: FactorScore[],
  readinessScores: FactorScore[]
): string[] {
  const reasons: string[] = [];
  const hasRealEvidenceH = (s: string) => s && !s.includes('No evidence') && !s.includes('Pack failed') && !s.includes('defaulting to neutral') && s.length > 20;

  const highRisk = riskScores
    .filter(f => f.raw_score > 55 && hasRealEvidenceH(f.evidence_summary))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 2);

  for (const f of highRisk) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`${f.factor_name} elevated [${f.raw_score}/100] — ${summary.length > 200 ? summary.slice(0, 200) + '…' : summary}`);
  }

  // Critical gaps in readiness — execution blockers
  const criticalReadiness = readinessScores
    .filter(f => f.is_critical_gap && hasRealEvidenceH(f.evidence_summary))
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 2);

  for (const f of criticalReadiness) {
    const summary = f.evidence_summary.replace(/\.\.\.$/, '').trim();
    reasons.push(`Gap: ${f.factor_name} [${f.raw_score}/100] — requires investment before AI thesis executes`);
  }

  // Fallback if nothing with real evidence
  if (reasons.length === 0) {
    const worstReadiness = [...readinessScores].sort((a, b) => a.raw_score - b.raw_score)[0];
    if (worstReadiness && worstReadiness.raw_score < 50) {
      reasons.push(`${worstReadiness.factor_name} needs validation [${worstReadiness.raw_score}/100 — gather evidence in diligence]`);
    }
  }

  return reasons.slice(0, 4);
}

/**
 * Build what_to_fix: specific roadmap items to close gaps to next stage.
 * These are the investment actions, not complaints about the company.
 */
function buildWhatToFix(
  stage: ReadinessStage,
  readinessFactors: FactorScore[],
  threatLevel: ThreatLevel
): string[] {
  const fixes: string[] = [];

  const sortedGaps = [...readinessFactors]
    .filter(f => f.raw_score < 65)
    .sort((a, b) => {
      // Weight by importance: critical gaps first, then by score
      const aScore = a.is_critical_gap ? -1000 + a.raw_score : a.raw_score;
      const bScore = b.is_critical_gap ? -1000 + b.raw_score : b.raw_score;
      return aScore - bScore;
    })
    .slice(0, 5);

  const FIX_TEMPLATES: Record<string, string> = {
    A6: 'Hire dedicated AI/ML lead and 2-3 ML engineers within 12 months post-close — execution bottleneck',
    A9: 'Align CEO on AI-first roadmap with board-level commitment and measurable milestones',
    A8: 'Instrument multi-tenant data platform to surface aggregate benchmarks and cross-customer insights',
    A3: 'Build outcome tracking layer: link EVV visits and billing events to care outcome metrics',
    A4: 'Develop quantified ROI case studies (minimum 3 with hard metrics) to support pricing evolution',
    A5: 'Pilot outcome-based or usage-based pricing module with 10% of new customers in Year 2',
    A7: 'Audit architecture for ML readiness: data pipelines, API access, model serving infrastructure',
    A10: 'Define concrete SOA roadmap: 3 specific AI use cases tied to operational outcomes + pricing impact',
    A1: 'Deepen workflow embedding: add integrations to make platform mission-critical for daily ops',
    A2: 'Implement data quality controls: audit completeness, add validation, build longitudinal tracking',
  };

  for (const gap of sortedGaps) {
    const template = FIX_TEMPLATES[gap.factor_id];
    if (template) {
      const prefix = gap.is_critical_gap ? '🔴 CRITICAL: ' : '🟡 PRIORITY: ';
      fixes.push(`${prefix}${template}`);
    }
  }

  if (threatLevel === 'MODERATE' || threatLevel === 'HIGH') {
    fixes.push('⏱ TIMING: Competitive window is open but narrowing — initiate AI roadmap within 6 months post-close');
  }

  if (stage <= 2) {
    fixes.push('📊 MILESTONE: Target Stage 3 (AI-Native) within 24-30 months — defined as: AI drives measurable customer outcomes in at least 2 core workflows');
  }

  return fixes.slice(0, 6);
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
    const signal = safeSignal(input?.signal_strength ?? 0.5);
    const evidence = input?.evidence_summary ?? 'No evidence collected — defaulting to neutral';
    const rubricResult = applyRubric(factorId, signal, evidence);
    const confidence = getFactorConfidence(pack, factorId);

    factorScores.push({
      factor_id: factorId,
      factor_name: FACTOR_NAMES[factorId],
      weight: RISK_WEIGHTS[factorId],
      raw_score: rubricResult.score,
      display_score: rubricResult.score,
      weighted_contribution: rubricResult.score * RISK_WEIGHTS[factorId],
      letter_grade: scoreToGrade(100 - rubricResult.score), // Invert: low risk = good grade
      confidence,
      evidence_summary: evidence,
      is_critical_gap: false,
      pack_source: packName,
      rubric_applied: rubricResult.rubric_applied,
      is_risk_factor: true,
    });
  }

  // ─── Score each Readiness Factor ─────────────────────────────────────────
  for (const factorId of READINESS_FACTOR_IDS) {
    const packName = DEFAULT_PACK_FOR_FACTOR[factorId];
    const pack = dataPacks[packName];
    const input = pack?.factor_inputs[factorId];
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
      display_score: rubricResult.score,
      weighted_contribution: rubricResult.score * READINESS_WEIGHTS[factorId],
      letter_grade: scoreToGrade(rubricResult.score),
      confidence,
      evidence_summary: evidence,
      is_critical_gap: isCriticalGap,
      pack_source: packName,
      rubric_applied: rubricResult.rubric_applied,
      is_risk_factor: false,
    });
  }

  // ─── Compute Weighted Scores ─────────────────────────────────────────────
  const riskFactorScores = factorScores.filter(f => RISK_FACTOR_IDS.includes(f.factor_id as any));
  const readinessFactorScores = factorScores.filter(f => READINESS_FACTOR_IDS.includes(f.factor_id as any));

  const riskScore = riskFactorScores.reduce((sum, f) => sum + f.weighted_contribution, 0);
  const readinessScore = readinessFactorScores.reduce((sum, f) => sum + f.weighted_contribution, 0);

  // Overall score: kept for legacy display but NOT the primary verdict driver
  const overallScore = ((100 - riskScore) + readinessScore) / 2;

  // ─── Critical Gaps (readiness factors scoring ≤ 40) ─────────────────────
  const criticalGaps = readinessFactorScores
    .filter(f => f.is_critical_gap)
    .map(f => f.factor_id);

  // ─── Confidence Aggregation ───────────────────────────────────────────────
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

  // ─── New V14 verdict signals ──────────────────────────────────────────────
  const threatLevel = getThreatLevel(riskScore);
  const readinessStage = getReadinessStage(readinessScore);
  const stageAssessment = buildStageAssessment(readinessStage, readinessFactorScores);
  const whatToFix = buildWhatToFix(readinessStage, readinessFactorScores, threatLevel);

  // ─── Quadrant & Disposition ───────────────────────────────────────────────
  const quadrant = getQuadrant(riskScore, readinessScore);
  const disposition = getDisposition(
    quadrant, threatLevel, readinessStage, criticalGaps, readinessFactorScores, confidenceOverall,
    riskScore, readinessScore
  );

  const leanInReasons = getLeanInReasons(factorScores, riskFactorScores, readinessFactorScores);
  const hesitateReasons = getHesitateReasons(riskFactorScores, readinessFactorScores);

  return {
    risk_score: Math.round(riskScore * 10) / 10,
    readiness_score: Math.round(readinessScore * 10) / 10,
    threat_level: threatLevel,
    readiness_stage: readinessStage,
    stage_assessment: stageAssessment,
    overall_score: Math.round(overallScore * 10) / 10,
    risk_grade: scoreToGrade(100 - riskScore),
    readiness_grade: scoreToGrade(readinessScore),
    overall_grade: scoreToGrade(overallScore),
    quadrant,
    disposition,
    confidence_overall: confidenceOverall,
    critical_gaps: criticalGaps,
    factor_scores: factorScores,
    lean_in_reasons: leanInReasons,
    hesitate_reasons: hesitateReasons,
    what_to_fix: whatToFix,
    computed_at: new Date().toISOString(),
  };
}
