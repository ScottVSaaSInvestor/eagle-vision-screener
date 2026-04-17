import type { ScoreBundle, DiligenceFocusArea, UpgradeBreakConditions, PackName, DataPack, FactorId } from '../types';

// ─── Factor-specific diligence templates ─────────────────────────────────────
// Each template provides rich, specific guidance for each factor gap.
const FACTOR_DILIGENCE: Record<FactorId, {
  title: string;
  why_template: (score: number) => string;
  what_to_test: string;
  evidence_to_request: string;
}> = {
  A1: {
    title: 'Workflow Embeddedness Deep Dive',
    why_template: (s) => `Workflow Embeddedness scored ${s}/100 — ${s < 30 ? 'the product appears peripheral to daily operations, creating serious churn and switching risk. AI features built on non-embedded workflows rarely achieve ROI' : s < 55 ? 'moderate embeddedness detected but mission-critical status is unconfirmed. Defensibility against AI-native entrants depends heavily on becoming the system of record' : 'solid embeddedness but depth and breadth of integration needs verification through customer interviews'}.`,
    what_to_test: 'Conduct 5+ customer interviews asking: "What breaks first if this software goes down?" Measure daily active users vs seats, time-in-app, and API call volume. Verify whether the product is the authoritative data source for core operations.',
    evidence_to_request: 'Customer usage analytics (DAU/MAU, session length, feature adoption), integration architecture diagram, API call logs, customer health scores segmented by workflow depth',
  },
  A2: {
    title: 'Data Foundation & Quality Audit',
    why_template: (s) => `Data Foundation scored ${s}/100. ${s < 30 ? 'Lack of structured longitudinal data is a critical blocker — AI/ML models require high-quality historical data to train and improve. This is a fundamental readiness gap.' : s < 55 ? 'Basic data infrastructure exists but richness, completeness, and longitudinal depth may be insufficient for advanced ML. Data quality will constrain what AI capabilities can be built.' : 'Data foundation is developing — need to verify schema quality, labeling completeness, and whether data is actually usable for ML workloads.'}`,
    what_to_test: 'Technical architecture review: data schema, record completeness %, years of historical data, data governance practices, ETL pipeline quality. Ask: "What is your data retention period? What % of records have complete fields? Do you have labeled outcome data?"',
    evidence_to_request: 'Data dictionary, sample anonymized schema, data completeness report, current ML pipeline documentation (if any), data governance policy',
  },
  A3: {
    title: 'Outcome-Labeled Data Assessment',
    why_template: (s) => `Outcome-Labeled Data scored ${s}/100. ${s < 30 ? 'No systematic outcome tracking — this is the most critical AI readiness gap. Without labeled outcome data, predictive models cannot be trained or validated, and AI features will be limited to automation rather than intelligence.' : s < 55 ? 'Partial outcome labeling detected. The ability to build truly predictive AI (vs. rule-based automation) depends on having outcomes linked to the inputs that preceded them.' : 'Some outcome tracking in place — need to verify labeling consistency, coverage %, and whether outcomes are granular enough for model training.'}`,
    what_to_test: 'Assess whether patient/customer outcomes are systematically linked back to prior decisions, interventions, and data inputs. Verify data pipeline from action to outcome. Ask: "Can you pull a dataset of X intervention → Y outcome for model training?"',
    evidence_to_request: 'Sample data schema showing input-to-outcome linkage, outcome tracking methodology documentation, data science team\'s current model training datasets',
  },
  A4: {
    title: 'Value Quantification & ROI Evidence',
    why_template: (s) => `Value Quantification scored ${s}/100. ${s < 30 ? 'No quantified ROI evidence — this severely limits the ability to justify premium pricing for AI features and will make outcome-based pricing extremely difficult.' : s < 55 ? 'Anecdotal value claims but limited hard ROI data. Institutional investors and sophisticated buyers are increasingly demanding measurable outcomes before committing to AI-enhanced pricing.' : 'Some ROI evidence exists — verify whether it is independently validated, statistically significant, and sufficient to underpin usage-based or outcome-based pricing models.'}`,
    what_to_test: 'Audit case studies for statistical rigor. Verify ROI claims with customer reference calls. Test whether the company can articulate dollar-per-unit savings or revenue gains delivered. Ask: "What is your cost-per-outcome in a reference customer, and how do you measure it?"',
    evidence_to_request: 'Customer ROI analysis methodology, 3+ validated case studies with quantified outcomes, customer success metrics dashboard',
  },
  A5: {
    title: 'Pricing Model Flexibility Assessment',
    why_template: (s) => `Pricing Model Flexibility scored ${s}/100. ${s < 30 ? 'Rigid per-seat pricing with no pathway to AI value capture — this is a significant value creation risk. As AI automates user tasks, seat-based revenue will decline even as value delivered increases.' : s < 55 ? 'Limited pricing flexibility detected. The ability to monetize AI at premium rates depends on migrating from seat-based to consumption, outcome, or value-based models.' : 'Moderate pricing flexibility — need to confirm management\'s willingness and capability to evolve toward AI-native pricing structures.'}`,
    what_to_test: 'Test management\'s understanding of AI pricing evolution. Ask: "How would pricing change if AI halves your users\' work time?" Audit contract structures for flexibility clauses. Verify whether customers have accepted usage-based or outcome-based pilots.',
    evidence_to_request: 'Sample customer contracts showing pricing structure, pricing strategy document, any pilots of non-seat-based pricing, competitive pricing intelligence',
  },
  A6: {
    title: 'AI/ML Team Capability Evaluation',
    why_template: (s) => `AI/ML Team Capability scored ${s}/100. ${s < 30 ? 'No dedicated AI/ML team — the company cannot build meaningful AI products without this capability. Acquisitions or major hires are required before AI value creation is possible.' : s < 55 ? 'Limited AI/ML capacity. The team may be able to ship AI features via API integrations (OpenAI, etc.) but lacks the depth for proprietary models, fine-tuning, or defending against AI-native competition.' : 'Developing AI team — verify depth of ML expertise vs. API wrappers, research credentials, and ability to build defensible proprietary models.'}`,
    what_to_test: 'Interview CTO and head of AI/ML. Assess: ML engineer headcount, PhD/research credentials, proprietary vs. third-party model usage, model training infrastructure, hiring pipeline. Key question: "What models do you run internally vs. via APIs?"',
    evidence_to_request: 'Org chart with AI/ML team highlighted, job descriptions for open AI roles, any published research or patents, description of current AI architecture (proprietary vs. API-based)',
  },
  A7: {
    title: 'Architecture Readiness Technical Review',
    why_template: (s) => `Architecture Readiness scored ${s}/100. ${s < 30 ? 'Legacy architecture detected — technical debt is likely to impose significant latency, cost, and complexity in AI integration. Replatforming may be required before AI workloads can run.' : s < 55 ? 'Partial API-first architecture. ML workloads, real-time inference, and data pipelines require modern cloud-native infrastructure that may not yet be in place.' : 'Developing architecture — need to verify cloud-nativeness, ML infrastructure (feature stores, model serving, monitoring), and ability to handle real-time AI inference at scale.'}`,
    what_to_test: 'Technical architecture walkthrough: cloud provider(s), microservices vs. monolith, real-time data pipeline capability, model serving infrastructure, CI/CD for ML models. Ask: "How long does it take to deploy a new ML model to production?"',
    evidence_to_request: 'High-level architecture diagram, cloud infrastructure spend and vendor breakdown, ML infrastructure roadmap, current DevOps/MLOps documentation',
  },
  A8: {
    title: 'Compounding Loop Potential Analysis',
    why_template: (s) => `Compounding Loop Potential scored ${s}/100. ${s < 30 ? 'No evident data/network effect flywheel — the business will not benefit from the compounding advantages that make AI-native vertical SaaS increasingly valuable over time.' : s < 55 ? 'Basic usage data collection but no clear flywheel design. Compounding loops (more users → more data → better models → more users) are the key structural advantage of AI-native incumbents.' : 'Some compounding potential identified — need to verify whether loop mechanics are intentionally designed and whether data advantages are actually accumulating.'}`,
    what_to_test: 'Map the data flywheel: How does each additional customer make the product better for all customers? Assess whether benchmarking, comparative analytics, or cross-customer learning is built into the product. Ask: "Does your product improve as more customers use it, and how?"',
    evidence_to_request: 'Product roadmap with network effect features, any benchmarking or aggregated analytics capabilities, data sharing/pooling architecture documentation',
  },
  A9: {
    title: 'Leadership AI Conviction Assessment',
    why_template: (s) => `Leadership AI Clarity scored ${s}/100. ${s < 30 ? 'No clear AI strategy from leadership — without CEO-level conviction and a coherent AI roadmap, execution will be slow, talent acquisition will suffer, and competitors will outpace the company.' : s < 55 ? 'Vague AI direction detected. Success in AI transformation requires CEO-level sponsorship, board alignment, and a concrete multi-year roadmap with measurable milestones.' : 'AI awareness present but depth of conviction and execution track record needs verification through management interviews.'}`,
    what_to_test: 'CEO 1:1 with open-ended AI questions: "What does this company look like in 3 years with AI fully deployed? What is your Build vs. Buy vs. Partner framework? How is the board aligned on AI investment levels?" Assess specificity and urgency of answers.',
    evidence_to_request: 'Board presentation with AI section, CEO written communications on AI strategy (letters, blog posts), AI-specific hiring plan and budget allocation',
  },
  A10: {
    title: 'SOR→SOA Transition Path Validation',
    why_template: (s) => `SOR→SOA Transition Path scored ${s}/100. ${s < 30 ? 'The company has not established a credible System of Record position, or the SOA path is unclear. This is the foundational PE thesis — without it, the AI investment rationale is weak.' : s < 55 ? 'SOR position appears established but the path from System of Record to System of Action is not yet well-defined. The investment thesis requires a concrete, credible AI value creation roadmap.' : 'SOR position is solid and early SOA signals are present — need to validate the specific AI use cases, timelines, and economic model for the transition.'}`,
    what_to_test: 'Verify SOR position: "Is this the authoritative data source for core operations?" Define 3 specific SOA use cases (e.g., predictive scheduling, outcome optimization, automated compliance). Assess feasibility timeline and economic model for each. Ask: "What would your product do differently with AI in Year 2 vs. Year 1 vs. today?"',
    evidence_to_request: 'Product roadmap with AI milestones, any prototypes or pilots of AI-driven workflow automation, customer interviews on desired AI use cases, technical feasibility assessment for top 3 SOA use cases',
  },
  R1: {
    title: 'Competitive Window Validation',
    why_template: (s) => `Competitive Window scored ${s}/100 (risk). ${s > 70 ? 'Window appears to be closing — rapid competitive landscape evolution threatens investment timing. Urgency is critical.' : s > 50 ? 'Window is narrowing. Competitive dynamics are accelerating and the investment case requires a clear time-sensitive thesis.' : 'Window appears open — validate this is sustained and not an artifact of incomplete data.'}`,
    what_to_test: 'Map competitive timeline: when did AI-native entrants enter? What is their current revenue traction? Poll 10+ customers about competitive alternatives they have evaluated in the last 12 months.',
    evidence_to_request: 'Customer win/loss analysis (last 12 months), competitive feature comparison matrix, AI-native entrant funding and traction data',
  },
  R2: {
    title: 'AI-Native Entrant Threat Assessment',
    why_template: (s) => `AI-Native Entrant Threat scored ${s}/100 (risk). ${s > 70 ? 'Multiple well-funded AI-native entrants identified — this is a critical risk that may not leave sufficient time for the target company to develop competitive AI capabilities.' : s > 50 ? '2+ entrants with some funding detected. Timeline to Series B for the most threatening entrant is a key watchpoint.' : 'Limited AI-native threat at this time — verify completeness of competitive landscape scan.'}`,
    what_to_test: 'Deep research on each identified AI-native entrant: funding stage, ARR, customer logos, feature set comparison, hiring velocity. Customer interviews: "Have you evaluated [Entrant X]? What was your conclusion?"',
    evidence_to_request: 'Detailed competitive intelligence report on top 5 AI-native entrants, customer evaluation documents for competitive alternatives',
  },
  R3: {
    title: 'Incumbent AI Posture Review',
    why_template: (s) => `Incumbent AI Posture scored ${s}/100 (risk). ${s > 70 ? 'Incumbents have shipped and are marketing AI features — the competitive clock has started. Customer adoption of incumbent AI features is the key metric to track.' : s > 50 ? 'Incumbents have signaled or shipped beta AI features. Time to GA and customer traction is the critical variable.' : 'Incumbents appear passive — verify this is accurate and not due to data gaps.'}`,
    what_to_test: 'Demo the AI features of each incumbent. Customer interviews: "Has [Incumbent X]\'s AI features changed your evaluation?" Track incumbent AI hiring velocity as a leading indicator of roadmap seriousness.',
    evidence_to_request: 'Screenshots/demos of incumbent AI features, customer quotes on incumbent AI evaluation, incumbent AI job postings',
  },
  R4: {
    title: 'Horizontal AI Encroachment Assessment',
    why_template: (s) => `Horizontal AI Encroachment scored ${s}/100 (risk). ${s > 70 ? 'Documented customer usage of horizontal AI tools for core use cases — this threatens the product\'s value proposition at the workflow level.' : s > 50 ? 'Experiments with horizontal AI tools documented. Need to assess whether these are isolated cases or a broader trend.' : 'Low horizontal threat at this time — verify through customer interviews.'}`,
    what_to_test: 'Customer survey: "Are you or your team using ChatGPT, Copilot, or other AI tools for tasks you previously did in [product]?" Audit product features against horizontal AI capabilities to identify overlap risk.',
    evidence_to_request: 'Customer survey on horizontal AI usage, product-to-horizontal AI feature overlap analysis, any internal studies on competitive AI positioning',
  },
  R5: {
    title: 'Customer Switching Propensity Analysis',
    why_template: (s) => `Customer Switching Propensity scored ${s}/100 (risk). ${s > 70 ? 'Low switching costs detected — customers are vulnerable to displacement by better AI-native alternatives. Retention may depend more on inertia than genuine lock-in.' : s > 50 ? 'Moderate switching costs. Data migration friction and integration complexity provide some protection but may not be sufficient against superior AI alternatives.' : 'High switching costs appear to be in place — validate depth and durability of lock-in mechanisms.'}`,
    what_to_test: 'Ask customers: "If a competitor offered equal functionality at 30% lower cost, how long would it take you to switch?" Audit data portability, API export capabilities, and integration replacement complexity.',
    evidence_to_request: 'Average contract length and renewal rates, data export/portability documentation, integration replacement cost estimates, customer churn analysis',
  },
  R6: {
    title: 'Regulatory Moat Durability Study',
    why_template: (s) => `Regulatory Moat Durability scored ${s}/100 (risk). ${s > 70 ? 'Regulatory moat appears thin — compliance requirements alone may not provide sufficient barrier to entry against well-funded competitors willing to invest in certifications.' : s > 50 ? 'Moderate regulatory protection. Certifications provide some barrier but the competitive landscape is actively investing in compliance capabilities.' : 'Strong regulatory moat in place — confirm durability and whether regulatory landscape changes could erode this advantage.'}`,
    what_to_test: 'Map the compliance requirements that create barriers. Ask: "How long and how expensive was SOC2/HIPAA/[certification] to achieve?" Interview customers about compliance requirements in vendor selection. Assess whether AI tools could accelerate competitor compliance timelines.',
    evidence_to_request: 'Complete list of certifications with dates obtained, cost and timeline analysis, competitive certification status matrix, regulatory change monitoring',
  },
  R7: {
    title: 'Market Timing & Macro Risk Analysis',
    why_template: (s) => `Market Timing Risk scored ${s}/100 (risk). ${s > 70 ? 'Challenging market timing detected — either the market is over-funded (valuation compression risk), macro headwinds are present, or the timing window may be closing.' : s > 50 ? 'Moderate timing risks present. M&A multiples, PE deal flow, and macro conditions need careful assessment.' : 'Favorable timing window appears open — verify through market channel checks.'}`,
    what_to_test: 'Channel checks with 3+ investment bankers in the vertical on deal flow and valuations. PE survey on current M&A appetite. Macro sensitivity analysis: "How does this business perform if tech budgets contract 20%?"',
    evidence_to_request: 'Recent investment banker presentations on vertical M&A activity, comparable transaction analysis, management model under 20% revenue stress test',
  },
};

