import {promises as fs} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {renderFrames, selectComposition} from '@remotion/renderer';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  normalizeYoutubeSinglePromptSpec,
} from './youtube-single-prompt.mjs';

const execFileAsync = promisify(execFile);

async function probe(file) {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v','error',
    '-show_entries','format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
    '-of','json',
    file,
  ]);
  return JSON.parse(stdout);
}

async function generatePremiumVoice(narration, workdir) {
  const voice = path.join(workdir, 'premium-narration.mp3');
  const cli = path.join(process.cwd(), 'node_modules', '.bin', 'node-edge-tts');
  const voiceName = process.env.EDGE_TTS_VOICE || 'en-ZA-LeahNeural';
  if (/espeak|robot|sam/i.test(voiceName)) throw new Error('LOW_QUALITY_VOICE_REJECTED');
  const lang = process.env.EDGE_TTS_LANG || 'en-ZA';
  const rate = process.env.EDGE_TTS_RATE || '-4%';
  const timeout = Number(process.env.EDGE_TTS_TIMEOUT || '90000');

  await execFileAsync(cli, [
    '-t', narration,
    '-f', voice,
    '-v', voiceName,
    '-l', lang,
    `--rate=${rate}`,
    '--timeout', String(timeout),
  ], {timeout: timeout + 20000, maxBuffer: 5 * 1024 * 1024});

  const stat = await fs.stat(voice);
  if (stat.size < 10000) throw new Error('PREMIUM_VOICEOVER_FILE_INVALID');

  const profile = await probe(voice);
  const audio = (profile.streams || []).find((stream) => stream.codec_type === 'audio');
  const duration = Number(profile.format?.duration || 0);
  if (!audio || !Number.isFinite(duration) || duration <= 10) {
    throw new Error('PREMIUM_VOICEOVER_NOT_GENERATED');
  }
  return {
    file: voice,
    duration,
    provider: `Edge neural TTS (${voiceName})`,
    voiceName,
    tier: 'PREMIUM_NEURAL',
  };
}

async function assertAudible(file) {
  let stderr = '';
  try {
    const result = await execFileAsync('ffmpeg', [
      '-hide_banner','-nostats','-i',file,
      '-map','0:a:0',
      '-af','volumedetect',
      '-f','null','-',
    ], {maxBuffer: 4 * 1024 * 1024});
    stderr = String(result.stderr || '');
  } catch (error) {
    stderr = String(error?.stderr || '');
    if (!stderr) throw error;
  }
  const match = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/i);
  const maxVolume = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(maxVolume) || maxVolume < -35) {
    throw new Error('PREMIUM_VOICEOVER_SILENT_OR_INAUDIBLE');
  }
  return maxVolume;
}

