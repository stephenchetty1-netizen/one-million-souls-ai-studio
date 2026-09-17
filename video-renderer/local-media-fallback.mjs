import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

function sceneSvg(index = 0) {
  const variants = [
    {
      sky1: '#071A33', sky2: '#E99847', glow: '#FFD88A',
      body: `
        <circle cx="540" cy="560" r="220" fill="url(#sunGlow)" opacity="0.95"/>
        <path d="M0 1210 L190 970 L340 1120 L530 790 L710 1100 L900 900 L1080 1100 L1080 1920 L0 1920 Z" fill="#10243F"/>
        <path d="M0 1410 L210 1210 L400 1320 L590 1070 L760 1270 L930 1140 L1080 1270 L1080 1920 L0 1920 Z" fill="#071421"/>
        <rect x="354" y="1370" width="372" height="28" rx="14" fill="#21160D" opacity="0.95"/>
        <path d="M350 1370 C430 1295 500 1295 540 1330 C580 1295 650 1295 730 1370 L730 1450 C650 1390 585 1390 540 1420 C495 1390 430 1390 350 1450 Z" fill="#F5E9D0" opacity="0.95"/>
        <line x1="540" y1="1328" x2="540" y2="1420" stroke="#B88B56" stroke-width="5" opacity="0.8"/>
      `,
    },
    {
      sky1: '#081525', sky2: '#B46D37', glow: '#F7D28A',
      body: `
        <rect x="120" y="220" width="840" height="1050" rx="28" fill="#09131F" opacity="0.62"/>
        <rect x="150" y="250" width="780" height="990" rx="20" fill="url(#windowLight)" opacity="0.86"/>
        <path d="M150 250 L930 250 L690 1240 L320 1240 Z" fill="#FFDFA5" opacity="0.14"/>
        <rect x="210" y="1280" width="660" height="36" rx="18" fill="#24170F"/>
        <path d="M260 1280 C365 1195 465 1195 540 1245 C615 1195 715 1195 820 1280 L820 1430 C720 1365 625 1365 540 1415 C455 1365 360 1365 260 1430 Z" fill="#F2E3C4"/>
        <line x1="540" y1="1240" x2="540" y2="1415" stroke="#B98D5F" stroke-width="6"/>
        <circle cx="760" cy="470" r="8" fill="#FFF4D6" opacity="0.75"/>
        <circle cx="720" cy="520" r="5" fill="#FFF4D6" opacity="0.55"/>
        <circle cx="800" cy="580" r="4" fill="#FFF4D6" opacity="0.45"/>
      `,
    },
    {
      sky1: '#06182B', sky2: '#D87A3F', glow: '#FFD57D',
      body: `
        <circle cx="540" cy="500" r="250" fill="url(#sunGlow)" opacity="0.96"/>
        <path d="M0 1280 C240 1180 360 1160 540 1200 C720 1160 850 1180 1080 1280 L1080 1920 L0 1920 Z" fill="#102B42"/>
        <path d="M0 1450 C260 1380 420 1360 540 1390 C670 1360 850 1390 1080 1470 L1080 1920 L0 1920 Z" fill="#06131E"/>
        <g fill="#111111"><circle cx="540" cy="1125" r="44"/><path d="M505 1160 C520 1142 560 1142 575 1160 L610 1310 L470 1310 Z"/></g>
        <rect x="755" y="900" width="18" height="220" rx="9" fill="#1A130C"/>
        <rect x="690" y="960" width="148" height="18" rx="9" fill="#1A130C"/>
      `,
    },
  ]

  const v = variants[index % variants.length]
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${v.sky1}"/><stop offset="60%" stop-color="${v.sky2}"/><stop offset="100%" stop-color="#F1B873"/>
      </linearGradient>
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF6D6" stop-opacity="1"/><stop offset="35%" stop-color="${v.glow}" stop-opacity="0.9"/><stop offset="100%" stop-color="${v.glow}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="windowLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDEAC7"/><stop offset="100%" stop-color="#C8793A"/></linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#sky)"/>
    <ellipse cx="540" cy="700" rx="520" ry="420" fill="${v.glow}" opacity="0.08"/>
    ${v.body}
    <g opacity="0.18" fill="#FFFFFF"><circle cx="120" cy="260" r="3"/><circle cx="930" cy="340" r="4"/><circle cx="830" cy="220" r="2"/><circle cx="260" cy="420" r="2"/><circle cx="610" cy="310" r="3"/><circle cx="470" cy="180" r="2"/></g>
  </svg>`
}

async function renderStillMotion(input, output, index = 0, seconds = 5) {
  const frames = Math.max(1, Math.round(seconds * 30))
  const zoomExpr = index % 2 === 0
    ? `zoom='min(zoom+0.00065,1.10)':x='iw/2-(iw/zoom/2)+sin(on/30)*7':y='ih/2-(ih/zoom/2)+cos(on/37)*6'`
    : `zoom='if(eq(on,1),1.08,max(1.0,zoom-0.00055))':x='iw/2-(iw/zoom/2)+cos(on/34)*6':y='ih/2-(ih/zoom/2)+sin(on/41)*7'`

  await execFileAsync('ffmpeg', [
    '-y', '-loop', '1', '-i', input,
    '-filter_threads', '1',
    '-vf', `scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=${zoomExpr}:d=${frames}:s=1080x1920:fps=30,eq=contrast=1.035:saturation=1.07:gamma=1.01,vignette=PI/7`,
    '-t', String(seconds), '-an',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p',
    output,
  ], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 })

  const stat = await fs.stat(output)
  if (stat.size < 10000) throw new Error('Still-image motion render produced an invalid MP4')
}

export async function animateStillImage(inputPath, index, work, seconds = 5, source = 'cloud-image-local-motion') {
  const mp4 = path.join(work, `motion-scene-${index + 1}.mp4`)
  await renderStillMotion(inputPath, mp4, index, seconds)
  return { local: mp4, source, imageUrl: null, videoUrl: null }
}

export async function createLocalFallbackScene(index, work, seconds = 5) {
  const png = path.join(work, `local-scene-${index + 1}.png`)
  await sharp(Buffer.from(sceneSvg(index))).png().toFile(png)
  return animateStillImage(png, index, work, seconds, 'local-procedural-cinematic')
}

export async function createLocalAmbientMusic(duration, work) {
  const seconds = Math.max(8, Math.min(60, Math.ceil(duration)))
  const out = path.join(work, 'music-local.m4a')
  const fadeOut = Math.max(0, seconds - 2.2)
  const expr = `0.020*sin(2*PI*220*t)+0.015*sin(2*PI*277.18*t)+0.012*sin(2*PI*329.63*t)+0.008*sin(2*PI*440*t)`

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `aevalsrc=${expr}:s=44100:d=${seconds}`,
    '-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=0.004:sample_rate=44100:d=${seconds}`,
    '-filter_complex', `[0:a]lowpass=f=2200,volume=0.85[a0];[1:a]lowpass=f=900,volume=0.25[a1];[a0][a1]amix=inputs=2:duration=longest,afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOut}:d=2.2,volume=0.8[a]`,
    '-map', '[a]', '-c:a', 'aac', '-b:a', '128k', '-threads', '1', out,
  ], { timeout: 120000, maxBuffer: 5 * 1024 * 1024 })

  const stat = await fs.stat(out)
  if (stat.size < 5000) throw new Error('Local ambient music generation produced invalid audio')
  return { url: null, local: out, provider: 'local-ffmpeg-ambient' }
}
