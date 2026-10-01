import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
} from './youtube-single-prompt.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

const required = ['ENDPOINT','BUCKET','REGION','ACCESS_KEY_ID','SECRET_ACCESS_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error('Missing required storage variable: ' + name);
}

const s3 = new S3Client({
  endpoint: process.env.ENDPOINT,
  region: process.env.REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

const commit = String(process.env.RAILWAY_GIT_COMMIT_SHA || 'manual').slice(0, 12);
const day = new Date().toISOString().slice(0, 10);
const runId = 'oms-youtube-single-prompt-' + day + '-' + commit;
const key = 'remotion-runs/' + day + '/' + runId + '.mp4';
const metadataKey = 'remotion-runs/' + day + '/' + runId + '.json';

try {
  await s3.send(new HeadObjectCommand({Bucket: process.env.BUCKET, Key: metadataKey}));
  console.log('OMS_YOUTUBE_FULL_RENDER_ALREADY_COMPLETE', JSON.stringify({
    key,
    metadataKey,
    publishingAllowed: false,
  }));
  process.exit(0);
} catch {}

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'oms-youtube-full-'));
const output = path.join(work, 'oms-youtube-single-prompt.mp4');

try {
  console.log('OMS_YOUTUBE_FULL_RENDER_START', JSON.stringify({
    compositionId: YOUTUBE_SINGLE_PROMPT_ID,
    durationSeconds: 59,
    width: 1080,
    height: 1920,
    fps: 30,
    publishingAllowed: false,
  }));

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

  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps: YOUTUBE_SINGLE_PROMPT_SPEC,
    crf: 18,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    pixelFormat: 'yuv420p',
    concurrency: 1,
    logLevel: 'warn',
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 100);
      const bucket = Math.floor(pct / 10) * 10;
      if (bucket !== last) {
        last = bucket;
        console.log('OMS_YOUTUBE_FULL_RENDER_PROGRESS', JSON.stringify({pct: bucket}));
      }
    },
  });

  const bytes = await fs.readFile(output);
  if (bytes.length < 1000000) throw new Error('Full render MP4 is unexpectedly small');

  const {stdout} = await execFileAsync('ffprobe', [
    '-v','error',
    '-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate',
    '-of','json',
    output,
  ]);
  const probe = JSON.parse(stdout);
  const video = (probe.streams || []).find((stream) => stream.codec_name === 'h264');
  if (!video) throw new Error('H.264 video stream missing');
  if (video.width !== 1080 || video.height !== 1920) throw new Error('Unexpected output dimensions');
  if (video.r_frame_rate !== '30/1') throw new Error('Unexpected frame rate');

  const duration = Number(probe.format?.duration || 0);
  if (duration < 58.9 || duration > 59.1) throw new Error('Unexpected full render duration: ' + duration);

  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'video/mp4',
    CacheControl: 'private, no-store',
  }));

  const base = process.env.PUBLIC_BASE_URL
    ? process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
    : process.env.RAILWAY_PUBLIC_DOMAIN
      ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
      : null;

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const mediaUrl = base ? base + '/media/' + encodedKey : null;

  const proof = {
    ok: true,
    compositionId: YOUTUBE_SINGLE_PROMPT_ID,
    key,
    mediaUrl,
    masterHash: hash,
    bytes: bytes.length,
    durationSeconds: duration,
    width: video.width,
    height: video.height,
    fps: video.r_frame_rate,
    codec: video.codec_name,
    sceneCount: 8,
    certification: 'NOT_CERTIFIED',
    publishingAllowed: false,
    completedAt: new Date().toISOString(),
  };

  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: metadataKey,
    Body: JSON.stringify(proof, null, 2),
    ContentType: 'application/json',
    CacheControl: 'private, no-store',
  }));

  console.log('OMS_YOUTUBE_FULL_RENDER_COMPLETE', JSON.stringify(proof));
} finally {
  await fs.rm(work, {recursive: true, force: true}).catch(() => {});
}
