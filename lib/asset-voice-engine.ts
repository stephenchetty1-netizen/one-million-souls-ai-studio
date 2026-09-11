export type AssetRequest = { id: string; scene: number; prompt: string; kind: 'visual' | 'cover'; aspectRatio: '9:16' | '1:1' }
export type VoiceRequest = { scene: number; text: string; voiceStyle: string; language: string }
export type AudioMix = { musicSource: 'platform-cleared-or-original'; duckDb: number; voiceFirst: true }
export type AssetVoiceManifest = {
  version: 'V23'
  assets: AssetRequest[]
  voice: { provider: 'external-renderer'; requests: VoiceRequest[]; style: string }
  audio: AudioMix
  assembly: { resolution: '1080x1920'; fps: 30; format: 'mp4'; captions: true }
  guardrails: string[]
}

const clean = (v: string, n: number) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n)

export function buildAssetVoiceManifest(plan: any): AssetVoiceManifest {
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : []
  const assets: AssetRequest[] = scenes.map((s: any, i: number) => ({
    id: `scene-${i + 1}`,
    scene: i + 1,
    prompt: clean(s.visualPrompt, 700),
    kind: 'visual',
    aspectRatio: '9:16',
  }))
  assets.push({ id: 'cover', scene: 0, prompt: clean(plan?.assets?.coverPrompt, 700), kind: 'cover', aspectRatio: '9:16' })
  const requests: VoiceRequest[] = scenes.map((s: any) => ({
    scene: s.scene,
    text: clean(s.narration, 1200),
    voiceStyle: clean(plan?.voice?.tone || 'warm, confident, compassionate, reverent', 180),
    language: clean(plan?.voice?.language || 'English', 40),
  }))
  return {
    version: 'V23', assets, voice: { provider: 'external-renderer', requests, style: 'Natural, clear Christian devotional narration; no impersonation of a real person.' },
    audio: { musicSource: 'platform-cleared-or-original', duckDb: -12, voiceFirst: true },
    assembly: { resolution: '1080x1920', fps: 30, format: 'mp4', captions: true },
    guardrails: [
      'Generate or use only owned, licensed, public-domain or platform-cleared visual/audio assets.',
      'Do not imitate or impersonate a real person without authorization.',
      'Do not add copyrighted lyrics or unlicensed music.',
      'Preserve verified Scripture and approved narration; do not invent quotations.',
      'Do not publish until the renderer returns a valid HTTPS MP4 media URL.',
    ],
  }
}

export function validateAssetVoiceManifest(m: AssetVoiceManifest) {
  const errors: string[] = []
  if (m.version !== 'V23') errors.push('Unsupported manifest version.')
  if (!m.assets.length) errors.push('No visual assets requested.')
  if (!m.voice.requests.length) errors.push('No voice requests created.')
  if (m.assembly.resolution !== '1080x1920' || m.assembly.format !== 'mp4') errors.push('Invalid assembly specification.')
  if (m.audio.voiceFirst !== true) errors.push('Voice priority must remain enabled.')
  return { valid: errors.length === 0, errors }
}
