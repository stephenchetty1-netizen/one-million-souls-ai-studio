import { PlatformPackage, optimizeForPlatforms, validatePlatformPackages } from './platform-optimizer'

export type DistributionPlan = {
  version: 'V26'
  generatedAt: string
  objective: string
  publishAt: string
  timezone: string
  platforms: Array<'tiktok' | 'youtube'>
  packages: { tiktok: PlatformPackage; youtube: PlatformPackage }
  platformStrategy: {
    tiktok: { hook: string; captionStyle: string; cta: string }
    youtube: { titleStyle: string; descriptionStyle: string; cta: string }
  }
  verification: string[]
  guardrails: string[]
}

function clean(v: unknown, max = 500) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function buildDistributionPlan(input: {
  title: string
  caption: string
  hashtags: string[]
  topic?: string
  dateTime: string
  timezone: string
  objective?: string
}) : DistributionPlan {
  const packages = optimizeForPlatforms({
    title: input.title,
    caption: input.caption,
    hashtags: input.hashtags,
    topic: input.topic,
  })
  const validation = validatePlatformPackages(packages)
  if (!validation.valid) throw new Error(`Distribution package validation failed: ${validation.errors.join('; ')}`)

  return {
    version: 'V26',
    generatedAt: new Date().toISOString(),
    objective: clean(input.objective || 'Reach new people with truthful Christian encouragement that points to Jesus.', 300),
    publishAt: input.dateTime,
    timezone: input.timezone,
    platforms: ['tiktok', 'youtube'],
    packages,
    platformStrategy: {
      tiktok: {
        hook: 'Lead with the strongest truthful emotional or curiosity hook in the opening seconds.',
        captionStyle: 'Short, conversational, searchable, and easy to share without clickbait.',
        cta: 'Invite a simple response, share, follow, or prayer without manipulative pressure.',
      },
      youtube: {
        titleStyle: 'Clear, searchable promise of value centered on Jesus or Scripture.',
        descriptionStyle: 'Concise context with natural keywords and relevant hashtags.',
        cta: 'Invite viewers to continue learning, share the message, or subscribe for more Christ-centered content.',
      },
    },
    verification: [
      'Validate both platform packages before scheduling.',
      'Confirm mediaUrl is HTTPS and points to the approved final video.',
      'Confirm AI-generated-content disclosure fields are enabled where supported.',
      'Treat a successful scheduler response as scheduled only when the provider request returns an OK response.',
      'Persist the distribution outcome for analytics and learning.',
    ],
    guardrails: [
      'Never fabricate Scripture, testimonials, miracles, statistics, or guarantees.',
      'Never use deceptive engagement bait or fear-based manipulation.',
      'Never publish media that failed the final video quality gate.',
      'Never add copyrighted lyrics or unlicensed media.',
      'Do not claim a platform post is live unless the configured publishing provider confirms the scheduling request succeeded.',
    ],
  }
}

export function validateDistributionPlan(plan: DistributionPlan) {
  const errors: string[] = []
  if (plan.version !== 'V26') errors.push('Unsupported distribution plan version.')
  if (!plan.publishAt || !plan.timezone) errors.push('Missing publication timing.')
  const packageValidation = validatePlatformPackages(plan.packages)
  errors.push(...packageValidation.errors)
  if (plan.platforms.length !== 2 || !plan.platforms.includes('tiktok') || !plan.platforms.includes('youtube')) {
    errors.push('TikTok and YouTube are both required.')
  }
  return { valid: errors.length === 0, errors }
}
