import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra'
const KEY = 'one-million-souls:knowledge:scripture:latest'

export type ScriptureKnowledge = {
  version: 'V39'
  generatedAt: string
  topic: string
  primaryReference: string
  supportingReferences: string[]
  passageSummary: string
  historicalContext: string
  literaryContext: string
  keyBiblicalTruths: string[]
  christCenteredConnection: string
  applicationBoundaries: string[]
  commonMisreadings: string[]
  sourceEvidence: Array<{ claim: string; source: string }>
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  guardrails: string[]
}

const Schema = z.object({
  primaryReference: z.string().min(2),
  supportingReferences: z.array(z.string()).min(2).max(6),
  passageSummary: z.string().min(20),
  historicalContext: z.string().min(20),
  literaryContext: z.string().min(20),
  keyBiblicalTruths: z.array(z.string()).min(3).max(7),
  christCenteredConnection: z.string().min(20),
  applicationBoundaries: z.array(z.string()).min(2).max(6),
  commonMisreadings: z.array(z.string()).min(1).max(6),
  sourceEvidence: z.array(z.object({ claim: z.string(), source: z.string() })).min(2).max(8),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
})

const GUARDRAILS = [
  'Scripture is the authority; AI research is an aid for reference and context, not a substitute for the biblical text.',
  'Never invent verses, quotations, authorship claims, historical details, or theological conclusions.',
  'Keep passages in literary and canonical context; distinguish explicit teaching from application or inference.',
  'Christ-centered connections must be grounded in Scripture and must not force a symbolic meaning into a passage.',
  'Do not use fabricated testimony, miracle claims, spiritual guarantees, or fear-based manipulation.',
  'Use public sources only and do not collect private or sensitive audience information.',
]

async function research(input: string) {
  const response = await client.responses.parse({
    model: TEXT_MODEL,
    input,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'scripture_knowledge') },
  })
  if (response.status !== 'completed') throw new Error(JSON.stringify(response.error ?? response.incomplete_details ?? 'Scripture research did not complete.'))
  if (!response.output_parsed) throw new Error('OpenAI returned no structured Scripture knowledge.')
  return response.output_parsed as z.infer<typeof Schema>
}

export async function buildScriptureKnowledge(topic: string): Promise<ScriptureKnowledge> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const result = await research(`You are the Scripture Intelligence Agent for a Christian content studio. Research this topic conservatively: ${topic}.

Identify the strongest primary biblical passage and supporting passages. Verify references and context using public web sources. Prefer direct biblical evidence over commentary. Explain historical and literary context only when evidence supports it. Do not invent exact quotations. Clearly separate what the passage explicitly teaches from application and inference. Provide a Christ-centered connection only where it is biblically defensible. Identify common misreadings and boundaries so a short-form creator does not misuse the passage. Source evidence must name public sources used for verification. This is research for content creation, not a replacement for Scripture or pastoral/theological authority.`)
  return {
    version: 'V39', generatedAt: new Date().toISOString(), topic,
    ...result,
    guardrails: GUARDRAILS,
  }
}

export function validateScriptureKnowledge(k: ScriptureKnowledge) {
  return k.version === 'V39' && Boolean(k.topic && k.primaryReference && k.passageSummary) &&
    k.supportingReferences.length >= 2 && k.keyBiblicalTruths.length >= 3 &&
    k.sourceEvidence.length >= 2 && k.guardrails.length >= 6
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Scripture knowledge store failed (${response.status}).`)
  return response.json()
}

export async function saveScriptureKnowledge(k: ScriptureKnowledge) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Persistent state is required for Scripture knowledge.')
  await redis(['set', KEY, JSON.stringify(k)])
}

export async function getScriptureKnowledge() {
  const result = await redis(['get', KEY])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as ScriptureKnowledge } catch { return null }
}
