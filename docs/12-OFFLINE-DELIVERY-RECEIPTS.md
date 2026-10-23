# Honey Chain: authenticated storage receipts

Updated 20 October 2026. This records the implemented server protocol foundation. [Document 13](13-PHONE-GATEWAY-AND-OFFLINE-QUEUE.md) adds phone gateway source and the MQTT relay/receipt lookup on 21 October. Firmware, physical sensors and completed browser/hardware offline trials remain pending.

## Why an upload response is insufficient

A phone can lose connectivity after sending a packet. A broker can accept a message before the telemetry worker saves it. A compromised phone can also fabricate a successful upload response. Firmware must retain its journal entry until it verifies a receipt authenticated with its enrolled device secret and bound to the exact stored packet.

The phone must never receive the device secret. It forwards signed telemetry and opaque receipts. It may delay or drop traffic, but it cannot manufacture a valid storage receipt without the device secret. Hardware key extraction and compromised server enrollment remain outside this protocol's protection.

## Implemented behavior

`TelemetryService.ingest` now returns `{ reading, duplicate, receipt }`. It creates the receipt only after its transaction resolves successfully, or after finding an identical previously committed reading. A transaction rejection produces no receipt. A retry of the same bytes returns the same receipt. Reusing a sequence with different bytes remains a conflict.

`POST /api/sensor-data` adds `receipt` to successful responses and marks them `Cache-Control: no-store`. Its existing exact-byte device signature remains mandatory. This route supports direct device/server delivery. The phone uses the separate authenticated MQTT relay and receipt lookup documented in document 13.

The MQTT worker ignores the returned receipt after storage and acknowledges its broker delivery. Document 13 implements a separate authenticated, owner-scoped receipt lookup for the phone gateway. Broker PUBACK never stands in for a device-verifiable database receipt.

## Wire format

A receipt envelope has two fields:

```json
{
  "payload": "BASE64_OF_EXACT_UTF8_RECEIPT_JSON",
  "signature": "LOWERCASE_64_HEX_HMAC_SHA256"
}
```

The decoded payload contains strictly these fields, with example values only:

```json
{
  "version": 1,
  "kind": "stored",
  "deviceId": "DEVICE-EXAMPLE",
  "epoch": "dce35137-7da1-42a0-9f18-85951045e455",
  "sequence": 7,
  "packetHash": "SHA256_OF_EXACT_ORIGINAL_TELEMETRY_BYTES",
  "readingId": "DATABASE_READING_ID"
}
```

`packetHash` must actually contain 64 lowercase hexadecimal characters. The example placeholder is descriptive, not a valid value. The signature is HMAC-SHA256 using the device's 32 decoded key bytes over the UTF-8 bytes of `honey-chain-stored-v1\n` followed by the exact decoded receipt bytes. The prefix ends with a newline byte. It is separate from the telemetry signature domain, so a signed telemetry packet cannot be replayed as a receipt.

The receiver checks canonical base64, a bounded envelope, the MAC with a constant-time comparison, the strict schema and all four identity fields: device ID, epoch, sequence and packet hash. JSON reserialization is not part of MAC verification. Field order inside the original authenticated payload does not need reconstruction by firmware.

## Required firmware and phone behavior

1. Persist the device epoch, sequence allocation and complete signed packet before reporting it available over BLE. Prevent sequence reuse after power loss.
2. Keep readings in a bounded persistent journal. If full, signal an operator-visible error rather than silently overwriting unacknowledged entries.
3. A phone stores exact signed bytes in a persistent local queue, scoped to the signed-in account. It never changes the observation time or fabricates absent metrics.
4. Reconnect and resend the same bytes. The current server accepts new packets up to seven days old and five minutes ahead, and accepts identical already-stored retries without inserting again. Older uncommitted readings require an explicit recovery policy and must not become apparently fresh readings.
5. Firmware verifies the stored receipt against the journal entry before deletion. A phone's local “queued,” “sent” or broker acceptance state cannot authorize deletion.
6. Key rotation creates a new epoch. Plan how to recover old pending readings before revocation, because the current server refuses inactive/old credentials even for retries.

Do not claim background sync, Bluetooth support on every phone, power-loss recovery, journal durability or MQTT receipt delivery until the corresponding implementation and hardware trials pass.

## Verification

Six new unit tests passed: exact receipt identity and bytes, wrong key/tampering, telemetry-versus-receipt domain separation, mismatched stored rows, malformed authenticated schemas, and commit/failure/idempotent retry behavior. The commit-boundary test deliberately holds a transaction promise unresolved and asserts that ingestion has not returned a receipt.

The telemetry integration test was extended to verify receipts against a real stored reading. An initial sandbox run could not reach the dedicated PostgreSQL service at `127.0.0.1:55432`, so its setup hook failed before assertions ran. After the approval retry time passed, the normal host approval path succeeded, the dedicated service was made available, and **all six PostgreSQL/MQTT integration tests passed**. They include receipt verification against a committed row, concurrent duplicate delivery, key rotation/revocation and real QoS-1 redelivery after an injected storage failure. Earlier contract/chain integration results in document 09 remain historical.

The contract and PostgreSQL/EVM suites were then refreshed too: 32 contract and 10 operation integration tests passed. Together with 103 unit and 6 PostgreSQL/MQTT tests, the latest total is 151 passing tests. The container MQTT/TLS acceptance check also passed separately with an explicitly SIMULATED device.

The earlier container review-capacity block expired. The normal approval path subsequently allowed the stop/rebuild command and backend fixture administration. No alternate path bypassed the review. Browser inspection remains separately blocked and has not been retried. Temporary QA services were stopped afterward while their data and logs were preserved.
