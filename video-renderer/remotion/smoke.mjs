import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_DIRECTOR_SPEC,
  generateWordCaptions,
  normalizeDirectorSpec,
  validateDirectorSpec,
} from './director-spec.mjs';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
  normalizeYoutubeSinglePromptSpec,
  validateYoutubeSinglePromptSpec,
} from './youtube-single-prompt.mjs';

const renderer = await import('@remotion/renderer');
const bundler = await import('@remotion/bundler');
const captions = await import('@remotion/captions');

assert.equal(typeof renderer.renderMedia, 'function');
assert.equal(typeof renderer.selectComposition, 'function');
assert.equal(typeof bundler.bundle, 'function');
assert.equal(typeof captions.createTikTokStyleCaptions, 'function');

assert.equal(validateDirectorSpec(DEFAULT_DIRECTOR_SPEC), true);
const normalized = normalizeDirectorSpec({theme: 'Smoke test'});
assert.equal(normalized.scenes.length, 8);
assert.equal(normalized.durationSeconds, 59);

const words = generateWordCaptions('Jesus gives hope', 3000);
assert.equal(words.length, 3);
assert.equal(words[0].startMs, 0);
assert.equal(words[2].endMs, 3000);

assert.equal(YOUTUBE_SINGLE_PROMPT_ID, 'OMS-YouTube-Single-Prompt');
assert.equal(validateYoutubeSinglePromptSpec(YOUTUBE_SINGLE_PROMPT_SPEC), true);
const youtube = normalizeYoutubeSinglePromptSpec({theme: 'YouTube prompt smoke'});
assert.equal(youtube.variant, 'youtube-single-prompt');
assert.equal(youtube.scenes.length, 8);
assert.equal(youtube.durationSeconds, 59);
assert.equal(youtube.scenes[0].start, 0);
assert.equal(youtube.scenes[7].end, 59);

const here = path.dirname(fileURLToPath(import.meta.url));
const serveUrl = await bundler.bundle({
  entryPoint: path.join(here, 'index.jsx'),
  onProgress: () => {},
});
assert.ok(serveUrl);

console.log('Remotion OMS smoke test passed');
