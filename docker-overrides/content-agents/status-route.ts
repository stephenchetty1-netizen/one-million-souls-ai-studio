import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const root = process.cwd()
    const raw = await fs.readFile(path.join(root, 'content-agents', 'seed-queue.json'), 'utf8')
    const queue = JSON.parse(raw)
    const sources = JSON.parse(await fs.readFile(path.join(root, 'content-agents', 'source-registry.json'), 'utf8'))
    return NextResponse.json({
      ok: true,
      system: 'one-million-souls-content-agent-team',
      stage: 'STAGED',
      publishingLocked: true,
      agents: [
        'trend-scout','rights-scout','theology-guard','script-writer','asset-scout',
        'music-director','visual-director','shorts-editor','longform-producer',
        'lyric-producer','qa','publisher','analytics-learner'
      ],
      queue: {
        shorts: queue.shorts?.length || 0,
        longForm: queue.longForm?.length || 0,
        lyricVideos: queue.lyricVideos?.length || 0,
      },
      rightsSources: sources.sources?.map((s:any) => ({ id:s.id, type:s.type, priority:s.priority })) || [],
      qualityPolicy: 'FAIL_CLOSED',
    })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'status failed' }, { status:500 })
  }
}
