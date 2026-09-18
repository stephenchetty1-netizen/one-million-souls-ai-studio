import http from 'node:http'

const PORT = Number(process.env.PORT || 3000)
const TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Johannesburg'
const V59_BASE_URL = (process.env.V59_BASE_URL || '').replace(/\/$/, '')
const CRON_SECRET = process.env.CRON_SECRET || ''
const TARGET_PATH = process.env.TARGET_PATH || '/api/cron/campaign-execute'
const SLOT_CONFIG = process.env.PUBLISH_SLOTS || '08:00,15:30,20:30'
const SLOTS = new Set(SLOT_CONFIG.split(',').map(slot => slot.trim()).filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot)))
const lastTriggered = new Map()
let lastResult = { ok: null, message: 'No scheduled run yet.' }

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    second: Number(map.second),
  }
}

async function trigger(slotKey) {
  if (!V59_BASE_URL || !CRON_SECRET) {
    lastResult = { ok: false, message: 'V59_BASE_URL or CRON_SECRET missing.' }
    console.error('SCHEDULER_CONFIG_MISSING')
    return
  }
  const url = `${V59_BASE_URL}${TARGET_PATH}`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ days: 30, scheduledSlot: slotKey }),
      signal: AbortSignal.timeout(295_000),
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 2000) } }
    lastResult = { ok: response.ok && data?.ok !== false, status: response.status, slotKey, at: new Date().toISOString(), data }
    console.log('SCHEDULED_RUN_RESULT', JSON.stringify(lastResult))
  } catch (error) {
    lastResult = { ok: false, slotKey, at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }
    console.error('SCHEDULED_RUN_ERROR', JSON.stringify(lastResult))
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

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const now = localParts()
    const body = JSON.stringify({
      ok: true,
      service: 'one-million-souls-scheduler',
      timezone: TIMEZONE,
      slots: [...SLOTS],
      localNow: `${now.date}T${now.time}`,
      configured: Boolean(V59_BASE_URL && CRON_SECRET),
      lastResult,
    })
    res.writeHead(200, {'content-type':'application/json','content-length':Buffer.byteLength(body)})
    return res.end(body)
  }
  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`One Million Souls scheduler listening on ${PORT}`)
  console.log('SCHEDULER_SLOTS', JSON.stringify([...SLOTS]), TIMEZONE)
})

setInterval(() => tick().catch(err => console.error('TICK_ERROR', err)), 10_000)
tick().catch(err => console.error('INITIAL_TICK_ERROR', err))
