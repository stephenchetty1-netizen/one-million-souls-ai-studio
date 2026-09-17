function endpointPath(endpoint) {
  return endpoint.replace(/^\//, '')
}

function safeJson(value) {
  try { return JSON.stringify(value) } catch { return String(value) }
}

function parseSse(text, context = {}) {
  const events = []
  let event = ''
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) {
      const raw = line.slice(5).trim()
      let data = raw
      try { data = JSON.parse(raw) } catch {}
      events.push({ event, data, raw })
      event = ''
    }
  }

  const complete = [...events].reverse().find((item) => item.event === 'complete')
  if (complete) return complete.data

  const error = [...events].reverse().find((item) => item.event === 'error')
  if (error) {
    const payload = error.data == null ? error.raw : (typeof error.data === 'string' ? error.data : safeJson(error.data))
    const tail = events.slice(-8).map((item) => `${item.event || 'data'}:${item.raw}`).join(' | ')
    throw new Error(`Gradio SSE error endpoint=${context.endpoint || '?'} eventId=${context.eventId || '?'} payload=${payload || '<empty>'} tail=${tail || '<none>'}`)
  }

  if (!events.length) {
    throw new Error(`Gradio returned no SSE events endpoint=${context.endpoint || '?'} eventId=${context.eventId || '?'} body=${text.slice(0, 1000)}`)
  }

  return events.at(-1)?.data
}

async function fetchWithDeadline(url, options = {}, timeoutMs = 300000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function callGradio(baseUrl, endpoint, data, timeoutMs = 300000) {
  const root = baseUrl.replace(/\/$/, '')
  const actualEndpoint = endpoint === '/generate_all' && /kokoro/i.test(root)
    ? '/generate_first'
    : endpoint
  const name = endpointPath(actualEndpoint)
  const callUrl = `${root}/gradio_api/call/${encodeURIComponent(name)}`
  const submit = await fetchWithDeadline(callUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  }, 30000)

  const submitText = await submit.text()
  if (!submit.ok) throw new Error(`Gradio submit endpoint=${actualEndpoint} status=${submit.status}: ${submitText.slice(0, 1000)}`)
  let eventId = ''
  try { eventId = JSON.parse(submitText)?.event_id || '' } catch {}
  if (!eventId) throw new Error(`Gradio did not return event_id endpoint=${actualEndpoint}: ${submitText.slice(0, 1000)}`)

  console.log('FREE_AI_GRADIO_SUBMITTED', JSON.stringify({ endpoint: actualEndpoint, requestedEndpoint: endpoint, eventId }))

  const resultUrl = `${callUrl}/${encodeURIComponent(eventId)}`
  let result
  try {
    result = await fetchWithDeadline(resultUrl, { headers: { accept: 'text/event-stream' } }, timeoutMs)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Gradio result request failed endpoint=${actualEndpoint} eventId=${eventId}: ${message}`)
  }
  const resultText = await result.text()
  if (!result.ok) throw new Error(`Gradio result endpoint=${actualEndpoint} eventId=${eventId} status=${result.status}: ${resultText.slice(0, 1000)}`)
  return parseSse(resultText, { endpoint: actualEndpoint, eventId })
}

export function collectAssetUrls(value) {
  const urls = []
  const walk = (item) => {
    if (!item) return
    if (typeof item === 'string') {
      if (/^https?:\/\//i.test(item)) urls.push(item)
      return
    }
    if (Array.isArray(item)) return item.forEach(walk)
    if (typeof item === 'object') {
      if (typeof item.url === 'string' && /^https?:\/\//i.test(item.url)) urls.push(item.url)
      if (typeof item.path === 'string' && /^https?:\/\//i.test(item.path)) urls.push(item.path)
      Object.values(item).forEach(walk)
    }
  }
  walk(value)
  return [...new Set(urls)]
}

export async function uploadRemoteFileToGradio(baseUrl, remoteUrl, fileName = 'input.png') {
  const source = await fetchWithDeadline(remoteUrl, {}, 60000)
  if (!source.ok) throw new Error(`Source download ${source.status}`)
  const bytes = await source.arrayBuffer()
  const contentType = source.headers.get('content-type') || 'application/octet-stream'
  const form = new FormData()
  form.append('files', new Blob([bytes], { type: contentType }), fileName)
  const upload = await fetchWithDeadline(`${baseUrl.replace(/\/$/, '')}/gradio_api/upload`, { method: 'POST', body: form }, 60000)
  const text = await upload.text()
  if (!upload.ok) throw new Error(`Gradio upload ${upload.status}: ${text.slice(0, 1000)}`)
  let paths = []
  try { paths = JSON.parse(text) } catch {}
  const path = Array.isArray(paths) ? paths[0] : paths?.files?.[0] || paths?.path
  if (!path) throw new Error(`Gradio upload returned no path: ${text.slice(0, 1000)}`)
  return { path, orig_name: fileName, meta: { _type: 'gradio.FileData' } }
}
