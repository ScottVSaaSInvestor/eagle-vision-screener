# 🦅 Eagle Vision Screener — AQL Growth

> AI-powered investment screening for vertical SaaS — internal tool for AQL Growth partners

## Overview

Eagle Vision Screener is a fast, investment-grade GO / MAYBE / NO-GO disposition engine for any vertical SaaS company. Partners enter a company name, URL, and optional context. The app orchestrates parallel AI research across 7 structured data packs, applies the Eagle Vision SOAR 16-factor methodology, and renders a 5-page investment-grade report card.

**Target run time: 25–50 minutes per screening (accuracy-first research mode).**

---

## Architecture

```
Client (React/Vite) → /api/* → Vercel Serverless Functions (Node.js 20)
                              → Anthropic Claude (LLM evidence)
                              → Tavily (web search)
                              → Direct crawl (URL fallback)
```

**Critical design principle:** LLMs produce evidence. Deterministic TypeScript code produces scores. These layers never blend.

---

## Local Development

### Prerequisites
- Node.js 20+

### Setup

```bash
git clone https://github.com/ScottVSaaSInvestor/eagle-vision-screener.git
cd eagle-vision-screener
npm install
cp .env.example .env.local
# Edit .env.local with your real API keys
```

### Environment Variables (`.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
ACCESS_PASSCODE=your-passcode
BRAVE_SEARCH_API_KEY=BSA-...   # optional fallback search
VITE_APP_NAME=Eagle Vision Screener
VITE_APP_VERSION=16.0.0
```

> **`ANTHROPIC_MODEL` is optional.** The default is `claude-opus-4-7` (latest, Feb 2026).
> Vercel functions have a 300s (5 min) timeout so Opus runs fine with no override needed.

---

## Build & Deploy

### Build
```bash
npm run build   # Builds frontend → dist/ and compiles api/*.js functions
```

### Deploy to Vercel

1. Push to GitHub (already connected)
2. Vercel auto-deploys on every push to `main`
3. Set environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY` = your Claude API key (required)
   - `TAVILY_API_KEY` = your Tavily API key (required)
   - `ACCESS_PASSCODE` = your secure passcode (required)
   - `BRAVE_SEARCH_API_KEY` = optional fallback
4. Redeploy to pick up new env vars if needed

**Vercel function timeout:** `maxDuration: 300` (5 minutes) — configured in `vercel.json`.
This is why `claude-opus-4-7` works without any timeout issues on Vercel.

---

## AI Models (V16 — April 2026)

| Role | Model | Notes |
|------|-------|-------|
| Pack analysis (7 packs) | `claude-opus-4-7` | Latest flagship, Feb 2026 training |
| Research synthesis | `claude-sonnet-4-6` | Feb 2026, 1M context window |
| Gap-fill query generation | `claude-sonnet-4-6` | Speed-optimised |
| Timeout fallback | `claude-haiku-3-5` | 3rd attempt safety net |

---

## Eagle Vision SOAR Methodology

### AI Risk Factors (R1–R7)

| Factor | Weight | Description |
|--------|--------|-------------|
| R1 Competitive Window | 20% | How much time before AI threat materializes |
| R2 AI-Native Entrant Threat | 18% | Quality/quantity of AI-native competitors |
| R3 Incumbent AI Posture | 15% | How aggressively incumbents are shipping AI |
| R4 Horizontal AI Encroachment | 15% | ChatGPT/Copilot/Claude workflow substitution |
| R5 Customer Switching Propensity | 16% | How easy it is for customers to leave |
| R6 Regulatory Moat Durability | 10% | Whether regulation protects the moat |
| R7 Market Timing Risk | 6% | Macro timing: too early, perfect, or too late |

### AI Readiness Factors (A1–A10)

