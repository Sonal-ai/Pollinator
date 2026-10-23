import { ethers } from 'ethers';
import { z } from 'zod';
import { canonicalJSON, hashEvidence } from '../evidence';

const code = z.string().regex(/^[A-Za-z0-9-]{1,100}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).refine(value => value !== ethers.ZeroAddress);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const cid = z.string().min(1).max(128);
const grams = z.number().int().positive().max(10_000_000);
export const STAGE_INDEX = { CREATED: 0, HARVESTED: 1, PROCESSED: 2, LAB_VERIFIED: 3, PACKAGED: 4, IN_DISTRIBUTION: 5, AT_RETAIL: 6, SOLD: 7, RECALLED: 8 } as const;
export const OperationPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CREATE_BATCH'), batchCode: code, beekeeperId: z.string().min(1), honeyType: z.string().min(1).max(100), quantityGrams: grams,
    hivesHarvested: z.number().int().positive().max(100000), harvestTimestamp: z.number().int().positive(), region: z.string().min(1).max(150), metadataCID: cid, metadataHash: hash }),
  z.object({ kind: z.literal('TRANSFER_CUSTODY'), batchCode: code, fromAddress: address, toAddress: address,
    newStatus: z.enum(['HARVESTED','PROCESSED','LAB_VERIFIED','PACKAGED','IN_DISTRIBUTION','AT_RETAIL','SOLD']), note: z.string().max(500).optional() }),
  z.object({ kind: z.literal('VERIFY_LAB'), batchCode: code, labActorId: address, certificateHash: hash, ipfsCID: cid }),
  z.object({ kind: z.literal('PACKAGE_BATCH'), batchCode: code, jarCount: z.number().int().positive().max(10000), jarSizeGrams: grams, metadataCID: cid, metadataHash: hash }),
  z.object({ kind: z.literal('RECALL_BATCH'), batchCode: code, reasonCID: cid, reason: z.string().min(1).max(2000) }),
]);
export type OperationPayload = z.infer<typeof OperationPayloadSchema>;
export const REGISTRY_ABI = [
  'function registryVersion() view returns (uint256)', 'function trustedForwarder() view returns (address)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function createBatch(bytes32,uint64,uint32,string,bytes32)', 'function transferCustody(bytes32,address,uint8)',
  'function verifyLab(bytes32,bytes32)', 'function packageBatch(bytes32,uint32,uint32,string,bytes32)', 'function recallBatch(bytes32,string)',
  'function getBatch(bytes32) view returns (tuple(bytes32 batchIdHash,address beekeeper,address currentCustodian,uint64 harvestTimestamp,uint64 createdAt,uint32 quantityGrams,uint8 status,string metadataCID,bytes32 metadataHash,bytes32 labReportHash,bool labVerified,bool recalled,uint32 jarCount,uint32 jarSizeGrams,uint64 packagedGrams,address labVerifier,string harvestMetadataCID,bytes32 harvestMetadataHash))',
  'event BatchCreated(bytes32 indexed batchIdHash,address indexed beekeeper,string metadataCID,bytes32 metadataHash,uint32 quantityGrams)',
  'event LabVerified(bytes32 indexed batchIdHash,address indexed lab,bytes32 labReportHash)',
  'event CustodyTransferred(bytes32 indexed batchIdHash,address indexed from,address indexed to,uint8 status)',
  'event BatchPackaged(bytes32 indexed batchIdHash,string newMetadataCID,bytes32 newMetadataHash,uint32 jarCount,uint32 jarSizeGrams)',
  'event BatchRecalled(bytes32 indexed batchIdHash,address indexed by,string reasonCID)',
] as const;
export const FORWARDER_ABI = [
  'function nonces(address) view returns (uint256)',
  'function verify((address from,address to,uint256 value,uint256 gas,uint48 deadline,bytes data,bytes signature)) view returns (bool)',
  'function execute((address from,address to,uint256 value,uint256 gas,uint48 deadline,bytes data,bytes signature)) payable',
  'event ExecutedForwardRequest(address indexed signer,uint256 nonce,bool success)',
] as const;
export const registryInterface = new ethers.Interface(REGISTRY_ABI);
export const forwarderInterface = new ethers.Interface(FORWARDER_ABI);
export const FORWARD_TYPES = { ForwardRequest: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint48' }, { name: 'data', type: 'bytes' },
] };
export interface ForwardMessage { from: string; to: string; value: string; gas: string; nonce: string; deadline: number; data: string; }
export interface ForwardAuthorization {
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  message: ForwardMessage;
}
export interface ChainContext { chainId: number; registryAddress: string; forwarderAddress: string; genesisHash: string; }
export class OperationError extends Error {
  constructor(message: string, public status = 409) { super(message); this.name = 'OperationError'; }
}
export function operationCalldata(value: unknown): string {
  const p = OperationPayloadSchema.parse(value);
  const id = ethers.id(p.batchCode);
  switch (p.kind) {
    case 'CREATE_BATCH': return registryInterface.encodeFunctionData('createBatch', [id, p.harvestTimestamp, p.quantityGrams, p.metadataCID, p.metadataHash]);
    case 'TRANSFER_CUSTODY': return registryInterface.encodeFunctionData('transferCustody', [id, p.toAddress, STAGE_INDEX[p.newStatus]]);
    case 'VERIFY_LAB': return registryInterface.encodeFunctionData('verifyLab', [id, p.certificateHash]);
    case 'PACKAGE_BATCH': return registryInterface.encodeFunctionData('packageBatch', [id, p.jarCount, p.jarSizeGrams, p.metadataCID, p.metadataHash]);
    case 'RECALL_BATCH': return registryInterface.encodeFunctionData('recallBatch', [id, p.reasonCID]);
  }
}
export function requestFingerprint(kind: string, input: unknown): string { return hashEvidence(canonicalJSON({ kind, input })); }
export function forwardAuthorization(context: ChainContext, actor: string, data: string, nonce: string, deadline: number): ForwardAuthorization {
  return { domain: { name: 'HoneyChainForwarder', version: '1', chainId: context.chainId, verifyingContract: context.forwarderAddress },
    message: { from: actor, to: context.registryAddress, value: '0', gas: '900000', nonce, deadline, data } };
}
export function recoverApproval(auth: ForwardAuthorization, signature: string): string {
  if (!/^0x[0-9a-f]{130}$/i.test(signature)) throw new OperationError('A valid wallet signature is required', 422);
  try { return ethers.verifyTypedData(auth.domain, FORWARD_TYPES, auth.message, signature); }
  catch { throw new OperationError('The wallet signature could not be verified', 422); }
}
export function requireBoundAuthorization(context: ChainContext, actor: string, calldata: string, auth: ForwardAuthorization, signature: string, now = Math.floor(Date.now() / 1000)) {
  if (auth.domain.name !== 'HoneyChainForwarder' || auth.domain.version !== '1' || auth.domain.chainId !== context.chainId ||
      auth.domain.verifyingContract.toLowerCase() !== context.forwarderAddress.toLowerCase() || auth.message.to.toLowerCase() !== context.registryAddress.toLowerCase() ||
      auth.message.from.toLowerCase() !== actor.toLowerCase() || auth.message.data.toLowerCase() !== calldata.toLowerCase() ||
      auth.message.value !== '0' || auth.message.gas !== '900000' || !/^\d+$/.test(auth.message.nonce) ||
      auth.message.deadline < now || auth.message.deadline > now + 15 * 60 + 30 || recoverApproval(auth, signature).toLowerCase() !== actor.toLowerCase()) {
    throw new OperationError('Wallet approval does not match this operation or has expired', 422);
  }
}
export function forwardRequest(auth: ForwardAuthorization, signature: string) { return { ...auth.message, signature }; }
