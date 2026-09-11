import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ApologeticsReview } from './apologetics'
import type { DoctrineReview } from './doctrine'
import type { BiblicalTheologyReview } from './biblical-theology'
import { redisGetJson, redisSetJson } from './jobs'

export type EthicsDimension = 'BIBLICAL_COMMAND' | 'BIBLICAL_PRINCIPLE' | 'WISDOM_AND_CONSCIENCE' | 'CULTURAL_APPLICATION' | 'CHRISTIAN_FREEDOM' | 'DISAGREEMENT_BOUNDARY'
export type EthicsVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ChristianEthicsReview = {
  version: 'V53'
  generatedAt: string
  reference: string
  ethicalQuestion: string
  ethicalThesis: string
  biblicalCommand: string
  biblicalPrinciple: string
  wisdomAndConscience: string
  culturalApplication: string
  christianFreedom: string
  disagreementBoundary: string
  dimensions: Array<{ dimension: EthicsDimension; verdict: EthicsVerdict; finding: string; evidence: string[] }>
  explicitCommands: string[]
  principles: string[]
  wisdomApplications: string[]
  conscienceMatters: string[]
  freedomAreas: string[]
  faithfulDisagreements: string[]
  unsupportedClaims: string[]
  coercionRisks: string[]
  applicationBoundaries: string[]
  recommendedCorrections: string[]
  verdict: EthicsVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  ethicalQuestion: z.string().min(1), ethicalThesis: z.string().min(1), biblicalCommand: z.string().min(1), biblicalPrinciple: z.string().min(1), wisdomAndConscience: z.string().min(1), culturalApplication: z.string().min(1), christianFreedom: z.string().min(1), disagreementBoundary: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['BIBLICAL_COMMAND','BIBLICAL_PRINCIPLE','WISDOM_AND_CONSCIENCE','CULTURAL_APPLICATION','CHRISTIAN_FREEDOM','DISAGREEMENT_BOUNDARY']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  explicitCommands: z.array(z.string()).max(16), principles: z.array(z.string()).max(16), wisdomApplications: z.array(z.string()).max(16), conscienceMatters: z.array(z.string()).max(16), freedomAreas: z.array(z.string()).max(16), faithfulDisagreements: z.array(z.string()).max(16), unsupportedClaims: z.array(z.string()).max(16), coercionRisks: z.array(z.string()).max(16), applicationBoundaries: z.array(z.string()).min(1).max(16), recommendedCorrections: z.array(z.string()).max(16), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(16), evidence: z.array(z.string()).max(20),
})

const GUARDRAILS = [
  'Distinguish explicit biblical commands from principles, wisdom, prudential judgment, and contemporary application.',
  'Do not present a modern cultural preference as if Scripture explicitly commands it.',
  'Do not turn a biblical principle into a detailed rule that Scripture itself does not state.',
  'Respect legitimate Christian conscience and freedom where Scripture permits faithful disagreement.',
  'Do not use guilt, shame, fear, social pressure, or spiritual threats to force agreement on disputable matters.',
  'Distinguish moral certainty from areas of wisdom, prudence, and pastoral judgment.',
  'Do not claim that every ethical question has one explicit verse-level answer.',
  'Do not invent biblical commands, quotations, prohibitions, permissions, or divine promises.',
  'Do not confuse descriptive biblical narratives with universal moral commands without contextual support.',
  'Do not flatten cultural and historical differences when applying ancient commands today.',
  'When faithful Christians disagree, represent the disagreement fairly and identify the actual point of dispute.',
  'Do not make platform engagement, popularity, or audience reaction a test of moral truth.',
  'Ethical application should be proportionate to the evidence and should not exceed the biblical basis.',
  'When uncertainty is material, prefer careful qualification or human review over fabricated certainty.',
]

export async function reviewChristianEthics(input: { reference: string; question?: string; intendedClaim?: string; doctrine?: DoctrineReview | null; canonicalTheology?: BiblicalTheologyReview | null; apologetics?: ApologeticsReview | null; content?: unknown }): Promise<ChristianEthicsReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Christian Ethics & Moral Reasoning Review Agent for Christian short-form content. Audit an ethical or moral claim without rewriting the content. Distinguish explicit biblical commands, biblical principles, wisdom and conscience, cultural application, Christian freedom, and legitimate areas of disagreement. Check whether the proposed application exceeds the biblical evidence. Represent faithful disagreement fairly. Use public web evidence where needed. Never manufacture commands, prohibitions, permissions, quotations, or certainty. Return only structured JSON.\nREFERENCE: ${input.reference}\nETHICAL QUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nDOCTRINE REVIEW: ${JSON.stringify(input.doctrine || null)}\nCANONICAL THEOLOGY: ${JSON.stringify(input.canonicalTheology || null)}\nAPOLOGETICS REVIEW: ${JSON.stringify(input.apologetics || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christian_ethics_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christian ethics review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V53', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateChristianEthics(review: ChristianEthicsReview) {
  const reasons: string[] = []
  if (review.version !== 'V53') reasons.push('Invalid V53 ethics review version')
  if (!review.reference.trim() || !review.ethicalQuestion.trim() || !review.ethicalThesis.trim()) reasons.push('Missing ethics review identity')
  if (review.dimensions.length !== 6) reasons.push('Missing ethics review dimensions')
  if (review.applicationBoundaries.length < 1) reasons.push('Missing ethical application boundaries')
  if (review.guardrails.length < 14) reasons.push('Missing ethics guardrails')
  if (review.unsupportedClaims.length > 0) reasons.push('Unsupported ethical claims detected')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Ethics verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one ethics dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:christian-ethics:latest'
export async function saveChristianEthics(review: ChristianEthicsReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getChristianEthics() { return redisGetJson<ChristianEthicsReview>(KEY) }
