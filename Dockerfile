ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim
FROM ${NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,id=honeychain-npm,target=/root/.npm npm ci

FROM deps AS worker-builder
COPY . .
RUN npx prisma generate && npm run compile:chain && npm run build:workers

FROM worker-builder AS builder
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BLOCKCHAIN_NETWORK=amoy
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_BLOCKCHAIN_NETWORK=${NEXT_PUBLIC_BLOCKCHAIN_NETWORK}
ENV BLOCKCHAIN_NETWORK=amoy
RUN npm run build -- --webpack

FROM base AS production-deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,id=honeychain-npm,target=/root/.npm npm ci --omit=dev && npx prisma generate

FROM base AS runtime-base
ENV NODE_ENV=production
ENV HONEYCHAIN_CLUSTER_MODE=isolated
RUN groupadd --gid 1001 honeychain && useradd --uid 1001 --gid 1001 --no-create-home honeychain && mkdir -p /run/honeychain && chown 1001:1001 /run/honeychain
COPY --from=worker-builder --chown=1001:1001 /app/build/workers ./build/workers
COPY --chown=1001:1001 scripts/runtime-entry.cjs scripts/runtime-config.cjs scripts/worker-health.cjs ./scripts/
USER 1001:1001
ENTRYPOINT ["node", "scripts/runtime-entry.cjs"]

FROM runtime-base AS worker
COPY --from=production-deps --chown=1001:1001 /app/node_modules ./node_modules
CMD ["chain"]

FROM worker AS migrator
COPY --chown=1001:1001 prisma ./prisma
CMD ["migrate"]

# Isolated software QA only. Never publish or use this unlocked-key EVM as a real network.
FROM worker-builder AS qa-evm
ENV NODE_ENV=development
ENV HONEYCHAIN_QA_CHAIN_ID=80002
RUN npm run compile:chain
CMD ["node", "node_modules/hardhat/internal/cli/cli.js", "node", "--network", "hardhat", "--hostname", "0.0.0.0", "--port", "8545"]

FROM runtime-base AS web
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=production-deps --chown=1001:1001 /app/node_modules/zod ./node_modules/zod
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/public ./public
EXPOSE 3000
CMD ["web"]
