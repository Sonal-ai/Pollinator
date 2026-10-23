# Honey Chain: device intake, MQTT and honest AI assistance

Updated 20 October 2026. This is the next implementation checkpoint after [document 09](09-OPERATIONS-AND-LOCAL-INTEGRATION.md). Physical hardware, field data, beneficiary interviews, institutional/team details and budget remain pending. New dashboard changes in this checkpoint have not received browser QA because observation was blocked by automatic review's account usage limit.

This is an earlier checkpoint. [Document 11](11-CLUSTER-DEPLOYMENT-AND-RECOVERY.md) records the subsequent isolated deployment, HTTPS/MQTT/TLS and encrypted database restore checks, plus the refreshed 151-test result. [Document 12](12-OFFLINE-DELIVERY-RECEIPTS.md) records the authenticated storage-receipt protocol. Browser confirmation remains pending.

## Implemented software boundary

The old global bearer secret and browser-visible device password have been removed from sensor intake. Every enrolled device has its own random 32-byte HMAC key and UUID epoch. A trusted operator assigns it to an existing beekeeper after checking ownership. Typing an arbitrary device ID in WhatsApp cannot create a hive or claim somebody else's device.

The server stores an AES-256-GCM encrypted device key. Additional authenticated data binds the ciphertext to the device ID and epoch; swapping ciphertext between devices fails. `IOT_CREDENTIAL_KEY` is an independent 64-hex encryption key with no default. Losing it makes current device secrets unreadable. Back it up through the deployment secret manager; rotation needs an explicit re-encryption procedure or device re-enrollment. Private export files under ignored `.local-data/devices/` contain plaintext provisioning keys for trusted local transfer; they are not safe public attachments. Restrict the folder's OS permissions, especially on shared Windows machines.

Device authentication proves possession of an enrolled key. It does **not** establish calibration, sensor placement, the truth of a physical measurement or that honey is pure. A compromised device key can sign false readings for that device; revoke and rotate it.

## Packet contract

`POST /api/sensor-data` accepts at most 4,096 bytes of UTF-8 JSON and requires `Content-Type: application/json` and `X-Device-Signature` (64 lowercase hex characters). The signature is HMAC-SHA256 with the binary device key over the UTF-8 domain prefix `honey-chain-telemetry-v1\n` followed by the **exact request bytes**. Gateways must not reserialize signed JSON.

```json
{
  "version": 1,
  "deviceId": "SIM-DEMO-001",
  "epoch": "00000000-0000-4000-8000-000000000001",
  "sequence": 12,
  "observedAt": "2026-10-20T10:00:00.000Z",
  "metrics": { "tempC": 35.1, "humidityPct": 58, "weightKg": 40, "batteryPct": 90 }
}
```

The example epoch is illustrative; use the actual enrolled UUID. A packet needs at least one measured metric. Missing values remain null in storage; they are not replaced with nominal healthy values. Strict schema checks reject unknown fields, conflicting hive aliases, invalid ranges, nonfinite values and invalid sequence numbers. Device IDs are uppercase letters/digits/underscore/hyphen, 3–64 characters. Sequences are nonnegative 32-bit integers and must not be reused within an epoch.

Readings store observation time, server receipt time, packet hash, credential, epoch, sequence and source. A unique credential/epoch/sequence constraint makes identical retries idempotent (`200` with the same reading ID); altered content using an old sequence returns `409`. New accepted readings return `201`. Wrong/revoked keys and old epochs return `401`. Storage failures return `503` and the sender must retry the same signed packet.

New observations may be up to seven days old and at most five minutes ahead of server time. Offline packets may arrive out of order; observation time determines chart order. An already accepted, still-authorized identical packet can receive an acknowledgement outside that age window. Revocation and rotation are checked again in the serializable insertion transaction. Keep current-epoch deduplication records: deleting them while retaining the same key/epoch weakens replay protection. Rotate the epoch before compacting that ledger.

## Source labels and demo

`DEVICE` means an operator enrolled a device key for this hive. `SIMULATED` is synthetic software data. Existing unattributed rows become `LEGACY`; they are not silently promoted to physical evidence. Source is taken from the server credential, never trusted from an incoming payload. Rotation does not relabel old readings.

The browser simulator uses the signed-in session and only an owned, active `SIMULATED` credential. It cannot inject readings into a `DEVICE` credential. Charts explicitly select a source and cap results at the latest 5,000 readings. Simulated, legacy and device data are kept separate for summaries and estimates. A stored packet is not a live broker health check.

After the two fresh migrations are applied to the isolated database, rerun `node scripts/setup-local-demo.cjs` to add `SIM-DEMO-001` and a generated encryption key to ignored `.env.integration`. It preserves an existing device credential. Start the app with `npm run dev:local` and use the simulation control on the IoT page. No browser fixture signing or simulation is evidence of field deployment.

Operator enrollment for another synthetic device:

