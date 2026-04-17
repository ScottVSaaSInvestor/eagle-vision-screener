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
  BUILD_MODE: '#C5A572',
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
  4: '#C5A572',
};

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
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: 'Montserrat' }}
            >
              Screening Archive
            </h1>
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>
              {entries.length} {entries.length === 1 ? 'screening' : 'screenings'} completed
            </p>
          </div>
          <button
            onClick={() => navigate('/new')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all`}
                  style={{
                    fontFamily: 'Montserrat',
                    background: filter === d ? (d === 'all' ? '#C5A572' : d === 'ADVANCE' ? '#1DB954' : d === 'DILIGENCE' ? '#00C8DC' : '#D32F2F') : 'rgba(255,255,255,0.06)',
                    color: filter === d ? (d === 'all' ? '#002B49' : '#002B49') : '#94A3B8',
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
              className="px-3 py-1.5 rounded-lg text-xs ml-auto"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94A3B8',
                fontFamily: 'Inter',
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
            <EagleIcon size={80} color="rgba(197,165,114,0.3)" />
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Montserrat' }}>
                No screenings yet
              </div>
              <div className="text-sm text-gray-500 mb-6" style={{ fontFamily: 'Inter' }}>
                Start your first Eagle Vision screening to build your archive
              </div>
              <button
                onClick={() => navigate('/new')}
                className="px-8 py-3 rounded-xl font-bold text-sm tracking-wide"
                style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
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
            style={{ border: '1px solid rgba(197,165,114,0.2)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ background: '#001A2E', borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                  {['Company', 'Vertical', 'Date', 'AI Threat', 'Stage', 'Disposition', 'Quadrant', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold tracking-widest"
                      style={{ color: '#C5A572', fontFamily: 'Montserrat' }}
                    >
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.job_id}
                    className="cursor-pointer transition-colors hover:bg-[rgba(197,165,114,0.05)]"
                    style={{ background: i % 2 === 0 ? 'rgba(0,26,46,0.5)' : 'transparent', borderBottom: '1px solid rgba(197,165,114,0.1)' }}
                    onClick={() => navigate(`/report/${entry.job_id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white text-sm" style={{ fontFamily: 'Montserrat' }}>
                        {entry.company_name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[140px]">
                        {entry.company_url}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>
                      {entry.vertical || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.threat_level ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                          background: `${THREAT_COLORS[entry.threat_level]}20`,
                          color: THREAT_COLORS[entry.threat_level],
                          fontFamily: 'Montserrat',
                        }}>
                          {entry.threat_level}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.readiness_stage ? (
                        <span className="text-xs font-bold" style={{ color: STAGE_COLORS[entry.readiness_stage], fontFamily: 'Montserrat' }}>
                          Stage {entry.readiness_stage}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
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
                          className="text-xs font-semibold"
                          style={{ color: QUADRANT_COLORS[entry.quadrant], fontFamily: 'Montserrat' }}
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
                          style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteRecord(entry.job_id)}
                          className="text-xs px-3 py-1 rounded transition-colors"
                          style={{ background: 'rgba(211,47,47,0.1)', color: '#D32F2F', border: '1px solid rgba(211,47,47,0.2)' }}
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
