import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AQLLogo } from '../brand/AQLLogo';
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
    <div className="min-h-screen flex flex-col" style={{ background: '#002B49' }}>
      {/* Header */}
      <header className="app-header border-b border-[rgba(197,165,114,0.2)] px-6 py-3 flex items-center justify-between sticky top-0 z-50" style={{ background: '#001A2E' }}>
        <Link to="/dashboard" className="no-underline">
          <AQLLogo size="sm" />
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className={`text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'text-[#C5A572]' : 'text-gray-400 hover:text-white'}`}
            style={{ fontFamily: 'Montserrat' }}
          >
            Dashboard
          </Link>
          <Link
            to="/new"
            className="text-sm font-bold px-4 py-1.5 rounded-lg transition-colors"
            style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
          >
            + New Screening
          </Link>
          <div className="flex items-center gap-3 border-l border-[rgba(197,165,114,0.2)] pl-4">
            <span className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>
              {partnerName}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
      <footer className="border-t border-[rgba(197,165,114,0.1)] py-4 px-6 flex items-center justify-between no-print">
        <div className="text-xs text-gray-600" style={{ fontFamily: 'Inter' }}>
          PERCH by AQL — AI Risk &amp; Readiness Diagnostic
        </div>
        <div className="text-xs text-gray-600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          Powered by Claude · Research by Tavily
        </div>
      </footer>
    </div>
  );
}
