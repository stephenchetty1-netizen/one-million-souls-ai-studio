export const YOUTUBE_SINGLE_PROMPT_ID = 'OMS-YouTube-Single-Prompt';
export const YOUTUBE_SINGLE_PROMPT_DURATION = 59;
export const YOUTUBE_SINGLE_PROMPT_FPS = 30;
export const YOUTUBE_SINGLE_PROMPT_WIDTH = 1080;
export const YOUTUBE_SINGLE_PROMPT_HEIGHT = 1920;

export const YOUTUBE_SINGLE_PROMPT_NARRATION =
  'Stop hiding your light. Jesus calls you to shine. ' +
  'Fear says stay small, but faith takes the next step even when it is hard. ' +
  'Matthew five sixteen says let your light shine before others, so your life points people back to the Father. ' +
  'This is not performance for attention; it is kindness, courage and truth made visible through a life surrendered to Jesus. ' +
  'When fear speaks, pray first, serve someone, speak life over them, and choose grace instead of anger. ' +
  'Your ordinary day matters; notice the person beside you, help where you can, and make Jesus visible through love. ' +
  'One faithful act can awaken hope, one courageous word can strengthen faith, and one light can encourage another. ' +
  'Be faithful, let your light shine, and give God the glory.';

export const YOUTUBE_SINGLE_PROMPT_SPEC = {
  variant:'youtube-single-prompt',
  durationSeconds:59,
  brand:'ONE MILLION SOULS',
  theme:'Let Your Light Shine',
  scripture:'Matthew 5:16',
  narration:YOUTUBE_SINGLE_PROMPT_NARRATION,
  voiceoverRequired:true,
  visualTier:'PREMIUM_CINEMATIC',
  graphicsTier:'PREMIUM_MOTION',
  voiceTier:'PREMIUM_NEURAL',
  voiceProvider:null,
  voiceName:null,
  voiceId:null,
  voiceType:null,
  captionTimingSource:'UNSET',
  audioTimelinePrepared:false,
  audioUrl:null,
  scenes:[
    {id:'hook',mode:'impact',start:0,end:4,kicker:"DON'T SCROLL PAST THIS",title:'STOP HIDING YOUR LIGHT',body:'Jesus calls you to shine.',accent:'LIGHT'},
    {id:'contrast',mode:'contrast',start:4,end:10,kicker:'THE PRESSURE',title:'FEAR VS FAITH',body:'Fear says stay small. Faith takes the next step.',left:'FEAR: STAY SMALL',right:'FAITH: TAKE THE NEXT STEP'},
    {id:'scripture',mode:'scripture',start:10,end:18,kicker:'SCRIPTURE',title:'LET YOUR LIGHT SHINE',body:'Matthew 5:16',reference:'MATTHEW 5:16'},
    {id:'pillars',mode:'cards',start:18,end:27,kicker:'VISIBLE FAITH',title:'KINDNESS • COURAGE • TRUTH',body:'A life surrendered to Jesus.',cards:['KINDNESS','COURAGE','TRUTH']},
    {id:'signal',mode:'signal',start:27,end:36,kicker:'WHEN FEAR SPEAKS',title:'DO THE FAITHFUL THING',body:'Pray. Serve. Speak life. Choose grace.',chips:['PRAY','SERVE','SPEAK LIFE','CHOOSE GRACE']},
    {id:'steps',mode:'steps',start:36,end:45,kicker:'TODAY',title:'YOUR ORDINARY DAY MATTERS',body:'Make Jesus visible through love.',steps:['NOTICE','HELP','LOVE']},
    {id:'network',mode:'network',start:45,end:54,kicker:'ONE LIGHT → ANOTHER',title:'FAITH AWAKENS HOPE',body:'One courageous word can strengthen faith.'},
    {id:'cta',mode:'cta',start:54,end:59,kicker:'ONE MISSION',title:'LET YOUR LIGHT SHINE',body:'GIVE GOD THE GLORY',accent:'MATTHEW 5:16'},
  ],
  captions:[],
};

export function validateYoutubeSinglePromptSpec(spec){
  if(!spec||typeof spec!=='object')throw new Error('YouTube prompt spec must be an object');
  if(!Array.isArray(spec.scenes)||spec.scenes.length!==8)throw new Error('YouTube prompt spec requires exactly 8 scenes');
  if(Number(spec.durationSeconds)!==59)throw new Error('YouTube prompt composition must be exactly 59 seconds');
  if(spec.voiceoverRequired!==true)throw new Error('YouTube prompt composition requires voiceover');
  if(spec.visualTier!=='PREMIUM_CINEMATIC')throw new Error('Premium cinematic backgrounds are required');
  if(spec.graphicsTier!=='PREMIUM_MOTION')throw new Error('Premium motion graphics are required');
  if(spec.voiceTier!=='PREMIUM_NEURAL')throw new Error('Premium neural voice is required');
  const narration=String(spec.narration||'').trim();
  if(narration.split(/\s+/).filter(Boolean).length<80)throw new Error('Narration is too short');
  const modes=new Set(['impact','contrast','scripture','cards','signal','steps','network','cta']);
  let cursor=0;
  for(const scene of spec.scenes){
    const start=Number(scene.start),end=Number(scene.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Every scene requires valid timing');
    if(Math.abs(start-cursor)>0.02)throw new Error('Scenes must be contiguous');
    if(!modes.has(scene.mode))throw new Error('Unsupported scene mode');
    if(!scene.title)throw new Error('Every scene requires a title');
    cursor=end;
  }
  if(Math.abs(cursor-59)>0.02)throw new Error('Scenes must end at 59 seconds');
  return true;
}

export function normalizeYoutubeSinglePromptSpec(input={}){
  const merged={
    ...YOUTUBE_SINGLE_PROMPT_SPEC,
    ...input,
    variant:'youtube-single-prompt',
    voiceoverRequired:true,
    visualTier:'PREMIUM_CINEMATIC',
    graphicsTier:'PREMIUM_MOTION',
    voiceTier:'PREMIUM_NEURAL',
    narration:String(input.narration||YOUTUBE_SINGLE_PROMPT_NARRATION).trim(),
    scenes:Array.isArray(input.scenes)?input.scenes:YOUTUBE_SINGLE_PROMPT_SPEC.scenes,
    captions:Array.isArray(input.captions)?input.captions:[],
  };
  validateYoutubeSinglePromptSpec(merged);
  return merged;
}
