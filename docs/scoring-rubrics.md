# Eagle Vision SOAR — Scoring Rubrics Reference

All rubrics are implemented deterministically in `src/engine/scoring/rubrics.ts`.

## How Rubrics Work

Each factor maps a `signal_strength` (0.0–1.0) from pack evidence → a score 0–100.

- **Risk factors (R1–R7):** Higher score = MORE risk
- **Readiness factors (A1–A9):** Higher score = MORE readiness (better)
- **Critical Gap:** Any readiness factor scoring ≤ 40

## Risk Factor Rubrics

### R1 — Competitive Window (18%)
Higher score = window closing faster

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | Protected window >3 years |
| 0.2–0.4 | ~32 | 2–3 year window |
| 0.4–0.6 | ~52 | 12–24 month window |
| 0.6–0.8 | ~70 | 6–12 month window |
| 0.8–1.0 | ~88 | <6 months or already closed |

### R2 — AI-Native Entrant Threat (16%)
Higher score = more/better-funded entrants

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~10 | No identified entrants |
| 0.2–0.4 | ~30 | 1 small sub-Series A |
| 0.4–0.6 | ~50 | 2+ entrants, none Series B+ |
| 0.6–0.8 | ~70 | Multiple entrants, 1 Series B+ |
| 0.8–1.0 | ~90 | 3+ well-funded with traction |

### R3 — Incumbent AI Posture (15%)
Higher score = incumbents actively shipping AI

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~10 | No AI initiatives |
| 0.2–0.4 | ~30 | Roadmap only / signaling |
| 0.4–0.6 | ~50 | Beta feature shipped |
| 0.6–0.8 | ~68 | Launched product marketed |
| 0.8–1.0 | ~85 | GA feature with customer traction |

### R4 — Horizontal AI Encroachment (16%)
Higher score = more horizontal AI substitution

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~12 | No credible horizontal threat |
| 0.2–0.4 | ~28 | Theoretical only |
| 0.4–0.6 | ~48 | Experiments by users |
| 0.6–0.8 | ~68 | Active documented use cases |
| 0.8–1.0 | ~86 | Widespread adoption displacing SaaS |

### R5 — Customer Switching Propensity (14%)
Higher score = easier to switch

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | High switching costs, locked data |
| 0.2–0.4 | ~35 | Moderate friction |
| 0.4–0.6 | ~52 | Some integrations, manageable |
| 0.6–0.8 | ~70 | Low switching costs |
| 0.8–1.0 | ~88 | Trivial to switch, no lock-in |

### R6 — Regulatory Moat Durability (11%)
**Note:** Higher signal_strength = STRONGER moat (inverted for scoring — higher moat = LOWER risk)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.8–1.0 | ~15 | Strong durable regulatory moat |
| 0.6–0.8 | ~35 | Meaningful but softening |
| 0.4–0.6 | ~52 | Moderate protection |
| 0.2–0.4 | ~68 | Minimal regulatory protection |
| 0.0–0.2 | ~84 | No moat or deregulating |

### R7 — Market Timing Risk (10%)
Higher score = worse timing

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~18 | Perfect timing window |
| 0.2–0.4 | ~35 | Good timing, slightly early |
| 0.4–0.6 | ~52 | Neutral timing |
| 0.6–0.8 | ~68 | Late or over-funded |
| 0.8–1.0 | ~85 | Too late / market collapsing |

---

## Readiness Factor Rubrics

### A1 — Workflow Embeddedness (18%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | Peripheral / nice-to-have |
| 0.2–0.4 | ~35 | Used occasionally |
| 0.4–0.6 | ~55 | Regular use, not critical path |
| 0.6–0.8 | ~73 | Daily use on critical workflows |
| 0.8–1.0 | ~90 | Mission-critical system of record |

### A2 — Data Foundation & Quality (18%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~12 | No structured data |
| 0.2–0.4 | ~32 | Basic structured data, limited history |
| 0.4–0.6 | ~55 | Multi-year structured data |
| 0.6–0.8 | ~73 | Rich longitudinal data with quality controls |
| 0.8–1.0 | ~90 | Proprietary data moat with feedback loops |

### A3 — Outcome-Labeled Data (14%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~10 | No labeled outcomes |
| 0.2–0.4 | ~30 | Minimal labeling |
| 0.4–0.6 | ~52 | Partial labeling |
| 0.6–0.8 | ~72 | Systematic outcome tracking |
| 0.8–1.0 | ~90 | Comprehensive labeled dataset |

### A4 — Value Quantification (12%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | No ROI evidence |
| 0.2–0.4 | ~35 | Anecdotal value claims |
| 0.4–0.6 | ~55 | Partial metrics |
| 0.6–0.8 | ~73 | Clear ROI metrics published |
| 0.8–1.0 | ~88 | Independently verified ROI case studies |

### A5 — Pricing Model Flexibility (5%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~20 | Rigid seat-only pricing |
| 0.2–0.4 | ~38 | Limited tiers |
| 0.4–0.6 | ~55 | Multiple pricing models |
| 0.6–0.8 | ~72 | Usage/outcome-based available |
| 0.8–1.0 | ~88 | Full flexibility with AI pricing |

### A6 — AI/ML Team Capability (12%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~10 | No dedicated AI/ML staff |
| 0.2–0.4 | ~30 | 1–2 ML engineers |
| 0.4–0.6 | ~52 | Small ML team |
| 0.6–0.8 | ~72 | Strong ML team, published work |
| 0.8–1.0 | ~90 | World-class AI team |

### A7 — Architecture Readiness (10%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | Legacy monolith |
| 0.2–0.4 | ~35 | Partial APIs |
| 0.4–0.6 | ~55 | API-first modern stack |
| 0.6–0.8 | ~73 | Microservices with ML infrastructure |
| 0.8–1.0 | ~88 | ML-native, cloud-native architecture |

### A8 — Compounding Loop Potential (8%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~10 | No feedback loops |
| 0.2–0.4 | ~30 | Basic usage data |
| 0.4–0.6 | ~52 | Some learning loops |
| 0.6–0.8 | ~70 | Clear flywheel design |
| 0.8–1.0 | ~88 | Proven compounding data/network effects |

### A9 — Leadership AI Clarity (3%)

| Signal Range | Score | Interpretation |
|-------------|-------|----------------|
| 0.0–0.2 | ~15 | No AI strategy |
| 0.2–0.4 | ~35 | Vague AI mentions |
| 0.4–0.6 | ~55 | Defined AI roadmap |
| 0.6–0.8 | ~73 | AI-first strategy with CEO alignment |
| 0.8–1.0 | ~88 | Deep AI conviction with track record |

---

## Grade Mapping

| Score Range | Grade |
|-------------|-------|
| 85–100 | A |
| 75–84 | B |
| 65–74 | C |
| 55–64 | D |
| 0–54 | F |

*Risk factors: grade is applied to (100 - risk_score) so lower risk = higher grade*
