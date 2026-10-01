import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {normalizeDirectorSpec} from './director-spec.mjs';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  normalizeYoutubeSinglePromptSpec,
} from './youtube-single-prompt.mjs';
import {renderYoutubeVoicedAsset} from './youtube-voiced-renderer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let bundlePromise = null;
let activeRender = false;

const storageReady = Boolean(
  process.env.ENDPOINT &&
  process.env.BUCKET &&
  process.env.REGION &&
  process.env.ACCESS_KEY_ID &&
  process.env.SECRET_ACCESS_KEY
);

const s3 = storageReady
  ? new S3Client({
      endpoint: process.env.ENDPOINT,
      region: process.env.REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
      },
    })
  : null;

const publicBase = () => {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN;
  return 'http://127.0.0.1:' + Number(process.env.PORT || 3000);
};

function renderConcurrency() {
  const raw = String(process.env.REMOTION_CONCURRENCY || '1').trim();
  if (/^\d+(?:\.\d+)?%$/.test(raw)) return raw;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

async function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: path.join(__dirname, 'index.jsx'),
      onProgress: () => {},
    }).catch((error) => {
      bundlePromise = null;
      throw error;
    });
  }
  return bundlePromise;
}

export async function renderOmsRemotionDraft(input = {}) {
  if (activeRender) throw new Error('REMOTION_RENDER_ALREADY_RUNNING');
  if (!s3) throw new Error('REMOTION_STORAGE_REQUIRED');

  const youtubeVariant = input?.variant === 'youtube-single-prompt';
  const compositionId = youtubeVariant ? YOUTUBE_SINGLE_PROMPT_ID : 'OMS-Christian-Short';
  const spec = youtubeVariant
    ? normalizeYoutubeSinglePromptSpec(input)
    : normalizeDirectorSpec(input);

  activeRender = true;
  const id = crypto.randomUUID();
  const workdir = path.join(os.tmpdir(), 'oms-remotion', id);
  const outputLocation = path.join(workdir, 'video.mp4');

  try {
    await fs.mkdir(workdir, {recursive: true});
    const serveUrl = await getBundle();

    let composition;
    let voiced = null;

    if (youtubeVariant) {
      voiced = await renderYoutubeVoicedAsset({
        spec,
        serveUrl,
        workdir,
        outputLocation,
        onProgress: ({progress}) => {
          const pct = Math.floor(progress * 100);
          if (pct % 10 === 0) console.log('OMS_PREMIUM_RENDER_PROGRESS', JSON.stringify({id,pct}));
        },
      });
      composition = voiced.composition;
    } else {
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps: spec,
        logLevel: 'warn',
        offthreadVideoThreads: 1,
      });

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation,
        inputProps: spec,
        crf: 18,
        imageFormat: 'jpeg',
        jpegQuality: 90,
        pixelFormat: 'yuv420p',
        concurrency: renderConcurrency(),
        logLevel: 'warn',
        offthreadVideoThreads: 1,
      });
    }

    const bytes = await fs.readFile(outputLocation);
    if (bytes.length < 200000) throw new Error('REMOTION_OUTPUT_TOO_SMALL');

    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const day = new Date().toISOString().slice(0, 10);
    const key = 'remotion-drafts/' + day + '/' + id + '.mp4';

    await s3.send(new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: key,
      Body: bytes,
      ContentType: 'video/mp4',
      CacheControl: 'private, no-store',
    }));

    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return {
      ok: true,
      id,
      renderer: youtubeVariant ? 'remotion-oms-premium-voiced-v2' : 'remotion-oms-v1',
      compositionId,
      variant: youtubeVariant ? 'youtube-single-prompt' : 'christian-short',
      mediaUrl: publicBase() + '/media/' + encodedKey,
      masterHash: hash,
      bytes: bytes.length,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationSeconds: voiced?.durationSeconds ?? Number((composition.durationInFrames / composition.fps).toFixed(2)),
      sceneCount: spec.scenes.length,
      captionsPresent: Array.isArray(spec.captions) && spec.captions.length > 0,
      audioPresent: youtubeVariant ? voiced?.audioPresent === true : Boolean(spec.audioUrl),
      voiceover: youtubeVariant ? voiced?.voiceover === true : Boolean(spec.audioUrl),
      narrationPresent: youtubeVariant ? voiced?.narrationPresent === true : Boolean(spec.audioUrl),
      voiceProvider: voiced?.voiceProvider || null,
      voiceName: voiced?.voiceName || null,
      voiceTier: voiced?.voiceTier || null,
      visualTier: spec.visualTier || null,
      graphicsTier: spec.graphicsTier || null,
      maxVolumeDb: voiced?.maxVolumeDb ?? null,
      professionalMasterCandidate: true,
      certification: 'NOT_CERTIFIED',
      publishingAllowed: false,
    };
  } finally {
    activeRender = false;
    await fs.rm(workdir, {recursive: true, force: true}).catch(() => {});
  }
}
