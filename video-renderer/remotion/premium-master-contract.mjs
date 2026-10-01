const HTTPS=/^https:\/\//i;
const FRASER_ID='6705e465-7b52-5915-a1d8-b1222885e01d';

const cleanWords=(text)=>String(text||'')
  .toLowerCase()
  .replace(/[’']/g,'')
  .replace(/[^a-z0-9]+/g,' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export const PREMIUM_FRASER_VOICE=Object.freeze({
  provider:'HIGGSFIELD_ELEVENLABS',
  name:'Fraser',
  voiceId:FRASER_ID,
  voiceType:'preset',
});

export function validateWhisperWordCaptions(captions,narration){
  if(!Array.isArray(captions)||captions.length<40)
    throw new Error('WHISPER_WORD_TIMESTAMPS_REQUIRED');
  let lastStart=-1;
  let lastEnd=-1;
  for(const c of captions){
    const text=String(c?.text||'').trim();
    const start=Number(c?.startMs);
    const end=Number(c?.endMs);
    if(!text||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)
      throw new Error('WHISPER_WORD_TIMING_INVALID');
    if(start<lastStart||end<lastEnd)
      throw new Error('WHISPER_WORD_TIMING_NOT_MONOTONIC');
    if(end>59050)throw new Error('WHISPER_WORD_TIMING_EXCEEDS_MASTER');
    lastStart=start; lastEnd=end;
  }
  const authored=cleanWords(narration);
  const timed=cleanWords(captions.map(x=>x.text).join(' '));
  if(authored.length!==timed.length)
    throw new Error('CAPTION_WORD_COUNT_MISMATCH');
  for(let i=0;i<authored.length;i++){
    if(authored[i]!==timed[i])
      throw new Error('CAPTION_WORDS_DO_NOT_MATCH_NARRATION');
  }
  return true;
}

export function validateReviewedPremiumScenes(scenes){
  if(!Array.isArray(scenes)||scenes.length!==8)
    throw new Error('EIGHT_PREMIUM_SCENES_REQUIRED');
  const urls=new Set();
  for(const scene of scenes){
    if(!HTTPS.test(String(scene?.mediaUrl||'')))
      throw new Error('PREMIUM_SCENE_MEDIA_URL_REQUIRED');
    if(scene?.mediaSource!=='PEXELS_REVIEWED')
      throw new Error('PREMIUM_SCENE_REVIEWED_PEXELS_REQUIRED');
    if(scene?.visualReviewStatus!=='APPROVED_CHRISTIAN_STORY_FIT')
      throw new Error('PREMIUM_SCENE_HUMAN_REVIEW_REQUIRED');
    if(!/^https:\/\/www\.pexels\.com\/video\//.test(String(scene?.sourcePage||'')))
      throw new Error('PREMIUM_SCENE_PEXELS_PROVENANCE_REQUIRED');
    if(Number(scene?.sourceWidth)<1080||Number(scene?.sourceHeight)<1920)
      throw new Error('PREMIUM_SCENE_NATIVE_PORTRAIT_REQUIRED');
    urls.add(scene.mediaUrl);
  }
  if(urls.size<8)throw new Error('PREMIUM_SCENES_MUST_BE_DISTINCT');
  return true;
}

export function validateYoutubePremiumMasterContract(spec){
  if(!spec||typeof spec!=='object')throw new Error('PREMIUM_MASTER_SPEC_REQUIRED');
  if(spec.voiceProvider!==PREMIUM_FRASER_VOICE.provider||
     spec.voiceName!==PREMIUM_FRASER_VOICE.name||
     spec.voiceId!==PREMIUM_FRASER_VOICE.voiceId||
     spec.voiceType!==PREMIUM_FRASER_VOICE.voiceType)
    throw new Error('FRASER_PREMIUM_VOICE_REQUIRED');
  if(spec.captionTimingSource!=='WHISPER_WORD_TIMESTAMPS')
    throw new Error('WHISPER_CAPTION_SOURCE_REQUIRED');
  if(spec.audioTimelinePrepared!==true)
    throw new Error('MEASURED_AUDIO_TIMELINE_REQUIRED');
  if(!HTTPS.test(String(spec.audioUrl||'')))
    throw new Error('FRASER_AUDIO_URL_REQUIRED');
  if(spec.visualTier!=='PREMIUM_CINEMATIC'||spec.graphicsTier!=='PREMIUM_MOTION')
    throw new Error('PREMIUM_VISUAL_GRAPHICS_TIER_REQUIRED');
  validateWhisperWordCaptions(spec.captions,spec.narration);
  validateReviewedPremiumScenes(spec.scenes);
  return true;
}
