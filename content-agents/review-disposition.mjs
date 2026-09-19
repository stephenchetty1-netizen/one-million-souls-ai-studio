const PERCEPTUAL_GATES=new Set([
  'fullWatch','creativeMaster','professionalExecutionInspection','voicePerformanceInspection',
])
// Fail closed without burning a new production slot on every scheduled cycle.
// Technical/rights/content failures still follow the normal revision workflow.
export function reviewDisposition({zeroCreditOnly=false,failed=[]}={}){
  if(zeroCreditOnly && Array.isArray(failed) && failed.length>0 &&
      failed.every(item=>PERCEPTUAL_GATES.has(String(item?.gate||'')))){
    return {
      action:'HOLD_EXACT_MASTER_FOR_INDEPENDENT_REVIEW',
      publishingLocked:true,
      requestProductionRetry:false,
      recordFinalQaBlock:false,
      reason:'Missing perceptual assessment of exact motion video and mixed audio cannot be solved by automatic re-rendering.',
    }
  }
  return {
    action:'NORMAL_REVISION_PROCESS',
    publishingLocked:true,
    requestProductionRetry:true,
    recordFinalQaBlock:true,
    reason:'Non-perceptual QA gate failed; handle through content or technical revision workflow.',
  }
}