```powershell
$env:POLLINATOR_ENV_FILE = '.env.integration'
npm run device:provision -- --device SIM-002 --beekeeper EXISTING_DATABASE_ID --source simulated
```

For a physical device, ownership/key installation must actually be checked before selecting `--source device --physical-verified`. Do not use that flag to make a simulated demo look real. `--rotate` explicitly invalidates the previous key/epoch; `--revoke` disables ingestion while preserving history. Ownership transfers require separate operator review and are not silently performed by this CLI.

`npm run simulate:iot -- SIM-DEMO-001` sends one synthetic signed packet using its private local credential. A durable outbox retains exact bytes until a `200/201` database acknowledgement. A subsequent run retries pending work first. The counter is persisted before transmission. Run one process per credential; its lock prevents concurrent sends. If a process is forcibly killed, inspect that process/outbox before removing a stale lock. Expired or conflicting packets need review, not automatic re-signing or deletion.

## MQTT bridge

The bridge subscribes at QoS 1 to `honeychain/v1/devices/+/telemetry`. Each non-retained MQTT payload is an envelope:

```json
{ "payload": "BASE64_OF_EXACT_SIGNED_JSON_BYTES", "signature": "64_LOWERCASE_HEX_HMAC" }
```

The envelope is capped at 8,192 bytes, uses canonical base64 and must match the signed device's topic. The same service validates and saves HTTP and MQTT packets. MQTT.js `handleMessage` backpressure delays consumer PUBACK until the database write succeeds. An invalid poison message is rejected without saving and acknowledged so it cannot block the session. On a transient storage failure, the bridge closes without acknowledgement and exits with a failure status; the service supervisor must restart the **same persistent client ID** for broker redelivery. Do not run two active bridges with the same client ID.

Configure `IOT_MQTT_URL`, stable `IOT_MQTT_CLIENT_ID`, and CA/client-certificate/private-key paths from `.env.example`, then run `npm run mqtt:bridge`. TLS certificate verification is always enabled. Plain MQTT is allowed only for explicit localhost development outside production. Credentials are not accepted inside a URL or printed in logs.

`infrastructure/mqtt/` provides a Mosquitto TLS/mutual-certificate template and topic ACL. A device certificate CN matches its device ID and can publish only its own topic; a separate `honeychain-bridge` certificate reads telemetry. Certificates, broker persistence, revocation, disk capacity, session retention and monitoring still need deployment validation. The actual MQTT integration test uses an isolated in-process Aedes test broker over localhost TCP, not a deployed Mosquitto server. It proves consumer acknowledgement/redelivery behavior under a simulated database outage; it does not prove broker disk durability after power loss. Publisher PUBACK means broker acceptance, not end-to-end application confirmation.

