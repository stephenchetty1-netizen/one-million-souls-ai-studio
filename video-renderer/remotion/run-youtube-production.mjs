import {renderOmsRemotionDraft} from './service.mjs';
import {YOUTUBE_SINGLE_PROMPT_SPEC} from './youtube-single-prompt.mjs';

const startedAt = new Date().toISOString();
console.log('OMS_YOUTUBE_FULL_RENDER_START', JSON.stringify({
  startedAt,
  compositionId: 'OMS-YouTube-Single-Prompt',
  durationSeconds: 59,
  publishingAllowed: false,
}));

const result = await renderOmsRemotionDraft({
  ...YOUTUBE_SINGLE_PROMPT_SPEC,
  variant: 'youtube-single-prompt',
});

console.log('OMS_YOUTUBE_FULL_RENDER_RESULT', JSON.stringify(result));
if (!result?.ok || result?.durationSeconds !== 59 || result?.width !== 1080 || result?.height !== 1920 || result?.fps !== 30) {
  throw new Error('OMS_YOUTUBE_FULL_RENDER_VERIFICATION_FAILED');
}
