import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

// Eagle image hosted on Genspark
const EAGLE_IMG = 'https://www.genspark.ai/api/files/s/Ntlkg11C';

export function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await login(passcode.trim());
      if (ok) {
        navigate('/dashboard');
      } else {
        setError('Invalid passcode. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--navy)', fontFamily: 'var(--font-display)' }}
    >
      {/* ── LEFT PANEL — Hero / Brand ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #020F1A 0%, #041828 40%, #051E35 100%)' }}
      >
        {/* Teal edge glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 60% 50%, rgba(0,200,220,0.07) 0%, transparent 70%)',
          }}
        />

        {/* Eagle image — centred, large */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={EAGLE_IMG}
            alt="Perch — AI Investment Screener"
            className="w-[480px] max-w-[80%] opacity-90"
            style={{ filter: 'drop-shadow(0 0 60px rgba(0,200,220,0.35))' }}
          />
        </div>

        {/* Top wordmark */}
        <div className="relative z-10 p-10">
          <div className="flex items-baseline gap-2">
            <span
              style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: 'var(--gold-bright)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              PERCH
            </span>
            <span
              className="text-xs font-medium tracking-widest"
              style={{ color: 'rgba(0,200,220,0.5)', letterSpacing: '0.2em' }}
            >
              BY AQL GROWTH
            </span>
          </div>
        </div>

        {/* Bottom tagline + feature bullets */}
        <div className="relative z-10 p-10 pb-12">
          <h1
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: '2.8rem', lineHeight: 1.1, color: '#F0F4F8', marginBottom: '1rem' }}
          >
            See further.<br />
            Decide faster.<br />
            <span style={{ color: 'var(--teal-bright)' }}>Invest smarter.</span>
          </h1>
          <p className="text-sm mb-8" style={{ color: '#7A90A4', lineHeight: 1.7 }}>
            Perch is an AI-powered investment screening platform for vertical SaaS.<br />
            In under 50 minutes, get an ADVANCE / DILIGENCE signal backed by
            live web research, 7 structured data packs, and a 16-factor
            AI Risk &amp; Readiness scorecard.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '🔍', label: '5-Pass Research', sub: '84+ search queries' },
              { icon: '🧠', label: '7 AI Data Packs', sub: 'Claude Opus 4.7' },
              { icon: '📊', label: '16-Factor Score', sub: 'Deterministic engine' },
            ].map(f => (
              <div
                key={f.label}
                className="rounded-xl p-3"
                style={{
                  background: 'rgba(0,200,220,0.05)',
                  border: '1px solid rgba(0,200,220,0.12)',
                }}
              >
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-xs font-semibold text-white">{f.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#3D5166' }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-8 relative"
        style={{ background: 'var(--navy-mid)' }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center">
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: 'var(--gold-bright)', letterSpacing: '-0.02em' }}>
            PERCH
          </div>
          <div className="text-xs tracking-widest mt-1" style={{ color: '#3D5166', letterSpacing: '0.2em' }}>
            BY AQL GROWTH
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'var(--navy-card)',
              border: '1px solid rgba(0,200,220,0.18)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,200,220,0.06)',
            }}
          >
            {/* Header */}
            <div className="mb-8">
              <div className="text-xs font-medium tracking-widest mb-3" style={{ color: '#00C8DC', letterSpacing: '0.2em' }}>
                PARTNER ACCESS
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: '1.7rem', color: '#fff', lineHeight: 1.1 }}>
                Sign in to Perch
              </h2>
              <p className="text-sm mt-1" style={{ color: '#7A90A4' }}>
                Internal use — AQL Partners
              </p>
            </div>

            {/* Divider */}
            <div className="h-px mb-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,220,0.3), transparent)' }} />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                  style={{ color: '#00C8DC', letterSpacing: '0.15em' }}
                >
                  Passcode
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter your secure passcode"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-[#3D5166] outline-none transition-all"
                  style={{
                    background: 'rgba(0,200,220,0.04)',
                    border: `1px solid ${error ? '#E53935' : 'rgba(0,200,220,0.2)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    letterSpacing: '0.1em',
                  }}
                  autoFocus
                  onFocus={e => (e.target.style.borderColor = error ? '#E53935' : 'rgba(0,200,220,0.5)')}
                  onBlur={e => (e.target.style.borderColor = error ? '#E53935' : 'rgba(0,200,220,0.2)')}
                />
                {error && (
                  <p className="mt-2 text-xs" style={{ color: '#E53935' }}>{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !passcode.trim()}
                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all disabled:opacity-40"
                style={{
                  background: passcode.trim()
                    ? 'linear-gradient(135deg, #00B8CC, #00C8DC)'
                    : 'rgba(0,200,220,0.08)',
                  color: passcode.trim() ? '#020F1A' : '#3D5166',
                  boxShadow: passcode.trim() ? '0 0 24px rgba(0,200,220,0.3)' : 'none',
                  letterSpacing: '0.05em',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#020F1A] border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : 'Access Perch →'}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs" style={{ color: '#3D5166' }}>
            Perch v16 · Powered by Claude Opus 4.7 &amp; Tavily
          </p>
        </div>
      </div>
    </div>
  );
}
