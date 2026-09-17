function endpointPath(endpoint) {
  return endpoint.replace(/^\//, '')
}

function parseSse(text) {
  const events = []
  let event = ''
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) {
      const raw = line.slice(5).trim()
      let data = raw
      try { data = JSON.parse(raw) } catch {}
      events.push({ event, data })
      event = ''
    }
  }
  const complete = [...events].reverse().find((item) => item.event === 'complete')
  if (complete) return complete.data
  const error = [...events].reverse().find((item) => item.event === 'error')
  if (error) throw new Error(typeof error.data === 'string' ? error.data : JSON.stringify(error.data))
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
  const name = endpointPath(endpoint)
  const root = baseUrl.replace(/\/$/, '')
  const callUrl = `${root}/gradio_api/call/${encodeURIComponent(name)}`
  const submit = await fetchWithDeadline(callUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  }, 30000)

  const submitText = await submit.text()
  if (!submit.ok) throw new Error(`Gradio submit ${submit.status}: ${submitText.slice(0, 500)}`)
  let eventId = ''
  try { eventId = JSON.parse(submitText)?.event_id || '' } catch {}
  if (!eventId) throw new Error(`Gradio did not return event_id: ${submitText.slice(0, 500)}`)

  const resultUrl = `${callUrl}/${encodeURIComponent(eventId)}`
  const result = await fetchWithDeadline(resultUrl, { headers: { accept: 'text/event-stream' } }, timeoutMs)
  const resultText = await result.text()
  if (!result.ok) throw new Error(`Gradio result ${result.status}: ${resultText.slice(0, 500)}`)
  return parseSse(resultText)
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
  if (!upload.ok) throw new Error(`Gradio upload ${upload.status}: ${text.slice(0, 500)}`)
  let paths = []
  try { paths = JSON.parse(text) } catch {}
  const path = Array.isArray(paths) ? paths[0] : paths?.files?.[0] || paths?.path
  if (!path) throw new Error(`Gradio upload returned no path: ${text.slice(0, 500)}`)
  return { path, orig_name: fileName, meta: { _type: 'gradio.FileData' } }
}
