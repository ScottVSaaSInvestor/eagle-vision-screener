import type { LetterGrade } from '@/engine/types';

const GRADE_COLORS: Record<LetterGrade, { bg: string; text: string; border: string }> = {
  A: { bg: 'rgba(29,185,84,0.15)', text: '#1DB954', border: '#1DB954' },
  B: { bg: 'rgba(102,187,106,0.15)', text: '#66BB6A', border: '#66BB6A' },
  C: { bg: 'rgba(255,179,0,0.15)', text: '#FFB300', border: '#FFB300' },
  D: { bg: 'rgba(245,124,0,0.15)', text: '#F57C00', border: '#F57C00' },
  F: { bg: 'rgba(211,47,47,0.15)', text: '#D32F2F', border: '#D32F2F' },
};

interface GradeBadgeProps {
  grade: LetterGrade;
  score?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function GradeBadge({ grade, score, label, size = 'md' }: GradeBadgeProps) {
  const { bg, text, border } = GRADE_COLORS[grade];
  const sizeCls = {
    sm: 'text-lg w-10 h-10',
    md: 'text-2xl w-14 h-14',
    lg: 'text-4xl w-20 h-20',
    xl: 'text-5xl w-24 h-24',
  }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
          {label}
        </div>
      )}
      <div
        className={`${sizeCls} rounded-xl flex items-center justify-center font-bold`}
        style={{ background: bg, border: `2px solid ${border}`, color: text, fontFamily: 'JetBrains Mono, monospace' }}
      >
        {grade}
      </div>
      {score !== undefined && (
        <div className="text-xs font-mono" style={{ color: text }}>
          {score.toFixed(1)}
        </div>
      )}
    </div>
  );
}
