export type MetricoolProvider = 'tiktok' | 'youtube'

export type MetricoolScheduleInput = {
  dateTime: string
  timezone: string
  text: string
  mediaUrl: string
  title: string
  hashtags: string[]
  platformPackages?: { tiktok?: { title: string; caption: string; hashtags: string[] }; youtube?: { title: string; caption: string; hashtags: string[] } }
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured on the server.`)
  return value
}

export async function scheduleMetricoolPost(input: MetricoolScheduleInput) {
  const userId = required('METRICOOL_USER_ID')
  const blogId = required('METRICOOL_BLOG_ID')
  const token = required('METRICOOL_API_TOKEN')
  const baseUrl = process.env.METRICOOL_API_BASE_URL || 'https://app.metricool.com/api'

  const body = {
    publicationDate: { dateTime: input.dateTime, timezone: input.timezone },
    text: input.platformPackages?.tiktok?.caption || input.text,
    providers: [{ network: 'tiktok' }, { network: 'youtube' }],
    autoPublish: true,
    draft: false,
    shortener: false,
    media: [input.mediaUrl],
    saveExternalMediaFiles: true,
    youtubeData: {
      title: input.platformPackages?.youtube?.title || input.title,
      type: 'short',
      privacy: process.env.YOUTUBE_PRIVACY || 'public',
      tags: input.platformPackages?.youtube?.hashtags || input.hashtags,
      madeForKids: false,
      isAiGeneratedContent: true,
    },
    tiktokData: {
      title: input.platformPackages?.tiktok?.title || input.title,
      privacyOption: process.env.TIKTOK_PRIVACY || 'PUBLIC_TO_EVERYONE',
      isAigc: true,
      disableComment: false,
      disableDuet: false,
      disableStitch: false,
      commercialContentThirdParty: false,
      commercialContentOwnBrand: false,
      autoAddMusic: false,
    },
    instagramData: undefined,
    facebookData: undefined,
    twitterData: undefined,
    linkedinData: undefined,
    pinterestData: undefined,
    blueskyData: undefined,
    threadsData: undefined,
    gmbData: undefined,
  }

  const response = await fetch(`${baseUrl}/v2/scheduler/posts?blogId=${encodeURIComponent(blogId)}&userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mc-Auth': token,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) throw new Error(`Metricool scheduling failed (${response.status}): ${text}`)
  try { return JSON.parse(text) } catch { return { raw: text } }
}
