import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { getGrowthCandidate } from '../../../../content-agents/growth-candidate-queue.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  const xSecret = req.headers.get('x-cron-secret') || ''
  return auth === `Bearer ${secret}` || xSecret === secret
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 })
  try {
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'SHORT').toUpperCase()
    if (!['SHORT','LONG','LYRIC'].includes(mode)) {
      return NextResponse.json({ ok:false, error:'mode must be SHORT, LONG, or LYRIC' }, { status:400 })
    }

    const raw = await fs.readFile(path.join(process.cwd(), 'content-agents', 'seed-queue.json'), 'utf8')
    const queue = JSON.parse(raw)
    const bucket = mode === 'SHORT' ? queue.shorts : mode === 'LONG' ? queue.longForm : queue.lyricVideos
    const growthCandidate = body.growthCandidateId ? await getGrowthCandidate(String(body.growthCandidateId)) : null
    const item = growthCandidate || (body.id ? bucket.find((x:any) => x.id === body.id) : bucket[0])
    if (!item) return NextResponse.json({ ok:false, error:'No queue item found' }, { status:404 })
    if (growthCandidate && (growthCandidate.publishingLocked !== true || growthCandidate.requiresNormalV59Approval !== true)) {
      return NextResponse.json({ ok:false, error:'Growth candidate policy invalid' }, { status:409 })
    }

    const plan = {
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      mode,
      item,
      source: growthCandidate ? 'GROWTH_MULTIPLIER' : 'SEED_QUEUE',
      growthCandidateId: growthCandidate?.id || null,
      agents: [
        'trend-scout','million-view-scout','channel-strategist','competitor-mapper',
        'search-intent-analyst','audience-insight-researcher','retention-scientist','hook-lab',
        'format-innovation-lab','thumbnail-researcher','metadata-strategist','content-portfolio-planner',
        'concept-architect','story-arc-writer','devotional-punchup-editor','visual-concept-designer',
        'broll-sequence-designer','voice-performance-director','caption-design-editor','platform-packaging-producer',
        'theology-guard','script-writer','content-director','asset-scout','rights-scout',
        'music-director','visual-director','thumbnail-director','executive-producer',
        'storyboard-producer','media-producer','motion-editor','sound-designer','media-librarian','production-scheduler',
        'scripture-context-auditor','factual-verification-auditor','visual-realism-auditor','frame-quality-inspector',
        'audio-mastering-auditor','mobile-safe-zone-inspector','export-encoding-inspector','master-integrity-auditor',
        mode === 'SHORT' ? 'shorts-editor' : mode === 'LONG' ? 'longform-producer' : 'lyric-producer',
        'qa','repurposing-editor','analytics-learner','publisher'
      ],
      gates: {
        rightsStatus:'PENDING',
        theologyStatus:'PENDING',
        factualStatus:'PENDING',
        mediaIntegrity:'PENDING',
        captionSync:'PENDING',
        audioMix:'PENDING',
        visualQuality:'PENDING',
        thumbnailQuality:'PENDING',
        contentQuality:'PENDING',
        lyricSync: mode === 'LYRIC' ? 'PENDING' : 'PASS',
        originality:'PENDING',
        professionalExecution:'PENDING',
      },
      releaseStandard: 'PROFESSIONAL_MASTER',
      approvalPolicy: 'UNANIMOUS_VERSION_BOUND_APPROVAL',
      requiredApprovals: 50,
      approvalMatrix: Object.fromEntries([
        'trend-scout','million-view-scout','channel-strategist','competitor-mapper',
        'search-intent-analyst','audience-insight-researcher','retention-scientist','hook-lab',
        'format-innovation-lab','thumbnail-researcher','metadata-strategist','content-portfolio-planner',
        'executive-producer','storyboard-producer','media-producer','motion-editor','sound-designer',
        'repurposing-editor','media-librarian','production-scheduler','rights-scout','theology-guard',
        'script-writer','asset-scout','music-director','visual-director','thumbnail-director',
        'content-director','shorts-editor','longform-producer','lyric-producer',
        'concept-architect','story-arc-writer','devotional-punchup-editor','visual-concept-designer',
        'broll-sequence-designer','voice-performance-director','caption-design-editor','platform-packaging-producer',
        'scripture-context-auditor','factual-verification-auditor','visual-realism-auditor','frame-quality-inspector',
        'audio-mastering-auditor','mobile-safe-zone-inspector','export-encoding-inspector','master-integrity-auditor',
        'qa','analytics-learner','publisher'
      ].map((agentId) => [agentId, {
        decision:'PENDING',
        contentHash:'',
        approvedAt:null,
        evidence:'',
      }])),
      publishingLocked: true,
      nextAction: 'RUN_RND_THEN_GENERATE_DRAFT_ASSETS',
      continuousMediaMode: true,
    }

    return NextResponse.json({ ok:true, plan })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'plan failed' }, { status:500 })
  }
}
