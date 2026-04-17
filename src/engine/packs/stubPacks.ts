/**
 * V1 Stub Packs — Return structural templates with LOW confidence
 * Full implementation scheduled for V2
 */

import type { DataPack } from '../types';

export function createWorkflowProductStub(companyName: string): DataPack {
  return {
    pack_name: 'workflow_product',
    pack_version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality_score: 0.0,
    findings: [
      {
        key: 'v2_note',
        value: 'Full Workflow & Product analysis requires deep product interviews and customer discovery. Full implementation scheduled for V2.',
        confidence: 'L',
        sources: [],
        unknowns: ['Workflow integration depth', 'Daily active usage patterns', 'Feature stickiness', 'NPS and retention data'],
      },
    ],
    factor_inputs: {
      R5: {
        evidence_summary: 'V1 stub — Customer switching propensity analysis requires workflow depth assessment. Defaulting to neutral.',
        signal_strength: 0.5,
      },
      A1: {
        evidence_summary: 'V1 stub — Workflow Embeddedness requires product usage data and customer interviews. Defaulting to neutral.',
        signal_strength: 0.5,
      },
      A4: {
        evidence_summary: 'V1 stub — Value Quantification requires customer ROI case studies and usage analytics. Defaulting to neutral.',
        signal_strength: 0.5,
      },
    },
    red_flags: [],
    green_flags: [],
    v2_stub: true,
    status: 'stubbed',
  };
}

export function createDataArchitectureStub(companyName: string): DataPack {
  return {
    pack_name: 'data_architecture',
    pack_version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality_score: 0.0,
    findings: [
      {
        key: 'v2_note',
        value: 'Full Data & Architecture analysis requires technical due diligence, architecture review, and data team interviews. Full implementation scheduled for V2.',
        confidence: 'L',
        sources: [],
        unknowns: ['Data infrastructure stack', 'Data warehouse architecture', 'ML pipeline maturity', 'Data governance practices'],
      },
    ],
    factor_inputs: {
      A2: {
        evidence_summary: 'V1 stub — Data Foundation & Quality assessment requires technical deep-dive. Defaulting to neutral.',
        signal_strength: 0.5,
      },
      A3: {
        evidence_summary: 'V1 stub — Outcome-Labeled Data assessment requires access to data documentation. Defaulting to neutral.',
        signal_strength: 0.5,
      },
      A7: {
        evidence_summary: 'V1 stub — Architecture Readiness requires codebase and infrastructure review. Defaulting to neutral.',
        signal_strength: 0.5,
      },
    },
    red_flags: [],
    green_flags: [],
    v2_stub: true,
    status: 'stubbed',
  };
}

export function createMarketTimingStub(companyName: string): DataPack {
  return {
    pack_name: 'market_timing',
    pack_version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality_score: 0.0,
    findings: [
      {
        key: 'v2_note',
        value: 'Full Market & Timing analysis requires vertical-specific market sizing, comparable analysis, and investment activity mapping. Full implementation scheduled for V2.',
        confidence: 'L',
        sources: [],
        unknowns: ['Total addressable market size', 'Market growth rate', 'Comparable deal valuations', 'Investor sentiment trends', 'Macro headwinds/tailwinds'],
      },
    ],
    factor_inputs: {
      R7: {
        evidence_summary: 'V1 stub — Market Timing Risk assessment requires full vertical market analysis. Defaulting to neutral.',
        signal_strength: 0.5,
      },
    },
    red_flags: [],
    green_flags: [],
    v2_stub: true,
    status: 'stubbed',
  };
}
