-- Copyright (c) 2026 Christian Relf. All rights reserved.
-- Proprietary and confidential. No copying, modification or redistribution. See LICENSE.
-- Moves the old one-badge-per-server `Server.badge` column into the ServerBadge table.
--
-- Run this against the live database BEFORE deploying the image that has the new schema. The container
-- starts with `prisma db push --skip-generate` (no --accept-data-loss, see ../../Dockerfile), so dropping
-- those two columns has to happen here or the site won't start. Afterwards the schema is already in sync
-- and the push on start is a no-op.
--
-- From the repo root:
--
--   docker compose build site                  # build first, so the swap is quick
--   docker compose stop site                   # the old code selects Server.badge, so take it down first
--   docker compose run --rm -T site sh -c 'prisma db execute --schema ./prisma/schema.prisma --stdin' \
--     < Site/prisma/sql/0001-badges-multi.sql
--   docker compose up -d                       # new image up; db push on start is then a no-op
--
-- Keep a copy of the volume first: docker run --rm -v yapboard_site-data:/d -v "$PWD:/out" alpine \
--   tar czf /out/site-data-backup.tgz -C /d .
--
-- Safe to run twice. Locally, prisma/backfill-badges.mjs does the same job around a `db push`.

CREATE TABLE IF NOT EXISTS "ServerBadge" (
  "serverId"    TEXT     NOT NULL,
  "kind"        TEXT     NOT NULL,
  "grantedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedById" TEXT,
  PRIMARY KEY ("serverId", "kind"),
  CONSTRAINT "ServerBadge_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServerBadge_kind_idx" ON "ServerBadge"("kind");

INSERT OR IGNORE INTO "ServerBadge" ("serverId", "kind", "grantedAt")
SELECT "id", "badge", COALESCE("badgedAt", CURRENT_TIMESTAMP)
FROM "Server"
WHERE "badge" IS NOT NULL;

ALTER TABLE "Server" DROP COLUMN "badge";
ALTER TABLE "Server" DROP COLUMN "badgedAt";
