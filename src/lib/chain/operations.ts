import { Prisma, PrismaClient, type ChainOperation } from '@prisma/client';
import { prisma } from '../db';
import { ChainTransport } from './transport';
import { OperationError, OperationPayloadSchema, operationCalldata, forwardAuthorization, requireBoundAuthorization,
  type ChainContext, type ForwardAuthorization, type OperationPayload } from './protocol';
import type { SessionPayload } from '../access-policy';

export function canReadOperation(session: SessionPayload, op: Pick<ChainOperation, 'actorAddress' | 'initiatedBy'>) {
  return session.role === 'admin' || session.accountId === op.initiatedBy || session.walletAddress.toLowerCase() === op.actorAddress.toLowerCase();
}
export { publicOperation, operationRequestKey, operationResponse, operationFailure, sameOrigin } from './http';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const contextOf = (op: ChainOperation): ChainContext => ({ chainId: op.chainId, registryAddress: op.registryAddress, forwarderAddress: op.forwarderAddress, genesisHash: op.genesisHash });
export class OperationService {
  constructor(readonly db: PrismaClient = prisma, readonly chain = new ChainTransport()) {}
  async existing(initiatedBy: string, key: string, requestHash: string) {
    const op = await this.db.chainOperation.findUnique({ where: { requestKey: initiatedBy + ':' + key } });
    if (op && op.requestHash !== requestHash) throw new OperationError('This idempotency key was already used for a different request');
    return op;
  }
  async enqueue(input: { initiatedBy: string; key: string; requestHash: string; actorAddress: string; payload: OperationPayload; batchId?: string; expectedVersion?: number; context?: ChainContext }) {
    const existing = await this.existing(input.initiatedBy, input.key, input.requestHash);
    if (existing) return existing;
    const payload = OperationPayloadSchema.parse(input.payload);
    const context = input.context ?? await this.chain.context();
    const calldata = operationCalldata(payload);
    try {
      return await this.db.$transaction(async tx => {
        const again = await tx.chainOperation.findUnique({ where: { requestKey: input.initiatedBy + ':' + input.key } });
        if (again) { if (again.requestHash !== input.requestHash) throw new OperationError('Idempotency conflict'); return again; }
        let batch;
        if (payload.kind === 'CREATE_BATCH' && !input.batchId) {
          batch = await tx.honeyBatch.create({ data: {
            batchCode: payload.batchCode, batch_id_hash: (await import('ethers')).ethers.id(payload.batchCode), beekeeperId: payload.beekeeperId,
            honey_type: payload.honeyType, quantity_grams: payload.quantityGrams, hives_harvested: payload.hivesHarvested,
            harvest_timestamp: new Date(payload.harvestTimestamp * 1000), region: payload.region, metadataCID: payload.metadataCID,
            metadataHash: payload.metadataHash, current_custodian: input.actorAddress, status: 'PENDING_CHAIN',
          } });
        } else {
          batch = await tx.honeyBatch.findUnique({ where: { id: input.batchId } });
          if (!batch || batch.batchCode !== payload.batchCode) throw new OperationError('Batch not found', 404);
          if (input.expectedVersion !== undefined && batch.version !== input.expectedVersion) throw new OperationError('The batch changed while this request was prepared. Refresh and retry.');
          if (batch.pendingOperationId && payload.kind !== 'RECALL_BATCH') throw new OperationError('Finish the existing batch operation before starting another');
          if (batch.recalled && payload.kind !== 'RECALL_BATCH') throw new OperationError('This batch is recalled');
          if (payload.kind === 'RECALL_BATCH') {
            batch = await tx.honeyBatch.update({ where: { id: batch.id }, data: { recalled: true, status: 'RECALLED', recallReason: payload.reason, ...(!batch.recalled ? { version: { increment: 1 } } : {}) } });
            await tx.qRToken.updateMany({ where: { batchId: batch.id }, data: { active: false } });
          } else if (batch.current_custodian?.toLowerCase() !== input.actorAddress.toLowerCase()) throw new OperationError('The actor does not hold this batch', 403);
        }
        const op = await tx.chainOperation.create({ data: {
          batchId: batch.id, kind: payload.kind, initiatedBy: input.initiatedBy, actorAddress: input.actorAddress.toLowerCase(),
          requestKey: input.initiatedBy + ':' + input.key, requestHash: input.requestHash, payload: json(payload), expectedVersion: batch.version,
          ...context, calldata,
        } });
        const lock = await tx.honeyBatch.updateMany({ where: { id: batch.id, version: batch.version,
          ...(payload.kind === 'RECALL_BATCH' ? {} : { pendingOperationId: null }) }, data: { pendingOperationId: op.id } });
        if (lock.count !== 1) throw new OperationError('Another request changed this batch. Refresh and retry.');
        return op;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      // A concurrent identical request may have won the unique index/serializable transaction.
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) {
        const winner = await this.existing(input.initiatedBy, input.key, input.requestHash);
        if (winner) return winner;
        throw new OperationError('Concurrent batch request; retry with the same idempotency key');
      }
      throw error;
    }
  }
  async load(id: string, session: SessionPayload, signing = false) {
    const op = await this.db.chainOperation.findUnique({ where: { id } });
    if (!op || !canReadOperation(session, op)) throw new OperationError('Operation not found', 404);
    if (signing && session.walletAddress.toLowerCase() !== op.actorAddress.toLowerCase()) throw new OperationError('The enrolled actor must approve this operation with their wallet', 403);
    return op;
  }
  async authorization(id: string, session: SessionPayload) {
    const op = await this.load(id, session, true);
    if (op.state !== 'AWAITING_SIGNATURE') throw new OperationError('This operation no longer needs a signature');
    const context = await this.chain.assertContext(contextOf(op));
    const payload = OperationPayloadSchema.parse(op.payload);
    if (operationCalldata(payload) !== op.calldata) throw new OperationError('Operation calldata is inconsistent');
    const batch = await this.db.honeyBatch.findUnique({ where: { id: op.batchId } });
    if (!batch || batch.pendingOperationId !== id || batch.version !== op.expectedVersion) throw new OperationError('The batch changed. Reconciliation is required.');
    if (batch.recalled && payload.kind !== 'RECALL_BATCH') throw new OperationError('This batch is recalled');
    const nonce = await this.chain.nonce(context, op.actorAddress);
    if (op.actorNonce !== null && op.actorNonce !== nonce) throw new OperationError('The actor nonce changed outside this operation. Reconcile its transaction before preparing another approval.');
    if (op.authorizationDeadline && op.authorizationDeadline.getTime() <= Date.now() + 30_000) {
      const head = await this.chain.provider.getBlock('latest');
      if (!head || head.timestamp < op.authorizationDeadline.getTime() / 1000) throw new OperationError('Wait until the chain passes the previous approval deadline before refreshing it.', 503);
    }
    // Check the actor's actual on-chain permissions and lifecycle before opening the wallet.
    try { await this.chain.provider.call({ from: op.actorAddress, to: context.registryAddress, data: op.calldata, blockTag: 'pending' }); }
    catch { throw new OperationError('The registry rejected this actor or stage. Check enrollment and custody before signing.'); }
    if (op.authorization && op.authorizationDeadline && op.authorizationDeadline.getTime() > Date.now() + 30_000) {
      if (op.actorNonce !== nonce) throw new OperationError('The actor nonce changed outside this operation. Reconciliation is required.');
      return op.authorization as unknown as ForwardAuthorization;
    }
    const deadline = Math.floor(Date.now() / 1000) + 15 * 60;
    const auth = forwardAuthorization(context, op.actorAddress, op.calldata, nonce, deadline);
    const actorLock = `${context.chainId}:${context.forwarderAddress.toLowerCase()}:${op.actorAddress}`;
    try {
      const saved = await this.db.chainOperation.updateMany({ where: { id, state: 'AWAITING_SIGNATURE', updatedAt: op.updatedAt }, data: {
        actorLock, authorization: json(auth), actorNonce: nonce, authorizationDeadline: new Date(deadline * 1000),
      } });
      if (saved.count !== 1) throw new OperationError('Approval changed. Refresh the operation before signing.');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new OperationError('Finish the previous approval for this actor before signing another operation');
      throw error;
    }
    return auth;
  }
  async approve(id: string, session: SessionPayload, signature: string) {
    const op = await this.load(id, session, true);
    if (op.signature === signature && ['READY','SIGNED','SUBMITTED','CONFIRMED'].includes(op.state)) return op;
    if (op.state !== 'AWAITING_SIGNATURE' || !op.authorization) throw new OperationError('Prepare this operation before approving it');
    const auth = op.authorization as unknown as ForwardAuthorization;
    requireBoundAuthorization(contextOf(op), op.actorAddress, op.calldata, auth, signature);
    await this.chain.assertContext(contextOf(op));
    if (!await this.chain.verify(contextOf(op), auth, signature)) throw new OperationError('The forwarder rejected this signature or nonce', 422);
    const changed = await this.db.chainOperation.updateMany({ where: { id, state: 'AWAITING_SIGNATURE', updatedAt: op.updatedAt }, data: { signature, state: 'READY', nextAttemptAt: new Date(), lastError: null } });
    if (changed.count !== 1) throw new OperationError('Approval changed. Refresh this operation.');
    return this.db.chainOperation.findUniqueOrThrow({ where: { id } });
  }
  async retry(id: string, session: SessionPayload, key: string) {
    const op = await this.load(id, session, true);
    if (op.state !== 'FAILED') throw new OperationError('Only a definitively failed operation can be retried. Reconcile uncertain transactions first.');
    const batch = await this.db.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } });
    const payload = OperationPayloadSchema.parse(op.payload);
    return this.enqueue({ initiatedBy: session.accountId, key, requestHash: 'retry:' + op.id, actorAddress: op.actorAddress, payload,
      batchId: op.batchId, expectedVersion: batch.version });
  }
  async reconcile(id: string, session: SessionPayload, txHash: string) {
    const op = await this.load(id, session);
    if (op.state === 'CONFIRMED') return op;
    if (!op.authorization) throw new OperationError('No actor approval was prepared for this operation');
    await this.chain.assertContext(contextOf(op));
    const tx = await this.chain.provider.getTransaction(txHash);
    if (!tx || tx.to?.toLowerCase() !== op.forwarderAddress.toLowerCase()) throw new OperationError('No matching forwarder transaction was found');
    const decoded = (await import('./protocol')).forwarderInterface.parseTransaction({ data: tx.data });
    const request = decoded?.name === 'execute' ? decoded.args[0] : null;
    if (!request || request.from.toLowerCase() !== op.actorAddress || request.to.toLowerCase() !== op.registryAddress.toLowerCase() || request.data.toLowerCase() !== op.calldata.toLowerCase()) throw new OperationError('Transaction does not execute this operation');
    const auth = op.authorization as unknown as ForwardAuthorization;
    if (request.deadline !== BigInt(auth.message.deadline) || request.gas.toString() !== auth.message.gas || request.value.toString() !== auth.message.value) throw new OperationError('Transaction differs from the prepared approval');
    // Signature expiry does not invalidate an already mined historical receipt.
    if ((await import('./protocol')).recoverApproval(auth, request.signature).toLowerCase() !== op.actorAddress) throw new OperationError('Transaction actor approval does not match');
    if (op.txHash && op.txHash.toLowerCase() !== txHash.toLowerCase()) throw new OperationError('This operation already has a different submitted transaction');
    return this.db.chainOperation.update({ where: { id }, data: { txHash, signerAddress: tx.from, signerNonce: tx.nonce, signature: request.signature, state: 'SUBMITTED', lastError: null, nextAttemptAt: new Date() } });
  }
}
export const operationService = new OperationService();
