const base = process.env.APP_URL
const secret = process.env.CRON_SECRET
if (!base || !secret) {
  console.error('Set APP_URL and CRON_SECRET before running the smoke test.')
  process.exit(2)
}

const checks = [
  ['health', '/api/health'],
  ['readiness', '/api/ready'],
]

for (const [name, path] of checks) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${secret}` } })
  const text = await res.text()
  console.log(`${name}: HTTP ${res.status}`)
  if (!res.ok && name !== 'health') {
    console.log(text)
    process.exit(1)
  }
}
console.log('Smoke test completed. A passing readiness check does not replace a dry run.')
