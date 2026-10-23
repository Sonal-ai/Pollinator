import { BleFrameDecoder, type BleFrame } from './client-protocol';
import type { StoredReceipt } from './acknowledgement';

export const HIVE_BLE_SERVICE = '7f6a1000-8e54-4d80-b8e4-9b732f6c4a01';
export const HIVE_BLE_TELEMETRY = '7f6a1001-8e54-4d80-b8e4-9b732f6c4a01';
export const HIVE_BLE_COMMAND = '7f6a1002-8e54-4d80-b8e4-9b732f6c4a01';
interface Characteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<Characteristic>;
  stopNotifications(): Promise<Characteristic>;
  writeValueWithResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
}
interface GattServer {
  connected: boolean;
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }>;
}
interface BleDevice extends EventTarget { name?: string; gatt?: GattServer }
export interface BluetoothAdapter { requestDevice(options: { filters: { services: string[] }[] }): Promise<BleDevice> }
export function phoneBluetooth() { return (navigator as Navigator & { bluetooth?: BluetoothAdapter }).bluetooth; }

export class HiveBleConnection {
  private decoder = new BleFrameDecoder();
  private writes: Promise<void> = Promise.resolve();
  private received: Promise<void> = Promise.resolve();
  private pendingFrames = 0;
  private disposed = false;
  private constructor(private device: BleDevice, private telemetry: Characteristic, private command: Characteristic,
    private onFrame: (frame: BleFrame) => Promise<void>, private onDisconnect: () => void, private onError: (error: Error) => void) {}
  static async connect(adapter: BluetoothAdapter, callbacks: {
    frame: (frame: BleFrame) => Promise<void>; disconnected: () => void; error: (error: Error) => void;
  }) {
    // This call stays before all other awaits so a click supplies transient user activation.
    const device = await adapter.requestDevice({ filters: [{ services: [HIVE_BLE_SERVICE] }] });
    try {
      if (!device.gatt) throw new Error('The selected device has no GATT server.');
      const server = await device.gatt.connect(), service = await server.getPrimaryService(HIVE_BLE_SERVICE);
      const telemetry = await service.getCharacteristic(HIVE_BLE_TELEMETRY), command = await service.getCharacteristic(HIVE_BLE_COMMAND);
      const connection = new HiveBleConnection(device, telemetry, command, callbacks.frame, callbacks.disconnected, callbacks.error);
      telemetry.addEventListener('characteristicvaluechanged', connection.notification);
      device.addEventListener('gattserverdisconnected', connection.disconnected);
      await telemetry.startNotifications();
      return connection;
    } catch (error) { device.gatt?.disconnect(); throw error; }
  }
  get name() { return this.device.name || 'Selected hive'; }
  private notification = () => {
    try {
      const value = this.telemetry.value;
      if (!value || this.disposed) return;
      const frames = this.decoder.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      for (const frame of frames) {
        if (++this.pendingFrames > 16) throw new Error('Hive notifications exceeded the phone’s processing capacity. Reconnect after reviewing the queue.');
        this.received = this.received.then(async () => { if (!this.disposed) await this.onFrame(frame); })
          .finally(() => { this.pendingFrames--; }).catch(error => {
            this.onError(error instanceof Error ? error : new Error('Cannot save the BLE packet.')); this.disconnect();
          });
      }
    } catch (error) { this.onError(error instanceof Error ? error : new Error('Invalid BLE frame.')); this.disconnect(); }
  };
  private disconnected = () => { this.disconnect(); this.onDisconnect(); };
  private write(value: unknown) {
    if (this.disposed) return Promise.reject(new Error('Reconnect the hive before sending a receipt.'));
    const bytes = new TextEncoder().encode(JSON.stringify(value) + '\n');
    if (bytes.length > 4096) return Promise.reject(new Error('Hive command is too large.'));
    const operation = this.writes.then(async () => {
      if (this.disposed || !this.device.gatt?.connected) throw new Error('Reconnect the hive before sending a receipt.');
      for (let offset = 0; offset < bytes.length; offset += 20) {
        if (this.disposed) throw new Error('Hive disconnected during command delivery.');
        await this.command.writeValueWithResponse(bytes.slice(offset, offset + 20));
      }
    });
    let timer: ReturnType<typeof setTimeout>;
    const bounded = Promise.race([operation, new Promise<void>((_resolve, reject) => {
      timer = setTimeout(() => { if (!this.disposed) { this.disconnect(); this.onDisconnect(); } reject(new Error('Hive command timed out. Saved packets were kept.')); }, 15000);
    })]).finally(() => clearTimeout(timer));
    this.writes = bounded.catch(() => {});
    return bounded;
  }
  rewind() { return this.write({ command: 'rewind' }); }
  next() { return this.write({ command: 'next' }); }
  acknowledge(receipt: StoredReceipt) { return this.write({ command: 'ack', receipt }); }
  disconnect() {
    if (this.disposed) return;
    this.disposed = true;
    this.telemetry.removeEventListener('characteristicvaluechanged', this.notification);
    this.device.removeEventListener('gattserverdisconnected', this.disconnected);
    void this.telemetry.stopNotifications().catch(() => {});
    this.device.gatt?.disconnect();
  }
}
