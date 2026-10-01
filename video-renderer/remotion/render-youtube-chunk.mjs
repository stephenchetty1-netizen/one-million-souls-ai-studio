import path from 'node:path';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
} from './youtube-single-prompt.mjs';

const [serveUrl, startRaw, endRaw, outputLocation] = process.argv.slice(2);
const start = Number(startRaw);
const end = Number(endRaw);

if (!serveUrl || !outputLocation || !Number.isInteger(start) || !Number.isInteger(end) || end < start) {
  throw new Error('Usage: render-youtube-chunk.mjs <serveUrl> <startFrame> <endFrame> <output>');
}

const composition = await selectComposition({
  serveUrl,
  id: YOUTUBE_SINGLE_PROMPT_ID,
  inputProps: YOUTUBE_SINGLE_PROMPT_SPEC,
  logLevel: 'warn',
});

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: path.resolve(outputLocation),
  inputProps: YOUTUBE_SINGLE_PROMPT_SPEC,
  frameRange: [start, end],
  crf: 20,
  imageFormat: 'jpeg',
  jpegQuality: 82,
  pixelFormat: 'yuv420p',
  concurrency: 1,
  offthreadVideoThreads: 1,
  disallowParallelEncoding: true,
  logLevel: 'warn',
});

console.log('OMS_YOUTUBE_CHUNK_CHILD_COMPLETE', JSON.stringify({
  start,
  end,
  frames: end - start + 1,
}));
