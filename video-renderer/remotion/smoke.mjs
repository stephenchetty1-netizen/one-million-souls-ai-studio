import assert from 'node:assert/strict';
import {
  DEFAULT_DIRECTOR_SPEC,
  generateWordCaptions,
  normalizeDirectorSpec,
  validateDirectorSpec,
} from './director-spec.mjs';

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

console.log('Remotion OMS smoke test passed');
