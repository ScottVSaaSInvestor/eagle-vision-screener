import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreeningRecord, ArchiveEntry } from '@/engine/types';

const MAX_ARCHIVE_SIZE = 50;

interface ArchiveState {
  records: Record<string, ScreeningRecord>;
  saveRecord: (record: ScreeningRecord) => void;
  getRecord: (jobId: string) => ScreeningRecord | undefined;
  deleteRecord: (jobId: string) => void;
  getArchiveEntries: () => ArchiveEntry[];
  clearAll: () => void;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set, get) => ({
      records: {},

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
            quadrant: r.score_bundle?.quadrant,
          }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      },

      clearAll: () => set({ records: {} }),
    }),
    {
      name: 'aql-archive',
    }
  )
);
