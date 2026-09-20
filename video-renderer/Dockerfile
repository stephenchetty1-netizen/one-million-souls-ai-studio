FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core fonts-lato ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY smoke-test.mjs ./
COPY schedule-loop.mjs ./
COPY daily-factory.mjs ./
COPY free-ai-providers.mjs ./
COPY free-ai-probe.mjs ./
COPY free-ai-gradio.mjs ./
COPY free-ai-smoke.mjs ./
COPY free-ai-render-v2.mjs ./
COPY free-ai-sample-v3.mjs ./
COPY local-kokoro-smoke.mjs ./
COPY local-media-fallback.mjs ./
COPY stock-video-library.mjs ./
COPY visual-storyboard.mjs ./
COPY visual-storyboard.test.mjs ./
COPY stock-music-library.mjs ./
COPY pexels-source-import.mjs ./
COPY pexels-source-import.test.mjs ./
COPY pexels-review-scenes.mjs ./
COPY pexels-review-scenes.test.mjs ./
COPY christian-music-video.mjs ./
COPY christian-music-video.test.mjs ./
COPY christian-narrative-story.mjs ./
COPY christian-narrative-story.test.mjs ./
COPY christian-video-formats.mjs ./
COPY christian-video-formats.test.mjs ./
COPY christian-video-timeline.mjs ./
COPY christian-video-timeline.test.mjs ./
COPY pexels-format-library.mjs ./
COPY pexels-format-library.test.mjs ./
COPY christian-visual-editorial-gate.mjs ./
COPY christian-visual-editorial-gate.test.mjs ./
COPY christian-source-review-workflow.mjs ./
COPY christian-source-review-workflow.test.mjs ./
COPY master-archive-search.mjs ./
COPY master-archive-search.test.mjs ./
COPY christian-narrated-short.mjs ./
COPY christian-narrated-short.test.mjs ./
COPY christian-reviewed-draft-integrity.mjs ./
COPY christian-reviewed-draft-integrity.test.mjs ./
COPY christian-review.html ./
COPY christian-review.js ./
RUN node --check free-ai-render-v2.mjs && node --check daily-factory.mjs && node --check stock-music-library.mjs \
 && node --check server.mjs && node --check pexels-source-import.mjs && node --check pexels-review-scenes.mjs && node --check christian-music-video.mjs && node --check christian-narrative-story.mjs && node --check christian-video-formats.mjs && node --check christian-video-timeline.mjs && node --check pexels-format-library.mjs && node --check christian-visual-editorial-gate.mjs && node --check christian-source-review-workflow.mjs && node --check christian-review.js && node --check master-archive-search.mjs && node --check christian-narrated-short.mjs && node --check christian-reviewed-draft-integrity.mjs \
 && node --test christian-visual-editorial-gate.test.mjs visual-storyboard.test.mjs pexels-source-import.test.mjs pexels-review-scenes.test.mjs christian-music-video.test.mjs christian-narrative-story.test.mjs christian-video-formats.test.mjs christian-video-timeline.test.mjs pexels-format-library.test.mjs christian-source-review-workflow.test.mjs master-archive-search.test.mjs christian-narrated-short.test.mjs christian-reviewed-draft-integrity.test.mjs
COPY google-veo-provider.mjs ./
COPY bootstrap.mjs ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
