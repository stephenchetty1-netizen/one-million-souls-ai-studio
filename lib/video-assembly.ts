export type AssemblyTrack = {
  scene: number
  visualId: string
  voiceScene: number
  startSeconds: number
  durationSeconds: number
  captionText: string
}

export type VideoAssemblyManifest = {
  version: 'V25'
  jobId: string
  output: { width: 1080; height: 1920; fps: 30; format: 'mp4'; maxDurationSeconds: 60 }
  tracks: AssemblyTrack[]
  audio: { voiceFirst: true; music: 'platform-cleared-or-original'; duckDb: number }
  captions: { enabled: true; burnedIn: true; safeArea: 'vertical-safe-area' }
  coverVisualId?: string
  platformPackages: unknown
  finalChecks: string[]
  guardrails: string[]
}

const clean=(v:string,n:number)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n)

export function buildVideoAssemblyManifest(input:any): VideoAssemblyManifest {
  const plan=input?.productionPlan || {}
  const bundle=input?.creativeAssetBundle || {}
  const scenes=Array.isArray(plan.scenes)?plan.scenes.slice(0,6):[]
  const visuals=Array.isArray(bundle.visuals)?bundle.visuals:[]
  const voice=Array.isArray(bundle.voice)?bundle.voice:[]
  let cursor=0
  const tracks:AssemblyTrack[]=scenes.map((s:any,i:number)=>{
    const duration=Math.max(1,Number(s.durationSeconds)||5)
    const scene=Number(s.scene)||i+1
    const visual=visuals.find((v:any)=>v.scene===scene && v.kind==='visual') || visuals.find((v:any)=>v.scene===scene)
    const v=voice.find((x:any)=>x.scene===scene)
    const track={scene,visualId:String(visual?.id||`scene-${scene}`),voiceScene:scene,startSeconds:cursor,durationSeconds:duration,captionText:clean(s.onScreenText || v?.text || s.narration || '',500)}
    cursor += duration
    return track
  })
  return {
    version:'V25', jobId:String(input?.jobId||''),
    output:{width:1080,height:1920,fps:30,format:'mp4',maxDurationSeconds:60},
    tracks,
    audio:{voiceFirst:true,music:'platform-cleared-or-original',duckDb:-12},
    captions:{enabled:true,burnedIn:true,safeArea:'vertical-safe-area'},
    coverVisualId:visuals.find((v:any)=>v.kind==='cover')?.id,
    platformPackages:input?.platformPackages,
    finalChecks:['duration','audio','captions','visual-completeness','scripture-integrity','rights','vertical-format'],
    guardrails:[
      'Do not alter verified Scripture or approved narration during assembly.',
      'Use only generated, owned, licensed, public-domain or platform-cleared media.',
      'Never add copyrighted lyrics or unlicensed music.',
      'Never imitate or impersonate a real person without authorization.',
      'Reject output unless renderer returns a valid HTTPS MP4 media URL.',
    ]
  }
}

export function validateVideoAssemblyManifest(m:VideoAssemblyManifest){
  const errors:string[]=[]
  if(m.version!=='V25') errors.push('Unsupported assembly manifest version.')
  if(!m.jobId) errors.push('Missing jobId.')
  if(!m.tracks.length) errors.push('No assembly tracks.')
  const end=m.tracks.reduce((x,t)=>Math.max(x,t.startSeconds+t.durationSeconds),0)
  if(end<=0 || end>m.output.maxDurationSeconds) errors.push('Video duration is outside the supported range.')
  if(m.output.width!==1080 || m.output.height!==1920 || m.output.format!=='mp4') errors.push('Invalid vertical MP4 output specification.')
  if(!m.captions.enabled || !m.captions.burnedIn) errors.push('Burned-in captions are required.')
  if(m.audio.voiceFirst!==true) errors.push('Voice-first audio mix is required.')
  if(m.tracks.some(t=>!t.visualId || !t.captionText)) errors.push('Every scene requires a visual and caption/narration text.')
  return {valid:errors.length===0,errors,durationSeconds:end}
}

export function validateRenderedVideo(result:any){
  const errors:string[]=[]
  if(typeof result?.mediaUrl!=='string' || !/^https:\/\//.test(result.mediaUrl)) errors.push('Renderer did not return a valid HTTPS mediaUrl.')
  if(result?.mimeType && result.mimeType!=='video/mp4') errors.push('Renderer returned a non-MP4 media type.')
  if(result?.durationSeconds!==undefined && (Number(result.durationSeconds)<=0 || Number(result.durationSeconds)>60)) errors.push('Rendered duration is outside the supported range.')
  return {valid:errors.length===0,errors}
}
