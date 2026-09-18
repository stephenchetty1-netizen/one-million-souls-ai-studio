import crypto from 'node:crypto'

export const SYSTEM_REPAIR_AGENTS = Object.freeze([
  { id:'incident-controller', role:'Own system incidents end-to-end, coordinate diagnostics and repairs, prevent duplicate/conflicting fixes, and close only after verified recovery.', output:'incidentReport' },
  { id:'deployment-doctor', role:'Diagnose Railway deployment health, build/deploy state, service configuration, healthchecks, and failed rollouts; prefer minimal reversible fixes.', output:'deploymentRepair' },
  { id:'build-failure-diagnostician', role:'Inspect CI/build errors, dependency failures, TypeScript/build regressions, Docker issues, and identify the smallest concrete code/configuration fix.', output:'buildRepair' },
  { id:'runtime-log-analyst', role:'Inspect runtime and proxy logs, correlate errors across services, identify first failing boundary, and distinguish symptoms from root causes.', output:'runtimeDiagnosis' },
  { id:'renderer-repair-engineer', role:'Repair rendering pipeline failures, provider handoffs, media assembly, export quality plumbing, and renderer endpoint faults without lowering quality gates.', output:'rendererRepair' },
  { id:'scheduler-repair-engineer', role:'Repair publish-slot configuration, timezone logic, missed/duplicate trigger behavior, cron/scheduler drift, and stale slot state.', output:'schedulerRepair' },
  { id:'manifest-consistency-engineer', role:'Detect and repair stale manifests, slot/config version mismatches, missing master metadata, and invalid cached production manifests.', output:'manifestRepair' },
  { id:'release-gate-integrity-engineer', role:'Verify fail-closed PROFESSIONAL_MASTER enforcement, content-hash binding, approval invalidation, Publisher-last ordering, and block all bypass paths.', output:'releaseGateRepair' },
  { id:'credential-config-auditor', role:'Detect missing or inconsistent runtime configuration and credential variable names without exposing secrets or fabricating credentials.', output:'configAudit' },
  { id:'storage-delivery-engineer', role:'Repair object storage, media URLs, cache-control, file integrity, upload/download delivery, and availability faults across the production path.', output:'storageRepair' },
  { id:'social-integration-repair-engineer', role:'Diagnose Metricool, TikTok, and YouTube delivery integration failures, duplicate scheduling, metadata mapping, and platform validation errors; never publish unapproved content.', output:'integrationRepair' },
  { id:'regression-test-engineer', role:'Run post-fix end-to-end regression checks across render, manifest, release gate, scheduler, and publishing boundary; reject fixes that reintroduce prior failures.', output:'regressionReport' },
])

export const SYSTEM_REPAIR_POLICY = Object.freeze({
  scope: 'SYSTEM_REPAIR_ONLY',
  contentCreationAllowed: false,
  contentEvaluationAllowed: false,
  contentApprovalAllowed: false,
  publishingAllowed: false,
  mayBypassProfessionalMaster: false,
  mayFabricateCredentialsOrApprovals: false,
  destructiveChangesRequireExplicitApproval: true,
  qualityGateChangesAllowed: false,
  contentTeamApprovalCountUnaffected: true,
})

export function createSystemRepairPlan(input = {}) {
  const incident = String(input.incident || '').trim()
  if (!incident) throw new Error('incident is required')
  return {
    runId: input.runId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    incident,
    targetService: input.targetService || 'unknown',
    scope: SYSTEM_REPAIR_POLICY.scope,
    agents: SYSTEM_REPAIR_AGENTS.map((agent) => agent.id),
    stages: ['OBSERVE','DIAGNOSE','MINIMAL_FIX','DEPLOY','REGRESSION_TEST','VERIFY'],
    rules: SYSTEM_REPAIR_POLICY,
    status: 'READY_FOR_SYSTEM_REPAIR',
  }
}
