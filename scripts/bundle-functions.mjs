/**
 * Bundle Netlify Functions with esbuild
 * Each function is bundled into a standalone CJS file
 */

import { build } from 'esbuild';
import { readdir, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT_DIR = join(ROOT, 'netlify/functions');
const OUTPUT_DIR = join(ROOT, 'netlify-bundled/functions');

async function bundleFunctions() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = await readdir(INPUT_DIR);
  const tsFiles = files.filter(f => f.endsWith('.ts'));

  console.log(`\nBundling ${tsFiles.length} Netlify Functions...\n`);

  for (const file of tsFiles) {
    const name = basename(file, '.ts');
    const inputPath = join(INPUT_DIR, file);
    const outputPath = join(OUTPUT_DIR, `${name}.js`);

    try {
      await build({
        entryPoints: [inputPath],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'cjs',
        outfile: outputPath,
        external: ['pdf-parse'],
        minify: false,
        sourcemap: false,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      });
      console.log(`  ✓ ${name}.js`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  console.log('\n✓ All functions bundled\n');
}

bundleFunctions().catch(console.error);
