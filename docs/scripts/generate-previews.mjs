import { readdir, mkdir, rm } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIAGRAMS_DIR = join(__dirname, '..', 'public', 'diagrams');
const PREVIEWS_DIR = join(DIAGRAMS_DIR, 'previews');
const VIEWPORT_WIDTH = 1400;

async function generatePreviews() {
  await rm(PREVIEWS_DIR, { recursive: true, force: true });
  await mkdir(PREVIEWS_DIR, { recursive: true });

  const files = (await readdir(DIAGRAMS_DIR))
    .filter(f => f.endsWith('.html'))
    .sort();

  console.log(`Generating previews for ${files.length} diagrams...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_WIDTH, height: 900, deviceScaleFactor: 2 });

    for (const file of files) {
      const htmlPath = join(DIAGRAMS_DIR, file);
      const pngName = basename(file, extname(file)) + '.png';
      const pngPath = join(PREVIEWS_DIR, pngName);

      await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 200));

      await page.screenshot({ path: pngPath, fullPage: true, type: 'png' });
      console.log(`  ${file} -> ${pngName}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Done. ${files.length} previews generated.`);
}

generatePreviews().catch(err => {
  console.error('Preview generation failed:', err);
  process.exit(1);
});
