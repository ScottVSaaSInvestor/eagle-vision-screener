/**
 * Eagle Vision Orchestrator
 * Client-side workflow manager — coordinates all research, pack calls, and scoring
 */

import type {
  ScreeningInputs, ScreeningRecord, DataPack,
  EvidenceItem, PackName, ProgressEvent
} from './types';
import { computeScoreBundle } from './scoring/scoringEngine';
import {
  createWorkflowProductStub,
  createDataArchitectureStub,
  createMarketTimingStub,
} from './packs/stubPacks';
import { generateDiligenceAreas, generateUpgradeBreakConditions } from './packs/diligenceGenerator';

type ProgressCallback = (event: Omit<ProgressEvent, 'timestamp'>) => void;
type PackUpdateCallback = (pack: PackName, data: DataPack) => void;
type AbortChecker = () => boolean;

async function apiCall(endpoint: string, payload: object, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

async function searchMultiple(
  queries: string[],
  log: ProgressCallback
): Promise<string[]> {
  const results: string[] = [];
  for (const query of queries.slice(0, 4)) {
    try {
      const data = await apiCall('research-search', { query, max_results: 5, search_depth: 'basic' }, 10000);
      if (data.results) {
        for (const r of data.results) {
          if (r.content) results.push(`[${r.title}](${r.url})\n${r.content}`);
        }
      }
      if (data.answer) results.push(`Search Summary: ${data.answer}`);
    } catch {
      log({ message: `Search failed for: ${query.slice(0, 60)}`, level: 'warning' });
    }
  }
  return results;
}

async function crawlUrl(url: string, log: ProgressCallback): Promise<string> {
  try {
    const data = await apiCall('research-crawl', { url, max_chars: 4000 }, 8000);
    if (data.success && data.text) return `[Crawled: ${url}]\nTitle: ${data.title}\n${data.text}`;
  } catch {
    log({ message: `Crawl failed: ${url}`, level: 'warning' });
  }
  return '';
}

export async function runScreening(
  inputs: ScreeningInputs,
  onProgress: ProgressCallback,
  onPackUpdate: PackUpdateCallback,
  isAborted: AbortChecker
): Promise<Partial<ScreeningRecord>> {
  const dataPacks: Partial<Record<PackName, DataPack>> = {};
  const evidenceLog: EvidenceItem[] = [];

  const log = onProgress;

  // ─── STAGE 1: Company Profile ─────────────────────────────────────────────
  log({ message: `Starting Eagle Vision screening for ${inputs.company_name}`, level: 'info' });
  log({ message: 'Stage 1: Gathering company profile data...', level: 'info' });

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // Search for company basics
  const profileQueries = [
    `${inputs.company_name} SaaS company overview funding`,
    `${inputs.company_name} ${inputs.company_url || ''} product features customers`,
    `${inputs.company_name} revenue ARR growth 2023 2024`,
  ];

  log({ message: 'Searching for company profile...', level: 'info', pack: 'company_profile' });
  const profileTexts = await searchMultiple(profileQueries, log);

  // Crawl company homepage
  if (inputs.company_url) {
    log({ message: `Crawling ${inputs.company_url}...`, level: 'info', pack: 'company_profile' });
    const homeText = await crawlUrl(inputs.company_url, log);
    if (homeText) profileTexts.unshift(homeText);
  }

  // Add document text if provided
  const documentText = inputs.documents
    .filter(d => d.text_content)
    .map(d => d.text_content)
    .join('\n\n')
    .slice(0, 5000);

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: 'Running Company Profile pack...', level: 'info', pack: 'company_profile' });
  try {
    const profilePack = await apiCall('pack-company-profile', {
      company_name: inputs.company_name,
      company_url: inputs.company_url,
      evidence_texts: profileTexts,
      document_text: documentText,
    }, 20000);

    const pack: DataPack = {
      ...profilePack,
      pack_name: 'company_profile',
      status: profilePack.status || 'complete',
    };
    dataPacks['company_profile'] = pack;
    onPackUpdate('company_profile', pack);
    log({ message: '✓ Company Profile complete', level: 'success', pack: 'company_profile' });
  } catch (err) {
    log({ message: 'Company Profile pack failed — continuing', level: 'error', pack: 'company_profile' });
  }

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ─── STAGE 2: Parallel Research ───────────────────────────────────────────
  log({ message: 'Stage 2: Launching parallel research packs...', level: 'info' });

  // Prepare vertical context
  const vertical = inputs.vertical ||
    (dataPacks.company_profile?.findings.find(f => f.key === 'vertical')?.value as string) ||
    'vertical SaaS';

  // Research for competitive landscape (priority)
  const compQueries = [
    `${inputs.company_name} competitors AI alternatives 2024`,
    `${vertical} AI startup funding 2023 2024 Series A B`,
    `${inputs.company_name} competitive landscape market`,
    ...(inputs.competitor_hints || []).map(h => `${h} AI features funding`),
    `${vertical} ChatGPT AI replacing workflow automation`,
  ];

  // Research for team
  const teamQueries = [
    `${inputs.company_name} CEO CTO leadership team AI strategy`,
    `${inputs.company_name} AI machine learning engineers hiring`,
    `${inputs.company_name} artificial intelligence roadmap announcement`,
  ];

  // Research for regulatory
  const regQueries = [
    `${vertical} regulatory compliance requirements HIPAA SOC2 GDPR`,
    `${inputs.company_name} compliance certifications security`,
    `${vertical} customer switching costs lock-in`,
  ];

  log({ message: 'Searching competitive intelligence (priority)...', level: 'info', pack: 'competitive_landscape' });
  log({ message: 'Searching team & capability...', level: 'info', pack: 'team_capability' });
  log({ message: 'Searching regulatory & moat...', level: 'info', pack: 'regulatory_moat' });

  const [compTexts, teamTexts, regTexts] = await Promise.all([
    searchMultiple(compQueries, log),
    searchMultiple(teamQueries, log),
    searchMultiple(regQueries, log),
  ]);

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // Run 4 packs in parallel (competitive, team, regulatory + stubs)
  const stage2Promises = [
    // Competitive Landscape (live)
    apiCall('pack-competitive-landscape', {
      company_name: inputs.company_name,
      company_url: inputs.company_url,
      vertical,
      competitor_hints: inputs.competitor_hints,
      evidence_texts: compTexts,
    }, 25000).then(data => {
      const pack: DataPack = { ...data, pack_name: 'competitive_landscape', status: data.status || 'complete' };
      dataPacks['competitive_landscape'] = pack;
      onPackUpdate('competitive_landscape', pack);
      log({ message: '✓ Competitive Landscape complete', level: 'success', pack: 'competitive_landscape' });
    }).catch(() => {
      log({ message: 'Competitive Landscape failed — LOW confidence', level: 'error', pack: 'competitive_landscape' });
    }),

    // Team Capability (live)
    apiCall('pack-team-capability', {
      company_name: inputs.company_name,
      company_url: inputs.company_url,
      evidence_texts: teamTexts,
    }, 20000).then(data => {
      const pack: DataPack = { ...data, pack_name: 'team_capability', status: data.status || 'complete' };
      dataPacks['team_capability'] = pack;
      onPackUpdate('team_capability', pack);
      log({ message: '✓ Team Capability complete', level: 'success', pack: 'team_capability' });
    }).catch(() => {
      log({ message: 'Team Capability failed — LOW confidence', level: 'error', pack: 'team_capability' });
    }),

    // Regulatory Moat (live)
    apiCall('pack-regulatory-moat', {
      company_name: inputs.company_name,
      company_url: inputs.company_url,
      vertical,
      evidence_texts: regTexts,
    }, 20000).then(data => {
      const pack: DataPack = { ...data, pack_name: 'regulatory_moat', status: data.status || 'complete' };
      dataPacks['regulatory_moat'] = pack;
      onPackUpdate('regulatory_moat', pack);
      log({ message: '✓ Regulatory Moat complete', level: 'success', pack: 'regulatory_moat' });
    }).catch(() => {
      log({ message: 'Regulatory Moat failed — LOW confidence', level: 'error', pack: 'regulatory_moat' });
    }),

    // Stub packs (instant)
    Promise.resolve().then(() => {
      const wpStub = createWorkflowProductStub(inputs.company_name);
      dataPacks['workflow_product'] = wpStub;
      onPackUpdate('workflow_product', wpStub);
      log({ message: 'Workflow & Product: V2 stub loaded', level: 'info', pack: 'workflow_product' });
    }),

    Promise.resolve().then(() => {
      const daStub = createDataArchitectureStub(inputs.company_name);
      dataPacks['data_architecture'] = daStub;
      onPackUpdate('data_architecture', daStub);
      log({ message: 'Data & Architecture: V2 stub loaded', level: 'info', pack: 'data_architecture' });
    }),
  ];

  await Promise.all(stage2Promises);

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ─── STAGE 3: Market Timing Stub ─────────────────────────────────────────
  log({ message: 'Stage 3: Market & Timing analysis...', level: 'info' });
  const mtStub = createMarketTimingStub(inputs.company_name);
  dataPacks['market_timing'] = mtStub;
  onPackUpdate('market_timing', mtStub);
  log({ message: 'Market & Timing: V2 stub loaded', level: 'info', pack: 'market_timing' });

  // ─── SCORING ──────────────────────────────────────────────────────────────
  log({ message: 'Computing Eagle Vision SOAR scores...', level: 'info' });
  const scoreBundle = computeScoreBundle(dataPacks);
  log({ message: `Scoring complete: ${scoreBundle.disposition} — Grade ${scoreBundle.overall_grade}`, level: 'success' });

  // ─── DILIGENCE AREAS ──────────────────────────────────────────────────────
  const diligenceAreas = generateDiligenceAreas(scoreBundle, dataPacks);
  const upgradeBreakConditions = generateUpgradeBreakConditions(scoreBundle, inputs.company_name);

  log({ message: '✓ Eagle Vision screening complete', level: 'success' });

  return {
    data_packs: dataPacks,
    evidence_log: evidenceLog,
    score_bundle: scoreBundle,
    confidence_overall: scoreBundle.confidence_overall,
    diligence_areas: diligenceAreas,
    upgrade_break_conditions: upgradeBreakConditions,
  };
}

// end of orchestrator
