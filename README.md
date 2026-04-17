# 🦅 Eagle Vision Screener — AQL Growth

> AI-powered investment screening for vertical SaaS — internal tool for AQL Growth partners

## Overview

Eagle Vision Screener is a fast, investment-grade GO / MAYBE / NO-GO disposition engine for any vertical SaaS company. Partners enter a company name, URL, and optional context. The app orchestrates parallel AI research across 7 structured data packs, applies the Eagle Vision SOAR 16-factor methodology, and renders a 5-page investment-grade report card.

**Target run time: under 4 minutes per screening.**

---

## Architecture

```
Client (React/Vite) → /api/* → Netlify Functions (Node.js 20)
                              → Anthropic Claude (LLM evidence)
                              → Tavily (web search)
                              → Direct crawl (URL fallback)
```

**Critical design principle:** LLMs produce evidence. Deterministic TypeScript code produces scores. These layers never blend.

---

## Local Development

### Prerequisites
- Node.js 20+
- Netlify CLI (`npm install -g netlify-cli`)

### Setup

```bash
git clone <repo>
cd eagle-vision-screener
npm install
cp .env.example .env.local
# Edit .env.local with your real API keys
```

### Environment Variables (`.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
TAVILY_API_KEY=tvly-...
BRAVE_SEARCH_API_KEY=BSA-...  # optional
ACCESS_PASSCODE=your-passcode
VITE_APP_NAME=Eagle Vision Screener
VITE_APP_VERSION=1.0.0-mvp
```

### Running Locally

```bash
# Option 1: Vite dev server only (frontend only, no functions)
npm run dev

# Option 2: Full stack with Netlify Dev (functions + frontend)
netlify dev
# → App runs at http://localhost:8888
# → Functions available at /.netlify/functions/*
```

---

## Build & Deploy

### Build
```bash
npm run build        # Builds frontend to dist/
```

### Package for Netlify Drag-and-Drop
```bash
npm run package      # Creates deploy/ folder
```

### Deploy to Netlify (Drag and Drop)

1. Run `npm run package`
2. Go to [https://app.netlify.com/sites](https://app.netlify.com/sites)
3. Drag the `./deploy/` folder onto the **"Deploy manually"** drop zone
4. Go to **Site Settings → Environment Variables → Add a variable** for each:
   - `ANTHROPIC_API_KEY` = your Claude API key
   - `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
   - `TAVILY_API_KEY` = your Tavily API key
   - `ACCESS_PASSCODE` = your secure passcode
   - `BRAVE_SEARCH_API_KEY` = (optional fallback)
5. Go to **Deploys → Trigger deploy → Deploy site** to pick up env vars
6. Open the site URL and enter your passcode

---

## Eagle Vision SOAR Methodology

### AI Risk Factors (R1–R7, weighted sum = 100%)

| Factor | Weight | Description |
|--------|--------|-------------|
| R1 Competitive Window | 18% | How much time before AI threat materializes |
| R2 AI-Native Entrant Threat | 16% | Quality/quantity of AI-native competitors |
| R3 Incumbent AI Posture | 15% | How aggressively incumbents are shipping AI |
| R4 Horizontal AI Encroachment | 16% | ChatGPT/Copilot/Claude workflow substitution |
| R5 Customer Switching Propensity | 14% | How easy it is for customers to leave |
| R6 Regulatory Moat Durability | 11% | Whether regulation protects the moat |
| R7 Market Timing Risk | 10% | Macro timing: too early, perfect, or too late |

### AI Readiness Factors (A1–A9, weighted sum = 100%)

| Factor | Weight | Description |
|--------|--------|-------------|
| A1 Workflow Embeddedness | 18% | How critical-path the product is |
| A2 Data Foundation & Quality | 18% | Proprietary data depth and quality |
| A3 Outcome-Labeled Data | 14% | Whether training data has labeled outcomes |
| A4 Value Quantification | 12% | Published ROI / customer outcome evidence |
| A5 Pricing Model Flexibility | 5% | Ability to capture AI value via pricing |
| A6 AI/ML Team Capability | 12% | Team's ability to execute on AI |
| A7 Architecture Readiness | 10% | Tech stack's readiness for AI workloads |
| A8 Compounding Loop Potential | 8% | Data/network flywheel potential |
| A9 Leadership AI Clarity | 3% | CEO/board AI vision and conviction |

### Quadrant Logic
- Risk < 50 AND Readiness ≥ 50 → **EXECUTE**
- Risk ≥ 50 AND Readiness ≥ 50 → **RACE MODE**
- Risk < 50 AND Readiness < 50 → **BUILD MODE**
- Risk ≥ 50 AND Readiness < 50 → **DANGER ZONE**

### Disposition Logic
- DANGER ZONE OR 2+ critical gaps → **NO-GO**
- EXECUTE or RACE MODE, 0 critical gaps → **GO** (downgraded to MAYBE if LOW confidence)
- All other cases → **MAYBE**

---

## Data Packs

### V1 Live (real Claude calls)
- `company_profile` — Basic facts, founding, ARR, product
- `competitive_landscape` — AI entrants, incumbents, horizontal threat (**heartbeat pack**)
- `team_capability` — Leadership AI stance, ML team depth
- `regulatory_moat` — Compliance, switching friction, data moat

### V1 Stub (returns template with LOW confidence)
- `workflow_product` — Full implementation in V2
- `data_architecture` — Full implementation in V2
- `market_timing` — Full implementation in V2

---

## Pages

1. **Login** — Passcode gate
2. **Dashboard** — Archive of all screenings, sortable/filterable
3. **New Screening** — 3-step intake (company, context, config)
4. **Progress** — Live 7-pack grid with animated status tiles
5. **Report: Headline Grade** — Disposition badge, grade triptych, quadrant plot
6. **Report: 16-Factor Scorecard** — Expandable rows with evidence + notes
7. **Report: Competitive Landscape** — Heat index, entrant table, incumbent grid
8. **Report: Evidence Log** — Searchable source table, known unknowns
9. **Report: Diligence Shopping List** — Focus areas, upgrade/break conditions

---

## Exports

- **PDF** — `window.print()` with dedicated print CSS (all 5 pages, paginates cleanly)
- **JSON** — Full `ScreeningRecord` as downloadable file

---

## Tech Stack

**Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4, Zustand, React Router v6, Recharts

**Backend:** Netlify Functions (Node.js 20), `@anthropic-ai/sdk`, Tavily Search API, Brave Search (fallback), `pdf-parse`, Zod

**Deployment:** Netlify (drag-and-drop)

---

## Project Status

- ✅ Build succeeds (`npm run build`)
- ✅ All 8 functions bundled
- ✅ Deploy package created (`npm run package`)
- ✅ 4 live packs implemented
- ✅ 3 V2 stubs in place
- ✅ Scoring engine deterministic
- ✅ All 5 report pages rendered
- ✅ PDF + JSON export working
- ✅ localStorage archive with 50-screening limit

See `docs/` for detailed guides.
