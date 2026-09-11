import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import { getAudienceSignals, getAudienceProfile, saveAudienceProfile } from '@/lib/audience'
import { getPerformance, getStrategy } from '@/lib/learning'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra'
const ProfileSchema = z.object({
  topNeeds: z.array(z.string()).max(10),
  recurringQuestions: z.array(z.string()).max(10),
  prayerThemes: z.array(z.string()).max(10),
  objections: z.array(z.string()).max(8),
  topicDemand: z.array(z.string()).max(10),
  audienceLanguage: z.array(z.string()).max(10),
  recommendedAngles: z.array(z.string()).max(10),
  guardrails: z.array(z.string()).max(10),
})

export async function POST(req: Request) {
  const secret = process.env.AUDIENCE_INGEST_SECRET || process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.')
    const signals = await getAudienceSignals(300)
    const performance = await getPerformance(100)
    const strategy = await getStrategy()
    const response = await client.responses.parse({
      model: MODEL,
      input: `You are the Audience Intelligence Agent for the One Million Souls Christian content mission. Analyze aggregate audience signals to identify what people are asking for and what content could genuinely help them. Use only the supplied public-content signals. Do NOT infer or profile sensitive personal traits or identify individuals. Do not store names, handles, contact details, or private-message content. Aggregate recurring themes rather than profiling individual people. Bible truth remains authoritative: audience demand can shape framing and topics, never Scripture. Avoid manipulative emotional tactics or false promises. Signals: ${JSON.stringify(signals)}. Recent performance: ${JSON.stringify(performance)}. Growth strategy: ${JSON.stringify(strategy)}.`,
      reasoning: { effort: 'medium' },
      text: { format: zodTextFormat(ProfileSchema, 'audience_profile') },
    })
    if (!response.output_parsed) throw new Error('No audience profile returned.')
    const profile = { generatedAt: new Date().toISOString(), ...response.output_parsed }
    await saveAudienceProfile(profile)
    return Response.json({ ok: true, profile, signalCount: signals.length })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Audience profiling failed.' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const secret = process.env.AUDIENCE_INGEST_SECRET || process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  return Response.json({ ok: true, profile: await getAudienceProfile(), signals: (await getAudienceSignals(100)).length })
}
