/**
 * Eagle Vision Orchestrator v4 — Maximum-Depth Investment Research
 *
 * Philosophy: Accuracy over speed — optimised for investment decisioning.
 * We would rather wait 45 minutes and be right than rush in 5 minutes and be wrong.
 *
 *   Pass 1  — Broad search (12 queries × 7 dimensions = 84 searches)
 *   Pass 2  — Deep crawl of company site (20 pages) + top 10 URLs per dim (70 pages)
 *   Pass 3  — Claude reads all raw evidence, identifies gaps, generates 8 follow-up queries per dim
 *   Pass 4  — Targeted gap-fill searches + crawl of fresh URLs
 *   Pass 5  — Second gap-fill pass on the highest-priority dimensions still weak
 *   Synthesis — Claude reads 90K chars per dim, produces a 1500-word structured analyst brief
 *   Analysis — 7 AI packs each receive a rich synthesized brief with 8192-token response budget
 *
 * Expected runtime: 25-50 minutes for a thorough company. That is the point.
 * A real analyst would spend 2 days. We spend 40 minutes and sacrifice nothing on accuracy.
 *
 * Timeout budget: Netlify Pro = 26s per function call.
 * The orchestrator runs in the BROWSER — no timeout. Only individual Netlify calls are bounded.
 */

import type {
  ScreeningInputs, ScreeningRecord, DataPack,
  EvidenceItem, PackName, ProgressEvent
} from './types';
import { computeScoreBundle } from './scoring/scoringEngine';
import { generateDiligenceAreas, generateUpgradeBreakConditions } from './packs/diligenceGenerator';

type ProgressCallback = (event: Omit<ProgressEvent, 'timestamp'>) => void;
type PackUpdateCallback = (pack: PackName, data: DataPack) => void;
type AbortChecker = () => boolean;

// ─── Tunables ────────────────────────────────────────────────────────────────
// V4: ALL limits raised for investment-grade accuracy. Speed is not a goal.
const CFG = {
  // Search: 10 results per query (Tavily max on advanced plan)
  SEARCH_RESULTS_PER_QUERY: 10,
  // Crawl: 20K chars per page (up from 12K) — captures more page content
  MAX_CRAWL_CHARS: 20000,
  // Pass 1: 12 queries per dimension (up from 8) = ~84 total searches
  PASS1_QUERIES_PER_DIM: 12,
  // Pass 2: crawl top 10 URLs per dimension (up from 6) = ~70 additional pages
  PASS2_MAX_URLS_PER_DIM: 10,
  // Pass 3: generate 8 targeted gap-fill queries (up from 5) per dimension
  PASS3_GAP_QUERIES: 8,
  // Pass 4: 10 results per gap query (up from 8) — more evidence per gap
  PASS4_RESULTS_PER_GAP: 10,
  // Pass 5: second gap-fill round on weak dimensions (NEW)
  PASS5_ENABLED: true,
  PASS5_WEAK_THRESHOLD_CHARS: 15000, // dims with < this many chars get a second pass
  PASS5_EXTRA_QUERIES: 5,            // extra queries for weak dims
  // Synthesis: 30K chars per dimension (reduced from 50K)
  // WHY: Sonnet on 30K evidence completes in 6-10s, leaving 16s headroom inside
  // Netlify's 26s hard timeout. The synthesis function's own retry ladder then has
  // room to run a 2nd attempt at 20K (4-7s) or 3rd at 10K on Haiku (2-3s) if needed.
  // Quality impact: minimal — synthesis briefs are 800-1200 words regardless of input size.
  SYNTH_MAX_CHARS: 30000,
  // Pack call timeout — well under Netlify's 26s hard limit
  PACK_TIMEOUT_MS: 24000,
  // Synthesis call timeout — give slightly more than default 25s so the 3rd
  // haiku-fallback attempt has time to complete before client aborts.
  SYNTH_TIMEOUT_MS: 28000,
  // Gap-fill call timeout
  GAPFILL_TIMEOUT_MS: 22000,
  // Delay between search batches — 800ms to avoid Tavily rate limits
  SEARCH_BATCH_DELAY_MS: 800,
  // Delay between crawl requests — respectful crawling
  CRAWL_DELAY_MS: 400,
  // How many company site pages to attempt (up from 10)
  SITE_CRAWL_MAX_PAGES: 20,
  // Total URL crawl cap per phase
  PHASE2_MAX_CRAWL: 55,
  PHASE4_MAX_CRAWL: 30,
};

