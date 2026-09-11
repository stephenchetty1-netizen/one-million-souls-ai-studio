import { getPerformance, getStrategy, type PerformanceRecord } from './learning'

export type PostPublishStatus = 'AWAITING_DATA' | 'EARLY_SIGNAL' | 'MEASURED' | 'WINNER' | 'NEEDS_ADAPTATION'
export type PostPublishInsight = {
  generatedAt: string
  status: PostPublishStatus
  postId?: string
  platform?: 'tiktok' | 'youtube'
  ageHours?: number
  metrics?: { views: number; engagementRate: number; followRate: number; retention?: number }
  benchmark?: { views: number; engagementRate: number; followRate: number; retention?: number }
  signal?: 'INSUFFICIENT_DATA' | 'IMPROVING' | 'STABLE' | 'DECLINING'
  winnerReason?: string
  recommendation: string
  nextExperiment?: { hookDirection?: string; format?: string; topic?: string; objective?: string }
}

function rate(record: PerformanceRecord) {
  const views = Math.max(1, record.views)
  return {
    engagementRate: ((record.likes + record.comments + record.shares) / views) * 100,
    followRate: (record.follows / views) * 100,
    retention: record.avgPercentageViewed,
  }
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export async function analyzePostPublish(postId?: string): Promise<PostPublishInsight> {
  const records = await getPerformance(100)
  const target = postId ? records.find(r => r.id === postId) : records[0]
  if (!target) return { generatedAt: new Date().toISOString(), status: 'AWAITING_DATA', recommendation: 'Wait for the platform analytics adapter to provide a matching post record. Do not infer performance from publishing success.' }

  const publishedMs = Date.parse(target.publishedAt)
  const ageHours = Number.isFinite(publishedMs) ? Math.max(0, (Date.now() - publishedMs) / 3600000) : undefined
  const current = rate(target)
  const peers = records.filter(r => r.platform === target.platform && r.id !== target.id).slice(0, 20)
  if (peers.length < 3) {
    return {
      generatedAt: new Date().toISOString(), status: ageHours !== undefined && ageHours < 6 ? 'EARLY_SIGNAL' : 'MEASURED',
      postId: target.id, platform: target.platform, ageHours,
      metrics: { views: target.views, ...current },
      recommendation: 'Collect more comparable posts before declaring a winner. Keep the current content direction unless a clear audience signal appears.',
    }
  }

  const benchmark = {
    views: median(peers.map(r => r.views)),
    engagementRate: median(peers.map(r => rate(r).engagementRate)),
    followRate: median(peers.map(r => rate(r).followRate)),
    retention: median(peers.map(r => rate(r).retention || 0)),
  }
  const score = (v: number, b: number) => b > 0 ? (v - b) / b : 0
  const components = [score(target.views, benchmark.views), score(current.engagementRate, benchmark.engagementRate), score(current.followRate, benchmark.followRate)]
  if (current.retention !== undefined && benchmark.retention > 0) components.push(score(current.retention, benchmark.retention))
  const composite = components.reduce((a, b) => a + b, 0) / components.length

  if (composite >= 0.2) return {
    generatedAt: new Date().toISOString(), status: 'WINNER', postId: target.id, platform: target.platform, ageHours,
    metrics: { views: target.views, ...current }, benchmark,
    signal: 'IMPROVING', winnerReason: 'The post is materially above the comparable-post median across multiple performance signals.',
    recommendation: 'Preserve the strongest creative ingredients and run a controlled variation rather than copying the post verbatim.',
    nextExperiment: { hookDirection: 'Keep the winning hook family with one new opening line.', format: target.pillar === 'Prayer' ? 'Short prayer' : 'Question → Scripture → answer', topic: target.topic, objective: 'Extend the winning pattern while testing one variable.' },
  }

  if (composite <= -0.2) return {
    generatedAt: new Date().toISOString(), status: 'NEEDS_ADAPTATION', postId: target.id, platform: target.platform, ageHours,
    metrics: { views: target.views, ...current }, benchmark,
    signal: 'DECLINING',
    recommendation: 'Change one major creative variable for the next post—preferably the opening hook or format—while preserving the biblical core.',
    nextExperiment: { hookDirection: 'Question-first or tension-to-hope opening', format: 'Direct encouragement', topic: target.topic, objective: 'Improve early retention and engagement without weakening biblical accuracy.' },
  }

  return {
    generatedAt: new Date().toISOString(), status: 'MEASURED', postId: target.id, platform: target.platform, ageHours,
    metrics: { views: target.views, ...current }, benchmark, signal: 'STABLE',
    recommendation: 'Performance is within the normal range. Keep the strategy stable and introduce only one controlled variation.',
    nextExperiment: { hookDirection: 'Small hook variation', format: 'One Scripture explained', topic: target.topic, objective: 'Explore a modest improvement while protecting consistency.' },
  }
}

export async function buildPostPublishReport() {
  const records = await getPerformance(100)
  const strategy = await getStrategy()
  const recent = records.slice(0, 20)
  const byPlatform = (platform: PerformanceRecord['platform']) => recent.filter(r => r.platform === platform)
  const summaries = (items: PerformanceRecord[]) => {
    if (!items.length) return { posts: 0, medianViews: 0, medianRetention: 0, medianFollowRate: 0 }
    return {
      posts: items.length,
      medianViews: median(items.map(r => r.views)),
      medianRetention: median(items.map(r => r.avgPercentageViewed || 0)),
      medianFollowRate: median(items.map(r => rate(r).followRate)),
    }
  }
  const insights = []
  for (const record of recent.slice(0, 10)) insights.push(await analyzePostPublish(record.id))
  return {
    generatedAt: new Date().toISOString(), totalRecords: records.length,
    platforms: { tiktok: summaries(byPlatform('tiktok')), youtube: summaries(byPlatform('youtube')) },
    strongestPosts: recent.slice().sort((a, b) => b.views - a.views).slice(0, 5).map(r => ({ id: r.id, title: r.title, platform: r.platform, views: r.views, topic: r.topic, pillar: r.pillar })),
    insights,
    currentStrategy: strategy,
    guardrails: ['Do not treat scheduling success as public-live confirmation.', 'Do not declare winners with insufficient comparable data.', 'Change one major creative variable at a time.', 'Keep Scripture verified and Jesus-centered.', 'Use only public analytics signals; do not collect private audience messages or personal data.'],
  }
}
