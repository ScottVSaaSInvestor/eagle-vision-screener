/**
 * Eagle Vision Screener — Packaging Script
 * Creates a deploy/ folder ready for Netlify drag-and-drop deployment
 *
 * deploy/
 * ├── index.html (and all dist/ assets)
 * ├── assets/
 * ├── netlify/
 * │   └── functions/   (bundled .js files)
 * └── netlify.toml
 */

import { copyFile, mkdir, rm, readdir, stat } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DEPLOY_DIR = join(ROOT, 'deploy');

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const info = await stat(srcPath);
    if (info.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function packageApp() {
  console.log('\n🦅 Eagle Vision Screener — Packaging for Netlify\n');

  // Step 1: Clean deploy/
  console.log('1. Cleaning deploy/ directory...');
  await rm(DEPLOY_DIR, { recursive: true, force: true });
  await mkdir(DEPLOY_DIR, { recursive: true });

  // Step 2: Build frontend
  console.log('2. Building frontend (npm run build)...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  // Step 3: Copy dist/ to deploy/
  console.log('3. Copying dist/ to deploy/...');
  await copyDir(join(ROOT, 'dist'), DEPLOY_DIR);

  // Step 4: Bundle functions
  console.log('4. Bundling Netlify Functions with esbuild...');
  execSync('node scripts/bundle-functions.mjs', { cwd: ROOT, stdio: 'inherit' });

  // Step 5: Copy bundled functions to deploy/netlify/functions/
  console.log('5. Copying bundled functions...');
  const functionsDir = join(DEPLOY_DIR, 'netlify', 'functions');
  await mkdir(functionsDir, { recursive: true });
  await copyDir(join(ROOT, 'netlify-bundled', 'functions'), functionsDir);

  // Copy pdf-parse node_modules for external dependency
  const pdfParseDir = join(ROOT, 'node_modules', 'pdf-parse');
  const pdfParseDest = join(DEPLOY_DIR, 'netlify', 'functions', 'node_modules', 'pdf-parse');
  try {
    await copyDir(pdfParseDir, pdfParseDest);
    console.log('   ✓ Copied pdf-parse module');
  } catch {
    console.log('   ⚠ pdf-parse not found — PDF parsing will use fallback');
  }

  // Step 6: Write deploy-specific netlify.toml (NOT the root dev version)
  // IMPORTANT: deploy netlify.toml must have command="" and publish="."
  // because the site is pre-built — Netlify should NOT run a build command
  console.log('6. Writing deploy netlify.toml (pre-built, no build command)...');
  const deployToml = `[build]
  command = ""
  publish = "."
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

# ── AI Pack Functions (heavy Claude calls — 26s max) ─────────────────────────
[functions."pack-company-profile"]
  timeout = 26

[functions."pack-competitive-landscape"]
  timeout = 26

[functions."pack-team-capability"]
  timeout = 26

[functions."pack-regulatory-moat"]
  timeout = 26

[functions."pack-workflow-product"]
  timeout = 26

[functions."pack-data-architecture"]
  timeout = 26

[functions."pack-market-timing"]
  timeout = 26

# ── Research Functions ────────────────────────────────────────────────────────
[functions."research-search"]
  timeout = 26

[functions."research-crawl"]
  timeout = 26

[functions."research-gap-fill"]
  timeout = 26

[functions."research-synthesize"]
  timeout = 26

# ── Supporting Functions ──────────────────────────────────────────────────────
[functions."auth-check"]
  timeout = 10

[functions."document-parse"]
  timeout = 26

[functions."diagnose"]
  timeout = 26
`;
  const { writeFile } = await import('fs/promises');
  await writeFile(join(DEPLOY_DIR, 'netlify.toml'), deployToml, 'utf8');

  // Done
  console.log('\n✅ Package complete!\n');
  console.log('📦 Deploy folder: ./deploy/');
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('NETLIFY DRAG-AND-DROP DEPLOYMENT CHECKLIST');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1. Go to https://app.netlify.com/sites');
  console.log('2. Drag the ./deploy/ folder onto the drop zone');
  console.log('3. Wait for deployment to complete (~1 min)');
  console.log('4. Go to Site Settings → Environment Variables → Add:');
  console.log('   ANTHROPIC_API_KEY     = sk-ant-...');
  console.log('   ANTHROPIC_MODEL       = claude-sonnet-4-5-20250929  ← REQUIRED (Opus times out on Netlify free tier)');
  console.log('                           ⚠️  DO NOT use claude-opus-4-5 — Netlify kills function at 26s, Opus needs 40-90s');
  console.log('                           ✅ Sonnet finishes in 8-15s — full analysis quality, no timeouts');
  console.log('   TAVILY_API_KEY        = tvly-...');
  console.log('   ACCESS_PASSCODE       = your-secure-passcode');
  console.log('   BRAVE_SEARCH_API_KEY  = BSA-...  (optional)');
  console.log('5. Trigger a redeploy (Deploys → Trigger deploy → Deploy site)');
  console.log('6. Open the site URL and enter your passcode');
  console.log('─────────────────────────────────────────────────────────────\n');
}

packageApp().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
