import type { Confidence } from '@/engine/types';

interface SignalChipProps {
  confidence: Confidence;
  label?: string;
}

export function SignalChip({ confidence, label }: SignalChipProps) {
  const config = {
    H: { bg: 'rgba(29,185,84,0.15)', text: '#1DB954', border: '#1DB954', dot: '#1DB954' },
    M: { bg: 'rgba(255,179,0,0.15)', text: '#FFB300', border: '#FFB300', dot: '#FFB300' },
    L: { bg: 'rgba(100,116,139,0.15)', text: '#94A3B8', border: '#475569', dot: '#64748B' },
  }[confidence];

  const fullLabel = label || (confidence === 'H' ? 'HIGH' : confidence === 'M' ? 'MED' : 'LOW');

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium"
      style={{ background: config.bg, border: `1px solid ${config.border}`, color: config.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.dot }} />
      {fullLabel}
    </span>
  );
}
