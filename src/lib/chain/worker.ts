import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';
import { Prisma, PrismaClient, type ChainOperation } from '@prisma/client';
import { prisma } from '../db';
import { contextOf } from './operations';
import { ChainTransport } from './transport';
import { OperationPayloadSchema, operationCalldata, requireBoundAuthorization, forwarderInterface, forwardRequest,
  OperationError, type ForwardAuthorization, type OperationPayload } from './protocol';

export class ChainWorker {
  constructor(readonly db: PrismaClient = prisma, readonly chain = new ChainTransport()) {}
  private async acquire(id: string, token: string) {
    const expiresAt = new Date(Date.now() + 120_000);
    await this.db.chainWorkerLease.createMany({ data: [{ id, token: '', expiresAt: new Date(0) }], skipDuplicates: true });
    return (await this.db.chainWorkerLease.updateMany({ where: { id, expiresAt: { lt: new Date() } }, data: { token, expiresAt } })).count === 1;
  }
  private async defer(op: ChainOperation, message: string) {
    const attempts = op.attempts + 1;
    if (attempts >= 8 && op.state !== 'SUBMITTED') {
      await this.fail(op, 'Automatic retries reached their limit. Reconcile the stored transaction before taking further action.', true);
      return;
    }
    await this.db.chainOperation.updateMany({ where: { id: op.id, state: op.state, txHash: op.txHash }, data: {
      attempts, lastError: message, nextAttemptAt: new Date(Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(attempts, 5))),
    } });
  }
  private async fail(op: ChainOperation, message: string, review = false) {
    return this.db.$transaction(async tx => {
      const changed = await tx.chainOperation.updateMany({ where: { id: op.id, state: op.state, txHash: op.txHash }, data: {
        state: review ? 'NEEDS_REVIEW' : 'FAILED', lastError: message, ...(review ? {} : { actorLock: null }),
      } });
      if (changed.count && !review) await tx.honeyBatch.updateMany({ where: { id: op.batchId, pendingOperationId: op.id }, data: { pendingOperationId: null } });
    });
  }
  private async sign(op: ChainOperation, leaseId: string, token: string) {
    if (!op.authorization || !op.signature) throw new OperationError('The operation has no stored actor approval');
    const auth = op.authorization as unknown as ForwardAuthorization;
    const context = contextOf(op);
    if (operationCalldata(op.payload) !== op.calldata) { await this.fail(op, 'Operation payload differs from the approved calldata', true); return; }
    const batch = await this.db.honeyBatch.findUnique({ where: { id: op.batchId } });
    if (!batch || batch.pendingOperationId !== op.id || batch.version !== op.expectedVersion || (batch.recalled && op.kind !== 'RECALL_BATCH')) {
      await this.fail(op, 'The batch changed before submission. No transaction was broadcast.'); return;
    }
    requireBoundAuthorization(context, op.actorAddress, op.calldata, auth, op.signature);
    const actor = await this.db.dashboardAccount.findFirst({ where: { walletAddress: { equals: op.actorAddress, mode: 'insensitive' }, active: true } });
    if (!actor) { await this.fail(op, 'The actor account is inactive. A new approval is required.'); return; }
    if (!await this.chain.verify(context, auth, op.signature)) { await this.fail(op, 'The actor nonce or signature is no longer valid. Reconcile any external transaction.', true); return; }
    const signer = this.chain.relayer();
    const [pendingNonce, lease] = await Promise.all([
      this.chain.provider.getTransactionCount(signer.address, 'pending'), this.db.chainWorkerLease.findUnique({ where: { id: leaseId } }),
    ]);
    if (!lease || lease.token !== token || lease.expiresAt.getTime() <= Date.now()) return;
    const nonce = Math.max(pendingNonce, lease.nextNonce ?? 0);
    const signed = await this.chain.prepareOuterTransaction(context, auth, op.signature, nonce);
    // The exact signed bytes and hash MUST commit before any broadcast RPC.
    await this.db.$transaction(async tx => {
      const held = await tx.chainWorkerLease.updateMany({ where: { id: leaseId, token, expiresAt: { gt: new Date() }, nextNonce: lease.nextNonce }, data: { nextNonce: nonce + 1, expiresAt: new Date(Date.now() + 120_000) } });
      if (held.count !== 1) throw new OperationError('Worker lease changed before signing was persisted');
      const changed = await tx.chainOperation.updateMany({ where: { id: op.id, state: 'READY', updatedAt: op.updatedAt }, data: {
        signedTransaction: signed.raw, txHash: signed.hash, signerAddress: signed.signerAddress, signerNonce: nonce, state: 'SIGNED', lastError: null, nextAttemptAt: new Date(),
      } });
      if (changed.count !== 1) throw new OperationError('The operation changed before signing was persisted');
    }, { isolationLevel: 'Serializable' });
  }
  private async broadcast(op: ChainOperation) {
    if (!op.signedTransaction || !op.txHash || !op.authorization || !op.signature) throw new OperationError('Signed transaction is missing; manual reconciliation is required');
    const raw = ethers.Transaction.from(op.signedTransaction);
    const auth = op.authorization as unknown as ForwardAuthorization;
    const expected = forwarderInterface.encodeFunctionData('execute', [forwardRequest(auth, op.signature)]);
    if (raw.hash !== op.txHash || raw.chainId !== BigInt(op.chainId) || raw.value !== BigInt(0) || raw.to?.toLowerCase() !== op.forwarderAddress.toLowerCase() || raw.data !== expected || raw.from?.toLowerCase() !== op.signerAddress?.toLowerCase()) {
      await this.fail(op, 'Stored transaction bytes do not match the approved operation', true); return;
    }
    // Lookup first: a process may have crashed after RPC acceptance and before its DB acknowledgement.
    const known = await this.chain.provider.getTransaction(op.txHash);
    if (!known) {
      try { await this.chain.broadcast(op.signedTransaction); }
      catch {
        if (!await this.chain.provider.getTransaction(op.txHash)) { await this.defer(op, 'Broadcast acknowledgement is unavailable. The same signed transaction will be retried.'); return; }
      }
    }
    await this.db.chainOperation.updateMany({ where: { id: op.id, state: 'SIGNED', txHash: op.txHash }, data: { state: 'SUBMITTED', lastError: null, nextAttemptAt: new Date() } });
  }
  private async project(op: ChainOperation, payload: OperationPayload, receipt: ethers.TransactionReceipt) {
    await this.db.$transaction(async tx => {
      const current = await tx.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
      if (current.state === 'CONFIRMED') return;
      if (current.txHash !== op.txHash || current.state !== 'SUBMITTED') throw new OperationError('Receipt operation changed');
      const batch = await tx.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } });
      if (batch.pendingOperationId !== op.id || batch.version !== op.expectedVersion || (batch.recalled && payload.kind !== 'RECALL_BATCH')) {
        await tx.chainOperation.update({ where: { id: op.id }, data: { state: 'NEEDS_REVIEW', actorLock: null, receiptBlock: receipt.blockNumber, receiptBlockHash: receipt.blockHash, lastError: 'Chain confirmed, but the database changed. Review the batch before applying this receipt.' } });
        return;
      }
      const data: Prisma.HoneyBatchUncheckedUpdateManyInput = { pendingOperationId: null, version: { increment: 1 } };
      if (payload.kind === 'CREATE_BATCH') Object.assign(data, { status: 'HARVESTED', txHash: op.txHash, current_custodian: op.actorAddress });
      if (payload.kind === 'TRANSFER_CUSTODY') {
        Object.assign(data, { status: payload.newStatus, current_custodian: payload.toAddress });
        await tx.custodyEvent.upsert({ where: { chainOperationId: op.id }, create: { chainOperationId: op.id, batchId: op.batchId, from: payload.fromAddress, to: payload.toAddress, stage: payload.newStatus, txHash: op.txHash }, update: {} });
      }
      if (payload.kind === 'VERIFY_LAB') {
        Object.assign(data, { status: 'LAB_VERIFIED', lab_verified: true });
        await tx.certificate.upsert({ where: { chainOperationId: op.id }, create: { chainOperationId: op.id, batchId: op.batchId, labActorId: op.actorAddress, certificateHash: payload.certificateHash, ipfsCID: payload.ipfsCID, txHash: op.txHash }, update: {} });
      }
      if (payload.kind === 'PACKAGE_BATCH') Object.assign(data, { status: 'PACKAGED', jarCount: payload.jarCount, jarSizeGrams: payload.jarSizeGrams, packagingTxHash: op.txHash, metadataCID: payload.metadataCID, metadataHash: payload.metadataHash });
      if (payload.kind === 'RECALL_BATCH') Object.assign(data, { recalled: true, status: 'RECALLED', recallReason: payload.reason, recallTxHash: op.txHash });
      const changed = await tx.honeyBatch.updateMany({ where: { id: op.batchId, pendingOperationId: op.id, version: op.expectedVersion }, data });
      if (changed.count !== 1) throw new OperationError('Projection version conflict');
      await tx.chainOperation.update({ where: { id: op.id }, data: { state: 'CONFIRMED', actorLock: null, receiptBlock: receipt.blockNumber, receiptBlockHash: receipt.blockHash, lastError: null } });
    }, { isolationLevel: 'Serializable' });
  }
  private async confirm(op: ChainOperation) {
    if (!op.txHash || !op.authorization) throw new OperationError('Transaction identity is missing');
    const context = contextOf(op);
    const receipt = await this.chain.provider.getTransactionReceipt(op.txHash);
    if (!receipt) { await this.defer(op, 'Awaiting a transaction receipt.'); return; }
    const block = await this.chain.provider.getBlock(receipt.blockNumber);
    if (!block || block.hash !== receipt.blockHash) { await this.defer(op, 'Receipt block is not canonical. Waiting for chain reconciliation.'); return; }
    const head = await this.chain.provider.getBlockNumber();
    const confirmations = head - receipt.blockNumber + 1;
    if (confirmations < (op.chainId === 31337 ? 1 : 2)) { await this.defer(op, 'Waiting for required block confirmations.'); return; }
    if (receipt.status !== 1) { await this.fail(op, 'The chain transaction reverted. No successful batch state was applied.'); return; }
    const auth = op.authorization as unknown as ForwardAuthorization;
    const payload = OperationPayloadSchema.parse(op.payload);
    if (operationCalldata(payload) !== op.calldata || !this.chain.receiptHasApproval(receipt, context, auth) || !this.chain.receiptHasAction(receipt, context, payload, op.actorAddress)) {
      await this.fail(op, 'Receipt does not prove the stored actor-approved operation', true); return;
    }
    if (!await this.chain.matchingHead(context, payload, op.actorAddress)) { await this.fail(op, 'A later chain state differs from this operation. Reconciliation is required.', true); return; }
    await this.project(op, payload, receipt);
  }
  async runOnce(): Promise<{ processed: number; busy?: boolean }> {
    const context = await this.chain.context();
    const signer = this.chain.relayer();
    const leaseId = `${context.chainId}:${context.genesisHash}:${signer.address.toLowerCase()}`;
    const token = randomUUID();
    if (!await this.acquire(leaseId, token)) return { processed: 0, busy: true };
    try {
      // Resume durable signed bytes before allocating another relayer nonce.
      const op = await this.db.chainOperation.findFirst({ where: { chainId: context.chainId, registryAddress: context.registryAddress, nextAttemptAt: { lte: new Date() }, state: { in: ['SIGNED','SUBMITTED'] } }, orderBy: { createdAt: 'asc' } })
        ?? await this.db.chainOperation.findFirst({ where: { chainId: context.chainId, registryAddress: context.registryAddress, nextAttemptAt: { lte: new Date() }, state: 'READY' }, orderBy: { createdAt: 'asc' } });
      if (!op) return { processed: 0 };
      try {
        await this.chain.assertContext(contextOf(op));
        if (op.state === 'READY') await this.sign(op, leaseId, token);
        if (op.state === 'SIGNED') await this.broadcast(op);
        if (op.state === 'SUBMITTED') await this.confirm(op);
      } catch (error) {
        if (error instanceof OperationError && error.status === 409) await this.fail(op, error.message, true);
        else if (error instanceof OperationError && error.status === 422 && op.state === 'READY') await this.fail(op, error.message);
        else await this.defer(op, 'A dependency or database write failed. The stored transaction will be reconciled before retrying.');
      }
      return { processed: 1 };
    } finally {
      await this.db.chainWorkerLease.updateMany({ where: { id: leaseId, token }, data: { expiresAt: new Date(0) } });
    }
  }
}
