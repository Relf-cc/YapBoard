# YapBoard site: Next.js standalone server + SQLite on a volume at /data.
# Build from this folder (docker compose does it for you, see ../docker-compose.yml).

FROM node:24-bookworm-slim AS base
# Prisma's engines need OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma prisma/schema.prisma
RUN npm ci

FROM base AS builder
# NEXT_PUBLIC_* are baked into the bundle, and the CSP header (next.config.ts) is worked out at build time,
# so these must be known here, not just at runtime. Changing them means rebuilding.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BOT_ID
ARG PORTAL_URL
ARG NEXT_PUBLIC_BUG_REPORT_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_BOT_ID=$NEXT_PUBLIC_BOT_ID PORTAL_URL=$PORTAL_URL   NEXT_PUBLIC_BUG_REPORT_URL=$NEXT_PUBLIC_BUG_REPORT_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=file:/data/yapboard.db
# The CLI applies the schema on start (prisma db push). Same version as package-lock.json.
RUN PRISMA_VERSION=6.19.3 && npm install -g --allow-scripts=prisma,@prisma/engines prisma@$PRISMA_VERSION \
  && npm cache clean --force
RUN groupadd --system --gid 1001 nextjs && useradd --system --uid 1001 --gid nextjs nextjs \
  && mkdir /data && chown nextjs:nextjs /data
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/prisma/schema.prisma ./prisma/schema.prisma
USER nextjs
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Without --accept-data-loss, a schema change that would drop data stops the start instead of running.
CMD ["sh", "-c", "prisma db push --skip-generate && exec node server.js"]
