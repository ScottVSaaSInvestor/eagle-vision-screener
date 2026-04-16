import type { FactorId, RiskFactorId, ReadinessFactorId } from '../types';

// AI Risk weights (sum = 1.0)
export const RISK_WEIGHTS: Record<RiskFactorId, number> = {
  R1: 0.18, // Competitive Window
  R2: 0.16, // AI-Native Entrant Threat
  R3: 0.15, // Incumbent AI Posture
  R4: 0.16, // Horizontal AI Encroachment
  R5: 0.14, // Customer Switching Propensity
  R6: 0.11, // Regulatory Moat Durability
  R7: 0.10, // Market Timing Risk
};

// AI Readiness weights (sum = 1.0)
export const READINESS_WEIGHTS: Record<ReadinessFactorId, number> = {
  A1: 0.18, // Workflow Embeddedness
  A2: 0.18, // Data Foundation & Quality
  A3: 0.14, // Outcome-Labeled Data
  A4: 0.12, // Value Quantification
  A5: 0.05, // Pricing Model Flexibility
  A6: 0.12, // AI/ML Team Capability
  A7: 0.10, // Architecture Readiness
  A8: 0.08, // Compounding Loop Potential
  A9: 0.03, // Leadership AI Clarity
};

export const ALL_WEIGHTS: Record<FactorId, number> = {
  ...RISK_WEIGHTS,
  ...READINESS_WEIGHTS,
};

export const RISK_FACTOR_IDS: RiskFactorId[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
export const READINESS_FACTOR_IDS: ReadinessFactorId[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
