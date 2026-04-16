# Eagle Vision Architecture — Orchestrator-on-Client Pattern

## Why Orchestrator-on-Client?

Netlify Functions have a **10-second default timeout** on the free tier. Running a full 7-pack screening inside one serverless function is impossible (~2-3 minutes of work).

The solution: **the client orchestrates everything**.

```
Browser (React) — ORCHESTRATOR
│
├── calls /api/research-search    (one search query, ~2s)
├── calls /api/research-crawl     (one URL, ~3s)
├── calls /api/pack-company-profile   (~8s with evidence)
├── calls /api/pack-competitive-landscape  (~8s parallel)
├── calls /api/pack-team-capability   (~8s parallel)
├── calls /api/pack-regulatory-moat   (~8s parallel)
└── runs stub packs client-side (instant)
```

Each serverless function handles **one small unit of work**. The client sequences and parallelizes them. Progress updates happen naturally as each call returns.

## Stage Architecture

```
Stage 1 (sequential):
  research-search × 3 queries → company profile evidence
  research-crawl → homepage text
  → pack-company-profile (Claude call with evidence)

Stage 2 (parallel after Stage 1):
  [parallel group A — live packs]
  ├── research-search × 5 queries → competitive evidence
  ├── research-search × 3 queries → team evidence
  ├── research-search × 3 queries → regulatory evidence
  │
  ├── pack-competitive-landscape (Claude with evidence)
  ├── pack-team-capability (Claude with evidence)
  └── pack-regulatory-moat (Claude with evidence)
  
  [parallel group B — stubs]
  ├── workflow_product stub (instant, client-side)
  └── data_architecture stub (instant, client-side)

Stage 3 (after Stage 2):
  └── market_timing stub (instant, client-side)
```

## Data Flow

```
Evidence Collection (web search + crawl)
    ↓
Pack Synthesis (Claude → structured JSON)
    ↓ Zod validation
Pack Data (factor_inputs: { signal_strength, evidence_summary })
    ↓
Scoring Engine (deterministic TypeScript)
    ↓
ScoreBundle (risk_score, readiness_score, disposition, grades)
    ↓
Report Rendering (React)
```

## LLM / Scoring Separation

The most important architectural principle:

> **LLMs produce evidence. Deterministic code produces scores.**

Pack functions return structured `factor_inputs` with `signal_strength` (0–1) and `evidence_summary`. The scoring engine applies explicit rubric functions to convert signal_strength → 0–100 scores, then applies weights. No LLM call is ever inside the scoring engine.

This makes scores auditable, reproducible, and defensible in investment committee.

## Error Handling

- Any pack that fails returns LOW confidence defaults
- Zod validation on every pack output; retry once on malformed JSON
- Search timeouts return empty results (pack continues with LOW confidence)
- Partial screenings are always better than blocked screenings
- `honesty_flag: true` marks any aborted or partial screening

## localStorage Persistence

```typescript
// Archive stored in localStorage under 'aql-archive'
{
  records: {
    "job_abc123": ScreeningRecord,
    ...
  }
}
// Max 50 records; oldest pruned automatically
```
