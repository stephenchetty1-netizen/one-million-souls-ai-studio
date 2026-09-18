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
    const rd = JSON.parse(await fs.readFile(path.join(root, 'content-agents', 'channel-rd-lab.json'), 'utf8'))
    const studio = JSON.parse(await fs.readFile(path.join(root, 'content-agents', 'media-studio-cadence.json'), 'utf8'))
    return NextResponse.json({
      ok: true,
      system: 'one-million-souls-content-agent-team',
      stage: 'STAGED',
      publishingLocked: true,
      agents: [
        'trend-scout','million-view-scout','channel-strategist','competitor-mapper',
        'search-intent-analyst','audience-insight-researcher','retention-scientist','hook-lab',
        'format-innovation-lab','thumbnail-researcher','metadata-strategist','content-portfolio-planner',
        'rights-scout','theology-guard','script-writer','asset-scout','music-director',
        'visual-director','thumbnail-director','content-director','shorts-editor',
        'longform-producer','lyric-producer','executive-producer','storyboard-producer',
        'media-producer','motion-editor','sound-designer','repurposing-editor','media-librarian',
        'production-scheduler','qa','publisher','analytics-learner'
      ],
      squads: {
        channelResearch: rd.squads?.channelResearch || [],
        mediaStudio: rd.squads?.mediaStudio || [],
      },
      queue: {
        shorts: queue.shorts?.length || 0,
        longForm: queue.longForm?.length || 0,
        lyricVideos: queue.lyricVideos?.length || 0,
      },
      rightsSources: sources.sources?.map((s:any) => ({ id:s.id, type:s.type, priority:s.priority })) || [],
      qualityPolicy: 'FAIL_CLOSED',
      hardGates: ['thumbnailQuality','contentQuality','lyricSync'],
      cadence: {
        research: rd.researchCadence,
        dailyDraftTargets: studio.dailyDraftTargets,
        weeklyTargets: studio.weeklyTargets,
        rollingBacklogDays: studio.rollingBacklogDays,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'status failed' }, { status:500 })
  }
}
