import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useArchiveStore } from '@/store/archiveStore';
import { DispositionBadge } from '@/components/ui/DispositionBadge';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { SignalChip } from '@/components/ui/SignalChip';
import { QuadrantPlot } from '@/components/ui/QuadrantPlot';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EagleIcon } from '@/components/brand/EagleIcon';
import { exportToPDF, exportToJSON } from '@/utils/export';
import type { ScreeningRecord, FactorScore, LetterGrade, PackName } from '@/engine/types';
import { FACTOR_NAMES } from '@/engine/types';

const GRADE_COLOR: Record<LetterGrade, string> = {
  A: '#1DB954', B: '#66BB6A', C: '#FFB300', D: '#F57C00', F: '#D32F2F',
};

type ReportTab = 'headline' | 'scorecard' | 'competitive' | 'evidence' | 'diligence';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'headline', label: '📊 Headline Grade' },
  { id: 'scorecard', label: '📋 16-Factor Scorecard' },
  { id: 'competitive', label: '⚔️ Competitive Landscape' },
  { id: 'evidence', label: '🔎 Evidence Log' },
  { id: 'diligence', label: '✅ Diligence Checklist' },
];

// ─── Narrative Helpers ────────────────────────────────────────────────────────

/** Returns a factor's evidence summary, cleaned of failure/default markers */
function cleanEvidence(ev: string | undefined): string {
  if (!ev) return '';
  if (ev.includes('Pack failed') || ev.includes('No evidence collected') || ev.includes('defaulting to neutral')) return '';
  return ev.trim();
}

function getDispositionNarrative(record: ScreeningRecord): string {
  const sb = record.score_bundle;
  if (!sb) return '';
  const co = record.inputs.company_name;
  const v = record.detected_vertical || record.inputs.vertical || 'vertical SaaS';

  // Pull key evidence summaries from the highest-weight factors to embed in narrative
  const r1 = sb.factor_scores.find(f => f.factor_id === 'R1');
  const r2 = sb.factor_scores.find(f => f.factor_id === 'R2');
  const a6 = sb.factor_scores.find(f => f.factor_id === 'A6');
  const a1 = sb.factor_scores.find(f => f.factor_id === 'A1');
  const a2 = sb.factor_scores.find(f => f.factor_id === 'A2');

  const r1Ev = cleanEvidence(r1?.evidence_summary);
  const r2Ev = cleanEvidence(r2?.evidence_summary);
  const a6Ev = cleanEvidence(a6?.evidence_summary);
  const a1Ev = cleanEvidence(a1?.evidence_summary);
  const a2Ev = cleanEvidence(a2?.evidence_summary);

  const quadrantFraming: Record<string, string> = {
    EXECUTE: `Eagle Vision's 7-dimension analysis places ${co} in the EXECUTE quadrant — the most attractive posture for an AI-era investment. With an AI Risk Score of ${sb.risk_score.toFixed(0)}/100 and an AI Readiness Score of ${sb.readiness_score.toFixed(0)}/100, the competitive window is open, the technical foundation is demonstrably in place, and the company has the organizational capability to execute an AI transformation within a standard 5-year investment horizon. This is a low-risk, high-conviction opportunity where timing is favorable and the key question for the investment committee is not whether to act, but how fast.`,
    RACE_MODE: `Eagle Vision's 7-dimension analysis places ${co} in RACE MODE — a high-conviction thesis that carries a time-sensitive execution imperative. The AI Risk Score of ${sb.risk_score.toFixed(0)}/100 signals meaningful competitive pressure: AI-native entrants are active in ${v} and incumbent players are deploying AI features. However, the AI Readiness Score of ${sb.readiness_score.toFixed(0)}/100 indicates the company has the technical and organizational foundation to outpace these threats — provided the investment is closed and the AI roadmap accelerated without delay. This is not a "wait and watch" opportunity; the window for outrunning the competitive field narrows with each quarter.`,
    BUILD_MODE: `Eagle Vision's 7-dimension analysis places ${co} in BUILD MODE — a patient but conditionally attractive investment position. The AI Risk Score of ${sb.risk_score.toFixed(0)}/100 indicates the competitive environment in ${v} is not yet critically threatening: the window is open, AI-native entrants have limited traction, and incumbents are moving slowly. However, the AI Readiness Score of ${sb.readiness_score.toFixed(0)}/100 reveals that the company has not yet assembled the full capability stack needed to fully capture the AI opportunity. The investment thesis is viable, but it depends on executing a 12–24 month capability build. This is an appropriate opportunity for a patient buyer with operational AI expertise who can actively contribute to the transformation.`,
    DANGER_ZONE: `Eagle Vision's 7-dimension analysis places ${co} in the DANGER ZONE — a structurally challenging investment position that requires careful consideration before advancing. The AI Risk Score of ${sb.risk_score.toFixed(0)}/100 reflects a competitive environment in ${v} that is intensifying rapidly, while the AI Readiness Score of ${sb.readiness_score.toFixed(0)}/100 indicates significant capability gaps that compound the competitive vulnerability. In this quadrant, time is working against the company: the competitive window is narrowing at the same time internal readiness lags. A ${sb.disposition} disposition reflects the weight of this compounding risk. Investment conviction at this stage requires high-conviction specific evidence that the identified gaps can be closed before the competitive landscape becomes prohibitive.`,
  };

  // Build key evidence sentence weaving actual findings into prose
  const evidenceSentences: string[] = [];
  if (r1Ev) evidenceSentences.push(`On the competitive front, the research found: "${r1Ev.slice(0, 200)}${r1Ev.length > 200 ? '…' : ''}"`);
  if (r2Ev && !r2Ev.startsWith('[')) evidenceSentences.push(`AI-native entrant analysis surfaced: "${r2Ev.slice(0, 200)}${r2Ev.length > 200 ? '…' : ''}"`);
  if (a1Ev) evidenceSentences.push(`On workflow embeddedness: "${a1Ev.slice(0, 200)}${a1Ev.length > 200 ? '…' : ''}"`);
  if (a6Ev) evidenceSentences.push(`On AI team capability: "${a6Ev.slice(0, 200)}${a6Ev.length > 200 ? '…' : ''}"`);
  if (a2Ev && !a2Ev.startsWith('[')) evidenceSentences.push(`Data foundation analysis found: "${a2Ev.slice(0, 200)}${a2Ev.length > 200 ? '…' : ''}"`);

  const evidenceParagraph = evidenceSentences.length > 0
    ? `\n\nKey evidence embedded in this assessment: ${evidenceSentences.slice(0, 3).join(' ')}`
    : '';

  const criticalGapSentence = sb.critical_gaps.length > 0
    ? ` The scoring model identified ${sb.critical_gaps.length} critical readiness gap${sb.critical_gaps.length > 1 ? 's' : ''} (${sb.critical_gaps.join(', ')}) that represent execution blockers requiring resolution before the full AI value creation thesis can be achieved.`
    : '';

  const confText = sb.confidence_overall === 'H'
    ? ' This assessment is based on HIGH-confidence evidence collected across all seven research dimensions, with multiple corroborating sources for the key scoring factors.'
    : sb.confidence_overall === 'M'
    ? ' Evidence confidence is MEDIUM. The core thesis is directionally clear, but several dimensions have data gaps — particularly around internal metrics, AI team specifics, and proprietary data architecture — that a first management meeting and data room review would resolve.'
    : ' Evidence confidence is LOW. This screening provides a directional view based largely on public information and analyst knowledge, but significant gaps remain across multiple dimensions. The disposition should be treated as preliminary until management access is obtained and the data room is reviewed.';

  return `${quadrantFraming[sb.quadrant] || ''}${criticalGapSentence}${evidenceParagraph}${confText}`;
}

