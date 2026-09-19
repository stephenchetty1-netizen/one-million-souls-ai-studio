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
RUN node --check free-ai-render-v2.mjs && node --check daily-factory.mjs && node --check stock-music-library.mjs \
 && node --check server.mjs && node --check pexels-source-import.mjs && node --check pexels-review-scenes.mjs && node --check christian-music-video.mjs \
 && node --test visual-storyboard.test.mjs pexels-source-import.test.mjs pexels-review-scenes.test.mjs christian-music-video.test.mjs
COPY google-veo-provider.mjs ./
COPY bootstrap.mjs ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
