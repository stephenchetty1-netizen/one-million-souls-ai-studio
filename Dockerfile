FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN tar -xzf christian-content-ai-studio-v59-railway-ready.tar.gz && \
    if [ ! -d "./app" ]; then \
        APP_DIR=$(find . -maxdepth 3 -type d -name "app" -not -path "./app" | head -n 1); \
        if [ -n "$APP_DIR" ]; then mv "$APP_DIR" ./app; fi; \
    fi && \
    rm -f *.tar.gz *.tar-*.gz *.zip
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
