import { z } from 'zod'

export const EvidenceTier = z.enum(['PRIMARY_SCRIPTURE','STRONG_REFERENCE','SECONDARY_COMMENTARY','UNVERIFIED'])
export type EvidenceTier = z.infer<typeof EvidenceTier>

export const EvidenceItem = z.object({
  id: z.string(),
  claim: z.string(),
  source: z.string(),
  tier: EvidenceTier,
  authority: z.number().min(0).max(1),
  directlySupports: z.boolean(),
  verified: z.boolean(),
  notes: z.string().optional()
})
export type EvidenceItem = z.infer<typeof EvidenceItem>

export const SourceHierarchy = z.object({
  version: z.literal('V42'),
  generatedAt: z.string(),
  primaryScripture: z.array(EvidenceItem),
  supportingSources: z.array(EvidenceItem),
  rejectedSources: z.array(EvidenceItem),
  claimVerdicts: z.array(z.object({
    claim: z.string(),
    status: z.enum(['SUPPORTED','PARTIAL','UNSUPPORTED','REJECTED']),
    bestEvidenceId: z.string().optional(),
    reason: z.string()
  })),
  overallStatus: z.enum(['PASS','REVIEW','BLOCK']),
  guardrails: z.array(z.string())
})
export type SourceHierarchy = z.infer<typeof SourceHierarchy>

export function buildSourceHierarchy(input: {
  generatedAt?: string
  primaryScripture?: EvidenceItem[]
  supportingSources?: EvidenceItem[]
  rejectedSources?: EvidenceItem[]
  claims?: string[]
}): SourceHierarchy {
  const primary = input.primaryScripture ?? []
  const supporting = input.supportingSources ?? []
  const rejected = input.rejectedSources ?? []
  const claims = input.claims ?? []
  const evidence = [...primary, ...supporting]
  const claimVerdicts = claims.map((claim) => {
    const matches = evidence.filter((e) => e.verified && e.directlySupports && e.claim.toLowerCase().includes(claim.toLowerCase().slice(0, Math.min(40, claim.length))))
    const best = matches.sort((a,b) => b.authority-a.authority)[0]
    if (best?.tier === 'PRIMARY_SCRIPTURE') return { claim, status: 'SUPPORTED' as const, bestEvidenceId: best.id, reason: 'Directly supported by verified primary Scripture evidence.' }
    if (best?.verified) return { claim, status: 'PARTIAL' as const, bestEvidenceId: best.id, reason: 'Supported by verified secondary evidence but primary support is not established.' }
    return { claim, status: 'UNSUPPORTED' as const, reason: 'No verified directly supporting evidence was established.' }
  })
  const overallStatus = rejected.length > 0 || claimVerdicts.some(v => v.status === 'REJECTED' || v.status === 'UNSUPPORTED')
    ? 'BLOCK' as const
    : claimVerdicts.some(v => v.status === 'PARTIAL') ? 'REVIEW' as const : 'PASS' as const
  return SourceHierarchy.parse({
    version:'V42', generatedAt: input.generatedAt ?? new Date().toISOString(),
    primaryScripture: primary, supportingSources: supporting, rejectedSources: rejected,
    claimVerdicts, overallStatus,
    guardrails: ['Primary Scripture outranks commentary.', 'Unverified sources cannot establish biblical claims.', 'No source hierarchy may override Scripture or theological review.', 'Public evidence only; no private or sensitive audience data.']
  })
}
