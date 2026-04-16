import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useArchiveStore } from '@/store/archiveStore';
import { DispositionBadge } from '@/components/ui/DispositionBadge';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { SignalChip } from '@/components/ui/SignalChip';
import { QuadrantPlot } from '@/components/ui/QuadrantPlot';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EagleIcon } from '@/components/brand/EagleIcon';
import { exportToPDF, exportToJSON } from '@/utils/export';
import type { ScreeningRecord, FactorScore, LetterGrade } from '@/engine/types';
import { FACTOR_NAMES } from '@/engine/types';

const GRADE_COLOR: Record<LetterGrade, string> = {
  A: '#1DB954', B: '#66BB6A', C: '#FFB300', D: '#F57C00', F: '#D32F2F',
};

type ReportTab = 'headline' | 'scorecard' | 'competitive' | 'evidence' | 'diligence';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'headline', label: 'Headline Grade' },
  { id: 'scorecard', label: '16-Factor Scorecard' },
  { id: 'competitive', label: 'Competitive Landscape' },
  { id: 'evidence', label: 'Evidence Log' },
  { id: 'diligence', label: 'Diligence List' },
];

export function ReportPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { getRecord } = useArchiveStore();
  const record = getRecord(jobId || '');
  const [activeTab, setActiveTab] = useState<ReportTab>('headline');
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);
  const [factorView, setFactorView] = useState<'all' | 'risk' | 'readiness'>('all');
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
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-500 hover:text-gray-300 mb-2 flex items-center gap-1 transition-colors">
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat' }}>
              {inputs.company_name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <a href={inputs.company_url} target="_blank" rel="noopener" className="text-xs font-mono" style={{ color: '#C5A572' }}>
                {inputs.company_url}
              </a>
              {inputs.vertical && <span className="text-xs text-gray-500">{inputs.vertical}</span>}
              <span className="text-xs text-gray-600 font-mono">{new Date(record.created_at).toLocaleDateString()}</span>
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
                fontFamily: 'Montserrat',
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

        {/* ─── Tab: Headline Grade ─── */}
        {activeTab === 'headline' && <HeadlineTab record={record} />}

        {/* ─── Tab: 16-Factor Scorecard ─── */}
        {activeTab === 'scorecard' && (
          <ScorecardTab
            record={record}
            factorView={factorView}
            setFactorView={setFactorView}
            expandedFactor={expandedFactor}
            setExpandedFactor={setExpandedFactor}
            noteMap={noteMap}
            setNoteMap={setNoteMap}
          />
        )}

        {/* ─── Tab: Competitive Landscape ─── */}
        {activeTab === 'competitive' && <CompetitiveTab record={record} />}

        {/* ─── Tab: Evidence Log ─── */}
        {activeTab === 'evidence' && (
          <EvidenceTab record={record} search={evidenceSearch} setSearch={setEvidenceSearch} />
        )}

        {/* ─── Tab: Diligence Shopping List ─── */}
        {activeTab === 'diligence' && <DiligenceTab record={record} />}
      </div>
    </AppShell>
  );
}

