import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ScriptureKnowledge } from './scripture-intelligence'
import type { BiblicalContextReview } from './biblical-context'
import type { ScriptureInterpretation } from './scripture-interpretation'
import type { ScriptureHermeneuticsReview } from './scripture-hermeneutics'
import { redisGetJson, redisSetJson } from './jobs'

export type CanonicalDimension = 'IMMEDIATE_PASSAGE' | 'BOOK_THEOLOGY' | 'BIBLICAL_CANON' | 'GOSPEL_CENTRICITY' | 'DOCTRINAL_BALANCE' | 'APPLICATION_SCOPE'
export type CanonicalVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type BiblicalTheologySynthesis = {
  version: 'V47'
  generatedAt: string
  reference: string
  thesis: string
  immediatePassage: string
  bookLevelMeaning: string
  canonicalSynthesis: string
  gospelConnection: string
  doctrinalBalance: string
  applicationScope: string
  explicitBiblicalClaims: string[]
  synthesisClaims: string[]
  tensionsAndQualifications: string[]
  dimensions: Array<{ dimension: CanonicalDimension; verdict: CanonicalVerdict; finding: string; evidence: string[] }>
  verdict: CanonicalVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  thesis: z.string().min(1), immediatePassage: z.string().min(1), bookLevelMeaning: z.string().min(1), canonicalSynthesis: z.string().min(1),
  gospelConnection: z.string().min(1), doctrinalBalance: z.string().min(1), applicationScope: z.string().min(1),
  explicitBiblicalClaims: z.array(z.string()).min(1).max(12), synthesisClaims: z.array(z.string()).max(12), tensionsAndQualifications: z.array(z.string()).max(12),
  dimensions: z.array(z.object({ dimension: z.enum(['IMMEDIATE_PASSAGE','BOOK_THEOLOGY','BIBLICAL_CANON','GOSPEL_CENTRICITY','DOCTRINAL_BALANCE','APPLICATION_SCOPE']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Scripture is the final authority; this agent only organizes and audits biblical evidence.',
  'The immediate passage remains primary; canonical synthesis must not erase its local meaning.',
  'Do not build a doctrine from one isolated verse when broader canonical evidence is required.',
  'Distinguish explicit biblical teaching from theological synthesis, inference, illustration, and application.',
  'Use the book-level argument before appealing to wider canonical themes.',
  'Do not manufacture harmony by ignoring genuine biblical tensions or qualifications.',
  'Christ-centered synthesis must be warranted by the passage and canonical evidence, not forced into every text.',
  'Do not turn a general biblical truth into a personal guarantee God has not explicitly made.',
  'Material uncertainty, contradiction, or overreach must fail closed.',
  'No private or sensitive audience profiling is used.',
]

export async function reviewBiblicalTheology(input: { reference: string; intendedClaim?: string; scripture?: ScriptureKnowledge | null; context?: BiblicalContextReview | null; interpretation?: ScriptureInterpretation | null; hermeneutics?: ScriptureHermeneuticsReview | null; content?: unknown }): Promise<BiblicalTheologySynthesis> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Biblical Theology & Canonical Synthesis Agent. Audit a Christian short-form message after Scripture intelligence, context, interpretation, and hermeneutics. Move from the immediate passage to the book-level argument and then to the wider biblical canon. Identify what is explicitly taught, what is theological synthesis, and what is application. Preserve the immediate context. Do not manufacture agreement by flattening differences between passages, covenants, genres, or authors. If the content makes a doctrinal or Gospel claim, verify that the canonical evidence actually supports it. Do not rewrite the content. Return only structured JSON.\n\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nSCRIPTURE: ${JSON.stringify(input.scripture || null)}\nCONTEXT: ${JSON.stringify(input.context || null)}\nINTERPRETATION: ${JSON.stringify(input.interpretation || null)}\nHERMENEUTICS: ${JSON.stringify(input.hermeneutics || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'biblical_theology_synthesis') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Biblical theology synthesis did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V47', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateBiblicalTheology(review: BiblicalTheologySynthesis) {
  const reasons: string[] = []
  if (review.version !== 'V47') reasons.push('Invalid V47 synthesis version')
  if (!review.reference.trim()) reasons.push('Missing Scripture reference')
  if (!review.thesis || !review.immediatePassage || !review.bookLevelMeaning || !review.canonicalSynthesis || !review.gospelConnection || !review.doctrinalBalance || !review.applicationScope) reasons.push('Incomplete canonical synthesis')
  if (review.dimensions.length !== 6) reasons.push('Missing canonical dimensions')
  if (review.explicitBiblicalClaims.length < 1) reasons.push('No explicit biblical claims identified')
  if (review.guardrails.length < 10) reasons.push('Missing guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Canonical verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one canonical dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:biblical-theology:latest'
export async function saveBiblicalTheology(review: BiblicalTheologySynthesis) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getBiblicalTheology() { return redisGetJson<BiblicalTheologySynthesis>(KEY) }
