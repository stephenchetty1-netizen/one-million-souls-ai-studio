import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import { redisGetJson, redisSetJson } from './jobs'

export type DiscernmentDimension = 'SCRIPTURAL_FAITHFULNESS' | 'GOSPEL_COHERENCE' | 'EVIDENCE_AND_TRUTH' | 'ETHICAL_AND_PASTORAL_RISK' | 'AUDIENCE_IMPACT' | 'MISSION_ALIGNMENT' | 'UNCERTAINTY_AND_LIMITS' | 'ACTION_READINESS'
export type DiscernmentVerdict = 'PROCEED' | 'REVISE' | 'RESEARCH' | 'WAIT_FOR_HUMAN_REVIEW' | 'BLOCK'

export type ChristianDiscernmentReview = {
  version: 'V59'
  generatedAt: string
  question: string
  audience: string
  proposedAction: string
  discernmentThesis: string
  scripturalFaithfulness: string
  gospelCoherence: string
  evidenceAndTruth: string
  ethicalAndPastoralRisk: string
  audienceImpact: string
  missionAlignment: string
  uncertaintyAndLimits: string
  actionReadiness: string
  dimensions: Array<{ dimension: DiscernmentDimension; verdict: DiscernmentVerdict; finding: string; evidence: string[] }>
  supportingReasons: string[]
  conflictsAndTradeoffs: string[]
  missingInformation: string[]
  humanReviewTriggers: string[]
  requiredRevisions: string[]
  prohibitedActions: string[]
  recommendedAction: 'PROCEED' | 'REVISE' | 'RESEARCH' | 'WAIT_FOR_HUMAN_REVIEW' | 'BLOCK'
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  verdict: DiscernmentVerdict
  evidence: string[]
  guardrails: string[]
}

const GUARDRAILS = [
  'Treat Scripture as the primary authority for Christian faithfulness, while distinguishing biblical teaching from prudential strategy.',
  'Do not claim private revelation, divine certainty, prophecy, or knowledge of God’s hidden will from limited information.',
  'Do not let engagement, views, follower growth, algorithms, or platform trends determine theological truth.',
  'Truth, evidence, and biblical faithfulness outrank growth optimization when the two conflict.',
  'Distinguish facts, interpretations, applications, preferences, hypotheses, and unresolved questions.',
  'Do not manufacture evidence, citations, quotations, testimonies, statistics, expert consensus, or historical claims.',
  'Surface meaningful uncertainty rather than forcing a binary conclusion.',
  'Escalate high-stakes medical, legal, financial, safeguarding, mental-health, or individualized pastoral matters to appropriate qualified humans.',
  'Do not replace pastors, parents or guardians, mentors, trusted friends, qualified professionals, or local Christian community.',
  'Protect minors and vulnerable audiences through age-appropriate language, boundaries, and escalation where needed.',
  'Do not use shame, fear, coercion, manipulation, false urgency, spiritual threats, or pressure to drive engagement or decisions.',
  'Do not claim that watching, liking, sharing, commenting, or following proves conversion, salvation, maturity, healing, or spiritual transformation.',
  'Do not present cultural preferences or denominational distinctives as universally binding biblical commands without adequate warrant.',
  'Respect legitimate Christian disagreement where Scripture and sound interpretation do not settle a matter.',
  'Do not infer a viewer’s motives, salvation, calling, spiritual condition, or future from limited audience signals.',
  'If upstream biblical, theological, ethical, pastoral, or evidence reviews materially conflict, prefer research, revision, human review, or blocking over forced publication.',
  'The discernment engine is a decision aid, not a pastor, prophet, oracle, or substitute for responsible human judgment.',
  'Fail closed when a material safety, truthfulness, biblical-faithfulness, or human-review boundary cannot be satisfied.',
]

