import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'lime' | 'gold' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'lime',
  size = 'md',
  children,
  loading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-4 text-base',
  }[size];

  const variantStyles: Record<string, React.CSSProperties> = {
    lime: { background: '#CFFF04', color: '#002B49', border: 'none' },
    gold: { background: 'transparent', color: '#C5A572', border: '1px solid #C5A572' },
    ghost: { background: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' },
    danger: { background: 'rgba(211,47,47,0.15)', color: '#D32F2F', border: '1px solid #D32F2F' },
    outline: { background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' },
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${sizeClasses} rounded-lg font-semibold cursor-pointer transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        fontFamily: 'Montserrat, sans-serif',
        ...variantStyles[variant],
      }}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  );
}
