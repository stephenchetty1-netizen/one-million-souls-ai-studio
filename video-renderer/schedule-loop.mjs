const TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
const V59_BASE_URL = (process.env.V59_BASE_URL || '').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET || ''
const TARGET_PATH = process.env.SCHEDULER_TARGET_PATH || '/api/cron/campaign-execute'
// The standalone scheduler service is authoritative. Embedded scheduling is disabled by default
// and requires an explicit break-glass opt-in to prevent duplicate slot execution.
const SCHEDULER_ENABLED = process.env.ALLOW_EMBEDDED_SCHEDULER === 'true' && process.env.SCHEDULER_ENABLED !== 'false'
const SLOT_CONFIG = process.env.PUBLISH_SLOTS || '08:00,15:30,20:30'
const SLOTS = new Set(SLOT_CONFIG.split(',').map(slot => slot.trim()).filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot)))
const lastTriggered = new Map()

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return { date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour}:${m.minute}` }
}

async function trigger(slotKey) {
  if (!SCHEDULER_ENABLED) return
  if (!V59_BASE_URL || !CRON_SECRET) {
    console.error('SCHEDULER_CONFIG_MISSING')
    return
  }
  try {
    const response = await fetch(`${V59_BASE_URL}${TARGET_PATH}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ days: 30, scheduledSlot: slotKey }),
      signal: AbortSignal.timeout(295_000),
    })
    const text = await response.text()
    console.log('SCHEDULED_RUN_RESULT', JSON.stringify({ slotKey, status: response.status, ok: response.ok, body: text.slice(0, 4000) }))
  } catch (error) {
    console.error('SCHEDULED_RUN_ERROR', JSON.stringify({ slotKey, error: error instanceof Error ? error.message : String(error) }))
  }
}

async function tick() {
  const now = localParts()
  if (!SLOTS.has(now.time)) return
  const key = `${now.date}T${now.time}`
  if (lastTriggered.get(now.time) === key) return
  lastTriggered.set(now.time, key)
  await trigger(key)
}

console.log('EMBEDDED_SCHEDULER', JSON.stringify({ enabled: SCHEDULER_ENABLED, timezone: TIMEZONE, slots: [...SLOTS], configured: Boolean(V59_BASE_URL && CRON_SECRET), mode: SCHEDULER_ENABLED ? 'break-glass-enabled' : 'standalone-scheduler-authoritative' }))
setInterval(() => tick().catch(error => console.error('SCHEDULER_TICK_ERROR', error)), 10_000)
tick().catch(error => console.error('SCHEDULER_INITIAL_ERROR', error))
