import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useScreeningStore } from '@/store/screeningStore';
import type { ScreeningInputs, UploadedDocument } from '@/engine/types';

const VERTICALS = [
  'Restaurant Tech', 'Healthcare IT', 'Legal Tech', 'HR Tech', 'FinTech', 'PropTech',
  'InsurTech', 'EdTech', 'AgTech', 'Construction Tech', 'Supply Chain', 'Retail Tech',
  'Field Service', 'Logistics', 'Cybersecurity', 'Marketing Tech', 'Sales Tech', 'Other',
];

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export function NewScreeningPage() {
  const navigate = useNavigate();
  const { startScreening } = useScreeningStore();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [vertical, setVertical] = useState('');
  const [competitorHints, setCompetitorHints] = useState<string[]>([]);
  const [hintInput, setHintInput] = useState('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = 'Company name is required';
    if (!companyUrl.trim()) e.companyUrl = 'Company URL is required';
    else if (!isValidUrl(companyUrl.trim())) e.companyUrl = 'Please enter a valid URL (e.g. https://example.com)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddHint = () => {
    const h = hintInput.trim();
    if (h && !competitorHints.includes(h) && competitorHints.length < 10) {
      setCompetitorHints([...competitorHints, h]);
      setHintInput('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files.slice(0, 3)) {
      if (file.size > 25 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        // Try to parse document via API
        try {
          const res = await fetch('/api/document-parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content_base64: base64, filename: file.name, content_type: file.type }),
          });
          const data = await res.json();
          setDocuments(prev => [...prev, {
            name: file.name,
            type: file.type,
            size: file.size,
            text_content: data.text || '',
          }]);
        } catch {
          setDocuments(prev => [...prev, { name: file.name, type: file.type, size: file.size }]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleStart = () => {
    if (!validate()) return;
    const inputs: ScreeningInputs = {
      company_name: companyName.trim(),
      company_url: companyUrl.trim(),
      vertical: vertical || undefined,
      competitor_hints: competitorHints,
      confidence_threshold: confidenceThreshold,
      use_cached_heat_index: true,
      documents,
    };
    const jobId = startScreening(inputs);
    navigate(`/progress/${jobId}`);
  };

  const inputStyle = (hasError?: boolean) => ({
    background: 'rgba(0,58,99,0.4)',
    border: `1px solid ${hasError ? '#D32F2F' : 'rgba(197,165,114,0.3)'}`,
    color: '#ffffff',
    fontFamily: 'Inter',
    borderRadius: '10px',
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    fontSize: '0.9rem',
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            STEP {step} OF 3
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat' }}>
            {step === 1 ? 'Company Identification' : step === 2 ? 'Context & Documents' : 'Screening Configuration'}
          </h1>
          <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Inter' }}>
            {step === 1 ? 'Enter the company you want to screen' : step === 2 ? 'Optional: upload documents and add competitor hints' : 'Configure screening parameters'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-all"
              style={{ background: s <= step ? '#C5A572' : 'rgba(197,165,114,0.2)' }}
            />
          ))}
        </div>

        <div
          className="rounded-xl p-8"
          style={{ background: '#001A2E', border: '1px solid rgba(197,165,114,0.2)' }}
        >
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  COMPANY NAME *
                </label>
                <input
                  style={inputStyle(!!errors.companyName)}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Toast, Procore, Veeva Systems"
                  autoFocus
                />
                {errors.companyName && <p className="mt-1 text-xs" style={{ color: '#D32F2F' }}>{errors.companyName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  COMPANY URL *
                </label>
                <input
                  style={inputStyle(!!errors.companyUrl)}
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  type="url"
                />
                {errors.companyUrl && <p className="mt-1 text-xs" style={{ color: '#D32F2F' }}>{errors.companyUrl}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  VERTICAL (optional — inferred if blank)
                </label>
                <select
                  style={{ ...inputStyle(), background: 'rgba(0,58,99,0.4)' }}
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                >
                  <option value="">Auto-detect vertical</option>
                  {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  DOCUMENT UPLOAD (PDF/TXT, up to 3 files, 25MB each)
                </label>
                <div
                  className="rounded-lg p-8 text-center cursor-pointer border-dashed transition-colors"
                  style={{ border: '2px dashed rgba(197,165,114,0.3)', background: 'rgba(0,58,99,0.2)' }}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>
                    Click to upload pitch decks, CIMs, or data room docs
                  </div>
                  <div className="text-xs text-gray-600 mt-1">PDF, DOCX, TXT supported</div>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.txt,.docx"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.2)' }}>
                        <span className="text-green-400 text-sm">✓</span>
                        <span className="text-sm text-white flex-1 truncate" style={{ fontFamily: 'Inter' }}>{doc.name}</span>
                        <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => setDocuments(d => d.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  COMPETITOR HINTS (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    style={{ ...inputStyle(), flex: 1 }}
                    value={hintInput}
                    onChange={(e) => setHintInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHint())}
                    placeholder="Add a competitor name and press Enter"
                  />
                  <button
                    onClick={handleAddHint}
                    className="px-4 rounded-lg font-semibold text-sm"
                    style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)' }}
                  >
                    Add
                  </button>
                </div>
                {competitorHints.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {competitorHints.map((h, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
                        style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)' }}
                      >
                        {h}
                        <button onClick={() => setCompetitorHints(c => c.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold mb-3 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  CONFIDENCE THRESHOLD
                </label>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#CFFF04' }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Low (0)</span>
                  <span style={{ color: '#CFFF04' }}>{confidenceThreshold.toFixed(1)}</span>
                  <span>High (1.0)</span>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(197,165,114,0.05)', border: '1px solid rgba(197,165,114,0.2)' }}>
                <div className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>SCREENING SUMMARY</div>
                <div className="space-y-2 text-sm" style={{ fontFamily: 'Inter' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Company</span>
                    <span className="text-white font-semibold">{companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">URL</span>
                    <span className="text-gray-300 font-mono text-xs">{companyUrl}</span>
                  </div>
                  {vertical && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Vertical</span>
                      <span className="text-white">{vertical}</span>
                    </div>
                  )}
                  {competitorHints.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Competitors</span>
                      <span className="text-white">{competitorHints.join(', ')}</span>
                    </div>
                  )}
                  {documents.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Documents</span>
                      <span className="text-white">{documents.length} uploaded</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated time</span>
                    <span style={{ color: '#CFFF04' }}>≈ 2–3 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && !validate()) return;
                setStep(s => s + 1);
              }}
              className="px-8 py-2.5 rounded-lg font-bold text-sm"
              style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="px-8 py-3 rounded-xl font-bold text-sm tracking-wide"
              style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
            >
              🦅 Start Eagle Vision Screening
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
