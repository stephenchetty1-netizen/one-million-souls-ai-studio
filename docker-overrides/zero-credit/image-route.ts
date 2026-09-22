export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The original image endpoint invokes a paid model. Disable it in the local-template flow.
export async function POST() {
  return Response.json({
    error: 'Image generation is unavailable in zero-credit mode. Use original or rights-cleared media with the three storyboard prompts.',
    mode: 'zero-credit',
    publishingLocked: true
  }, { status: 403 })
}
