import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ScriptureKnowledge } from './scripture-intelligence'
import type { ChristianEthicsReview } from './christian-ethics'
import type { PastoralWisdomReview } from './pastoral-wisdom'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra'

export type TheologicalConsistencyReview = {
  version: 'V40'
  generatedAt: string
  topic: string
  status: 'PASS' | 'REVISE' | 'BLOCK'
  scriptureFaithfulness: boolean
  contextualFaithfulness: boolean
  gospelCentered: boolean
  theologicalClarity: boolean
  applicationDistinction: boolean
  claimsAudited: string[]
  concerns: string[]
  requiredRevisions: string[]
  strengths: string[]
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  guardrails: string[]
}

const Schema = z.object({
  scriptureFaithfulness: z.boolean(),
  contextualFaithfulness: z.boolean(),
  gospelCentered: z.boolean(),
  theologicalClarity: z.boolean(),
  applicationDistinction: z.boolean(),
  claimsAudited: z.array(z.string()).min(2).max(10),
  concerns: z.array(z.string()).max(8),
  requiredRevisions: z.array(z.string()).max(8),
  strengths: z.array(z.string()).min(1).max(8),
  confidence: z.enum(['LOW','MEDIUM','HIGH']),
  status: z.enum(['PASS','REVISE','BLOCK']),
})

const GUARDRAILS = [
  'The review is a consistency check, not a replacement for Scripture, pastoral care, or accountable theological leadership.',
  'Judge claims against the supplied verified Scripture Intelligence and Bible research; do not invent alternate authorities. Treat ethics and pastoral-wisdom reviews as downstream evidence to challenge and reconcile, not as Scripture or as independent authority.',
  'Distinguish what Scripture explicitly teaches from inference, application, illustration, and creative phrasing.',
  'Reject fabricated quotations, fabricated testimony, spiritual guarantees, manipulative fear, and claims of certainty not supported by Scripture.',
  'Keep Jesus and the Gospel central where the content makes Christian claims, without forcing a Christological meaning into an unrelated passage.',
  'A failed review blocks autonomous publishing; no downstream agent may override it.',
]

async function review(input: string) {
  const response = await client.responses.parse({
    model: TEXT_MODEL,
    input,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'theological_consistency_review') },
  })
  if (response.status !== 'completed') throw new Error(JSON.stringify(response.error ?? response.incomplete_details ?? 'Theological review did not complete.'))
  if (!response.output_parsed) throw new Error('OpenAI returned no theological consistency review.')
  return response.output_parsed as z.infer<typeof Schema>
}

export async function reviewTheologicalConsistency(topic: string, scripture: ScriptureKnowledge, bibleResearch: unknown, content: unknown, reviews?: { interpretation?: unknown; hermeneutics?: unknown; canonicalTheology?: unknown; doctrine?: unknown; gospel?: unknown; gospelDiscipleship?: unknown; evangelismMission?: unknown; apologetics?: unknown; ethics?: ChristianEthicsReview | null; pastoralWisdom?: PastoralWisdomReview | null }): Promise<TheologicalConsistencyReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const result = await review(`You are the independent Theological Consistency Agent for a Christian short-form content studio. Your job is to challenge a proposed devotional after Scripture Intelligence and Bible Research have completed.

Topic: ${topic}

VERIFIED SCRIPTURE INTELLIGENCE:
${JSON.stringify(scripture)}

BIBLE RESEARCH:
${JSON.stringify(bibleResearch)}

PROPOSED CONTENT:
${JSON.stringify(content)}

DOWNSTREAM CHRISTIAN REVIEW EVIDENCE:
${JSON.stringify(reviews || null)}

Audit the proposed content conservatively. Check whether Scripture references and claims remain faithful to the supplied research, whether context is respected, whether explicit teaching is distinguished from application/inference, whether Jesus and the Gospel are represented faithfully, and whether any wording overstates what the passage promises. Look specifically for prosperity-style guarantees, fear manipulation, fabricated testimony or quotations, spiritual certainty beyond the evidence, proof-texting, or claims that could mislead a viewer. Do not rewrite the content. Report concerns and required revisions. PASS only when the core message is theologically consistent with the supplied biblical evidence; REVISE for fixable issues; BLOCK for material biblical distortion, fabricated claims, or unsafe/manipulative spiritual claims.`)
  const status = result.status === 'PASS' && result.scriptureFaithfulness && result.contextualFaithfulness && result.gospelCentered && result.theologicalClarity && result.applicationDistinction ? 'PASS' : result.status === 'BLOCK' ? 'BLOCK' : 'REVISE'
  return { version: 'V40', generatedAt: new Date().toISOString(), topic, ...result, status, guardrails: GUARDRAILS }
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error(`Theological review store failed (${response.status}).`)
  return response.json()
}

const KEY = 'one-million-souls:theology:consistency:latest'
export async function saveTheologicalConsistency(review: TheologicalConsistencyReview) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Persistent state is required for theological consistency reviews.')
  await redis(['set', KEY, JSON.stringify(review)])
}
export async function getTheologicalConsistency() {
  const result = await redis(['get', KEY])
  if (!result?.result) return null
  try { return JSON.parse(result.result) as TheologicalConsistencyReview } catch { return null }
}

export function validateTheologicalConsistency(review: TheologicalConsistencyReview) {
  return review.version === 'V40' && Boolean(review.generatedAt && review.topic) && review.claimsAudited.length >= 2 && review.strengths.length >= 1 && review.guardrails.length >= 6 && review.status === 'PASS' && review.scriptureFaithfulness && review.contextualFaithfulness && review.gospelCentered && review.theologicalClarity && review.applicationDistinction
}
