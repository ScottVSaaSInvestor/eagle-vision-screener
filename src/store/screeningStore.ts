import { create } from 'zustand';
import type {
  ScreeningRecord, ScreeningInputs, ProgressEvent,
  PackName, PackStatus, DataPack
} from '@/engine/types';

interface ScreeningState {
  currentRecord: ScreeningRecord | null;
  progressLog: ProgressEvent[];
  packStatuses: Record<PackName, PackStatus>;
  elapsedSeconds: number;
  isAborted: boolean;

  startScreening: (inputs: ScreeningInputs) => string;
  updatePackStatus: (pack: PackName, status: PackStatus) => void;
  updatePack: (pack: PackName, data: DataPack) => void;
  addProgressEvent: (event: Omit<ProgressEvent, 'timestamp'>) => void;
  setRecord: (record: ScreeningRecord) => void;
  tickElapsed: () => void;
  abort: () => void;
  reset: () => void;
}

const INITIAL_PACK_STATUSES: Record<PackName, PackStatus> = {
  company_profile: 'queued',
  competitive_landscape: 'queued',
  workflow_product: 'queued',
  data_architecture: 'queued',
  team_capability: 'queued',
  regulatory_moat: 'queued',
  market_timing: 'queued',
};

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useScreeningStore = create<ScreeningState>((set, get) => ({
  currentRecord: null,
  progressLog: [],
  packStatuses: { ...INITIAL_PACK_STATUSES },
  elapsedSeconds: 0,
  isAborted: false,

  startScreening: (inputs: ScreeningInputs) => {
    const job_id = generateJobId();
    const record: ScreeningRecord = {
      job_id,
      created_at: new Date().toISOString(),
      status: 'running',
      inputs,
      data_packs: {},
      evidence_log: [],
      disputes: [],
      confidence_overall: 'L',
    };
    set({
      currentRecord: record,
      progressLog: [],
      packStatuses: { ...INITIAL_PACK_STATUSES },
      elapsedSeconds: 0,
      isAborted: false,
    });
    return job_id;
  },

  updatePackStatus: (pack: PackName, status: PackStatus) => {
    set((state) => ({
      packStatuses: { ...state.packStatuses, [pack]: status },
    }));
  },

  updatePack: (pack: PackName, data: DataPack) => {
    set((state) => ({
      currentRecord: state.currentRecord
        ? {
            ...state.currentRecord,
            data_packs: { ...state.currentRecord.data_packs, [pack]: data },
          }
        : null,
      packStatuses: { ...state.packStatuses, [pack]: data.status },
    }));
  },

  addProgressEvent: (event) => {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      progressLog: [...state.progressLog, fullEvent],
    }));
  },

  setRecord: (record: ScreeningRecord) => {
    set({ currentRecord: record });
  },

  tickElapsed: () => {
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  abort: () => {
    set((state) => ({
      isAborted: true,
      currentRecord: state.currentRecord
        ? { ...state.currentRecord, status: 'aborted', honesty_flag: true }
        : null,
    }));
  },

  reset: () => {
    set({
      currentRecord: null,
      progressLog: [],
      packStatuses: { ...INITIAL_PACK_STATUSES },
      elapsedSeconds: 0,
      isAborted: false,
    });
  },
}));
