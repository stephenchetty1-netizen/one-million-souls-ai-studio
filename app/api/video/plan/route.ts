import { buildVideoProductionManifest, validateVideoProductionManifest } from '@/lib/video-production'
import { createMediaDirection } from '@/lib/media-director'

function authorized(req: Request) {
  const expected = process.env.CRON_SECRET
  return Boolean(expected && req.headers.get('authorization') === `Bearer ${expected}`)
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
    const body = await req.json()
    if (!body?.jobId || !body?.asset || !body?.campaign) return Response.json({ error: 'jobId, asset and campaign are required.' }, { status: 400 })
    const campaign = body.campaign
    const asset = body.asset
    const mediaDirection = body.mediaDirection || createMediaDirection({
      title: asset.title || campaign.title,
      topic: campaign.topic || asset.sourceCampaignTitle,
      hook: campaign.hook || asset.tiktokScript.split(/\n+/)[0] || asset.title,
      scripture: campaign.bible?.primaryScripture,
      format: campaign.format,
    })
    const manifest = buildVideoProductionManifest({ jobId: body.jobId, asset, campaign, mediaDirection })
    if (!validateVideoProductionManifest(manifest)) return Response.json({ error: 'Video production manifest failed validation.', manifest }, { status: 422 })
    return Response.json({ ok: true, manifest })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Video planning failed.' }, { status: 500 })
  }
}
