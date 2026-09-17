import { renderFreeV2 } from './free-ai-render-v2.mjs'

const enabled = process.env.FREE_AI_V3_SAMPLE_ENABLED === 'true'

if (enabled) {
  const body = {
    title: 'FAITH OVER FEAR',
    script: `Fear may be loud, but God is with you. Isaiah 41:10 reminds us: Fear thou not; for I am with thee. You may not know what tomorrow holds, but you can know Who holds you. Keep praying. Keep trusting. Keep moving forward. God has not abandoned you in the waiting, and this difficult season is not the end of your story. Today, choose faith over fear. Fix your eyes on Jesus, take the next faithful step, and remember that the Lord is with you wherever you go. If you believe God is still working in your life, keep the faith and encourage someone else today.`,
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
