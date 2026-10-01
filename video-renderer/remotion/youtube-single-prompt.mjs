export const YOUTUBE_SINGLE_PROMPT_ID = 'OMS-YouTube-Single-Prompt';
export const YOUTUBE_SINGLE_PROMPT_DURATION = 59;
export const YOUTUBE_SINGLE_PROMPT_FPS = 30;
export const YOUTUBE_SINGLE_PROMPT_WIDTH = 1080;
export const YOUTUBE_SINGLE_PROMPT_HEIGHT = 1920;

export const YOUTUBE_SINGLE_PROMPT_NARRATION =
  'Stop shrinking the light God placed in you. Jesus did not call you to disappear. He called you to shine. ' +
  'Fear will tell you to stay quiet, stay comfortable, and stay unseen. Faith says take the next step with Jesus. ' +
  'Matthew five sixteen says, let your light shine before others. Not for applause. Not for attention. Let your life point people to the Father. ' +
  'Pray when nobody is watching. Serve when nobody is clapping. Speak hope when fear is louder. Choose grace when anger would be easier. ' +
  'Your ordinary day can carry the presence of Christ. One act of kindness can restore hope. One faithful word can strengthen someone. ' +
  'One surrendered life can lead another soul toward Jesus. You do not need a platform to shine. You need faithfulness. ' +
  'Let your light shine, and give God all the glory.';

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
    {id:'hook',mode:'impact',start:0,end:5,kicker:'WAKE UP YOUR FAITH',title:'STOP SHRINKING YOUR LIGHT',body:'Jesus did not call you to disappear.',accent:'SHINE'},
    {id:'contrast',mode:'contrast',start:5,end:12,kicker:'THE BATTLE',title:'FEAR SAYS HIDE. FAITH SAYS MOVE.',body:'Take the next step with Jesus.',left:'FEAR: STAY UNSEEN',right:'FAITH: FOLLOW JESUS'},
    {id:'scripture',mode:'scripture',start:12,end:20,kicker:'MATTHEW 5:16',title:'LET YOUR LIGHT SHINE',body:'Let your life point people to the Father.',reference:'MATTHEW 5:16'},
    {id:'pillars',mode:'cards',start:20,end:29,kicker:'NO PERFORMANCE',title:'FAITH THAT CAN BE SEEN',body:'Not applause. Not attention. A life that points to Jesus.',cards:['PRAY','SERVE','SPEAK HOPE']},
    {id:'signal',mode:'signal',start:29,end:38,kicker:'WHEN LIFE GETS LOUD',title:'CHOOSE THE JESUS WAY',body:'Pray. Serve. Speak hope. Choose grace.',chips:['PRAY','SERVE','SPEAK HOPE','CHOOSE GRACE']},
    {id:'steps',mode:'steps',start:38,end:47,kicker:'RIGHT WHERE YOU ARE',title:'YOUR ORDINARY DAY MATTERS',body:'Carry the presence of Christ into ordinary moments.',steps:['RESTORE HOPE','STRENGTHEN FAITH','POINT TO JESUS']},
    {id:'network',mode:'network',start:47,end:55,kicker:'ONE LIFE → ANOTHER',title:'YOUR FAITH CAN LIGHT THE WAY',body:'You do not need a platform. You need faithfulness.'},
    {id:'cta',mode:'cta',start:55,end:59,kicker:'ONE MISSION',title:'LET YOUR LIGHT SHINE',body:'GIVE GOD ALL THE GLORY',accent:'MATTHEW 5:16'},
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
  if(narration.split(/\s+/).filter(Boolean).length<100)throw new Error('Narration is too short');
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
