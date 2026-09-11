import OpenAI from 'openai'
import { z } from 'zod/v4'
import { zodTextFormat } from 'openai/helpers/zod'
import { redisGetJson, redisSetJson } from './jobs'

export type CommunityDimension = 'CHURCH_AND_FELLOWSHIP' | 'UNITY_AND_PEACE' | 'ACCOUNTABILITY' | 'SERVING_AND_STEWARDSHIP' | 'DISCIPLESHIP_RELATIONSHIPS' | 'LEADERSHIP_AND_AUTHORITY' | 'AI_AND_COMMUNITY_BOUNDARIES'
export type CommunityVerdict = 'FAITHFUL' | 'REVISE' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ChristianCommunityReview = {
  version: 'V56'
  generatedAt: string
  reference: string
  audience: string
  communityQuestion: string
  communityThesis: string
  churchAndFellowship: string
  unityAndPeace: string
  accountability: string
  servingAndStewardship: string
  discipleshipRelationships: string
  leadershipAndAuthority: string
  aiAndCommunityBoundaries: string
  dimensions: Array<{ dimension: CommunityDimension; verdict: CommunityVerdict; finding: string; evidence: string[] }>
  strengths: string[]
  risks: string[]
  recommendedCorrections: string[]
  disagreementBoundaries: string[]
  humanReviewTriggers: string[]
  verdict: CommunityVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const GUARDRAILS = [
  'Treat Scripture as the primary authority for Christian community claims.',
  'Distinguish biblical commands from prudential church practices and local traditions.',
  'Encourage real Christian fellowship rather than presenting AI interaction as church.',
  'Do not claim an AI system can replace pastors, elders, mentors, friends, or a local church.',
  'Do not pressure viewers to disclose private beliefs, trauma, conflicts, or safeguarding concerns publicly.',
  'Do not encourage isolation from healthy family, church, school, or community relationships.',
  'Do not manufacture stories of reconciliation, belonging, attendance, service, or conversion.',
  'Do not present one denomination or local church custom as universally required without biblical warrant.',
  'Respect legitimate Christian disagreement where Scripture does not prescribe one method.',
  'Do not use shame, fear, coercion, humiliation, or spiritual threats to force participation.',
  'Do not use engagement, likes, comments, or follows as evidence of Christian fellowship or maturity.',
  'Do not infer spiritual maturity from a person’s online activity.',
  'Do not make individualized pastoral, safeguarding, medical, psychological, or legal determinations.',
  'Flag material abuse, coercion, exploitation, or leadership misconduct concerns for trusted-human handling.',
  'Keep leadership and authority claims bounded by the relevant biblical texts and context.',
  'Do not encourage secrecy from trustworthy adults or church leaders when safety or safeguarding is involved.',
  'Avoid contempt toward people outside a church, denomination, tradition, or faith community.',
  'Keep community invitations accessible, voluntary, age-appropriate, and dignity-preserving.',
]

const Schema = z.object({
  audience: z.string().min(1), communityQuestion: z.string().min(1), communityThesis: z.string().min(1),
  churchAndFellowship: z.string().min(1), unityAndPeace: z.string().min(1), accountability: z.string().min(1),
  servingAndStewardship: z.string().min(1), discipleshipRelationships: z.string().min(1), leadershipAndAuthority: z.string().min(1), aiAndCommunityBoundaries: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['CHURCH_AND_FELLOWSHIP','UNITY_AND_PEACE','ACCOUNTABILITY','SERVING_AND_STEWARDSHIP','DISCIPLESHIP_RELATIONSHIPS','LEADERSHIP_AND_AUTHORITY','AI_AND_COMMUNITY_BOUNDARIES']), verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string(), evidence: z.array(z.string()) })).length(7),
  strengths: z.array(z.string()), risks: z.array(z.string()), recommendedCorrections: z.array(z.string()), disagreementBoundaries: z.array(z.string()), humanReviewTriggers: z.array(z.string()),
  verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()), evidence: z.array(z.string())
})

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const KEY = 'one-million-souls:knowledge:christian-community:latest'

export async function reviewChristianCommunity(input: { reference: string; audience?: string; question?: string; intendedClaim?: string; gospel?: unknown; discipleship?: unknown; ethics?: unknown; pastoralWisdom?: unknown; spiritualFormation?: unknown; content?: unknown }): Promise<ChristianCommunityReview> {
  const response = await client.responses.create({
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    tools: [{ type: 'web_search' }],
    input: `You are an independent Christian community and church-life reviewer. Review whether proposed content faithfully encourages church, fellowship, accountability, serving, discipleship relationships, unity, and healthy leadership while maintaining clear boundaries around AI. Scripture should govern biblical claims. Distinguish explicit teaching from prudential practice and local tradition. Surface legitimate Christian disagreement. The audience may include teenagers, so keep recommendations age-appropriate. Do not treat AI engagement as church, fellowship, accountability, discipleship, or pastoral care. Do not diagnose or make individualized safeguarding determinations. Return structured JSON only.
REFERENCE: ${input.reference}\nAUDIENCE: ${input.audience || 'general Christian audience'}\nQUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nGOSPEL: ${JSON.stringify(input.gospel || null)}\nDISCIPLESHIP: ${JSON.stringify(input.discipleship || null)}\nETHICS: ${JSON.stringify(input.ethics || null)}\nPASTORAL WISDOM: ${JSON.stringify(input.pastoralWisdom || null)}\nSPIRITUAL FORMATION: ${JSON.stringify(input.spiritualFormation || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christian_community_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christian community review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  const review: ChristianCommunityReview = { version: 'V56', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
  await redisSetJson(KEY, review, 60 * 60 * 24 * 30)
  return review
}

export function validateChristianCommunity(review: ChristianCommunityReview) {
  const reasons: string[] = []
  if (review.version !== 'V56') reasons.push('Invalid V56 community review version')
  if (!review.reference.trim() || !review.audience.trim() || !review.communityQuestion.trim() || !review.communityThesis.trim()) reasons.push('Missing community review identity')
  if (review.dimensions.length !== 7) reasons.push('Missing community dimensions')
  if (review.guardrails.length < 18) reasons.push('Missing community guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Community verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one community dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

export async function getChristianCommunity() { return redisGetJson<ChristianCommunityReview>(KEY) }
