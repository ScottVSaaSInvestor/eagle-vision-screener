import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useArchiveStore } from '@/store/archiveStore';
import { SignalChip } from '@/components/ui/SignalChip';
import { QuadrantPlot } from '@/components/ui/QuadrantPlot';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EagleIcon } from '@/components/brand/EagleIcon';
import { exportToPDF, exportToJSON } from '@/utils/export';
import type {
  ScreeningRecord, FactorScore, LetterGrade, PackName,
  ThreatLevel, ReadinessStage
} from '@/engine/types';
import { FACTOR_NAMES } from '@/engine/types';

// ─── Color Palette ────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<LetterGrade, string> = {
  A: '#1DB954', B: '#66BB6A', C: '#FFB300', D: '#F57C00', F: '#D32F2F',
};

const THREAT_COLOR: Record<ThreatLevel, string> = {
  LOW: '#1DB954',
  MODERATE: '#FFB300',
  HIGH: '#F57C00',
  CRITICAL: '#D32F2F',
};

const THREAT_BG: Record<ThreatLevel, string> = {
  LOW: 'rgba(29,185,84,0.12)',
  MODERATE: 'rgba(255,179,0,0.12)',
  HIGH: 'rgba(245,124,0,0.12)',
  CRITICAL: 'rgba(211,47,47,0.12)',
};

const STAGE_COLOR: Record<ReadinessStage, string> = {
  1: '#64748B',   // gray — foundation
  2: '#FFB300',   // amber — building
  3: '#1DB954',   // green — capable
  4: '#C5A572',   // gold — elite
};

const STAGE_ICON: Record<ReadinessStage, string> = {
  1: '🏗',
  2: '⚡',
  3: '🚀',
  4: '🦅',
};

type ReportTab = 'headline' | 'threat' | 'readiness' | 'competitive' | 'evidence' | 'diligence';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'headline', label: '🦅 Verdict' },
  { id: 'threat', label: '🛡 AI Threat Analysis' },
  { id: 'readiness', label: '📈 AI Readiness' },
  { id: 'competitive', label: '⚔️ Competitive' },
  { id: 'evidence', label: '🔎 Evidence' },
  { id: 'diligence', label: '✅ Diligence' },
];

// ─── Narrative Helpers ────────────────────────────────────────────────────────
function cleanEvidence(ev: string | undefined): string {
  if (!ev) return '';
  if (ev.includes('Pack failed') || ev.includes('No evidence collected') || ev.includes('defaulting to neutral')) return '';
  return ev.trim();
}

// ─── Verdict Narrative Builder ────────────────────────────────────────────────
function getVerdictNarrative(record: ScreeningRecord): string {
  const sb = record.score_bundle;
  if (!sb) return '';
  const co = record.inputs.company_name;
  const v = record.detected_vertical || record.inputs.vertical || 'vertical SaaS';
  const tl = sb.threat_level ?? 'MODERATE';
  const stage = sb.readiness_stage ?? 2;
  const quad = sb.quadrant;

  const QUAD_NARRATIVE: Record<string, string> = {
    BUILD_MODE: `Perch's 17-factor SOAR analysis places ${co} in BUILD MODE — the most attractive posture for a patient buyer with operational AI expertise. The AI Threat Level is ${tl} (risk score ${sb.risk_score.toFixed(0)}/100): the competitive window is open, AI-native entrants in ${v} have limited traction, and incumbents are not deploying AI aggressively in this specific segment. The company is at ${sb.stage_assessment?.stage_label ?? `Stage ${stage}`} on the SOR→SOA journey: the System of Record position is established, but the AI transformation is ahead of it, not behind it. This is not a weakness — it is the investment opportunity. The capital-and-operator question is whether the company can close the readiness gaps and reach Stage 3 (AI-Native) within a standard 3-5 year hold period. Based on available evidence, that path is credible.`,
    EXECUTE: `Perch's 17-factor SOAR analysis places ${co} in the EXECUTE quadrant — the most compelling posture for an AI-era investment. The AI Threat Level is ${tl} (risk score ${sb.risk_score.toFixed(0)}/100) and the company is at ${sb.stage_assessment?.stage_label ?? `Stage ${stage}`}: the competitive window is open and the AI foundation is in place. This is a high-conviction opportunity where timing is favorable and the key question is not whether to act, but how fast to move.`,
    RACE_MODE: `Perch's 17-factor SOAR analysis places ${co} in RACE MODE — a high-conviction thesis with a time-sensitive execution imperative. The AI Threat Level is ${tl} (risk score ${sb.risk_score.toFixed(0)}/100): AI-native entrants are active in ${v} and incumbents are deploying AI features. However, the company is at ${sb.stage_assessment?.stage_label ?? `Stage ${stage}`}, indicating the technical and organizational foundation exists to outpace these threats — provided the investment closes and the AI roadmap accelerates without delay.`,
    DANGER_ZONE: `Perch's 17-factor SOAR analysis places ${co} in the DANGER ZONE — a structurally challenging position. The AI Threat Level is ${tl} (risk score ${sb.risk_score.toFixed(0)}/100): the competitive environment in ${v} is intensifying rapidly. The company is at ${sb.stage_assessment?.stage_label ?? `Stage ${stage}`}, and the combination of elevated threat and readiness gaps compounds the risk. Investment conviction at this stage requires specific, high-confidence evidence that identified gaps can be closed before the competitive window narrows further.`,
  };

  const confText = sb.confidence_overall === 'H'
    ? ' This assessment is based on HIGH-confidence evidence across all research dimensions.'
    : sb.confidence_overall === 'M'
    ? ' Evidence confidence is MEDIUM — directionally clear, but a first management meeting would sharpen conviction materially.'
    : ' Evidence confidence is LOW — this should be treated as a preliminary directional view pending management access and data room review.';

  return `${QUAD_NARRATIVE[quad] || QUAD_NARRATIVE.BUILD_MODE}${confText}`;
}

// ─── Threat Level Narrative ───────────────────────────────────────────────────
function getThreatNarrative(record: ScreeningRecord): string {
  const sb = record.score_bundle;
  if (!sb) return '';
  const tl = sb.threat_level ?? 'MODERATE';
  const v = record.detected_vertical || record.inputs.vertical || 'this vertical';

  const NARRATIVES: Record<ThreatLevel, string> = {
    LOW: `The competitive environment in ${v} is favorable. AI-native entrants are either absent or pre-Series A with limited traction. Incumbents have not shipped AI features that overlap with this company's customer segment. The regulatory environment (where present) creates barriers that protect against horizontal AI encroachment. The competitive window is open — the investment is not time-pressured by competitive dynamics.`,
    MODERATE: `The competitive environment in ${v} shows early signs of AI activity, but does not represent immediate displacement risk. One or more AI-native entrants are raising early capital. Some incumbents are signaling AI roadmaps. The window is open but monitoring is warranted — the goal post-close is to build AI defensibility before moderate threats scale to high.`,
    HIGH: `The competitive environment in ${v} is actively heating up. Multiple AI-native entrants have raised Series A or later. One or more incumbents have shipped AI features to overlapping customers. The investment thesis requires a clear, aggressive AI deployment plan that can outpace competitive pressure within 12-18 months post-close.`,
    CRITICAL: `The competitive environment in ${v} is at acute risk. Well-funded AI-native entrants have demonstrable traction. Dominant incumbents are deploying AI to the same customer base. The window for action is narrow and this factor alone may preclude investment conviction without specific evidence of durable competitive advantage.`,
  };

  return NARRATIVES[tl] || NARRATIVES.MODERATE;
}

