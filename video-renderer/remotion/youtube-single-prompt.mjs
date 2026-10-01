import {generateWordCaptions} from './director-spec.mjs';

export const YOUTUBE_SINGLE_PROMPT_ID = 'OMS-YouTube-Single-Prompt';
export const YOUTUBE_SINGLE_PROMPT_DURATION = 59;
export const YOUTUBE_SINGLE_PROMPT_FPS = 30;
export const YOUTUBE_SINGLE_PROMPT_WIDTH = 1080;
export const YOUTUBE_SINGLE_PROMPT_HEIGHT = 1920;

const narration =
  'Stop hiding the light God placed in you. Jesus calls His followers to live in a way that points people back to the Father. ' +
  'Matthew 5:16 is not about performing for attention. It is about a life of faith that can be seen in kindness, courage and truth. ' +
  'When fear tells you to stay quiet, choose the next faithful step. Pray. Serve. Speak life. Show grace. ' +
  'Your ordinary day can become a signpost to Jesus. One light can encourage another. Let your light shine.';

export const YOUTUBE_SINGLE_PROMPT_SPEC = {
  variant: 'youtube-single-prompt',
  durationSeconds: 59,
  brand: 'ONE MILLION SOULS',
  theme: 'Let Your Light Shine',
  scripture: 'Matthew 5:16',
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
  captions: generateWordCaptions(narration, 59000),
};

export function validateYoutubeSinglePromptSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('YouTube prompt spec must be an object');
  if (!Array.isArray(spec.scenes) || spec.scenes.length !== 8) throw new Error('YouTube prompt spec requires exactly 8 scenes');
  if (Number(spec.durationSeconds) !== 59) throw new Error('YouTube prompt composition must be exactly 59 seconds');
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
    scenes: Array.isArray(input.scenes) ? input.scenes : YOUTUBE_SINGLE_PROMPT_SPEC.scenes,
    captions: Array.isArray(input.captions) ? input.captions : YOUTUBE_SINGLE_PROMPT_SPEC.captions,
  };
  validateYoutubeSinglePromptSpec(merged);
  return merged;
}
