import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

// Placeholder — kept so TypeScript doesn't complain if referenced elsewhere
function HeroEagle({ color = 'rgba(0,200,220,0.85)' }: { color?: string }) {
  return (
    <svg viewBox="0 0 400 340" width="420" height="357" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 40px rgba(0,200,220,0.5)) drop-shadow(0 0 80px rgba(0,200,220,0.2))' }}>
      {/* ── Left wing — broad spread ── */}
      <path d="M200 170 L20 80 L10 110 L60 125 L5 140 L15 165 L70 155 L10 185 L30 205 L90 185 L45 220 L70 235 L130 200 L160 210 Z"
        fill={color} opacity="0.9"/>
      {/* Left wing feather tips */}
      <path d="M20 80 L0 60 L25 75 L10 110Z" fill={color} opacity="0.6"/>
      <path d="M5 140 L-10 125 L20 132 L15 165Z" fill={color} opacity="0.5"/>
      <path d="M10 185 L-5 175 L25 178 L30 205Z" fill={color} opacity="0.5"/>
      <path d="M45 220 L28 215 L55 210 L70 235Z" fill={color} opacity="0.6"/>
      {/* ── Right wing ── */}
      <path d="M200 170 L380 80 L390 110 L340 125 L395 140 L385 165 L330 155 L390 185 L370 205 L310 185 L355 220 L330 235 L270 200 L240 210 Z"
        fill={color} opacity="0.9"/>
      {/* Right wing feather tips */}
      <path d="M380 80 L400 60 L375 75 L390 110Z" fill={color} opacity="0.6"/>
      <path d="M395 140 L410 125 L380 132 L385 165Z" fill={color} opacity="0.5"/>
      <path d="M390 185 L405 175 L375 178 L370 205Z" fill={color} opacity="0.5"/>
      <path d="M355 220 L372 215 L345 210 L330 235Z" fill={color} opacity="0.6"/>
      {/* ── Body ── */}
      <ellipse cx="200" cy="195" rx="32" ry="52" fill={color} opacity="0.95"/>
      {/* ── Neck ── */}
      <ellipse cx="200" cy="150" rx="16" ry="22" fill={color} opacity="0.95"/>
      {/* ── Head ── */}
      <ellipse cx="200" cy="118" rx="22" ry="20" fill={color} opacity="0.95"/>
      {/* ── Beak ── */}
      <path d="M218 116 L242 124 L226 132 L218 122 Z" fill={color} opacity="0.95"/>
      <path d="M218 122 L235 130 L226 132 Z" fill="rgba(0,20,40,0.6)"/>
      {/* ── Eye ── */}
      <circle cx="212" cy="112" r="5" fill="rgba(0,10,20,0.8)"/>
      <circle cx="212" cy="112" r="3.5" fill="#C9A961"/>
      <circle cx="213" cy="111" r="1.5" fill="rgba(0,10,20,0.9)"/>
      <circle cx="213.5" cy="110.5" r="0.7" fill="rgba(255,255,255,0.8)"/>
      {/* ── Tail feathers ── */}
      <path d="M184 242 L170 295 L185 280 L200 300 L215 280 L230 295 L216 242 Z" fill={color} opacity="0.85"/>
      <path d="M178 248 L158 310 L172 290 Z" fill={color} opacity="0.6"/>
      <path d="M222 248 L242 310 L228 290 Z" fill={color} opacity="0.6"/>
      {/* ── Talons ── */}
      <path d="M185 242 L165 268 L170 258 L155 270 L162 260 L148 268" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M215 242 L235 268 L230 258 L245 270 L238 260 L252 268" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8"/>
      {/* Wing structure lines — give depth */}
      <path d="M200 170 L80 128 M200 170 L110 158 M200 170 L95 185" stroke="rgba(0,30,50,0.35)" strokeWidth="1.5" fill="none"/>
      <path d="M200 170 L320 128 M200 170 L290 158 M200 170 L305 185" stroke="rgba(0,30,50,0.35)" strokeWidth="1.5" fill="none"/>
      {/* Chest detail */}
      <path d="M185 168 Q200 180 215 168 Q210 210 200 230 Q190 210 185 168Z" fill="rgba(0,30,50,0.2)"/>
    </svg>
  );
}

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

        {/* Eagle hero — centred, large */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/static/eagle-hero.png"
            alt=""
            aria-hidden="true"
            className="w-[460px] max-w-[80%]"
            style={{
              filter: 'drop-shadow(0 0 50px rgba(0,200,220,0.55)) drop-shadow(0 0 100px rgba(0,200,220,0.25))',
              opacity: 0.93,
            }}
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
