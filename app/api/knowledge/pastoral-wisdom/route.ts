import { reviewPastoralWisdom, savePastoralWisdom, validatePastoralWisdom } from '@/lib/pastoral-wisdom'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body?.reference || body?.content === undefined) return Response.json({ ok: false, error: 'reference and content are required.' }, { status: 400 })
    const review = await reviewPastoralWisdom(body)
    const validation = validatePastoralWisdom(review)
    if (validation.ok) await savePastoralWisdom(review)
    return Response.json({ ok: validation.ok, review, validation })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pastoral wisdom review failed.' }, { status: 500 })
  }
}
