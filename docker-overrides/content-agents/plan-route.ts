import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

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
    const item = body.id ? bucket.find((x:any) => x.id === body.id) : bucket[0]
    if (!item) return NextResponse.json({ ok:false, error:'No queue item found' }, { status:404 })

    const plan = {
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      mode,
      item,
      agents: [
        'trend-scout','theology-guard','script-writer','asset-scout','rights-scout',
        'music-director','visual-director',
        mode === 'SHORT' ? 'shorts-editor' : mode === 'LONG' ? 'longform-producer' : 'lyric-producer',
        'qa','publisher','analytics-learner'
      ],
      gates: {
        rightsStatus:'PENDING',
        theologyStatus:'PENDING',
        factualStatus:'PENDING',
        mediaIntegrity:'PENDING',
        captionSync:'PENDING',
        audioMix:'PENDING',
        visualQuality:'PENDING',
        originality:'PENDING',
      },
      publishingLocked: true,
      nextAction: 'GENERATE_DRAFT_ASSETS',
    }

    return NextResponse.json({ ok:true, plan })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'plan failed' }, { status:500 })
  }
}
