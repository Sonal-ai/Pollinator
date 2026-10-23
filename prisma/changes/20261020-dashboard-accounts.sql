-- Additive change for an existing Pollinator PostgreSQL database.
-- For a fresh development database use the full Prisma schema instead.
-- This is a standalone change script, not an incomplete Prisma migration history.
CREATE TABLE "DashboardAccount" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "beekeeperId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DashboardAccount_role_check" CHECK ("role" IN ('admin','beekeeper','processor','lab','distributor','retailer')),
  CONSTRAINT "DashboardAccount_beekeeper_check" CHECK (("role" = 'beekeeper') = ("beekeeperId" IS NOT NULL)),
  CONSTRAINT "DashboardAccount_beekeeperId_fkey" FOREIGN KEY ("beekeeperId")
    REFERENCES "Beekeeper"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DashboardAccount_identifier_key" ON "DashboardAccount"("identifier");
CREATE UNIQUE INDEX "DashboardAccount_walletAddress_key" ON "DashboardAccount"("walletAddress");
