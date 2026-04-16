import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EagleIcon } from '@/components/brand/EagleIcon';
import { useAuthStore } from '@/store/authStore';

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
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #001A2E 0%, #002B49 50%, #003A63 100%)' }}
    >
      {/* Background eagle watermark */}
      <div className="fixed inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <EagleIcon size={500} color="#C5A572" />
      </div>

      <div
        className="w-full max-w-md relative"
        style={{
          background: '#001A2E',
          border: '1px solid rgba(197,165,114,0.3)',
          borderRadius: '20px',
          padding: '48px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <EagleIcon size={64} />
          <div className="text-center">
            <div
              className="text-2xl font-bold tracking-wider"
              style={{ fontFamily: 'Montserrat', color: '#ffffff', letterSpacing: '0.1em' }}
            >
              AQL GROWTH
            </div>
            <div
              className="text-sm tracking-widest mt-1"
              style={{ fontFamily: 'Montserrat', color: '#C5A572', letterSpacing: '0.25em', fontWeight: 600 }}
            >
              EAGLE VISION SCREENER
            </div>
          </div>
          <div
            className="text-xs text-center max-w-xs"
            style={{ color: '#64748B', fontFamily: 'Inter', lineHeight: 1.6 }}
          >
            AI-powered investment screening for vertical SaaS
          </div>
        </div>

        {/* Gold divider */}
        <div className="h-px mb-8" style={{ background: 'linear-gradient(90deg, transparent, #C5A572, transparent)' }} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              className="block text-xs font-semibold mb-2 tracking-widest uppercase"
              style={{ fontFamily: 'Montserrat', color: '#C5A572' }}
            >
              Access Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your secure passcode"
              className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 outline-none transition-all"
              style={{
                background: 'rgba(0,58,99,0.5)',
                border: `1px solid ${error ? '#D32F2F' : 'rgba(197,165,114,0.3)'}`,
                fontFamily: 'JetBrains Mono',
                fontSize: '0.9rem',
              }}
              autoFocus
              onFocus={(e) => (e.target.style.borderColor = error ? '#D32F2F' : '#C5A572')}
              onBlur={(e) => (e.target.style.borderColor = error ? '#D32F2F' : 'rgba(197,165,114,0.3)')}
            />
            {error && (
              <p className="mt-2 text-xs" style={{ color: '#D32F2F', fontFamily: 'Inter' }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            className="w-full py-3.5 rounded-lg font-bold text-sm tracking-wider transition-all active:scale-98 disabled:opacity-50"
            style={{
              background: passcode.trim() ? '#CFFF04' : '#1a3a1a',
              color: '#002B49',
              fontFamily: 'Montserrat',
              letterSpacing: '0.1em',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[#002B49] border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : 'Access Eagle Vision →'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs" style={{ color: '#334155', fontFamily: 'Inter' }}>
          Internal use only — AQL Growth Partners
        </div>
      </div>
    </div>
  );
}
