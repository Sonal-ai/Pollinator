import { clientPacketHash, decodeClientEnvelope, readReceiptIdentity } from './client-protocol';
import type { SignedEnvelope } from './schema';
import type { StoredReceipt } from './acknowledgement';

export type GatewayRecord = {
  id: string; owner: string; deviceId: string; epoch: string; sequence: number;
  packetHash: string; observedAt: string; createdAt: number;
  envelope: SignedEnvelope; receipt?: StoredReceipt; lastError?: string;
};
const MAXIMUM_PACKETS = 5000;

export class LocalGatewayQueue {
  private constructor(private database: IDBDatabase, readonly owner: string) {}
  static open(owner: string, factory: IDBFactory = globalThis.indexedDB): Promise<LocalGatewayQueue> {
    if (!factory || !owner || owner.length > 200) return Promise.reject(new Error('Local storage is unavailable. Keep readings on the hive.'));
    return new Promise((resolve, reject) => {
      const request = factory.open('honeychain-phone-gateway-v1', 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('packets', { keyPath: 'id' });
        store.createIndex('owner', 'owner');
      };
      request.onerror = () => reject(new Error('Cannot open the phone queue. Keep readings on the hive.'));
      request.onblocked = () => { blocked = true; reject(new Error('Another tab is blocking the phone queue. Close it and retry.')); };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) { database.close(); return; }
        database.onversionchange = () => database.close();
        resolve(new LocalGatewayQueue(database, owner));
      };
    });
  }
  close() { this.database.close(); }
  list(): Promise<GatewayRecord[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction('packets', 'readonly');
      const request = transaction.objectStore('packets').index('owner').getAll(this.owner);
      transaction.oncomplete = () => resolve((request.result as GatewayRecord[]).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
      transaction.onabort = () => reject(new Error('Cannot read the phone queue.'));
    });
  }
  private mutate<T>(work: (store: IDBObjectStore, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = this.database.transaction('packets', 'readwrite', { durability: 'strict' }); }
      catch { transaction = this.database.transaction('packets', 'readwrite'); }
      let output: T, failure: unknown;
      const fail = (error: unknown) => { failure = error; transaction.abort(); };
      transaction.oncomplete = () => resolve(output);
      transaction.onabort = () => reject(failure || new Error('Phone storage could not commit. Keep readings on the hive.'));
      try { work(transaction.objectStore('packets'), value => { output = value; }, fail); }
      catch (error) { fail(error); }
    });
  }
  async put(input: SignedEnvelope, expectedDeviceId: string) {
    const { envelope, bytes, packet } = decodeClientEnvelope(input);
    if (packet.deviceId !== expectedDeviceId) throw new Error('This Bluetooth device sent a packet for another hive.');
    const hash = await clientPacketHash(bytes);
    const id = JSON.stringify([this.owner, packet.deviceId, packet.epoch, packet.sequence]);
    return this.mutate<GatewayRecord>((store, result, fail) => {
      const found = store.get(id);
      found.onsuccess = () => {
        const previous = found.result as GatewayRecord | undefined;
        if (previous) {
          if (previous.envelope.payload !== envelope.payload || previous.envelope.signature !== envelope.signature) { fail(new Error('Conflicting bytes use an existing device sequence. Nothing was overwritten.')); return; }
          result(previous); return;
        }
        const count = store.count();
        count.onsuccess = () => {
          if (count.result >= MAXIMUM_PACKETS) { fail(new Error('This phone queue is full. Sync saved readings before collecting more.')); return; }
          const record: GatewayRecord = { id, owner: this.owner, deviceId: packet.deviceId, epoch: packet.epoch,
            sequence: packet.sequence, packetHash: hash, observedAt: packet.observedAt, createdAt: Date.now(), envelope };
          store.add(record); result(record);
        };
      };
    });
  }
  attachReceipt(id: string, receipt: StoredReceipt) {
    const identity = readReceiptIdentity(receipt);
    return this.mutate<void>((store, result, fail) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as GatewayRecord | undefined;
        if (!record || record.owner !== this.owner) { fail(new Error('Packet is not in this account queue.')); return; }
        if (identity.deviceId !== record.deviceId || identity.epoch !== record.epoch || identity.sequence !== record.sequence || identity.packetHash !== record.packetHash) {
          fail(new Error('The server receipt does not match the queued packet.')); return;
        }
        store.put({ ...record, receipt, lastError: undefined }); result();
      };
    });
  }
  recordError(id: string, message: string) {
    return this.mutate<void>((store, result) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as GatewayRecord | undefined;
        if (record?.owner === this.owner) store.put({ ...record, lastError: message.slice(0, 240) });
        result();
      };
    });
  }
  removeStored(id: string) { return this.remove(id, true); }
  discardFromPhone(id: string) { return this.remove(id, false); }
  private remove(id: string, requireStored: boolean) {
    return this.mutate<void>((store, result, fail) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as GatewayRecord | undefined;
        if (record && record.owner !== this.owner) { fail(new Error('Packet belongs to another account.')); return; }
        if (record && requireStored && !record.receipt) { fail(new Error('An unconfirmed packet cannot be removed automatically.')); return; }
        if (record) store.delete(id);
        result();
      };
    });
  }
}
