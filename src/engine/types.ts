// Eagle Vision Screener — Core Type Definitions

export type Disposition = 'GO' | 'MAYBE' | 'NO-GO';
export type Quadrant = 'EXECUTE' | 'RACE_MODE' | 'BUILD_MODE' | 'DANGER_ZONE';
export type Confidence = 'H' | 'M' | 'L';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type PackStatus = 'queued' | 'running' | 'complete' | 'failed' | 'stubbed';
export type ScreeningStatus = 'idle' | 'running' | 'complete' | 'failed' | 'aborted';
export type SourceType = 'crawl' | 'search' | 'api' | 'upload';
export type DomainTier = 'tier1' | 'tier2' | 'tier3';

// ─── Risk Factor IDs ─────────────────────────────────────────────────────────
export type RiskFactorId =
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

// ─── Readiness Factor IDs ────────────────────────────────────────────────────
export type ReadinessFactorId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9';

export type FactorId = RiskFactorId | ReadinessFactorId;

// ─── Factor Names ─────────────────────────────────────────────────────────────
export const FACTOR_NAMES: Record<FactorId, string> = {
  R1: 'Competitive Window',
  R2: 'AI-Native Entrant Threat',
  R3: 'Incumbent AI Posture',
  R4: 'Horizontal AI Encroachment',
  R5: 'Customer Switching Propensity',
  R6: 'Regulatory Moat Durability',
  R7: 'Market Timing Risk',
  A1: 'Workflow Embeddedness',
  A2: 'Data Foundation & Quality',
  A3: 'Outcome-Labeled Data',
  A4: 'Value Quantification',
  A5: 'Pricing Model Flexibility',
  A6: 'AI/ML Team Capability',
  A7: 'Architecture Readiness',
  A8: 'Compounding Loop Potential',
  A9: 'Leadership AI Clarity',
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
  raw_score: number;      // 0–100
  weighted_contribution: number;
  letter_grade: LetterGrade;
  confidence: Confidence;
  evidence_summary: string;
  is_critical_gap: boolean;
  pack_source: PackName;
  rubric_applied: string;
}

// ─── Score Bundle ─────────────────────────────────────────────────────────────
export interface ScoreBundle {
  risk_score: number;       // 0–100 weighted roll-up
  readiness_score: number;  // 0–100 weighted roll-up
  overall_score: number;    // Average of risk inverse + readiness
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
  honesty_flag?: boolean; // true if screening was partial/aborted
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
  quadrant?: Quadrant;
}
