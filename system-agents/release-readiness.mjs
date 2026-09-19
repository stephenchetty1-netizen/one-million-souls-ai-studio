// One decision for the autonomy worker: production/buffer labels are not permission
// to publish, and a healthcheck or API key cannot substitute for exact-master review.
export function evaluateReleaseReadiness({system={},certification={},publishEnabled=false,requiredApprovals=0}={}){
  const r=certification?.readiness||null
  const completedExactMaster=certification?.execution?.certification==='PROFESSIONAL_MASTER_CERTIFIED'
    &&certification?.execution?.releaseStatus==='APPROVED_AWAITING_POST_TIME'
    &&certification?.execution?.certificate?.reviewStandardVersion==='v59-independent-exact-master-v2'
  const completeBuffer=r?.allCertified===true&&r?.certified===r?.expected&&r?.expected>0
    &&r?.invalid===0&&r?.productionRetry===0&&r?.awaiting===0
  const independentlyVerified=system?.releaseReady===true
    &&system?.rendererVerified===true
    &&system?.exactMasterCertified===true
    &&system?.durableFiftyApprovalsVerified===true
    &&system?.publishingLocked===false
  const blockers=[]
  if(!publishEnabled)blockers.push('PUBLISH_FLAG_LOCKED')
  if(!independentlyVerified)blockers.push('INDEPENDENT_EXACT_MASTER_REVIEW_UNVERIFIED')
  if(requiredApprovals!==50)blockers.push('FIFTY_APPROVAL_POLICY_INVALID')
  if(!completedExactMaster&&!completeBuffer)blockers.push('NO_INDEPENDENTLY_CERTIFIED_MASTER')
  const releaseReady=blockers.length===0
  return {
    releaseReady,
    publishingLocked:!releaseReady,
    requiredApprovals,
    bufferReadiness:r,
    nextAction:releaseReady?'AWAIT_SCHEDULED_POST_TIME':'AWAIT_INDEPENDENT_MASTER_REVIEW_AND_PLATFORM_VERIFICATION',
    reason:releaseReady?'INDEPENDENT_RELEASE_GATES_PASSED':blockers[0],
    blockers,
    proof:{
      publishFlagEnabled:publishEnabled,
      independentlyVerified,
      completedExactMaster,
      completeBuffer,
    },
  }
}
