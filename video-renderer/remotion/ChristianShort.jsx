import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const BRAND = {
  navy: '#071425',
  blue: '#1778f2',
  gold: '#f5c451',
  white: '#f7fbff',
  silver: '#c8d0da',
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};

const Scene = ({scene, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    fps,
    frame,
    config: {damping: 18, stiffness: 115, mass: 0.8},
  });
  const opacity = interpolate(
    frame,
    [0, 8, Math.max(9, durationInFrames - 10), durationInFrames - 1],
    [0, 1, 1, 0],
    clamp,
  );
  const drift = interpolate(frame, [0, durationInFrames], [18, -18], clamp);
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.09], clamp);
  const titleY = interpolate(enter, [0, 1], [80, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: BRAND.navy, overflow: 'hidden'}}>
      {scene.mediaUrl ? (
        <OffthreadVideo
          src={scene.mediaUrl}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom}) translateY(${drift}px)`,
            filter: 'saturate(0.88) contrast(1.08) brightness(0.72)',
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            transform: `scale(${zoom}) translateY(${drift}px)`,
            background:
              'radial-gradient(circle at 75% 18%, rgba(23,120,242,.42), transparent 31%), radial-gradient(circle at 24% 72%, rgba(245,196,81,.20), transparent 34%), linear-gradient(155deg, #071425 0%, #0a2440 55%, #05090f 100%)',
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,.26) 0%, rgba(0,0,0,.12) 38%, rgba(0,0,0,.82) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 118,
          height: 6,
          borderRadius: 99,
          background: 'rgba(255,255,255,.13)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, (frame / Math.max(1, durationInFrames - 1)) * 100)}%`,
            height: '100%',
            background: BRAND.gold,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 78,
          right: 78,
          top: 330,
          opacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'Lato, Arial, sans-serif',
            color: BRAND.gold,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: 8,
            marginBottom: 28,
          }}
        >
          {scene.kicker}
        </div>
        <div
          style={{
            fontFamily: 'Lato, Arial, sans-serif',
            color: BRAND.white,
            fontSize: scene.id === 'hook' ? 104 : 92,
            lineHeight: 0.98,
            fontWeight: 900,
            letterSpacing: -3,
            textTransform: 'uppercase',
            textShadow: '0 14px 45px rgba(0,0,0,.45)',
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 34,
            maxWidth: 860,
            fontFamily: 'Lato, Arial, sans-serif',
            color: BRAND.silver,
            fontSize: 42,
            lineHeight: 1.25,
            fontWeight: 700,
          }}
        >
          {scene.body}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 78,
          right: 78,
          bottom: 95,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'rgba(255,255,255,.72)',
          fontFamily: 'Lato, Arial, sans-serif',
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 3,
        }}
      >
        <span>ONE MILLION SOULS</span>
        <span>JESUS • HOPE • FAITH</span>
      </div>
    </AbsoluteFill>
  );
};

const CaptionLayer = ({captions = []}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const activeIndex = captions.findIndex(
    (caption) => nowMs >= Number(caption.startMs) && nowMs < Number(caption.endMs),
  );

  if (activeIndex < 0) return null;

  const start = Math.max(0, activeIndex - 1);
  const window = captions.slice(start, start + 4);

  return (
    <div
      style={{
        position: 'absolute',
        left: 78,
        right: 78,
        bottom: 245,
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '8px 14px',
        pointerEvents: 'none',
      }}
    >
      {window.map((caption, offset) => {
        const index = start + offset;
        const active = index === activeIndex;
        return (
          <span
            key={`${caption.startMs}-${index}`}
            style={{
              fontFamily: 'Lato, Arial, sans-serif',
              fontSize: active ? 58 : 51,
              lineHeight: 1.05,
              fontWeight: 900,
              color: active ? BRAND.gold : BRAND.white,
              textTransform: 'uppercase',
              textShadow: active
                ? '0 0 22px rgba(245,196,81,.32), 0 7px 24px rgba(0,0,0,.82)'
                : '0 7px 24px rgba(0,0,0,.82)',
              transform: active ? 'scale(1.06)' : 'scale(1)',
              whiteSpace: 'pre',
            }}
          >
            {caption.text.trim()}
          </span>
        );
      })}
    </div>
  );
};

export const ChristianShort = (props) => {
  const {fps} = useVideoConfig();
  const scenes = props.scenes ?? [];
  const durationSeconds = Number(props.durationSeconds ?? 59);

  return (
    <AbsoluteFill style={{backgroundColor: BRAND.navy}}>
      {scenes.map((scene) => {
        const from = Math.round(Number(scene.start) * fps);
        const durationInFrames = Math.max(
          1,
          Math.round((Number(scene.end) - Number(scene.start)) * fps),
        );
        return (
          <Sequence
            key={scene.id || `${scene.start}-${scene.end}`}
            from={from}
            durationInFrames={durationInFrames}
            premountFor={Math.min(15, durationInFrames)}
          >
            <Scene scene={scene} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}

      {props.audioUrl ? <Audio src={props.audioUrl} volume={0.82} /> : null}
      <CaptionLayer captions={props.captions} />

      <div
        style={{
          position: 'absolute',
          right: 64,
          top: 166,
          color: 'rgba(255,255,255,.48)',
          fontFamily: 'Lato, Arial, sans-serif',
          fontSize: 22,
          letterSpacing: 2,
          fontWeight: 800,
        }}
      >
        {Math.round(durationSeconds)}s • 9:16
      </div>
    </AbsoluteFill>
  );
};
