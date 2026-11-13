FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY . .
RUN npm run db:generate --workspace apps/api \
  && npm run build --workspace apps/api \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV NPM_CONFIG_CACHE=/home/node/.npm
USER node
EXPOSE 4000
CMD ["npm", "--workspace", "apps/api", "run", "start:prod"]
