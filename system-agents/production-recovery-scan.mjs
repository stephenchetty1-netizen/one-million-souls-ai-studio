// Live, zero-credit system-repair diagnostics. No content approval or publishing.
import { runSystemRepairTeam } from './system-agent-team.mjs'

const TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
const appBase = process.env.AUTONOMY_BASE_URL || 'http://127.0.0.1:' + (process.env.PORT || 3000)
function normalizeBase(raw) {
  const value = String(raw || '').trim().replace(/\/$/, '')
  return !value ? '' : /^https?:\/\//i.test(value) ? value : 'https://' + value
}
const rendererBase = normalizeBase(
  process.env.RAILWAY_SERVICE_ONE_MILLION_SOULS_VIDEO_RENDERER_URL ||
  process.env.VIDEO_RENDER_WEBHOOK_URL
)
function tomorrow() {
  const d = new Date(Date.now() + 86400000)
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const m = Object.fromEntries(p.map(x => [x.type, x.value]))
  return m.year + '-' + m.month + '-' + m.day
}
async function getJson(url, secret = '') {
  if (!url) return { reached: false, reason: 'URL_NOT_CONFIGURED' }
  try {
    const r = await fetch(url, {
      headers: secret ? { authorization: 'Bearer ' + secret } : {},
      signal: AbortSignal.timeout(12000), cache: 'no-store'
    })
    const body = await r.json().catch(() => null)
    return { reached: true, status: r.status, ok: r.ok && body?.ok !== false,
      body }
  } catch (e) {
    return { reached: false, reason: String(e?.message || e).slice(0, 130),
      transportCode: e?.cause?.code || null }
  }
}
function result(passed, evidence) { return { passed, evidence } }
function summary(r) {
  return { reached: r?.reached || false, http: r?.status || null,
    reason: r?.reason || null, transportCode: r?.transportCode || null }
}
function sources(r) {
  return { ...summary(r), approved: r?.body?.reviewed ?? null,
    required: r?.body?.required ?? null, total: r?.body?.total ?? null,
    technicalReady: r?.body?.technicalSourcesReady === true }
}

export async function runProductionRecoveryScan() {
  const renderSecret = process.env.VIDEO_RENDER_SECRET || ''
  const date = tomorrow()
  const [appHealth, appReady, appStatus, rendererHealth, shorts, longForm, manifest] =
    await Promise.all([
      getJson(appBase + '/api/health'),
      getJson(appBase + '/api/ready', process.env.CRON_SECRET || ''),
      getJson(appBase + '/api/system-agents/autonomy-status', process.env.CRON_SECRET || ''),
      getJson(rendererBase && rendererBase + '/health'),
      getJson(rendererBase && rendererBase + '/christian-review-queue?format=SHORT_59', renderSecret),
      getJson(rendererBase && rendererBase + '/christian-review-queue?format=YOUTUBE_LONG', renderSecret),
      getJson(rendererBase && rendererBase + '/factory-manifest?date=' + date, renderSecret)
    ])
  const entries = Array.isArray(manifest.body?.entries) ? manifest.body.entries : []
  const certified = entries.filter(x => x?.releaseStatus === 'APPROVED_AWAITING_POST_TIME'
    && x?.renderQualityGate === 'PASS' && /^[a-f0-9]{64}$/i.test(x?.masterHash || ''))
  const config = {
    cronSecretPresent: Boolean(process.env.CRON_SECRET),
    renderSecretPresent: Boolean(renderSecret),
    rendererAddressPresent: Boolean(rendererBase),
    redisConfigured: Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL),
    paidAiDisabled: process.env.ZERO_CREDIT_ONLY === 'true',
    publishFlagLocked: process.env.V59_PUBLISH_ENABLED !== 'true'
  }
  const releaseSafe = appStatus.ok && appStatus.body?.publishingLocked === true
    && appStatus.body?.releaseReady !== true && config.publishFlagLocked
  const checks = {
    'incident-controller': () => result(appHealth.ok && rendererHealth.ok,
      { application: summary(appHealth), renderer: summary(rendererHealth) }),
    'deployment-doctor': () => result(appHealth.ok && rendererHealth.ok,
      { application: summary(appHealth), renderer: summary(rendererHealth),
        note: 'Runtime reachability only; not a CI or certified-master assertion.' }),
    'build-failure-diagnostician': () => result(false,
      { reason: 'CI_WORKFLOW_EVIDENCE_MUST_BE_VERIFIED_IN_GITHUB', fabricatedPass: false }),
    'runtime-log-analyst': () => result(false,
      { reason: 'RAILWAY_DEPLOY_AND_PROXY_LOG_VERIFICATION_EXTERNAL', fabricatedPass: false }),
    'renderer-repair-engineer': () => result(rendererHealth.ok
      && rendererHealth.body?.persistentStorage === true
      && rendererHealth.body?.v2RendererReady === true,
      { renderer: summary(rendererHealth), persistentStorage: rendererHealth.body?.persistentStorage === true,
        v2RendererReady: rendererHealth.body?.v2RendererReady === true }),
    'scheduler-repair-engineer': () => result(false,
      { application: summary(appHealth), reason: 'SCHEDULED_SLOT_DELIVERY_NOT_PROVEN_BY_HEALTHCHECK',
        needsActualSlotLog: true }),
    'manifest-consistency-engineer': () => result(manifest.ok
      && entries.length === 3 && certified.length === 3,
      { date, expected: 3, present: entries.length, candidates: certified.length,
        rendererManifest: summary(manifest), separateChristianShortSources: sources(shorts),
        separateChristianLongSources: sources(longForm) }),
    'release-gate-integrity-engineer': () => result(releaseSafe,
      { releaseSafe, publishingLocked: appStatus.body?.publishingLocked ?? null,
        releaseReady: appStatus.body?.releaseReady ?? null,
        publishFlagLocked: config.publishFlagLocked }),
    'credential-config-auditor': () => result(Object.values(config).every(Boolean),
      { ...config, note: 'Presence only; no secrets read into report and no credential-validity claim.' }),
    'storage-delivery-engineer': () => result(rendererHealth.ok
      && rendererHealth.body?.persistentStorage === true && manifest.reached && manifest.status === 200,
      { storageConfigured: rendererHealth.body?.persistentStorage === true,
        manifestReadable: manifest.reached && manifest.status === 200, rendererManifest: summary(manifest),
        note: 'Does not certify individual MP4 SHA-256 delivery.' }),
    'social-integration-repair-engineer': () => result(false,
      { reason: 'NO_AUTHORIZED_TEST_PUBLICATION_OR_PLATFORM_DELIVERY_PROOF',
        publishFlagLocked: config.publishFlagLocked }),
    'regression-test-engineer': () => result(false,
      { reason: 'INDEPENDENT_CI_AND_EXACT_MASTER_END_TO_END_TEST_REQUIRED',
        application: summary(appReady), independentlyCertifiedMasters: certified.length })
  }
  const adapters = Object.fromEntries(Object.entries(checks).map(([id, fn]) =>
    [id, async () => fn()]))
  const scan = await runSystemRepairTeam({
    incident: 'V59 end-to-end production recovery; fail closed until independent certification',
    targetService: 'one-million-souls-v59 + one-million-souls-video-renderer'
  }, adapters)
  return {
    status: scan.status, allPassed: scan.allPassed,
    agentCount: scan.agents.length,
    checks: scan.results, scannedAt: scan.completedAt,
    publicationPermissionGranted: false,
    paidGenerationInvoked: false,
    humanSourceReviews: { short: sources(shorts), long: sources(longForm) }
  }
}
