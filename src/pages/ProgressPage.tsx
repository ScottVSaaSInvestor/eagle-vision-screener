import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useScreeningStore } from '@/store/screeningStore';
import { useArchiveStore } from '@/store/archiveStore';
import { runScreening } from '@/engine/orchestrator';
import type { PackName } from '@/engine/types';

const PACK_DISPLAY: Record<PackName, { label: string; icon: string; priority?: boolean }> = {
  company_profile: { label: 'Company Profile', icon: '🏢' },
  competitive_landscape: { label: 'Competitive Landscape', icon: '⚔️', priority: true },
  workflow_product: { label: 'Workflow & Product', icon: '⚙️' },
  data_architecture: { label: 'Data & Architecture', icon: '🗄️' },
  team_capability: { label: 'Team Capability', icon: '👥' },
  regulatory_moat: { label: 'Regulatory & Moat', icon: '🛡️' },
  market_timing: { label: 'Market & Timing', icon: '📈' },
};

const PACK_ORDER: PackName[] = [
  'company_profile', 'competitive_landscape', 'workflow_product',
  'data_architecture', 'team_capability', 'regulatory_moat', 'market_timing',
];

const STATUS_CONFIG = {
  queued: { dot: '#475569', label: 'Queued', bg: 'rgba(71,85,105,0.1)' },
  running: { dot: '#FFB300', label: 'Running...', bg: 'rgba(255,179,0,0.08)' },
  complete: { dot: '#1DB954', label: 'Complete', bg: 'rgba(29,185,84,0.08)' },
  failed: { dot: '#D32F2F', label: 'Failed', bg: 'rgba(211,47,47,0.08)' },
  stubbed: { dot: '#C5A572', label: 'V2 Stub', bg: 'rgba(197,165,114,0.08)' },
};

const STAGES = ['Broad Search (84q)', 'Deep Crawl (~75p)', 'Gap Fill ×2', 'Synthesize (7 dims)', 'Pack Analysis', 'Score'];

