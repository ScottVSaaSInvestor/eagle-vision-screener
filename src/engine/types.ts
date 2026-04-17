// Eagle Vision Screener — Core Type Definitions

export type Disposition = 'GO' | 'MAYBE' | 'NO-GO';
export type Quadrant = 'EXECUTE' | 'RACE_MODE' | 'BUILD_MODE' | 'DANGER_ZONE';
export type Confidence = 'H' | 'M' | 'L';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type PackStatus = 'queued' | 'running' | 'complete' | 'failed' | 'stubbed';
export type ScreeningStatus = 'idle' | 'running' | 'complete' | 'failed' | 'aborted';
export type SourceType = 'crawl' | 'search' | 'api' | 'upload';
export type DomainTier = 'tier1' | 'tier2' | 'tier3';

// AI Readiness Stage — where is the company on the SOR→SOA journey?
export type ReadinessStage = 1 | 2 | 3 | 4;
export type ThreatLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

// ─── Risk Factor IDs ─────────────────────────────────────────────────────────
export type RiskFactorId =
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

// ─── Readiness Factor IDs ────────────────────────────────────────────────────
export type ReadinessFactorId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10';

export type FactorId = RiskFactorId | ReadinessFactorId;

// ─── Factor Names — ALL HIGH = GOOD framing ──────────────────────────────────
// Risk factors renamed to reflect what HIGH score means = MORE THREAT
// Readiness factors: HIGH = MORE READY
export const FACTOR_NAMES: Record<FactorId, string> = {
  // Risk factors — high score = high threat
  R1: 'Competitive Window Closing',
  R2: 'AI-Native Entrant Threat',
  R3: 'Incumbent AI Advancement',
  R4: 'Horizontal AI Displacement Risk',
  R5: 'Customer Churn Vulnerability',
  R6: 'Regulatory Moat Erosion',
  R7: 'Market Timing Risk',
  // Readiness factors — high score = high readiness
  A1: 'Workflow Embeddedness',
  A2: 'Data Foundation & Quality',
  A3: 'Outcome-Labeled Data',
  A4: 'Value Quantification',
  A5: 'Pricing Model Flexibility',
  A6: 'AI/ML Team Capability',
  A7: 'Architecture Readiness',
  A8: 'Data Compounding Loop',
  A9: 'Leadership AI Conviction',
  A10: 'SOR→SOA Transition Path',
};

// Human-readable descriptions of what each factor measures
export const FACTOR_DESCRIPTIONS: Record<FactorId, string> = {
  R1: 'How much time remains before AI-native competitors or incumbent AI deployments close the investment window.',
  R2: 'Degree of threat from well-funded AI-native startups targeting this vertical.',
  R3: 'How aggressively incumbents with overlapping markets are deploying AI features.',
  R4: 'Risk that horizontal AI tools (OpenAI, Microsoft Copilot) displace the vertical SaaS entirely.',
  R5: 'How easy it is for customers to leave this platform for a competitor.',
  R6: 'Risk that regulatory requirements erode or become easily replicated by AI tools.',
  R7: 'Whether market timing is favorable — not too early, not too late, not over-funded.',
  A1: 'How deeply embedded the software is in daily critical workflows — mission-critical SOR scores highest.',
  A2: 'Quality, depth, and longevity of proprietary data accumulated on the platform.',
  A3: 'Whether the platform captures outcomes and results, not just activity — enables AI training.',
  A4: 'How well the company quantifies and proves the ROI it delivers to customers.',
  A5: 'Ability to move toward usage-based or outcome-based pricing as AI value increases.',
  A6: 'Size and strength of the AI/ML team — includes shipped AI features, not just credentials.',
  A7: 'How modern and AI-ready the technical architecture is — cloud-native, API-first, ML infrastructure.',
  A8: 'Whether more platform usage creates better data that improves the product for all customers.',
  A9: 'CEO and leadership team\'s demonstrated AI conviction — actions, not just words.',
  A10: 'Clarity and credibility of the path from System of Record to System of Action — the core PE value creation thesis.',
};

// ─── Pack Names ───────────────────────────────────────────────────────────────
export type PackName =
  | 'company_profile'
  | 'competitive_landscape'
  | 'workflow_product'
  | 'data_architecture'
  | 'team_capability'
  | 'regulatory_moat'
  | 'market_timing';

// ─── Evidence Item ────────────────────────────────────────────────────────────
export interface EvidenceItem {
  id: string;
  source: string;
  url: string;
  type: SourceType;
  domain_tier: DomainTier;
  pack_associations: PackName[];
  fetched_at: string;
  excerpt: string;
  confidence: Confidence;
}

// ─── Data Pack Finding ───────────────────────────────────────────────────────
export interface PackFinding {
  key: string;
  value: unknown;
  confidence: Confidence;
  sources: string[];
  unknowns: string[];
}

// ─── Factor Input from Pack ───────────────────────────────────────────────────
export interface FactorInput {
  evidence_summary: string;
  signal_strength: number; // 0.0–1.0
}