Upstream references reviewed: [MQTT.js client and message handler](https://github.com/mqttjs/MQTT.js), [Mosquitto configuration and certificate identity](https://mosquitto.org/man/mosquitto-conf-5.html). TinyFish fetch failed with an expired API key; these upstream documents were read directly. No TinyFish research success is claimed.

## Colony inspection rules

`inspection-rules-v2` is a deterministic engineering aid, not a trained disease model. Temperature and humidity bands produce a labelled rules index. Missing temperature/humidity, a missing timestamp, readings older than 30 minutes, an excessive future clock or legacy provenance produce `INSUFFICIENT_DATA` and a null score. Synthetic results explicitly say they are synthetic.

Weight deltas need two measured values separated by at least one minute and at most one day. A delta is an observation, not proof of swarming, theft, nectar flow or disease. The UI and WhatsApp no longer substitute default temperatures, weights, humidity or battery values, and no longer claim an active MQTT/AWS service without a measured status check. Configuration bands need local calibration, species/placement information and trained beekeeper review before use as operational alerts.

## Image-screening boundary

The configured AWS Lambda integration accepts JPG/PNG/WebP bytes up to 4 MB. Web/API/WhatsApp paths bound media before paid inference; the web route requires the appropriate session and rejects another farmer's hive ID. A photo without an explicitly selected hive remains unassigned. It is no longer automatically attached to the first hive in an account.

Set `VARROA_LAMBDA_FUNCTION` and the **actual deployed** `VARROA_MODEL_VERSION`; use the AWS credential provider chain, preferably a least-privilege service role. Invocation has a 25-second timeout and no automatic retry. Missing configuration, timeout, function failure or malformed output returns unavailable; it cannot manufacture a successful health record. No new model weights, representative labelled dataset or validated endpoint were supplied in this checkpoint.

The application validates detection classes, finite scores, bounded detection count and boxes. It derives counts from accepted detections instead of trusting an upstream summary/green banner. The prototype display threshold is 0.6 and the negative-image screen requires at least ten accepted bee candidates and no omitted low-score candidates. These are unvalidated display gates, not biological sampling or calibrated accuracy thresholds.

Results are `uncertain`, `varroa_parasite_suspected`, or `no_visible_mites`. Empty detections become uncertain with zero evidence confidence; the old default 0.95/healthy result has been removed. A candidate detection score is not a probability that a colony is diseased. A photo's mite-to-bee count is not a colony infestation rate. Web and WhatsApp no longer prescribe chemical treatments from these images. Original stored `healthy` results are shown as legacy interpretations requiring review. Static WhatsApp price/subsidy promises were also replaced with an unavailable-feed notice.

## Productivity estimate

`scale-trend-theil-sen-v1` uses daily median gross scale weights, with a median of pairwise daily slopes. It needs at least seven daily medians spanning six days, a weight reading within the last day, and no sampling gap over two days. A daily step greater than the prototype 2 kg handling threshold suppresses the scenario until harvesting/feeding/rain/box changes/calibration are checked. These rules deliberately abstain rather than invent a yield.

The optional seven-day change and sensitivity band are an engineering continuation scenario. They are **not** a calibrated confidence interval, honey-yield prediction, harvest recommendation or measured income improvement. Simulated inputs remain labelled. Field harvest logs, tare/super weights, calibration and a held-out seasonal dataset are needed before estimating extractable honey or claiming forecast error/accuracy.

## Validation at this checkpoint

- **8 telemetry unit tests:** exact-byte HMAC, key/ciphertext binding, strict packet bounds, offline clock window, missing/stale data, valid delta intervals and MQTT topic/envelope binding.
- **6 real PostgreSQL integration tests:** partial measurements/source attribution, duplicate and conflicting sequences, wrong/revoked/rotated keys, out-of-order history, concurrent deliveries and actual localhost MQTT redelivery after a storage failure.
- **15 vision/productivity tests:** uncertainty, invalid endpoint output, image bytes/bounds, no false colony diagnosis, trend data gates, handling steps, synthetic labels, web authentication, ownership, cross-site submission and unavailable inference.
- The existing **60 application tests** pass. The contract suite was rerun after framework/dependency changes: **32 pass**. Document 09 records the **10 passing chain/database integration tests**.
- The final combined regression run passed **83 unit/application tests + 32 contract tests + 16 local integration tests = 131**. An earlier combined run had an outdated wording assertion and a cancelled MQTT timeout; those were corrected and the affected suites rerun successfully. The MQTT fixture now waits for the broker's old-session teardown and cleans up on cancellation. Heavy test suites run sequentially.
- Next.js and its matching ESLint package were upgraded from 16.3.5 to 16.4.2 after a production advisory scan. The compatible source-map-js patch was applied. The rescan reported **zero known advisories for production dependencies** (`qa/dependency-audit-production.json`). Compatible security updates also removed the critical Handlebars development-tool advisory. The full scan still reports **59 development/build-tool advisories (26 high, 14 moderate, 19 low)**, largely in the existing Hardhat 2 toolchain; resolving the rest needs a reviewed tooling migration rather than forced breaking upgrades. This is a package-registry advisory snapshot, not a security certification; development/build tools are scanned separately and the current TypeScript worker still needs development dependencies.

Final `npm run build -- --webpack` **passed** on Next.js 16.4.2, including TypeScript, 24 static-page generation jobs and standalone packaging. Its postbuild safeguard passed and removed one copied environment file. Full ESLint passed with **0 errors and 47 warnings across 135 files**; `git diff --check` passed. See `qa/verification-summary.json` for the machine-readable checkpoint. Project-owned preview, worker, Hardhat, Redis and integration PostgreSQL processes were stopped after verification; the ignored data/configuration was retained.

The new migration was applied only to the isolated integration database. Fresh databases apply both migrations. Existing deployments review the additive device-telemetry script after account/inventory/operation changes; first back up and reconcile their real schema/history. No real device credential or field data was created.

Standalone builds now exclude local tools/data from file tracing and run `scripts/seal-standalone.cjs` after compilation. Next.js otherwise explicitly copies loaded `.env` files into its standalone directory; the postbuild step removes those generated copies, refuses traced private development-data folders, and avoids following Windows junctions into source. Runtime secrets must be injected separately. `.dockerignore` also excludes credentials and local databases/tools from the build context. Gemini authentication now uses an API-key header rather than a logged query string, and full-URL fetch logging is disabled. References: the installed Next.js output documentation/source and [Google API-key guidance](https://ai.google.dev/gemini-api/docs/api-key). No Docker image build or public release is claimed.

## Next integration gates

BLE gateway/firmware and its persistent offline queue remain to implement and test on selected hardware. Also pending: multi-cluster isolation, compiled worker/bridge deployment, health checks, backup/restore rehearsal, assisted farmer signing/recovery, external wallet acceptance and a release presentation using the official template. The institution/team/location/interviews/photos/hardware/budget remain explicitly pending; fieldwork has not begun. Local software fixtures and these tests must never be substituted for those facts.