export function generateDiligenceAreas(
  score: ScoreBundle,
  dataPacks: Partial<Record<PackName, DataPack>>
): DiligenceFocusArea[] {
  const areas: DiligenceFocusArea[] = [];

  // Pull actual data from packs to enrich diligence areas
  const compPack = dataPacks.competitive_landscape;
  const entrantCount = (compPack?.findings.find(f => f.key === 'ai_native_entrants')?.value as any[] || []).length;
  const incumbentCount = (compPack?.findings.find(f => f.key === 'incumbent_postures')?.value as any[] || []).length;
  const redFlagsAll = Object.values(dataPacks).flatMap(p => p?.red_flags || []);

  // Competitive landscape is always diligence area #1
  areas.push({
    rank: 1,
    title: 'Competitive Threat Validation',
    why_it_matters: `AI Risk Score is ${score.risk_score.toFixed(0)}/100. ${entrantCount > 0 ? `Research identified ${entrantCount} AI-native entrants and ${incumbentCount} incumbents with active AI posture. ` : ''}The competitive window is the single most important variable in investment timing — earlier is better, but you must confirm the window is genuinely open.`,
    what_to_test: 'Map every AI-native entrant with Series A+. Get LOIs from 3 target customers specifically asking about competitive alternatives evaluated in the last 12 months. Call 5 customers who chose this company over alternatives — what was the deciding factor? Verify all incumbent AI roadmap timelines with live product demos.',
    evidence_to_request: 'Complete competitor feature matrix with AI capabilities rated 1-5, customer win/loss analysis last 12 months broken down by competitor, sales battlecard showing handling of AI alternatives, incumbent product demos and roadmap documents',
    priority: score.risk_score > 65 ? 'HIGH' : 'MEDIUM',
  });

  // Critical gaps — specific per-factor diligence with full details
  const gapFactors = score.factor_scores
    .filter(f => f.is_critical_gap)
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 3);

  for (const factorScore of gapFactors) {
    const template = FACTOR_DILIGENCE[factorScore.factor_id];
    if (!template) continue;
    areas.push({
      rank: areas.length + 1,
      title: template.title,
      why_it_matters: template.why_template(factorScore.raw_score) +
        (factorScore.evidence_summary && !factorScore.evidence_summary.includes('No evidence') && !factorScore.evidence_summary.includes('Pack failed')
          ? ` Current evidence: "${factorScore.evidence_summary.slice(0, 180).replace(/\.\.\.$/, '')}"`
          : ''),
      what_to_test: template.what_to_test,
      evidence_to_request: template.evidence_to_request,
      priority: 'HIGH',
    });
  }

  // High-risk factors that aren't critical gaps but need validation
  const highRiskFactors = score.factor_scores
    .filter(f => f.factor_id.startsWith('R') && f.raw_score > 65)
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 2);

  for (const f of highRiskFactors) {
    const template = FACTOR_DILIGENCE[f.factor_id];
    if (!template) continue;
    // Don't double-add if already there
    if (areas.some(a => a.title === template.title)) continue;
    areas.push({
      rank: areas.length + 1,
      title: template.title,
      why_it_matters: template.why_template(f.raw_score),
      what_to_test: template.what_to_test,
      evidence_to_request: template.evidence_to_request,
      priority: f.raw_score > 75 ? 'HIGH' : 'MEDIUM',
    });
  }

  // AI readiness deep-dive if needed
  if (score.readiness_score < 60 && areas.length < 5) {
    areas.push({
      rank: areas.length + 1,
      title: 'AI Readiness Technical Audit',
      why_it_matters: `AI Readiness Score is ${score.readiness_score.toFixed(0)}/100. ${score.readiness_score < 45 ? 'This is below the minimum threshold for near-term AI value creation. Without significant investment in data infrastructure, ML team, and architecture, the AI opportunity will not be accessible within a typical investment horizon.' : 'Moderate readiness requires investment to unlock full AI value creation potential. The gap between current state and AI-enabled operations needs to be quantified for investment thesis sizing.'}`,
      what_to_test: 'Full-day technical deep-dive: data schema walkthrough, ML engineer interviews (assess depth vs. API wrappers), architecture review (cloud, microservices, real-time pipeline), data governance audit. Key deliverable: an independent technical assessment of cost and timeline to reach AI readiness.',
      evidence_to_request: 'Complete technical architecture documentation, data dictionary with completeness %, cloud infrastructure cost breakdown, ML team org chart with credentials, roadmap to AI readiness with capex estimate',
      priority: score.readiness_score < 45 ? 'HIGH' : 'MEDIUM',
    });
  }

  // Red flag-specific diligence
  if (redFlagsAll.length > 0 && areas.length < 5) {
    areas.push({
      rank: areas.length + 1,
      title: 'Red Flag Resolution',
      why_it_matters: `Research surfaced ${redFlagsAll.length} red flag${redFlagsAll.length > 1 ? 's' : ''} requiring specific resolution before advancing to full diligence. These items represent either investment risks or data gaps that could materially change the disposition.`,
      what_to_test: redFlagsAll.slice(0, 3).map((f, i) => `${i + 1}. Investigate: ${f}`).join(' '),
      evidence_to_request: 'Management response to each identified red flag with supporting documentation, customer references willing to speak to the flagged area',
      priority: 'HIGH',
    });
  }

  // Always add leadership AI conviction if not already maxed
  if (areas.length < 6) {
    const a9Score = score.factor_scores.find(f => f.factor_id === 'A9');
    const template = FACTOR_DILIGENCE['A9'];
    areas.push({
      rank: areas.length + 1,
      title: template.title,
      why_it_matters: template.why_template(a9Score?.raw_score ?? 50) + ' AI success in vertical SaaS is 50% leadership conviction and 50% technical capability. You need both.',
      what_to_test: template.what_to_test,
      evidence_to_request: template.evidence_to_request,
      priority: (a9Score?.raw_score ?? 50) < 40 ? 'HIGH' : 'MEDIUM',
    });
  }

  return areas
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 6)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

