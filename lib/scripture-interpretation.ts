import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import type { BiblicalContextReview } from './biblical-context'
import type { ScriptureKnowledge } from './scripture-intelligence'

export type InterpretationVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED'
export type ScriptureInterpretation = {
  version: 'V45'
  generatedAt: string
  reference: string
  textMeaning: string
  contextualMeaning: string
  theologicalMeaning: string
  application: string
  explicitTeaching: string[]
  inferenceOrApplication: string[]
  boundaries: string[]
  verdict: InterpretationVerdict
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  concerns: string[]
  revisions: string[]
  evidence: string[]
  guardrails: string[]
}

const Schema = z.object({
  textMeaning: z.string().min(1), contextualMeaning: z.string().min(1), theologicalMeaning: z.string().min(1), application: z.string().min(1),
  explicitTeaching: z.array(z.string()).min(1).max(10), inferenceOrApplication: z.array(z.string()).max(10), boundaries: z.array(z.string()).min(1).max(10),
  verdict: z.enum(['FAITHFUL','PARTIAL','UNCERTAIN','MISALIGNED','BLOCKED']), confidence: z.enum(['LOW','MEDIUM','HIGH']),
  concerns: z.array(z.string()).max(10), revisions: z.array(z.string()).max(10), evidence: z.array(z.string()).max(12),
})
const GUARDRAILS = [
  'Scripture remains the primary authority; AI is an interpretive aid, not a biblical authority.',
  'Separate textual meaning, contextual meaning, theological synthesis, inference, and contemporary application.',
  'Do not turn a descriptive passage into a universal promise without evidence.',
  'Do not force Christological or devotional conclusions that the supplied evidence cannot support.',
  'Do not invent historical, grammatical, literary, cultural, or theological facts.',
  'Material uncertainty or misalignment must block autonomous publication.',
  'Do not fabricate quotations, testimony, statistics, or spiritual guarantees.',
  'No private or sensitive audience profiling is used.',
]

export async function interpretScripture(input: { reference:string; intendedClaim?:string; scripture?:ScriptureKnowledge|null; context?:BiblicalContextReview|null; content?:unknown }): Promise<ScriptureInterpretation> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    input: `You are the Autonomous Scripture Interpretation Agent. Independently assess how a Christian short-form message uses the supplied biblical passage. First state what the text says, then its meaning in context, then a careful theological synthesis, and only then distinguish responsible contemporary application. Do not rewrite the content. Be conservative: when evidence is incomplete, say so. A material mismatch between the intended claim and the passage must be MISALIGNED or BLOCKED. Return only the structured review.\n\nREFERENCE: ${input.reference}\nINTENDED CLAIM: ${input.intendedClaim || ''}\nSCRIPTURE INTELLIGENCE: ${JSON.stringify(input.scripture || null)}\nCONTEXT REVIEW: ${JSON.stringify(input.context || null)}\nPROPOSED CONTENT: ${JSON.stringify(input.content || null)}\nGUARDRAILS: ${GUARDRAILS.join(' ')}`,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(Schema, 'scripture_interpretation') },
  })
  if (response.status !== 'completed' || !response.output_parsed) throw new Error('Scripture interpretation did not complete with valid structured output.')
  const result = response.output_parsed as z.infer<typeof Schema>
  const verdict = result.verdict
  return { version:'V45', generatedAt:new Date().toISOString(), reference:input.reference, ...result, verdict, guardrails:GUARDRAILS }
}

export function validateScriptureInterpretation(review: ScriptureInterpretation) {
  const reasons:string[]=[]
  if(review.version!=='V45') reasons.push('Invalid V45 interpretation version')
  if(!review.reference || !review.textMeaning || !review.contextualMeaning || !review.theologicalMeaning || !review.application) reasons.push('Incomplete interpretation')
  if(review.explicitTeaching.length<1 || review.boundaries.length<1) reasons.push('Missing teaching or boundaries')
  if(review.guardrails.length<8) reasons.push('Missing guardrails')
  if(['UNCERTAIN','MISALIGNED','BLOCKED'].includes(review.verdict)) reasons.push(`Interpretation verdict ${review.verdict}`)
  return { ok: reasons.length===0, reasons }
}
