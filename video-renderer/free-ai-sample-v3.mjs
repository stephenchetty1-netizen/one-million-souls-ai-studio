import { renderFreeV2 } from './free-ai-render-v2.mjs'

const enabled = process.env.FREE_AI_V3_SAMPLE_ENABLED === 'true'

if (enabled) {
  const body = {
    title: 'FAITH OVER FEAR',
    script: `Fear may be loud, but God is with you, Isaiah 41:10 reminds us to fear not because He is with us, so keep praying, keep trusting, keep moving forward, choose faith over fear today, fix your eyes on Jesus, take the next faithful step, and remember that this difficult season is not the end of your story.`,
    visualPrompts: [
      'cinematic sunrise over dramatic mountains, open Bible in the foreground on a rock, warm golden rays breaking through clouds, hopeful Christian faith atmosphere, premium realistic photography, rich natural detail, vertical 9:16, no text, no watermark',
      'cinematic close-up of hands resting beside an open Bible near a window at dawn, soft warm sunlight, peaceful prayerful atmosphere, realistic skin and paper detail, shallow depth of field, premium photography, vertical 9:16, no text, no watermark',
      'cinematic silhouette of a person standing on a mountain ridge facing a brilliant sunrise, clouds moving below, hopeful journey of faith, realistic landscape photography, subtle rays of light, vertical 9:16, no text, no watermark',
    ],
  }

  console.log('FREE_AI_V3_SAMPLE_START')
  setTimeout(async () => {
    try {
      const result = await renderFreeV2(body)
      console.log('FREE_AI_V3_SAMPLE_RESULT', JSON.stringify(result))
    } catch (error) {
      console.error('FREE_AI_V3_SAMPLE_FAILED', error instanceof Error ? error.message : String(error))
    }
  }, 6000)
}
