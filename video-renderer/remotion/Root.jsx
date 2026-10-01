import React from 'react';
import {Composition} from 'remotion';
import {ChristianShort} from './ChristianShort.jsx';
import {
  DEFAULT_DIRECTOR_SPEC,
  OMS_DURATION_SECONDS,
  OMS_FPS,
  OMS_HEIGHT,
  OMS_WIDTH,
} from './director-spec.mjs';

export const RemotionRoot = () => {
  return (
    <Composition
      id="OMS-Christian-Short"
      component={ChristianShort}
      durationInFrames={OMS_DURATION_SECONDS * OMS_FPS}
      fps={OMS_FPS}
      width={OMS_WIDTH}
      height={OMS_HEIGHT}
      defaultProps={DEFAULT_DIRECTOR_SPEC}
    />
  );
};