// ─── Data Pack ───────────────────────────────────────────────────────────────
export interface DataPack {
  pack_name: PackName;
  pack_version: string;
  generated_at: string;
  data_quality_score: number; // 0.0–1.0
  findings: PackFinding[];
  factor_inputs: Partial<Record<FactorId, FactorInput>>;
  red_flags: string[];
  green_flags?: string[];
  v2_stub: boolean;
  status: PackStatus;
  error?: string;
}

// ─── Individual Factor Score ──────────────────────────────────────────────────
export interface FactorScore {
  factor_id: FactorId;
  factor_name: string;
  weight: number;
  raw_score: number;      // 0–100, always HIGH = GOOD for display
  display_score: number;  // same as raw_score — unified HIGH=GOOD scale
  weighted_contribution: number;
  letter_grade: LetterGrade;
  confidence: Confidence;
  evidence_summary: string;
  is_critical_gap: boolean;
  pack_source: PackName;
  rubric_applied: string;
  is_risk_factor: boolean; // true = R factor, false = A factor
}

// ─── AI Readiness Stage Assessment ───────────────────────────────────────────
export interface StageAssessment {
  stage: ReadinessStage;
  stage_label: string;       // e.g. "Stage 2: AI-Enabled"
  stage_description: string; // what this stage means
  evidence_for_stage: string[];   // what qualifies them for this stage
  gaps_to_next_stage: string[];   // what's needed to reach next stage
  hold_period_achievable: boolean; // can they reach Stage 3 in 3-5yr hold?
}

// ─── Score Bundle ─────────────────────────────────────────────────────────────
export interface ScoreBundle {
  risk_score: number;       // 0–100, LOWER = SAFER (internal only)
  readiness_score: number;  // 0–100, HIGHER = MORE READY
  threat_level: ThreatLevel; // derived from risk_score — the GO/NO-GO signal
  readiness_stage: ReadinessStage; // 1-4 stage on SOR→SOA journey
  stage_assessment: StageAssessment;
  // Legacy fields kept for compatibility
  overall_score: number;
  risk_grade: LetterGrade;
  readiness_grade: LetterGrade;
  overall_grade: LetterGrade;
  quadrant: Quadrant;
  disposition: Disposition;
  confidence_overall: Confidence;
  critical_gaps: FactorId[];
  factor_scores: FactorScore[];
  lean_in_reasons: string[];
  hesitate_reasons: string[];
  what_to_fix: string[];    // roadmap items — gaps to bridge to next stage
  computed_at: string;
}

// ─── Diligence Focus Area ─────────────────────────────────────────────────────
export interface DiligenceFocusArea {
  rank: number;
  title: string;
  why_it_matters: string;
  what_to_test: string;
  evidence_to_request: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Upgrade/Break Conditions ─────────────────────────────────────────────────
export interface UpgradeBreakConditions {
  upgrade_to_go: string[];
  keep_maybe: string[];
  drop_to_nogo: string[];
}

// ─── Competitive Intelligence ─────────────────────────────────────────────────
export interface AIEntrant {
  company: string;
  founded?: number;
  stage?: string;
  last_raise?: string;
  traction_signal?: string;
  threat_level: 'HIGH' | 'MEDIUM' | 'LOW';
  url?: string;
}

export interface IncumbentPosture {
  company: string;
  status: 'ACTIVE' | 'SIGNALING' | 'SILENT';
  evidence: string;
  url?: string;
}

// ─── Screening Inputs ─────────────────────────────────────────────────────────
export interface ScreeningInputs {
  company_name: string;
  company_url: string;
  vertical?: string;
  competitor_hints: string[];
  confidence_threshold: number;
  use_cached_heat_index: boolean;
  documents: UploadedDocument[];
}

export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
  text_content?: string;
}

// ─── Partner Dispute / Note ───────────────────────────────────────────────────
export interface PartnerNote {
  factor_id: FactorId;
  note: string;
  created_at: string;
  partner_name?: string;
}

// ─── Full Screening Record ────────────────────────────────────────────────────
export interface ScreeningRecord {
  job_id: string;
  created_at: string;
  completed_at?: string;
  status: ScreeningStatus;
  inputs: ScreeningInputs;
  score_bundle?: ScoreBundle;
  data_packs: Partial<Record<PackName, DataPack>>;
  evidence_log: EvidenceItem[];
  disputes: PartnerNote[];
  confidence_overall: Confidence;
  honesty_flag?: boolean;
  detected_vertical?: string;
  diligence_areas?: DiligenceFocusArea[];
  upgrade_break_conditions?: UpgradeBreakConditions;
}

// ─── Progress Event ───────────────────────────────────────────────────────────
export interface ProgressEvent {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  pack?: PackName;
}

// ─── Archive Entry (lightweight) ─────────────────────────────────────────────
export interface ArchiveEntry {
  job_id: string;
  created_at: string;
  company_name: string;
  company_url: string;
  vertical?: string;
  overall_grade?: LetterGrade;
  disposition?: Disposition;
  confidence_overall: Confidence;
  status: ScreeningStatus;
  risk_score?: number;
  readiness_score?: number;
  threat_level?: ThreatLevel;
  readiness_stage?: ReadinessStage;
  quadrant?: Quadrant;
}
