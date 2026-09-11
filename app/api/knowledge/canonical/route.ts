import { reviewBiblicalTheology, validateBiblicalTheology, saveBiblicalTheology } from '@/lib/biblical-theology'

function authorized(req: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`) }
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body?.reference) return Response.json({ error: 'reference is required.' }, { status: 400 })
    const review = await reviewBiblicalTheology(body)
    const validation = validateBiblicalTheology(review)
    if (validation.ok) await saveBiblicalTheology(review)
    return Response.json({ ok: validation.ok, review, validation })
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Biblical theology review failed.' }, { status: 500 }) }
}
