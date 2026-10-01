import {generateWordCaptions} from './director-spec.mjs';

export const YOUTUBE_SINGLE_PROMPT_ID = 'OMS-YouTube-Single-Prompt';
export const YOUTUBE_SINGLE_PROMPT_DURATION = 59;
export const YOUTUBE_SINGLE_PROMPT_FPS = 30;
export const YOUTUBE_SINGLE_PROMPT_WIDTH = 1080;
export const YOUTUBE_SINGLE_PROMPT_HEIGHT = 1920;

export const YOUTUBE_SINGLE_PROMPT_NARRATION =
  'Stop hiding the light God placed in you. Jesus said, let your light shine before others, so that they may see your good works and give glory to your Father in heaven. ' +
  'Matthew 5:16 is not a call to perform for attention. It is a call to live so close to Jesus that His love becomes visible through you. ' +
  'When fear tells you to stay quiet, take the next faithful step. Pray when no one sees. Serve when no one applauds. Speak life when negativity is easier. Show grace when anger feels justified. ' +
  'Your ordinary day can become a signpost to Christ. One act of kindness can awaken hope. One courageous word can strengthen faith. One surrendered life can point another soul to Jesus. ' +
  'You do not have to be famous to shine. You only have to be faithful. Let your light shine, and let God receive the glory.';

export const YOUTUBE_SINGLE_PROMPT_SPEC = {
  variant: 'youtube-single-prompt',
  durationSeconds: 59,
  brand: 'ONE MILLION SOULS',
  theme: 'Let Your Light Shine',
  scripture: 'Matthew 5:16',
  narration: YOUTUBE_SINGLE_PROMPT_NARRATION,
  voiceoverRequired: true,
  visualTier: 'PREMIUM_CINEMATIC',
  graphicsTier: 'PREMIUM_MOTION',
  voiceTier: 'PREMIUM_NEURAL',
  audioUrl: null,
  scenes: [
    {id:'hook',mode:'impact',start:0,end:4,kicker:"DON'T SCROLL PAST THIS",title:'STOP HIDING YOUR LIGHT',body:'What God placed in you was never meant to stay buried.',accent:'LIGHT'},
    {id:'contrast',mode:'contrast',start:4,end:10,kicker:'THE PRESSURE',title:'THE WORLD IS LOUD',body:'Fear says stay small. Faith says keep following Jesus.',left:'FEAR: STAY QUIET',right:'FAITH: TAKE THE NEXT STEP'},
    {id:'scripture',mode:'scripture',start:10,end:18,kicker:'SCRIPTURE',title:'LET YOUR LIGHT SHINE',body:'Matthew 5:16',reference:'MATTHEW 5:16'},
    {id:'pillars',mode:'cards',start:18,end:27,kicker:'WHAT IT LOOKS LIKE',title:'FAITH YOU CAN SEE',body:'Not performance. Not hype. A life that points to Jesus.',cards:['KINDNESS','COURAGE','TRUTH']},
    {id:'signal',mode:'signal',start:27,end:36,kicker:'WHEN FEAR SPEAKS',title:'DO THE FAITHFUL THING',body:'You do not need the whole plan to obey the next step.',chips:['PRAY','SERVE','SPEAK LIFE','SHOW GRACE']},
    {id:'steps',mode:'steps',start:36,end:45,kicker:'TODAY',title:'YOUR ORDINARY DAY MATTERS',body:'Small acts of faith can become signposts to Jesus.',steps:['NOTICE SOMEONE','HELP SOMEONE','POINT TO JESUS']},
    {id:'network',mode:'network',start:45,end:54,kicker:'ONE LIGHT → ANOTHER',title:'YOUR FAITH CAN ENCOURAGE SOMEONE ELSE',body:'Shine with humility. Let God receive the glory.'},
    {id:'cta',mode:'cta',start:54,end:59,kicker:'ONE MISSION',title:'LET YOUR LIGHT SHINE',body:'ONE MILLION SOULS • JESUS',accent:'MATTHEW 5:16'},
  ],
  captions: generateWordCaptions(YOUTUBE_SINGLE_PROMPT_NARRATION, 59000),
};

export function validateYoutubeSinglePromptSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('YouTube prompt spec must be an object');
  if (!Array.isArray(spec.scenes) || spec.scenes.length !== 8) throw new Error('YouTube prompt spec requires exactly 8 scenes');
  if (Number(spec.durationSeconds) !== 59) throw new Error('YouTube prompt composition must be exactly 59 seconds');
  if (spec.voiceoverRequired !== true) throw new Error('YouTube prompt composition requires voiceover');
  if (spec.visualTier !== 'PREMIUM_CINEMATIC') throw new Error('Premium cinematic backgrounds are required');
  if (spec.graphicsTier !== 'PREMIUM_MOTION') throw new Error('Premium motion graphics are required');
  if (spec.voiceTier !== 'PREMIUM_NEURAL') throw new Error('Premium neural voice is required');
  const narration = String(spec.narration || '').trim();
  const words = narration.split(/\s+/).filter(Boolean);
  if (words.length < 110) throw new Error('YouTube prompt narration is too short for a 59-second voiced master');
  const modes = new Set(['impact','contrast','scripture','cards','signal','steps','network','cta']);
  let cursor = 0;
  for (const scene of spec.scenes) {
    const start = Number(scene.start);
    const end = Number(scene.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Every YouTube prompt scene requires valid timing');
    if (Math.abs(start - cursor) > 0.02) throw new Error('YouTube prompt scenes must be contiguous');
    if (!modes.has(scene.mode)) throw new Error('Unsupported YouTube prompt scene mode');
    if (!scene.title) throw new Error('Every YouTube prompt scene requires a title');
    cursor = end;
  }
  if (Math.abs(cursor - 59) > 0.02) throw new Error('YouTube prompt scenes must end at 59 seconds');
  return true;
}

export function normalizeYoutubeSinglePromptSpec(input = {}) {
  const merged = {
    ...YOUTUBE_SINGLE_PROMPT_SPEC,
    ...input,
    variant: 'youtube-single-prompt',
    voiceoverRequired: true,
    visualTier: 'PREMIUM_CINEMATIC',
    graphicsTier: 'PREMIUM_MOTION',
    voiceTier: 'PREMIUM_NEURAL',
    narration: String(input.narration || YOUTUBE_SINGLE_PROMPT_NARRATION).trim(),
    scenes: Array.isArray(input.scenes) ? input.scenes : YOUTUBE_SINGLE_PROMPT_SPEC.scenes,
  };
  merged.captions = Array.isArray(input.captions)
    ? input.captions
    : generateWordCaptions(merged.narration, 59000);
  validateYoutubeSinglePromptSpec(merged);
  return merged;
}
