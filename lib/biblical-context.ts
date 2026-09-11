import OpenAI from 'openai';
import type { ScriptureKnowledge } from './scripture-intelligence';
import type { ClaimVerification } from './claim-verification';
import { redisGetJson, redisSetJson } from './jobs';

export type ContextDimension = 'LITERARY' | 'HISTORICAL' | 'GRAMMATICAL' | 'IMMEDIATE_PASSAGE';
export type ContextVerdict = 'FAITHFUL' | 'PARTIAL' | 'UNCERTAIN' | 'MISALIGNED' | 'BLOCKED';

export interface BiblicalContextReview {
  version: 'V44';
  generatedAt: string;
  reference: string;
  passage: string;
  dimensions: Array<{ dimension: ContextDimension; verdict: ContextVerdict; finding: string; evidence: string[] }>;
  overallVerdict: ContextVerdict;
  safeUse: string;
  revisions: string[];
  evidence: string[];
  guardrails: string[];
}

const GUARDRAILS = [
  'Do not treat AI as biblical authority.',
  'Do not invent historical, grammatical, or literary facts.',
  'Distinguish what the passage says from application or inference.',
  'Do not force a verse to support a predetermined message.',
  'Escalate material uncertainty rather than guessing.',
  'No private or sensitive audience profiling is used.',
];

function parseJson(text: string): any {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

export async function reviewBiblicalContext(input: {
  reference: string;
  passage?: string;
  intendedClaim?: string;
  scripture?: ScriptureKnowledge | null;
  claims?: ClaimVerification[];
}): Promise<BiblicalContextReview> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    tools: [{ type: 'web_search' }],
    input: [
      {
        role: 'system',
        content: `You are a cautious biblical context reviewer. Review a proposed Christian content use of Scripture across literary, historical, grammatical, and immediate-passage context. Use web search for public evidence. Never invent facts. Treat Scripture as primary authority and clearly separate textual observation from interpretation/application. Return ONLY valid JSON matching the requested schema. A material contextual mismatch must be MISALIGNED or BLOCKED. ${GUARDRAILS.join(' ')}`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          reference: input.reference,
          passage: input.passage || '',
          intendedClaim: input.intendedClaim || '',
          scripture: input.scripture || null,
          claims: input.claims || [],
          schema: {
            dimensions: '[{dimension, verdict, finding, evidence}]',
            overallVerdict: 'FAITHFUL|PARTIAL|UNCERTAIN|MISALIGNED|BLOCKED',
            safeUse: 'string', revisions: 'string[]', evidence: 'string[]'
          }
        }),
      },
    ],
  });

  const parsed = parseJson(response.output_text);
  const dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
  const overallVerdict = parsed.overallVerdict as ContextVerdict;
  if (!['FAITHFUL', 'PARTIAL', 'UNCERTAIN', 'MISALIGNED', 'BLOCKED'].includes(overallVerdict)) {
    throw new Error('Invalid V44 context verdict');
  }
  if (dimensions.length !== 4) throw new Error('V44 requires four context dimensions');

  return {
    version: 'V44', generatedAt: new Date().toISOString(), reference: input.reference,
    passage: input.passage || '', dimensions, overallVerdict,
    safeUse: String(parsed.safeUse || ''),
    revisions: Array.isArray(parsed.revisions) ? parsed.revisions : [],
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    guardrails: GUARDRAILS,
  };
}

export async function saveBiblicalContext(review: BiblicalContextReview) {
  await redisSetJson('one-million-souls:knowledge:biblical-context:latest', review, 60 * 60 * 24 * 30)
}

export async function getBiblicalContext() {
  return redisGetJson<BiblicalContextReview>('one-million-souls:knowledge:biblical-context:latest')
}

export function validateBiblicalContext(review: BiblicalContextReview): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (review.version !== 'V44') reasons.push('Invalid context version');
  if (!review.reference.trim()) reasons.push('Missing Scripture reference');
  if (review.dimensions.length !== 4) reasons.push('Missing required context dimensions');
  if (['MISALIGNED', 'BLOCKED'].includes(review.overallVerdict)) reasons.push(`Context verdict ${review.overallVerdict}`);
  if (review.overallVerdict === 'UNCERTAIN') reasons.push('Context is materially uncertain');
  return { ok: reasons.length === 0, reasons };
}
