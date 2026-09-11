import OpenAI from 'openai'
import { redisGetJson, redisSetJson } from './jobs'

export type FormationVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'
export type FormationReview = {
  formationThesis: string
  prayerFaithfulness: string
  discipleshipPractices: string[]
  scripturePracticeAlignment: string
  graceAndDependence: string
  spiritualGrowthBoundaries: string[]
  communityAndChurch: string
  motivationAndHeart: string
  dimensions: Record<string, { verdict: FormationVerdict; rationale: string }>
  verdict: FormationVerdict
  confidence: number
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const KEY = 'one-million-souls:knowledge:spiritual-formation:latest'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function reviewSpiritualFormation(input: {
  reference: string
  question: string
  intendedClaim: string
  gospel?: unknown
  discipleship?: unknown
  pastoralWisdom?: unknown
  content?: unknown
}): Promise<FormationReview> {
  const response = await client.responses.create({
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    tools: [{ type: 'web_search_preview' } as any],
    input: `You are an independent Christian spiritual-formation reviewer. Review whether proposed content teaches prayer and spiritual growth faithfully without turning practices into formulas, earning mechanisms, guarantees, or substitutes for Christ and Scripture.

Reference: ${input.reference}
Question: ${input.question}
Intended claim: ${input.intendedClaim}
Gospel review: ${JSON.stringify(input.gospel || null)}
Discipleship review: ${JSON.stringify(input.discipleship || null)}
Pastoral wisdom review: ${JSON.stringify(input.pastoralWisdom || null)}
Content: ${JSON.stringify(input.content || null)}

Return ONLY valid JSON matching this shape:
{
  "formationThesis":"",
  "prayerFaithfulness":"",
  "discipleshipPractices":[],
  "scripturePracticeAlignment":"",
  "graceAndDependence":"",
  "spiritualGrowthBoundaries":[],
  "communityAndChurch":"",
  "motivationAndHeart":"",
  "dimensions":{"PRAYER":{"verdict":"FAITHFUL","rationale":""},"PRACTICE":{"verdict":"FAITHFUL","rationale":""},"GRACE":{"verdict":"FAITHFUL","rationale":""},"GROWTH":{"verdict":"FAITHFUL","rationale":""},"COMMUNITY":{"verdict":"FAITHFUL","rationale":""}},
  "verdict":"FAITHFUL",
  "confidence":0.0,
  "revisions":[],
  "evidence":[],
  "guardrails":[]
}

Use FAITHFUL/PARTIAL/UNCERTAIN/MISALIGNED/BLOCKED. Distinguish biblical commands from helpful spiritual practices. Reject prayer-as-formula, guaranteed outcomes, transactional spirituality, works-based acceptance with God, engagement-as-spiritual-growth, fabricated testimonies, and claims that a practice replaces church/community, Scripture, wisdom, or appropriate professional support. Do not diagnose spiritual conditions. Surface legitimate differences where Scripture does not prescribe one method.`
  })
  const text = response.output_text || '{}'
  const parsed = JSON.parse(text) as FormationReview
  await redisSetJson(KEY, parsed)
  return parsed
}

export async function getLatestSpiritualFormation() {
  return redisGetJson<FormationReview>(KEY)
}

export function validateSpiritualFormation(review: FormationReview) {
  const required = ['formationThesis', 'prayerFaithfulness', 'scripturePracticeAlignment', 'graceAndDependence', 'verdict', 'confidence']
  const missing = required.filter(k => !(review as any)[k])
  const validVerdicts: FormationVerdict[] = ['FAITHFUL', 'PARTIAL', 'UNCERTAIN', 'MISALIGNED', 'BLOCKED']
  const verdictOk = validVerdicts.includes(review.verdict)
  const confidenceOk = Number.isFinite(review.confidence) && review.confidence >= 0 && review.confidence <= 1
  return { ok: missing.length === 0 && verdictOk && confidenceOk, missing, verdictOk, confidenceOk }
}
