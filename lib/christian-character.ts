import OpenAI from 'openai'
import { z } from 'zod/v4'
import { zodTextFormat } from 'openai/helpers/zod'
import { redisGetJson, redisSetJson } from './jobs'

export type CharacterDimension = 'LOVE_AND_COMPASSION' | 'HUMILITY_AND_SERVANTHOOD' | 'INTEGRITY_AND_TRUTHFULNESS' | 'PATIENCE_AND_SELF_CONTROL' | 'COURAGE_AND_FAITHFULNESS' | 'MERCY_AND_FORGIVENESS' | 'CHRISTLIKE_MOTIVATION' | 'GRACE_AND_WORKS_BOUNDARY'
export type CharacterVerdict = 'FAITHFUL' | 'REVISE' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ChristianCharacterReview = {
  version: 'V57'
  generatedAt: string
  reference: string
  audience: string
  characterQuestion: string
  characterThesis: string
  loveAndCompassion: string
  humilityAndServanthood: string
  integrityAndTruthfulness: string
  patienceAndSelfControl: string
  courageAndFaithfulness: string
  mercyAndForgiveness: string
  christlikeMotivation: string
  graceAndWorksBoundary: string
  dimensions: Array<{ dimension: CharacterDimension; verdict: CharacterVerdict; finding: string; evidence: string[] }>
  strengths: string[]
  risks: string[]
  virtuesEncouraged: string[]
  practicesAndApplications: string[]
  graceBoundaries: string[]
  performanceRisks: string[]
  recommendedCorrections: string[]
  humanReviewTriggers: string[]
  verdict: CharacterVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const GUARDRAILS = [
  'Present Christian character as the fruit and formation of grace, not a way to earn salvation or God’s acceptance.',
  'Center character formation on Christ, the Holy Spirit, Scripture, and faithful discipleship rather than self-optimization.',
  'Distinguish biblical commands and virtues from culturally preferred personality traits or productivity ideals.',
  'Do not claim that a person’s online engagement, appearance, success, or platform growth proves spiritual maturity.',
  'Do not infer a person’s heart, salvation, motives, or spiritual condition from limited content or behavior.',
  'Avoid shame, humiliation, fear, coercion, or comparison as tools for producing Christian character.',
  'Do not frame suffering, weakness, illness, poverty, or hardship as automatic proof of moral or spiritual failure.',
  'Do not promise that practicing a virtue guarantees a particular earthly outcome.',
  'Represent biblical virtues in context and avoid reducing them to slogans detached from Scripture.',
  'Distinguish repentance and obedience from perfectionism or sinless-performance expectations.',
  'Do not turn personality differences into moral failures without biblical warrant.',
  'Encourage practical obedience while acknowledging dependence on God and the need for grace.',
  'Keep forgiveness distinct from excusing abuse, removing wise boundaries, or bypassing appropriate accountability.',
  'Do not encourage secrecy or isolation when safety, abuse, exploitation, or safeguarding concerns arise.',
  'Avoid manipulative “prove your faith” challenges or engagement-driven tests of Christian commitment.',
  'Do not fabricate testimonies, transformed lives, miracles, or character outcomes.',
  'Respect legitimate Christian disagreement over prudential methods of spiritual formation.',
  'When the content makes individualized pastoral or mental-health claims, prefer trusted human support and careful boundaries.',
]

const Schema = z.object({
  audience: z.string().min(1), characterQuestion: z.string().min(1), characterThesis: z.string().min(1),
  loveAndCompassion: z.string().min(1), humilityAndServanthood: z.string().min(1), integrityAndTruthfulness: z.string().min(1), patienceAndSelfControl: z.string().min(1), courageAndFaithfulness: z.string().min(1), mercyAndForgiveness: z.string().min(1), christlikeMotivation: z.string().min(1), graceAndWorksBoundary: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['LOVE_AND_COMPASSION','HUMILITY_AND_SERVANTHOOD','INTEGRITY_AND_TRUTHFULNESS','PATIENCE_AND_SELF_CONTROL','COURAGE_AND_FAITHFULNESS','MERCY_AND_FORGIVENESS','CHRISTLIKE_MOTIVATION','GRACE_AND_WORKS_BOUNDARY']), verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(8),
  strengths: z.array(z.string()).max(16), risks: z.array(z.string()).max(16), virtuesEncouraged: z.array(z.string()).max(20), practicesAndApplications: z.array(z.string()).max(20), graceBoundaries: z.array(z.string()).max(20), performanceRisks: z.array(z.string()).max(20), recommendedCorrections: z.array(z.string()).max(20), humanReviewTriggers: z.array(z.string()).max(16),
  verdict: z.enum(['FAITHFUL','REVISE','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(20), evidence: z.array(z.string()).max(24),
})

const KEY = 'one-million-souls:knowledge:christian-character:latest'

export async function reviewChristianCharacter(input: { reference: string; audience?: string; question?: string; intendedClaim?: string; doctrine?: unknown; gospel?: unknown; discipleship?: unknown; ethics?: unknown; pastoralWisdom?: unknown; spiritualFormation?: unknown; community?: unknown; content?: unknown }): Promise<ChristianCharacterReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_REVIEW_MODEL || 'gpt-5-mini',
    input: `You are an independent Christian Character & Virtue Review Agent for Christian short-form content. Audit whether the content faithfully encourages Christlike character such as love, humility, integrity, patience, self-control, courage, faithfulness, mercy, and forgiveness. Keep character formation rooted in grace and discipleship rather than works-based salvation or self-optimization. Distinguish biblical virtue from personality preference and prudential methods. Do not infer a viewer's heart or salvation. Review the material for manipulation, shame, perfectionism, false promises, and harmful overreach. Return structured JSON only.\nREFERENCE: ${input.reference}\nAUDIENCE: ${input.audience || 'general Christian audience'}\nQUESTION: ${input.question || ''}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nDOCTRINE: ${JSON.stringify(input.doctrine || null)}\nGOSPEL: ${JSON.stringify(input.gospel || null)}\nDISCIPLESHIP: ${JSON.stringify(input.discipleship || null)}\nETHICS: ${JSON.stringify(input.ethics || null)}\nPASTORAL WISDOM: ${JSON.stringify(input.pastoralWisdom || null)}\nSPIRITUAL FORMATION: ${JSON.stringify(input.spiritualFormation || null)}\nCOMMUNITY: ${JSON.stringify(input.community || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    tools: [{ type: 'web_search' }],
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'christian_character_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Christian character review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  const review: ChristianCharacterReview = { version: 'V57', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
  await redisSetJson(KEY, review, 60 * 60 * 24 * 30)
  return review
}

export function validateChristianCharacter(review: ChristianCharacterReview) {
  const reasons: string[] = []
  if (review.version !== 'V57') reasons.push('Invalid V57 character review version')
  if (!review.reference.trim() || !review.audience.trim() || !review.characterQuestion.trim() || !review.characterThesis.trim()) reasons.push('Missing character review identity')
  if (review.dimensions.length !== 8) reasons.push('Missing character dimensions')
  if (review.guardrails.length < 18) reasons.push('Missing character guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Character verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one character dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

export async function getChristianCharacter() { return redisGetJson<ChristianCharacterReview>(KEY) }
