CREATE TABLE "RegistryDeployment" (
 "id" TEXT NOT NULL PRIMARY KEY,"initiatedBy" TEXT NOT NULL,"administrator" TEXT NOT NULL,"relayer" TEXT NOT NULL,"actors" JSONB NOT NULL,
 "chainId" INTEGER NOT NULL,"genesisHash" TEXT NOT NULL,"templateHash" TEXT NOT NULL,"state" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RegistryDeployment_administrator_createdAt_idx" ON "RegistryDeployment"("administrator","createdAt");
CREATE UNIQUE INDEX "RegistryDeployment_one_active_admin" ON "RegistryDeployment"("chainId","genesisHash","administrator") WHERE "state" IN ('IN_PROGRESS','REVIEW');
CREATE TABLE "RegistryDeploymentStep" (
 "id" TEXT NOT NULL PRIMARY KEY,"deploymentId" TEXT NOT NULL,"ordinal" INTEGER NOT NULL,"kind" TEXT NOT NULL,"state" TEXT NOT NULL DEFAULT 'PENDING',
 "nonce" INTEGER,"target" TEXT,"predictedAddress" TEXT,"data" TEXT,"gasLimit" TEXT,"maxFeePerGas" TEXT,"priorityFee" TEXT,"txHash" TEXT,
 "receiptBlock" INTEGER,"receiptBlockHash" TEXT,"lastError" TEXT,"failedAttempts" JSONB NOT NULL DEFAULT '[]',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RegistryDeploymentStep_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "RegistryDeployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegistryDeploymentStep_deploymentId_ordinal_key" ON "RegistryDeploymentStep"("deploymentId","ordinal");
CREATE UNIQUE INDEX "RegistryDeploymentStep_txHash_key" ON "RegistryDeploymentStep"("txHash");