// ─── API helpers ─────────────────────────────────────────────────────────────
async function apiCall(
  endpoint: string,
  payload: object,
  timeoutMs = 25000
): Promise<any> {
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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${endpoint}`);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Search result type ───────────────────────────────────────────────────────
interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

// ─── Single search query → array of results ──────────────────────────────────
async function search(
  query: string,
  maxResults = CFG.SEARCH_RESULTS_PER_QUERY,
  log?: ProgressCallback
): Promise<SearchResult[]> {
  try {
    const data = await apiCall('research-search', {
      query,
      max_results: maxResults,
      search_depth: 'advanced',
    }, 20000);
    const results: SearchResult[] = (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      score: r.score || 0,
    }));
    // Prepend the Tavily synthesized answer as a high-quality result
    if (data.answer) {
      results.unshift({
        title: `[Search Answer] ${query}`,
        url: 'tavily-answer',
        content: data.answer,
        score: 1.0,
      });
    }
    return results;
  } catch {
    log?.({ message: `  ⚠ Search failed: "${query.slice(0, 60)}"`, level: 'warning' });
    return [];
  }
}

// ─── Run an array of queries sequentially with a small delay ─────────────────
// Sequential (not parallel) to avoid Tavily rate limits and get more consistent results
async function searchSequential(
  queries: string[],
  maxResults = CFG.SEARCH_RESULTS_PER_QUERY,
  log?: ProgressCallback
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    const results = await search(q, maxResults, log);
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        allResults.push(r);
      }
    }
    await sleep(CFG.SEARCH_BATCH_DELAY_MS);
  }
  return allResults;
}

// ─── Crawl a single URL → text ────────────────────────────────────────────────
async function crawl(url: string, log?: ProgressCallback): Promise<string> {
  if (!url || url === 'tavily-answer') return '';
  try {
    const data = await apiCall('research-crawl', {
      url,
      max_chars: CFG.MAX_CRAWL_CHARS,
    }, 18000);
    if (data.success && data.text && data.text.length > 100) {
      return `CRAWLED: ${url}\nTITLE: ${data.title || ''}\nDESCRIPTION: ${data.description || ''}\n\n${data.text}`;
    }
  } catch {
    log?.({ message: `  ⚠ Crawl failed: ${url.slice(0, 80)}`, level: 'warning' });
  }
  return '';
}

// ─── Crawl a list of URLs sequentially ───────────────────────────────────────
async function crawlSequential(
  urls: string[],
  maxUrls: number,
  log?: ProgressCallback
): Promise<string[]> {
  const pages: string[] = [];
  const seen = new Set<string>();
  let crawled = 0;
  for (const url of urls) {
    if (crawled >= maxUrls) break;
    if (seen.has(url) || !url.startsWith('http')) continue;
    seen.add(url);
    const text = await crawl(url, log);
    if (text) {
      pages.push(text);
      crawled++;
    }
    await sleep(CFG.CRAWL_DELAY_MS);
  }
  return pages;
}

// ─── Extract unique URLs from search results (highest scored first) ───────────
function extractUrls(results: SearchResult[], topN = 10): string[] {
  return [...results]
    .filter(r => r.url && r.url.startsWith('http'))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(r => r.url);
}

// ─── Build text corpus from results ──────────────────────────────────────────
function resultsToText(results: SearchResult[]): string {
  return results
    .filter(r => r.content)
    .map(r => `SOURCE: ${r.url}\nTITLE: ${r.title}\n${r.content}`)
    .join('\n\n---\n\n');
}

// ─── Ask Claude to identify research gaps and generate follow-up queries ──────
async function generateGapFillQueries(
  dimension: string,
  companyName: string,
  vertical: string,
  rawEvidence: string,
  numQueries: number,
  log: ProgressCallback
): Promise<string[]> {
  log({ message: `  🔍 Identifying research gaps in ${dimension}...`, level: 'info' });
  try {
    const data = await apiCall('research-gap-fill', {
      dimension,
      company_name: companyName,
      vertical,
      raw_evidence: rawEvidence.slice(0, 15000), // Give Claude a sample
      num_queries: numQueries,
    }, 22000);
    return data.queries || [];
  } catch {
    log({ message: `  ⚠ Gap-fill generation failed for ${dimension}`, level: 'warning' });
    return [];
  }
}

// ─── Ask Claude to synthesize raw evidence into a structured brief ────────────
async function synthesizeDimension(
  dimension: string,
  companyName: string,
  vertical: string,
  rawEvidence: string,
  log: ProgressCallback
): Promise<string> {
  const evidenceKB = Math.round(rawEvidence.length / 1000);
  log({ message: `  📋 Synthesizing ${dimension} (${evidenceKB}K chars of evidence)...`, level: 'info' });
  try {
    const data = await apiCall('research-synthesize', {
      dimension,
      company_name: companyName,
      vertical,
      raw_evidence: rawEvidence.slice(0, CFG.SYNTH_MAX_CHARS),
    }, CFG.SYNTH_TIMEOUT_MS);

    if (data.fallback) {
      log({ message: `  ⚠ ${dimension} synthesis fell back to raw evidence — reason: ${data.fallback_reason?.slice(0,80) || 'unknown'}. Packs will work from raw text.`, level: 'warning' });
    } else {
      const synthKB = Math.round((data.synthesis_chars || 0) / 1000);
      const model = data.model_used || 'unknown';
      const attemptStr = data.attempt_number > 1 ? ` (needed ${data.attempt_number} attempts)` : '';
      log({ message: `  ✓ ${dimension} synthesized → ${synthKB}K chars (${model}${attemptStr}, ${data.elapsed_ms || 0}ms)`, level: 'success' });
    }

    // Quality guard: if synthesis returned fewer than 300 chars it likely timed out silently
    const brief = data.synthesis || '';
    if (brief.length < 300 && !data.fallback) {
      log({ message: `  ⚠ ${dimension} synthesis brief is suspiciously short (${brief.length} chars) — using raw evidence instead`, level: 'warning' });
      return `[SYNTHESIS TOO SHORT — falling back]\n\nRAW EVIDENCE:\n${rawEvidence.slice(0, 20000)}`;
    }

    return brief || rawEvidence.slice(0, 20000);
  } catch (err: any) {
    const errMsg = err?.message?.slice(0, 80) || 'unknown error';
    log({ message: `  ✗ ${dimension} synthesis call failed: ${errMsg}. Using raw evidence.`, level: 'error' });
    // Fallback: pass raw evidence directly to pack (better than nothing)
    return `[SYNTHESIS CALL FAILED: ${errMsg}]\n\nRAW EVIDENCE:\n${rawEvidence.slice(0, 20000)}`;
  }
}

// ─── Trim a corpus to a character cap, keeping the most relevant chunks ──────
function trimCorpus(texts: string[], maxChars: number): string[] {
  const out: string[] = [];
  let total = 0;
  for (const t of texts) {
    if (!t) continue;
    if (total + t.length > maxChars) {
      const remaining = maxChars - total;
      if (remaining > 500) out.push(t.slice(0, remaining));
      break;
    }
    out.push(t);
    total += t.length;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export async function runScreening(
  inputs: ScreeningInputs,
  onProgress: ProgressCallback,
  onPackUpdate: PackUpdateCallback,
  isAborted: AbortChecker
): Promise<Partial<ScreeningRecord>> {

  const dataPacks: Partial<Record<PackName, DataPack>> = {};
  const evidenceLog: EvidenceItem[] = [];
  const log = onProgress;

  const co = inputs.company_name;
  const url = inputs.company_url || '';
  const v = inputs.vertical || 'vertical SaaS';
  const hints = inputs.competitor_hints || [];

  log({ message: `🦅 Eagle Vision DEEP RESEARCH v4 — ${co}`, level: 'info' });
  log({ message: `Mode: Maximum-depth investment research. Expected time: 25-50 minutes. Accuracy over speed.`, level: 'info' });
  log({ message: `Phases: Broad Search (84 queries) → Deep Crawl (~75 pages) → Gap Analysis → Gap Fill → Second Pass → Synthesis → Pack Scoring`, level: 'info' });

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — BROAD SEARCH PASS
  // Run every query we know to ask upfront. Sequential per dimension.
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 1: Broad Search Pass (Pass 1 of 4) ━━━`, level: 'info' });

  const competitorQueryExtras = hints.flatMap(h => [
    `"${h}" software funding traction customers`,
    `"${h}" AI features product 2024 2025`,
  ]);

  // COMPANY PROFILE dimension — 12 queries
  log({ message: `📡 Searching: Company Profile (12 queries)...`, level: 'info' });
  const profileResults1 = await searchSequential([
    `"${co}" software company overview history founded headquarters`,
    `"${co}" annual recurring revenue ARR growth 2023 2024 2025`,
    `"${co}" funding investors venture capital private equity raise`,
    `"${co}" crunchbase pitchbook funding rounds total raised employees headcount`,
    `"${co}" customers client list case studies testimonials logos`,
    `"${co}" press release news announcement 2024 2025`,
    `"${co}" G2 Capterra Trustpilot review rating score NPS`,
    `"${co}" pricing model cost per seat subscription plans`,
    `"${co}" CEO interview founder story origin mission`,
    `"${co}" revenue growth ARR MRR churn retention metrics`,
    `"${co}" partnership channel reseller distribution strategy`,
    `"${co}" IPO acquisition exit M&A rumor strategic`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // COMPETITIVE dimension — 12 queries
  log({ message: `📡 Searching: Competitive Landscape (12 queries)...`, level: 'info' });
  const compResults1 = await searchSequential([
    `"${co}" competitors alternatives vs comparison 2024 2025`,
    `${v} software top companies market leaders 2024 2025`,
    `${v} AI startup funding Series A B C 2023 2024 2025`,
    `${v} artificial intelligence software disruption threat`,
    `${v} private equity investment acquisition deal 2023 2024 2025`,
    `${v} market share competitive analysis landscape`,
    `${v} ChatGPT OpenAI Microsoft Copilot automation threat impact`,
    `${v} incumbent player existing vendor platform consolidation`,
    `${v} new entrant venture-backed startup disruption 2023 2024`,
    `${v} competitive moat defensibility differentiation`,
    `"${co}" win rate vs competitors customer wins losses`,
    ...competitorQueryExtras.slice(0, 2),
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // TEAM dimension — 12 queries
  log({ message: `📡 Searching: Team & Leadership (12 queries)...`, level: 'info' });
  const teamResults1 = await searchSequential([
    `"${co}" CEO founder background LinkedIn history prior companies`,
    `"${co}" CTO chief technology officer engineering team background`,
    `"${co}" executive leadership team management org chart`,
    `"${co}" artificial intelligence machine learning team hires PhD`,
    `"${co}" job posting engineer data scientist ML AI open roles`,
    `"${co}" CEO interview podcast vision strategy AI transformation`,
    `"${co}" product roadmap artificial intelligence 2024 2025 launch`,
    `"${co}" engineering blog technology architecture open source`,
    `"${co}" VP Product CPO chief product officer background`,
    `"${co}" team culture glassdoor review employee experience`,
    `"${co}" advisor board investor operating partner domain`,
    `"${co}" AI head of AI ML director hire appointment`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // REGULATORY / MOAT dimension — 12 queries
  log({ message: `📡 Searching: Regulatory & Moat (12 queries)...`, level: 'info' });
  const regResults1 = await searchSequential([
    `"${co}" HIPAA SOC2 compliance certification security audit`,
    `"${co}" integration EHR EMR API partners ecosystem connectors`,
    `"${co}" customer switching cost retention churn contract`,
    `${v} regulatory compliance requirements HIPAA OASIS EVV 2024 2025`,
    `${v} SOC2 HITRUST certification barriers to entry compliance cost`,
    `${v} switching costs lock-in customer retention data migration`,
    `${v} regulatory moat data privacy requirements government mandate`,
    `"${co}" customer contract length multi-year terms SLA agreement`,
    `"${co}" data portability export migration interoperability`,
    `${v} compliance penalty enforcement action regulatory risk 2024`,
    `"${co}" integration depth API workflow embedded sticky`,
    `${v} proprietary data advantage network effect accumulation`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // WORKFLOW / PRODUCT dimension — 12 queries
  log({ message: `📡 Searching: Workflow & Product (12 queries)...`, level: 'info' });
  const workResults1 = await searchSequential([
    `"${co}" product features workflow daily operations overview`,
    `"${co}" system of record core platform mission critical`,
    `"${co}" ROI case study value outcome results savings`,
    `"${co}" customer success implementation onboarding time-to-value`,
    `"${co}" scheduling billing documentation workflow automation`,
    `"${co}" net promoter score NPS customer satisfaction rating`,
    `"${co}" product demo features tour overview video`,
    `"${co}" customer testimonial quote review success story`,
    `"${co}" product update release notes changelog 2024 2025`,
    `"${co}" mobile app iOS Android field worker clinician`,
    `"${co}" workflow automation time savings productivity gain`,
    `"${co}" customer expansion upsell cross-sell module`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // DATA / ARCHITECTURE dimension — 12 queries
  log({ message: `📡 Searching: Data & Architecture (12 queries)...`, level: 'info' });
  const dataResults1 = await searchSequential([
    `"${co}" AI features machine learning analytics predictive launch`,
    `"${co}" data platform cloud AWS Azure GCP architecture infrastructure`,
    `"${co}" API integration technology stack developer`,
    `"${co}" predictive analytics outcomes intelligence reporting benchmark`,
    `"${co}" data network effect proprietary dataset benchmark training`,
    `"${co}" artificial intelligence product launch announcement 2024 2025`,
    `"${co}" cloud native microservices engineering platform`,
    `"${co}" outcomes data longitudinal patient visit record historizing`,
    `"${co}" machine learning model training dataset quality`,
    `"${co}" AI copilot assistant automation feature product`,
    `"${co}" data lake warehouse analytics platform architecture`,
    `"${co}" technical architecture whitepaper security compliance engineering`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // MARKET TIMING dimension — 12 queries
  log({ message: `📡 Searching: Market Timing (12 queries)...`, level: 'info' });
  const marketResults1 = await searchSequential([
    `${v} market size TAM total addressable market 2024 2025 estimate`,
    `${v} market growth rate CAGR forecast 2025 2030`,
    `${v} private equity deal volume activity count 2023 2024 2025`,
    `${v} AI adoption survey operator usage statistics research`,
    `${v} investment banker technology report outlook 2025`,
    `${v} macro trend demographic labor shortage reimbursement regulation`,
    `${v} venture capital funding trends activity 2024 2025`,
    `${v} M&A merger acquisition comparable transaction multiple`,
    `${v} EV EBITDA revenue multiple valuation software deal`,
    `${v} consolidation platform vendor market structure dynamics`,
    `${v} buyer survey willingness-to-pay software budget 2025`,
    `${v} recession sensitivity budget cycle software spending trend`,
  ], CFG.SEARCH_RESULTS_PER_QUERY, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `✓ Phase 1 complete. ${[profileResults1, compResults1, teamResults1, regResults1, workResults1, dataResults1, marketResults1].reduce((s,r)=>s+r.length,0)} search results collected.`, level: 'success' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — DEEP SITE CRAWL
  // Crawl the company website AND the highest-value URLs from search results
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 2: Deep Web Crawl (Pass 2 of 4) ━━━`, level: 'info' });

  const companySitePages: string[] = [];
  if (url) {
    log({ message: `🌐 Crawling company site: ${url}`, level: 'info' });
    const siteUrls = [
      url,
      `${url}/about`,
      `${url}/about-us`,
      `${url}/team`,
      `${url}/leadership`,
      `${url}/company`,
      `${url}/pricing`,
      `${url}/plans`,
      `${url}/features`,
      `${url}/platform`,
      `${url}/product`,
      `${url}/solutions`,
      `${url}/customers`,
      `${url}/case-studies`,
      `${url}/success-stories`,
      `${url}/blog`,
      `${url}/press`,
      `${url}/news`,
      `${url}/security`,
      `${url}/integrations`,
      `${url}/partners`,
      `${url}/resources`,
      `${url}/why-us`,
      `${url}/roi`,
    ];
    const siteCrawled = await crawlSequential(siteUrls, CFG.SITE_CRAWL_MAX_PAGES, log);
    companySitePages.push(...siteCrawled);
    log({ message: `  ✓ Crawled ${siteCrawled.length} company pages`, level: 'success' });
  }

  // Crawl top URLs from each dimension's search results
  log({ message: `🌐 Deep-crawling top search result URLs...`, level: 'info' });

  const profileUrls = extractUrls(profileResults1, CFG.PASS2_MAX_URLS_PER_DIM);
  const compUrls    = extractUrls(compResults1,    CFG.PASS2_MAX_URLS_PER_DIM);
  const teamUrls    = extractUrls(teamResults1,    CFG.PASS2_MAX_URLS_PER_DIM);
  const regUrls     = extractUrls(regResults1,     CFG.PASS2_MAX_URLS_PER_DIM);
  const workUrls    = extractUrls(workResults1,    CFG.PASS2_MAX_URLS_PER_DIM);
  const dataUrls    = extractUrls(dataResults1,    CFG.PASS2_MAX_URLS_PER_DIM);
  const marketUrls  = extractUrls(marketResults1,  CFG.PASS2_MAX_URLS_PER_DIM);

  // Deduplicate across all URL lists and crawl sequentially
  const allUrlsToCrawl = [...new Set([
    ...profileUrls, ...compUrls, ...teamUrls,
    ...regUrls, ...workUrls, ...dataUrls, ...marketUrls,
  ])];

  log({ message: `  Crawling ${allUrlsToCrawl.length} unique URLs from search results (cap: ${CFG.PHASE2_MAX_CRAWL})...`, level: 'info' });
  const crawledFromSearch = await crawlSequential(allUrlsToCrawl, CFG.PHASE2_MAX_CRAWL, log);
  log({ message: `  ✓ Crawled ${crawledFromSearch.length} pages from search results`, level: 'success' });

  // Build raw corpora per dimension by combining search results + crawled pages
  // Each corpus is the full unprocessed evidence before synthesis
  const allCrawled = [...companySitePages, ...crawledFromSearch];

  const profileCorpus  = [resultsToText(profileResults1), ...companySitePages, ...crawledFromSearch.filter(p => profileUrls.some(u => p.includes(u)))];
  const compCorpus     = [resultsToText(compResults1),    ...crawledFromSearch.filter(p => compUrls.some(u => p.includes(u)))];
  const teamCorpus     = [resultsToText(teamResults1),    ...companySitePages, ...crawledFromSearch.filter(p => teamUrls.some(u => p.includes(u)))];
  const regCorpus      = [resultsToText(regResults1),     ...companySitePages, ...crawledFromSearch.filter(p => regUrls.some(u => p.includes(u)))];
  const workCorpus     = [resultsToText(workResults1),    ...companySitePages, ...crawledFromSearch.filter(p => workUrls.some(u => p.includes(u)))];
  const dataCorpus     = [resultsToText(dataResults1),    ...companySitePages, ...crawledFromSearch.filter(p => dataUrls.some(u => p.includes(u)))];
  const marketCorpus   = [resultsToText(marketResults1),  ...crawledFromSearch.filter(p => marketUrls.some(u => p.includes(u)))];

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — INTELLIGENT GAP ANALYSIS
  // Ask Claude: "Given what we found, what are we still missing?"
  // Then generate targeted follow-up queries to fill those gaps.
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 3: Intelligent Gap Analysis (Pass 3 of 4) ━━━`, level: 'info' });
  log({ message: `Claude is analyzing research gaps and generating follow-up queries...`, level: 'info' });

  // Run gap analysis for ALL 7 dimensions in parallel
  // Give Claude a generous slice of current corpus (20K) to identify what's still missing
  const gapJobResults = await Promise.allSettled([
    generateGapFillQueries('company_profile',        co, v, profileCorpus.join('\n\n').slice(0, 20000), CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('competitive_landscape',  co, v, compCorpus.join('\n\n').slice(0, 20000),   CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('team_capability',        co, v, teamCorpus.join('\n\n').slice(0, 20000),   CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('regulatory_moat',        co, v, regCorpus.join('\n\n').slice(0, 20000),    CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('workflow_product',       co, v, workCorpus.join('\n\n').slice(0, 20000),   CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('data_architecture',      co, v, dataCorpus.join('\n\n').slice(0, 20000),   CFG.PASS3_GAP_QUERIES, log),
    generateGapFillQueries('market_timing',          co, v, marketCorpus.join('\n\n').slice(0, 20000), CFG.PASS3_GAP_QUERIES, log),
  ]);

  const gapQueries = {
    profile:    gapJobResults[0].status === 'fulfilled' ? gapJobResults[0].value : [],
    competitive:gapJobResults[1].status === 'fulfilled' ? gapJobResults[1].value : [],
    team:       gapJobResults[2].status === 'fulfilled' ? gapJobResults[2].value : [],
    regulatory: gapJobResults[3].status === 'fulfilled' ? gapJobResults[3].value : [],
    workflow:   gapJobResults[4].status === 'fulfilled' ? gapJobResults[4].value : [],
    data:       gapJobResults[5].status === 'fulfilled' ? gapJobResults[5].value : [],
    market:     gapJobResults[6].status === 'fulfilled' ? gapJobResults[6].value : [],
  };

  const totalGapQueries = Object.values(gapQueries).reduce((s, qs) => s + qs.length, 0);
  log({ message: `✓ Generated ${totalGapQueries} targeted gap-fill queries`, level: 'success' });

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4 — TARGETED GAP-FILL SEARCH
  // Run the AI-generated follow-up queries to fill specific evidence gaps
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 4: Targeted Gap-Fill Search (Pass 4 of 4) ━━━`, level: 'info' });

  const gapFillResults: Record<string, SearchResult[]> = {};

  for (const [dim, queries] of Object.entries(gapQueries)) {
    if (queries.length === 0) continue;
    log({ message: `📡 Gap-fill search: ${dim} (${queries.length} queries)...`, level: 'info' });
    gapFillResults[dim] = await searchSequential(queries, CFG.PASS4_RESULTS_PER_GAP, log);
    if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };
  }

  // Crawl the top URLs from gap-fill results
  const gapFillUrls = [...new Set(
    Object.values(gapFillResults).flatMap(results => extractUrls(results, 4))
  )];
  if (gapFillUrls.length > 0) {
    log({ message: `🌐 Crawling ${gapFillUrls.length} URLs from gap-fill results (cap: ${CFG.PHASE4_MAX_CRAWL})...`, level: 'info' });
    const gapFillCrawled = await crawlSequential(gapFillUrls, CFG.PHASE4_MAX_CRAWL, log);
    allCrawled.push(...gapFillCrawled);
    log({ message: `  ✓ Crawled ${gapFillCrawled.length} gap-fill pages`, level: 'success' });
  }

  // Merge gap-fill into corpora (all 7 dimensions)
  if (gapFillResults.profile)    profileCorpus.push(resultsToText(gapFillResults.profile));
  if (gapFillResults.competitive) compCorpus.push(resultsToText(gapFillResults.competitive));
  if (gapFillResults.team)       teamCorpus.push(resultsToText(gapFillResults.team));
  if (gapFillResults.regulatory) regCorpus.push(resultsToText(gapFillResults.regulatory));
  if (gapFillResults.workflow)   workCorpus.push(resultsToText(gapFillResults.workflow));
  if (gapFillResults.data)       dataCorpus.push(resultsToText(gapFillResults.data));
  if (gapFillResults.market)     marketCorpus.push(resultsToText(gapFillResults.market));

  const totalEvidenceP4 = [...profileCorpus, ...compCorpus, ...teamCorpus, ...regCorpus, ...workCorpus, ...dataCorpus, ...marketCorpus].join('').length;
  log({ message: `✓ Phase 4 complete. Total evidence: ~${Math.round(totalEvidenceP4 / 1000)}K characters`, level: 'success' });

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — SECOND GAP-FILL PASS (NEW in V4)
  // Any dimension that still has thin evidence gets another round of targeted
  // searches. This catches cases where Phase 3/4 gaps weren't fully resolved.
  // ═══════════════════════════════════════════════════════════════════════════
  if (CFG.PASS5_ENABLED) {
    log({ message: `\n━━━ PHASE 5: Second Gap-Fill Pass ━━━`, level: 'info' });
    const corpusMap: Record<string, string[]> = {
      profile: profileCorpus,
      competitive: compCorpus,
      team: teamCorpus,
      regulatory: regCorpus,
      workflow: workCorpus,
      data: dataCorpus,
      market: marketCorpus,
    };
    const dimNames: Record<string, string> = {
      profile: 'company_profile',
      competitive: 'competitive_landscape',
      team: 'team_capability',
      regulatory: 'regulatory_moat',
      workflow: 'workflow_product',
      data: 'data_architecture',
      market: 'market_timing',
    };
    let pass5Ran = 0;
    for (const [key, corpus] of Object.entries(corpusMap)) {
      const corpusLen = corpus.join('').length;
      if (corpusLen < CFG.PASS5_WEAK_THRESHOLD_CHARS) {
        const dim = dimNames[key];
        log({ message: `  🔍 ${dim} corpus thin (${Math.round(corpusLen/1000)}K chars) — running second pass...`, level: 'warning' });
        const extraQueries = await generateGapFillQueries(dim, co, v, corpus.join('\n\n').slice(0, 20000), CFG.PASS5_EXTRA_QUERIES, log);
        if (extraQueries.length > 0) {
          const extraResults = await searchSequential(extraQueries, CFG.SEARCH_RESULTS_PER_QUERY, log);
          corpus.push(resultsToText(extraResults));
          const extraUrls = extractUrls(extraResults, 5);
          if (extraUrls.length > 0) {
            const extraCrawled = await crawlSequential(extraUrls, 8, log);
            allCrawled.push(...extraCrawled);
            corpus.push(...extraCrawled);
          }
          pass5Ran++;
          log({ message: `  ✓ Second pass added ${Math.round(resultsToText(extraResults).length/1000)}K chars to ${dim}`, level: 'success' });
        }
        await sleep(500);
        if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };
      }
    }
    if (pass5Ran === 0) {
      log({ message: `  ✓ All dimensions above threshold — second pass skipped`, level: 'success' });
    } else {
      log({ message: `  ✓ Phase 5 complete. Strengthened ${pass5Ran} thin dimensions.`, level: 'success' });
    }
    if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — EVIDENCE SYNTHESIS
  // Claude reads ALL raw evidence per dimension and produces a structured
  // analyst brief. This is what the pack functions receive — not raw snippets.
  // This is the key insight: LLMs are better analysts when given synthesis briefs
  // than when asked to simultaneously parse raw evidence AND score factors.
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 5: Evidence Synthesis ━━━`, level: 'info' });
  const totalEvidence = [...profileCorpus, ...compCorpus, ...teamCorpus, ...regCorpus, ...workCorpus, ...dataCorpus, ...marketCorpus].join('').length;
  log({ message: `Claude is synthesizing ~${Math.round(totalEvidence/1000)}K chars of raw evidence into structured analyst briefs (7 dims, up to 90K each)...`, level: 'info' });

  // Build trimmed corpora for synthesis (cap at SYNTH_MAX_CHARS each)
  const profileFull  = trimCorpus(profileCorpus,  CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const compFull     = trimCorpus(compCorpus,      CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const teamFull     = trimCorpus(teamCorpus,      CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const regFull      = trimCorpus(regCorpus,       CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const workFull     = trimCorpus(workCorpus,      CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const dataFull     = trimCorpus(dataCorpus,      CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');
  const marketFull   = trimCorpus(marketCorpus,    CFG.SYNTH_MAX_CHARS).join('\n\n---\n\n');

  // Synthesize all 7 dimensions SEQUENTIALLY (not parallel) to avoid hammering
  // Claude's API rate limits and to give each call the full context window.
  // Each synthesis call = one Netlify function call (28s client timeout, 26s Netlify hard limit).
  // Sequential means 7 × ~8-12s = ~70-90s total for synthesis on 30K evidence with Sonnet.
  // NO sleeps between synthesis calls — every second counts, and Sonnet doesn't need cooldown.
  log({ message: `  Running synthesis sequentially (1/7): company_profile...`, level: 'info' });
  const profileSynth = await synthesizeDimension('company_profile',      co, v, profileFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (2/7): competitive_landscape...`, level: 'info' });
  const compSynth = await synthesizeDimension('competitive_landscape',    co, v, compFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (3/7): team_capability...`, level: 'info' });
  const teamSynth = await synthesizeDimension('team_capability',          co, v, teamFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (4/7): regulatory_moat...`, level: 'info' });
  const regSynth = await synthesizeDimension('regulatory_moat',           co, v, regFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (5/7): workflow_product...`, level: 'info' });
  const workSynth = await synthesizeDimension('workflow_product',          co, v, workFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (6/7): data_architecture...`, level: 'info' });
  const dataSynth = await synthesizeDimension('data_architecture',         co, v, dataFull, log);
  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  log({ message: `  Running synthesis (7/7): market_timing...`, level: 'info' });
  const marketSynth = await synthesizeDimension('market_timing',           co, v, marketFull, log);

  log({ message: `✓ All 7 synthesis briefs complete`, level: 'success' });

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6 — AI PACK ANALYSIS
  // Each pack receives its synthesized brief. Because the brief is already
  // condensed and structured, the pack can focus entirely on scoring and insight.
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 6: AI Pack Analysis ━━━`, level: 'info' });
  log({ message: `Running 7 investment analysis packs on synthesized evidence...`, level: 'info' });

  const documentText = inputs.documents
    .filter(d => d.text_content)
    .map(d => d.text_content)
    .join('\n\n')
    .slice(0, 10000);

  // Helper: wrap a pack call with progress logging and error handling
  const runPack = async (
    packName: PackName,
    endpoint: string,
    payload: object
  ): Promise<void> => {
    log({ message: `  ⚙ Running ${packName}...`, level: 'info', pack: packName });
    try {
      const data = await apiCall(endpoint, payload, CFG.PACK_TIMEOUT_MS);
      const pack: DataPack = { ...data, pack_name: packName, status: 'complete' };
      dataPacks[packName] = pack;
      onPackUpdate(packName, pack);
      const dq = data.data_quality_score ?? 0;
      log({ message: `  ✓ ${packName} — quality: ${Math.round(dq * 100)}%`, level: 'success', pack: packName });
    } catch (err: any) {
      log({ message: `  ✗ ${packName} failed: ${err?.message?.slice(0, 80)}`, level: 'error', pack: packName });
    }
  };

  // Run all 7 packs. They're all independent — run in parallel.
  await Promise.all([
    runPack('company_profile', 'pack-company-profile', {
      company_name: co,
      company_url: url,
      evidence_texts: [profileSynth],
      document_text: documentText,
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('competitive_landscape', 'pack-competitive-landscape', {
      company_name: co,
      company_url: url,
      vertical: v,
      competitor_hints: hints,
      evidence_texts: [compSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('team_capability', 'pack-team-capability', {
      company_name: co,
      company_url: url,
      vertical: v,
      evidence_texts: [teamSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('regulatory_moat', 'pack-regulatory-moat', {
      company_name: co,
      company_url: url,
      vertical: v,
      evidence_texts: [regSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('workflow_product', 'pack-workflow-product', {
      company_name: co,
      company_url: url,
      vertical: v,
      evidence_texts: [workSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('data_architecture', 'pack-data-architecture', {
      company_name: co,
      company_url: url,
      vertical: v,
      evidence_texts: [dataSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),

    runPack('market_timing', 'pack-market-timing', {
      company_name: co,
      company_url: url,
      vertical: v,
      evidence_texts: [marketSynth],
      use_knowledge_fallback: true,
      deep_research: true,
    }),
  ]);

  if (isAborted()) return { data_packs: dataPacks, evidence_log: evidenceLog };

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7 — SCORE
  // ═══════════════════════════════════════════════════════════════════════════
  log({ message: `\n━━━ PHASE 7: SOAR Score Computation ━━━`, level: 'info' });
  const scoreBundle = computeScoreBundle(dataPacks);
  log({
    message: `🦅 FINAL: ${scoreBundle.disposition} — Risk ${scoreBundle.risk_score} / Readiness ${scoreBundle.readiness_score} / Grade ${scoreBundle.overall_grade}`,
    level: 'success',
  });

  const diligenceAreas = generateDiligenceAreas(scoreBundle, dataPacks);
  const upgradeBreakConditions = generateUpgradeBreakConditions(scoreBundle, co);

  // ── Extract detected vertical from company_profile pack ────────────────────
  // The company_profile pack asks Claude to identify the exact industry vertical.
  // If the user didn't specify a vertical, or if Claude found a more precise one,
  // use it. This surfaces in the report header and all downstream analysis.
  let detectedVertical: string | undefined;
  try {
    const profilePack = dataPacks['company_profile'];
    if (profilePack) {
      const overviewFinding = profilePack.findings?.find((f: any) => f.key === 'company_overview');
      const detectedFromPack = (overviewFinding?.value as any)?.vertical;
      if (detectedFromPack && typeof detectedFromPack === 'string' && detectedFromPack.length > 2) {
        detectedVertical = detectedFromPack;
        // Only log if different from user-provided vertical
        if (detectedVertical !== v && v !== 'vertical SaaS') {
          log({ message: `  🏷 Detected vertical: "${detectedVertical}" (user provided: "${v}")`, level: 'info' });
        } else if (v === 'vertical SaaS') {
          log({ message: `  🏷 Detected vertical: "${detectedVertical}"`, level: 'success' });
        }
      }
    }
  } catch {
    // Non-critical — vertical detection failure doesn't block scoring
  }

  log({ message: `\n🦅 Eagle Vision Deep Research v4 complete.`, level: 'success' });
  log({ message: `Evidence collected: ~${Math.round(totalEvidence/1000)}K chars across 5 research passes.`, level: 'info' });

  return {
    data_packs: dataPacks,
    evidence_log: evidenceLog,
    score_bundle: scoreBundle,
    confidence_overall: scoreBundle.confidence_overall,
    detected_vertical: detectedVertical,
    diligence_areas: diligenceAreas,
    upgrade_break_conditions: upgradeBreakConditions,
  };
}
