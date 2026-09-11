import type { MediaDirection } from './media-director'
import type { FactoryAsset } from './content-factory'

type VideoScene = {
  scene: number
  startSeconds: number
  durationSeconds: number
  visualPrompt: string
  onScreenText: string
  narration: string
  transition: string
}

export type VideoProductionManifest = {
  manifestVersion: '22.0'
  jobId: string
  durationSeconds: number
  aspectRatio: '9:16'
  voice: { enabled: true; language: 'en'; delivery: string }
  captions: { enabled: true; source: 'narration'; burnIn: true; maxLines: 2 }
  audio: { direction: string; voicePriority: true; lyrics: false }
  scenes: VideoScene[]
  coverConcept: string
  platformNotes: { tiktok: string; youtube: string }
  platformPackages: FactoryAsset['platformPackages']
  rights: { generatedOrLicensedMediaOnly: true; noUnlicensedMusic: true }
  aiDisclosure: { requiredIfPlatformOrPolicyRequires: true }
  guardrails: string[]
}

const clean = (value: string, max = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)

export function buildVideoProductionManifest(input: {
  jobId: string
  asset: FactoryAsset
  campaign: any
  mediaDirection: MediaDirection
}): VideoProductionManifest {
  const md = input.mediaDirection
  const scenes = md.scenes.map((scene) => ({
    scene: scene.scene,
    startSeconds: 0,
    durationSeconds: Math.max(2, Math.min(12, scene.durationSeconds)),
    visualPrompt: clean(`${scene.visual}. Overall visual style: ${md.visualStyle}. Topic: ${input.campaign?.topic || input.asset.sourceCampaignTitle}.`, 700),
    onScreenText: clean(scene.onScreenText, 180),
    narration: clean(scene.narration, 700),
    transition: clean(scene.transition, 80),
  }))

  let cursor = 0
  for (const scene of scenes) {
    scene.startSeconds = cursor
    cursor += scene.durationSeconds
  }

  return {
    manifestVersion: '22.0',
    jobId: input.jobId,
    durationSeconds: cursor,
    aspectRatio: '9:16',
    voice: { enabled: true, language: 'en', delivery: 'Warm, sincere, confident Christian encouragement; natural pacing with clear diction and emotional restraint.' },
    captions: { enabled: true, source: 'narration', burnIn: true, maxLines: 2 },
    audio: { direction: md.audioDirection, voicePriority: true, lyrics: false },
    scenes,
    coverConcept: md.coverConcept,
    platformNotes: md.platformNotes,
    platformPackages: input.asset.platformPackages,
    rights: { generatedOrLicensedMediaOnly: true, noUnlicensedMusic: true },
    aiDisclosure: { requiredIfPlatformOrPolicyRequires: true },
    guardrails: [...md.guardrails, 'Do not add claims, Scripture, quotations or promises that are absent from the approved campaign.', 'Do not clone or impersonate a real person’s voice.', 'Do not use copyrighted song lyrics in narration or captions.'],
  }
}

export function validateVideoProductionManifest(manifest: VideoProductionManifest) {
  if (manifest.manifestVersion !== '22.0' || manifest.aspectRatio !== '9:16') return false
  if (manifest.durationSeconds < 20 || manifest.durationSeconds > 60) return false
  if (manifest.scenes.length < 3) return false
  if (!manifest.scenes.every(s => s.durationSeconds >= 2 && s.visualPrompt && s.narration && s.onScreenText)) return false
  if (!manifest.platformPackages?.tiktok || !manifest.platformPackages?.youtube) return false
  return manifest.rights.generatedOrLicensedMediaOnly && manifest.rights.noUnlicensedMusic && manifest.audio.lyrics === false
}
