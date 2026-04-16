import type { ScoreBundle, DiligenceFocusArea, UpgradeBreakConditions, PackName, DataPack } from '../types';

export function generateDiligenceAreas(
  score: ScoreBundle,
  _dataPacks: Partial<Record<PackName, DataPack>>
): DiligenceFocusArea[] {
  const areas: DiligenceFocusArea[] = [];

  // Always include competitive landscape check
  areas.push({
    rank: 1,
    title: 'Competitive Threat Validation',
    why_it_matters: `AI Risk Score is ${score.risk_score.toFixed(0)}/100. The competitive window is the most critical determinant of investment timing.`,
    what_to_test: 'Map all AI-native entrants, get LOIs from 3 target customers asking about competitive alternatives, verify incumbent AI roadmap timelines.',
    evidence_to_request: 'Competitor feature matrix, customer win/loss analysis last 12 months, sales battlecard',
    priority: score.risk_score > 65 ? 'HIGH' : 'MEDIUM',
  });

  // Add gap-specific areas
  for (const factorId of score.critical_gaps.slice(0, 3)) {
    const factorScore = score.factor_scores.find(f => f.factor_id === factorId);
    if (!factorScore) continue;

    areas.push({
      rank: areas.length + 1,
      title: `${factorScore.factor_name} Assessment`,
      why_it_matters: `Critical gap detected — scored ${factorScore.raw_score}/100. This factor is below the 40-point threshold.`,
      what_to_test: `Conduct deep assessment of ${factorScore.factor_name.toLowerCase()} through customer interviews and technical review.`,
      evidence_to_request: `${factorScore.factor_name} documentation, metrics dashboard, roadmap`,
      priority: 'HIGH',
    });
  }

  // AI readiness deep-dive
  if (score.readiness_score < 60) {
    areas.push({
      rank: areas.length + 1,
      title: 'AI Readiness Technical Audit',
      why_it_matters: `AI Readiness Score is ${score.readiness_score.toFixed(0)}/100. Technical infrastructure may limit AI value creation.`,
      what_to_test: 'Data infrastructure review, ML team interviews, architecture walkthrough, data governance assessment',
      evidence_to_request: 'Technical architecture docs, data schema overview, ML pipeline documentation',
      priority: score.readiness_score < 45 ? 'HIGH' : 'MEDIUM',
    });
  }

  // Team AI capability
  areas.push({
    rank: areas.length + 1,
    title: 'Leadership AI Vision & Execution',
    why_it_matters: 'AI success in vertical SaaS is 50% leadership conviction and 50% technical capability.',
    what_to_test: 'CEO 1:1 on AI strategy, CTO architecture vision, key ML hire plans, board AI alignment',
    evidence_to_request: 'AI strategy document, hiring plan, board deck AI section',
    priority: 'MEDIUM',
  });

  return areas.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 5);
}

export function generateUpgradeBreakConditions(
  score: ScoreBundle,
  companyName: string
): UpgradeBreakConditions {
  const upgradeToGo: string[] = [];
  const keepMaybe: string[] = [];
  const dropToNogo: string[] = [];

  if (score.disposition === 'MAYBE') {
    upgradeToGo.push(
      `AI Risk drops below 50 (currently ${score.risk_score.toFixed(0)}) through evidence of durable competitive advantage`,
      'Zero critical gaps confirmed through technical diligence',
      'Customer win/loss shows <10% AI-native competitive losses in last 6 months'
    );
    keepMaybe.push(
      'Current competitive picture is incomplete — 2+ packs are V2 stubs with LOW confidence',
      `Confidence is ${score.confidence_overall} — full data collection would clarify disposition`
    );
    dropToNogo.push(
      '2 or more additional critical gaps confirmed in technical diligence',
      'AI-native entrants with Series B+ funding found at >3 companies',
      'Incumbent launches GA AI feature with confirmed customer traction'
    );
  } else if (score.disposition === 'GO') {
    upgradeToGo.push('Already GO — maintain conviction through full diligence');
    keepMaybe.push('n/a');
    dropToNogo.push(
      'Technical diligence reveals architecture cannot support AI workloads',
      'Customer interviews reveal high switching propensity (>40% considering alternatives)',
      '3+ AI-native entrants confirmed with traction not captured in current research'
    );
  } else {
    upgradeToGo.push(
      'Fundamental business model change — unlikely at this stage',
      'All critical gaps resolved with HIGH confidence evidence'
    );
    keepMaybe.push('n/a — disposition is NO-GO');
    dropToNogo.push('Already NO-GO — would need complete reassessment to change');
  }

  return { upgrade_to_go: upgradeToGo, keep_maybe: keepMaybe, drop_to_nogo: dropToNogo };
}
