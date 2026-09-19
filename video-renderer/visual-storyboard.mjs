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
  'BE STILL':[
    {stockId:'shoreline-footprints-waves',meaning:'Waves slowly erase footprints in sand: release the urge to control every outcome',startSeconds:5},
    {stockId:'pangong-lake-waves',meaning:'A close shoreline rhythm underscores the invitation to stop striving and remember God',startSeconds:0},
    {stockId:'golden-sunset-january',meaning:'Actual golden evening light resolves the same waterside story with a hopeful response of prayer and trust',startSeconds:7},
  ],
  'GOD IS NEAR':[
    {stockId:'domica-cave',meaning:'A dark enclosed space conveys the felt distance of grief',startSeconds:0},
    {stockId:'shoreline-footprints-waves',meaning:'Moving water creates room to breathe and hear Psalm 34:18',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Warm light resolves the sequence with a quiet sense of nearness',startSeconds:5},
  ],
  'FAITH OVER FEAR':[
    {stockId:'domica-cave',meaning:'Cave darkness represents the uncertainty fear magnifies',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'A steady shoreline rhythm holds the promise of Isaiah 41:10',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Open evening light marks one faithful step beyond fear',startSeconds:5},
  ],
  'GRACE IN WEAKNESS':[
    {stockId:'shoreline-footprints-waves',meaning:'Footprints erased by waves show the limits of self-reliance',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'A persistent water rhythm carries the sufficiency of grace',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Gentle sunset light closes on dependence rather than performance',startSeconds:5},
  ],
  'KEEP PRAYING':[
    {stockId:'shoreline-footprints-waves',meaning:'Waves washing over footprints convey repeated waiting',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'Unhurried lake movement holds the invitation to persevere',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Evening light closes with prayerful patience, not a promised deadline',startSeconds:5},
  ],
  'GOD IS STILL WORKING':[
    {stockId:'domica-cave',meaning:'A shadowed cave establishes a chapter whose outcome is unseen',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'Continuing waves imply movement even when change is hard to notice',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Evening light resolves in trust without claiming every pain is explained',startSeconds:5},
  ],
  'YOU ARE NOT ALONE':[
    {stockId:'domica-cave',meaning:'An empty cave illustrates felt isolation without depicting a person',startSeconds:0},
    {stockId:'shoreline-footprints-waves',meaning:'Footprints at the waterline suggest presence and a path forward',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Warm light opens the final beat toward connection and hope',startSeconds:5},
  ],
  'LET YOUR LIGHT SHINE':[
    {stockId:'domica-cave',meaning:'A dim interior contrasts the choice to hide faith',startSeconds:0},
    {stockId:'golden-sunset-january',meaning:'Natural golden light illustrates visible kindness without spectacle',startSeconds:2},
    {stockId:'hornbill-morning',meaning:'Morning wildlife carries the invitation to live faith in ordinary life',startSeconds:5},
  ],
  'NOTHING CAN SEPARATE YOU':[
    {stockId:'domica-cave',meaning:'A cave establishes changing circumstances and uncertainty',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'Unbroken lake movement anchors the constancy of love in Christ',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Evening light closes the same journey without implying life is easy',startSeconds:5},
  ],
  'START AGAIN WITH GOD':[
    {stockId:'shoreline-footprints-waves',meaning:'Waves erasing footprints mark the end of yesterday',startSeconds:0},
    {stockId:'pangong-lake-waves',meaning:'Fresh water movement carries the mercy of a new beginning',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'A sunset signals the possibility of a faithful next step',startSeconds:5},
  ],
  'RUN YOUR RACE':[
    {stockId:'shoreline-footprints-waves',meaning:'Footprints show an individual path rather than comparison',startSeconds:0},
    {stockId:'dragon-boat-sunrise',meaning:'Real coordinated rowing illustrates endurance and steady effort',startSeconds:2},
    {stockId:'golden-sunset-january',meaning:'Evening light closes on finishing the day with eyes on Jesus',startSeconds:5},
  ],
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
