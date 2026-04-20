import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { partnerName, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      {/* Header */}
      <header
        className="no-print sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{
          background: 'var(--navy-mid)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Brand mark */}
        <Link to="/dashboard" className="no-underline flex items-center gap-3">
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 500, color: 'var(--gold-bright)', lineHeight: 1 }}>Æ</div>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.22em', color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>AQL GROWTH</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>PERCH · AI Risk &amp; Readiness</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          <Link
            to="/dashboard"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: location.pathname === '/dashboard' ? 'var(--gold-bright)' : 'rgba(255,255,255,0.55)',
              transition: 'color 0.15s',
            }}
          >
            Archive
          </Link>
          <Link
            to="/new"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              padding: '8px 18px',
              background: 'var(--gold)',
              color: 'var(--navy)',
              borderRadius: 4,
              transition: 'background 0.15s',
            }}
          >
            + New Screening
          </Link>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
              {partnerName}
            </span>
            <button
              onClick={handleLogout}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer
        className="no-print py-5 px-8 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
          AQL Growth · PERCH · AI Risk &amp; Readiness Diagnostic · v2026.04
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
          Powered by Claude · Research by Tavily
        </div>
      </footer>
    </div>
  );
}
