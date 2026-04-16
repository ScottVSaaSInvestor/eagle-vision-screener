# Netlify Deployment Guide — Eagle Vision Screener

## Drag-and-Drop Deployment (5 minutes)

### Step 1: Build the Package

```bash
npm run package
# Creates ./deploy/ with all required files
```

The `deploy/` folder contains:
```
deploy/
├── index.html           # React SPA entry
├── assets/              # Vite-built JS and CSS
├── favicon.svg
├── netlify.toml         # Redirects + function config
└── netlify/
    └── functions/       # Pre-bundled serverless functions
        ├── auth-check.js
        ├── research-search.js
        ├── research-crawl.js
        ├── document-parse.js
        ├── pack-company-profile.js
        ├── pack-competitive-landscape.js
        ├── pack-team-capability.js
        └── pack-regulatory-moat.js
```

### Step 2: Deploy to Netlify

1. Go to [https://app.netlify.com/sites](https://app.netlify.com/sites)
2. Click **"Add new site"** → **"Deploy manually"**
3. **Drag the entire `./deploy/` folder** onto the upload zone
4. Wait ~60 seconds for deployment

### Step 3: Set Environment Variables

In Netlify dashboard: **Site Settings → Environment Variables → Add a variable**

| Key | Value | Required |
|-----|-------|----------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | ✅ Yes |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | ✅ Yes |
| `TAVILY_API_KEY` | `tvly-...` | ✅ Yes |
| `ACCESS_PASSCODE` | Your secure passcode | ✅ Yes |
| `BRAVE_SEARCH_API_KEY` | `BSA-...` | Optional |

### Step 4: Trigger Redeploy

Functions need a deploy to pick up environment variables.

**Deploys → Trigger deploy → Deploy site**

### Step 5: Test

1. Open your Netlify URL (e.g., `https://sparkly-eagle-12345.netlify.app`)
2. Enter your `ACCESS_PASSCODE`
3. Click **"+ New Screening"**
4. Enter a company (e.g., "Toast" with URL `https://pos.toasttab.com`)
5. Start screening

---

## netlify.toml Reference

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["pdf-parse"]
```

**Key points:**
- `/api/*` → `/.netlify/functions/*` rewrite makes frontend calls clean
- `/*` → `index.html` enables React Router SPA routing
- `node_bundler = "esbuild"` for faster builds (Netlify-side, not used in drag-drop)

---

## Timeout Budget

Each Netlify Function is budgeted under 8 seconds (10s limit on free tier):

| Function | Typical Duration |
|----------|-----------------|
| `auth-check` | <100ms |
| `research-search` | 1–4s (Tavily/Brave) |
| `research-crawl` | 2–5s (URL fetch) |
| `document-parse` | 500ms–2s |
| `pack-company-profile` | 4–8s (Claude) |
| `pack-competitive-landscape` | 5–8s (Claude, longest) |
| `pack-team-capability` | 4–7s (Claude) |
| `pack-regulatory-moat` | 4–7s (Claude) |

The client-side orchestrator manages timing. If any single call times out, the pack is marked LOW confidence and the screening continues.

---

## Custom Domain

```bash
# In Netlify dashboard: Domain management → Add custom domain
# OR via CLI:
netlify domains:add yourdomain.com --site YOUR_SITE_ID
```

---

## Redeployment

To redeploy with code changes:
```bash
npm run package
# Then drag deploy/ onto Netlify again (creates new deployment)
```

Or use Netlify CLI for faster updates:
```bash
netlify deploy --prod --dir=deploy
```
