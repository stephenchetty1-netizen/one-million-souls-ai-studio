import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { EvangelismMissionReview } from './evangelism-mission'
import type { ChristCenteredGospelReview } from './christ-centered-gospel'
import { redisGetJson, redisSetJson } from './jobs'

export type ApologeticsDimension = 'QUESTION_CLARITY' | 'OBJECTION_FAIRNESS' | 'EVIDENCE' | 'HISTORICAL_REASONING' | 'ALTERNATIVE_VIEWS' | 'FAITH_AND_LIMITS'
export type ApologeticsVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ApologeticsReview = {
  version: 'V52'
  generatedAt: string
  reference: string
  question: string
  thesis: string
  questionClarity: string
  objectionFairness: string
  evidenceAssessment: string
  historicalReasoning: string
  alternativeViews: string
  faithAndLimits: string
  dimensions: Array<{ dimension: ApologeticsDimension; verdict: ApologeticsVerdict; finding: string; evidence: string[] }>
  supportedClaims: string[]
  disputedClaims: string[]
  unsupportedClaims: string[]
  evidenceLimits: string[]
  responseBoundaries: string[]
  recommendedCorrections: string[]
  verdict: ApologeticsVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  question: z.string().min(1), thesis: z.string().min(1), questionClarity: z.string().min(1), objectionFairness: z.string().min(1), evidenceAssessment: z.string().min(1), historicalReasoning: z.string().min(1), alternativeViews: z.string().min(1), faithAndLimits: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['QUESTION_CLARITY','OBJECTION_FAIRNESS','EVIDENCE','HISTORICAL_REASONING','ALTERNATIVE_VIEWS','FAITH_AND_LIMITS']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  supportedClaims: z.array(z.string()).max(16), disputedClaims: z.array(z.string()).max(16), unsupportedClaims: z.array(z.string()).max(16), evidenceLimits: z.array(z.string()).max(16), responseBoundaries: z.array(z.string()).min(1).max(16), recommendedCorrections: z.array(z.string()).max(16),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(16), evidence: z.array(z.string()).max(20),
})

const GUARDRAILS = [
  'Represent objections and non-Christian viewpoints fairly; do not caricature or ridicule opponents.',
  'Do not manufacture historical, archaeological, manuscript, scientific, philosophical, or testimonial evidence.',
  'Distinguish evidence from interpretation, inference, tradition, and personal conviction.',
  'Do not present disputed claims as settled facts. Identify meaningful scholarly disagreement when it matters.',
  'Do not claim that an argument proves Christianity with certainty when it only provides support or makes an inference plausible.',
  'Do not use false dilemmas, ad hominem attacks, appeal to popularity, circular reasoning, or emotional pressure as substitutes for evidence.',
  'Do not misrepresent science or claim scientific findings establish theological conclusions beyond what the evidence supports.',
  'Do not invent quotations, sources, dates, manuscripts, archaeological discoveries, or expert consensus.',
  'Faith may involve trust beyond what can be demonstrated empirically; state evidence limits honestly rather than hiding them.',
  'Apologetics should serve truthful Christian witness, not humiliation or coercion.',
  'A difficult question may remain unresolved; uncertainty is preferable to fabricated certainty.',
  'Do not claim a viewer must accept an argument or convert because an objection has been answered.',
]

export async function reviewApologetics(input: { reference: string; question?: string; intendedClaim?: string; gospel?: ChristCenteredGospelReview | null; evangelismMission?: EvangelismMissionReview | null; content?: unknown }): Promise<ApologeticsReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Apologetics & Truth Defense Agent for Christian short-form content. Review a Christian response to a question or objection. Clarify the actual question, represent alternative views fairly, assess evidence and historical reasoning, identify what is supported versus disputed, and state limits of the argument. Use public web evidence where needed. Do not rewrite the content. Never manufacture evidence or certainty. The purpose is truthful witness, not coercion or humiliation. Return only structured JSON.\nREFERENCE: ${input.reference}\nQUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nGOSPEL REVIEW: ${JSON.stringify(input.gospel || null)}\nEVANGELISM REVIEW: ${JSON.stringify(input.evangelismMission || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'apologetics_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Apologetics review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V52', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateApologetics(review: ApologeticsReview) {
  const reasons: string[] = []
  if (review.version !== 'V52') reasons.push('Invalid V52 review version')
  if (!review.reference.trim() || !review.question.trim() || !review.thesis.trim()) reasons.push('Missing apologetics review identity')
  if (review.dimensions.length !== 6) reasons.push('Missing apologetics dimensions')
  if (review.responseBoundaries.length < 1) reasons.push('Missing response boundaries')
  if (review.guardrails.length < 12) reasons.push('Missing apologetics guardrails')
  if (review.unsupportedClaims.length > 0) reasons.push('Unsupported apologetics claims detected')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Apologetics verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one apologetics dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:apologetics:latest'
export async function saveApologetics(review: ApologeticsReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getApologetics() { return redisGetJson<ApologeticsReview>(KEY) }
