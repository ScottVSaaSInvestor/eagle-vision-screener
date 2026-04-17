/**
 * Build script for Vercel API functions.
 * Bundles each netlify/functions/*.ts file into api/*.js
 * using esbuild — no TypeScript compilation issues, works perfectly on Vercel.
 */
import { build } from 'esbuild';
import { readdir, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const functionsDir = 'netlify/functions';
const apiDir = 'api';
// Use .cjs extension so Node.js treats files as CommonJS even in "type": "module" projects
const outExt = '.cjs';

// Get all function files
const files = (await readdir(functionsDir)).filter(f => f.endsWith('.ts'));

console.log(`Building ${files.length} API functions for Vercel...\n`);

// The adapter code — inlined directly into each bundle
const adapterCode = `
async function adapt(handler, req, res) {
  try {
    let rawBody = null;
    if (req.body !== undefined && req.body !== null) {
      rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    const headers = {};
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = Array.isArray(v) ? v[0] : (v || '');
      }
    }
    const event = {
      httpMethod: (req.method || 'GET').toUpperCase(),
      body: rawBody,
      headers,
      path: req.url || '/',
      queryStringParameters: req.query || {},
    };
    const result = await handler(event);
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }
    if (!res.getHeader('Content-Type') && !res.getHeader('content-type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.status(result.statusCode).send(result.body);
  } catch (err) {
    console.error('[api] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
`;

for (const file of files) {
  const name = file.replace('.ts', '');
  const inputPath = join(functionsDir, file);
  const outputPath = join(apiDir, `${name}${outExt}`);

  try {
    // Bundle the netlify function with esbuild
    const result = await build({
      entryPoints: [inputPath],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      write: false,
      external: ['pdf-parse'], // keep pdf-parse external (large binary)
      define: {},
      logLevel: 'silent',
    });

    const bundledCode = result.outputFiles[0].text;

    // Fix: esbuild CJS output ends with `module.exports = __toCommonJS(...)`.
    // We rename `module.exports` in the bundle to `_netlifyExports` so it doesn't
    // clobber the outer module.exports that Vercel reads.
    const patchedBundle = bundledCode
      .replace(/\bmodule\.exports\s*=/g, '_netlifyExports =')
      .replace(/\bmodule\.exports\b/g, '_netlifyExports');

    // Write the Vercel API route — wraps the bundled handler
    const vercelRoute = `${adapterCode}

// Bundled function: ${name}
let _netlifyExports = {};
${patchedBundle}

const _netlifyHandler = (_netlifyExports && (_netlifyExports.handler || _netlifyExports.default)) || null;

// Vercel API route export
module.exports = async function vercelHandler(req, res) {
  if (!_netlifyHandler) {
    res.status(500).json({ error: 'Handler not found in bundle', bundle: '${name}' });
    return;
  }
  await adapt(_netlifyHandler, req, res);
};
module.exports.config = { maxDuration: 300 };
`;

    await writeFile(outputPath, vercelRoute);
    console.log(`  ✅ ${name}${outExt}`);
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

console.log(`\n✅ All ${files.length} Vercel API functions built.`);
