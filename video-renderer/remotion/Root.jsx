import React from 'react';
import {Composition} from 'remotion';
import {ChristianShort} from './ChristianShort.jsx';
import {YoutubeSinglePromptShort} from './YoutubeSinglePromptShort.jsx';
import {
  DEFAULT_DIRECTOR_SPEC,
  OMS_DURATION_SECONDS,
  OMS_FPS,
  OMS_HEIGHT,
  OMS_WIDTH,
} from './director-spec.mjs';
import {
  YOUTUBE_SINGLE_PROMPT_ID,
  YOUTUBE_SINGLE_PROMPT_SPEC,
  YOUTUBE_SINGLE_PROMPT_DURATION,
  YOUTUBE_SINGLE_PROMPT_FPS,
  YOUTUBE_SINGLE_PROMPT_HEIGHT,
  YOUTUBE_SINGLE_PROMPT_WIDTH,
} from './youtube-single-prompt.mjs';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OMS-Christian-Short"
        component={ChristianShort}
        durationInFrames={OMS_DURATION_SECONDS * OMS_FPS}
        fps={OMS_FPS}
        width={OMS_WIDTH}
        height={OMS_HEIGHT}
        defaultProps={DEFAULT_DIRECTOR_SPEC}
      />
      <Composition
        id={YOUTUBE_SINGLE_PROMPT_ID}
        component={YoutubeSinglePromptShort}
        durationInFrames={YOUTUBE_SINGLE_PROMPT_DURATION * YOUTUBE_SINGLE_PROMPT_FPS}
        fps={YOUTUBE_SINGLE_PROMPT_FPS}
        width={YOUTUBE_SINGLE_PROMPT_WIDTH}
        height={YOUTUBE_SINGLE_PROMPT_HEIGHT}
        defaultProps={YOUTUBE_SINGLE_PROMPT_SPEC}
      />
    </>
  );
};
