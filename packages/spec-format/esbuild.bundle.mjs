/**
 * Bundles the spec-format CLI into a single self-contained .js file.
 *
 * The bundle is shipped inside ido4shape for deterministic spec validation
 * without npm install. See: architecture/bundled-validator-architecture.md
 *
 * Usage: node esbuild.bundle.mjs
 * Output: dist/spec-validator.bundle.js
 */

import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/spec-validator.bundle.js',
  minify: true,
  define: {
    '__SPEC_FORMAT_VERSION__': JSON.stringify(pkg.version),
  },
  banner: {
    js: [
      `// @ido4/spec-format v${pkg.version} | bundled ${new Date().toISOString().split('T')[0]}`,
      `// Source: https://github.com/ido4-dev/ido4/tree/main/packages/spec-format | DO NOT EDIT`,
    ].join('\n'),
  },
});

console.log(`Built dist/spec-validator.bundle.js (v${pkg.version})`);
