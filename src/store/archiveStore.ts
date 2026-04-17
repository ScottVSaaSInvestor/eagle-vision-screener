import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreeningRecord, ArchiveEntry } from '@/engine/types';
import { AXISCARE_RECORD } from '@/data/axisCareRecord';

const MAX_ARCHIVE_SIZE = 50;

// ─── Seed versioning ──────────────────────────────────────────────────────────
// Bump SEED_VERSION whenever the AxisCare record changes materially.
// The store checks whether the seeded record's job_id is present;
// if not (first load or after clearAll) it inserts the seed automatically.
const AXISCARE_JOB_ID = AXISCARE_RECORD.job_id;

interface ArchiveState {
  records: Record<string, ScreeningRecord>;
  saveRecord: (record: ScreeningRecord) => void;
  getRecord: (jobId: string) => ScreeningRecord | undefined;
  deleteRecord: (jobId: string) => void;
  getArchiveEntries: () => ArchiveEntry[];
  clearAll: () => void;
  ensureSeed: () => void;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set, get) => ({
      records: {},

      ensureSeed: () => {
        const { records } = get();
        // Insert AxisCare seed record if it's not already present
        if (!records[AXISCARE_JOB_ID]) {
          set((state) => ({
            records: { ...state.records, [AXISCARE_JOB_ID]: AXISCARE_RECORD },
          }));
        } else {
          // Always refresh seed record to pick up rubric/scoring changes
          set((state) => ({
            records: { ...state.records, [AXISCARE_JOB_ID]: AXISCARE_RECORD },
          }));
        }
      },

      saveRecord: (record: ScreeningRecord) => {
        set((state) => {
          const updated = { ...state.records, [record.job_id]: record };
          // Prune oldest if over limit
          const keys = Object.keys(updated).sort((a, b) => {
            return updated[a].created_at.localeCompare(updated[b].created_at);
          });
          while (keys.length > MAX_ARCHIVE_SIZE) {
            delete updated[keys.shift()!];
          }
          return { records: updated };
        });
      },

      getRecord: (jobId: string) => get().records[jobId],

      deleteRecord: (jobId: string) => {
        set((state) => {
          const updated = { ...state.records };
          delete updated[jobId];
          return { records: updated };
        });
      },

      getArchiveEntries: (): ArchiveEntry[] => {
        return Object.values(get().records)
          .map((r) => ({
            job_id: r.job_id,
            created_at: r.created_at,
            company_name: r.inputs.company_name,
            company_url: r.inputs.company_url,
            vertical: r.detected_vertical || r.inputs.vertical,
            overall_grade: r.score_bundle?.overall_grade,
            disposition: r.score_bundle?.disposition,
            confidence_overall: r.confidence_overall,
            status: r.status,
            risk_score: r.score_bundle?.risk_score,
            readiness_score: r.score_bundle?.readiness_score,
            threat_level: r.score_bundle?.threat_level,
            readiness_stage: r.score_bundle?.readiness_stage,
            quadrant: r.score_bundle?.quadrant,
          }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      },

      clearAll: () => {
        // clearAll removes all records but re-seeds AxisCare immediately
        set({ records: { [AXISCARE_JOB_ID]: AXISCARE_RECORD } });
      },
    }),
    {
      name: 'aql-archive',
      onRehydrateStorage: () => (state) => {
        // After hydration from localStorage, always refresh/ensure seed
        if (state) {
          state.ensureSeed();
        }
      },
    }
  )
);
