import { canonicalJSON, hashEvidence, isEvidenceCID, checkEvidenceBytes, type EvidenceCheck } from './evidence';
export interface IoTSummary { period: string; avgTempC: number; avgHumidityPct: number; weightGainKg: number; }
export interface AISummary { modelVersion: string; result: string; confidence: number; }
export interface BatchMetadata {
  batchCode: string; beekeeperPublicName: string; region: string; honeyType: string;
  harvestDate: string; quantityGrams: number; labReportHash?: string;
  iotSummary?: IoTSummary; aiSummary?: AISummary;
  packagingDetails?: { jarCount: number; jarSizeGrams: number; packagedAt: string };
  version: string;
}
export interface IPFSUploadResult { cid: string; hash: string; }
export function computeMetadataHash(metadata: BatchMetadata): string { return hashEvidence(canonicalJSON(metadata)); }
export function computeFileHash(bytes: Buffer): string { return hashEvidence(bytes); }

async function uploadBytes(bytes: Uint8Array, fileName: string, contentType: string, batchCode: string): Promise<IPFSUploadResult> {
  if (!process.env.PINATA_JWT || process.env.PINATA_JWT.startsWith('your_')) throw new Error('Evidence storage is not configured');
  const data = new FormData();
  data.append('file', new Blob([new Uint8Array(bytes)], { type: contentType }), fileName);
  data.append('pinataMetadata', JSON.stringify({ name: fileName, keyvalues: { batchCode, schema: 'pollinator-json-v1' } }));
  data.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.PINATA_JWT },
    body: data, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Evidence storage rejected the upload');
  const result: unknown = await response.json();
  const cid = result && typeof result === 'object' && 'IpfsHash' in result ? result.IpfsHash : null;
  if (typeof cid !== 'string' || !isEvidenceCID(cid)) throw new Error('Storage returned an invalid CID');
  return { cid, hash: hashEvidence(bytes) };
}
/** Serialize once and upload those exact UTF-8 bytes, including every nested field. */
export async function uploadBatchMetadata(metadata: BatchMetadata): Promise<IPFSUploadResult> {
  const bytes = Buffer.from(canonicalJSON(metadata), 'utf8');
  return uploadBytes(bytes, 'pollinator-' + metadata.batchCode.replace(/[^a-zA-Z0-9-]/g, '') + '.json', 'application/json', metadata.batchCode);
}
export async function uploadFileToPinata(fileBuffer: Buffer, fileName: string, batchCode: string): Promise<IPFSUploadResult> {
  return uploadBytes(fileBuffer, fileName, 'application/pdf', batchCode);
}
export async function fetchEvidenceBytes(cid: string): Promise<Uint8Array> {
  if (!isEvidenceCID(cid)) throw new Error('A valid evidence CID is required');
  const primary = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
  const gateways = [...new Set([primary, 'https://ipfs.io/ipfs/'])];
  for (const gateway of gateways) {
    try {
      const url = new URL(gateway.endsWith('/') ? gateway + cid : gateway + '/' + cid);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const declared = Number(response.headers.get('content-length'));
      if (declared > 12 * 1024 * 1024) throw new Error('Evidence exceeds retrieval limit');
      const reader = response.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 12 * 1024 * 1024) { await reader.cancel(); throw new Error('Evidence exceeds retrieval limit'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      return Buffer.concat(chunks);
    } catch { /* Try the independent gateway; an outage never proves integrity. */ }
  }
  throw new Error('Could not retrieve the evidence file');
}
export async function fetchMetadata(cid: string): Promise<BatchMetadata> {
  return JSON.parse(Buffer.from(await fetchEvidenceBytes(cid)).toString('utf8')) as BatchMetadata;
}
export async function verifyFileIntegrity(cid: string, expectedHash: string): Promise<EvidenceCheck> {
  try { return checkEvidenceBytes(await fetchEvidenceBytes(cid), expectedHash); }
  catch { return { valid: false, status: 'UNAVAILABLE', networkError: true, reason: 'The evidence file could not be retrieved.' }; }
}
export async function verifyMetadataIntegrity(cid: string, expectedHash: string): Promise<EvidenceCheck & { metadata?: BatchMetadata }> {
  try {
    const bytes = await fetchEvidenceBytes(cid);
    const check = checkEvidenceBytes(bytes, expectedHash);
    if (!check.valid) return check;
    const metadata = JSON.parse(Buffer.from(bytes).toString('utf8')) as BatchMetadata;
    return { ...check, metadata };
  } catch { return { valid: false, status: 'UNAVAILABLE', networkError: true, reason: 'Metadata could not be retrieved or parsed.' }; }
}