function getScoreNarrative(record: ScreeningRecord): { riskNarrative: string; readinessNarrative: string; overallNarrative: string } {
  const sb = record.score_bundle;
  if (!sb) return { riskNarrative: '', readinessNarrative: '', overallNarrative: '' };

  const riskFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('R'));
  const readinessFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('A'));

  // Sort for narrative construction — don't mutate original
  const topRisk = [...riskFactors].sort((a, b) => b.raw_score - a.raw_score).slice(0, 3);
  const bottomReadiness = [...readinessFactors].filter(f => f.raw_score < 60).sort((a, b) => a.raw_score - b.raw_score).slice(0, 3);
  const topReadiness = [...readinessFactors].filter(f => f.raw_score >= 60).sort((a, b) => b.raw_score - a.raw_score).slice(0, 3);

  const riskLevel = sb.risk_score < 35 ? 'a favorable, well-protected competitive position'
    : sb.risk_score < 50 ? 'moderate competitive pressure with identifiable but manageable threats'
    : sb.risk_score < 65 ? 'elevated competitive risk requiring a clear and urgent AI response plan'
    : 'critical competitive risk where existing structural advantages may not be sufficient to withstand AI disruption without rapid intervention';

  const riskDriverText = topRisk.length > 0
    ? ` The highest-scoring risk factors — meaning the most significant threats — are: ${topRisk.map(f => {
        const ev = cleanEvidence(f.evidence_summary);
        return `${f.factor_name} (${f.raw_score}/100${ev ? `: "${ev.slice(0,120)}${ev.length>120?'…':''}"` : ''})`;
      }).join('; ')}.`
    : '';

  const riskNarrative = `The AI Risk Score of ${sb.risk_score.toFixed(0)}/100 (Grade ${sb.risk_grade}) reflects ${riskLevel}.${riskDriverText} Risk scores measure competitive and timing threats — a lower score is better. The seven risk factors assess the Competitive Window, AI-Native Entrant Threat, Incumbent AI Posture, Horizontal AI Encroachment, Customer Switching Propensity, Regulatory Moat Durability, and Market Timing Risk. Each factor is weighted by its historically-observed impact on AI-era investment outcomes in vertical SaaS.`;

  const readinessLevel = sb.readiness_score >= 70 ? 'strong foundational AI capability — the company demonstrably has the data, team, architecture, and leadership conviction needed to execute an AI transformation'
    : sb.readiness_score >= 55 ? 'developing AI readiness with identifiable strengths that should be built upon and specific gaps that require focused capital and operational support'
    : sb.readiness_score >= 40 ? 'meaningful readiness gaps across multiple dimensions that represent execution risk — value creation is contingent on closing these gaps post-close'
    : 'significant AI readiness deficits that represent material execution risk — the investment thesis requires a clear plan to rebuild foundational capability before AI value creation is achievable';

  const strengthText = topReadiness.length > 0
    ? ` Readiness strengths that support conviction: ${topReadiness.map(f => {
        const ev = cleanEvidence(f.evidence_summary);
        return `${f.factor_name} (${f.raw_score}/100${ev ? `: "${ev.slice(0,100)}${ev.length>100?'…':''}"` : ''})`;
      }).join('; ')}.`
    : '';

  const gapText = bottomReadiness.length > 0
    ? ` Priority investment areas (readiness gaps below threshold): ${bottomReadiness.map(f => `${f.factor_name} scored ${f.raw_score}/100 — ${f.raw_score < 40 ? 'CRITICAL gap requiring immediate action' : 'gap requiring investment within 12-18 months'}`).join('; ')}.`
    : '';

  const readinessNarrative = `The AI Readiness Score of ${sb.readiness_score.toFixed(0)}/100 (Grade ${sb.readiness_grade}) indicates ${readinessLevel}.${strengthText}${gapText} The nine readiness factors assess Workflow Embeddedness, Data Foundation, Outcome-Labeled Data, Value Quantification, Pricing Model Flexibility, AI/ML Team Capability, Architecture Readiness, Compounding Loop Potential, and Leadership AI Clarity.`;

  const overallInterpretation = sb.overall_score >= 75
    ? 'a strong investment-grade signal — the AI opportunity is accessible, defensible, and executable within the investment horizon. This score places the company in the top tier of AI-era vertical SaaS investment opportunities we would expect to see'
    : sb.overall_score >= 62
    ? 'a solid but conditional investment signal — the core thesis is valid, but identified risks and gaps require specific resolution before full conviction. A well-structured investment with appropriate operational support could create substantial value'
    : sb.overall_score >= 48
    ? 'a moderate, below-threshold score suggesting the investment thesis carries meaningful execution risk. The combination of competitive threats and readiness gaps means value creation is possible but not structurally assured — the thesis depends on specific assumptions about the company\'s ability to close gaps while managing competition'
    : 'a below-threshold score indicating structural challenges on multiple dimensions. An investment at current conditions would carry elevated risk, and significant operational intervention would be required before AI-driven value creation could begin';

  const overallNarrative = `The Overall Score of ${sb.overall_score.toFixed(0)}/100 (Grade ${sb.overall_grade}) represents ${overallInterpretation}. This composite score is computed as a risk-adjusted readiness measure: Readiness Score weighted at ${((sb.readiness_score / (sb.readiness_score + sb.risk_score)) * 100).toFixed(0)}% and Risk Score weighted at ${((sb.risk_score / (sb.readiness_score + sb.risk_score)) * 100).toFixed(0)}% of the composite, with critical gaps applying a structural discount. The ${sb.disposition} disposition reflects the interaction of all three signals — risk level, readiness level, and the presence or absence of critical execution blockers.`;

  return { riskNarrative, readinessNarrative, overallNarrative };
}

// ─── Factor Narrative Generator ──────────────────────────────────────────────
// Generates rich, institutional-quality prose interpretation of a factor's score
// by combining the rubric, evidence summary, and score range into a coherent analysis.
function getFactorNarrative(factor: FactorScore): string {
  const isRisk = factor.factor_id.startsWith('R');
  const score = factor.raw_score;
  const ev = cleanEvidence(factor.evidence_summary);
  const weight = (factor.weight * 100).toFixed(0);

  // Score interpretation ranges differ for risk (lower = better) vs readiness (higher = better)
  const scoreInterpretation = isRisk
    ? score < 30 ? `This score of ${score}/100 is a strong positive signal — it indicates low risk on this dimension. Risk factors are scored inversely: a low score means this threat is well-contained.`
    : score < 50 ? `This score of ${score}/100 represents moderate risk — the threat exists and is real, but is manageable with appropriate strategy and execution.`
    : score < 70 ? `This score of ${score}/100 represents elevated risk — this factor is a material concern that should be specifically addressed in the investment thesis and post-close plan.`
    : `This score of ${score}/100 represents high risk — this factor is a significant threat that should be a primary focus of diligence and a key condition for investment conviction.`
    : score < 35 ? `This score of ${score}/100 represents a critical readiness gap — this factor is significantly below threshold and represents an execution blocker for the AI investment thesis.`
    : score < 55 ? `This score of ${score}/100 indicates developing capability — the foundation exists but meaningful investment is required to close the gap and execute the AI thesis.`
    : score < 72 ? `This score of ${score}/100 indicates solid capability — this factor is at or above the threshold for investment conviction, though there is room for further development.`
    : `This score of ${score}/100 represents a readiness strength — this factor is a distinctive positive that supports investment conviction and contributes meaningfully to the AI thesis.`;

  const weightSentence = `This factor carries a ${weight}% weight in the ${isRisk ? 'AI Risk' : 'AI Readiness'} composite score, contributing ${factor.weighted_contribution.toFixed(1)} points to the overall ${isRisk ? 'risk' : 'readiness'} score.`;

  const evidenceSentence = ev
    ? `The evidence underlying this assessment states: "${ev.slice(0, 350)}${ev.length > 350 ? '…' : ''}"`
    : `No primary evidence was collected for this factor from public sources. The score reflects analyst baseline assumptions and the rubric default for this factor. This gap should be a specific focus of management due diligence.`;

  const rubricSentence = factor.rubric_applied
    ? `The scoring rubric applied: ${factor.rubric_applied}`
    : '';

  const criticalGapWarning = factor.is_critical_gap
    ? `\n\n⚡ CRITICAL GAP ALERT: This factor is flagged as a critical readiness gap (score ≤ 40). In the Eagle Vision model, critical gaps apply a structural discount to the overall score and are weighted heavily in the GO/MAYBE/NO-GO disposition. A critical gap on this factor means the AI investment thesis cannot fully be achieved without closing this specific capability — it is not merely an optimization opportunity, but a prerequisite.`
    : '';

  const confidenceNote = factor.confidence === 'L'
    ? `\n\n⚠️ LOW CONFIDENCE: This score is based on limited or low-quality evidence. The signal_strength underlying this score may shift substantially when better evidence is gathered — either from management access, data room review, or customer reference calls. Treat this factor's score as a directional indicator, not a confirmed finding.`
    : factor.confidence === 'M'
    ? `\nMODERATE CONFIDENCE: The evidence quality for this factor is adequate but not comprehensive. One or two additional data points from diligence would increase confidence materially.`
    : '';

  return `${scoreInterpretation} ${weightSentence}\n\n${evidenceSentence}\n\n${rubricSentence}${criticalGapWarning}${confidenceNote}`;
}

