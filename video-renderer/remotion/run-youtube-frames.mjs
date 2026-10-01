import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {S3Client, PutObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3';
import {bundle} from '@remotion/bundler';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
} from './youtube-single-prompt.mjs';
import {renderYoutubeVoicedAsset} from './youtube-voiced-renderer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

for (const name of ['ENDPOINT','BUCKET','REGION','ACCESS_KEY_ID','SECRET_ACCESS_KEY']) {
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
const runId = 'oms-youtube-premium-voiced-' + day + '-' + commit;
const key = 'remotion-runs/' + day + '/' + runId + '.mp4';
const metadataKey = 'remotion-runs/' + day + '/' + runId + '.json';

try {
  await s3.send(new HeadObjectCommand({Bucket: process.env.BUCKET, Key: metadataKey}));
  console.log('OMS_PREMIUM_VOICED_RENDER_ALREADY_COMPLETE', JSON.stringify({
    key,
    metadataKey,
    publishingAllowed: false,
  }));
  process.exit(0);
} catch {}

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'oms-premium-voiced-'));
const output = path.join(work, 'oms-youtube-premium-voiced.mp4');

try {
  console.log('OMS_PREMIUM_VOICED_RENDER_START', JSON.stringify({
    compositionId: YOUTUBE_SINGLE_PROMPT_ID,
    durationSeconds: 59,
    width: 1080,
    height: 1920,
    fps: 30,
    visualTier: 'PREMIUM_CINEMATIC',
    graphicsTier: 'PREMIUM_MOTION',
    voiceTier: 'PREMIUM_NEURAL',
    publishingAllowed: false,
  }));

  const serveUrl = await bundle({
    entryPoint: path.join(here, 'index.jsx'),
    onProgress: () => {},
  });

  let lastBucket = -1;
  const result = await renderYoutubeVoicedAsset({
    spec: YOUTUBE_SINGLE_PROMPT_SPEC,
    serveUrl,
    workdir: work,
    outputLocation: output,
    onProgress: ({progress, framesRendered, totalFrames}) => {
      const pct = Math.floor(progress * 100);
      const bucket = Math.floor(pct / 10) * 10;
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        console.log('OMS_PREMIUM_VOICED_RENDER_PROGRESS', JSON.stringify({
          pct: bucket,
          framesRendered,
          totalFrames,
        }));
      }
    },
  });

  const bytes = await fs.readFile(output);
  if (bytes.length < 1000000) throw new Error('PREMIUM_VOICED_MASTER_TOO_SMALL');
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
    durationSeconds: result.durationSeconds,
    width: result.composition.width,
    height: result.composition.height,
    fps: result.composition.fps,
    videoCodec: 'h264',
    audioCodec: result.audioCodec,
    audioChannels: result.audioChannels,
    audioSampleRate: result.audioSampleRate,
    audioPresent: result.audioPresent,
    voiceover: result.voiceover,
    narrationPresent: result.narrationPresent,
    voiceProvider: result.voiceProvider,
    voiceName: result.voiceName,
    voiceTier: result.voiceTier,
    visualTier: result.visualTier,
    graphicsTier: result.graphicsTier,
    voiceSourceDurationSeconds: result.voiceSourceDurationSeconds,
    voiceTargetDurationSeconds: result.voiceTargetDurationSeconds,
    voiceTempo: result.voiceTempo,
    maxVolumeDb: result.maxVolumeDb,
    totalFrames: result.composition.durationInFrames,
    sceneCount: result.spec.scenes.length,
    certification: 'NOT_CERTIFIED',
    publishingAllowed: false,
    completedAt: new Date().toISOString(),
  };

  if (!proof.audioPresent || !proof.voiceover || !proof.narrationPresent) {
    throw new Error('PREMIUM_MASTER_VOICEOVER_EVIDENCE_MISSING');
  }

  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: metadataKey,
    Body: JSON.stringify(proof, null, 2),
    ContentType: 'application/json',
    CacheControl: 'private, no-store',
  }));

  console.log('OMS_PREMIUM_VOICED_RENDER_COMPLETE', JSON.stringify(proof));
} finally {
  await fs.rm(work, {recursive: true, force: true}).catch(() => {});
}
