import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod/v4'
import { getStrategy } from '@/lib/learning'
import { getExperiments, type ContentExperiment } from '@/lib/experiments'
import { getAudienceProfile } from '@/lib/audience'
import { optimizeForPlatforms, validatePlatformPackages } from '@/lib/platform-optimizer'
import { buildScriptureKnowledge, validateScriptureKnowledge } from '@/lib/scripture-intelligence'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra'

const InputSchema = z.object({
  topic: z.string().min(3).max(300),
  audience: z.string().min(3).max(500),
  goal: z.string().min(3).max(500),
  tone: z.string().min(2).max(200),
  channels: z.array(z.string()).min(1).max(8),
  experimentId: z.string().optional(),
  variantId: z.string().optional(),
  pillar: z.string().optional(),
  format: z.string().optional(),
  hookDirection: z.string().optional(),
  creativeDirection: z.any().optional(),
})

const BibleSchema = z.object({
  primaryScripture: z.string(),
  supportingScriptures: z.array(z.string()).min(2).max(5),
  context: z.string(),
  keyTruth: z.string(),
  cautions: z.array(z.string()).default([]),
})

const ContentSchema = z.object({
  title: z.string(),
  hook: z.string(),
  devotional: z.string(),
  tiktokScript: z.string(),
  onScreenText: z.array(z.string()).min(3).max(8),
  caption: z.string(),
  hashtags: z.array(z.string()).min(4).max(12),
  cta: z.string(),
  visualConcept: z.string(),
  imagePrompts: z.array(z.string()).length(3),
  experimentId: z.string().optional(),
  variantId: z.string().optional(),
})

const QualitySchema = z.object({
  scriptureAccurate: z.boolean(),
  biblicalConsistency: z.boolean(),
  gospelCentered: z.boolean(),
  audienceFit: z.boolean(),
  retentionReady: z.boolean(),
  notes: z.array(z.string()),
  status: z.enum(['PASS', 'REVISE']),
})

async function runJson<T extends z.ZodType>(input: string, schema: T, tools?: any[]) {
  const response = await client.responses.parse({
    model: TEXT_MODEL,
    input,
    tools,
    reasoning: { effort: 'medium' },
    text: { format: zodTextFormat(schema, 'structured_result') },
  })
  if (response.status !== 'completed') {
    throw new Error(JSON.stringify(response.error ?? response.incomplete_details ?? 'Response did not complete.'))
  }
  if (!response.output_parsed) throw new Error('OpenAI returned no structured output.')
  return response.output_parsed as z.infer<T>
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 500 })
    }

    const body = InputSchema.parse(await req.json())
    const growthStrategy = await getStrategy()
    const experiments = await getExperiments(10)
    const audience = await getAudienceProfile()
    const selectedExperiment = body.experimentId ? experiments.find(e => e.id === body.experimentId) : undefined
    const selectedVariant = selectedExperiment?.variants.find(v => v.id === body.variantId)
    if (body.experimentId && (!selectedExperiment || !selectedVariant || selectedExperiment.status === 'COMPLETED')) {
      return Response.json({ error: 'The requested content experiment or variant is not active.' }, { status: 409 })
    }

    const scriptureKnowledge = await buildScriptureKnowledge(body.topic)
    if (!validateScriptureKnowledge(scriptureKnowledge)) throw new Error('Scripture knowledge validation failed.')

    const bible = await runJson(
      `You are the Bible Research Agent for a Christian content studio. Research the topic conservatively and verify Scripture references. Never invent a verse, quotation, biblical context, or interpretation. Prefer direct biblical teaching and clearly distinguish application from what a passage explicitly says. Topic: ${body.topic}. Audience: ${body.audience}. Goal: ${body.goal}. Existing Scripture Intelligence: ${JSON.stringify(scriptureKnowledge)}.`,
      BibleSchema,
      [{ type: 'web_search' }],
    )

    const content = await runJson(
      `You are the Christian Content Writer and Growth Manager. Create a compelling, Jesus-centered short-form devotional using ONLY the verified Bible research below. Do not fabricate quotations. The devotional should be about 200 words, warm, bold, biblically grounded, and optimized for retention without hype that distorts the message. Audience: ${body.audience}. Pillar: ${body.pillar || 'not specified'}. Format: ${body.format || 'not specified'}. Hook direction: ${body.hookDirection || 'not specified'}. Tone: ${body.tone}. Channels: ${body.channels.join(', ')}. Goal: ${body.goal}. Topic: ${body.topic}. LEARNED PERFORMANCE STRATEGY (use only for packaging, hooks, topic framing and experiments; never to alter Scripture): ${JSON.stringify(growthStrategy)}. ACTIVE CONTENT EXPERIMENTS (use a variant when relevant, but never distort Scripture): ${JSON.stringify(experiments)}. REQUIRED EXPERIMENT VARIANT (if supplied, follow its packaging direction exactly while keeping Scripture authoritative): ${JSON.stringify(selectedVariant || null)}. CREATIVE INTELLIGENCE DIRECTION (use for presentation and packaging only; never override verified Scripture): ${JSON.stringify(body.creativeDirection || null)}. AUDIENCE INTELLIGENCE (use only to understand aggregate needs/questions; never infer sensitive traits): ${JSON.stringify(audience)}. VERIFIED SCRIPTURE INTELLIGENCE: ${JSON.stringify(scriptureKnowledge)}. VERIFIED BIBLE RESEARCH: ${JSON.stringify(bible)}.`,
      ContentSchema,
    )

    const quality = await runJson(
      `You are the final Quality Agent for Christian content. Audit the proposed content against the verified Bible research. Do not silently rewrite facts. Flag anything unsupported, misleading, out of context, or not clearly grounded. PASS only if all core checks are satisfied. Topic: ${body.topic}. Scripture intelligence: ${JSON.stringify(scriptureKnowledge)}. Bible research: ${JSON.stringify(bible)}. Proposed content: ${JSON.stringify(content)}.`,
      QualitySchema,
    )

    const platformPackages = optimizeForPlatforms({ title: content.title, caption: content.caption, hashtags: content.hashtags, topic: body.topic })
    const platformValidation = validatePlatformPackages(platformPackages)
    const finalStatus = quality.status === 'PASS' && platformValidation.valid ? 'AUTOPILOT_READY' : 'REVISE'
    return Response.json({ campaign: { ...content, scriptureKnowledge, experimentId: selectedExperiment?.id, variantId: selectedVariant?.id, bible, quality, growthStrategy, experiments, audience, platformPackages, platformValidation, status: finalStatus } })
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) return Response.json({ error: 'Please complete all required fields.' }, { status: 400 })
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed.' }, { status: 500 })
  }
}
