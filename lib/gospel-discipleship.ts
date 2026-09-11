import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ChristCenteredGospelReview } from './christ-centered-gospel'
import { redisGetJson, redisSetJson } from './jobs'

export type TransformationDimension = 'TRUTH' | 'GOSPEL_RESPONSE' | 'REPENTANCE_FAITH' | 'DISCIPLESHIP' | 'OBEDIENCE' | 'MISSION'
export type TransformationVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type GospelDiscipleshipReview = {
  version: 'V50'
  generatedAt: string
  reference: string
  transformationThesis: string
  truth: string
  gospelResponse: string
  repentanceAndFaith: string
  discipleship: string
  obedience: string
  mission: string
  invitation: string
  transformationClaims: string[]
  boundaries: string[]
  dimensions: Array<{ dimension: TransformationDimension; verdict: TransformationVerdict; finding: string; evidence: string[] }>
  verdict: TransformationVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  transformationThesis: z.string().min(1), truth: z.string().min(1), gospelResponse: z.string().min(1), repentanceAndFaith: z.string().min(1), discipleship: z.string().min(1), obedience: z.string().min(1), mission: z.string().min(1), invitation: z.string().min(1),
  transformationClaims: z.array(z.string()).max(12), boundaries: z.array(z.string()).min(1).max(12),
  dimensions: z.array(z.object({ dimension: z.enum(['TRUTH','GOSPEL_RESPONSE','REPENTANCE_FAITH','DISCIPLESHIP','OBEDIENCE','MISSION']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Do not claim to know whether a viewer has experienced spiritual regeneration, conversion, salvation, or lasting transformation.',
  'Distinguish biblical invitation from guaranteed personal outcomes.',
  'Repentance and faith must not be presented as a payment that earns salvation.',
  'Discipleship and obedience are responses to grace, not a replacement for the Gospel.',
  'Do not manipulate viewers with fear, shame, guilt, urgency, or fabricated spiritual consequences.',
  'Do not promise that a specific prayer, decision, feeling, or engagement action guarantees salvation or blessing.',
  'Mission and evangelism applications must remain truthful and must not pressure viewers to perform publicly.',
  'Separate what Scripture explicitly commands from a reasonable modern application.',
  'Invitation language should preserve freedom, dignity, and truthful scope.',
  'Do not equate following, sharing, commenting, donating, or platform growth with spiritual maturity.',
  'Where the source passage does not support a transformation claim, mark it as unsupported rather than inventing a bridge.',
]

export async function reviewGospelDiscipleship(input: { reference: string; intendedClaim?: string; gospel?: ChristCenteredGospelReview | null; content?: unknown }): Promise<GospelDiscipleshipReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Gospel & Discipleship Transformation Review Agent. Audit whether Christian content moves faithfully from biblical truth and the Gospel toward repentance, faith, discipleship, obedience, and mission. Do not rewrite content and do not claim to know whether anyone is spiritually transformed. Distinguish explicit biblical teaching, reasonable application, and unsupported outcomes. Reject manipulation, works-based salvation, guaranteed blessings, fabricated spiritual consequences, or engagement-as-discipleship. Return only structured JSON.\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nGOSPEL REVIEW: ${JSON.stringify(input.gospel || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'gospel_discipleship_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Gospel & discipleship review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V50', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateGospelDiscipleship(review: GospelDiscipleshipReview) {
  const reasons: string[] = []
  if (review.version !== 'V50') reasons.push('Invalid V50 review version')
  if (!review.reference.trim() || !review.transformationThesis.trim()) reasons.push('Missing transformation identity')
  if (review.dimensions.length !== 6) reasons.push('Missing transformation dimensions')
  if (review.boundaries.length < 1) reasons.push('Missing transformation boundaries')
  if (review.guardrails.length < 11) reasons.push('Missing transformation guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Transformation verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one transformation dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:gospel-discipleship:latest'
export async function saveGospelDiscipleship(review: GospelDiscipleshipReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getGospelDiscipleship() { return redisGetJson<GospelDiscipleshipReview>(KEY) }
