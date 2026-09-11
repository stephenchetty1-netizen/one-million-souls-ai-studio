import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import { redisGetJson, redisSetJson } from './jobs'

export type WisdomDimension = 'SCRIPTURAL_WISDOM' | 'DECISION_SCOPE' | 'MOTIVES_AND_HEART' | 'COUNSEL_AND_COMMUNITY' | 'STEWARDSHIP_AND_RESPONSIBILITY' | 'FREEDOM_AND_CONSCIENCE' | 'UNCERTAINTY_AND_PROVIDENCE' | 'PRACTICAL_APPLICATION'
export type WisdomVerdict = 'FAITHFUL' | 'REVISE' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ChristianWisdomReview = {
  version: 'V58'
  generatedAt: string
  reference: string
  audience: string
  wisdomQuestion: string
  wisdomThesis: string
  scripturalWisdom: string
  decisionScope: string
  motivesAndHeart: string
  counselAndCommunity: string
  stewardshipAndResponsibility: string
  freedomAndConscience: string
  uncertaintyAndProvidence: string
  practicalApplication: string
  dimensions: Array<{ dimension: WisdomDimension; verdict: WisdomVerdict; finding: string; evidence: string[] }>
  wisePrinciples: string[]
  optionsAndTradeoffs: string[]
  cautions: string[]
  recommendedNextSteps: string[]
  humanCounselTriggers: string[]
  overreachRisks: string[]
  recommendedCorrections: string[]
  verdict: WisdomVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const GUARDRAILS = [
  'Treat Scripture as the primary authority while distinguishing biblical teaching from prudential advice.',
  'Do not claim that an uncertain personal decision has one divinely revealed answer without sufficient biblical warrant.',
  'Distinguish commands, principles, wisdom, conscience, preference, and personal circumstance.',
  'Do not claim to know God’s hidden will, private motives, or future providence.',
  'Avoid “God told me” certainty when the evidence supports only a wise possibility or prayerful discernment.',
  'Encourage wise counsel, prayer, Scripture, and appropriate real-world information for consequential decisions.',
  'Do not replace qualified medical, legal, financial, safeguarding, educational, or pastoral advice with generic spiritual claims.',
  'Do not frame every successful outcome as proof of obedience or every hardship as proof of disobedience.',
  'Respect Christian freedom and legitimate conscience differences where Scripture does not settle a matter.',
  'Avoid superstition, signs, omens, numerology, prosperity guarantees, or deterministic promises about outcomes.',
  'Do not use fear, shame, spiritual pressure, or threats to force a decision.',
  'Do not present personality tests, algorithms, engagement metrics, or platform performance as divine guidance.',
  'Keep stewardship focused on faithfulness, responsibility, generosity, and wise use of resources rather than status or wealth.',
  'Do not imply that poverty, illness, unemployment, singleness, or other circumstances prove spiritual failure.',
  'Do not infer a viewer’s calling, gifting, salvation, maturity, or divine assignment from limited information.',
  'Surface meaningful tradeoffs and uncertainty instead of manufacturing a simplistic answer.',
  'For high-stakes or individualized situations, route toward trusted human counsel rather than pretending the AI can decide for the person.',
  'Do not fabricate testimonies, divine guidance experiences, statistics, expert opinions, or outcomes.',
]

const Schema = z.object({
  audience: z.string().min(1), wisdomQuestion: z.string().min(1), wisdomThesis: z.string().min(1),
  scripturalWisdom: z.string().min(1), decisionScope: z.string().min(1), motivesAndHeart: z.string().min(1), counselAndCommunity: z.string().min(1), stewardshipAndResponsibility: z.string().min(1), freedomAndConscience: z.string().min(1), uncertaintyAndProvidence: z.string().min(1), practicalApplication: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['SCRIPTURAL_WISDOM','DECISION_SCOPE','MOTIVES_AND_HEART','COUNSEL_AND_COMMUNITY','STEWARDSHIP_AND_RESPONSIBILITY','FREEDOM_AND_CONSCIENCE','UNCERTAINTY_AND_PROVIDENCE','PRACTICAL_APPLICATION']), verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(8),
  wisePrinciples: z.array(z.string()).max(20), optionsAndTradeoffs: z.array(z.string()).max(20), cautions: z.array(z.string()).max(20), recommendedNextSteps: z.array(z.string()).max(20), humanCounselTriggers: z.array(z.string()).max(16), overreachRisks: z.array(z.string()).max(20), recommendedCorrections: z.array(z.string()).max(20),
  verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(20), evidence: z.array(z.string()).max(24),
})

const KEY = 'one-million-souls:knowledge:christian-wisdom:latest'

export async function reviewChristianWisdom(input: { reference: string; audience?: string; question?: string; intendedClaim?: string; doctrine?: unknown; ethics?: unknown; pastoralWisdom?: unknown; character?: unknown; community?: unknown; content?: unknown }): Promise<ChristianWisdomReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    input: `You are an independent Christian Wisdom & Decision-Making Review Agent for Christian short-form content. Audit whether practical guidance reflects biblical wisdom without pretending to know God's hidden will or deciding individualized matters for viewers. Distinguish Scripture, prudence, conscience, preference, circumstance, and uncertainty. Evaluate counsel, stewardship, tradeoffs, freedom, providence, motives, and practical application. For consequential decisions, encourage appropriate trusted human counsel and real-world information. Return structured JSON only.\nREFERENCE: ${input.reference}\nAUDIENCE: ${input.audience || 'general Christian audience'}\nQUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nDOCTRINE: ${JSON.stringify(input.doctrine || null)}\nETHICS: ${JSON.stringify(input.ethics || null)}\nPASTORAL WISDOM: ${JSON.stringify(input.pastoralWisdom || null)}\nCOMMUNITY: ${JSON.stringify(input.community || null)}\nCHARACTER: ${JSON.stringify(input.character || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christian_wisdom_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christian wisdom review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  const review: ChristianWisdomReview = { version: 'V58', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
  await redisSetJson(KEY, review, 60 * 60 * 24 * 30)
  return review
}

export function validateChristianWisdom(review: ChristianWisdomReview) {
  const reasons: string[] = []
  if (review.version !== 'V58') reasons.push('Invalid V58 wisdom review version')
  if (!review.reference.trim() || !review.audience.trim() || !review.wisdomQuestion.trim() || !review.wisdomThesis.trim()) reasons.push('Missing wisdom review identity')
  if (review.dimensions.length !== 8) reasons.push('Missing wisdom dimensions')
  if (review.guardrails.length < 18) reasons.push('Missing wisdom guardrails')
  if (review.humanCounselTriggers.length < 1) reasons.push('Missing human-counsel boundary')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Wisdom verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one wisdom dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

export async function getChristianWisdom() { return redisGetJson<ChristianWisdomReview>(KEY) }
