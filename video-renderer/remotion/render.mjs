import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {DEFAULT_DIRECTOR_SPEC, normalizeDirectorSpec} from './director-spec.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const propsFile = process.argv[2] || null;
const outputLocation = path.resolve(process.argv[3] || 'out/oms-christian-short.mp4');

const input = propsFile
  ? JSON.parse(await readFile(path.resolve(propsFile), 'utf8'))
  : DEFAULT_DIRECTOR_SPEC;
const inputProps = normalizeDirectorSpec(input);

await mkdir(path.dirname(outputLocation), {recursive: true});

console.log('[remotion] Bundling OMS Christian Short...');
const serveUrl = await bundle({
  entryPoint: path.join(__dirname, 'index.jsx'),
  onProgress: (progress) => {
    if (Number.isFinite(progress)) {
      process.stdout.write(`\r[remotion] bundle ${Math.round(progress * 100)}%`);
    }
  },
});
process.stdout.write('\n');

const composition = await selectComposition({
  serveUrl,
  id: 'OMS-Christian-Short',
  inputProps,
  logLevel: 'warn',
});

console.log('[remotion] Rendering 1080x1920 H.264...');
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation,
  inputProps,
  crf: 18,
  imageFormat: 'jpeg',
  jpegQuality: 90,
  pixelFormat: 'yuv420p',
  concurrency: process.env.REMOTION_CONCURRENCY || '50%',
  logLevel: 'warn',
  onProgress: ({progress}) => {
    process.stdout.write(`\r[remotion] render ${Math.round(progress * 100)}%`);
  },
});
process.stdout.write('\n');
console.log(`[remotion] Wrote ${outputLocation}`);
