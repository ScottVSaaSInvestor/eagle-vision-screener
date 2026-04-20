import type { Quadrant } from '@/engine/types';
import { EagleIcon } from '../brand/EagleIcon';

interface QuadrantPlotProps {
  riskScore: number;
  readinessScore: number;
  quadrant: Quadrant;
  companyName: string;
}

const QUADRANT_CONFIG: Record<Quadrant, { label: string; color: string; bg: string; sublabel: string }> = {
  EXECUTE:    { label: 'EXECUTE',     color: '#1DB954', bg: 'rgba(29,185,84,0.08)',   sublabel: 'Low risk · High readiness · Act now' },
  RACE_MODE:  { label: 'RACE MODE',   color: '#FFB300', bg: 'rgba(255,179,0,0.08)',   sublabel: 'High risk · High readiness · Move fast' },
  BUILD_MODE: { label: 'BUILD MODE',  color: '#00C8DC', bg: 'rgba(0,200,220,0.08)',   sublabel: 'Low risk · Open window · Build the AI layer' },
  DANGER_ZONE:{ label: 'DANGER ZONE', color: '#D32F2F', bg: 'rgba(211,47,47,0.08)',   sublabel: 'High risk · Readiness gaps · Deep diligence required' },
};

export function QuadrantPlot({ riskScore, readinessScore, quadrant, companyName }: QuadrantPlotProps) {
  const plotSize = 280;
  const padding = 40;
  const inner = plotSize - padding * 2;

  // X-axis = Threat/Risk (left=LOW, right=HIGH)
  // Y-axis = Readiness   (top=HIGH, bottom=LOW)  ← matches reference HTML layout
  const px = padding + (riskScore / 100) * inner;
  const py = padding + ((100 - readinessScore) / 100) * inner;

  const qConfig = QUADRANT_CONFIG[quadrant];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-semibold tracking-widest uppercase text-center" style={{ color: '#C5A572', fontFamily: 'JetBrains Mono, monospace' }}>
        SOAR Quadrant
      </div>
      <div className="relative" style={{ width: plotSize, height: plotSize }}>
        {/* Quadrant backgrounds */}
        <svg width={plotSize} height={plotSize} className="absolute inset-0">
          {/* Top-left: EXECUTE  (Low Risk, High Readiness) */}
          <rect x={padding}      y={padding}      width={inner/2} height={inner/2} fill="rgba(29,185,84,0.07)" />
          {/* Top-right: RACE MODE (High Risk, High Readiness) */}
          <rect x={plotSize/2}   y={padding}      width={inner/2} height={inner/2} fill="rgba(255,179,0,0.07)" />
          {/* Bottom-left: BUILD MODE (Low Risk, Low Readiness) */}
          <rect x={padding}      y={plotSize/2}   width={inner/2} height={inner/2} fill="rgba(0,200,220,0.06)" />
          {/* Bottom-right: DANGER ZONE (High Risk, Low Readiness) */}
          <rect x={plotSize/2}   y={plotSize/2}   width={inner/2} height={inner/2} fill="rgba(211,47,47,0.07)" />

          {/* Grid lines */}
          <line x1={plotSize/2} y1={padding} x2={plotSize/2} y2={plotSize-padding} stroke="rgba(197,165,114,0.2)" strokeWidth="1" strokeDasharray="4" />
          <line x1={padding} y1={plotSize/2} x2={plotSize-padding} y2={plotSize/2} stroke="rgba(197,165,114,0.2)" strokeWidth="1" strokeDasharray="4" />

          {/* Border */}
          <rect x={padding} y={padding} width={inner} height={inner} stroke="rgba(197,165,114,0.3)" strokeWidth="1" fill="none" />

          {/* Quadrant labels — match reference layout */}
          <text x={plotSize*0.25} y={plotSize*0.25+4} textAnchor="middle" fill="#1DB954"  fontSize="8" fontFamily="JetBrains Mono" fontWeight="700" opacity="0.8">EXECUTE</text>
          <text x={plotSize*0.75} y={plotSize*0.25+4} textAnchor="middle" fill="#FFB300"  fontSize="8" fontFamily="JetBrains Mono" fontWeight="700" opacity="0.8">RACE MODE</text>
          <text x={plotSize*0.25} y={plotSize*0.75+4} textAnchor="middle" fill="#00C8DC"  fontSize="8" fontFamily="JetBrains Mono" fontWeight="700" opacity="0.8">BUILD MODE</text>
          <text x={plotSize*0.75} y={plotSize*0.75+4} textAnchor="middle" fill="#D32F2F"  fontSize="8" fontFamily="JetBrains Mono" fontWeight="700" opacity="0.8">DANGER ZONE</text>

          {/* X-axis label: THREAT (bottom) — LOW on left, HIGH on right */}
          <text x={padding}      y={plotSize-6} textAnchor="start"   fill="rgba(197,165,114,0.7)" fontSize="7" fontFamily="JetBrains Mono">LOW THREAT</text>
          <text x={plotSize-padding} y={plotSize-6} textAnchor="end" fill="rgba(197,165,114,0.7)" fontSize="7" fontFamily="JetBrains Mono">HIGH THREAT</text>
          <text x={plotSize/2}   y={plotSize-6} textAnchor="middle"  fill="#C5A572" fontSize="8" fontFamily="JetBrains Mono" fontWeight="600">AI THREAT →</text>

          {/* Y-axis label: READINESS — HIGH on top, LOW on bottom */}
          <text x={10} y={padding}      textAnchor="middle" fill="rgba(197,165,114,0.7)" fontSize="7" fontFamily="JetBrains Mono" transform={`rotate(-90, 10, ${padding})`}>HIGH</text>
          <text x={10} y={plotSize-padding} textAnchor="middle" fill="rgba(197,165,114,0.7)" fontSize="7" fontFamily="JetBrains Mono" transform={`rotate(-90, 10, ${plotSize-padding})`}>LOW</text>
          <text x={12} y={plotSize/2} textAnchor="middle" fill="#C5A572" fontSize="8" fontFamily="JetBrains Mono" fontWeight="600" transform={`rotate(-90, 12, ${plotSize/2})`}>READINESS ↑</text>

          {/* Company dot */}
          <circle cx={px} cy={py} r={18} fill="rgba(0,43,73,0.9)" stroke={qConfig.color} strokeWidth="2" />
        </svg>

        {/* Eagle icon overlay */}
        <div
          className="absolute"
          style={{ left: px - 12, top: py - 12, transform: 'translate(0, 0)' }}
        >
          <EagleIcon size={24} color={qConfig.color} />
        </div>

        {/* Company name label */}
        <div
          className="absolute text-xs font-semibold px-2 py-0.5 rounded"
          style={{
            left: px + 20,
            top: py - 8,
            background: 'rgba(0,27,46,0.95)',
            border: `1px solid ${qConfig.color}`,
            color: qConfig.color,
            fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap',
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {companyName}
        </div>
      </div>

      {/* Quadrant label below */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="px-4 py-1.5 rounded-lg text-sm font-bold tracking-widest"
          style={{
            background: QUADRANT_CONFIG[quadrant].bg,
            border: `1px solid ${QUADRANT_CONFIG[quadrant].color}`,
            color: QUADRANT_CONFIG[quadrant].color,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {QUADRANT_CONFIG[quadrant].label}
        </div>
        <div className="text-xs opacity-60 text-center" style={{ color: QUADRANT_CONFIG[quadrant].color, fontFamily: 'Inter, sans-serif' }}>
          {QUADRANT_CONFIG[quadrant].sublabel}
        </div>
      </div>
    </div>
  );
}
