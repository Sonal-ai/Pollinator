-- CreateTable
CREATE TABLE "DeploymentIdentity" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "clusterId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "registryAddress" TEXT NOT NULL,
    "forwarderAddress" TEXT NOT NULL,
    "genesisHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentIdentity_clusterId_key" ON "DeploymentIdentity"("clusterId");
