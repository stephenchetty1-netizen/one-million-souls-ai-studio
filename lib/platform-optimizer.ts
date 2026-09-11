export type PlatformPackage = {
  platform: 'tiktok' | 'youtube'
  title: string
  caption: string
  hashtags: string[]
}

const STOP_WORDS = new Set(['the','and','for','with','that','this','from','your','you','are','was','will','have','has','but','when','what','how','why','into','about','just'])

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function uniqueHashtags(tags: string[]) {
  const seen = new Set<string>()
  return tags
    .map(x => x.trim().replace(/\s+/g, ''))
    .filter(Boolean)
    .map(x => x.startsWith('#') ? x : `#${x}`)
    .filter(x => {
      const key = x.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 10)
}

function fallbackHashtags(topic: string) {
  const words = topic.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x.length > 3 && !STOP_WORDS.has(x))
  return uniqueHashtags(['Jesus', 'Bible', 'ChristianTikTok', 'Faith', ...words.slice(0, 3)])
}

function titleCaseFallback(title: string) {
  const value = clean(title)
  return value || 'Jesus Is With You'
}

export function optimizeForPlatforms(input: {
  title: string
  caption: string
  hashtags: string[]
  topic?: string
}): { tiktok: PlatformPackage; youtube: PlatformPackage } {
  const title = titleCaseFallback(input.title)
  const hashtags = uniqueHashtags(input.hashtags.length ? input.hashtags : fallbackHashtags(input.topic || title))
  const caption = clean(input.caption)
  const tiktokTitle = title.slice(0, 90).trim()
  const youtubeTitle = title.slice(0, 100).trim()
  const tiktokCaption = clean(`${caption}\n\n${hashtags.join(' ')}`)
  const youtubeCaption = clean(`${caption}\n\n${hashtags.join(' ')}`)

  return {
    tiktok: { platform: 'tiktok', title: tiktokTitle, caption: tiktokCaption, hashtags },
    youtube: { platform: 'youtube', title: youtubeTitle, caption: youtubeCaption, hashtags },
  }
}

export function validatePlatformPackages(packages: { tiktok: PlatformPackage; youtube: PlatformPackage }) {
  const errors: string[] = []
  for (const platform of ['tiktok', 'youtube'] as const) {
    const item = packages[platform]
    if (!item.title) errors.push(`${platform}: missing title`)
    if (!item.caption) errors.push(`${platform}: missing caption`)
    if (item.hashtags.length < 4) errors.push(`${platform}: fewer than 4 hashtags`)
    if (item.hashtags.some(x => !x.startsWith('#'))) errors.push(`${platform}: invalid hashtag format`)
  }
  if (packages.youtube.title.length > 100) errors.push('youtube: title exceeds 100 characters')
  if (packages.tiktok.title.length > 90) errors.push('tiktok: title exceeds 90 characters')
  return { valid: errors.length === 0, errors }
}
