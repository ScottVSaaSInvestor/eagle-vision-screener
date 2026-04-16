# Adding V2 Packs — Developer Guide

## Overview

Three packs are V1 stubs:
- `workflow_product` — Workflow & Product
- `data_architecture` — Data & Architecture  
- `market_timing` — Market & Timing

This guide explains how to upgrade them to full implementations.

## Step 1: Create the Netlify Function

Create `netlify/functions/pack-workflow-product.ts`:

```typescript
import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { company_name, company_url, evidence_texts } = JSON.parse(event.body || '{}');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

  const prompt = `...your structured prompt...`;

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return {
      statusCode: 200,
      body: JSON.stringify(JSON.parse(jsonMatch[0])),
    };
  }

  // fallback
  return { statusCode: 200, body: JSON.stringify({ /* fallback */ }) };
};

export { handler };
```

## Step 2: Define factor_inputs

Each pack must return the factors it owns:

| Pack | Factors |
|------|---------|
| `workflow_product` | R5, A1, A4 |
| `data_architecture` | A2, A3, A7 |
| `market_timing` | R7 |

## Step 3: Remove the stub from `stubPacks.ts`

In `src/engine/packs/stubPacks.ts`, delete the relevant stub function (e.g., `createWorkflowProductStub`).

## Step 4: Update the Orchestrator

In `src/engine/orchestrator.ts`:

1. Add research queries for the new pack
2. Add parallel pack call in Stage 2
3. Replace the stub call with the live call

```typescript
// Remove this:
const wpStub = createWorkflowProductStub(inputs.company_name);

// Add this:
apiCall('pack-workflow-product', {
  company_name: inputs.company_name,
  company_url: inputs.company_url,
  evidence_texts: workflowTexts,
}, 20000).then(data => {
  const pack: DataPack = { ...data, pack_name: 'workflow_product', status: 'complete' };
  dataPacks['workflow_product'] = pack;
  onPackUpdate('workflow_product', pack);
  log({ message: '✓ Workflow & Product complete', level: 'success', pack: 'workflow_product' });
}).catch(() => {
  log({ message: 'Workflow & Product failed', level: 'error' });
}),
```

## Step 5: Build and test

```bash
npm run build
node scripts/bundle-functions.mjs
```

Test the new pack function directly:
```bash
curl -X POST http://localhost:8888/.netlify/functions/pack-workflow-product \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Toast","company_url":"https://pos.toasttab.com"}'
```

## Factor Prompt Guidelines

For each factor, the LLM prompt should:
1. Ask for `evidence_summary` — what you found, with citations
2. Ask for `signal_strength` (0.0–1.0) — how strong the signal is
3. Provide explicit rubric guidance so the LLM calibrates properly
4. Require source URLs for all claims

Example for A1 (Workflow Embeddedness):
```
A1 signal_strength rubric:
- 0.0–0.2: Product is peripheral / nice-to-have, rarely used
- 0.2–0.4: Product used occasionally, not mission-critical
- 0.4–0.6: Regular daily use but not on critical workflows
- 0.6–0.8: Daily use on critical-path workflows
- 0.8–1.0: Mission-critical system of record, cannot operate without
```

## V2 Timeline Recommendation

| Quarter | Pack |
|---------|------|
| Q1 | `market_timing` (market sizing + comparable analysis) |
| Q1 | `workflow_product` (product depth + stickiness) |
| Q2 | `data_architecture` (technical audit integration) |