// ─── Factor Description Map ───────────────────────────────────────────────────
// Provides analyst-grade explanation of what each factor measures and why it matters
const FACTOR_DESCRIPTIONS: Record<string, { what: string; why: string; howToRead: string }> = {
  R1: {
    what: 'Competitive Window measures how much time remains before AI-native entrants and incumbent AI deployments close the investment window.',
    why: 'This is the most time-sensitive factor in the model. A company with a 3-year competitive window has time to deploy AI and build defensibility. A company with a 6-month window needs to move before close.',
    howToRead: 'Score 0-40: Window is open (good). Score 41-65: Window is narrowing. Score 66-100: Window is closing or closed (bad).',
  },
  R2: {
    what: 'AI-Native Entrant Threat tracks the number, funding stage, and traction of venture-backed startups building AI-first alternatives to this product.',
    why: 'AI-native entrants are existential threats because they start without legacy architecture or culture constraints. A well-funded AI-native entrant can outpace a legacy player even with a head start.',
    howToRead: 'Score 0-30: No credible entrants (good). Score 31-60: Early-stage threats requiring monitoring. Score 61-100: Multiple funded entrants with traction — urgent risk.',
  },
  R3: {
    what: 'Incumbent AI Posture measures how aggressively existing market leaders are deploying AI into their products.',
    why: 'Incumbent AI can be more dangerous than AI-native entrants because incumbents already have customers, distribution, and brand. A well-funded incumbent deploying AI can quickly close the gap.',
    howToRead: 'Score 0-30: Incumbents are silent or signaling only (good). Score 31-60: Beta features shipped. Score 61-100: GA features with customer traction — significant risk.',
  },
  R4: {
    what: 'Horizontal AI Encroachment measures the risk that general-purpose AI tools (ChatGPT, Copilot, etc.) will displace vertical SaaS functionality.',
    why: 'Horizontal AI is a structural threat to any vertical SaaS product that automates work that can be described in plain language. Products without deep workflow embedding and proprietary data are most vulnerable.',
    howToRead: 'Score 0-30: Low horizontal threat (good). Score 31-60: Experiments by users documented. Score 61-100: Active displacement of core functionality occurring.',
  },
  R5: {
    what: 'Customer Switching Propensity measures how easy or hard it is for customers to leave this product for a competitor.',
    why: 'Low switching costs mean customers will move to better AI alternatives quickly. High switching costs (deep integrations, proprietary data, long contracts) provide structural protection even in a competitive environment.',
    howToRead: 'Score 0-30: High switching costs (good). Score 31-60: Moderate friction. Score 61-100: Easy to switch — customers are vulnerable to competitive displacement.',
  },
  R6: {
    what: 'Regulatory Moat Durability assesses whether compliance requirements create lasting barriers to entry that protect the company\'s market position.',
    why: 'Heavy regulatory environments (HIPAA, SOC2, HITRUST, EVV mandates) create switching costs and entry barriers that benefit incumbents. However, if AI tools accelerate compliance, this moat can erode faster than expected.',
    howToRead: 'Score 0-30: Strong regulatory moat (good — lower risk). Score 31-60: Moderate protection. Score 61-100: Thin regulatory moat, eroding, or AI may shortcut compliance requirements.',
  },
  R7: {
    what: 'Market Timing Risk assesses whether the market entry timing is favorable — not too early (before buyers are ready) and not too late (after consolidation).',
    why: 'Timing matters enormously in vertical SaaS. Too early means long sales cycles and low ACVs. Too late means over-funded competition and compressed multiples. The sweet spot is a growing market with active PE/VC interest but before saturation.',
    howToRead: 'Score 0-30: Ideal timing (good). Score 31-55: Good but watch for headwinds. Score 56-100: Late-cycle risk, macro headwinds, or market consolidation underway.',
  },
  A1: {
    what: 'Workflow Embeddedness measures how deeply integrated this product is into customers\' daily operational workflows — whether it\'s mission-critical or a nice-to-have.',
    why: 'Products that are mission-critical systems of record have two key advantages: they capture the richest data (all core transactions flow through them) and they have the highest switching costs. AI built on a system of record is vastly more defensible than AI built on a peripheral tool.',
    howToRead: 'Score 0-35: Peripheral / nice-to-have. Score 36-65: Regular use but not mission-critical. Score 66-100: System of record for critical workflows (strong).',
  },
  A2: {
    what: 'Data Foundation & Quality assesses the richness, completeness, and longitudinal depth of the company\'s proprietary dataset.',
    why: 'AI quality is bounded by data quality. A company with 5+ years of rich, complete, longitudinal operational data has an enormous head start on AI model training versus one with shallow or incomplete records. This data moat is hard to replicate and forms the foundation of defensible AI.',
    howToRead: 'Score 0-32: Inadequate data foundation. Score 33-65: Developing data asset. Score 66-100: Rich longitudinal data with quality controls — strong AI foundation.',
  },
  A3: {
    what: 'Outcome-Labeled Data measures whether the company systematically links outcomes (patient health, business results, financial performance) back to the prior decisions and interventions that produced them.',
    why: 'This is the "gold standard" for training predictive AI. A company that can pull a dataset of "X intervention → Y outcome" has the raw material for genuinely predictive models. Without labeled outcomes, AI is limited to automation and pattern recognition, not true prediction.',
    howToRead: 'Score 0-30: No outcome labeling (critical gap). Score 31-60: Partial labeling. Score 61-100: Systematic outcome tracking with training-ready data.',
  },
  A4: {
    what: 'Value Quantification assesses whether the company has hard, defensible data on the ROI and business outcomes it delivers to customers.',
    why: 'AI pricing evolution requires moving from per-seat to value-based models. Companies that cannot quantify their value cannot charge for it. Independently verified ROI data enables outcome-based pricing, expansion revenue, and justification of AI feature premiums.',
    howToRead: 'Score 0-35: No ROI evidence (significant gap). Score 36-65: Anecdotal value claims. Score 66-100: Published, verified ROI with case studies.',
  },
  A5: {
    what: 'Pricing Model Flexibility assesses whether the company can evolve from per-seat pricing to consumption-based, outcome-based, or AI-feature-premium pricing structures.',
    why: 'The most common value destruction in AI-era SaaS is when AI automates user work, reducing seat counts while simultaneously increasing value delivered. Companies with rigid per-seat pricing will see revenue decline as AI succeeds. Flexible pricing models capture AI value rather than destroying it.',
    howToRead: 'Score 0-35: Rigid seat-only pricing (risk). Score 36-60: Limited flexibility. Score 61-100: Multiple models with AI pricing pathway.',
  },
  A6: {
    what: 'AI/ML Team Capability evaluates the depth, experience, and size of the company\'s AI and machine learning talent.',
    why: 'Shipping genuinely defensible AI requires more than an OpenAI API key. Proprietary models, fine-tuning on vertical data, and MLOps infrastructure require dedicated ML engineers with domain expertise. The team required to build AI that is hard to replicate is the bottleneck resource.',
    howToRead: 'Score 0-30: No dedicated AI team (critical gap). Score 31-60: Small team, may be API-wrapper dependent. Score 61-100: Strong ML team with domain expertise.',
  },
  A7: {
    what: 'Architecture Readiness assesses whether the company\'s technical infrastructure can support ML workloads, real-time inference, and continuous model training.',
    why: 'Legacy monolithic architectures cannot run ML workloads efficiently. API-first, cloud-native, microservices architectures are prerequisites for deploying AI at scale. Technical debt in architecture translates directly to AI development cost and timeline.',
    howToRead: 'Score 0-35: Legacy architecture (significant blocker). Score 36-60: Partially modernized. Score 61-100: Modern cloud-native stack suitable for ML workloads.',
  },
  A8: {
    what: 'Compounding Loop Potential assesses whether the company\'s product has a data flywheel — where more customers generate more data, which improves the AI, which attracts more customers.',
    why: 'Compounding data effects are the holy grail of AI-era investing. Companies with strong flywheels become more defensible over time, not less. Each additional customer makes the AI better, creating a widening moat that is structurally difficult for competitors to overcome.',
    howToRead: 'Score 0-30: No flywheel (missed opportunity). Score 31-60: Basic usage data collected. Score 61-100: Clear compounding loop design with evidence of accumulation.',
  },
  A9: {
    what: 'Leadership AI Clarity assesses the depth and specificity of the CEO and executive team\'s AI strategy, conviction, and execution track record.',
    why: 'Technology follows leadership. A CEO who understands AI deeply — can articulate a specific multi-year roadmap, has made aggressive AI hires, has clear Build vs. Buy vs. Partner frameworks — will execute faster and attract better talent than one with vague AI aspirations.',
    howToRead: 'Score 0-35: No clear AI strategy. Score 36-60: Awareness but vague direction. Score 61-100: Deep AI conviction with specific, executable roadmap.',
  },
};

