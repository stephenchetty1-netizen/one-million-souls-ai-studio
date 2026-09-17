FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY scheduler.mjs ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
