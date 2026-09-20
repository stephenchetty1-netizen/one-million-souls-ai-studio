// A technically complete source bank may be cut into a private preview,
// never published and never inherit rejected footage's prior review.
export const SOURCE_REPLACEMENT_MAX_ATTEMPTS=4
export function planRejectedSourceRecovery(format,stage,{privatePreviewEnabled=false}={}){
 const required=format==='SHORT_59'?9:format==='YOUTUBE_LONG'?24:0
 if(!required)throw new Error('UNSUPPORTED_RECOVERY_FORMAT')
 const complete=stage?.format===format&&stage?.technicalSourceReady===true&&
   Number(stage?.sourceClips)>=required
 return {bankComplete:Boolean(complete),retry:!complete,
   regeneratePrivatePreview:Boolean(complete&&format==='SHORT_59'&&privatePreviewEnabled),
   publishingAllowed:false,certified:false}
}