export function ReportPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { getRecord } = useArchiveStore();
  const record = getRecord(jobId || '');
  const [activeTab, setActiveTab] = useState<ReportTab>('headline');
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);
  const [factorView, setFactorView] = useState<'risk' | 'readiness'>('risk');
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  if (!record) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
          <EagleIcon size={60} color="rgba(197,165,114,0.3)" />
          <div className="text-gray-400">Screening not found</div>
          <Button onClick={() => navigate('/dashboard')}>← Back to Dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const { score_bundle: sb, inputs } = record;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Report Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-gray-500 hover:text-gray-300 mb-2 flex items-center gap-1 transition-colors"
            >
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem' }}>
              {inputs.company_name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <a href={inputs.company_url} target="_blank" rel="noopener" className="text-xs font-mono" style={{ color: '#C5A572' }}>
                {inputs.company_url}
              </a>
              {(record.detected_vertical || inputs.vertical) && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(197,165,114,0.12)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.25)' }}>
                  {record.detected_vertical || inputs.vertical}
                </span>
              )}
              <span className="text-xs text-gray-600 font-mono">{new Date(record.created_at).toLocaleDateString()}</span>
              {sb && (
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{
                  background: sb.confidence_overall === 'H' ? 'rgba(29,185,84,0.15)' : sb.confidence_overall === 'M' ? 'rgba(255,179,0,0.15)' : 'rgba(211,47,47,0.15)',
                  color: sb.confidence_overall === 'H' ? '#1DB954' : sb.confidence_overall === 'M' ? '#FFB300' : '#D32F2F',
                }}>
                  {sb.confidence_overall} CONFIDENCE
                </span>
              )}
              {/* Quick disposition badge in header */}
              {sb && (
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                  background: sb.disposition === 'ADVANCE' ? 'rgba(29,185,84,0.15)' : sb.disposition === 'PASS' ? 'rgba(211,47,47,0.15)' : 'rgba(0,200,220,0.15)',
                  color: sb.disposition === 'ADVANCE' ? '#1DB954' : sb.disposition === 'PASS' ? '#D32F2F' : '#00C8DC',
                  border: `1px solid ${sb.disposition === 'ADVANCE' ? 'rgba(29,185,84,0.3)' : sb.disposition === 'PASS' ? 'rgba(211,47,47,0.3)' : 'rgba(0,200,220,0.3)'}`,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {sb.disposition}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            <Button variant="gold" size="sm" onClick={() => exportToJSON(record)}>JSON</Button>
            <Button variant="gold" size="sm" onClick={() => exportToPDF()}>PDF</Button>
          </div>
        </div>

        {/* Honesty Banner */}
        {record.honesty_flag && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid #FFB300', color: '#FFB300', fontFamily: 'Inter' }}>
            ⚠️ This screening was aborted early. Data is partial — treat all conclusions as preliminary.
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-[rgba(197,165,114,0.2)] no-print overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: activeTab === tab.id ? '#C5A572' : '#64748B',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #C5A572' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'headline' && <VerdictTab record={record} />}
        {activeTab === 'threat' && <ThreatTab record={record} expandedFactor={expandedFactor} setExpandedFactor={setExpandedFactor} noteMap={noteMap} setNoteMap={setNoteMap} />}
        {activeTab === 'readiness' && <ReadinessTab record={record} expandedFactor={expandedFactor} setExpandedFactor={setExpandedFactor} noteMap={noteMap} setNoteMap={setNoteMap} />}
        {activeTab === 'competitive' && <CompetitiveTab record={record} />}
        {activeTab === 'evidence' && <EvidenceTab record={record} search={evidenceSearch} setSearch={setEvidenceSearch} />}
        {activeTab === 'diligence' && <DiligenceTab record={record} />}
      </div>
    </AppShell>
  );
}

// ─── VERDICT TAB ──────────────────────────────────────────────────────────────
function VerdictTab({ record }: { record: ScreeningRecord }) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const threatLevel = sb.threat_level ?? 'MODERATE';
  const stage = sb.readiness_stage ?? 2;
  const stageAssessment = sb.stage_assessment;
  const verdictNarrative = getVerdictNarrative(record);

  const allGreenFlags = Object.values(record.data_packs).flatMap(p => (p as any)?.green_flags || []);
  const allRedFlags = Object.values(record.data_packs).flatMap(p => p?.red_flags || []);

  const companyProfile = record.data_packs.company_profile;
  const profileOverview = companyProfile?.findings.find(f => f.key === 'company_overview')?.value as any;
  const profileFinancials = companyProfile?.findings.find(f => f.key === 'financials_and_scale')?.value as any;
  const profileProduct = companyProfile?.findings.find(f => f.key === 'product_and_pricing')?.value as any;
  const profileMarket = companyProfile?.findings.find(f => f.key === 'market_position')?.value as any;
  const profileGrowth = companyProfile?.findings.find(f => f.key === 'growth_and_momentum')?.value as any;

  return (
    <div className="space-y-6 report-page">

      {/* Company Brief */}
      {profileOverview && (profileOverview.description || profileOverview.vertical) && (
        <Card variant="elevated" padding="sm">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>COMPANY BRIEF</div>
              <p className="text-sm text-gray-200 mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
                {profileOverview.description || `${record.inputs.company_name} is a ${profileOverview.vertical || 'vertical SaaS'} company.`}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ fontFamily: 'Inter' }}>
                {profileOverview.founded_year && <span className="text-gray-500">Founded <span className="text-gray-300">{profileOverview.founded_year}</span></span>}
                {profileOverview.headquarters && <span className="text-gray-500">HQ: <span className="text-gray-300">{profileOverview.headquarters}</span></span>}
                {profileOverview.target_customer && <span className="text-gray-500">Serves: <span className="text-gray-300">{profileOverview.target_customer}</span></span>}
                {profileFinancials?.funding_stage && <span className="text-gray-500">Stage: <span className="text-gray-300">{profileFinancials.funding_stage}</span></span>}
                {profileFinancials?.estimated_arr_range && <span className="text-gray-500">Est. ARR: <span className="text-gray-300">{profileFinancials.estimated_arr_range}</span></span>}
                {profileFinancials?.employee_count_range && <span className="text-gray-500">Employees: <span className="text-gray-300">{profileFinancials.employee_count_range}</span></span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── THE TWO-AXIS VERDICT CARD ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: AI Threat Level */}
        <Card variant="elevated" className="flex flex-col">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            AI THREAT LEVEL
          </div>
          <div className="flex flex-col items-center py-4 flex-1 justify-center">
            {/* Big threat meter */}
            <div
              className="text-4xl font-black tracking-wider mb-2 px-6 py-3 rounded-xl"
              style={{
                color: THREAT_COLOR[threatLevel],
                background: THREAT_BG[threatLevel],
                fontFamily: 'JetBrains Mono, monospace',
                border: `2px solid ${THREAT_COLOR[threatLevel]}40`,
              }}
            >
              {threatLevel}
            </div>
            <div className="text-xs text-gray-500 mb-4 font-mono">{sb.risk_score.toFixed(0)}/100 threat score</div>

            {/* Threat meter bar */}
            <div className="w-full px-2">
              <div className="relative h-2 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{
                    width: `${sb.risk_score}%`,
                    background: `linear-gradient(90deg, #1DB954, #FFB300, #F57C00, #D32F2F)`,
                  }}
                />
                {/* Indicator dot */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
                  style={{ left: `calc(${sb.risk_score}% - 6px)`, background: THREAT_COLOR[threatLevel] }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>SAFE</span>
                <span>DANGER</span>
              </div>
            </div>

            <div className="mt-4 text-center px-2">
              <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                {threatLevel === 'LOW' && 'Window is open. No urgent competitive pressure. This is a patient opportunity.'}
                {threatLevel === 'MODERATE' && 'Early activity in the market. Monitor closely. Move within 12-18 months post-close.'}
                {threatLevel === 'HIGH' && 'Active competition building. AI roadmap must accelerate immediately post-close.'}
                {threatLevel === 'CRITICAL' && 'Acute risk. Well-funded competitors with traction. Investment requires specific moat evidence.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Center: AI Readiness Stage */}
        <Card variant="elevated" className="flex flex-col">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            AI READINESS STAGE
          </div>
          <div className="flex flex-col items-center py-2 flex-1">
            {/* Stage indicator */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{STAGE_ICON[stage as ReadinessStage]}</span>
              <div>
                <div className="text-lg font-black" style={{ color: STAGE_COLOR[stage as ReadinessStage], fontFamily: 'JetBrains Mono, monospace' }}>
                  {stageAssessment?.stage_label ?? `Stage ${stage}`}
                </div>
                <div className="text-xs text-gray-500 font-mono">{sb.readiness_score.toFixed(0)}/100 readiness</div>
              </div>
            </div>

            {/* Stage journey bar */}
            <div className="w-full px-2 mb-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex-1 h-2 rounded-full" style={{
                    background: s <= stage ? STAGE_COLOR[stage as ReadinessStage] : 'rgba(255,255,255,0.08)',
                  }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>SOR</span>
                <span>AI-Enabled</span>
                <span>AI-Native</span>
                <span>SOA</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mb-3 px-1" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
              {stageAssessment?.stage_description ?? ''}
            </p>

            {/* Hold period achievable? */}
            <div className="w-full px-2">
              <div className="p-2 rounded-lg text-xs text-center" style={{
                background: stageAssessment?.hold_period_achievable !== false ? 'rgba(29,185,84,0.1)' : 'rgba(211,47,47,0.1)',
                border: `1px solid ${stageAssessment?.hold_period_achievable !== false ? 'rgba(29,185,84,0.3)' : 'rgba(211,47,47,0.3)'}`,
                color: stageAssessment?.hold_period_achievable !== false ? '#1DB954' : '#EF5350',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
              }}>
                {stageAssessment?.hold_period_achievable !== false
                  ? '✓ Stage 3 achievable in 3-5yr hold'
                  : '✕ Stage 3 may require >5yr horizon'}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Investment Verdict */}
        <Card variant="elevated" className="flex flex-col">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            INVESTMENT VERDICT
          </div>
          <div className="flex flex-col items-center py-4 flex-1 justify-center">
            {/* Quadrant badge */}
            <div
              className="text-xl font-black mb-1 px-4 py-2 rounded-lg"
              style={{
                color: sb.quadrant === 'EXECUTE' ? '#1DB954' : sb.quadrant === 'RACE_MODE' ? '#FFB300' : sb.quadrant === 'BUILD_MODE' ? '#00C8DC' : '#D32F2F',
                background: sb.quadrant === 'EXECUTE' ? 'rgba(29,185,84,0.1)' : sb.quadrant === 'RACE_MODE' ? 'rgba(255,179,0,0.1)' : sb.quadrant === 'BUILD_MODE' ? 'rgba(0,200,220,0.1)' : 'rgba(211,47,47,0.1)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {sb.quadrant.replace('_', ' ')}
            </div>

            {/* Disposition */}
            <div
              className="text-3xl font-black mt-2 mb-1"
              style={{
                color: sb.disposition === 'ADVANCE' ? '#1DB954' : sb.disposition === 'PASS' ? '#D32F2F' : '#00C8DC',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {sb.disposition}
            </div>

            <div className="text-center px-2 text-xs mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
              <p style={{ color: sb.disposition === 'ADVANCE' ? '#81C784' : sb.disposition === 'PASS' ? '#EF5350' : '#7DD3E8' }}>
                {sb.disposition === 'ADVANCE' && sb.quadrant === 'BUILD_MODE' && 'Strong foundation. Open window. Take to diligence with a clear build plan.'}
                {sb.disposition === 'ADVANCE' && sb.quadrant === 'EXECUTE' && 'Low risk + strong AI foundation. Highest conviction posture — move to full diligence now.'}
                {sb.disposition === 'ADVANCE' && sb.quadrant === 'RACE_MODE' && 'Strong AI readiness. Competitive pressure is real but manageable. Move fast.'}
                {sb.disposition === 'ADVANCE' && sb.quadrant === 'DANGER_ZONE' && 'Meaningful foundation despite elevated risk. Pursue with focused diligence plan.'}
                {sb.disposition === 'DILIGENCE' && 'Real opportunity with open questions. Use the diligence plan below to build conviction.'}
                {sb.disposition === 'PASS' && 'AI disruption risk is extreme and the foundation is insufficient to recover within a hold period. Do not advance.'}
              </p>
            </div>

            {sb.critical_gaps.length > 0 && (
              <div className="px-3 py-2 rounded-lg w-full" style={{ background: 'rgba(245,124,0,0.08)', border: '1px solid rgba(245,124,0,0.3)' }}>
                <div className="text-xs font-semibold text-center" style={{ color: '#F57C00', fontFamily: 'JetBrains Mono, monospace' }}>
                  {sb.critical_gaps.length} readiness gap{sb.critical_gaps.length > 1 ? 's' : ''} to close on the path to SOA: {sb.critical_gaps.join(', ')}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Eagle Vision Executive Summary */}
      <Card variant="elevated">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🦅</span>
          <div className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            PERCH EXECUTIVE SUMMARY
          </div>
          <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded" style={{
            background: sb.confidence_overall === 'H' ? 'rgba(29,185,84,0.15)' : sb.confidence_overall === 'M' ? 'rgba(255,179,0,0.15)' : 'rgba(211,47,47,0.15)',
            color: sb.confidence_overall === 'H' ? '#1DB954' : sb.confidence_overall === 'M' ? '#FFB300' : '#D32F2F',
          }}>
            {sb.confidence_overall} CONFIDENCE
          </span>
        </div>
        <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.9 }}>
          {verdictNarrative}
        </p>
      </Card>

      {/* Quadrant + Positives + Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="navy" className="flex flex-col items-center justify-center">
          <QuadrantPlot
            riskScore={sb.risk_score}
            readinessScore={sb.readiness_score}
            quadrant={sb.quadrant}
            companyName={record.inputs.company_name}
          />
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter' }}>
              {sb.quadrant === 'EXECUTE' && 'Low risk · High readiness · Highest conviction posture'}
              {sb.quadrant === 'RACE_MODE' && 'High risk · High readiness · Strong thesis, time-sensitive'}
              {sb.quadrant === 'BUILD_MODE' && '🏗️ Low risk · Open window · Patient capital opportunity'}
              {sb.quadrant === 'DANGER_ZONE' && 'High risk · Readiness gaps · Requires specific conviction'}
            </p>
          </div>
        </Card>

        <Card variant="navy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-400 text-lg">✓</span>
            <span className="text-sm font-bold" style={{ color: '#1DB954', fontFamily: 'JetBrains Mono, monospace' }}>Investment Positives</span>
          </div>
          <ul className="space-y-3">
            {sb.lean_in_reasons.length > 0 ? sb.lean_in_reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span style={{ color: '#1DB954', flexShrink: 0, marginTop: 2 }}>→</span>
                <span>{r}</span>
              </li>
            )) : (
              <li className="text-xs text-gray-600 italic">Insufficient high-confidence evidence to identify clear investment positives.</li>
            )}
          </ul>
        </Card>

        <Card variant="navy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400 text-lg">⚠</span>
            <span className="text-sm font-bold" style={{ color: '#FFB300', fontFamily: 'JetBrains Mono, monospace' }}>Risk & Hesitation Signals</span>
          </div>
          <ul className="space-y-3">
            {sb.hesitate_reasons.length > 0 ? sb.hesitate_reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span style={{ color: '#FFB300', flexShrink: 0, marginTop: 2 }}>→</span>
                <span>{r}</span>
              </li>
            )) : (
              <li className="text-xs text-gray-600 italic">No significant hesitation signals above threshold.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* BUILD MODE Explainer — only shown when quadrant is BUILD_MODE */}
      {sb.quadrant === 'BUILD_MODE' && (
        <div className="rounded-xl px-5 py-4 flex gap-4 items-start" style={{
          background: 'rgba(0,200,220,0.06)',
          border: '1px solid rgba(0,200,220,0.3)',
        }}>
          <div className="text-2xl flex-shrink-0">🏗️</div>
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: '#00C8DC', fontFamily: 'JetBrains Mono, monospace' }}>
              BUILD MODE — Why This Is a Positive Signal
            </div>
            <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
              <strong style={{ color: '#00C8DC' }}>Low Risk</strong> means the AI-disruption clock hasn't started yet — incumbents and AI-native entrants haven't captured the market, and the competitive window remains open.{' '}
              <strong style={{ color: '#00C8DC' }}>Low Readiness</strong> doesn't mean the company is weak — it means they own the workflow (System of Record) but haven't yet built the AI layer.{' '}
              That gap is exactly where patient PE capital creates value: <em>buy before the AI premium is priced in, build the AI layer, and exit at a meaningfully higher multiple</em>.{' '}
              BUILD MODE is almost always a DILIGENCE or ADVANCE — the investment question is simply: <strong style={{ color: '#E0E0E0' }}>"Can we close the readiness gaps within a 3-5 year hold period?"</strong>
            </p>
          </div>
        </div>
      )}

      {/* What to Fix — Investment Roadmap */}
      {sb.what_to_fix && sb.what_to_fix.length > 0 && (
        <Card variant="navy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🛠</span>
            <span className="text-sm font-bold" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>Post-Close AI Roadmap</span>
            <span className="text-xs text-gray-500 ml-2" style={{ fontFamily: 'Inter' }}>Close these gaps to reach Stage 3 in the hold period</span>
          </div>
          <ul className="space-y-2">
            {sb.what_to_fix.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs py-2 px-3 rounded" style={{
                background: item.startsWith('🔴') ? 'rgba(211,47,47,0.06)' : item.startsWith('⏱') ? 'rgba(255,179,0,0.06)' : 'rgba(197,165,114,0.06)',
                fontFamily: 'Inter', lineHeight: 1.6,
                color: item.startsWith('🔴') ? '#EF9A9A' : item.startsWith('⏱') ? '#FFD54F' : '#CBD5E1',
              }}>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Stage Evidence */}
      {stageAssessment && (stageAssessment.evidence_for_stage.length > 0 || stageAssessment.gaps_to_next_stage.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stageAssessment.evidence_for_stage.length > 0 && (
            <Card variant="navy">
              <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#1DB954', fontFamily: 'JetBrains Mono, monospace' }}>
                EVIDENCE FOR {stageAssessment.stage_label.toUpperCase()}
              </div>
              <ul className="space-y-2">
                {stageAssessment.evidence_for_stage.map((e, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#1DB954', flexShrink: 0 }}>✓</span>
                    {e}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {stageAssessment.gaps_to_next_stage.length > 0 && (
            <Card variant="navy">
              <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#F57C00', fontFamily: 'JetBrains Mono, monospace' }}>
                GAPS TO NEXT STAGE
              </div>
              <ul className="space-y-2">
                {stageAssessment.gaps_to_next_stage.map((g, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#F57C00', flexShrink: 0 }}>→</span>
                    {g}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Company Profile Snapshot */}
      {companyProfile && (profileFinancials || profileProduct || profileMarket) && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            COMPANY PROFILE SNAPSHOT
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {profileFinancials?.arr_range_estimate && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>EST. ARR</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{profileFinancials.arr_range_estimate}</div>
                {profileFinancials.arr_estimation_basis && (
                  <div className="text-xs text-gray-500 mt-1">{profileFinancials.arr_estimation_basis}</div>
                )}
              </div>
            )}
            {profileFinancials?.funding_stage && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>FUNDING</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{profileFinancials.funding_stage}</div>
              </div>
            )}
            {profileProduct?.pricing_model && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>PRICING MODEL</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{profileProduct.pricing_model}</div>
              </div>
            )}
            {profileMarket?.market_position_category && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>MARKET POSITION</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{profileMarket.market_position_category}</div>
              </div>
            )}
          </div>
          {profileMarket?.key_differentiators?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>KEY DIFFERENTIATORS</div>
              <div className="flex flex-wrap gap-2">
                {profileMarket.key_differentiators.slice(0, 5).map((d: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'rgba(197,165,114,0.1)', color: '#C5A572' }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profileGrowth?.growth_signals?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>GROWTH SIGNALS</div>
              <ul className="space-y-1">
                {profileGrowth.growth_signals.slice(0, 4).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2">
                    <span style={{ color: '#1DB954' }}>+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Green Flags */}
      {allGreenFlags.length > 0 && (
        <Card variant="navy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-400 text-lg">✦</span>
            <span className="text-sm font-bold" style={{ color: '#1DB954', fontFamily: 'JetBrains Mono, monospace' }}>Green Flag Intelligence</span>
          </div>
          <div className="space-y-2">
            {allGreenFlags.map((flag: string, i: number) => (
              <div key={i} className="flex gap-2 items-start text-xs py-2 px-3 rounded" style={{ background: 'rgba(29,185,84,0.08)', color: '#81C784', fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span className="shrink-0" style={{ color: '#1DB954' }}>✓</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Red Flags */}
      {allRedFlags.length > 0 && (
        <Card variant="navy" goldAccent>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-red-400 text-lg">🚨</span>
            <span className="text-sm font-bold" style={{ color: '#D32F2F', fontFamily: 'JetBrains Mono, monospace' }}>Red Flag Radar</span>
          </div>
          <div className="space-y-2">
            {allRedFlags.map((flag: string, i: number) => (
              <div key={i} className="flex gap-2 items-start text-xs py-2 px-3 rounded" style={{ background: 'rgba(211,47,47,0.1)', color: '#EF5350', fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span className="shrink-0">⚑</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── THREAT ANALYSIS TAB ─────────────────────────────────────────────────────
function ThreatTab({ record, expandedFactor, setExpandedFactor, noteMap, setNoteMap }: {
  record: ScreeningRecord;
  expandedFactor: string | null;
  setExpandedFactor: (f: string | null) => void;
  noteMap: Record<string, string>;
  setNoteMap: (m: Record<string, string>) => void;
}) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const riskFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('R'));
  const threatLevel = sb.threat_level ?? 'MODERATE';
  const threatNarrative = getThreatNarrative(record);

  return (
    <div className="space-y-6 report-page">
      {/* Threat Summary Header */}
      <Card variant="elevated">
        <div className="flex items-start gap-6">
          <div className="shrink-0 text-center">
            <div className="text-5xl font-black px-6 py-4 rounded-xl mb-2"
              style={{ color: THREAT_COLOR[threatLevel], background: THREAT_BG[threatLevel], fontFamily: 'JetBrains Mono, monospace' }}>
              {threatLevel}
            </div>
            <div className="text-2xl font-mono" style={{ color: THREAT_COLOR[threatLevel] }}>{sb.risk_score.toFixed(0)}/100</div>
            <div className="text-xs text-gray-500">AI Threat Score</div>
            <div className="text-xs text-gray-600 mt-1">Lower = safer</div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
              THREAT ENVIRONMENT ANALYSIS
            </div>
            <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
              {threatNarrative}
            </p>
          </div>
        </div>
      </Card>

      {/* Risk Factor Breakdown */}
      <div>
        <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
          THREAT FACTORS — R1 through R7
        </div>
        <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
          Each factor measures a specific threat dimension. The bar shows threat intensity — <span style={{ color: '#1DB954' }}>short bar = low threat</span>, <span style={{ color: '#D32F2F' }}>long bar = high threat</span>. Click any factor for full analysis.
        </p>
        <div className="space-y-3">
          {riskFactors.map((f, i) => (
            <ThreatFactorRow
              key={f.factor_id}
              factor={f}
              isEven={i % 2 === 0}
              isExpanded={expandedFactor === f.factor_id}
              onToggle={() => setExpandedFactor(expandedFactor === f.factor_id ? null : f.factor_id)}
              note={noteMap[f.factor_id]}
              onNoteChange={(note) => setNoteMap({ ...noteMap, [f.factor_id]: note })}
            />
          ))}
        </div>
      </div>

      <Card variant="navy" padding="sm">
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
          <span style={{ color: '#C5A572' }}>How to read threat factors:</span> All threat scores are on a 0-100 scale where HIGH score = HIGH THREAT (bad). A score of 15 on R2 means very few AI-native entrants — that is GOOD for investment conviction. The AI Threat Level (LOW/MODERATE/HIGH/CRITICAL) is derived from the weighted average of all 7 factors.
        </div>
      </Card>
    </div>
  );
}

// ─── THREAT FACTOR ROW ────────────────────────────────────────────────────────
function ThreatFactorRow({ factor, isEven, isExpanded, onToggle, note, onNoteChange }: {
  factor: FactorScore;
  isEven: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  note?: string;
  onNoteChange: (n: string) => void;
}) {
  const score = factor.raw_score;
  const threatColor = score < 30 ? '#1DB954' : score < 50 ? '#FFB300' : score < 70 ? '#F57C00' : '#D32F2F';
  const threatLabel = score < 30 ? 'LOW' : score < 50 ? 'MODERATE' : score < 70 ? 'HIGH' : 'CRITICAL';
  const hasRealEvidence = factor.evidence_summary &&
    !factor.evidence_summary.includes('No evidence collected') &&
    !factor.evidence_summary.includes('Pack failed') &&
    !factor.evidence_summary.includes('defaulting to neutral');

  return (
    <div style={{
      background: isEven ? 'rgba(0,26,46,0.5)' : 'transparent',
      borderRadius: '8px',
      border: '1px solid rgba(197,165,114,0.15)',
    }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(197,165,114,0.04)] rounded-lg transition-colors"
        onClick={onToggle}
      >
        <div className="text-xs font-bold font-mono w-8" style={{ color: '#C5A572' }}>{factor.factor_id}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {factor.factor_name}
          </div>
          {/* Threat meter bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: threatColor }} />
            </div>
            <span className="text-xs font-mono w-12 text-right" style={{ color: threatColor }}>{score}/100</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
              background: `${threatColor}20`,
              color: threatColor,
              fontFamily: 'JetBrains Mono, monospace',
              width: '72px',
              textAlign: 'center',
            }}>
              {threatLabel}
            </span>
          </div>
          {hasRealEvidence && (
            <div className="text-xs text-gray-600 truncate mt-1" style={{ fontFamily: 'Inter' }}>
              {factor.evidence_summary.slice(0, 80)}...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SignalChip confidence={factor.confidence} />
          <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pt-2 space-y-4" style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(197,165,114,0.1)' }}>
          {/* Evidence */}
          <div>
            <div className="text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>EVIDENCE FROM RESEARCH</div>
            {hasRealEvidence ? (
              <p className="text-xs text-gray-300 p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)', fontFamily: 'Inter', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {factor.evidence_summary}
              </p>
            ) : (
              <p className="text-xs text-gray-500 italic p-3 rounded-lg" style={{ background: 'rgba(211,47,47,0.08)', fontFamily: 'Inter', lineHeight: 1.7 }}>
                No evidence collected from public sources. Score uses neutral default. Validate in diligence.
              </p>
            )}
          </div>
          {/* Scoring details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>SCORING MATH</div>
              <div className="p-2 rounded font-mono text-xs" style={{ background: 'rgba(0,0,0,0.3)', color: '#C5A572' }}>
                {score.toFixed(1)} × {(factor.weight * 100).toFixed(0)}% = {factor.weighted_contribution.toFixed(1)} pts → risk total
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>RUBRIC APPLIED</div>
              <p className="text-xs text-gray-500 font-mono" style={{ lineHeight: 1.5, fontSize: '10px' }}>{factor.rubric_applied}</p>
            </div>
          </div>
          {/* Partner Note */}
          <div>
            <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>PARTNER ANNOTATION</div>
            <textarea
              value={note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Dispute this score, add context, or document what diligence evidence would change your view..."
              rows={2}
              className="w-full px-3 py-2 rounded text-xs text-white resize-none outline-none"
              style={{ background: 'rgba(197,165,114,0.06)', border: '1px solid rgba(197,165,114,0.2)', fontFamily: 'Inter', lineHeight: 1.6 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── READINESS TAB ────────────────────────────────────────────────────────────
function ReadinessTab({ record, expandedFactor, setExpandedFactor, noteMap, setNoteMap }: {
  record: ScreeningRecord;
  expandedFactor: string | null;
  setExpandedFactor: (f: string | null) => void;
  noteMap: Record<string, string>;
  setNoteMap: (m: Record<string, string>) => void;
}) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const readinessFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('A'));
  const stage = sb.readiness_stage ?? 2;
  const stageAssessment = sb.stage_assessment;

  // Group by category
  const groups = [
    { label: 'Data & Foundation', ids: ['A1', 'A2', 'A3', 'A10'], desc: 'Does the company own the workflow and data needed to build AI on top of?' },
    { label: 'AI Execution Capability', ids: ['A6', 'A7', 'A8', 'A9'], desc: 'Does the team have the capability and architecture to execute the AI roadmap?' },
    { label: 'Value Capture', ids: ['A4', 'A5'], desc: 'Can the company capture and price the AI value it creates?' },
  ];

  return (
    <div className="space-y-6 report-page">
      {/* Stage Header */}
      <Card variant="elevated">
        <div className="flex items-start gap-6">
          <div className="shrink-0 text-center px-4">
            <div className="text-4xl mb-1">{STAGE_ICON[stage as ReadinessStage]}</div>
            <div className="text-2xl font-black" style={{ color: STAGE_COLOR[stage as ReadinessStage], fontFamily: 'JetBrains Mono, monospace' }}>
              Stage {stage}
            </div>
            <div className="text-xs text-gray-500">{sb.readiness_score.toFixed(0)}/100</div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
              {stageAssessment?.stage_label?.toUpperCase() ?? `STAGE ${stage}`}
            </div>
            <p className="text-sm text-gray-300 mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
              {stageAssessment?.stage_description ?? ''}
            </p>
            {/* Stage journey */}
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{
                    background: s === stage ? STAGE_COLOR[stage as ReadinessStage] : s < stage ? `${STAGE_COLOR[stage as ReadinessStage]}40` : 'rgba(255,255,255,0.06)',
                    color: s <= stage ? '#fff' : '#64748B',
                    border: s === stage ? `2px solid ${STAGE_COLOR[stage as ReadinessStage]}` : '1px solid rgba(255,255,255,0.1)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {s}
                  </div>
                  {s < 4 && <div className="w-12 h-0.5" style={{ background: s < stage ? `${STAGE_COLOR[stage as ReadinessStage]}60` : 'rgba(255,255,255,0.08)' }} />}
                </div>
              ))}
              <div className="ml-3">
                <div className={`text-xs px-2 py-1 rounded font-bold`} style={{
                  background: stageAssessment?.hold_period_achievable !== false ? 'rgba(29,185,84,0.1)' : 'rgba(211,47,47,0.1)',
                  color: stageAssessment?.hold_period_achievable !== false ? '#1DB954' : '#EF5350',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {stageAssessment?.hold_period_achievable !== false ? '✓ Stage 3 in hold period' : '⚠ Stage 3 needs >5yr'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Readiness Factors by Group */}
      {groups.map(group => {
        const groupFactors = readinessFactors.filter(f => group.ids.includes(f.factor_id));
        const groupAvg = groupFactors.length > 0
          ? Math.round(groupFactors.reduce((s, f) => s + f.raw_score, 0) / groupFactors.length)
          : 0;
        const groupColor = groupAvg >= 65 ? '#1DB954' : groupAvg >= 45 ? '#FFB300' : '#D32F2F';

        return (
          <div key={group.label}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{group.label}</div>
              <div className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: `${groupColor}20`, color: groupColor }}>
                avg {groupAvg}/100
              </div>
              <div className="text-xs text-gray-500">{group.desc}</div>
            </div>
            <div className="space-y-3 pl-4 border-l-2" style={{ borderColor: `${groupColor}40` }}>
              {groupFactors.map((f, i) => (
                <ReadinessFactorRow
                  key={f.factor_id}
                  factor={f}
                  isEven={i % 2 === 0}
                  isExpanded={expandedFactor === f.factor_id}
                  onToggle={() => setExpandedFactor(expandedFactor === f.factor_id ? null : f.factor_id)}
                  note={noteMap[f.factor_id]}
                  onNoteChange={(note) => setNoteMap({ ...noteMap, [f.factor_id]: note })}
                />
              ))}
            </div>
          </div>
        );
      })}

      <Card variant="navy" padding="sm">
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
          <span style={{ color: '#C5A572' }}>How to read readiness factors:</span> All readiness scores are on a 0-100 scale where HIGH score = STRONG CAPABILITY (good). Factors below 40 are flagged as critical gaps. The Readiness Stage (1-4) is the primary verdict signal — Stage 1 = early but investable, Stage 3 = AI capability established, Stage 4 = System of Action.
        </div>
      </Card>
    </div>
  );
}

// ─── READINESS FACTOR ROW ─────────────────────────────────────────────────────
function ReadinessFactorRow({ factor, isEven, isExpanded, onToggle, note, onNoteChange }: {
  factor: FactorScore;
  isEven: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  note?: string;
  onNoteChange: (n: string) => void;
}) {
  const score = factor.raw_score;
  const readinessColor = score >= 75 ? '#1DB954' : score >= 60 ? '#66BB6A' : score >= 45 ? '#FFB300' : score >= 30 ? '#F57C00' : '#D32F2F';
  const readinessLabel = score >= 75 ? 'STRONG' : score >= 60 ? 'SOLID' : score >= 45 ? 'DEVELOPING' : score >= 30 ? 'WEAK' : 'CRITICAL GAP';
  const hasRealEvidence = factor.evidence_summary &&
    !factor.evidence_summary.includes('No evidence collected') &&
    !factor.evidence_summary.includes('Pack failed') &&
    !factor.evidence_summary.includes('defaulting to neutral');

  return (
    <div style={{
      background: factor.is_critical_gap ? 'rgba(245,124,0,0.06)' : isEven ? 'rgba(0,26,46,0.4)' : 'transparent',
      borderRadius: '8px',
      border: factor.is_critical_gap ? '1px solid rgba(245,124,0,0.3)' : '1px solid rgba(197,165,114,0.1)',
    }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(197,165,114,0.04)] rounded-lg transition-colors"
        onClick={onToggle}
      >
        <div className="text-xs font-bold font-mono w-8" style={{ color: '#C5A572' }}>{factor.factor_id}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {factor.factor_name}
            </span>
            {factor.is_critical_gap && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(245,124,0,0.2)', color: '#F57C00', fontFamily: 'JetBrains Mono, monospace' }}>
                CRITICAL GAP
              </span>
            )}
          </div>
          {/* Readiness bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: readinessColor }} />
            </div>
            <span className="text-xs font-mono w-12 text-right" style={{ color: readinessColor }}>{score}/100</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
              background: `${readinessColor}20`,
              color: readinessColor,
              fontFamily: 'JetBrains Mono, monospace',
              width: '88px',
              textAlign: 'center',
            }}>
              {readinessLabel}
            </span>
          </div>
          {hasRealEvidence && (
            <div className="text-xs text-gray-600 truncate mt-1" style={{ fontFamily: 'Inter' }}>
              {factor.evidence_summary.slice(0, 80)}...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SignalChip confidence={factor.confidence} />
          <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pt-2 space-y-4" style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(197,165,114,0.1)' }}>
          <div>
            <div className="text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>EVIDENCE FROM RESEARCH</div>
            {hasRealEvidence ? (
              <p className="text-xs text-gray-300 p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)', fontFamily: 'Inter', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {factor.evidence_summary}
              </p>
            ) : (
              <p className="text-xs text-gray-500 italic p-3 rounded-lg" style={{ background: 'rgba(211,47,47,0.08)', fontFamily: 'Inter', lineHeight: 1.7 }}>
                No evidence collected from public sources. Score uses neutral default (50). Validate in diligence.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>SCORING MATH</div>
              <div className="p-2 rounded font-mono text-xs" style={{ background: 'rgba(0,0,0,0.3)', color: '#C5A572' }}>
                {score.toFixed(1)} × {(factor.weight * 100).toFixed(0)}% = {factor.weighted_contribution.toFixed(1)} pts → readiness total
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>RUBRIC APPLIED</div>
              <p className="text-xs text-gray-500 font-mono" style={{ lineHeight: 1.5, fontSize: '10px' }}>{factor.rubric_applied}</p>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>PARTNER ANNOTATION</div>
            <textarea
              value={note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Dispute this score, add context, or document what diligence evidence would change your view..."
              rows={2}
              className="w-full px-3 py-2 rounded text-xs text-white resize-none outline-none"
              style={{ background: 'rgba(197,165,114,0.06)', border: '1px solid rgba(197,165,114,0.2)', fontFamily: 'Inter', lineHeight: 1.6 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPETITIVE TAB (unchanged logic, updated styling) ───────────────────────
function CompetitiveTab({ record }: { record: ScreeningRecord }) {
  const pack = record.data_packs.competitive_landscape;
  const sb = record.score_bundle;

  if (!pack) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="mb-2">Competitive Landscape data not available for this screening.</p>
      </div>
    );
  }

  const heatIndex = pack.findings.find(f => f.key === 'vertical_heat_index')?.value as any;
  const entrants = pack.findings.find(f => f.key === 'ai_native_entrants')?.value as any[] || [];
  const incumbents = pack.findings.find(f => f.key === 'incumbent_postures')?.value as any[] || [];
  const horizontalThreat = pack.findings.find(f => f.key === 'horizontal_ai_threat')?.value as any;
  const news = pack.findings.find(f => f.key === 'recent_vertical_news')?.value as any[] || [];

  const r1Evidence = sb?.factor_scores.find(f => f.factor_id === 'R1');
  const r2Evidence = sb?.factor_scores.find(f => f.factor_id === 'R2');
  const r3Evidence = sb?.factor_scores.find(f => f.factor_id === 'R3');
  const r4Evidence = sb?.factor_scores.find(f => f.factor_id === 'R4');

  return (
    <div className="space-y-6 report-page">
      {(r1Evidence || r2Evidence) && (
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            COMPETITIVE LANDSCAPE BRIEF
          </div>
          <div className="space-y-3">
            {[r1Evidence, r2Evidence, r3Evidence, r4Evidence].filter(Boolean).map(ev => {
              if (!ev || ev.evidence_summary.includes('No evidence')) return null;
              const score = ev.raw_score;
              const tc = score < 30 ? '#1DB954' : score < 50 ? '#FFB300' : score < 70 ? '#F57C00' : '#D32F2F';
              return (
                <div key={ev.factor_id} className="pt-3" style={{ borderTop: '1px solid rgba(197,165,114,0.1)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs font-semibold" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
                      {ev.factor_name}
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: `${tc}20`, color: tc }}>
                      {score}/100 threat
                    </div>
                  </div>
                  <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{ev.evidence_summary}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            VERTICAL AI HEAT INDEX
          </div>
          {heatIndex ? (
            <div className="text-center py-4">
              <div className="text-5xl font-bold mb-2" style={{ color: heatIndex.score > 70 ? '#D32F2F' : heatIndex.score > 50 ? '#FFB300' : '#1DB954', fontFamily: 'JetBrains Mono, monospace' }}>
                {heatIndex.grade}
              </div>
              <div className="text-2xl font-mono mb-3" style={{ color: heatIndex.score > 70 ? '#D32F2F' : heatIndex.score > 50 ? '#FFB300' : '#1DB954' }}>
                {heatIndex.score}/100
              </div>
              <div className="relative h-3 rounded-full mx-4 mb-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="absolute left-0 top-0 h-full rounded-full" style={{
                  width: `${heatIndex.score}%`,
                  background: heatIndex.score > 70 ? '#D32F2F' : heatIndex.score > 50 ? '#FFB300' : '#1DB954',
                }} />
              </div>
              <p className="text-xs text-gray-400 text-center" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{heatIndex.summary}</p>
            </div>
          ) : (
            <div className="text-gray-600 text-xs text-center py-8">Heat index not collected</div>
          )}
        </Card>

        <Card variant="navy" className="lg:col-span-2">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            HORIZONTAL AI ENCROACHMENT
          </div>
          {horizontalThreat ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1.5 rounded-lg text-sm font-bold" style={{
                  background: horizontalThreat.level === 'HIGH' ? 'rgba(211,47,47,0.15)' : horizontalThreat.level === 'MEDIUM' ? 'rgba(255,179,0,0.15)' : 'rgba(29,185,84,0.15)',
                  color: horizontalThreat.level === 'HIGH' ? '#D32F2F' : horizontalThreat.level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {horizontalThreat.level} RISK
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(horizontalThreat.threat_actors || []).map((actor: string) => (
                  <span key={actor} className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'rgba(197,165,114,0.1)', color: '#C5A572' }}>
                    {actor}
                  </span>
                ))}
              </div>
              {horizontalThreat.use_cases_at_risk?.length > 0 && (
                <ul className="space-y-2">
                  {horizontalThreat.use_cases_at_risk.map((uc: string, i: number) => (
                    <li key={i} className="text-xs text-gray-400 flex gap-2">
                      <span style={{ color: '#F57C00' }}>→</span>
                      {uc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-xs">No horizontal threat data collected</div>
          )}
        </Card>
      </div>

      {incumbents.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            INCUMBENT AI POSTURE ({incumbents.length} tracked)
          </div>
          <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
            ACTIVE = GA product. SIGNALING = roadmap announced or beta. SILENT = no public AI activity.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incumbents.map((inc: any, i: number) => (
              <div key={i} className="p-4 rounded-lg" style={{
                background: 'rgba(0,43,73,0.5)',
                border: `1px solid ${inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.4)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.4)' : 'rgba(100,116,139,0.3)'}`,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{inc.company}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                    background: inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.2)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.2)' : 'rgba(100,116,139,0.2)',
                    color: inc.status === 'ACTIVE' ? '#D32F2F' : inc.status === 'SIGNALING' ? '#FFB300' : '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {inc.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{inc.evidence}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {entrants.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            AI-NATIVE ENTRANT THREAT MATRIX ({entrants.length} identified)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                  {['Company', 'Founded', 'Stage', 'Last Raise', 'Traction Signal', 'Threat Level'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wider" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entrants.map((e: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)' }}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-white text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{e.company}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{e.founded || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300">{e.stage || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 font-mono">{e.last_raise || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400" style={{ maxWidth: '160px', lineHeight: 1.5 }}>{e.traction_signal || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                        background: e.threat_level === 'HIGH' ? 'rgba(211,47,47,0.2)' : e.threat_level === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                        color: e.threat_level === 'HIGH' ? '#D32F2F' : e.threat_level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {e.threat_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {news.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            VERTICAL AI NEWS & DEAL FEED
          </div>
          <div className="space-y-3">
            {news.map((item: any, i: number) => (
              <div key={i} className="flex gap-3 items-start py-2 border-b border-[rgba(197,165,114,0.1)]">
                <div className="text-xs font-mono text-gray-600 shrink-0 w-20">{item.date || 'Recent'}</div>
                <div className="flex-1">
                  <a href={item.url} target="_blank" rel="noopener" className="text-sm font-semibold text-white hover:text-[#C5A572] transition-colors" style={{ fontFamily: 'Inter' }}>
                    {item.headline}
                  </a>
                  {item.significance && (
                    <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>{item.significance}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── EVIDENCE TAB ─────────────────────────────────────────────────────────────
function EvidenceTab({ record, search, setSearch }: {
  record: ScreeningRecord;
  search: string;
  setSearch: (s: string) => void;
}) {
  const allSources: Array<{ url: string; pack: string; confidence: string; excerpt: string }> = [];
  for (const [packName, pack] of Object.entries(record.data_packs)) {
    if (!pack) continue;
    for (const finding of pack.findings) {
      for (const url of finding.sources) {
        if (url && url.startsWith('http')) {
          allSources.push({ url, pack: packName, confidence: finding.confidence, excerpt: String(finding.value).slice(0, 100) });
        }
      }
    }
  }

  const filtered = allSources.filter(s =>
    !search || s.url.toLowerCase().includes(search.toLowerCase()) || s.pack.includes(search.toLowerCase())
  );

  const packCoverage = Object.entries(record.data_packs).filter(([, p]) => p && !(p as any).v2_stub).length;
  const stubCount = Object.values(record.data_packs).filter(p => (p as any)?.v2_stub).length;
  const failedPacks = Object.entries(record.data_packs).filter(([, p]) => (p as any)?.status === 'failed').map(([k]) => k);

  return (
    <div className="space-y-6 report-page">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sources', value: allSources.length },
          { label: 'Live Packs', value: packCoverage },
          { label: 'V2 Stubs', value: stubCount },
          { label: 'Coverage', value: `${Math.round((packCoverage / 7) * 100)}%` },
        ].map((stat) => (
          <Card key={stat.label} variant="navy" padding="sm" className="text-center">
            <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
            <div className="text-xs text-gray-500 tracking-wider" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{stat.label.toUpperCase()}</div>
          </Card>
        ))}
      </div>

      {failedPacks.length > 0 && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)', color: '#EF5350', fontFamily: 'Inter' }}>
          ⚠️ Failed packs: {failedPacks.join(', ')}. Scores for affected factors default to neutral.
        </div>
      )}

      {allSources.length > 0 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sources by URL or pack name..."
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
          style={{ background: 'rgba(0,58,99,0.4)', border: '1px solid rgba(197,165,114,0.2)', fontFamily: 'Inter' }}
        />
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,165,114,0.2)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#001A2E', borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                {['Source URL', 'Pack', 'Confidence', 'Excerpt'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)', background: i % 2 === 0 ? 'rgba(0,26,46,0.5)' : 'transparent' }}>
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <a href={s.url} target="_blank" rel="noopener" className="font-mono truncate block hover:text-[#C5A572] transition-colors" style={{ color: '#64748B' }}>
                      {s.url.slice(0, 55)}{s.url.length > 55 ? '…' : ''}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{s.pack.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5"><SignalChip confidence={s.confidence as any} /></td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[200px] truncate">{s.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(() => {
        const unknowns = Object.entries(record.data_packs).flatMap(([packName, pack]) =>
          ((pack as any)?.findings || []).flatMap((f: any) => f.unknowns.map((u: string) => ({ unknown: u, pack: packName })))
        );
        if (unknowns.length === 0) return null;
        return (
          <Card variant="navy">
            <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
              KNOWN UNKNOWNS — DATA GAPS FOR DILIGENCE
            </div>
            <div className="space-y-2">
              {unknowns.map((u, i) => (
                <div key={i} className="flex gap-3 text-xs items-start py-2 px-3 rounded" style={{ background: 'rgba(0,43,73,0.3)' }}>
                  <span className="text-gray-600 font-mono shrink-0">[{u.pack.replace(/_/g, ' ')}]</span>
                  <span className="text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>{u.unknown}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── DILIGENCE TAB ────────────────────────────────────────────────────────────
function DiligenceTab({ record }: { record: ScreeningRecord }) {
  const areas = record.diligence_areas || [];
  const conditions = record.upgrade_break_conditions;
  const sb = record.score_bundle;

  return (
    <div className="space-y-6 report-page">
      {sb && (
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <div className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>DILIGENCE FRAMING</div>
          </div>
          <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
            Perch is a 30-50 minute fast-pass screener — not a final verdict. The items below are the highest-priority questions to resolve as you move from screen to full diligence. Every company in this output is on a journey toward System of Action. The question is where they are on that journey and what it takes to get there.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold" style={{
                color: sb.disposition === 'ADVANCE' ? '#1DB954' : sb.disposition === 'PASS' ? '#D32F2F' : '#00C8DC',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{sb.disposition}</div>
              <div className="text-xs text-gray-500 mt-1">Perch Signal</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold" style={{ color: THREAT_COLOR[sb.threat_level ?? 'MODERATE'], fontFamily: 'JetBrains Mono, monospace' }}>
                {sb.threat_level ?? 'MODERATE'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Threat Level</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold" style={{ color: STAGE_COLOR[sb.readiness_stage ?? 2], fontFamily: 'JetBrains Mono, monospace' }}>
                Stage {sb.readiness_stage ?? 2}
              </div>
              <div className="text-xs text-gray-500 mt-1">AI Readiness</div>
            </div>
          </div>
        </Card>
      )}

      <div>
        <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
          DILIGENCE FOCUS AREAS
        </div>
        {areas.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">No diligence areas generated. Score data may be incomplete.</div>
        ) : (
          <div className="space-y-4">
            {areas.map((area, i) => (
              <Card key={i} variant="navy" goldAccent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl font-bold" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>#{area.rank}</span>
                      <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600 }}>{area.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded font-bold ml-auto" style={{
                        background: area.priority === 'HIGH' ? 'rgba(211,47,47,0.2)' : area.priority === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                        color: area.priority === 'HIGH' ? '#D32F2F' : area.priority === 'MEDIUM' ? '#FFB300' : '#1DB954',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {area.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>WHY IT MATTERS</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.why_it_matters}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>WHAT TO TEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.what_to_test}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>EVIDENCE TO REQUEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.evidence_to_request}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {conditions && (
        <div>
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
            DILIGENCE ROADMAP
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#1DB954', fontFamily: 'JetBrains Mono, monospace' }}>✓ SIGNALS THAT BUILD CONVICTION</div>
              <ul className="space-y-3">
                {conditions.advance_signals.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#1DB954', flexShrink: 0 }}>→</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#00C8DC', fontFamily: 'JetBrains Mono, monospace' }}>? KEY QUESTIONS TO RESOLVE</div>
              <ul className="space-y-3">
                {conditions.key_questions.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#00C8DC', flexShrink: 0 }}>→</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#FFB300', fontFamily: 'JetBrains Mono, monospace' }}>⚠ WATCH LIST</div>
              <ul className="space-y-3">
                {conditions.watch_list.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#FFB300', flexShrink: 0 }}>→</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <Card variant="elevated" className="text-center py-8">
        <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>NEXT STEP</div>
        <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 500 }}>Take This to the Next Stage</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
          Perch is a 30-50 minute fast-pass screener. The diligence questions above are designed to focus your management meeting, data room request, and customer reference calls. Full conviction requires 2-3 weeks of structured diligence.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button onClick={() => exportToPDF()} className="px-6 py-2.5 rounded-lg font-bold text-sm" style={{ background: 'var(--gold)', color: 'var(--navy)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
            Download Report PDF
          </button>
          <button onClick={() => exportToJSON(record)} className="px-6 py-2.5 rounded-lg font-bold text-sm" style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
            Export JSON
          </button>
        </div>
      </Card>
    </div>
  );
}
