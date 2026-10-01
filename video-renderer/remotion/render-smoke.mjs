import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
} from './youtube-single-prompt.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'oms-remotion-smoke-'));
const output = path.join(work, 'scene-sampler.mp4');

try {
  const serveUrl = await bundle({
    entryPoint: path.join(here, 'index.jsx'),
    onProgress: () => {},
  });

  const composition = await selectComposition({
    serveUrl,
    id: YOUTUBE_SINGLE_PROMPT_ID,
    inputProps: YOUTUBE_SINGLE_PROMPT_SPEC,
    logLevel: 'warn',
  });

  assert.equal(composition.width, 1080);
  assert.equal(composition.height, 1920);
  assert.equal(composition.fps, 30);
  assert.equal(composition.durationInFrames, 1770);

  // Render half a second from every one of the eight scenes into one
  // concatenated H.264 smoke video. This exercises every visual mode.
  const frameRange = [
    [0, 14],
    [120, 134],
    [300, 314],
    [540, 554],
    [810, 824],
    [1080, 1094],
    [1350, 1364],
    [1620, 1634],
  ];

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps: YOUTUBE_SINGLE_PROMPT_SPEC,
    frameRange,
    crf: 24,
    imageFormat: 'jpeg',
    jpegQuality: 80,
    pixelFormat: 'yuv420p',
    concurrency: 1,
    logLevel: 'warn',
  });

  const stat = await fs.stat(output);
  assert.ok(stat.size > 100000, 'Rendered MP4 is unexpectedly small');

  const {stdout} = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate',
    '-of', 'json',
    output,
  ]);
  const probe = JSON.parse(stdout);
  const video = (probe.streams || []).find((stream) => stream.codec_name === 'h264');

  assert.ok(video, 'H.264 video stream missing');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.equal(video.r_frame_rate, '30/1');

  const duration = Number(probe.format?.duration || 0);
  assert.ok(duration >= 3.9 && duration <= 4.2, 'Unexpected smoke video duration');

  console.log('OMS YouTube Remotion render smoke passed', JSON.stringify({
    bytes: stat.size,
    durationSeconds: duration,
    width: video.width,
    height: video.height,
    fps: video.r_frame_rate,
    scenesSampled: frameRange.length,
    codec: video.codec_name,
  }));
} finally {
  await fs.rm(work, {recursive: true, force: true});
}
