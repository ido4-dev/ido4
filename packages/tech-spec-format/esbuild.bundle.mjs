/**
 * Bundles the tech-spec-format CLI into a single self-contained .js file.
 *
 * The bundle is shipped inside ido4specs for deterministic technical spec
 * validation without npm install. Parallels @ido4/spec-format's bundle.
 *
 * Usage: node esbuild.bundle.mjs
 * Output: dist/tech-spec-validator.bundle.js
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
  outfile: 'dist/tech-spec-validator.bundle.js',
  minify: true,
  define: {
    '__TECH_SPEC_FORMAT_VERSION__': JSON.stringify(pkg.version),
  },
  banner: {
    js: [
      `// @ido4/tech-spec-format v${pkg.version} | bundled ${new Date().toISOString().split('T')[0]}`,
      `// Source: https://github.com/ido4-dev/ido4/tree/main/packages/tech-spec-format | DO NOT EDIT`,
    ].join('\n'),
  },
});

console.log(`Built dist/tech-spec-validator.bundle.js (v${pkg.version})`);
