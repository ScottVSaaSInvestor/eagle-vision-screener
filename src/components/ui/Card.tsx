import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'navy' | 'light' | 'glass' | 'elevated';
  goldAccent?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', variant = 'navy', goldAccent, padding = 'md' }: CardProps) {
  const padClasses = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }[padding];

  const variantClasses = {
    navy: 'bg-[#001A2E] border border-[rgba(197,165,114,0.2)]',
    light: 'bg-[#003A63] border border-[rgba(197,165,114,0.15)]',
    glass: 'bg-[rgba(0,43,73,0.7)] backdrop-blur-md border border-[rgba(197,165,114,0.25)]',
    elevated: 'bg-[#001A2E] border border-[rgba(197,165,114,0.3)] shadow-xl shadow-black/30',
  }[variant];

  return (
    <div
      className={`rounded-xl ${padClasses} ${variantClasses} ${goldAccent ? 'border-l-4 border-l-[#C5A572]' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
