import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ChristianEthicsReview } from './christian-ethics'
import type { TheologicalConsistencyReview } from './theological-consistency'
import { redisGetJson, redisSetJson } from './jobs'

export type PastoralDimension = 'AUDIENCE_CARE' | 'TONE_AND_COMPASSION' | 'AGE_APPROPRIATENESS' | 'HARM_AND_VULNERABILITY' | 'PRACTICAL_WISDOM' | 'PASTORAL_BOUNDARIES' | 'NEXT_STEP_AND_SUPPORT'
export type PastoralVerdict = 'PASTORALLY_SOUND' | 'REVISE' | 'UNCERTAIN' | 'HARMFUL' | 'BLOCKED'

export type PastoralWisdomReview = {
  version: 'V54'
  generatedAt: string
  reference: string
  audience: string
  pastoralQuestion: string
  pastoralThesis: string
  audienceCare: string
  toneAndCompassion: string
  ageAppropriateness: string
  harmAndVulnerability: string
  practicalWisdom: string
  pastoralBoundaries: string
  nextStepAndSupport: string
  dimensions: Array<{ dimension: PastoralDimension; verdict: PastoralVerdict; finding: string; evidence: string[] }>
  strengths: string[]
  careRisks: string[]
  harmfulPatterns: string[]
  assumptions: string[]
  recommendedCorrections: string[]
  supportBoundaries: string[]
  humanReviewTriggers: string[]
  verdict: PastoralVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  audience: z.string().min(1), pastoralQuestion: z.string().min(1), pastoralThesis: z.string().min(1), audienceCare: z.string().min(1), toneAndCompassion: z.string().min(1), ageAppropriateness: z.string().min(1), harmAndVulnerability: z.string().min(1), practicalWisdom: z.string().min(1), pastoralBoundaries: z.string().min(1), nextStepAndSupport: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['AUDIENCE_CARE','TONE_AND_COMPASSION','AGE_APPROPRIATENESS','HARM_AND_VULNERABILITY','PRACTICAL_WISDOM','PASTORAL_BOUNDARIES','NEXT_STEP_AND_SUPPORT']), verdict: z.enum(['PASTORALLY_SOUND','REVISE','UNCERTAIN','HARMFUL','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(7),
  strengths: z.array(z.string()).max(16), careRisks: z.array(z.string()).max(16), harmfulPatterns: z.array(z.string()).max(16), assumptions: z.array(z.string()).max(16), recommendedCorrections: z.array(z.string()).max(16), supportBoundaries: z.array(z.string()).min(1).max(16), humanReviewTriggers: z.array(z.string()).max(16),
  verdict: z.enum(['PASTORALLY_SOUND','REVISE','UNCERTAIN','HARMFUL','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(16), evidence: z.array(z.string()).max(20),
})

const GUARDRAILS = [
  'Pastoral review supports responsible content; it does not replace a pastor, parent, guardian, qualified counselor, clinician, emergency service, or accountable church leadership.',
  'Treat viewers with dignity; never shame, ridicule, threaten, manipulate, or pressure them to disclose private experiences or beliefs.',
  'Keep compassion consistent with biblical truth; do not use empathy to affirm claims that Scripture does not support.',
  'Distinguish spiritual encouragement from medical, psychological, legal, financial, or safeguarding advice.',
  'Do not diagnose mental-health conditions, trauma, abuse, addiction, or spiritual states from limited audience information.',
  'Do not promise that prayer, faith, obedience, or church participation will automatically produce a specific health, emotional, financial, or life outcome.',
  'Use age-appropriate language and avoid content that could expose minors to unnecessary adult themes or unsafe instructions.',
  'For high-risk or crisis-related situations, encourage appropriate trusted-human or professional support rather than pretending the content can provide individualized care.',
  'Do not encourage secrecy from safe adults, guardians, pastors, or qualified professionals when safeguarding or serious harm may be involved.',
  'Do not claim to know whether a viewer is saved, healed, delivered, forgiven, traumatized, abused, or spiritually mature based on engagement or a short message.',
  'Offer practical next steps that are proportionate, reversible where possible, and consistent with the evidence and biblical basis.',
  'When material pastoral uncertainty exists, fail closed or route to human review instead of inventing certainty.',
  'Avoid spiritualizing every problem; acknowledge ordinary means of help, community, wisdom, and professional care where appropriate.',
  'Pastoral tone must never become coercive evangelism or emotional exploitation.',
]

export async function reviewPastoralWisdom(input: { reference: string; audience?: string; question?: string; intendedClaim?: string; ethics?: EthicsReview | null; theology?: TheologicalConsistencyReview | null; content?: unknown }): Promise<PastoralWisdomReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Pastoral Wisdom & Audience Care Review Agent for a Christian short-form content studio. Audit content for pastoral responsibility without rewriting it. Evaluate audience care, compassionate tone, age appropriateness, vulnerability and harm risks, practical wisdom, pastoral boundaries, and responsible next steps. The studio serves a broad audience and may include teenagers, so keep language age-appropriate and do not provide individualized medical, psychological, legal, or safeguarding determinations. Distinguish spiritual encouragement from professional care. Never diagnose viewers or claim to know their spiritual state. If a topic could require trusted-human or professional intervention, identify that boundary. Return only structured JSON.
REFERENCE: ${input.reference}\nAUDIENCE: ${input.audience || 'general Christian audience'}\nPASTORAL QUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nETHICS REVIEW: ${JSON.stringify(input.ethics || null)}\nTHEOLOGY REVIEW: ${JSON.stringify(input.theology || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'pastoral_wisdom_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Pastoral wisdom review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V54', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validatePastoralWisdom(review: PastoralWisdomReview) {
  const reasons: string[] = []
  if (review.version !== 'V54') reasons.push('Invalid V54 pastoral review version')
  if (!review.reference.trim() || !review.audience.trim() || !review.pastoralQuestion.trim() || !review.pastoralThesis.trim()) reasons.push('Missing pastoral review identity')
  if (review.dimensions.length !== 7) reasons.push('Missing pastoral dimensions')
  if (review.supportBoundaries.length < 1) reasons.push('Missing pastoral support boundaries')
  if (review.guardrails.length < 14) reasons.push('Missing pastoral guardrails')
  if (['UNCERTAIN','HARMFUL','BLOCKED'].includes(review.verdict)) reasons.push(`Pastoral verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','HARMFUL','BLOCKED'].includes(d.verdict))) reasons.push('At least one pastoral dimension is not autonomous-safe')
  if (review.harmfulPatterns.length > 0) reasons.push('Potentially harmful pastoral patterns detected')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:pastoral-wisdom:latest'
export async function savePastoralWisdom(review: PastoralWisdomReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getPastoralWisdom() { return redisGetJson<PastoralWisdomReview>(KEY) }
