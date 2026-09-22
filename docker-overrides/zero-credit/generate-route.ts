import { buildZeroCreditCampaign } from '../../../content-agents/zero-credit-generator.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Deliberately no OpenAI SDK or paid provider. Drafts never enter publishing.
export async function POST(request: Request) {
  try {
    const brief = await request.json().catch(() => null)
    const result = buildZeroCreditCampaign(brief)
    if ('error' in result) return Response.json({ error: result.error, mode: 'zero-credit' }, { status: result.statusCode })
    return Response.json({ ...result, mode: 'zero-credit' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('ZERO_CREDIT_GENERATE_FAILED', error instanceof Error ? error.message : String(error))
    return Response.json({ error: 'Could not prepare the local draft. Please try again.', mode: 'zero-credit' }, { status: 500 })
  }
}
