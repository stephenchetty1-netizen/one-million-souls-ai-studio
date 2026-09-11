import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ScriptureKnowledge } from './scripture-intelligence'
import type { BiblicalTheologySynthesis } from './biblical-theology'
import type { ScriptureHermeneuticsReview } from './scripture-hermeneutics'
import { redisGetJson, redisSetJson } from './jobs'

export type DoctrineDimension = 'DOCTRINAL_CLAIM' | 'CANONICAL_SUPPORT' | 'CHRISTOLOGICAL_COHERENCE' | 'GOSPEL_COHERENCE' | 'DOCTRINAL_BOUNDARIES' | 'APPLICATION_DISTINCTION'
export type DoctrineVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type BiblicalDoctrineReview = {
  version: 'V48'
  generatedAt: string
  reference: string
  doctrineArea: string
  doctrinalThesis: string
  explicitTeaching: string[]
  theologicalInferences: string[]
  doctrinalClaims: string[]
  canonicalSupport: string[]
  christologicalCoherence: string
  gospelCoherence: string
  doctrinalBoundaries: string[]
  alternativeReadings: string[]
  applicationDistinction: string
  dimensions: Array<{ dimension: DoctrineDimension; verdict: DoctrineVerdict; finding: string; evidence: string[] }>
  verdict: DoctrineVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  doctrineArea: z.string().min(1), doctrinalThesis: z.string().min(1),
  explicitTeaching: z.array(z.string()).min(1).max(12), theologicalInferences: z.array(z.string()).max(12), doctrinalClaims: z.array(z.string()).min(1).max(12),
  canonicalSupport: z.array(z.string()).min(1).max(16), christologicalCoherence: z.string().min(1), gospelCoherence: z.string().min(1),
  doctrinalBoundaries: z.array(z.string()).min(1).max(12), alternativeReadings: z.array(z.string()).max(10), applicationDistinction: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['DOCTRINAL_CLAIM','CANONICAL_SUPPORT','CHRISTOLOGICAL_COHERENCE','GOSPEL_COHERENCE','DOCTRINAL_BOUNDARIES','APPLICATION_DISTINCTION']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Scripture remains the final authority; this agent audits doctrinal reasoning rather than creating revelation.',
  'A doctrine must not be established from a single isolated verse when broader canonical evidence is required.',
  'Distinguish explicit teaching, necessary or strong inference, theological synthesis, and application.',
  'Do not invent doctrine merely because a claim sounds spiritually compelling or is popular in Christian media.',
  'Canonical support must account for relevant passages, genres, covenants, and immediate contexts.',
  'Do not flatten legitimate denominational or interpretive differences into false certainty.',
  'Christological and Gospel claims must be warranted by Scripture and must not be forced into unrelated texts.',
  'Do not turn doctrinal truth into a guaranteed individual outcome unless Scripture actually warrants that scope.',
  'Alternative readings should be surfaced when they materially affect the claim.',
  'Material uncertainty, contradiction, fabricated evidence, or doctrinal overreach fails closed.',
  'No private or sensitive audience profiling is used.',
]

export async function reviewBiblicalDoctrine(input: { reference: string; intendedClaim?: string; scripture?: ScriptureKnowledge | null; hermeneutics?: ScriptureHermeneuticsReview | null; canonicalTheology?: BiblicalTheologySynthesis | null; content?: unknown }): Promise<BiblicalDoctrineReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Biblical Doctrine & Systematic Theology Agent for a Christian content studio. Audit the doctrinal claims in a proposed short-form Christian message. Start with the supplied passage and prior hermeneutical/canonical reviews, then test whether the doctrinal claim is supported across relevant Scripture. Do not invent a creed or denominational position. Separate explicit teaching from inference, theological synthesis, and application. Surface materially relevant alternative readings. Check Christological and Gospel coherence without forcing them. If evidence is insufficient or the claim overreaches, fail closed. Do not rewrite the content. Return only structured JSON.\n\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nSCRIPTURE: ${JSON.stringify(input.scripture || null)}\nHERMENEUTICS: ${JSON.stringify(input.hermeneutics || null)}\nCANONICAL THEOLOGY: ${JSON.stringify(input.canonicalTheology || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'biblical_doctrine_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Biblical doctrine review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V48', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateBiblicalDoctrine(review: BiblicalDoctrineReview) {
  const reasons: string[] = []
  if (review.version !== 'V48') reasons.push('Invalid V48 doctrine version')
  if (!review.reference.trim() || !review.doctrineArea.trim() || !review.doctrinalThesis.trim()) reasons.push('Missing doctrinal identity')
  if (review.dimensions.length !== 6) reasons.push('Missing doctrinal dimensions')
  if (review.explicitTeaching.length < 1 || review.doctrinalClaims.length < 1) reasons.push('Missing doctrinal claims')
  if (review.guardrails.length < 11) reasons.push('Missing guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Doctrinal verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one doctrinal dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:biblical-doctrine:latest'
export async function saveBiblicalDoctrine(review: BiblicalDoctrineReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getBiblicalDoctrine() { return redisGetJson<BiblicalDoctrineReview>(KEY) }
