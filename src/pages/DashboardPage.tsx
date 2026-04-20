import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useArchiveStore } from '@/store/archiveStore';
import { DispositionBadge } from '@/components/ui/DispositionBadge';
import { SignalChip } from '@/components/ui/SignalChip';
import { EagleIcon } from '@/components/brand/EagleIcon';
import type { Quadrant, Disposition, ThreatLevel, ReadinessStage } from '@/engine/types';

const QUADRANT_COLORS: Record<Quadrant, string> = {
  EXECUTE: '#1DB954',
  RACE_MODE: '#FFB300',
  BUILD_MODE: '#2dd4bf',
  DANGER_ZONE: '#D32F2F',
};

const THREAT_COLORS: Record<ThreatLevel, string> = {
  LOW: '#1DB954',
  MODERATE: '#FFB300',
  HIGH: '#F57C00',
  CRITICAL: '#D32F2F',
};

const STAGE_COLORS: Record<ReadinessStage, string> = {
  1: '#64748B',
  2: '#FFB300',
  3: '#1DB954',
  4: '#c9a961',
};

/* ── Font shorthands ── */
const MONO: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'Cormorant Garamond, serif' };
const SANS: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

export function DashboardPage() {
  const navigate = useNavigate();
  const { getArchiveEntries, deleteRecord } = useArchiveStore();
  const entries = getArchiveEntries();

  const [filter, setFilter] = useState<'all' | Disposition>('all');
  const [sortBy, setSortBy] = useState<'date' | 'grade' | 'disposition'>('date');

  const filtered = entries
    .filter(e => filter === 'all' || e.disposition === filter)
    .sort((a, b) => {
      if (sortBy === 'date') return b.created_at.localeCompare(a.created_at);
      if (sortBy === 'grade') return (a.overall_grade || 'F').localeCompare(b.overall_grade || 'F');
      return 0;
    });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-white mb-1"
              style={{ ...SERIF, fontWeight: 500, fontSize: '2rem', lineHeight: 1.1 }}
            >
              Screening Archive
            </h1>
            <p className="text-sm" style={{ ...SANS, color: 'rgba(255,255,255,0.45)' }}>
              {entries.length} {entries.length === 1 ? 'screening' : 'screenings'} completed
            </p>
          </div>
          <button
            onClick={() => navigate('/new')}
            className="flex items-center gap-2 px-6 py-3 rounded transition-all hover:opacity-90 active:scale-95"
            style={{ ...SANS, background: 'var(--gold)', color: 'var(--navy)', fontWeight: 600, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            + New Screening
          </button>
        </div>

        {/* Filters */}
        {entries.length > 0 && (
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="flex gap-2">
              {(['all', 'ADVANCE', 'DILIGENCE', 'PASS'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={{
                    ...MONO,
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    background: filter === d
                      ? (d === 'all' ? 'var(--gold)' : d === 'ADVANCE' ? '#1DB954' : d === 'DILIGENCE' ? '#2dd4bf' : '#D32F2F')
                      : 'rgba(255,255,255,0.06)',
                    color: filter === d ? 'var(--navy)' : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${filter === d ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {d === 'all' ? 'All' : d}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded text-xs ml-auto"
              style={{
                ...SANS,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              <option value="date">Sort: Date</option>
              <option value="grade">Sort: Grade</option>
            </select>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <EagleIcon size={80} color="rgba(201,169,97,0.3)" />
            <div className="text-center">
              <div className="text-white mb-2" style={{ ...SERIF, fontWeight: 500, fontSize: '1.4rem' }}>
                No screenings yet
              </div>
              <div className="text-sm mb-6" style={{ ...SANS, color: 'rgba(255,255,255,0.45)' }}>
                Start your first PERCH screening to build your archive
              </div>
              <button
                onClick={() => navigate('/new')}
                className="px-8 py-3 rounded font-semibold text-sm tracking-wide"
                style={{ ...SANS, background: 'var(--gold)', color: 'var(--navy)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                + Start First Screening
              </button>
            </div>
          </div>
        )}

        {/* Archive Table */}
        {filtered.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(201,169,97,0.2)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--navy-mid)', borderBottom: '1px solid rgba(201,169,97,0.2)' }}>
                  {['Company', 'Vertical', 'Date', 'AI Threat', 'Stage', 'Disposition', 'Quadrant', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left"
                      style={{ ...MONO, fontSize: 10, letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.job_id}
                    className="cursor-pointer transition-colors hover:bg-[rgba(201,169,97,0.04)]"
                    style={{ background: i % 2 === 0 ? 'rgba(10,20,36,0.5)' : 'transparent', borderBottom: '1px solid rgba(201,169,97,0.08)' }}
                    onClick={() => navigate(`/report/${entry.job_id}`)}
                  >
                    <td className="px-4 py-3">
                      <div style={{ ...SANS, fontWeight: 600, color: '#fff', fontSize: 14 }}>
                        {entry.company_name}
                      </div>
                      <div style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.35)' }} className="truncate max-w-[140px]">
                        {entry.company_url}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ ...SANS, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                      {entry.vertical || '—'}
                    </td>
                    <td className="px-4 py-3" style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.threat_level ? (
                        <span style={{
                          ...MONO,
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 3,
                          background: `${THREAT_COLORS[entry.threat_level]}20`,
                          color: THREAT_COLORS[entry.threat_level],
                          textTransform: 'uppercase',
                        }}>
                          {entry.threat_level}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.readiness_stage ? (
                        <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: STAGE_COLORS[entry.readiness_stage] }}>
                          Stage {entry.readiness_stage}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.disposition ? (
                        <DispositionBadge disposition={entry.disposition} size="sm" />
                      ) : (
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: entry.status === 'running' ? 'rgba(255,179,0,0.15)' : 'rgba(100,116,139,0.15)',
                            color: entry.status === 'running' ? '#FFB300' : '#64748B',
                          }}
                        >
                          {entry.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.quadrant ? (
                        <span
                          style={{ ...MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: QUADRANT_COLORS[entry.quadrant], textTransform: 'uppercase' }}
                        >
                          {entry.quadrant.replace('_', ' ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/report/${entry.job_id}`)}
                          className="text-xs px-3 py-1 rounded transition-colors"
                          style={{ background: 'rgba(201,169,97,0.12)', color: 'var(--gold)', border: '1px solid rgba(201,169,97,0.3)' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteRecord(entry.job_id)}
                          className="text-xs px-3 py-1 rounded transition-colors"
                          style={{ background: 'rgba(211,47,47,0.08)', color: '#D32F2F', border: '1px solid rgba(211,47,47,0.2)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
