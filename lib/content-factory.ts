import { optimizeForPlatforms, type PlatformPackage } from './platform-optimizer'

export type FactoryAssetType = 'CORE' | 'HOOK_FOCUSED' | 'QUESTION_FOCUSED'

export type FactoryAsset = {
  assetId: string
  type: FactoryAssetType
  title: string
  caption: string
  hashtags: string[]
  tiktokScript: string
  onScreenText: string[]
  visualConcept: string
  imagePrompts: string[]
  platformPackages: ReturnType<typeof optimizeForPlatforms>
  sourceCampaignTitle: string
}

export type ContentFactoryBatch = {
  batchId: string
  createdAt: string
  topic: string
  pillar?: string
  approvedCore: boolean
  assets: FactoryAsset[]
}

function clean(value: string) { return value.trim().replace(/\s+/g, ' ') }
function hashtagList(tags: string[]) { return [...new Set(tags.map(t => t.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 10) }

export function buildContentFactory(input: {
  topic: string
  title: string
  caption: string
  hashtags: string[]
  tiktokScript: string
  onScreenText: string[]
  visualConcept: string
  imagePrompts: string[]
  pillar?: string
  approvedCore: boolean
}): ContentFactoryBatch {
  if (!input.approvedCore) throw new Error('Content Factory requires an approved core campaign.');

  const baseTitle = clean(input.title)
  const baseCaption = clean(input.caption)
  const tags = hashtagList(input.hashtags)
  const firstLine = clean(input.tiktokScript.split(/\n+/)[0] || baseTitle)

  const variants: Array<{ type: FactoryAssetType; title: string; caption: string; extraTags: string[]; text: string[] }> = [
    { type: 'CORE', title: baseTitle, caption: baseCaption, extraTags: [], text: input.onScreenText },
    { type: 'HOOK_FOCUSED', title: `Stop scrolling: ${baseTitle}`, caption: `${firstLine} ${baseCaption}`, extraTags: ['faith', 'jesus', 'christian', 'hope'], text: [firstLine, ...input.onScreenText.slice(0, 5)] },
    { type: 'QUESTION_FOCUSED', title: `Have you been asking this? ${baseTitle}`, caption: `Have you ever asked: ${firstLine}? ${baseCaption}`, extraTags: ['bible', 'prayer', 'jesus', 'christian'], text: [`Have you ever asked: ${firstLine}?`, ...input.onScreenText.slice(0, 5)] },
  ]

  const assets = variants.map((v, index) => {
    const hashtags = hashtagList([...tags, ...v.extraTags])
    const platformPackages = optimizeForPlatforms({ title: v.title, caption: v.caption, hashtags, topic: input.topic })
    return {
      assetId: `${v.type.toLowerCase()}-${index + 1}`,
      type: v.type,
      title: v.title,
      caption: v.caption,
      hashtags,
      tiktokScript: input.tiktokScript,
      onScreenText: v.text.slice(0, 8),
      visualConcept: input.visualConcept,
      imagePrompts: input.imagePrompts,
      platformPackages,
      sourceCampaignTitle: baseTitle,
    }
  })

  return {
    batchId: `factory-${Date.now()}`,
    createdAt: new Date().toISOString(),
    topic: input.topic,
    pillar: input.pillar,
    approvedCore: true,
    assets,
  }
}

export function validateFactoryBatch(batch: ContentFactoryBatch) {
  return Boolean(batch.approvedCore && batch.assets.length >= 3 && batch.assets.every(a => a.assetId && a.title && a.tiktokScript && a.platformPackages.tiktok && a.platformPackages.youtube))
}
