FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api-node/package.json apps/api-node/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api-node apps/api-node
RUN npm run build -w apps/api-node

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /repo/apps/api-node/.next/standalone ./
COPY --from=builder /repo/apps/api-node/.next/static ./apps/api-node/.next/static

EXPOSE 3001
CMD ["node", "apps/api-node/server.js"]
