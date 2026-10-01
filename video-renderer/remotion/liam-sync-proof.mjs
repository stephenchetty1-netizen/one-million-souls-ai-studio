import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {YOUTUBE_SINGLE_PROMPT_NARRATION} from './youtube-single-prompt.mjs';
import {prepareLiamNarration} from './liam-voice.mjs';

const work=await fs.mkdtemp(path.join(os.tmpdir(),'oms-liam-proof-'));
try{
  const result=await prepareLiamNarration({
    narration:YOUTUBE_SINGLE_PROMPT_NARRATION,
    workdir:work,
  });
  console.log('OMS_LIAM_SYNC_PROOF',JSON.stringify({
    voiceProvider:result.voiceProvider,
    voiceName:result.voiceName,
    voiceId:result.voiceId,
    lang:result.lang,
    rate:result.rate,
    durationSeconds:result.durationSeconds,
    wordBoundaries:result.captions.length,
    firstBoundary:result.captions[0],
    lastBoundary:result.captions[result.captions.length-1],
    captionTimingSource:result.captionTimingSource,
    exactNarrationBoundaryValidation:true,
    publishingAllowed:false,
  }));
} finally {
  await fs.rm(work,{recursive:true,force:true}).catch(()=>{});
}
