import type { FactorId, RiskFactorId, ReadinessFactorId } from '../types';

// AI Risk weights (sum = 1.0)
// R1 Competitive Window carries most weight — it's the timing signal
export const RISK_WEIGHTS: Record<RiskFactorId, number> = {
  R1: 0.20, // Competitive Window Closing — most critical timing signal
  R2: 0.18, // AI-Native Entrant Threat
  R3: 0.15, // Incumbent AI Advancement — requires market overlap to score high
  R4: 0.15, // Horizontal AI Displacement Risk
  R5: 0.16, // Customer Churn Vulnerability
  R6: 0.10, // Regulatory Moat Erosion
  R7: 0.06, // Market Timing Risk — least actionable, lowest weight
};

// AI Readiness weights (sum = 1.0)
// A1+A2+A10 are the core SOR→SOA thesis — highest weights
export const READINESS_WEIGHTS: Record<ReadinessFactorId, number> = {
  A1:  0.18, // Workflow Embeddedness — SOR foundation
  A2:  0.16, // Data Foundation & Quality — fuel for AI
  A3:  0.12, // Outcome-Labeled Data — quality of fuel
  A4:  0.08, // Value Quantification
  A5:  0.05, // Pricing Model Flexibility
  A6:  0.12, // AI/ML Team Capability — can they execute?
  A7:  0.08, // Architecture Readiness
  A8:  0.08, // Data Compounding Loop
  A9:  0.03, // Leadership AI Conviction
  A10: 0.10, // SOR→SOA Transition Path — the PE thesis factor
};

export const ALL_WEIGHTS: Record<FactorId, number> = {
  ...RISK_WEIGHTS,
  ...READINESS_WEIGHTS,
};

export const RISK_FACTOR_IDS: RiskFactorId[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
export const READINESS_FACTOR_IDS: ReadinessFactorId[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