| Factor | Weight | Description |
|--------|--------|-------------|
| A1 Workflow Embeddedness | 18% | How critical-path the product is |
| A2 Data Foundation & Quality | 16% | Proprietary data depth and quality |
| A3 Outcome-Labeled Data | 12% | Whether training data has labeled outcomes |
| A4 Value Quantification | 8% | Published ROI / customer outcome evidence |
| A5 Pricing Model Flexibility | 5% | Ability to capture AI value via pricing |
| A6 AI/ML Team Capability | 12% | Team's ability to execute on AI |
| A7 Architecture Readiness | 8% | Tech stack's readiness for AI workloads |
| A8 Compounding Loop Potential | 8% | Data/network flywheel potential |
| A9 Leadership AI Clarity | 3% | CEO/board AI vision and conviction |
| A10 SOR→SOA Path | 10% | System of Record → System of Action roadmap |

### Quadrant Logic
- Risk < 50 AND Readiness ≥ 50 → **EXECUTE**
- Risk ≥ 50 AND Readiness ≥ 50 → **RACE MODE**
- Risk < 50 AND Readiness < 50 → **BUILD MODE**
- Risk ≥ 50 AND Readiness < 50 → **DANGER ZONE**

### Disposition Logic (V14+)
- DANGER ZONE → **NO-GO**
- Structural blockers (missing SOR, 2+ critical gaps) → **NO-GO**
- EXECUTE / RACE MODE, 0 critical gaps, M+ confidence → **GO**
- All other cases → **MAYBE**
- BUILD MODE never auto-yields NO-GO

---

## Research Engine (V4 Orchestrator)

5-pass research pipeline per screening:
1. **Broad Search** — 84 queries across 7 dimensions
2. **Deep Crawl** — Top URLs per dimension scraped
3. **Gap Fill** — Claude identifies unknowns, generates targeted queries
4. **Second Pass** — Thin dimensions get additional search rounds
5. **AI Packs** — 7 Claude Opus pack calls + deterministic scoring

Models: `claude-opus-4-7` for pack analysis, `claude-sonnet-4-6` for synthesis.

---

## Pages

1. **Login** — Passcode gate
2. **Dashboard** — Archive of all screenings, sortable/filterable
3. **New Screening** — Company intake (name, URL, vertical, context)
4. **Progress** — Live 7-pack grid with animated status tiles + elapsed timer
5. **Report: Headline** — Disposition badge, verdict narrative, quadrant plot
6. **Report: Threat** — ThreatLevel badge, R1–R7 factor breakdown with meter bars
7. **Report: Readiness** — ReadinessStage icon, A1–A10 factor groups
8. **Report: Competitive** — Heat index, AI entrant table, incumbent grid, news
9. **Report: Evidence** — Searchable source table, stats, known unknowns
10. **Report: Diligence** — Focus areas, upgrade/break conditions, next steps

---

## Exports

- **PDF** — `window.print()` with dedicated print CSS
- **JSON** — Full `ScreeningRecord` as downloadable file

---

## Tech Stack

**Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4, Zustand, React Router v6

**Backend:** Vercel Serverless Functions (Node.js 20), `@anthropic-ai/sdk`, Tavily Search API, Brave Search (fallback), `pdf-parse`

**Deployment:** Vercel (GitHub auto-deploy on push to `main`)

---

## Project Status (V16 — April 17, 2026)

- ✅ All 7 data packs live (no stubs)
- ✅ V4 orchestrator: 5-pass research, gap-fill, second pass
- ✅ V14 scoring: ThreatLevel + ReadinessStage (no single combined score)
- ✅ Models: `claude-opus-4-7` / `claude-sonnet-4-6` (Feb 2026)
- ✅ All search queries updated to 2025/2026 date range
- ✅ TODAY = April 17, 2026 injected into every AI system prompt
- ✅ AxisCare seeded demo record (GO / Stage 3 / EXECUTE)
- ✅ PDF + JSON export working
- ✅ Vercel `maxDuration: 300` — no timeout issues
