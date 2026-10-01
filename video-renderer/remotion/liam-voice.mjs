import {promises as fs} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {EdgeTTS} from 'node-edge-tts';
import {PREMIUM_LIAM_VOICE,validateEdgeWordCaptions} from './premium-master-contract.mjs';

const execFileAsync=promisify(execFile);

async function durationSeconds(file){
  const {stdout}=await execFileAsync('ffprobe',[
    '-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file
  ],{timeout:30000,maxBuffer:1024*1024});
  const value=Number(String(stdout).trim());
  if(!Number.isFinite(value)||value<=0)throw new Error('LIAM_AUDIO_DURATION_UNREADABLE');
  return value;
}

async function synthesize({narration,audioPath,rate}){
  const tts=new EdgeTTS({
    voice:PREMIUM_LIAM_VOICE.voiceId,
    lang:PREMIUM_LIAM_VOICE.lang,
    outputFormat:'audio-24khz-96kbitrate-mono-mp3',
    saveSubtitles:true,
    pitch:'+0Hz',
    rate,
    volume:'+0%',
    timeout:90000,
  });
  await tts.ttsPromise(narration,audioPath);
  const subtitlesPath=audioPath+'.json';
  const [stat,raw,duration]=await Promise.all([
    fs.stat(audioPath),
    fs.readFile(subtitlesPath,'utf8'),
    durationSeconds(audioPath),
  ]);
  if(stat.size<50000)throw new Error('LIAM_AUDIO_TOO_SMALL');
  const source=JSON.parse(raw);
  if(!Array.isArray(source)||!source.length)throw new Error('LIAM_WORD_BOUNDARIES_MISSING');
  const captions=source.map((item)=>({
    text:String(item?.part||'').trim(),
    startMs:Number(item?.start),
    endMs:Number(item?.end),
  })).filter(x=>x.text);
  return {captions,duration,subtitlesPath};
}

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export async function prepareLiamNarration({narration,workdir}){
  const text=String(narration||'').trim();
  if(text.split(/\s+/).filter(Boolean).length<80)throw new Error('LIAM_NARRATION_TOO_SHORT');
  if(!workdir)throw new Error('LIAM_WORKDIR_REQUIRED');
  await fs.mkdir(workdir,{recursive:true});
  const audioPath=path.join(workdir,'liam-neural.mp3');

  let rate='-4%';
  let result=await synthesize({narration:text,audioPath,rate});
  if(result.duration>58.5||result.duration<47){
    const target=54.5;
    const percent=clamp(Math.round((result.duration/target-1)*100),-18,18);
    rate=(percent>=0?'+':'')+percent+'%';
    await fs.rm(audioPath,{force:true}).catch(()=>{});
    await fs.rm(audioPath+'.json',{force:true}).catch(()=>{});
    result=await synthesize({narration:text,audioPath,rate});
  }

  if(result.duration<45||result.duration>59.05)
    throw new Error('LIAM_AUDIO_DURATION_OUTSIDE_59_SECOND_MASTER: '+result.duration.toFixed(3));
  validateEdgeWordCaptions(result.captions,text);

  return {
    audioPath,
    subtitlesPath:result.subtitlesPath,
    captions:result.captions,
    durationSeconds:Number(result.duration.toFixed(3)),
    rate,
    voiceProvider:PREMIUM_LIAM_VOICE.provider,
    voiceName:PREMIUM_LIAM_VOICE.name,
    voiceId:PREMIUM_LIAM_VOICE.voiceId,
    voiceType:PREMIUM_LIAM_VOICE.voiceType,
    lang:PREMIUM_LIAM_VOICE.lang,
    captionTimingSource:'EDGE_WORD_BOUNDARY_TIMESTAMPS',
  };
}
