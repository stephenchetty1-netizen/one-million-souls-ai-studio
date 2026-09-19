import { NextResponse } from 'next/server';

// Liveness only. Do not infer backend, renderer, approval, or publishing readiness
// from a successful HTTP response.
export async function GET() {
  return NextResponse.json({
    service: 'one-million-souls-ai-studio',
    version: 'v59',
    status: 'alive',
    readiness: 'unverified',
    releaseReady: false,
    publishing: 'locked',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
}