// ─── Headline Tab ─────────────────────────────────────────────────────────────
function HeadlineTab({ record }: { record: ScreeningRecord }) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  return (
    <div className="space-y-6 report-page">
      {/* Grade Triptych + Disposition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disposition */}
        <Card variant="elevated" className="flex flex-col items-center justify-center py-10">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            EAGLE VISION DISPOSITION
          </div>
          <DispositionBadge disposition={sb.disposition} confidence={sb.confidence_overall} size="lg" />
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>
              Computed {new Date(sb.computed_at).toLocaleString()}
            </div>
          </div>
        </Card>

        {/* Grade Triptych */}
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-6" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            SCORE BREAKDOWN
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <GradeBadge grade={sb.overall_grade} score={sb.overall_score} label="Overall" size="lg" />
            <GradeBadge grade={sb.risk_grade} score={sb.risk_score} label="AI Risk" size="lg" />
            <GradeBadge grade={sb.readiness_grade} score={sb.readiness_score} label="AI Readiness" size="lg" />
          </div>
          <div className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Inter' }}>
            Risk: lower is better · Readiness: higher is better
          </div>
        </Card>
      </div>

      {/* Quadrant + Lean-In/Hesitate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quadrant Plot */}
        <Card variant="navy" className="flex flex-col items-center">
          <QuadrantPlot
            riskScore={sb.risk_score}
            readinessScore={sb.readiness_score}
            quadrant={sb.quadrant}
            companyName={record.inputs.company_name}
          />
        </Card>

        {/* Lean-In & Hesitate */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <Card variant="navy">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-sm font-bold" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>Lean In</span>
            </div>
            <ul className="space-y-3">
              {sb.lean_in_reasons.length > 0 ? sb.lean_in_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter' }}>
                  <span style={{ color: '#1DB954' }}>→</span>
                  <span>{r}</span>
                </li>
              )) : (
                <li className="text-xs text-gray-600">Insufficient evidence for positive signals</li>
              )}
            </ul>
          </Card>
          <Card variant="navy">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-400 text-lg">⚠</span>
              <span className="text-sm font-bold" style={{ color: '#FFB300', fontFamily: 'Montserrat' }}>Hesitate</span>
            </div>
            <ul className="space-y-3">
              {sb.hesitate_reasons.length > 0 ? sb.hesitate_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter' }}>
                  <span style={{ color: '#FFB300' }}>→</span>
                  <span>{r}</span>
                </li>
              )) : (
                <li className="text-xs text-gray-600">No significant hesitation signals detected</li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      {/* Red Flag Radar */}
      {(() => {
        const allFlags = Object.values(record.data_packs).flatMap(p => p?.red_flags || []);
        if (allFlags.length === 0) return null;
        return (
          <Card variant="navy" goldAccent>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-400 text-lg">🚨</span>
              <span className="text-sm font-bold" style={{ color: '#D32F2F', fontFamily: 'Montserrat' }}>Red Flag Radar</span>
            </div>
            <div className="space-y-2">
              {allFlags.map((flag, i) => (
                <div key={i} className="flex gap-2 items-start text-xs py-2 px-3 rounded" style={{ background: 'rgba(211,47,47,0.1)', color: '#EF5350', fontFamily: 'Inter' }}>
                  <span className="shrink-0">⚑</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── Scorecard Tab ────────────────────────────────────────────────────────────
function ScorecardTab({
  record, factorView, setFactorView, expandedFactor, setExpandedFactor, noteMap, setNoteMap
}: {
  record: ScreeningRecord;
  factorView: 'all' | 'risk' | 'readiness';
  setFactorView: (v: 'all' | 'risk' | 'readiness') => void;
  expandedFactor: string | null;
  setExpandedFactor: (f: string | null) => void;
  noteMap: Record<string, string>;
  setNoteMap: (m: Record<string, string>) => void;
}) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const riskFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('R'));
  const readinessFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('A'));
  const displayFactors = factorView === 'risk' ? riskFactors : factorView === 'readiness' ? readinessFactors : sb.factor_scores;

  return (
    <div className="space-y-4 report-page">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat' }}>16-Factor Report Card</h2>
          <p className="text-xs text-gray-500 mt-1">LLMs produced evidence · Deterministic code produced these scores</p>
        </div>
        <div className="flex gap-1">
          {(['all', 'risk', 'readiness'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFactorView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: factorView === v ? '#C5A572' : 'rgba(197,165,114,0.1)',
                color: factorView === v ? '#002B49' : '#C5A572',
                border: '1px solid rgba(197,165,114,0.3)',
                fontFamily: 'Montserrat',
              }}
            >
              {v === 'all' ? 'All' : v === 'risk' ? 'Risk (R1–R7)' : 'Readiness (A1–A9)'}
            </button>
          ))}
        </div>
      </div>

      {/* Factor Rows */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,165,114,0.2)' }}>
        {displayFactors.map((f, i) => (
          <FactorRow
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
}

function FactorRow({ factor, isEven, isExpanded, onToggle, note, onNoteChange }: {
  factor: FactorScore;
  isEven: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  note?: string;
  onNoteChange: (n: string) => void;
}) {
  const isRisk = factor.factor_id.startsWith('R');
  const scoreDisplay = isRisk ? `${factor.raw_score} / HIGH RISK` : `${factor.raw_score}`;

  return (
    <div style={{
      background: factor.is_critical_gap ? 'rgba(245,124,0,0.08)' : isEven ? 'rgba(0,26,46,0.5)' : 'transparent',
      borderBottom: '1px solid rgba(197,165,114,0.1)',
      borderLeft: factor.is_critical_gap ? '4px solid #F57C00' : '4px solid transparent',
    }}>
      {/* Main Row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(197,165,114,0.04)] transition-colors"
        onClick={onToggle}
      >
        <div className="w-8 text-xs font-bold font-mono" style={{ color: '#C5A572' }}>{factor.factor_id}</div>
        <div className="flex-1 text-sm text-white" style={{ fontFamily: 'Montserrat', fontWeight: 600 }}>
          {factor.factor_name}
        </div>
        <div className="text-xs text-gray-500 w-12 text-right font-mono">{(factor.weight * 100).toFixed(0)}%</div>
        <div className="w-16 text-right">
          <span className="text-sm font-bold font-mono" style={{ color: GRADE_COLOR[factor.letter_grade] }}>
            {factor.raw_score.toFixed(0)}
          </span>
        </div>
        <div className="w-8">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${GRADE_COLOR[factor.letter_grade]}20`, color: GRADE_COLOR[factor.letter_grade], fontFamily: 'Montserrat' }}
          >
            {factor.letter_grade}
          </span>
        </div>
        <div className="w-16">
          <SignalChip confidence={factor.confidence} />
        </div>
        <div className="flex-1 text-xs text-gray-400 truncate max-w-[200px]" style={{ fontFamily: 'Inter' }}>
          {factor.evidence_summary?.slice(0, 60)}...
        </div>
        {factor.is_critical_gap && (
          <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(245,124,0,0.2)', color: '#F57C00' }}>
            CRITICAL GAP
          </span>
        )}
        <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded Row */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>EVIDENCE SUMMARY</div>
              <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                {factor.evidence_summary || 'No evidence collected.'}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>RUBRIC APPLIED</div>
              <p className="text-xs text-gray-400 font-mono" style={{ lineHeight: 1.6 }}>
                {factor.rubric_applied}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-gray-500" style={{ fontFamily: 'Montserrat' }}>Pack source:</span>
            <span className="text-xs font-mono" style={{ color: '#C5A572' }}>{factor.pack_source}</span>
          </div>

          {/* Partner Note */}
          <div className="mt-4">
            <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'Montserrat' }}>PARTNER NOTE</div>
            <textarea
              value={note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Add your analysis or dispute this score..."
              rows={2}
              className="w-full px-3 py-2 rounded text-xs text-white resize-none outline-none"
              style={{ background: 'rgba(197,165,114,0.06)', border: '1px solid rgba(197,165,114,0.2)', fontFamily: 'Inter', color: 'white' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Competitive Tab ──────────────────────────────────────────────────────────
function CompetitiveTab({ record }: { record: ScreeningRecord }) {
  const pack = record.data_packs.competitive_landscape;
  if (!pack) {
    return (
      <div className="text-center py-12 text-gray-400">
        Competitive Landscape data not available for this screening.
      </div>
    );
  }

  const heatIndex = pack.findings.find(f => f.key === 'vertical_heat_index')?.value as any;
  const entrants = pack.findings.find(f => f.key === 'ai_native_entrants')?.value as any[] || [];
  const incumbents = pack.findings.find(f => f.key === 'incumbent_postures')?.value as any[] || [];
  const horizontalThreat = pack.findings.find(f => f.key === 'horizontal_ai_threat')?.value as any;
  const news = pack.findings.find(f => f.key === 'recent_vertical_news')?.value as any[] || [];

  return (
    <div className="space-y-6 report-page">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vertical Heat Index */}
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            VERTICAL HEAT INDEX
          </div>
          {heatIndex ? (
            <div className="text-center py-4">
              <div className="text-5xl font-bold mb-2" style={{ color: GRADE_COLOR[heatIndex.grade as LetterGrade] || '#C5A572', fontFamily: 'Montserrat' }}>
                {heatIndex.grade}
              </div>
              <div className="text-2xl font-mono mb-3" style={{ color: GRADE_COLOR[heatIndex.grade as LetterGrade] || '#C5A572' }}>
                {heatIndex.score}/100
              </div>
              {/* Thermometer */}
              <div className="relative h-3 rounded-full mx-4 mb-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{
                    width: `${heatIndex.score}%`,
                    background: heatIndex.score > 70 ? '#D32F2F' : heatIndex.score > 50 ? '#FFB300' : '#1DB954',
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center" style={{ fontFamily: 'Inter' }}>
                {heatIndex.summary}
              </p>
            </div>
          ) : (
            <div className="text-gray-600 text-xs text-center py-8">Data not collected</div>
          )}
        </Card>

        {/* Horizontal AI Threat */}
        <Card variant="navy" className="lg:col-span-2">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            HORIZONTAL AI ENCROACHMENT
          </div>
          {horizontalThreat ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{
                    background: horizontalThreat.level === 'HIGH' ? 'rgba(211,47,47,0.15)' : horizontalThreat.level === 'MEDIUM' ? 'rgba(255,179,0,0.15)' : 'rgba(29,185,84,0.15)',
                    color: horizontalThreat.level === 'HIGH' ? '#D32F2F' : horizontalThreat.level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                    fontFamily: 'Montserrat',
                  }}
                >
                  {horizontalThreat.level} RISK
                </span>
                <span className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>from horizontal AI platforms</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(horizontalThreat.threat_actors || []).map((actor: string) => (
                  <span key={actor} className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'rgba(197,165,114,0.1)', color: '#C5A572' }}>
                    {actor}
                  </span>
                ))}
              </div>
              {horizontalThreat.use_cases_at_risk?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'Montserrat' }}>Use cases at risk:</div>
                  <ul className="space-y-1">
                    {horizontalThreat.use_cases_at_risk.map((uc: string, i: number) => (
                      <li key={i} className="text-xs text-gray-400 flex gap-2">
                        <span style={{ color: '#F57C00' }}>→</span>
                        {uc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-xs">No data collected</div>
          )}
        </Card>
      </div>

      {/* Incumbent Posture Grid */}
      {incumbents.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            INCUMBENT AI POSTURE
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incumbents.map((inc: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(0,43,73,0.5)',
                  border: `1px solid ${inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.3)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.3)' : 'rgba(100,116,139,0.3)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{inc.company}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-bold"
                    style={{
                      background: inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.2)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.2)' : 'rgba(100,116,139,0.2)',
                      color: inc.status === 'ACTIVE' ? '#D32F2F' : inc.status === 'SIGNALING' ? '#FFB300' : '#64748B',
                      fontFamily: 'Montserrat',
                    }}
                  >
                    {inc.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>{inc.evidence}</p>
                {inc.url && (
                  <a href={inc.url} target="_blank" rel="noopener" className="text-xs font-mono mt-2 block truncate" style={{ color: '#C5A572' }}>
                    {inc.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI-Native Entrant Table */}
      {entrants.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            AI-NATIVE ENTRANT THREAT MATRIX
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                  {['Company', 'Founded', 'Stage', 'Last Raise', 'Traction', 'Threat Level'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wider" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entrants.map((e: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)' }}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-white text-xs" style={{ fontFamily: 'Montserrat' }}>{e.company}</div>
                      {e.url && <a href={e.url} target="_blank" rel="noopener" className="text-xs font-mono truncate block" style={{ color: '#C5A572' }}>{e.url?.slice(0, 30)}</a>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{e.founded || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300">{e.stage || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 font-mono">{e.last_raise || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[140px]">{e.traction_signal || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{
                          background: e.threat_level === 'HIGH' ? 'rgba(211,47,47,0.2)' : e.threat_level === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                          color: e.threat_level === 'HIGH' ? '#D32F2F' : e.threat_level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                          fontFamily: 'Montserrat',
                        }}
                      >
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

      {/* Vertical News Feed */}
      {news.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            VERTICAL NEWS FEED
          </div>
          <div className="space-y-3">
            {news.map((item: any, i: number) => (
              <div key={i} className="flex gap-3 items-start py-2 border-b border-[rgba(197,165,114,0.1)]">
                <div className="text-xs font-mono text-gray-600 shrink-0 w-20">{item.date || 'Unknown'}</div>
                <div className="flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    className="text-sm font-semibold text-white hover:text-[#C5A572] transition-colors"
                    style={{ fontFamily: 'Inter' }}
                  >
                    {item.headline}
                  </a>
                  {item.significance && (
                    <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter' }}>{item.significance}</p>
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

// ─── Evidence Tab ─────────────────────────────────────────────────────────────
function EvidenceTab({ record, search, setSearch }: {
  record: ScreeningRecord;
  search: string;
  setSearch: (s: string) => void;
}) {
  // Collect all source URLs from all packs
  const allSources: Array<{ url: string; pack: string; confidence: string; excerpt: string }> = [];
  for (const [packName, pack] of Object.entries(record.data_packs)) {
    if (!pack) continue;
    for (const finding of pack.findings) {
      for (const url of finding.sources) {
        if (url && url.startsWith('http')) {
          allSources.push({
            url,
            pack: packName,
            confidence: finding.confidence,
            excerpt: String(finding.value).slice(0, 100),
          });
        }
      }
    }
  }

  const filtered = allSources.filter(s =>
    !search || s.url.toLowerCase().includes(search.toLowerCase()) || s.pack.includes(search.toLowerCase())
  );

  const packCoverage = Object.entries(record.data_packs).filter(([, p]) => p && !p.v2_stub).length;
  const totalPacks = 7;
  const stubCount = Object.values(record.data_packs).filter(p => p?.v2_stub).length;

  return (
    <div className="space-y-6 report-page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sources', value: allSources.length },
          { label: 'Live Packs', value: packCoverage },
          { label: 'V2 Stubs', value: stubCount },
          { label: 'Coverage', value: `${Math.round((packCoverage / totalPacks) * 100)}%` },
        ].map((stat) => (
          <Card key={stat.label} variant="navy" padding="sm" className="text-center">
            <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Montserrat' }}>{stat.value}</div>
            <div className="text-xs text-gray-500 tracking-wider" style={{ fontFamily: 'Montserrat' }}>{stat.label.toUpperCase()}</div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sources by URL or pack name..."
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
          style={{
            background: 'rgba(0,58,99,0.4)',
            border: '1px solid rgba(197,165,114,0.2)',
            fontFamily: 'Inter',
          }}
        />
      </div>

      {/* Source Table */}
      {filtered.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,165,114,0.2)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#001A2E', borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                {['Source URL', 'Pack', 'Confidence', 'Excerpt'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)', background: i % 2 === 0 ? 'rgba(0,26,46,0.5)' : 'transparent' }}>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <a href={s.url} target="_blank" rel="noopener" className="font-mono truncate block hover:text-[#C5A572] transition-colors" style={{ color: '#64748B' }}>
                      {s.url.slice(0, 50)}...
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{s.pack.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5">
                    <SignalChip confidence={s.confidence as any} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[200px] truncate">{s.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 text-sm">
          {allSources.length === 0 ? 'No sources collected — API keys may not be configured.' : 'No results match your search.'}
        </div>
      )}

      {/* Known Unknowns */}
      {(() => {
        const unknowns = Object.entries(record.data_packs).flatMap(([packName, pack]) =>
          (pack?.findings || []).flatMap(f => f.unknowns.map(u => ({ unknown: u, pack: packName })))
        );
        if (unknowns.length === 0) return null;
        return (
          <Card variant="navy">
            <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
              KNOWN UNKNOWNS — SUGGESTED NEXT STEPS
            </div>
            <div className="space-y-2">
              {unknowns.map((u, i) => (
                <div key={i} className="flex gap-3 text-xs items-start">
                  <span className="text-gray-600 font-mono shrink-0">[{u.pack.replace('_', ' ')}]</span>
                  <span className="text-gray-400" style={{ fontFamily: 'Inter' }}>{u.unknown}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── Diligence Tab ────────────────────────────────────────────────────────────
function DiligenceTab({ record }: { record: ScreeningRecord }) {
  const areas = record.diligence_areas || [];
  const conditions = record.upgrade_break_conditions;
  const sb = record.score_bundle;

  return (
    <div className="space-y-6 report-page">
      {/* Focus Areas */}
      <div>
        <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
          DILIGENCE FOCUS AREAS
        </div>
        {areas.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">No diligence areas generated.</div>
        ) : (
          <div className="space-y-4">
            {areas.map((area, i) => (
              <Card key={i} variant="navy" goldAccent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>#{area.rank}</span>
                      <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{area.title}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{
                          background: area.priority === 'HIGH' ? 'rgba(211,47,47,0.2)' : area.priority === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                          color: area.priority === 'HIGH' ? '#D32F2F' : area.priority === 'MEDIUM' ? '#FFB300' : '#1DB954',
                          fontFamily: 'Montserrat',
                        }}
                      >
                        {area.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>WHY IT MATTERS</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{area.why_it_matters}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>WHAT TO TEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{area.what_to_test}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>EVIDENCE TO REQUEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{area.evidence_to_request}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade/Break Conditions */}
      {conditions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="navy" padding="sm">
            <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>
              ↑ UPGRADE TO GO
            </div>
            <ul className="space-y-2">
              {conditions.upgrade_to_go.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter' }}>
                  <span style={{ color: '#1DB954' }}>✓</span>{c}
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="navy" padding="sm">
            <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#FFB300', fontFamily: 'Montserrat' }}>
              ~ KEEPS MAYBE
            </div>
            <ul className="space-y-2">
              {conditions.keep_maybe.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter' }}>
                  <span style={{ color: '#FFB300' }}>~</span>{c}
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="navy" padding="sm">
            <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#D32F2F', fontFamily: 'Montserrat' }}>
              ↓ DROP TO NO-GO
            </div>
            <ul className="space-y-2">
              {conditions.drop_to_nogo.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter' }}>
                  <span style={{ color: '#D32F2F' }}>✕</span>{c}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Advance CTA */}
      <Card variant="elevated" className="text-center py-8">
        <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
          NEXT STEP
        </div>
        <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Montserrat' }}>
          Advance to Full Diligence
        </h3>
        <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto" style={{ fontFamily: 'Inter' }}>
          The Eagle Vision Screener is a fast-pass filter. Full Bridge diligence is authored post-first-meeting with management access and data room.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => exportToPDF()}
            className="px-6 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
          >
            Download Report PDF
          </button>
          <button
            onClick={() => exportToJSON(record)}
            className="px-6 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)', fontFamily: 'Montserrat' }}
          >
            Export JSON
          </button>
        </div>
      </Card>
    </div>
  );
}
