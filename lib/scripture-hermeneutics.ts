import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { BiblicalContextReview } from './biblical-context'
import type { ScriptureInterpretation } from './scripture-interpretation'
import type { ScriptureKnowledge } from './scripture-intelligence'

export type HermeneuticDimension = 'GENRE' | 'AUTHORIAL_INTENT' | 'ORIGINAL_AUDIENCE' | 'COVENANTAL_SETTING' | 'GRAMMATICAL_SCOPE' | 'CANONICAL_HARMONY'
export type HermeneuticVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'

export type ScriptureHermeneuticsReview = {
  version: 'V46'
  generatedAt: string
  reference: string
  passage: string
  dimensions: Array<{ dimension: HermeneuticDimension; verdict: HermeneuticVerdict; finding: string; evidence: string[] }>
  authorialIntent: string
  originalAudience: string
  genreAndScope: string
  covenantalSetting: string
  canonicalHarmony: string
  interpretiveMethod: string
  hermeneuticalRisks: string[]
  applicationImplications: string[]
  verdict: HermeneuticVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  dimensions: z.array(z.object({
    dimension: z.enum(['GENRE','AUTHORIAL_INTENT','ORIGINAL_AUDIENCE','COVENANTAL_SETTING','GRAMMATICAL_SCOPE','CANONICAL_HARMONY']),
    verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']),
    finding: z.string().min(1),
    evidence: z.array(z.string()).max(8),
  })).length(6),
  authorialIntent: z.string().min(1), originalAudience: z.string().min(1), genreAndScope: z.string().min(1),
  covenantalSetting: z.string().min(1), canonicalHarmony: z.string().min(1), interpretiveMethod: z.string().min(1),
  hermeneuticalRisks: z.array(z.string()).max(12), applicationImplications: z.array(z.string()).max(12),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']),
  confidence: z.enum(['LOW','MEDIUM','HIGH']), revisions: z.array(z.string()).max(12), evidence: z.array(z.string()).max(16),
})

const GUARDRAILS = [
  'Scripture is the primary authority; AI is only an interpretive aid.',
  'Interpret according to genre, context, authorial intent, audience, grammar, and canonical context.',
  'Do not impose a modern meaning on an ancient text without demonstrating the interpretive bridge.',
  'Do not treat narrative description as automatically prescriptive instruction.',
  'Do not universalize promises, commands, symbols, or experiences beyond their textual scope.',
  'Distinguish Israel-specific, church-specific, wisdom, prophetic, covenantal, and universally applicable claims where relevant.',
  'Canonical harmony must not erase the distinct meaning of the immediate passage.',
  'When historical or interpretive evidence is materially uncertain, fail closed rather than guess.',
  'Do not manufacture authorial intent, audience details, cultural facts, or theological conclusions.',
  'No private or sensitive audience profiling is used.',
]

export async function reviewScriptureHermeneutics(input: {
  reference: string
  passage?: string
  intendedClaim?: string
  scripture?: ScriptureKnowledge | null
  context?: BiblicalContextReview | null
  interpretation?: ScriptureInterpretation | null
  content?: unknown
}): Promise<ScriptureHermeneuticsReview> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Biblical Hermeneutics Review Agent. Review the interpretive method applied to a Christian short-form message. Determine whether the proposed interpretation respects genre, authorial intent, original audience, covenantal setting, grammatical scope, and harmony with the rest of Scripture. Use public web evidence where needed. Do not rewrite the content. Do not assume a conclusion is correct because it is devotional or popular. Explicitly identify interpretive risks such as proof-texting, genre confusion, universalizing a local promise, ignoring covenantal setting, or confusing description with prescription. A material hermeneutical mismatch must be MISALIGNED or BLOCKED. Return only structured JSON.\n\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nSCRIPTURE INTELLIGENCE: ${JSON.stringify(input.scripture || null)}\nBIBLICAL CONTEXT: ${JSON.stringify(input.context || null)}\nSCRIPTURE INTERPRETATION: ${JSON.stringify(input.interpretation || null)}\nPROPOSED CONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'scripture_hermeneutics_review') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Biblical hermeneutics review did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  return { version: 'V46', generatedAt: new Date().toISOString(), reference: input.reference, passage: input.passage || '', ...result, guardrails: GUARDRAILS }
}

export function validateScriptureHermeneutics(review: ScriptureHermeneuticsReview) {
  const reasons: string[] = []
  if (review.version !== 'V46') reasons.push('Invalid V46 hermeneutics version')
  if (!review.reference.trim()) reasons.push('Missing Scripture reference')
  if (review.dimensions.length !== 6) reasons.push('Missing required hermeneutic dimensions')
  if (!review.authorialIntent || !review.originalAudience || !review.genreAndScope || !review.covenantalSetting || !review.canonicalHarmony) reasons.push('Incomplete hermeneutic review')
  if (review.guardrails.length < 10) reasons.push('Missing hermeneutic guardrails')
  if (['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Hermeneutic verdict ${review.verdict}`)
  if (review.dimensions.some(d => ['UNCERTAIN','MISALIGNED','BLOCKED'].includes(d.verdict))) reasons.push('At least one hermeneutic dimension is not autonomous-safe')
  return { ok: reasons.length === 0, reasons }
}