export function ReportPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { getRecord } = useArchiveStore();
  const record = getRecord(jobId || '');
  const [activeTab, setActiveTab] = useState<ReportTab>('headline');
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);
  const [factorView, setFactorView] = useState<'all' | 'risk' | 'readiness'>('all');
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  if (!record) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
          <EagleIcon size={60} color="rgba(197,165,114,0.3)" />
          <div className="text-gray-400">Screening not found</div>
          <Button onClick={() => navigate('/dashboard')}>← Back to Dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const { score_bundle: sb, inputs } = record;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Report Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-500 hover:text-gray-300 mb-2 flex items-center gap-1 transition-colors">
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Montserrat' }}>
              {inputs.company_name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <a href={inputs.company_url} target="_blank" rel="noopener" className="text-xs font-mono" style={{ color: '#C5A572' }}>
                {inputs.company_url}
              </a>
              {(record.detected_vertical || inputs.vertical) && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(197,165,114,0.12)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.25)' }}>
                  {record.detected_vertical || inputs.vertical}
                  {record.detected_vertical && record.detected_vertical !== inputs.vertical && inputs.vertical && (
                    <span className="text-gray-600 ml-1">(user: {inputs.vertical})</span>
                  )}
                </span>
              )}
              <span className="text-xs text-gray-600 font-mono">{new Date(record.created_at).toLocaleDateString()}</span>
              {sb && (
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{
                  background: sb.confidence_overall === 'H' ? 'rgba(29,185,84,0.15)' : sb.confidence_overall === 'M' ? 'rgba(255,179,0,0.15)' : 'rgba(211,47,47,0.15)',
                  color: sb.confidence_overall === 'H' ? '#1DB954' : sb.confidence_overall === 'M' ? '#FFB300' : '#D32F2F',
                }}>
                  {sb.confidence_overall} CONFIDENCE
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            <Button variant="gold" size="sm" onClick={() => exportToJSON(record)}>JSON</Button>
            <Button variant="gold" size="sm" onClick={() => exportToPDF()}>PDF</Button>
          </div>
        </div>

        {/* Honesty Banner */}
        {record.honesty_flag && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid #FFB300', color: '#FFB300', fontFamily: 'Inter' }}>
            ⚠️ This screening was aborted early. Data is partial — treat all conclusions as preliminary. Key dimensions may lack sufficient evidence for high-confidence scoring.
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-[rgba(197,165,114,0.2)] no-print overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors"
              style={{
                fontFamily: 'Montserrat',
                color: activeTab === tab.id ? '#C5A572' : '#64748B',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #C5A572' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Tab: Headline Grade ─── */}
        {activeTab === 'headline' && <HeadlineTab record={record} />}

        {/* ─── Tab: 16-Factor Scorecard ─── */}
        {activeTab === 'scorecard' && (
          <ScorecardTab
            record={record}
            factorView={factorView}
            setFactorView={setFactorView}
            expandedFactor={expandedFactor}
            setExpandedFactor={setExpandedFactor}
            noteMap={noteMap}
            setNoteMap={setNoteMap}
          />
        )}

        {/* ─── Tab: Competitive Landscape ─── */}
        {activeTab === 'competitive' && <CompetitiveTab record={record} />}

        {/* ─── Tab: Evidence Log ─── */}
        {activeTab === 'evidence' && (
          <EvidenceTab record={record} search={evidenceSearch} setSearch={setEvidenceSearch} />
        )}

        {/* ─── Tab: Diligence Shopping List ─── */}
        {activeTab === 'diligence' && <DiligenceTab record={record} />}
      </div>
    </AppShell>
  );
}

// ─── Headline Tab ─────────────────────────────────────────────────────────────
function HeadlineTab({ record }: { record: ScreeningRecord }) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const dispositionNarrative = getDispositionNarrative(record);
  const { riskNarrative, readinessNarrative, overallNarrative } = getScoreNarrative(record);
  const allGreenFlags = Object.values(record.data_packs).flatMap(p => (p as any)?.green_flags || []);
  const allRedFlags = Object.values(record.data_packs).flatMap(p => p?.red_flags || []);
  const companyProfile = record.data_packs.company_profile;
  const profileOverview = companyProfile?.findings.find(f => f.key === 'company_overview')?.value as any;
  const profileFinancials = companyProfile?.findings.find(f => f.key === 'financials_and_scale')?.value as any;
  const profileProduct = companyProfile?.findings.find(f => f.key === 'product_and_pricing')?.value as any;
  const profileMarket = companyProfile?.findings.find(f => f.key === 'market_position')?.value as any;
  const profileGrowth = companyProfile?.findings.find(f => f.key === 'growth_and_momentum')?.value as any;

  // Sort factors for top performers
  const topReadinessFactor = sb.factor_scores
    .filter(f => f.factor_id.startsWith('A') && f.raw_score >= 60)
    .sort((a, b) => b.raw_score - a.raw_score)[0];
  const topRiskFactor = sb.factor_scores
    .filter(f => f.factor_id.startsWith('R') && f.raw_score >= 60)
    .sort((a, b) => b.raw_score - a.raw_score)[0];

  return (
    <div className="space-y-6 report-page">

      {/* Company Brief — only shown when profile data exists */}
      {profileOverview && (profileOverview.description || profileOverview.vertical) && (
        <Card variant="elevated" padding="sm">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>COMPANY BRIEF</div>
              <p className="text-sm text-gray-200 mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
                {profileOverview.description || `${record.inputs.company_name} is a ${profileOverview.vertical || 'vertical SaaS'} company.`}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ fontFamily: 'Inter' }}>
                {profileOverview.founded_year && <span className="text-gray-500">Founded <span className="text-gray-300">{profileOverview.founded_year}</span></span>}
                {profileOverview.headquarters && <span className="text-gray-500">HQ: <span className="text-gray-300">{profileOverview.headquarters}</span></span>}
                {profileOverview.target_customer && <span className="text-gray-500">Serves: <span className="text-gray-300">{profileOverview.target_customer}</span></span>}
                {profileFinancials?.funding_stage && <span className="text-gray-500">Stage: <span className="text-gray-300">{profileFinancials.funding_stage}</span></span>}
                {profileFinancials?.estimated_arr_range && <span className="text-gray-500">Est. ARR: <span className="text-gray-300">{profileFinancials.estimated_arr_range}</span></span>}
                {profileFinancials?.employee_count_range && <span className="text-gray-500">Employees: <span className="text-gray-300">{profileFinancials.employee_count_range}</span></span>}
              </div>
            </div>
            {profileOverview.vertical && (
              <div className="shrink-0">
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)', fontFamily: 'Montserrat' }}>
                  {profileOverview.vertical}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Grade Triptych + Disposition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disposition */}
        <Card variant="elevated" className="flex flex-col items-center justify-center py-8">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            EAGLE VISION DISPOSITION
          </div>
          <DispositionBadge disposition={sb.disposition} confidence={sb.confidence_overall} size="lg" />
          <div className="mt-6 text-center max-w-sm">
            <div className="text-xs text-gray-500 mb-3" style={{ fontFamily: 'Inter' }}>
              Computed {new Date(sb.computed_at).toLocaleString()} · {sb.factor_scores.length} factors scored
            </div>
            {/* Disposition explanation */}
            <div className="text-xs px-3 py-2 rounded-lg" style={{
              background: sb.disposition === 'GO' ? 'rgba(29,185,84,0.1)' : sb.disposition === 'NO-GO' ? 'rgba(211,47,47,0.1)' : 'rgba(255,179,0,0.1)',
              border: `1px solid ${sb.disposition === 'GO' ? 'rgba(29,185,84,0.3)' : sb.disposition === 'NO-GO' ? 'rgba(211,47,47,0.3)' : 'rgba(255,179,0,0.3)'}`,
              color: sb.disposition === 'GO' ? '#1DB954' : sb.disposition === 'NO-GO' ? '#EF5350' : '#FFB300',
              fontFamily: 'Inter', lineHeight: 1.5,
            }}>
              {sb.disposition === 'GO' && 'Advance to full diligence. Evidence supports conviction that the AI investment thesis is viable, the competitive window is open, and the company has the foundation to execute.'}
              {sb.disposition === 'MAYBE' && 'Conditional advancement. Key risks and data gaps require resolution before full conviction. Run the diligence checklist before proceeding.'}
              {sb.disposition === 'NO-GO' && 'Do not advance. Evidence indicates structural AI risks that exceed acceptable thresholds, or readiness gaps that would require fundamental changes before the AI thesis is viable.'}
            </div>
          </div>
        </Card>

        {/* Grade Triptych */}
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            SCORE BREAKDOWN
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <GradeBadge grade={sb.overall_grade} score={sb.overall_score} label="Overall" size="lg" />
            <GradeBadge grade={sb.risk_grade} score={sb.risk_score} label="AI Risk" size="lg" />
            <GradeBadge grade={sb.readiness_grade} score={sb.readiness_score} label="AI Readiness" size="lg" />
          </div>
          {/* Score narratives — institutional prose analysis */}
          <div className="space-y-4 mt-3 border-t border-[rgba(197,165,114,0.15)] pt-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(211,47,47,0.06)' }}>
              <div className="text-xs font-semibold mb-1.5 tracking-widest" style={{ color: '#D32F2F', fontFamily: 'Montserrat' }}>AI RISK ANALYSIS</div>
              <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{riskNarrative}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(29,185,84,0.06)' }}>
              <div className="text-xs font-semibold mb-1.5 tracking-widest" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>AI READINESS ANALYSIS</div>
              <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{readinessNarrative}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(197,165,114,0.06)' }}>
              <div className="text-xs font-semibold mb-1.5 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>OVERALL INVESTMENT SIGNAL</div>
              <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{overallNarrative}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Executive Summary Narrative */}
      <Card variant="elevated">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🦅</span>
          <div className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>EAGLE VISION EXECUTIVE SUMMARY</div>
        </div>
        <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
          {dispositionNarrative}
        </p>
      </Card>

      {/* Quadrant + Lean-In/Hesitate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quadrant Plot */}
        <Card variant="navy" className="flex flex-col items-center">
          <QuadrantPlot
            riskScore={sb.risk_score}
            readinessScore={sb.readiness_score}
            quadrant={sb.quadrant}
            companyName={record.inputs.company_name}
          />
          <div className="mt-3 text-center">
            <div className="text-xs font-bold" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
              {sb.quadrant.replace('_', ' ')}
            </div>
            <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter' }}>
              {sb.quadrant === 'EXECUTE' && 'Low risk + high readiness = invest now'}
              {sb.quadrant === 'RACE_MODE' && 'High risk + high readiness = move fast'}
              {sb.quadrant === 'BUILD_MODE' && 'Low risk + readiness gaps = build before racing'}
              {sb.quadrant === 'DANGER_ZONE' && 'High risk + readiness gaps = structural challenges'}
            </p>
          </div>
        </Card>

        {/* Lean-In & Hesitate */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lean In */}
          <Card variant="navy">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-sm font-bold" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>Investment Positives</span>
            </div>
            <ul className="space-y-4">
              {sb.lean_in_reasons.length > 0 ? sb.lean_in_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                  <span style={{ color: '#1DB954', flexShrink: 0, marginTop: 2 }}>→</span>
                  <span>{r}</span>
                </li>
              )) : (
                <li className="text-xs text-gray-600 italic">Insufficient high-confidence evidence to identify clear investment positives. Run full diligence to establish conviction.</li>
              )}
            </ul>
          </Card>

          {/* Hesitate */}
          <Card variant="navy">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-400 text-lg">⚠</span>
              <span className="text-sm font-bold" style={{ color: '#FFB300', fontFamily: 'Montserrat' }}>Risk & Hesitation Signals</span>
            </div>
            <ul className="space-y-4">
              {sb.hesitate_reasons.length > 0 ? sb.hesitate_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                  <span style={{ color: '#FFB300', flexShrink: 0, marginTop: 2 }}>→</span>
                  <span>{r}</span>
                </li>
              )) : (
                <li className="text-xs text-gray-600 italic">No significant hesitation signals above threshold detected at current confidence level.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      {/* Company Profile Snapshot */}
      {companyProfile && (profileFinancials || profileProduct || profileMarket) && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            COMPANY PROFILE SNAPSHOT
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {profileFinancials?.arr_range_estimate && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Montserrat' }}>EST. ARR</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{profileFinancials.arr_range_estimate}</div>
                {profileFinancials.arr_estimation_basis && (
                  <div className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter' }}>{profileFinancials.arr_estimation_basis}</div>
                )}
              </div>
            )}
            {profileFinancials?.funding_stage && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Montserrat' }}>FUNDING</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{profileFinancials.funding_stage}</div>
                {profileFinancials.total_funding_raised && (
                  <div className="text-xs text-gray-500 mt-1">{profileFinancials.total_funding_raised} raised</div>
                )}
              </div>
            )}
            {profileProduct?.pricing_model && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Montserrat' }}>PRICING MODEL</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{profileProduct.pricing_model}</div>
                {profileProduct.pricing_flexibility_level && (
                  <div className="text-xs mt-1" style={{
                    color: profileProduct.pricing_flexibility_level === 'HIGH' ? '#1DB954' : profileProduct.pricing_flexibility_level === 'MEDIUM' ? '#FFB300' : '#F57C00',
                  }}>
                    {profileProduct.pricing_flexibility_level} flexibility
                  </div>
                )}
              </div>
            )}
            {profileMarket?.market_position_category && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(0,58,99,0.4)' }}>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Montserrat' }}>MARKET POSITION</div>
                <div className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{profileMarket.market_position_category}</div>
                {profileMarket.estimated_market_share && (
                  <div className="text-xs text-gray-500 mt-1">{profileMarket.estimated_market_share} share</div>
                )}
              </div>
            )}
          </div>
          {/* Key differentiators */}
          {profileMarket?.key_differentiators?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'Montserrat' }}>KEY DIFFERENTIATORS</div>
              <div className="flex flex-wrap gap-2">
                {profileMarket.key_differentiators.slice(0, 5).map((d: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'rgba(197,165,114,0.1)', color: '#C5A572' }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Growth signals */}
          {profileGrowth?.growth_signals?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'Montserrat' }}>GROWTH SIGNALS</div>
              <ul className="space-y-1">
                {profileGrowth.growth_signals.slice(0, 4).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2">
                    <span style={{ color: '#1DB954' }}>+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Green Flags — Investment Positives */}
      {allGreenFlags.length > 0 && (
        <Card variant="navy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-400 text-lg">✦</span>
            <span className="text-sm font-bold" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>Green Flag Intelligence</span>
          </div>
          <div className="space-y-2">
            {allGreenFlags.map((flag: string, i: number) => (
              <div key={i} className="flex gap-2 items-start text-xs py-2 px-3 rounded" style={{ background: 'rgba(29,185,84,0.08)', color: '#81C784', fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span className="shrink-0" style={{ color: '#1DB954' }}>✓</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Red Flag Radar */}
      {allRedFlags.length > 0 && (
        <Card variant="navy" goldAccent>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-red-400 text-lg">🚨</span>
            <span className="text-sm font-bold" style={{ color: '#D32F2F', fontFamily: 'Montserrat' }}>Red Flag Radar</span>
          </div>
          <p className="text-xs text-gray-500 mb-3" style={{ fontFamily: 'Inter' }}>
            These items were flagged by the AI research packs as material investment risks. Each red flag should be specifically addressed during diligence.
          </p>
          <div className="space-y-2">
            {allRedFlags.map((flag: string, i: number) => (
              <div key={i} className="flex gap-2 items-start text-xs py-2 px-3 rounded" style={{ background: 'rgba(211,47,47,0.1)', color: '#EF5350', fontFamily: 'Inter', lineHeight: 1.6 }}>
                <span className="shrink-0">⚑</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Critical Gaps Banner */}
      {sb.critical_gaps.length > 0 && (
        <Card variant="navy">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-400 text-lg">⚡</span>
            <span className="text-sm font-bold" style={{ color: '#F57C00', fontFamily: 'Montserrat' }}>Critical Readiness Gaps ({sb.critical_gaps.length})</span>
          </div>
          <p className="text-xs text-gray-400 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
            The following factors scored at or below 40/100, indicating significant gaps in AI readiness that must be addressed for the investment thesis to be fully viable. These gaps are flagged as CRITICAL because they represent execution blockers, not just optimization opportunities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sb.critical_gaps.map(gapId => {
              const factorScore = sb.factor_scores.find(f => f.factor_id === gapId);
              if (!factorScore) return null;
              const desc = FACTOR_DESCRIPTIONS[gapId];
              return (
                <div key={gapId} className="p-3 rounded-lg" style={{ background: 'rgba(245,124,0,0.08)', border: '1px solid rgba(245,124,0,0.3)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold font-mono" style={{ color: '#C5A572' }}>{gapId}</span>
                    <span className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{factorScore.factor_name}</span>
                    <span className="text-xs font-bold ml-auto" style={{ color: '#F57C00' }}>{factorScore.raw_score}/100</span>
                  </div>
                  {desc && (
                    <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
                      {desc.why}
                    </p>
                  )}
                  {factorScore.evidence_summary && !factorScore.evidence_summary.includes('No evidence') && !factorScore.evidence_summary.includes('Pack failed') && (
                    <p className="text-xs text-orange-300 mt-2 italic" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
                      Evidence: "{factorScore.evidence_summary.slice(0, 200)}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Scorecard Tab ────────────────────────────────────────────────────────────
function ScorecardTab({
  record, factorView, setFactorView, expandedFactor, setExpandedFactor, noteMap, setNoteMap
}: {
  record: ScreeningRecord;
  factorView: 'all' | 'risk' | 'readiness';
  setFactorView: (v: 'all' | 'risk' | 'readiness') => void;
  expandedFactor: string | null;
  setExpandedFactor: (f: string | null) => void;
  noteMap: Record<string, string>;
  setNoteMap: (m: Record<string, string>) => void;
}) {
  const sb = record.score_bundle;
  if (!sb) return <div className="text-gray-400 text-center py-12">No score data available.</div>;

  const riskFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('R'));
  const readinessFactors = sb.factor_scores.filter(f => f.factor_id.startsWith('A'));
  const displayFactors = factorView === 'risk' ? riskFactors : factorView === 'readiness' ? readinessFactors : sb.factor_scores;

  // Compute aggregate bars
  const riskAvg = riskFactors.reduce((s, f) => s + f.raw_score, 0) / riskFactors.length;
  const readinessAvg = readinessFactors.reduce((s, f) => s + f.raw_score, 0) / readinessFactors.length;

  return (
    <div className="space-y-4 report-page">
      {/* Header + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <Card variant="navy" padding="sm" className="text-center">
          <div className="text-2xl font-bold" style={{ color: GRADE_COLOR[sb.risk_grade], fontFamily: 'Montserrat' }}>{sb.risk_score.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Montserrat' }}>AI RISK SCORE</div>
          <div className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: 'Inter' }}>Lower = safer investment</div>
        </Card>
        <Card variant="navy" padding="sm" className="text-center">
          <div className="text-2xl font-bold" style={{ color: GRADE_COLOR[sb.overall_grade], fontFamily: 'Montserrat' }}>{sb.overall_score.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Montserrat' }}>OVERALL SCORE</div>
          <div className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: 'Inter' }}>Risk-adjusted readiness composite</div>
        </Card>
        <Card variant="navy" padding="sm" className="text-center">
          <div className="text-2xl font-bold" style={{ color: GRADE_COLOR[sb.readiness_grade], fontFamily: 'Montserrat' }}>{sb.readiness_score.toFixed(0)}</div>
          <div className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Montserrat' }}>AI READINESS SCORE</div>
          <div className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: 'Inter' }}>Higher = more capable</div>
        </Card>
      </div>

      {/* Toggle + Legend */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat' }}>16-Factor Report Card</h2>
          <p className="text-xs text-gray-500 mt-1">Research LLMs produce evidence · Deterministic scoring engine produces these scores · Click any factor to expand full analysis</p>
        </div>
        <div className="flex gap-1">
          {(['all', 'risk', 'readiness'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFactorView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: factorView === v ? '#C5A572' : 'rgba(197,165,114,0.1)',
                color: factorView === v ? '#002B49' : '#C5A572',
                border: '1px solid rgba(197,165,114,0.3)',
                fontFamily: 'Montserrat',
              }}
            >
              {v === 'all' ? 'All 16' : v === 'risk' ? `Risk (R1–R7) avg ${riskAvg.toFixed(0)}` : `Readiness (A1–A9) avg ${readinessAvg.toFixed(0)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Factor Rows */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,165,114,0.2)' }}>
        {/* Column Headers */}
        <div className="grid px-4 py-2 text-xs font-semibold tracking-widest" style={{
          background: '#001A2E',
          borderBottom: '1px solid rgba(197,165,114,0.2)',
          color: '#C5A572',
          fontFamily: 'Montserrat',
          gridTemplateColumns: '40px 1fr 50px 70px 40px 80px 1fr 24px',
          gap: '8px',
          alignItems: 'center',
        }}>
          <span>ID</span>
          <span>FACTOR</span>
          <span className="text-right">WT</span>
          <span className="text-right">SCORE</span>
          <span>GRD</span>
          <span>CONFIDENCE</span>
          <span>EVIDENCE PREVIEW</span>
          <span></span>
        </div>
        {displayFactors.map((f, i) => (
          <FactorRow
            key={f.factor_id}
            factor={f}
            isEven={i % 2 === 0}
            isExpanded={expandedFactor === f.factor_id}
            onToggle={() => setExpandedFactor(expandedFactor === f.factor_id ? null : f.factor_id)}
            note={noteMap[f.factor_id]}
            onNoteChange={(note) => setNoteMap({ ...noteMap, [f.factor_id]: note })}
          />
        ))}
      </div>

      {/* Scoring Methodology Note */}
      <Card variant="navy" padding="sm">
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
          <span style={{ color: '#C5A572' }}>Scoring Methodology:</span> Each factor is scored on a 0–100 scale using deterministic rubrics applied to a signal_strength value (0.0–1.0) extracted by the AI research packs. For risk factors (R1–R7), higher scores indicate more risk — the letter grade is inverted so that low risk = high grade. For readiness factors (A1–A9), higher scores indicate stronger AI capability. The weighted composite scores are Risk (7 factors, weights sum to 1.0) and Readiness (9 factors, weights sum to 1.0). Confidence (H/M/L) reflects data quality, not score uncertainty.
        </div>
      </Card>
    </div>
  );
}

function FactorRow({ factor, isEven, isExpanded, onToggle, note, onNoteChange }: {
  factor: FactorScore;
  isEven: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  note?: string;
  onNoteChange: (n: string) => void;
}) {
  const desc = FACTOR_DESCRIPTIONS[factor.factor_id];
  const isRisk = factor.factor_id.startsWith('R');
  const hasRealEvidence = factor.evidence_summary &&
    !factor.evidence_summary.includes('No evidence collected') &&
    !factor.evidence_summary.includes('Pack failed') &&
    !factor.evidence_summary.includes('defaulting to neutral');

  return (
    <div style={{
      background: factor.is_critical_gap ? 'rgba(245,124,0,0.08)' : isEven ? 'rgba(0,26,46,0.5)' : 'transparent',
      borderBottom: '1px solid rgba(197,165,114,0.1)',
      borderLeft: factor.is_critical_gap ? '4px solid #F57C00' : isRisk ? '4px solid rgba(211,47,47,0.4)' : '4px solid rgba(29,185,84,0.3)',
    }}>
      {/* Main Row */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-[rgba(197,165,114,0.04)] transition-colors"
        style={{ display: 'grid', gridTemplateColumns: '40px 1fr 50px 70px 40px 80px 1fr 24px', gap: '8px', alignItems: 'center' }}
        onClick={onToggle}
      >
        <div className="text-xs font-bold font-mono" style={{ color: '#C5A572' }}>{factor.factor_id}</div>
        <div>
          <div className="text-sm text-white" style={{ fontFamily: 'Montserrat', fontWeight: 600 }}>
            {factor.factor_name}
          </div>
          {factor.is_critical_gap && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(245,124,0,0.2)', color: '#F57C00', fontFamily: 'Montserrat' }}>
              CRITICAL GAP
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 text-right font-mono">{(factor.weight * 100).toFixed(0)}%</div>
        <div className="text-right">
          <span className="text-sm font-bold font-mono" style={{ color: GRADE_COLOR[factor.letter_grade] }}>
            {factor.raw_score.toFixed(0)}/100
          </span>
        </div>
        <div>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${GRADE_COLOR[factor.letter_grade]}20`, color: GRADE_COLOR[factor.letter_grade], fontFamily: 'Montserrat' }}
          >
            {factor.letter_grade}
          </span>
        </div>
        <div><SignalChip confidence={factor.confidence} /></div>
        <div className="text-xs text-gray-500 truncate" style={{ fontFamily: 'Inter' }}>
          {hasRealEvidence
            ? factor.evidence_summary.slice(0, 70) + (factor.evidence_summary.length > 70 ? '...' : '')
            : <span className="text-gray-700 italic">No evidence collected</span>
          }
        </div>
        <span className="text-gray-500 text-xs text-right">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded Row — Full Institutional Analysis */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
          {/* What this factor measures */}
          {desc && (
            <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(197,165,114,0.06)', border: '1px solid rgba(197,165,114,0.15)' }}>
              <div className="text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>WHAT THIS FACTOR MEASURES</div>
              <p className="text-sm text-gray-200 mb-3 font-medium" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{desc.what}</p>
              <p className="text-xs text-gray-300 mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
                <span style={{ color: '#C5A572', fontWeight: 600 }}>Investment significance: </span>{desc.why}
              </p>
              <p className="text-xs text-gray-500 font-mono p-2 rounded" style={{ lineHeight: 1.5, background: 'rgba(0,0,0,0.2)' }}>
                <span style={{ color: '#C5A572' }}>Score interpretation guide: </span>{desc.howToRead}
              </p>
            </div>
          )}

          {/* Analyst Narrative — the rich institutional interpretation */}
          <div className="mb-4 p-4 rounded-lg" style={{ background: isRisk ? 'rgba(211,47,47,0.06)' : 'rgba(29,185,84,0.06)', border: `1px solid ${isRisk ? 'rgba(211,47,47,0.2)' : 'rgba(29,185,84,0.2)'}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                🦅 ANALYST INTERPRETATION
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: `${GRADE_COLOR[factor.letter_grade]}20`, color: GRADE_COLOR[factor.letter_grade], fontFamily: 'Montserrat' }}>
                {factor.raw_score.toFixed(0)}/100 · Grade {factor.letter_grade}
              </span>
            </div>
            <div className="space-y-2">
              {getFactorNarrative(factor).split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i} className={`text-xs ${para.startsWith('⚡') ? 'font-semibold' : para.startsWith('⚠️') ? '' : ''}`}
                  style={{
                    fontFamily: 'Inter',
                    lineHeight: 1.8,
                    color: para.startsWith('⚡') ? '#F57C00' : para.startsWith('⚠️') ? '#FFB300' : '#CBD5E1',
                    whiteSpace: 'pre-wrap',
                  }}>
                  {para}
                </p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Evidence Summary — full text, no truncation */}
            <div>
              <div className="text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>RAW EVIDENCE FROM RESEARCH PACKS</div>
              {hasRealEvidence ? (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)', border: '1px solid rgba(197,165,114,0.1)' }}>
                  <p className="text-xs text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                    {factor.evidence_summary}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)' }}>
                  <p className="text-xs text-gray-500 italic" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
                    No evidence was collected for this factor from public sources. This indicates: (1) the relevant research pack may have failed or timed out, (2) the company has limited publicly-available information on this dimension, or (3) the evidence synthesis fell back to raw data that didn't surface specific signals. The score uses a neutral default (signal_strength = 0.5) which produces a conservative mid-range score. This gap should be a specific focus of diligence: request this data directly from management.
                  </p>
                </div>
              )}
            </div>

            {/* Scoring Math + Diligence Questions */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold mb-2 tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>SCORING MATH</div>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold font-mono" style={{ color: GRADE_COLOR[factor.letter_grade] }}>{factor.raw_score.toFixed(0)}</span>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: GRADE_COLOR[factor.letter_grade], fontFamily: 'Montserrat' }}>Grade {factor.letter_grade}</div>
                      <div className="text-xs text-gray-400" style={{ fontFamily: 'Inter' }}>
                        {isRisk ? 'Risk Score — lower = better' : 'Readiness Score — higher = better'}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 rounded font-mono text-xs mb-2" style={{ background: 'rgba(0,0,0,0.3)', color: '#C5A572' }}>
                    {factor.raw_score.toFixed(1)} × {(factor.weight * 100).toFixed(0)}% weight = {factor.weighted_contribution.toFixed(1)} pts
                    {isRisk ? ' → toward risk total' : ' → toward readiness total'}
                  </div>
                  {factor.rubric_applied && (
                    <p className="text-xs text-gray-500 font-mono" style={{ lineHeight: 1.5 }}>
                      Rubric: {factor.rubric_applied}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'Montserrat' }}>DATA SOURCE & CONFIDENCE</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: '#C5A572' }}>{factor.pack_source.replace(/_/g, ' ')}</span>
                  <span className="text-gray-700">·</span>
                  <SignalChip confidence={factor.confidence} />
                </div>
              </div>
            </div>
          </div>

          {/* Partner Annotation */}
          <div className="mt-4">
            <div className="text-xs font-semibold mb-1 tracking-widest" style={{ color: '#94A3B8', fontFamily: 'Montserrat' }}>PARTNER ANNOTATION</div>
            <textarea
              value={note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Override this score with your analysis, dispute the AI assessment, or document what additional evidence you need to confirm or reject this finding..."
              rows={3}
              className="w-full px-3 py-2 rounded text-xs text-white resize-none outline-none"
              style={{ background: 'rgba(197,165,114,0.06)', border: '1px solid rgba(197,165,114,0.2)', fontFamily: 'Inter', color: 'white', lineHeight: 1.6 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Competitive Tab ──────────────────────────────────────────────────────────
function CompetitiveTab({ record }: { record: ScreeningRecord }) {
  const pack = record.data_packs.competitive_landscape;
  const sb = record.score_bundle;

  if (!pack) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="mb-2">Competitive Landscape data not available for this screening.</p>
        <p className="text-xs text-gray-600">This pack may have failed to collect data. Check the Evidence Log for error details.</p>
      </div>
    );
  }

  const heatIndex = pack.findings.find(f => f.key === 'vertical_heat_index')?.value as any;
  const entrants = pack.findings.find(f => f.key === 'ai_native_entrants')?.value as any[] || [];
  const incumbents = pack.findings.find(f => f.key === 'incumbent_postures')?.value as any[] || [];
  const horizontalThreat = pack.findings.find(f => f.key === 'horizontal_ai_threat')?.value as any;
  const news = pack.findings.find(f => f.key === 'recent_vertical_news')?.value as any[] || [];

  // Pull narrative analysis from factor evidence
  const r1Evidence = sb?.factor_scores.find(f => f.factor_id === 'R1');
  const r2Evidence = sb?.factor_scores.find(f => f.factor_id === 'R2');
  const r3Evidence = sb?.factor_scores.find(f => f.factor_id === 'R3');
  const r4Evidence = sb?.factor_scores.find(f => f.factor_id === 'R4');
  const a8Evidence = sb?.factor_scores.find(f => f.factor_id === 'A8');

  return (
    <div className="space-y-6 report-page">
      {/* Competitive Narrative Summary */}
      {(r1Evidence || r2Evidence) && (
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            COMPETITIVE LANDSCAPE ANALYST BRIEF
          </div>
          <div className="space-y-3">
            {r1Evidence?.evidence_summary && !r1Evidence.evidence_summary.includes('No evidence') && (
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  Competitive Window (R1 · {r1Evidence.raw_score}/100)
                </div>
                <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{r1Evidence.evidence_summary}</p>
              </div>
            )}
            {r2Evidence?.evidence_summary && !r2Evidence.evidence_summary.includes('No evidence') && (
              <div className="pt-3" style={{ borderTop: '1px solid rgba(197,165,114,0.1)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  AI-Native Entrant Threat (R2 · {r2Evidence.raw_score}/100)
                </div>
                <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{r2Evidence.evidence_summary}</p>
              </div>
            )}
            {r3Evidence?.evidence_summary && !r3Evidence.evidence_summary.includes('No evidence') && (
              <div className="pt-3" style={{ borderTop: '1px solid rgba(197,165,114,0.1)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  Incumbent AI Posture (R3 · {r3Evidence.raw_score}/100)
                </div>
                <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{r3Evidence.evidence_summary}</p>
              </div>
            )}
            {r4Evidence?.evidence_summary && !r4Evidence.evidence_summary.includes('No evidence') && (
              <div className="pt-3" style={{ borderTop: '1px solid rgba(197,165,114,0.1)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  Horizontal AI Encroachment (R4 · {r4Evidence.raw_score}/100)
                </div>
                <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{r4Evidence.evidence_summary}</p>
              </div>
            )}
            {a8Evidence?.evidence_summary && !a8Evidence.evidence_summary.includes('No evidence') && (
              <div className="pt-3" style={{ borderTop: '1px solid rgba(197,165,114,0.1)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
                  Compounding Loop Potential (A8 · {a8Evidence.raw_score}/100)
                </div>
                <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>{a8Evidence.evidence_summary}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vertical Heat Index */}
        <Card variant="elevated">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            VERTICAL AI HEAT INDEX
          </div>
          {heatIndex ? (
            <div className="text-center py-4">
              <div className="text-5xl font-bold mb-2" style={{ color: GRADE_COLOR[heatIndex.grade as LetterGrade] || '#C5A572', fontFamily: 'Montserrat' }}>
                {heatIndex.grade}
              </div>
              <div className="text-2xl font-mono mb-3" style={{ color: GRADE_COLOR[heatIndex.grade as LetterGrade] || '#C5A572' }}>
                {heatIndex.score}/100
              </div>
              {/* Thermometer */}
              <div className="relative h-3 rounded-full mx-4 mb-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{
                    width: `${heatIndex.score}%`,
                    background: heatIndex.score > 70 ? '#D32F2F' : heatIndex.score > 50 ? '#FFB300' : '#1DB954',
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                {heatIndex.summary}
              </p>
              {heatIndex.score > 70 && (
                <div className="mt-3 p-2 rounded text-xs" style={{ background: 'rgba(211,47,47,0.1)', color: '#EF5350', fontFamily: 'Inter' }}>
                  Hot vertical — high AI investment activity means the window is open but competition is building fast.
                </div>
              )}
              {heatIndex.score <= 40 && (
                <div className="mt-3 p-2 rounded text-xs" style={{ background: 'rgba(29,185,84,0.1)', color: '#81C784', fontFamily: 'Inter' }}>
                  Cool vertical — limited AI investment activity suggests an early-mover opportunity.
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-xs text-center py-8">Heat index data not collected</div>
          )}
        </Card>

        {/* Horizontal AI Threat */}
        <Card variant="navy" className="lg:col-span-2">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            HORIZONTAL AI ENCROACHMENT ANALYSIS
          </div>
          {horizontalThreat ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{
                    background: horizontalThreat.level === 'HIGH' ? 'rgba(211,47,47,0.15)' : horizontalThreat.level === 'MEDIUM' ? 'rgba(255,179,0,0.15)' : 'rgba(29,185,84,0.15)',
                    color: horizontalThreat.level === 'HIGH' ? '#D32F2F' : horizontalThreat.level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                    fontFamily: 'Montserrat',
                  }}
                >
                  {horizontalThreat.level} RISK
                </span>
                <span className="text-sm text-gray-400" style={{ fontFamily: 'Inter' }}>from horizontal AI platforms</span>
              </div>
              <p className="text-xs text-gray-400 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                Horizontal AI tools like ChatGPT, Microsoft Copilot, and Google Gemini are being adopted by end-users to handle tasks previously done in vertical SaaS products. The question is whether these tools can adequately replace core workflows or whether vertical workflow specificity, compliance requirements, and data integration depth provide sufficient protection.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(horizontalThreat.threat_actors || []).map((actor: string) => (
                  <span key={actor} className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'rgba(197,165,114,0.1)', color: '#C5A572' }}>
                    {actor}
                  </span>
                ))}
              </div>
              {horizontalThreat.use_cases_at_risk?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2" style={{ fontFamily: 'Montserrat' }}>USE CASES AT RISK OF HORIZONTAL DISPLACEMENT:</div>
                  <ul className="space-y-2">
                    {horizontalThreat.use_cases_at_risk.map((uc: string, i: number) => (
                      <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
                        <span style={{ color: '#F57C00' }}>→</span>
                        {uc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-xs">No horizontal threat data collected</div>
          )}
        </Card>
      </div>

      {/* Incumbent Posture Grid */}
      {incumbents.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            INCUMBENT AI POSTURE ({incumbents.length} tracked)
          </div>
          <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
            Existing market leaders' AI deployments are tracked here. ACTIVE = GA product with customer marketing. SIGNALING = roadmap announced or beta launched. SILENT = no public AI activity detected.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incumbents.map((inc: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(0,43,73,0.5)',
                  border: `1px solid ${inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.4)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.4)' : 'rgba(100,116,139,0.3)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{inc.company}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-bold"
                    style={{
                      background: inc.status === 'ACTIVE' ? 'rgba(211,47,47,0.2)' : inc.status === 'SIGNALING' ? 'rgba(255,179,0,0.2)' : 'rgba(100,116,139,0.2)',
                      color: inc.status === 'ACTIVE' ? '#D32F2F' : inc.status === 'SIGNALING' ? '#FFB300' : '#64748B',
                      fontFamily: 'Montserrat',
                    }}
                  >
                    {inc.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>{inc.evidence}</p>
                {inc.url && (
                  <a href={inc.url} target="_blank" rel="noopener" className="text-xs font-mono mt-2 block truncate" style={{ color: '#C5A572' }}>
                    {inc.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI-Native Entrant Table */}
      {entrants.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            AI-NATIVE ENTRANT THREAT MATRIX ({entrants.length} identified)
          </div>
          <p className="text-xs text-gray-500 mb-4" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
            AI-native entrants are the most structurally threatening competition — they build AI-first without legacy constraints. Track funding velocity and customer traction as leading indicators of competitive pressure.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                  {['Company', 'Founded', 'Stage', 'Last Raise', 'Traction Signal', 'Threat Level'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wider" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entrants.map((e: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)' }}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-white text-xs" style={{ fontFamily: 'Montserrat' }}>{e.company}</div>
                      {e.url && <a href={e.url} target="_blank" rel="noopener" className="text-xs font-mono truncate block" style={{ color: '#C5A572' }}>{e.url?.slice(0, 35)}</a>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{e.founded || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300">{e.stage || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 font-mono">{e.last_raise || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400" style={{ maxWidth: '160px', lineHeight: 1.5 }}>{e.traction_signal || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{
                          background: e.threat_level === 'HIGH' ? 'rgba(211,47,47,0.2)' : e.threat_level === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                          color: e.threat_level === 'HIGH' ? '#D32F2F' : e.threat_level === 'MEDIUM' ? '#FFB300' : '#1DB954',
                          fontFamily: 'Montserrat',
                        }}
                      >
                        {e.threat_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Vertical News Feed */}
      {news.length > 0 && (
        <Card variant="navy">
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            VERTICAL AI NEWS & DEAL FEED
          </div>
          <div className="space-y-3">
            {news.map((item: any, i: number) => (
              <div key={i} className="flex gap-3 items-start py-2 border-b border-[rgba(197,165,114,0.1)]">
                <div className="text-xs font-mono text-gray-600 shrink-0 w-20">{item.date || 'Recent'}</div>
                <div className="flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    className="text-sm font-semibold text-white hover:text-[#C5A572] transition-colors"
                    style={{ fontFamily: 'Inter' }}
                  >
                    {item.headline}
                  </a>
                  {item.significance && (
                    <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>{item.significance}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Evidence Tab ─────────────────────────────────────────────────────────────
function EvidenceTab({ record, search, setSearch }: {
  record: ScreeningRecord;
  search: string;
  setSearch: (s: string) => void;
}) {
  const allSources: Array<{ url: string; pack: string; confidence: string; excerpt: string }> = [];
  for (const [packName, pack] of Object.entries(record.data_packs)) {
    if (!pack) continue;
    for (const finding of pack.findings) {
      for (const url of finding.sources) {
        if (url && url.startsWith('http')) {
          allSources.push({
            url,
            pack: packName,
            confidence: finding.confidence,
            excerpt: String(finding.value).slice(0, 100),
          });
        }
      }
    }
  }

  const filtered = allSources.filter(s =>
    !search || s.url.toLowerCase().includes(search.toLowerCase()) || s.pack.includes(search.toLowerCase())
  );

  const packCoverage = Object.entries(record.data_packs).filter(([, p]) => p && !(p as any).v2_stub).length;
  const totalPacks = 7;
  const stubCount = Object.values(record.data_packs).filter(p => (p as any)?.v2_stub).length;
  const failedPacks = Object.entries(record.data_packs).filter(([, p]) => (p as any)?.status === 'failed').map(([k]) => k);

  return (
    <div className="space-y-6 report-page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sources', value: allSources.length },
          { label: 'Live Packs', value: packCoverage },
          { label: 'V2 Stubs', value: stubCount },
          { label: 'Coverage', value: `${Math.round((packCoverage / totalPacks) * 100)}%` },
        ].map((stat) => (
          <Card key={stat.label} variant="navy" padding="sm" className="text-center">
            <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Montserrat' }}>{stat.value}</div>
            <div className="text-xs text-gray-500 tracking-wider" style={{ fontFamily: 'Montserrat' }}>{stat.label.toUpperCase()}</div>
          </Card>
        ))}
      </div>

      {/* Failed packs warning */}
      {failedPacks.length > 0 && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)', color: '#EF5350', fontFamily: 'Inter' }}>
          ⚠️ Failed packs: {failedPacks.join(', ')}. Scores for factors in these packs default to neutral (0.5 signal strength). Check Netlify function logs for error details.
        </div>
      )}

      {allSources.length === 0 && (
        <div className="px-4 py-6 rounded-lg text-center" style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.3)' }}>
          <p className="text-sm text-yellow-400 font-semibold mb-2" style={{ fontFamily: 'Montserrat' }}>No Sources Collected</p>
          <p className="text-xs text-gray-500" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
            No web sources were collected during this screening. This typically means:<br />
            1. TAVILY_API_KEY is not configured or invalid — visit /api/diagnose to check<br />
            2. ANTHROPIC_API_KEY is not configured or invalid — the synthesis and pack steps would also fail<br />
            3. The screening was aborted before evidence collection completed<br /><br />
            Configure your API keys in Netlify Environment Variables and re-run the screening.
          </p>
        </div>
      )}

      {/* Search */}
      {allSources.length > 0 && (
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sources by URL or pack name..."
            className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
            style={{
              background: 'rgba(0,58,99,0.4)',
              border: '1px solid rgba(197,165,114,0.2)',
              fontFamily: 'Inter',
            }}
          />
        </div>
      )}

      {/* Source Table */}
      {filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,165,114,0.2)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#001A2E', borderBottom: '1px solid rgba(197,165,114,0.2)' }}>
                {['Source URL', 'Pack', 'Confidence', 'Excerpt'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(197,165,114,0.1)', background: i % 2 === 0 ? 'rgba(0,26,46,0.5)' : 'transparent' }}>
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <a href={s.url} target="_blank" rel="noopener" className="font-mono truncate block hover:text-[#C5A572] transition-colors" style={{ color: '#64748B' }}>
                      {s.url.slice(0, 55)}{s.url.length > 55 ? '…' : ''}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{s.pack.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5">
                    <SignalChip confidence={s.confidence as any} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[200px] truncate">{s.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Known Unknowns */}
      {(() => {
        const unknowns = Object.entries(record.data_packs).flatMap(([packName, pack]) =>
          ((pack as any)?.findings || []).flatMap((f: any) => f.unknowns.map((u: string) => ({ unknown: u, pack: packName })))
        );
        if (unknowns.length === 0) return null;
        return (
          <Card variant="navy">
            <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
              KNOWN UNKNOWNS — DATA GAPS FOR DILIGENCE
            </div>
            <p className="text-xs text-gray-500 mb-3" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>
              The AI research packs identified the following information gaps that could not be resolved from public sources. These are prioritized next steps for management access and data room review.
            </p>
            <div className="space-y-2">
              {unknowns.map((u, i) => (
                <div key={i} className="flex gap-3 text-xs items-start py-2 px-3 rounded" style={{ background: 'rgba(0,43,73,0.3)' }}>
                  <span className="text-gray-600 font-mono shrink-0">[{u.pack.replace(/_/g, ' ')}]</span>
                  <span className="text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.5 }}>{u.unknown}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── Diligence Tab ────────────────────────────────────────────────────────────
function DiligenceTab({ record }: { record: ScreeningRecord }) {
  const areas = record.diligence_areas || [];
  const conditions = record.upgrade_break_conditions;
  const sb = record.score_bundle;

  return (
    <div className="space-y-6 report-page">
      {/* Diligence Context */}
      {sb && (
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <div className="text-xs font-semibold tracking-widest" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>DILIGENCE FRAMING</div>
          </div>
          <p className="text-sm text-gray-300" style={{ fontFamily: 'Inter', lineHeight: 1.8 }}>
            The Eagle Vision Screener is a fast-pass filter — it identifies the most important questions, not the answers. The items below represent the highest-priority areas where additional evidence would either confirm the {sb.disposition} disposition or require a reassessment. Full Bridge diligence is authored post-first-meeting with management access, customer reference calls, and data room review.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold" style={{ color: sb.disposition === 'GO' ? '#1DB954' : sb.disposition === 'MAYBE' ? '#FFB300' : '#D32F2F', fontFamily: 'Montserrat' }}>{sb.disposition}</div>
              <div className="text-xs text-gray-500 mt-1">Current Disposition</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{sb.critical_gaps.length}</div>
              <div className="text-xs text-gray-500 mt-1">Critical Gaps</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,43,73,0.4)' }}>
              <div className="text-lg font-bold" style={{ color: sb.confidence_overall === 'H' ? '#1DB954' : sb.confidence_overall === 'M' ? '#FFB300' : '#D32F2F', fontFamily: 'Montserrat' }}>{sb.confidence_overall}</div>
              <div className="text-xs text-gray-500 mt-1">Evidence Confidence</div>
            </div>
          </div>
        </Card>
      )}

      {/* Focus Areas */}
      <div>
        <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
          DILIGENCE FOCUS AREAS
        </div>
        {areas.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">No diligence areas generated. Score data may be incomplete.</div>
        ) : (
          <div className="space-y-4">
            {areas.map((area, i) => (
              <Card key={i} variant="navy" goldAccent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl font-bold" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>#{area.rank}</span>
                      <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Montserrat' }}>{area.title}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold ml-auto"
                        style={{
                          background: area.priority === 'HIGH' ? 'rgba(211,47,47,0.2)' : area.priority === 'MEDIUM' ? 'rgba(255,179,0,0.2)' : 'rgba(29,185,84,0.2)',
                          color: area.priority === 'HIGH' ? '#D32F2F' : area.priority === 'MEDIUM' ? '#FFB300' : '#1DB954',
                          fontFamily: 'Montserrat',
                        }}
                      >
                        {area.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>WHY IT MATTERS</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.why_it_matters}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>WHAT TO TEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.what_to_test}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>EVIDENCE TO REQUEST</div>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>{area.evidence_to_request}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade/Break Conditions */}
      {conditions && (
        <div>
          <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
            DISPOSITION CHANGE CONDITIONS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#1DB954', fontFamily: 'Montserrat' }}>
                ↑ UPGRADE TO GO
              </div>
              <p className="text-xs text-gray-600 mb-3" style={{ fontFamily: 'Inter' }}>
                These evidence items, if confirmed in diligence, would upgrade the disposition to GO:
              </p>
              <ul className="space-y-3">
                {conditions.upgrade_to_go.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#1DB954', flexShrink: 0, marginTop: 2 }}>✓</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#FFB300', fontFamily: 'Montserrat' }}>
                ~ KEEPS MAYBE
              </div>
              <p className="text-xs text-gray-600 mb-3" style={{ fontFamily: 'Inter' }}>
                These conditions would maintain the current disposition:
              </p>
              <ul className="space-y-3">
                {conditions.keep_maybe.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#FFB300', flexShrink: 0, marginTop: 2 }}>~</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="navy" padding="sm">
              <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#D32F2F', fontFamily: 'Montserrat' }}>
                ↓ DROP TO NO-GO
              </div>
              <p className="text-xs text-gray-600 mb-3" style={{ fontFamily: 'Inter' }}>
                These confirmed findings would drop the disposition to NO-GO:
              </p>
              <ul className="space-y-3">
                {conditions.drop_to_nogo.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2" style={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                    <span style={{ color: '#D32F2F', flexShrink: 0, marginTop: 2 }}>✕</span>{c}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* Advance CTA */}
      <Card variant="elevated" className="text-center py-8">
        <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: '#C5A572', fontFamily: 'Montserrat' }}>
          NEXT STEP
        </div>
        <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Montserrat' }}>
          Advance to Full Diligence
        </h3>
        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto" style={{ fontFamily: 'Inter', lineHeight: 1.7 }}>
          Eagle Vision is a fast-pass filter that takes 30–50 minutes. Full Bridge diligence is a 2–3 week process requiring management access, customer reference calls (minimum 5), technical architecture review, and data room analysis. The items above define your diligence agenda.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => exportToPDF()}
            className="px-6 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: '#CFFF04', color: '#002B49', fontFamily: 'Montserrat' }}
          >
            Download Report PDF
          </button>
          <button
            onClick={() => exportToJSON(record)}
            className="px-6 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: 'rgba(197,165,114,0.15)', color: '#C5A572', border: '1px solid rgba(197,165,114,0.3)', fontFamily: 'Montserrat' }}
          >
            Export JSON
          </button>
        </div>
      </Card>
    </div>
  );
}
