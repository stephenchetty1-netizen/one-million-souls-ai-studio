export const OMS_DURATION_SECONDS = 59;
export const OMS_FPS = 30;
export const OMS_WIDTH = 1080;
export const OMS_HEIGHT = 1920;

export function generateWordCaptions(text, durationMs = OMS_DURATION_SECONDS * 1000) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const slot = durationMs / words.length;
  return words.map((word, index) => ({
    text: index === 0 ? word : ' ' + word,
    startMs: Math.round(index * slot),
    endMs: Math.round((index + 1) * slot),
    timestampMs: Math.round((index + 0.5) * slot),
    confidence: null,
  }));
}

const defaultNarration =
  'Before you scroll remember this God is still working even when you cannot see it. ' +
  'Trust the Lord in the waiting. His Word is steady when your feelings are not. ' +
  'Jesus is still calling hearts back to hope, prayer and faith. ' +
  'Do not quit in the middle of the story. Keep praying. Keep believing. ' +
  'Let your light shine and point someone to Jesus today.';

export const DEFAULT_DIRECTOR_SPEC = {
  durationSeconds: OMS_DURATION_SECONDS,
  brand: 'ONE MILLION SOULS',
  theme: 'God is still working',
  scripture: 'Philippians 4:13',
  audioUrl: null,
  scenes: [
    {
      id: 'hook',
      start: 0,
      end: 1.5,
      kicker: 'STOP SCROLLING',
      title: 'WHAT IF GOD IS STILL WORKING?',
      body: 'Even when you cannot see it.',
      mediaUrl: null,
    },
    {
      id: 'tension',
      start: 1.5,
      end: 5,
      kicker: 'THE WAITING',
      title: 'SILENCE DOES NOT MEAN ABSENCE',
      body: 'Faith keeps standing before the answer arrives.',
      mediaUrl: null,
    },
    {
      id: 'setup',
      start: 5,
      end: 12,
      kicker: 'REMEMBER',
      title: 'GOD HAS NOT LOST YOUR ADDRESS',
      body: 'Bring the fear, the delay and the questions back to Him.',
      mediaUrl: null,
    },
    {
      id: 'revelation',
      start: 12,
      end: 22,
      kicker: 'SCRIPTURE',
      title: 'I CAN DO ALL THINGS THROUGH CHRIST',
      body: 'Philippians 4:13',
      mediaUrl: null,
    },
    {
      id: 'escalation',
      start: 22,
      end: 35,
      kicker: 'KEEP GOING',
      title: 'DO NOT QUIT IN THE MIDDLE OF THE STORY',
      body: 'The chapter you are in is not the whole testimony.',
      mediaUrl: null,
    },
    {
      id: 'application',
      start: 35,
      end: 47,
      kicker: 'TODAY',
      title: 'PRAY. BELIEVE. MOVE.',
      body: 'Choose one faithful step and take it with Jesus.',
      mediaUrl: null,
    },
    {
      id: 'payoff',
      start: 47,
      end: 55,
      kicker: 'HOLD ON',
      title: 'YOUR HOPE HAS A NAME: JESUS',
      body: 'Let His Word be louder than the fear.',
      mediaUrl: null,
    },
    {
      id: 'cta',
      start: 55,
      end: 59,
      kicker: 'ONE MISSION',
      title: 'ONE MILLION SOULS',
      body: 'Share this with someone who needs hope today.',
      mediaUrl: null,
    },
  ],
  captions: generateWordCaptions(defaultNarration),
};

export function validateDirectorSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('Director spec must be an object');
  if (!Array.isArray(spec.scenes) || spec.scenes.length < 2) {
    throw new Error('Director spec must contain at least 2 scenes');
  }

  const duration = Number(spec.durationSeconds ?? OMS_DURATION_SECONDS);
  if (!Number.isFinite(duration) || duration <= 0 || duration > OMS_DURATION_SECONDS) {
    throw new Error('durationSeconds must be between 0 and 59');
  }

  const sorted = [...spec.scenes].sort((a, b) => Number(a.start) - Number(b.start));
  if (Math.abs(Number(sorted[0].start)) > 0.001) throw new Error('First scene must start at 0');

  let cursor = 0;
  for (const scene of sorted) {
    const start = Number(scene.start);
    const end = Number(scene.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Every scene requires numeric start/end with end > start');
    }
    if (Math.abs(start - cursor) > 0.02) throw new Error('Scenes must be contiguous with no timing gaps');
    if (!scene.title) throw new Error('Every scene requires a title');
    cursor = end;
  }

  if (Math.abs(cursor - duration) > 0.02) {
    throw new Error('Final scene end must match durationSeconds');
  }

  if (spec.captions != null) {
    if (!Array.isArray(spec.captions)) throw new Error('captions must be an array');
    for (const caption of spec.captions) {
      if (typeof caption.text !== 'string') throw new Error('caption.text must be a string');
      if (!Number.isFinite(Number(caption.startMs)) || !Number.isFinite(Number(caption.endMs))) {
        throw new Error('caption timing must be numeric');
      }
    }
  }

  return true;
}

export function normalizeDirectorSpec(input = {}) {
  const merged = {
    ...DEFAULT_DIRECTOR_SPEC,
    ...input,
    scenes: Array.isArray(input.scenes) ? input.scenes : DEFAULT_DIRECTOR_SPEC.scenes,
    captions: Array.isArray(input.captions) ? input.captions : DEFAULT_DIRECTOR_SPEC.captions,
  };
  validateDirectorSpec(merged);
  return merged;
}
