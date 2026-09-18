import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const agents = [
  "incident-controller",
  "deployment-doctor",
  "build-failure-diagnostician",
  "runtime-log-analyst",
  "renderer-repair-engineer",
  "scheduler-repair-engineer",
  "manifest-consistency-engineer",
  "release-gate-integrity-engineer",
  "credential-config-auditor",
  "storage-delivery-engineer",
  "social-integration-repair-engineer",
  "regression-test-engineer"
]

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  const xSecret = req.headers.get('x-cron-secret') || ''
  return auth === `Bearer ${secret}` || xSecret === secret
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 })
  const body = await req.json().catch(() => ({}))
  const incident = String(body.incident || '').trim()
  if (!incident) return NextResponse.json({ ok:false, error:'incident is required' }, { status:400 })

  return NextResponse.json({
    ok: true,
    plan: {
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      incident,
      targetService: body.targetService || 'unknown',
      scope: 'SYSTEM_REPAIR_ONLY',
      agents,
      stages: ['OBSERVE','DIAGNOSE','MINIMAL_FIX','DEPLOY','REGRESSION_TEST','VERIFY'],
      constraints: {
        contentCreationAllowed:false,
        contentEvaluationAllowed:false,
        contentApprovalAllowed:false,
        publishingAllowed:false,
        contentTeamApprovalCount:50,
        mayBypassProfessionalMaster:false,
        mayFabricateCredentialsOrApprovals:false,
        destructiveChangesRequireExplicitApproval:true,
      },
    }
  })
}
