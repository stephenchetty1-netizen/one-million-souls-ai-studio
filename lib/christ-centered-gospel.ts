import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ScriptureKnowledge } from './scripture-intelligence'
import type { ScriptureInterpretationReview } from './scripture-interpretation'
import type { BiblicalDoctrineReview } from './biblical-doctrine'
import { redisGetJson, redisSetJson } from './jobs'

export type GospelDimension = 'CHRIST_CENTRICITY' | 'GOSPEL_ACCURACY' | 'GRACE_FAITH_RESPONSE' | 'CROSS_RESURRECTION' | 'KINGDOM_DISCIPLESHIP' | 'INVITATION_SCOPE'
export type GospelVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ChristCenteredGospelReview = {
  version: 'V49'
  generatedAt: string
  reference: string
  gospelThesis: string
  christConnection: string
  gospelSummary: string
  explicitGospelElements: string[]
  inferredGospelConnections: string[]
  graceAndResponse: string
  crossAndResurrection: string
  kingdomAndDiscipleship: string
  invitationScope: string
  whatMustNotBeForced: string[]
  dimensions: Array<{ dimension: GospelDimension; verdict: GospelVerdict; finding: string; evidence: string[] }>
  verdict: GospelVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  gospelThesis: z.string().min(1), christConnection: z.string().min(1), gospelSummary: z.string().min(1),
  explicitGospelElements: z.array(z.string()).min(1).max(10), inferredGospelConnections: z.array(z.string()).max(10),
  graceAndResponse: z.string().min(1), crossAndResurrection: z.string().min(1), kingdomAndDiscipleship: z.string().min(1), invitationScope: z.string().min(1),
  whatMustNotBeForced: z.array(z.string()).min(1).max(10),
  dimensions: z.array(z.object({ dimension: z.enum(['CHRIST_CENTRICITY','GOSPEL_ACCURACY','GRACE_FAITH_RESPONSE','CROSS_RESURRECTION','KINGDOM_DISCIPLESHIP','INVITATION_SCOPE']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Jesus Christ and the Gospel must be presented truthfully; Gospel language must not be added merely to make content sound Christian.',
  'Distinguish a passage’s explicit meaning from a legitimate canonical connection to Christ and the Gospel.',
  'Do not force Christ-centered symbolism or allegory into a text when the connection is not warranted.',
  'Do not reduce the Gospel to generic positivity, prosperity, self-help, or guaranteed personal outcomes.',
  'Grace, repentance, faith, discipleship, and obedience must not be collapsed into earning salvation.',
  'Do not imply salvation by works, performance, platform success, or emotional intensity.',
  'Where relevant, preserve the biblical significance of Christ’s death and resurrection without inventing details.',
  'Invitation language must match the evidence and must not use fear, shame, manipulation, or fabricated spiritual guarantees.',
  'Kingdom and discipleship applications must not be presented as substitutes for the Gospel.',
  'Respect legitimate denominational differences and avoid declaring secondary disputes as the Gospel itself.',
  'Material Gospel distortion, forced Christology, fabricated evidence, or unsupported salvation claims fails closed.',
]

export async function reviewChristCenteredGospel(input: { reference: string; intendedClaim?: string; scripture?: ScriptureKnowledge | null; interpretation?: ScriptureInterpretationReview | null; doctrine?: BiblicalDoctrineReview | null; content?: unknown }): Promise<ChristCenteredGospelReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Christ-Centered Gospel Review Agent for a Christian content studio. Audit whether a proposed short-form Christian message is genuinely centered on Jesus and accurately communicates the Gospel. Do not force Jesus-language into a passage merely for branding. Begin with the passage's established meaning, then assess whether the proposed Christ/Gospel connection is direct, canonical, typological where warranted, or merely an application. Check the biblical pattern of grace, repentance, faith, discipleship, Christ's death and resurrection, and invitation. Do not rewrite the content. Return only structured JSON. Fail closed on material Gospel distortion, works-based salvation, prosperity guarantees, manipulative invitations, fabricated claims, or forced Christological connections.

REFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nSCRIPTURE: ${JSON.stringify(input.scripture || null)}\nINTERPRETATION: ${JSON.stringify(input.interpretation || null)}\nDOCTRINE: ${JSON.stringify(input.doctrine || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christ_centered_gospel_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christ-centered Gospel review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V49', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateChristCenteredGospel(review: ChristCenteredGospelReview) {
  const reasons: string[] = []
  if (review.version !== 'V49') reasons.push('Invalid V49 Gospel review version')
  if (!review.reference.trim() || !review.gospelThesis.trim() || !review.christConnection.trim()) reasons.push('Missing Gospel identity')
  if (review.dimensions.length !== 6) reasons.push('Missing Gospel dimensions')
  if (review.explicitGospelElements.length < 1) reasons.push('Missing explicit Gospel elements')
  if (review.guardrails.length < 11) reasons.push('Missing Gospel guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Gospel verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one Gospel dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:christ-centered-gospel:latest'
export async function saveChristCenteredGospel(review: ChristCenteredGospelReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getChristCenteredGospel() { return redisGetJson<ChristCenteredGospelReview>(KEY) }
