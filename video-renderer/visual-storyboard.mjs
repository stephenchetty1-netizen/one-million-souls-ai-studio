// V59 visual coherence contract. These are planning/technical checks, NOT a
// perceptual certificate and NOT publishing authority.
export const STORYBOARD_VERSION='v59-visual-coherence-v1'
export const BEAT_STAGES=Object.freeze(['TENSION','SCRIPTURE','RESPONSE'])
export const CAPTION_LAYOUT=Object.freeze({
  width:1080,height:1920,fontSize:58,maxWords:4,maxCharacters:32,
  leftMargin:140,rightMargin:180,bottomMargin:650,
  minimumSecondsPerPhrase:0.85,
})

// Explicit source choices have an editorial rationale; the stock library must
// not silently pick unrelated assets by numeric index when generation fails.
// Other titles need a reviewed 3-beat selection or actual coherent AI video.
const CURATED_STOCK_STORYBOARDS=Object.freeze({
  'DO NOT CARRY TOMORROW':[
    {stockId:'sunrise-storm-portrait',meaning:'Today begins; tomorrow is still unknown',startSeconds:0},
    {stockId:'domica-cave',meaning:'A temporary visual metaphor for feeling overwhelmed by worry',startSeconds:0},
    {stockId:'sunrise-storm-portrait',meaning:'Return to morning light: choose todays faithful next step',startSeconds:9,repriseOf:0},
  ],
})
function words(value){return String(value||'').trim().split(/\s+/).filter(Boolean)}
function contiguousParts(script,parts=3){
  const tokens=words(script)
  if(tokens.length<24)throw new Error('STORYBOARD_SCRIPT_TOO_SHORT')
  const chunks=[]
  for(let i=0;i<parts;i++){
    const start=Math.floor(tokens.length*i/parts)
    const end=Math.floor(tokens.length*(i+1)/parts)
    chunks.push(tokens.slice(start,end).join(' '))
  }
  return chunks
}
function normalizeTitle(title){return String(title||'').trim().replace(/\s+/g,' ').toUpperCase()}
export function planVisualStory({title,script,scriptureReference='',visualPrompts=[]}={}){
  const name=normalizeTitle(title)
  if(!name)throw new Error('STORYBOARD_TITLE_REQUIRED')
  const parts=contiguousParts(script)
  const sourceChoices=CURATED_STOCK_STORYBOARDS[name]||null
  const supplied=Array.isArray(visualPrompts)?visualPrompts.filter(x=>typeof x==='string'&&x.trim()):[]
  if(supplied.length>0&&supplied.length!==3)throw new Error('STORYBOARD_EXACTLY_THREE_VISUAL_PROMPTS_REQUIRED')
  const beatDescriptions=[
    'Communicate the human tension or felt need without unrelated travel or recreational B-roll.',
    'Show the shift to Scripture and a grounded present moment, not a random change of location.',
    'Pay off the same visual story through prayer, action, or trusting God. Visually echo the opening where useful.',
  ]
  const beats=BEAT_STAGES.map((stage,index)=>({
    stage,index,narration:parts[index],
    visualPurpose:beatDescriptions[index],
    prompt:supplied[index]?.trim()||null,
    ...(sourceChoices?.[index]||{}),
  }))
  return {
    version:STORYBOARD_VERSION,title:name,scriptureReference:String(scriptureReference||''),
    theme:'One continuous narrative: felt need → Scripture → faithful response',
    beats,
    stockStoryboardAvailable:Boolean(sourceChoices),
    originalSequenceRequired:true,
    humanPerceptualReviewRequired:true,
    publishingLocked:true,
  }
}
export function stockSelectionForBeat(plan,index){
  if(plan?.version!==STORYBOARD_VERSION||!Array.isArray(plan.beats)||plan.beats.length!==3)
    throw new Error('STORYBOARD_PLAN_REQUIRED')
  const beat=plan.beats[index]
  if(!beat||!beat.stockId)throw new Error('NO_SEMANTICALLY_CURATED_STOCK_SHOT_FOR_BEAT_'+index)
  return {stockId:beat.stockId,startSeconds:beat.startSeconds||0,repriseOf:beat.repriseOf??null,
    stage:beat.stage,meaning:beat.meaning,storyboardVersion:STORYBOARD_VERSION}
}
export function inspectVisualStoryboard(plan,scenes){
  if(plan?.version!==STORYBOARD_VERSION||!Array.isArray(scenes)||scenes.length!==3)
    throw new Error('VISUAL_STORYBOARD_MISSING_OR_SCENE_COUNT_WRONG')
  const faults=[]
  for(let i=0;i<3;i++){
    const beat=plan.beats[i],scene=scenes[i]
    if(beat?.stage!==BEAT_STAGES[i]||!beat?.narration||!beat?.visualPurpose)faults.push('INCOMPLETE_BEAT_'+i)
    if(!scene?.local||!scene?.source)faults.push('SCENE_MISSING_'+i)
    if(scene?.source==='rights-cleared-stock-video'){
      if(!beat?.stockId||scene.stockId!==beat.stockId)faults.push('UNMATCHED_STOCK_SHOT_'+i)
      if(!scene.sourcePage||!scene.license||!scene.rightsNote)faults.push('STOCK_RIGHTS_MISSING_'+i)
      if((scene.startSeconds||0)!==(beat.startSeconds||0))faults.push('STOCK_TRIM_MISMATCH_'+i)
      if(beat.repriseOf!==undefined){
        if(beat.repriseOf>=i||scenes[beat.repriseOf]?.stockId!==scene.stockId||
           Math.abs((scenes[beat.repriseOf]?.startSeconds||0)-(scene.startSeconds||0))<5){
          faults.push('INVALID_VISUAL_REPRISE_'+i)
        }
      }else if(scenes.slice(0,i).some((prior)=>prior.stockId===scene.stockId)){
        faults.push('UNPLANNED_DUPLICATE_STOCK_'+i)
      }
    }
    if(['local-procedural-cinematic','cloud-image-local-motion'].includes(scene?.source))
      faults.push('STILL_OR_PROCEDURAL_SUBSTITUTE_'+i)
  }
  if(faults.length)throw new Error('VISUAL_STORYBOARD_BLOCK:'+faults.join(','))
  return {
    passed:true,contractStatus:'TECHNICAL_STORYBOARD_MATCH_CREATIVE_REVIEW_PENDING',
    version:STORYBOARD_VERSION,originalSequenceRequired:true,
    beats:plan.beats.map((beat,i)=>({
      stage:beat.stage,visualPurpose:beat.visualPurpose,narration:beat.narration,
      stockId:scenes[i].stockId||null,source:scenes[i].source,
      startSeconds:scenes[i].startSeconds||0,repriseOf:beat.repriseOf??null,
    })),
    humanPerceptualReviewRequired:true,publishingAuthority:false,
  }
}
