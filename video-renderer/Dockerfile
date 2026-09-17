FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core ca-certificates \
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
COPY bootstrap.mjs ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
