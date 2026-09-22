import { prepareZeroCreditDraft, UnmatchedCuratedTopicError } from '../../../content-agents/zero-credit-draft.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // This public, manual draft endpoint MUST NOT fall through to paid OpenAI calls.
  if (process.env.ZERO_CREDIT_ONLY !== 'true') {
    return Response.json({
      error: 'Zero-credit devotional drafts require ZERO_CREDIT_ONLY=true. No paid API was contacted.'
    }, { status: 409 })
  }
  try {
    const raw = await req.text()
    if (raw.length > 32768) return Response.json({ error: 'Message brief is too large.' }, { status: 413 })
    const body = JSON.parse(raw)
    const draft = await prepareZeroCreditDraft(body)
    return Response.json(draft, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (error instanceof UnmatchedCuratedTopicError) {
      return Response.json({
        error: error.message + ' Available curated topics: ' + error.availableTopics.join(', '),
        availableTopics: error.availableTopics,
        publishingLocked: true
      }, { status: 422 })
    }
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.error('ZERO_CREDIT_DRAFT_ERROR', error instanceof Error ? error.message : 'Unknown server error')
    return Response.json({
      error: 'Curated draft preparation is temporarily unavailable. No paid AI was contacted.'
    }, { status: 503 })
  }
}