export function generateUpgradeBreakConditions(
  score: ScoreBundle,
  companyName: string
): UpgradeBreakConditions {
  const advanceSignals: string[] = [];
  const keyQuestions: string[] = [];
  const watchList: string[] = [];

  const criticalGapNames = score.factor_scores
    .filter(f => f.is_critical_gap)
    .map(f => f.factor_name)
    .join(', ');

  // ADVANCE SIGNALS — evidence that builds conviction to move forward
  advanceSignals.push(
    `Management 1:1 confirms specific AI product roadmap with budget allocated, named AI hires planned or in place, and executive sponsor driving the initiative`,
    criticalGapNames
      ? `Diligence resolves critical gaps in: ${criticalGapNames} — specifically through customer interviews confirming workflow lock-in and technical review confirming data infrastructure`
      : `Customer interviews confirm >80% workflow dependency with low switching intent and active AI feature requests`,
    `Win/loss analysis from last 12 months shows <15% losses attributable to AI-native competitors or incumbent AI features in ${companyName}'s core verticals`,
    `Technical review confirms ${companyName}'s data architecture can support ML workloads within 6-12 months without a full replatform`
  );

  // KEY QUESTIONS — the specific open questions to resolve in diligence
  const quadrant = score.quadrant;
  if (quadrant === 'DANGER_ZONE') {
    keyQuestions.push(
      `How fast is the competitive window closing? Get specific timelines: when do AI-native entrants reach Series B, when do incumbents ship GA AI features?`,
      `What is management's current AI awareness? A CEO who can name 3 AI-native competitors and has a response plan is very different from one who cannot`,
      `What is the switching cost structure? If customers are genuinely locked in by workflow integration, the threat timeline extends materially`
    );
  } else if (quadrant === 'BUILD_MODE') {
    keyQuestions.push(
      `How deep is the System of Record position? Get customer cohort data: what % of daily operations run through ${companyName}, and what would switching cost operationally?`,
      `What is the realistic AI build timeline? Given current engineering team and data infrastructure, can they reach Stage 2 (AI-Enabled) within 12-18 months post-close?`,
      `Who owns AI internally? Is there a technical co-founder, VP Engineering, or Head of AI who can actually execute the build plan?`
    );
  } else if (quadrant === 'RACE_MODE') {
    keyQuestions.push(
      `What is the AI acceleration plan for the first 100 days post-close? The window is open but competitors are moving — what is the specific sprint plan?`,
      `Which AI features are table-stakes vs. differentiators? Focus first on the features that protect the SOR position, then on features that expand the value prop`,
      `Can the team execute at the required speed? Assess whether current engineering velocity is compatible with the competitive timeline`
    );
  } else {
    // EXECUTE
    keyQuestions.push(
      `Validate the AI moat: what specifically prevents a well-funded AI-native entrant from replicating the core workflow in 18-24 months?`,
      `What is the SOA (System of Action) roadmap? The company is well-positioned — but do they have a credible plan to move from AI-Enabled to AI-Native in the hold period?`,
      `What does outcome-based pricing look like in this vertical? Can the company shift from seat-based to value-based pricing as AI proves ROI?`
    );
  }

  // Current confidence note
  if (score.confidence_overall === 'L') {
    keyQuestions.push(
      `Note: Perch confidence is LOW — this is a directional screen, not a deep research. Management access and data room review will materially sharpen the picture on most factors`
    );
  }

  // WATCH LIST — factors to monitor that could change the picture if confirmed negative
  watchList.push(
    `AI-native entrant Series B+ funding rounds in ${companyName}'s specific sub-vertical — track funding databases monthly through diligence`,
    `Incumbent AI feature launches: monitor product release notes from the 3-5 largest incumbents for GA-status AI features targeting ${companyName}'s use cases`,
    `${companyName} management AI conviction in 1:1 sessions — if leadership cannot articulate a specific AI roadmap with budget and timeline, the build thesis is at risk`
  );

  if (criticalGapNames) {
    watchList.push(
      `Technical diligence finding: if ${criticalGapNames} gaps cannot be closed within the hold period without a full replatform (>18 months, >$5M), reassess the build economics`
    );
  }

  return { advance_signals: advanceSignals, key_questions: keyQuestions, watch_list: watchList };
}