export function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const store = useScreeningStore();
  const archiveStore = useArchiveStore();
  const logRef = useRef<HTMLDivElement>(null);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const runStarted = useRef(false);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => store.tickElapsed(), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [store.progressLog]);

  // Start orchestration
  useEffect(() => {
    if (!store.currentRecord || runStarted.current) return;
    runStarted.current = true;

    const inputs = store.currentRecord.inputs;

    runScreening(
      inputs,
      (event) => store.addProgressEvent(event),
      (pack, data) => store.updatePack(pack, data),
      () => store.isAborted
    ).then((result) => {
      if (store.isAborted) return;
      const finalRecord = {
        ...store.currentRecord!,
        ...result,
        status: 'complete' as const,
        completed_at: new Date().toISOString(),
        confidence_overall: result.confidence_overall || 'L' as const,
      };
      store.setRecord(finalRecord);
      archiveStore.saveRecord(finalRecord);
      navigate(`/report/${jobId}`);
    }).catch((err) => {
      store.addProgressEvent({ message: `Screening failed: ${err?.message}`, level: 'error' });
    });
  }, [store.currentRecord?.job_id]);

  const elapsed = store.elapsedSeconds;
  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const completedPacks = Object.values(store.packStatuses).filter(s => s === 'complete' || s === 'stubbed').length;
  // Derive stage from progress log content for the multi-phase research pipeline
  const stageIndex = (() => {
    const log = store.progressLog.map(e => e.message).join('\n');
    if (log.includes('PHASE 7') || log.includes('SOAR Score')) return 5;
    if (log.includes('PHASE 6') || log.includes('AI Pack Analysis') || log.includes('Running 7 investment')) return 4;
    if (log.includes('PHASE 6') || log.includes('Evidence Synthesis') || log.includes('synthesis briefs complete') || log.includes('Synthesizing')) return 3;
    if (log.includes('PHASE 5') || log.includes('Second Gap-Fill') || log.includes('PHASE 4') || log.includes('Gap-Fill Search')) return 2;
    if (log.includes('PHASE 3') || log.includes('Gap Analysis')) return 2;
    if (log.includes('PHASE 2') || log.includes('Deep Web Crawl')) return 1;
    if (log.includes('PHASE 1') || log.includes('Broad Search')) return 0;
    if (completedPacks >= 7) return 5;
    return 0;
  })();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat' }}>
              {store.currentRecord?.inputs.company_name || 'Loading...'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FFB300' }} />
              <span className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>Screening in Progress</span>
              <span className="text-sm font-mono" style={{ color: '#C5A572' }}>{elapsedStr}</span>
            </div>
          </div>
          <button
            onClick={() => setShowAbortModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold abort-button"
            style={{ background: 'rgba(211,47,47,0.15)', color: '#D32F2F', border: '1px solid rgba(211,47,47,0.3)' }}
          >
            Abort
          </button>
        </div>

        {/* Stage Stepper */}
        <div className="flex gap-0 mb-8">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: i < stageIndex ? '#1DB954' : i === stageIndex ? '#FFB300' : 'rgba(71,85,105,0.3)',
                    color: i <= stageIndex ? '#002B49' : '#475569',
                    fontFamily: 'Montserrat',
                  }}
                >
                  {i < stageIndex ? '✓' : i + 1}
                </div>
                <span className="text-xs" style={{ color: i <= stageIndex ? '#C5A572' : '#475569', fontFamily: 'Montserrat' }}>
                  {stage}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-2" style={{ background: i < stageIndex ? '#1DB954' : 'rgba(71,85,105,0.3)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Pack Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {PACK_ORDER.map((pack) => {
            const status = store.packStatuses[pack];
            const config = STATUS_CONFIG[status];
            const info = PACK_DISPLAY[pack];
            const isRunning = status === 'running';

            return (
              <div
                key={pack}
                className={`rounded-xl p-4 relative ${info.priority ? 'col-span-1' : ''}`}
                style={{
                  background: config.bg,
                  border: `1px solid ${info.priority ? 'rgba(197,165,114,0.4)' : 'rgba(197,165,114,0.15)'}`,
                  transition: 'all 0.3s',
                }}
              >
                {info.priority && (
                  <div className="absolute -top-2 -right-2 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#C5A572', color: '#002B49', fontFamily: 'Montserrat' }}>
                    PRIORITY
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{info.icon}</span>
                  <div
                    className={`w-2 h-2 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
                    style={{ background: config.dot }}
                  />
                </div>
                <div className="text-xs font-semibold text-white" style={{ fontFamily: 'Montserrat' }}>
                  {info.label}
                </div>
                <div className="text-xs mt-1" style={{ color: config.dot, fontFamily: 'Inter' }}>
                  {config.label}
                </div>
                {status === 'complete' && store.currentRecord?.data_packs[pack] && (
                  <div className="text-xs mt-1 text-gray-500 font-mono">
                    {store.currentRecord.data_packs[pack]!.findings.length} findings
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Log */}
        <div
          className="rounded-xl"
          style={{ background: '#001A2E', border: '1px solid rgba(197,165,114,0.2)' }}
        >
          <div className="px-4 py-3 border-b border-[rgba(197,165,114,0.1)] flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
              LIVE RESEARCH LOG
            </span>
            <span className="text-xs font-mono text-gray-500">{store.progressLog.length} events</span>
          </div>
          <div
            ref={logRef}
            className="p-4 space-y-1 overflow-y-auto"
            style={{ maxHeight: '240px', minHeight: '120px' }}
          >
            {store.progressLog.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-4" style={{ fontFamily: 'Inter' }}>
                Initializing PERCH...
              </div>
            )}
            {store.progressLog.map((event, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="font-mono text-gray-600 shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: event.level === 'success' ? '#1DB954' :
                           event.level === 'error' ? '#D32F2F' :
                           event.level === 'warning' ? '#FFB300' : '#94A3B8',
                    fontFamily: 'JetBrains Mono',
                  }}
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Abort Modal */}
      {showAbortModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
          <div
            className="rounded-xl p-8 max-w-sm w-full mx-4"
            style={{ background: '#001A2E', border: '1px solid rgba(211,47,47,0.4)' }}
          >
            <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Montserrat' }}>Abort Screening?</h3>
            <p className="text-sm text-gray-400 mb-6" style={{ fontFamily: 'Inter' }}>
              This will stop the current screening. A partial report will be saved with LOW confidence flags.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAbortModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Continue Screening
              </button>
              <button
                onClick={() => {
                  store.abort();
                  if (store.currentRecord) {
                    archiveStore.saveRecord({ ...store.currentRecord, status: 'aborted', honesty_flag: true });
                  }
                  navigate('/dashboard');
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(211,47,47,0.2)', color: '#D32F2F', border: '1px solid rgba(211,47,47,0.4)' }}
              >
                Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
