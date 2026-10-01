import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
  normalizeYoutubeSinglePromptSpec,
} from './youtube-single-prompt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const propsFile = process.argv[2] || null;
const outputLocation = path.resolve(process.argv[3] || 'out/oms-youtube-single-prompt.mp4');

const raw = propsFile
  ? JSON.parse(await readFile(path.resolve(propsFile), 'utf8'))
  : YOUTUBE_SINGLE_PROMPT_SPEC;

const inputProps = normalizeYoutubeSinglePromptSpec(raw);
await mkdir(path.dirname(outputLocation), {recursive: true});

console.log('[remotion] Bundling OMS YouTube Single-Prompt...');
const serveUrl = await bundle({
  entryPoint: path.join(__dirname, 'index.jsx'),
  onProgress: () => {},
});

const composition = await selectComposition({
  serveUrl,
  id: YOUTUBE_SINGLE_PROMPT_ID,
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
