import { probeFreeProviders } from './free-ai-providers.mjs'

const enabled = process.env.FREE_AI_PROBE_ENABLED !== 'false'

if (enabled) {
  setTimeout(async () => {
    try {
      const result = await probeFreeProviders()
      console.log('FREE_AI_PROVIDER_STATUS', JSON.stringify(result))
    } catch (error) {
      console.error('FREE_AI_PROVIDER_STATUS_ERROR', error instanceof Error ? error.message : String(error))
    }
  }, 2500)
}
