export async function GET() {
  return Response.json({
    ok: true,
    service: 'christian-content-ai-studio',
    campaign: 'One Million Souls',
    mode: 'AUTOPILOT',
    timezone: process.env.APP_TIMEZONE || 'Africa/Johannesburg',
    configured: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      metricool: Boolean(process.env.METRICOOL_API_TOKEN && process.env.METRICOOL_USER_ID && process.env.METRICOOL_BLOG_ID),
      videoRenderer: Boolean(process.env.VIDEO_RENDER_WEBHOOK_URL),
      cronSecret: Boolean(process.env.CRON_SECRET),
      autopilotEnabled: process.env.AUTOPILOT_ENABLED === 'true',
    },
  })
}
