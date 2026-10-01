import {promises as fs} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {renderFrames,selectComposition} from '@remotion/renderer';
import {YOUTUBE_SINGLE_PROMPT_ID,normalizeYoutubeSinglePromptSpec} from './youtube-single-prompt.mjs';
import {validateYoutubePremiumMasterContract} from './premium-master-contract.mjs';

const execFileAsync=promisify(execFile);

async function probe(file){
  const {stdout}=await execFileAsync('ffprobe',[
    '-v','error','-show_entries',
    'format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
    '-of','json',file
  ]);
  return JSON.parse(stdout);
}

async function assertAudible(file){
  let stderr='';
  try{
    const r=await execFileAsync('ffmpeg',[
      '-hide_banner','-nostats','-i',file,'-map','0:a:0',
      '-af','volumedetect','-f','null','-'
    ],{maxBuffer:4*1024*1024});
    stderr=String(r.stderr||'');
  }catch(e){
    stderr=String(e?.stderr||'');
    if(!stderr)throw e;
  }
  const m=stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/i);
  const db=m?Number(m[1]):NaN;
  if(!Number.isFinite(db)||db<-28)throw new Error('PREMIUM_FRASER_AUDIO_INAUDIBLE');
  return db;
}

export async function renderYoutubeVoicedAsset({spec:inputSpec,serveUrl,workdir,outputLocation,onProgress=()=>{}}){
  const spec=normalizeYoutubeSinglePromptSpec(inputSpec);
  validateYoutubePremiumMasterContract(spec);

  const framesDir=path.join(workdir,'frames');
  await fs.mkdir(framesDir,{recursive:true});
  const composition=await selectComposition({
    serveUrl,id:YOUTUBE_SINGLE_PROMPT_ID,inputProps:spec,
    logLevel:'warn',offthreadVideoThreads:1
  });

  await renderFrames({
    composition,serveUrl,outputDir:framesDir,inputProps:spec,
    imageFormat:'jpeg',imageSequencePattern:'frame-[frame].[ext]',
    jpegQuality:92,frameRange:[0,composition.durationInFrames-1],
    concurrency:1,offthreadVideoThreads:1,
    offthreadVideoCacheSizeInBytes:32*1024*1024,
    mediaCacheSizeInBytes:64*1024*1024,
    logLevel:'warn',
    onFrameUpdate:(framesRendered)=>onProgress({
      phase:'frames',
      progress:framesRendered/composition.durationInFrames,
      framesRendered,totalFrames:composition.durationInFrames
    })
  });

  const names=(await fs.readdir(framesDir)).filter(n=>n.endsWith('.jpeg'));
  if(names.length!==composition.durationInFrames)throw new Error('PREMIUM_FRAME_COUNT_MISMATCH');

  await execFileAsync('ffmpeg',[
    '-hide_banner','-loglevel','error',
    '-framerate','30','-start_number','0','-i',path.join(framesDir,'frame-%04d.jpeg'),
    '-i',spec.audioUrl,
    '-map','0:v:0','-map','1:a:0',
    '-c:v','libx264','-threads','1',
    '-x264-params','threads=1:lookahead_threads=1:sliced_threads=0',
    '-preset','slow','-crf','16','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','256k','-ar','48000','-ac','2',
    '-t','59','-movflags','+faststart','-y',outputLocation
  ],{timeout:240000,maxBuffer:8*1024*1024});

  const profile=await probe(outputLocation);
  const video=(profile.streams||[]).find(s=>s.codec_type==='video');
  const audio=(profile.streams||[]).find(s=>s.codec_type==='audio');
  const durationSeconds=Number(profile.format?.duration||0);
  if(!video||video.codec_name!=='h264'||video.width!==1080||video.height!==1920||video.r_frame_rate!=='30/1')
    throw new Error('PREMIUM_FINAL_VIDEO_PROFILE_INVALID');
  if(!audio||audio.codec_name!=='aac'||Number(audio.channels)<2||Number(audio.sample_rate)!==48000)
    throw new Error('PREMIUM_FINAL_AUDIO_PROFILE_INVALID');
  if(durationSeconds<58.9||durationSeconds>59.1)throw new Error('PREMIUM_FINAL_DURATION_INVALID');
  const maxVolumeDb=await assertAudible(outputLocation);

  return {
    composition,spec,durationSeconds,
    audioPresent:true,voiceover:true,narrationPresent:true,
    audioCodec:audio.codec_name,audioChannels:Number(audio.channels),
    audioSampleRate:Number(audio.sample_rate),
    voiceProvider:spec.voiceProvider,voiceName:spec.voiceName,
    voiceId:spec.voiceId,voiceTier:spec.voiceTier,
    visualTier:spec.visualTier,graphicsTier:spec.graphicsTier,
    captionTimingSource:spec.captionTimingSource,
    maxVolumeDb,
  };
}
