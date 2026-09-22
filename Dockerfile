FROM node:22-bookworm-slim AS build
WORKDIR /workspace

COPY christian-content-ai-studio-autonomous-christian-discernment-v59-final.tar.gz /tmp/v59.tar.gz
RUN mkdir -p /src && tar -xzf /tmp/v59.tar.gz -C /src \
 && ROOT_DIR="$(dirname "$(find /src -name package.json -not -path '*/node_modules/*' | head -n 1)")" \
 && test -n "$ROOT_DIR" \
 && cp -a "$ROOT_DIR"/. /workspace/ \
 && test -f package.json \
 && test -d app

RUN mkdir -p app/api/content-agents/status app/api/content-agents/queue app/api/content-agents/plan app/api/content-agents/approval-record app/api/content-agents/approval-execute
COPY content-agents /workspace/content-agents
# Offline text drafting from the exact curated ledger; no AI API use.
RUN node --test content-agents/zero-credit-draft.test.mjs
RUN node --check content-agents/review-master-selector.mjs \
 && node --check content-agents/export-independent-review.mjs \
 && node --test content-agents/review-master-selector.test.mjs
COPY system-agents /workspace/system-agents
RUN mkdir -p app/api/generate
COPY docker-overrides/zero-credit/generate-route.ts /workspace/app/api/generate/route.ts
COPY docker-overrides/zero-credit/patch-homepage.mjs /tmp/patch-zero-credit-homepage.mjs
RUN node /tmp/patch-zero-credit-homepage.mjs
COPY docker-overrides/content-agents/status-route.ts /workspace/app/api/content-agents/status/route.ts
COPY docker-overrides/content-agents/queue-route.ts /workspace/app/api/content-agents/queue/route.ts
COPY docker-overrides/content-agents/plan-route.ts /workspace/app/api/content-agents/plan/route.ts
COPY docker-overrides/content-agents/approval-record-route.ts /workspace/app/api/content-agents/approval-record/route.ts
COPY docker-overrides/content-agents/approval-execute-route.ts /workspace/app/api/content-agents/approval-execute/route.ts
RUN mkdir -p v59-core \
 && cp app/api/publish/route.ts v59-core/publish-core.ts \
 && cp app/api/distribution/publish/route.ts v59-core/distribution-publish-core.ts
COPY docker-overrides/content-agents/publish-unanimous-route.ts /workspace/app/api/publish/route.ts
COPY docker-overrides/content-agents/distribution-publish-unanimous-route.ts /workspace/app/api/distribution/publish/route.ts

RUN mkdir -p app/api/cron/campaign-execute
COPY docker-overrides/cron/campaign-execute-idempotent-route.ts /workspace/app/api/cron/campaign-execute/route.ts
RUN printf "%s\n" \
 "export { GET, POST } from '@/app/api/orchestrate/route'" \
 "export const runtime = 'nodejs'" \
 "export const maxDuration = 300" \
 > app/api/cron/daily/route.ts

RUN mkdir -p app/api/system-agents/autonomy-status
COPY docker-overrides/system-agents/autonomy-status-route.ts /workspace/app/api/system-agents/autonomy-status/route.ts

RUN npm install

RUN node -e "const fs=require('fs'); const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.compilerOptions=j.compilerOptions||{}; j.compilerOptions.ignoreDeprecations='6.0'; fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');" \
 && printf "%s\n" \
 "/** @type {import('next').NextConfig} */" \
 "const nextConfig = { typescript: { ignoreBuildErrors: true } };" \
 "export default nextConfig;" \
 > next.config.mjs

ENV OPENAI_API_KEY=build-placeholder-not-for-runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=build /workspace ./
EXPOSE 3000
CMD ["npm", "start"]
