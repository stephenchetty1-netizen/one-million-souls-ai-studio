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
import {
  PREMIUM_LIAM_VOICE,
  validateYoutubePremiumMasterContract,
} from './premium-master-contract.mjs';

const renderer=await import('@remotion/renderer');
const bundler=await import('@remotion/bundler');
const captions=await import('@remotion/captions');
const voiced=await import('./youtube-voiced-renderer.mjs');
const liam=await import('./liam-voice.mjs');

assert.equal(typeof renderer.renderMedia,'function');
assert.equal(typeof renderer.renderFrames,'function');
assert.equal(typeof renderer.selectComposition,'function');
assert.equal(typeof bundler.bundle,'function');
assert.equal(typeof captions.createTikTokStyleCaptions,'function');
assert.equal(typeof voiced.renderYoutubeVoicedAsset,'function');
assert.equal(typeof liam.prepareLiamNarration,'function');

assert.equal(validateDirectorSpec(DEFAULT_DIRECTOR_SPEC),true);
const normalized=normalizeDirectorSpec({theme:'Smoke test'});
assert.equal(normalized.scenes.length,8);
assert.equal(normalized.durationSeconds,59);
assert.equal(generateWordCaptions('Jesus gives hope',3000).length,3);

assert.equal(YOUTUBE_SINGLE_PROMPT_ID,'OMS-YouTube-Single-Prompt');
assert.equal(validateYoutubeSinglePromptSpec(YOUTUBE_SINGLE_PROMPT_SPEC),true);
const youtube=normalizeYoutubeSinglePromptSpec({theme:'YouTube prompt smoke'});
assert.equal(youtube.variant,'youtube-single-prompt');
assert.equal(youtube.scenes.length,8);
assert.equal(youtube.durationSeconds,59);
assert.equal(youtube.voiceoverRequired,true);
assert.equal(youtube.visualTier,'PREMIUM_CINEMATIC');
assert.equal(youtube.graphicsTier,'PREMIUM_MOTION');
assert.equal(youtube.voiceTier,'PREMIUM_NEURAL');
assert.ok(String(youtube.narration).split(/\s+/).length>=80);
assert.equal(youtube.captions.length,0);
assert.equal(youtube.captionTimingSource,'UNSET');

assert.throws(()=>validateYoutubeSinglePromptSpec({...youtube,voiceoverRequired:false}),/requires voiceover/);
assert.throws(()=>validateYoutubeSinglePromptSpec({...youtube,voiceTier:'BASIC'}),/Premium neural voice/);
assert.throws(()=>validateYoutubeSinglePromptSpec({...youtube,visualTier:'BASIC'}),/Premium cinematic backgrounds/);
assert.throws(()=>validateYoutubePremiumMasterContract(youtube),/LIAM_NEURAL_VOICE_REQUIRED/);

const authored=String(youtube.narration).trim().split(/\s+/);
let cursor=500;
const timed=authored.map((word)=>{
  const start=cursor;
  const end=start+Math.max(100,Math.round(50000/authored.length));
  cursor=end;
  return {text:word,startMs:start,endMs:end};
});
const scenes=youtube.scenes.map((scene,i)=>({
  ...scene,
  mediaUrl:`https://media.example.test/approved-${i+1}.mp4`,
  mediaSource:'PEXELS_REVIEWED',
  visualReviewStatus:'APPROVED_CHRISTIAN_STORY_FIT',
  sourcePage:`https://www.pexels.com/video/approved-${i+1}-${1000+i}/`,
  sourceWidth:1080,
  sourceHeight:1920,
}));
const master={
  ...youtube,
  voiceProvider:PREMIUM_LIAM_VOICE.provider,
  voiceName:PREMIUM_LIAM_VOICE.name,
  voiceId:PREMIUM_LIAM_VOICE.voiceId,
  voiceType:PREMIUM_LIAM_VOICE.voiceType,
  audioTimelinePrepared:true,
  audioDurationSeconds:50.5,
  captionTimingSource:'EDGE_WORD_BOUNDARY_TIMESTAMPS',
  captions:timed,
  scenes,
};
assert.equal(validateYoutubePremiumMasterContract(master),true);
assert.throws(()=>validateYoutubePremiumMasterContract({...master,voiceName:'Other'}),/LIAM_NEURAL_VOICE_REQUIRED/);
assert.throws(()=>validateYoutubePremiumMasterContract({...master,captionTimingSource:'ESTIMATED'}),/EDGE_WORD_BOUNDARY_CAPTION_SOURCE_REQUIRED/);
assert.throws(()=>validateYoutubePremiumMasterContract({...master,captions:timed.slice(0,-1)}),/CAPTION_WORD_COUNT_MISMATCH/);
assert.throws(()=>validateYoutubePremiumMasterContract({
  ...master,
  scenes:master.scenes.map((s,i)=>i===0?{...s,visualReviewStatus:'AWAITING_SOURCE_VISUAL_REVIEW'}:s)
}),/PREMIUM_SCENE_HUMAN_REVIEW_REQUIRED/);

const here=path.dirname(fileURLToPath(import.meta.url));
const serveUrl=await bundler.bundle({
  entryPoint:path.join(here,'index.jsx'),
  onProgress:()=>{},
});
assert.ok(serveUrl);

console.log('Remotion OMS Liam native-word-boundary smoke test passed');