const Schema = z.object({
  audience: z.string().min(1), question: z.string().min(1), proposedAction: z.string().min(1), discernmentThesis: z.string().min(1),
  scripturalFaithfulness: z.string().min(1), gospelCoherence: z.string().min(1), evidenceAndTruth: z.string().min(1), ethicalAndPastoralRisk: z.string().min(1), audienceImpact: z.string().min(1), missionAlignment: z.string().min(1), uncertaintyAndLimits: z.string().min(1), actionReadiness: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['SCRIPTURAL_FAITHFULNESS','GOSPEL_COHERENCE','EVIDENCE_AND_TRUTH','ETHICAL_AND_PASTORAL_RISK','AUDIENCE_IMPACT','MISSION_ALIGNMENT','UNCERTAINTY_AND_LIMITS','ACTION_READINESS']), verdict: z.enum(['PROCEED','REVISE','RESEARCH','WAIT_FOR_HUMAN_REVIEW','BLOCK']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(8),
  supportingReasons: z.array(z.string()).max(20), conflictsAndTradeoffs: z.array(z.string()).max(20), missingInformation: z.array(z.string()).max(20), humanReviewTriggers: z.array(z.string()).max(20), requiredRevisions: z.array(z.string()).max(20), prohibitedActions: z.array(z.string()).max(20),
  recommendedAction: z.enum(['PROCEED','REVISE','RESEARCH','WAIT_FOR_HUMAN_REVIEW','BLOCK']), confidence: z.enum(['LOW','MEDIUM','HIGH']), verdict: z.enum(['PROCEED','REVISE','RESEARCH','WAIT_FOR_HUMAN_REVIEW','BLOCK']), evidence: z.array(z.string()).max(30),
})

const KEY = 'one-million-souls:knowledge:christian-discernment:latest'

export async function reviewChristianDiscernment(input: { question: string; audience?: string; proposedAction?: string; reference?: string; content?: unknown; knowledge?: unknown; doctrine?: unknown; gospel?: unknown; ethics?: unknown; pastoralWisdom?: unknown; spiritualFormation?: unknown; community?: unknown; character?: unknown; wisdom?: unknown; apologetics?: unknown; evangelismMission?: unknown }): Promise<ChristianDiscernmentReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    input: `You are an independent Christian Discernment & Decision Engine. Decide whether a proposed content action is ready to proceed, needs revision, more research, human review, or must be blocked. Synthesize upstream biblical, gospel, evidence, ethical, pastoral, spiritual-formation, community, character, wisdom, apologetics, and mission signals. Never treat engagement optimization as spiritual authority. Identify conflicts, uncertainty, missing information, and escalation triggers. Return structured JSON only.\nREFERENCE: ${input.reference || ''}\nQUESTION: ${input.question}\nAUDIENCE: ${input.audience || 'general Christian audience'}\nPROPOSED ACTION: ${input.proposedAction || 'create and publish Christian short-form content'}\nCONTENT: ${JSON.stringify(input.content || null)}\nSCRIPTURE/KNOWLEDGE: ${JSON.stringify(input.knowledge || null)}\nDOCTRINE: ${JSON.stringify(input.doctrine || null)}\nGOSPEL: ${JSON.stringify(input.gospel || null)}\nAPOLOGETICS: ${JSON.stringify(input.apologetics || null)}\nEVANGELISM & MISSION: ${JSON.stringify(input.evangelismMission || null)}\nETHICS: ${JSON.stringify(input.ethics || null)}\nPASTORAL WISDOM: ${JSON.stringify(input.pastoralWisdom || null)}\nSPIRITUAL FORMATION: ${JSON.stringify(input.spiritualFormation || null)}\nCOMMUNITY: ${JSON.stringify(input.community || null)}\nCHARACTER: ${JSON.stringify(input.character || null)}\nWISDOM: ${JSON.stringify(input.wisdom || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christian_discernment_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christian discernment review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  const review: ChristianDiscernmentReview = { version: 'V59', generatedAt: new Date().toISOString(), ...result, guardrails: GUARDRAILS }
  await redisSetJson(KEY, review, 60 * 60 * 24 * 30)
  return review
}

export function validateChristianDiscernment(review: ChristianDiscernmentReview) {
  const reasons: string[] = []
  if (review.version !== 'V59') reasons.push('Invalid V59 discernment review version')
  if (!review.question.trim() || !review.audience.trim() || !review.proposedAction.trim() || !review.discernmentThesis.trim()) reasons.push('Missing discernment identity')
  if (review.dimensions.length !== 8) reasons.push('Missing discernment dimensions')
  if (review.guardrails.length < 18) reasons.push('Missing discernment guardrails')
  if (review.humanReviewTriggers.length < 1) reasons.push('Missing human-review boundary')
  if (review.verdict !== 'PROCEED') reasons.push(`Discernment verdict ${review.verdict}`)
  if (review.recommendedAction !== 'PROCEED') reasons.push(`Recommended action ${review.recommendedAction}`)
  if (review.dimensions.some(d => ['RESEARCH','WAIT_FOR_HUMAN_REVIEW','BLOCK'].includes(d.verdict))) reasons.push('At least one discernment dimension requires escalation or blocking')
  return { ok: reasons.length === 0, reasons }
}

export async function getChristianDiscernment() { return redisGetJson<ChristianDiscernmentReview>(KEY) }