export async function renderYoutubeVoicedAsset({
  spec: inputSpec,
  serveUrl,
  workdir,
  outputLocation,
  onProgress = () => {},
}) {
  const spec = normalizeYoutubeSinglePromptSpec(inputSpec);
  if (spec.visualTier !== 'PREMIUM_CINEMATIC' || spec.graphicsTier !== 'PREMIUM_MOTION' || spec.voiceTier !== 'PREMIUM_NEURAL') {
    throw new Error('PREMIUM_MEDIA_TIER_REQUIRED');
  }

  const framesDir = path.join(workdir, 'frames');
  await fs.mkdir(framesDir, {recursive: true});

  const voice = await generatePremiumVoice(spec.narration, workdir);
  const targetVoiceSeconds = 55.5;
  const tempo = voice.duration / targetVoiceSeconds;
  if (tempo < 0.75 || tempo > 1.35) {
    throw new Error('PREMIUM_NARRATION_REWRITE_REQUIRED_FOR_NATURAL_PACING:' + voice.duration.toFixed(2));
  }

  const composition = await selectComposition({
    serveUrl,
    id: YOUTUBE_SINGLE_PROMPT_ID,
    inputProps: spec,
    logLevel: 'warn',
    offthreadVideoThreads: 1,
  });

  await renderFrames({
    composition,
    serveUrl,
    outputDir: framesDir,
    inputProps: spec,
    imageFormat: 'jpeg',
    imageSequencePattern: 'frame-[frame].[ext]',
    jpegQuality: 86,
    frameRange: [0, composition.durationInFrames - 1],
    concurrency: 1,
    offthreadVideoThreads: 1,
    offthreadVideoCacheSizeInBytes: 16 * 1024 * 1024,
    mediaCacheSizeInBytes: 16 * 1024 * 1024,
    logLevel: 'warn',
    onFrameUpdate: (framesRendered) => {
      onProgress({
        phase: 'frames',
        progress: framesRendered / composition.durationInFrames,
        framesRendered,
        totalFrames: composition.durationInFrames,
      });
    },
  });

  const names = (await fs.readdir(framesDir)).filter((name) => name.endsWith('.jpeg'));
  if (names.length !== composition.durationInFrames) {
    throw new Error('PREMIUM_FRAME_COUNT_MISMATCH:' + names.length);
  }

  const filter = [
    `[1:a]atempo=${tempo.toFixed(6)}`,
    'adelay=650:all=1',
    'loudnorm=I=-16:LRA=7:TP=-1.5',
    'apad=whole_dur=59',
    'atrim=duration=59',
    'aresample=48000[a]',
  ].join(',');

  await execFileAsync('ffmpeg', [
    '-hide_banner','-loglevel','error',
    '-framerate','30',
    '-start_number','0',
    '-i',path.join(framesDir, 'frame-%04d.jpeg'),
    '-i',voice.file,
    '-filter_complex',filter,
    '-map','0:v:0',
    '-map','[a]',
    '-c:v','libx264',
    '-threads','1',
    '-x264-params','threads=1:lookahead_threads=1:sliced_threads=0',
    '-preset','veryfast',
    '-crf','19',
    '-pix_fmt','yuv420p',
    '-c:a','aac',
    '-b:a','192k',
    '-ar','48000',
    '-ac','2',
    '-t','59',
    '-movflags','+faststart',
    '-y',
    outputLocation,
  ], {maxBuffer: 4 * 1024 * 1024});

  const profile = await probe(outputLocation);
  const video = (profile.streams || []).find((stream) => stream.codec_type === 'video');
  const audio = (profile.streams || []).find((stream) => stream.codec_type === 'audio');
  const durationSeconds = Number(profile.format?.duration || 0);

  if (!video || video.codec_name !== 'h264') throw new Error('PREMIUM_FINAL_VIDEO_STREAM_INVALID');
  if (video.width !== 1080 || video.height !== 1920) throw new Error('PREMIUM_FINAL_DIMENSIONS_INVALID');
  if (video.r_frame_rate !== '30/1') throw new Error('PREMIUM_FINAL_FPS_INVALID');
  if (!audio) throw new Error('PREMIUM_FINAL_VOICEOVER_MISSING');
  if (audio.codec_name !== 'aac') throw new Error('PREMIUM_FINAL_AUDIO_CODEC_INVALID');
  if (Number(audio.channels || 0) < 2) throw new Error('PREMIUM_FINAL_AUDIO_CHANNELS_INVALID');
  if (durationSeconds < 58.9 || durationSeconds > 59.1) throw new Error('PREMIUM_FINAL_DURATION_INVALID');

  const maxVolumeDb = await assertAudible(outputLocation);

  return {
    composition,
    spec,
    durationSeconds,
    audioPresent: true,
    voiceover: true,
    narrationPresent: true,
    audioCodec: audio.codec_name,
    audioChannels: Number(audio.channels || 0),
    audioSampleRate: Number(audio.sample_rate || 0),
    voiceProvider: voice.provider,
    voiceName: voice.voiceName,
    voiceTier: voice.tier,
    visualTier: spec.visualTier,
    graphicsTier: spec.graphicsTier,
    voiceSourceDurationSeconds: Number(voice.duration.toFixed(3)),
    voiceTargetDurationSeconds: targetVoiceSeconds,
    voiceTempo: Number(tempo.toFixed(6)),
    maxVolumeDb,
  };
}
