import { EagleIcon } from './EagleIcon';

interface AQLLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export function AQLLogo({ size = 'md', showWordmark = true, className = '' }: AQLLogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'md' ? 40 : 56;
  const titleSize = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-xl';
  const subtitleSize = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <EagleIcon size={iconSize} />
      {showWordmark && (
        <div>
          <div
            className={`${titleSize} font-bold tracking-wider text-white`}
            style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}
          >
            AQL GROWTH
          </div>
          <div
            className={`${subtitleSize} tracking-widest`}
            style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.2em', fontWeight: 500 }}
          >
            EAGLE VISION
          </div>
        </div>
      )}
    </div>
  );
}
