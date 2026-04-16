import type { Disposition, Confidence } from '@/engine/types';

const DISPOSITION_CONFIG: Record<Disposition, { bg: string; border: string; text: string; icon: string; label: string }> = {
  'GO': { bg: 'rgba(29,185,84,0.15)', border: '#1DB954', text: '#1DB954', icon: '✓', label: 'GO' },
  'MAYBE': { bg: 'rgba(255,179,0,0.15)', border: '#FFB300', text: '#FFB300', icon: '~', label: 'MAYBE' },
  'NO-GO': { bg: 'rgba(211,47,47,0.15)', border: '#D32F2F', text: '#D32F2F', icon: '✕', label: 'NO-GO' },
};

interface DispositionBadgeProps {
  disposition: Disposition;
  confidence?: Confidence;
  size?: 'sm' | 'md' | 'lg';
}

export function DispositionBadge({ disposition, confidence, size = 'md' }: DispositionBadgeProps) {
  const config = DISPOSITION_CONFIG[disposition];
  const padding = size === 'sm' ? 'px-3 py-1' : size === 'md' ? 'px-5 py-2' : 'px-8 py-4';
  const textSize = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : 'text-3xl';
  const iconSize = size === 'sm' ? 'text-base' : size === 'md' ? 'text-2xl' : 'text-4xl';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${padding} rounded-xl flex items-center gap-3 font-bold`}
        style={{
          background: config.bg,
          border: `2px solid ${config.border}`,
          color: config.text,
          fontFamily: 'Montserrat',
          letterSpacing: '0.15em',
        }}
      >
        <span className={iconSize}>{config.icon}</span>
        <span className={textSize}>{config.label}</span>
      </div>
      {confidence && (
        <div className="text-xs text-gray-400 font-mono tracking-wider">
          Confidence: {confidence === 'H' ? 'HIGH' : confidence === 'M' ? 'MEDIUM' : 'LOW'}
        </div>
      )}
    </div>
  );
}
