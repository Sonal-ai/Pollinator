# Honey Chain / Pollinator

Honey Chain is a prototype for beekeeper cooperatives: record a honey harvest, obtain an independent laboratory attestation, track custody, package a bounded jar inventory, and let consumers inspect evidence and recalls using a QR label. WhatsApp and smart-hive assistance support the farmer workflow.

**Current status: 22 October 2026.** Local software integration is working for actor-approved batch operations and authenticated phone-to-MQTT delivery. No public chain deployment, completed field pilot, physical device validation or measured AI accuracy is claimed. Team, institution and beneficiary details are pending; fieldwork has not started.

## Documentation

**Current scope:** [final local integration](docs/20-FINAL-LOCAL-INTEGRATION.md), excluding public deployment and IoT at the user's request. Local rehearsal and browser acceptance are tracked separately there. The earlier [checklist](docs/15-MAIN-FLOW-VERIFICATION.md) includes public-network gates outside this revised scope. Main `.env` and isolated `.env.integration` remain separate.

The [phased publication record](docs/21-PHASED-PUBLICATION.md) explains the separate commits/pushes, fresh validation, private-file exclusions and separate IoT publication approval. External MetaMask approval is still pending; WhatsApp activation remains deferred.

The [WhatsApp delivery runbook](docs/16-WHATSAPP-DELIVERY-RUNBOOK.md) covers the new durable inbox/outbox, worker activation and administrator review. Local recovery tests pass; public callback activation and real phone delivery remain pending.

The [HTTP rehearsal and Amoy handoff](docs/17-HTTP-REHEARSAL-AND-AMOY-HANDOFF.md) records the current standalone app's full local lifecycle, signed-webhook integration, actual IPFS round trip and fail-closed Redis recovery, plus a seven-minute presentation sequence. Browser/wallet and public-network acceptance remain open.

The [release container checkpoint](docs/18-RELEASE-CONTAINER-CHECKPOINT.md) records fresh Linux images, merged configuration, restricted database grants and worker health/shutdown checks. Full evidence writes require the new evidence-storage override; public activation remains pending.

The [MetaMask deployment flow and next steps](docs/19-METAMASK-DEPLOYMENT-AND-NEXT-STEPS.md) covers the administrator deployment page, transaction recovery, role enrollment and remaining live acceptance gates.

Start with the [audit and improvement dossier](docs/README.md). The latest [hive firmware and bench plan](docs/14-HIVE-FIRMWARE-AND-BENCH-PLAN.md) covers the reference ESP32 source, persistent journal, pairing, sensor setup and physical acceptance gates. The [phone gateway record](docs/13-PHONE-GATEWAY-AND-OFFLINE-QUEUE.md) describes BLE transport, the account-scoped queue, authenticated MQTT relay and receipt lookup. The [cluster deployment and recovery record](docs/11-CLUSTER-DEPLOYMENT-AND-RECOVERY.md) covers compiled services, isolation, migrations and backup tooling. The [submission requirements](docs/07-SUBMISSION-REQUIREMENTS-AND-DOSSIER.md) distinguish required attachments from facts still to collect.

## Implemented

- Password accounts, server-managed roles, revocable sessions and owner-scoped application access.
- Registry v2: strict custody lifecycle, independent lab commitment, permanent packaging count/mass limits, recall and OpenZeppelin ERC-2771 actor signatures.
- Durable PostgreSQL operations with idempotency, wallet review/approval, a separate gas-paying relayer, receipt verification and recovery after process/RPC/database failure.
- Exact-byte evidence hashes, explicit unavailable/mismatched states, serialized jar inventory and stable QR reprints. A copied QR can still be copied physically; anomaly checks are advisory.
- Responsive light/dark interface and an illustrated scrolling hive → Bluetooth phone → MQTT → server/AI → blockchain → consumer journey.
- Per-device signed telemetry, encrypted enrollment keys, replay/duplicate protection, source-separated charts, a session-based synthetic simulator and a QoS-1 MQTT bridge.
- Phone gateway source: Web Bluetooth collection, persistent account queues, TLS MQTT relay, authenticated database receipts and explicit retry/error states. Browser and physical firmware acceptance remain pending.
- Reference ESP32 firmware: sequence reservation in NVS, signed LittleFS journal, authenticated BLE transport, exact-receipt deletion, explicit USB provisioning/clock/calibration and separate sensor/simulation builds. Hardware validation remains pending.
- Uncertainty-aware image screening and a labelled gross-scale trend scenario; no disease diagnosis or honey-yield accuracy claim.
- WhatsApp identity resolution and harvest-intent links. Farmer signing enrollment remains pending; phone numbers are not converted into private keys.

The contract is a provenance registry, not an ERC-721 NFT. A chain commitment records an actor's declaration; it cannot establish the physical purity of honey. Only use an independently obtained laboratory report as quality evidence.

## Development

Use the lockfile and read the installed Next.js guides before framework changes, as required by AGENTS.md.

```powershell
npm ci
npx prisma generate
npm run compile:chain
npm run test:app
npm run test:chain
npm run build -- --webpack
```

For the PostgreSQL/Redis/Hardhat-backed workspace and integration tests, follow [the isolated local setup](docs/09-OPERATIONS-AND-LOCAL-INTEGRATION.md). It uses ignored private configuration and dedicated localhost ports. A fresh database migration and the additive scripts for existing databases are different rollout paths; review the setup before applying either.

Production-style web preview: build, then `npm run preview:standalone`. Configure public browser settings before building and `APP_ORIGIN` for the server runtime. `npm run build:workers` compiles the separate chain/MQTT workers. The corrected Linux web/worker/migrator images built and passed local cluster acceptance checks. Follow document 11 before using the cluster Compose templates.

## Verification and next work

The latest phone-gateway checkpoint passed **132 unit tests and 12 PostgreSQL/MQTT/TLS integration tests**. Worker compilation, TypeScript and the Linux production web build passed. Lint reported zero errors and 49 warnings. The preceding deployment checkpoint passed 32 contract and 10 PostgreSQL/EVM tests, two-cluster HTTPS API/login/session/data checks and an encrypted database restore rehearsal. Browser observation remains blocked. These checks use synthetic local fixtures, not field evidence. See documents 11 and 13 for exact scopes and limitations.

The firmware checkpoint additionally passed 15 host C++ protocol/journal tests, six Python USB-utility tests and one C++ → phone queue → TLS MQTT → PostgreSQL → receipt integration test. These use a host storage model and synthetic measurements. See document 14 and its verification record for the target compile result and physical limits; these checks do not replace ESP32 flash or radio tests.

Next work includes physical offline/power-loss trials, actual browser/device acceptance, assisted farmer signing, post-snapshot chain recovery rehearsal, external-wallet acceptance, and calibrated field validation for AI and scale trends. [Authenticated storage receipts](docs/12-OFFLINE-DELIVERY-RECEIPTS.md) define the safe journal deletion boundary. The [roadmap](docs/03-IMPLEMENTATION-ROADMAP.md) and latest implementation notes track remaining work separately from completed checks.
