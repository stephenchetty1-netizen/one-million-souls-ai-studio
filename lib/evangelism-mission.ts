import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { ChristCenteredGospelReview } from './christ-centered-gospel'
import type { GospelDiscipleshipReview } from './gospel-discipleship'
import { redisGetJson, redisSetJson } from './jobs'

export type MissionDimension = 'GOSPEL_CLARITY' | 'EVANGELISTIC_INVITATION' | 'DISCIPLESHIP_MISSION' | 'WITNESS' | 'URGENCY' | 'DIGNITY'
export type MissionVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type EvangelismMissionReview = {
  version: 'V51'
  generatedAt: string
  reference: string
  missionThesis: string
  gospelClarity: string
  evangelisticInvitation: string
  discipleshipMission: string
  witness: string
  urgency: string
  dignity: string
  dimensions: Array<{ dimension: MissionDimension; verdict: MissionVerdict; finding: string; evidence: string[] }>
  explicitTeaching: string[]
  reasonableApplications: string[]
  unsupportedClaims: string[]
  pressureRisks: string[]
  invitationBoundaries: string[]
  missionActions: string[]
  verdict: MissionVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  missionThesis: z.string().min(1), gospelClarity: z.string().min(1), evangelisticInvitation: z.string().min(1), discipleshipMission: z.string().min(1), witness: z.string().min(1), urgency: z.string().min(1), dignity: z.string().min(1),
  dimensions: z.array(z.object({ dimension: z.enum(['GOSPEL_CLARITY','EVANGELISTIC_INVITATION','DISCIPLESHIP_MISSION','WITNESS','URGENCY','DIGNITY']), verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), finding: z.string().min(1), evidence: z.array(z.string()).max(8) })).length(6),
  explicitTeaching: z.array(z.string()).max(12), reasonableApplications: z.array(z.string()).max(12), unsupportedClaims: z.array(z.string()).max(12), pressureRisks: z.array(z.string()).max(12), invitationBoundaries: z.array(z.string()).min(1).max(12), missionActions: z.array(z.string()).max(12),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Evangelism must communicate the Gospel truthfully; do not substitute generic positivity for the Gospel.',
  'Do not claim to know whether a viewer has converted, been saved, regenerated, or spiritually transformed.',
  'Do not use fear, shame, guilt, humiliation, coercion, threats, or fabricated spiritual consequences to obtain a response.',
  'Do not manufacture countdowns or false urgency. Urgency may be biblical when grounded in the actual message and must not become manipulation.',
  'Invitation is not proof of conversion. A prayer, comment, follow, share, or public response is not evidence of salvation.',
  'Do not pressure viewers to disclose private beliefs, personal struggles, or sensitive information publicly.',
  'Do not present a human decision, work, donation, attendance, or engagement action as earning salvation.',
  'Mission applications should encourage faithful witness and service without coercing others or promising outcomes.',
  'Distinguish explicit biblical commands from reasonable contemporary mission applications.',
  'Respect the dignity and freedom of the audience; persuasion must not become intimidation.',
  'Do not invent testimonies, conversions, divine promises, or spiritual outcomes for engagement.',
]

export async function reviewEvangelismMission(input: { reference: string; intendedClaim?: string; gospel?: ChristCenteredGospelReview | null; gospelDiscipleship?: GospelDiscipleshipReview | null; content?: unknown }): Promise<EvangelismMissionReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Evangelism & Mission Review Agent for Christian short-form content. Audit whether the proposed message faithfully communicates the Gospel and invites an appropriate biblical response toward witness, discipleship, and mission. Evaluate gospel clarity, evangelistic invitation, discipleship mission, Christian witness, urgency, and audience dignity. Distinguish explicit biblical teaching from reasonable application and unsupported claims. Never infer that engagement or a response proves conversion. Reject coercive, manipulative, shame-based, fear-based, fabricated, or works-based evangelism. Do not rewrite the content. Use public web evidence where needed. Return only structured JSON.\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nGOSPEL REVIEW: ${JSON.stringify(input.gospel || null)}\nGOSPEL & DISCIPLESHIP REVIEW: ${JSON.stringify(input.gospelDiscipleship || null)}\nCONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'evangelism_mission_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Evangelism & mission review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V51', generatedAt: new Date().toISOString(), reference: input.reference, ...result, guardrails: GUARDRAILS }
}

export function validateEvangelismMission(review: EvangelismMissionReview) {
  const reasons: string[] = []
  if (review.version !== 'V51') reasons.push('Invalid V51 review version')
  if (!review.reference.trim() || !review.missionThesis.trim()) reasons.push('Missing mission review identity')
  if (review.dimensions.length !== 6) reasons.push('Missing mission review dimensions')
  if (review.invitationBoundaries.length < 1) reasons.push('Missing invitation boundaries')
  if (review.guardrails.length < 11) reasons.push('Missing mission guardrails')
  if (review.unsupportedClaims.length > 0) reasons.push('Unsupported evangelistic or mission claims detected')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Mission verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one mission dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}

const KEY = 'one-million-souls:knowledge:evangelism-mission:latest'
export async function saveEvangelismMission(review: EvangelismMissionReview) { await redisSetJson(KEY, review, 60 * 60 * 24 * 30) }
export async function getEvangelismMission() { return redisGetJson<EvangelismMissionReview>(KEY) }
