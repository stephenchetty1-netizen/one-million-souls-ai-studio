import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import { getPerformance, getStrategy, saveStrategy, summarize } from '@/lib/learning'
import { rankRecords, chooseNextTopic } from '@/lib/growth-engine'
import { getAudienceProfile } from '@/lib/audience'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra'
const StrategySchema = z.object({
  summary: z.string(),
  winningTopics: z.array(z.string()).max(8),
  winningHooks: z.array(z.string()).max(8),
  winningFormats: z.array(z.string()).max(8),
  experiments: z.array(z.string()).max(8),
  nextTopics: z.array(z.string()).max(10),
  guardrails: z.array(z.string()).max(8),
})

export async function POST(req: Request) {
  try {
    const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.')
    const records = await getPerformance(100)
    const stats = summarize(records)
    const previous = await getStrategy()
    const audience = await getAudienceProfile()
    const response = await client.responses.parse({
      model: MODEL,
      input: `You are the AI Growth Manager for the One Million Souls Christian content mission. Analyze the performance dataset and create the next content strategy. Optimize for sustainable reach, retention, shares and follows, but NEVER sacrifice biblical accuracy, Gospel clarity, safety, honesty, or platform compliance for engagement. Do not promise virality or a follower count. Prefer evidence from the dataset. If data is sparse, say so and recommend controlled experiments. Current stats: ${JSON.stringify(stats)}. Previous strategy: ${JSON.stringify(previous)}. Audience intelligence: ${JSON.stringify(audience)}. Performance records: ${JSON.stringify(records)}.`,
      reasoning: { effort: 'medium' },
      text: { format: zodTextFormat(StrategySchema, 'growth_strategy') },
    })
    if (!response.output_parsed) throw new Error('No growth strategy returned.')
    const strategy = { generatedAt: new Date().toISOString(), ...response.output_parsed }
    await saveStrategy(strategy)
    const ranked = rankRecords(records).slice(0, 10)
    return Response.json({ ok: true, strategy, stats, suggestedTopic: chooseNextTopic(strategy, records), topPosts: ranked })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Growth analysis failed.' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const secret = process.env.ANALYTICS_INGEST_SECRET || process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  const records = await getPerformance(100)
  const strategy = await getStrategy()
  return Response.json({ ok: true, strategy, stats: summarize(records), suggestedTopic: chooseNextTopic(strategy, records), topPosts: rankRecords(records).slice(0, 10), records })
}
