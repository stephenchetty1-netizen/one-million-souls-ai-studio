import { reviewGospelDiscipleship, validateGospelDiscipleship } from './gospel-discipleship'
import { claimJob, completeJob, releaseJob } from './jobs'
import { getPerformance } from './learning'
import { getExperiments, selectVariant } from './experiments'
import { buildContentFactory, validateFactoryBatch } from './content-factory'
import { createMediaDirection } from './media-director'
import { buildDistributionPlan, validateDistributionPlan } from './distribution-intelligence'
import { decideNextContent } from './decision-agent'
import { buildMissionControlSnapshot } from './mission-control'
import { buildAgentSupervisorSnapshot } from './agent-supervisor'
import { validatePastoralWisdom } from './pastoral-wisdom'
import { validateSpiritualFormation } from './spiritual-formation'
import { validateChristianCommunity } from './christian-community'
import { validateChristianCharacter } from './christian-character'
import { validateChristianWisdom } from './christian-wisdom'
import { validateChristianDiscernment } from './christian-discernment'

export type OrchestrationStep = 'BRAIN' | 'CREATIVE' | 'KNOWLEDGE' | 'SOURCE_HIERARCHY' | 'GENERATE' | 'QUALITY' | 'CONTEXT' | 'INTERPRETATION' | 'HERMENEUTICS' | 'THEOLOGY' | 'CANONICAL_THEOLOGY' | 'DOCTRINE' | 'GOSPEL' | 'GOSPEL_DISCIPLESHIP' | 'EVANGELISM_MISSION' | 'APOLOGETICS' | 'ETHICS' | 'PASTORAL_WISDOM' | 'SPIRITUAL_FORMATION' | 'COMMUNITY' | 'CHARACTER' | 'WISDOM' | 'DISCERNMENT' | 'FACTORY' | 'MEDIA' | 'VIDEO_PLAN' | 'ASSETS' | 'RENDER' | 'PUBLISH'
export type OrchestrationResult = {
  ok: boolean
  jobId: string
  published: boolean
  scheduled: boolean
  selectedAssetId?: string
  steps: Array<{ step: OrchestrationStep; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }>
  decision?: unknown
  creative?: unknown
  theology?: unknown
  interpretation?: unknown
  hermeneutics?: unknown
  gospel?: unknown
  gospelDiscipleship?: unknown
  evangelismMission?: unknown
  apologetics?: unknown
  ethics?: unknown
  pastoralWisdom?: unknown
  spiritualFormation?: unknown
  community?: unknown
  character?: unknown
  wisdom?: unknown
  discernment?: unknown
  canonicalTheology?: unknown
  campaign?: unknown
  factory?: unknown
  mediaDirection?: unknown
  videoProductionManifest?: unknown
  creativeAssetBundle?: unknown
  distributionPlan?: unknown
  publishResult?: unknown
  error?: string
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured on the server.`)
  return value
}

function tomorrowAt(hour: number, minute: number) {
  const now = new Date()
  const target = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tz = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(target)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

async function callInternal(baseUrl: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${requiredEnv('CRON_SECRET')}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `${path} failed (${response.status})`)
  return data
}

export async function runContentOrchestrator(baseUrl: string, override?: { campaignId?: string; episodeId?: string; topic?: string; pillar?: string; hookDirection?: string; format?: string; objective?: string }): Promise<OrchestrationResult> {
  const publishTime = process.env.DAILY_PUBLISH_TIME || '20:00'
  const [hour, minute] = publishTime.split(':').map(Number)
  const dateTime = tomorrowAt(hour, minute)
  const jobId = `orchestrator:${dateTime}`
  const steps: OrchestrationResult['steps'] = []

  if (!(await claimJob(jobId))) return { ok: true, jobId, published: false, scheduled: false, steps: [{ step: 'PUBLISH', status: 'SKIP', detail: 'ALREADY_CLAIMED' }] }

  try {
    requiredEnv('OPENAI_API_KEY')
    requiredEnv('VIDEO_RENDER_WEBHOOK_URL')

    const control = await buildMissionControlSnapshot()
    if (control.execution.nextAction === 'BLOCKED') throw new Error(`Mission Control blocked execution: ${control.alerts.join('; ')}`)
    const supervisor = await buildAgentSupervisorSnapshot()
    if (supervisor.action === 'BLOCK') throw new Error(`Agent Supervisor blocked execution: ${supervisor.conflicts.join('; ') || 'critical dependency failed'}`)
    if (supervisor.action === 'REPAIR') throw new Error(`Agent Supervisor requires repair before execution: ${supervisor.conflicts.join('; ')}`)
    const autonomousDecision = await decideNextContent()
    const brain = await callInternal(baseUrl, '/api/brain')
    steps.push({ step: 'BRAIN', status: 'PASS', detail: `MISSION_CONTROL_${control.status}; SUPERVISOR_${supervisor.status}; DECISION_${autonomousDecision.mode}` })
    const creative = await callInternal(baseUrl, '/api/creative')
    steps.push({ step: 'CREATIVE', status: 'PASS' })

    const learned = { ...brain.decision, topic: autonomousDecision.topic || brain.decision.topic, pillar: autonomousDecision.pillar || brain.decision.pillar, hookDirection: autonomousDecision.hookDirection || brain.decision.hookDirection, format: autonomousDecision.format || brain.decision.format, objective: autonomousDecision.objective || brain.decision.objective }
    const decision = override?.topic ? { ...learned, topic: override.topic, pillar: override.pillar || learned.pillar, hookDirection: override.hookDirection || learned.hookDirection, format: override.format || learned.format, campaignId: override.campaignId, episodeId: override.episodeId, objective: override.objective } : learned
    const experiments = await getExperiments(30)
    const active = experiments.find(e => e.id === decision.experimentId && e.status !== 'COMPLETED') || experiments.find(e => e.status !== 'COMPLETED')
    const variant = active ? selectVariant(active, await getPerformance(300)) : undefined

    const knowledge = await callInternal(baseUrl, '/api/knowledge/scripture', { topic: decision.topic })
    if (!knowledge?.ok || !knowledge?.knowledge) throw new Error('Scripture Intelligence gate failed.')
    steps.push({ step: 'KNOWLEDGE', status: 'PASS', detail: `PRIMARY_${knowledge.knowledge.primaryReference}` })
    const sourceHierarchy = await callInternal(baseUrl, '/api/knowledge/sources', { claims: [decision.topic], primaryScripture: [{ id: 'primary', claim: decision.topic, source: knowledge.knowledge.primaryReference, tier: 'PRIMARY_SCRIPTURE', authority: 1, directlySupports: true, verified: true }] })
    if (!sourceHierarchy?.ok || sourceHierarchy?.hierarchy?.overallStatus === 'BLOCK') throw new Error('Biblical source hierarchy gate failed.')
    steps.push({ step: 'SOURCE_HIERARCHY', status: 'PASS', detail: sourceHierarchy.hierarchy.overallStatus })

    const generated = await callInternal(baseUrl, '/api/generate', {
      topic: decision.topic,
      audience: 'People scrolling TikTok and YouTube Shorts who need encouragement, hope, Scripture, and a clear focus on Jesus',
      goal: 'Reach new people with truthful, shareable Christian encouragement that points to Jesus and invites discipleship',
      pillar: decision.pillar,
      format: decision.format,
      hookDirection: decision.hookDirection,
      tone: 'bold, warm, hopeful, biblically grounded, concise, Gen-Z friendly without slang overload',
      channels: ['TikTok', 'YouTube Shorts'],
      experimentId: active?.id,
      variantId: variant?.id,
      creativeDirection: creative.direction,
    })
    steps.push({ step: 'GENERATE', status: 'PASS' })
    const campaign = generated.campaign

    if (campaign?.quality?.status !== 'PASS' || !campaign?.platformValidation?.valid) {
      throw new Error('Quality or platform gate failed. Orchestrator will not render or publish this campaign.')
    }
    steps.push({ step: 'QUALITY', status: 'PASS' })

    const context = await callInternal(baseUrl, '/api/knowledge/context', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      claims: [],
    })
    if (!context?.ok || !context?.review) throw new Error('Biblical context gate failed.')
    steps.push({ step: 'CONTEXT', status: 'PASS', detail: `CONTEXT_${context.review.overallVerdict}` })

    const interpretation = await callInternal(baseUrl, '/api/knowledge/interpretation', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      context: context.review,
      content: campaign,
    })
    if (!interpretation?.ok || !interpretation?.review) throw new Error(`Scripture interpretation gate failed: ${(interpretation?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'INTERPRETATION', status: 'PASS', detail: `INTERPRETATION_${interpretation.review.verdict}` })

    const hermeneutics = await callInternal(baseUrl, '/api/knowledge/hermeneutics', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      context: context.review,
      interpretation: interpretation.review,
      content: campaign,
    })
    if (!hermeneutics?.ok || !hermeneutics?.review) throw new Error(`Biblical hermeneutics gate failed: ${(hermeneutics?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'HERMENEUTICS', status: 'PASS', detail: `HERMENEUTICS_${hermeneutics.review.verdict}` })

    const canonical = await callInternal(baseUrl, '/api/knowledge/canonical', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      context: context.review,
      interpretation: interpretation.review,
      hermeneutics: hermeneutics.review,
      content: campaign,
    })
    if (!canonical?.ok || !canonical?.review) throw new Error(`Biblical theology gate failed: ${(canonical?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'CANONICAL_THEOLOGY', status: 'PASS', detail: `CANONICAL_${canonical.review.verdict}` })

    const doctrine = await callInternal(baseUrl, '/api/knowledge/doctrine', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      hermeneutics: hermeneutics.review,
      canonicalTheology: canonical.review,
      content: campaign,
    })
    if (!doctrine?.ok || !doctrine?.review) throw new Error(`Biblical doctrine gate failed: ${(doctrine?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'DOCTRINE', status: 'PASS', detail: `DOCTRINE_${doctrine.review.verdict}` })

    const gospel = await callInternal(baseUrl, '/api/knowledge/gospel', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      scripture: campaign.scriptureKnowledge || null,
      interpretation: interpretation.review,
      doctrine: doctrine.review,
      content: campaign,
    })
    if (!gospel?.ok || !gospel?.review) throw new Error(`Christ-centered Gospel gate failed: ${(gospel?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'GOSPEL', status: 'PASS', detail: `GOSPEL_${gospel.review.verdict}` })

    const transformation = await callInternal(baseUrl, '/api/knowledge/gospel-discipleship', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      gospel: gospel.review,
      content: campaign,
    })
    if (!transformation?.ok || !transformation?.review) throw new Error(`Gospel & discipleship transformation gate failed: ${(transformation?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'GOSPEL_DISCIPLESHIP', status: 'PASS', detail: `TRANSFORMATION_${transformation.review.verdict}` })

    const evangelismMission = await callInternal(baseUrl, '/api/knowledge/evangelism-mission', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      intendedClaim: campaign.hook || decision.topic,
      gospel: gospel.review,
      gospelDiscipleship: transformation.review,
      content: campaign,
    })
    if (!evangelismMission?.ok || !evangelismMission?.review) throw new Error(`Evangelism & mission gate failed: ${(evangelismMission?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'EVANGELISM_MISSION', status: 'PASS', detail: `MISSION_${evangelismMission.review.verdict}` })

    const apologetics = await callInternal(baseUrl, '/api/knowledge/apologetics', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      gospel: gospel.review,
      evangelismMission: evangelismMission.review,
      content: campaign,
    })
    if (!apologetics?.ok || !apologetics?.review) throw new Error(`Apologetics gate failed: ${(apologetics?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'APOLOGETICS', status: 'PASS', detail: `APOLOGETICS_${apologetics.review.verdict}` })

    const ethics = await callInternal(baseUrl, '/api/knowledge/christian-ethics', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      doctrine: doctrine.review,
      canonicalTheology: canonical.review,
      apologetics: apologetics.review,
      content: campaign,
    })
    if (!ethics?.ok || !ethics?.review) throw new Error(`Christian ethics gate failed: ${(ethics?.validation?.reasons || []).join('; ')}`)
    steps.push({ step: 'ETHICS', status: 'PASS', detail: `ETHICS_${ethics.review.verdict}` })

    const pastoralWisdom = await callInternal(baseUrl, '/api/knowledge/pastoral-wisdom', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      audience: process.env.CONTENT_AUDIENCE || 'general Christian audience',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      ethics: ethics.review,
      content: campaign,
    })
    if (!pastoralWisdom?.ok || !pastoralWisdom?.review || !validatePastoralWisdom(pastoralWisdom.review).ok) throw new Error(`Pastoral wisdom gate failed: ${(pastoralWisdom?.validation?.reasons || ['pastoral review failed']).join('; ')}`)
    steps.push({ step: 'PASTORAL_WISDOM', status: 'PASS', detail: `PASTORAL_${pastoralWisdom.review.verdict}` })

    const spiritualFormation = await callInternal(baseUrl, '/api/knowledge/spiritual-formation', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      gospel: gospel.review,
      discipleship: transformation.review,
      pastoralWisdom: pastoralWisdom.review,
      content: campaign,
    })
    if (!spiritualFormation?.ok || !spiritualFormation?.review || !validateSpiritualFormation(spiritualFormation.review).ok) throw new Error(`Spiritual formation gate failed: ${(spiritualFormation?.validation?.missing || []).join('; ') || 'review failed'}`)
    steps.push({ step: 'SPIRITUAL_FORMATION', status: 'PASS', detail: `FORMATION_${spiritualFormation.review.verdict}` })

    const community = await callInternal(baseUrl, '/api/knowledge/community', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      audience: process.env.CONTENT_AUDIENCE || 'general Christian audience',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      gospel: gospel.review,
      discipleship: transformation.review,
      ethics: ethics.review,
      pastoralWisdom: pastoralWisdom.review,
      spiritualFormation: spiritualFormation.review,
      content: campaign,
    })
    if (!community?.ok || !community?.review || !validateChristianCommunity(community.review).ok) throw new Error(`Christian community gate failed: ${(community?.validation?.reasons || ['review failed']).join('; ')}`)
    steps.push({ step: 'COMMUNITY', status: 'PASS', detail: `COMMUNITY_${community.review.verdict}` })

    const character = await callInternal(baseUrl, '/api/knowledge/character', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      audience: process.env.CONTENT_AUDIENCE || 'general Christian audience',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      doctrine: doctrine.review,
      gospel: gospel.review,
      discipleship: transformation.review,
      ethics: ethics.review,
      pastoralWisdom: pastoralWisdom.review,
      spiritualFormation: spiritualFormation.review,
      community: community.review,
      content: campaign,
    })
    if (!character?.ok || !character?.review || !validateChristianCharacter(character.review).ok) throw new Error(`Christian character gate failed: ${(character?.validation?.reasons || ['review failed']).join('; ')}`)
    steps.push({ step: 'CHARACTER', status: 'PASS', detail: `CHARACTER_${character.review.verdict}` })

    const wisdom = await callInternal(baseUrl, '/api/knowledge/wisdom', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      audience: process.env.CONTENT_AUDIENCE || 'general Christian audience',
      question: decision.topic,
      intendedClaim: campaign.hook || decision.topic,
      doctrine: doctrine.review,
      ethics: ethics.review,
      pastoralWisdom: pastoralWisdom.review,
      community: community.review,
      character: character.review,
      content: campaign,
    })
    if (!wisdom?.ok || !wisdom?.review || !validateChristianWisdom(wisdom.review).ok) throw new Error(`Christian wisdom gate failed: ${(wisdom?.validation?.reasons || ['review failed']).join('; ')}`)
    steps.push({ step: 'WISDOM', status: 'PASS', detail: `WISDOM_${wisdom.review.verdict}` })

    const discernment = await callInternal(baseUrl, '/api/knowledge/discernment', {
      reference: campaign.bible?.primaryScripture || campaign.scriptureKnowledge?.primaryReference || '',
      audience: process.env.CONTENT_AUDIENCE || 'general Christian audience',
      question: decision.topic,
      proposedAction: 'Create, assemble, and publish the approved Christian short-form content package.',
      content: campaign,
      knowledge: campaign.scriptureKnowledge,
      doctrine: doctrine.review,
      gospel: gospel.review,
      evangelismMission: evangelismMission.review,
      apologetics: apologetics.review,
      ethics: ethics.review,
      pastoralWisdom: pastoralWisdom.review,
      spiritualFormation: spiritualFormation.review,
      community: community.review,
      character: character.review,
      wisdom: wisdom.review,
    })
    if (!discernment?.ok || !discernment?.review || !validateChristianDiscernment(discernment.review).ok) throw new Error(`Christian discernment gate failed: ${(discernment?.validation?.reasons || ['discernment failed']).join('; ')}`)
    steps.push({ step: 'DISCERNMENT', status: 'PASS', detail: `DISCERNMENT_${discernment.review.verdict}` })

    const theology = await callInternal(baseUrl, '/api/theology/consistency', {
      topic: decision.topic,
      scripture: campaign.scriptureKnowledge,
      bibleResearch: campaign.bible,
      content: campaign,
      interpretation: interpretation.review,
      hermeneutics: hermeneutics.review,
      canonicalTheology: canonical.review,
      doctrine: doctrine.review,
      gospel: gospel.review,
      gospelDiscipleship: transformation.review,
      evangelismMission: evangelismMission.review,
      apologetics: apologetics.review,
      ethics: ethics.review,
      pastoralWisdom: pastoralWisdom.review,
      spiritualFormation: spiritualFormation.review,
      community: community.review,
      character: character.review,
      wisdom: wisdom.review,
    })
    if (!theology?.ok || theology?.review?.status !== 'PASS' || theology?.valid !== true) {
      throw new Error(`Theological consistency gate failed: ${(theology?.review?.requiredRevisions || theology?.review?.concerns || ['review failed']).join('; ')}`)
    }
    steps.push({ step: 'THEOLOGY', status: 'PASS', detail: 'INDEPENDENT_CONSISTENCY_CHECK_PASSED' })

    const factory = buildContentFactory({
      topic: decision.topic,
      title: campaign.title,
      caption: campaign.caption,
      hashtags: campaign.hashtags,
      tiktokScript: campaign.tiktokScript,
      onScreenText: campaign.onScreenText,
      visualConcept: campaign.visualConcept,
      imagePrompts: campaign.imagePrompts,
      pillar: decision.pillar,
      approvedCore: true,
    })
    if (!validateFactoryBatch(factory)) throw new Error('Content Factory validation failed.')
    steps.push({ step: 'FACTORY', status: 'PASS' })

    const selected = factory.assets.find(a => a.type === 'CORE') || factory.assets[0]
    const mediaDirection = createMediaDirection({
      title: selected.title,
      topic: decision.topic,
      hook: campaign.hook || selected.tiktokScript.split(/\n+/)[0] || selected.title,
      scripture: campaign.bible?.primaryScripture,
      format: decision.format,
    })
    steps.push({ step: 'MEDIA', status: 'PASS' })

    const videoPlanResponse = await callInternal(baseUrl, '/api/video/plan', {
      jobId,
      asset: selected,
      campaign,
      mediaDirection,
    })
    if (!videoPlanResponse?.ok || !videoPlanResponse?.manifest) throw new Error('Video production planning failed validation.')
    steps.push({ step: 'VIDEO_PLAN', status: 'PASS' })

    const assetsResponse = await callInternal(baseUrl, '/api/assets/generate', { productionPlan: videoPlanResponse.manifest })
    if (!assetsResponse?.ok || !assetsResponse?.bundle) throw new Error('Creative asset generation failed validation.')
    steps.push({ step: 'ASSETS', status: 'PASS' })

    const assemblyResponse = await callInternal(baseUrl, '/api/video/assemble', {
      jobId,
      productionPlan: videoPlanResponse.manifest,
      creativeAssetBundle: assetsResponse.bundle,
      platformPackages: selected.platformPackages,
    })
    if(!assemblyResponse?.ok || !assemblyResponse?.manifest) throw new Error('Video assembly manifest failed validation.')

    const renderResponse = await fetch(requiredEnv('VIDEO_RENDER_WEBHOOK_URL'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.VIDEO_RENDER_SECRET ? { Authorization: `Bearer ${process.env.VIDEO_RENDER_SECRET}` } : {}) },
      body: JSON.stringify({
        jobId,
        dryRun: false,
        asset: selected,
        campaign,
        platformPackages: selected.platformPackages,
        mediaDirection,
        videoProductionManifest: videoPlanResponse.manifest,
        creativeAssetBundle: assetsResponse.bundle,
        videoAssemblyManifest: assemblyResponse.manifest,
      }),
      cache: 'no-store',
    })
    const rendered = await renderResponse.json().catch(() => ({}))
    if (!renderResponse.ok) throw new Error('Video renderer request failed.')

    const qualityResponse = await callInternal(baseUrl, '/api/video/quality', {
      rendered,
      scriptureIntegrity: rendered.scriptureIntegrity === true,
      rightsCleared: rendered.rightsCleared === true,
      captionsPresent: rendered.captionsPresent === true,
      audioPresent: rendered.audioPresent === true,
      vertical1080x1920: rendered.width === 1080 && rendered.height === 1920,
    })
    if(!qualityResponse?.ok) throw new Error('Final video quality gate failed. Publishing is blocked.')
    steps.push({ step: 'RENDER', status: 'PASS' })

    const distributionPlan = buildDistributionPlan({
      title: selected.platformPackages.youtube.title,
      caption: selected.platformPackages.tiktok.caption,
      hashtags: selected.platformPackages.tiktok.hashtags,
      topic: decision.topic,
      dateTime,
      timezone: process.env.APP_TIMEZONE || 'Africa/Johannesburg',
      objective: decision.objective,
    })
    const distributionValidation = validateDistributionPlan(distributionPlan)
    if (!distributionValidation.valid) throw new Error(`Distribution gate failed: ${distributionValidation.errors.join('; ')}`)

    const publish = await callInternal(baseUrl, '/api/distribution/publish', {
      dateTime,
      timezone: process.env.APP_TIMEZONE || 'Africa/Johannesburg',
      mediaUrl: rendered.mediaUrl,
      plan: distributionPlan,
    })
    if (!publish?.ok || publish?.scheduled !== true) throw new Error('Distribution provider did not confirm scheduling.')
    steps.push({ step: 'PUBLISH', status: 'PASS', detail: 'TIKTOK_AND_YOUTUBE_SCHEDULED' })
    await completeJob(jobId, { ok: true, published: true, scheduled: true, distributionVersion: 'V26' })
    return { ok: true, jobId, published: true, scheduled: true, selectedAssetId: selected.assetId, steps, decision, creative, theology, canonicalTheology: canonical.review, interpretation, hermeneutics: hermeneutics.review, doctrine: doctrine.review, gospel: gospel.review, gospelDiscipleship: transformation.review, evangelismMission: evangelismMission.review, apologetics: apologetics.review, ethics: ethics.review, pastoralWisdom: pastoralWisdom.review, wisdom: wisdom.review, discernment: discernment.review, campaign, factory, mediaDirection, videoProductionManifest: videoPlanResponse.manifest, creativeAssetBundle: assetsResponse.bundle, distributionPlan, publishResult: publish }
  } catch (error) {
    await releaseJob(jobId).catch(() => undefined)
    return { ok: false, jobId, published: false, scheduled: false, steps, error: error instanceof Error ? error.message : 'Orchestration failed.' }
  }
}
