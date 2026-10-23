# Honey Chain: cooperative deployment and recovery

Updated 20 October 2026. This follows [document 10](10-DEVICE-TELEMETRY-AND-AI.md). It records a working deployment design, executed container checks, defects found by those checks, and the gates still open. It is not a claim that a production cluster is ready or that a rural pilot has happened.

The subsequent [phone gateway checkpoint](13-PHONE-GATEWAY-AND-OFFLINE-QUEUE.md), dated 21 October, adds BLE transport/queue source, authenticated MQTT relay/receipt lookup and packaged gateway acceptance. Its latest test counts and physical/browser limitations supersede the corresponding phone-software todo items below.

## Current gate

The corrected **local deployment acceptance checks pass**. Two independent stacks passed HTTPS API readiness, password login, secure-cookie settings, cross-cluster cookie rejection, record isolation and origin checks. Restricted application database accounts could not modify the deployment binding or read migration history. The local MQTT/TLS profile passed signed QoS-1 delivery, duplicate suppression and invalid-signature rejection with an explicitly **SIMULATED** device. An encrypted backup restored into a separate empty database, preserved its synthetic canary, and refused a second restore into that nonempty schema.

The Linux production web build and corrected web, worker and migrator images completed. Recreated web/chain/proxy services passed the API checks. Startup now loads the chain transport only for registry initialization, and the web image explicitly includes Zod, fixing the actual missing-dependency failure. A preceding native Windows build hit filesystem `EPERM`; the subsequently approved Linux container build passed.

The initial stop/rebuild command was not executed because automatic approval review hit its usage limit. After its reported 10:45 PM retry time passed, the normal approval path succeeded and the command ran. That capacity block is resolved. No alternate path bypassed review. **Browser inspection remains separately blocked** and has not been retried. All new HTTPS checks were backend API tests, not UI inspection.

The QA resources contain synthetic records only. Shutdown uses `scripts/stop-owned-qa.ps1`, which checks exact project labels, preserves all volumes/images/configuration, stops the project-owned integration PostgreSQL and stops the Podman machine only when no other containers run. See `docs/qa/deployment-verification.json` for the recorded final resource state. No public service, public-chain deployment or field pilot is claimed.

## Isolation model

Deploy **one independently configured stack per cooperative/cluster**. Each has its own PostgreSQL instance and restricted application account, Redis instance, QR/session/device-encryption secrets, TLS/MQTT certificates, registry/forwarder pair and gas-relayer key. This provides a concrete isolation boundary without relying on an optional `clusterId` filter in every application query. A shared lab can participate through explicitly enrolled roles in several registries.

`DeploymentIdentity` binds a database to one cluster ID, chain ID, registry address, forwarder and genesis hash. The release entry point refuses a missing or mismatched binding. Initialization verifies the live registry before creating the identity and never silently overwrites another cluster's identity. The application database account cannot modify this identity or Prisma's migration history after binding.

Use a **different relayer key for every independent cluster database on the same chain**. Nonce leases coordinate workers sharing one database; they cannot coordinate two unrelated databases using the same gas payer. Never run an old and a restored writer stack simultaneously with the same relayer key. Read-only/passive recovery checks are different from activating a second writer.

This design trades per-cluster infrastructure overhead for a clear pilot trust boundary. It supports several web/worker replicas within a cluster using its shared database/Redis and worker leases. It does not claim a benchmarked national deployment or an implemented central cross-cooperative private-data dashboard.

## Runtime artifacts

`npm run build:workers` emits CommonJS JavaScript under `build/workers/`; production launchers do not use `ts-node`. The Dockerfile has `web`, `worker`, and `migrator` release targets, plus a clearly separated `qa-evm` test target. Runtime containers use UID/GID 1001. Mounted secret files are loaded before importing the app. The gas-relayer key is mounted only into the chain worker, not the web server.

The initial worker image's production-only dependency check passed: Hardhat, TypeScript and `ts-node` were absent; `.env`, `.env.integration`, `.local-data` and `.aws` were absent. The corrected web, worker and migration images then built successfully in a local rootless Podman Linux VM. The development/build-tool advisories documented in document 10 are not fixed by excluding those tools from runtime images.

Heartbeat files use `/run/honeychain`, which the image creates and assigns to UID/GID 1001. An attempted tmpfs mount failed because of YAML comma splitting and then because Podman rejected its UID option. Compose now uses the image-owned writable directory. These files remain in the disposable container layer, outside persistent database volumes. No memory-only heartbeat guarantee is claimed.

Configuration is validated when a feature uses it. A chain worker does not need unrelated AWS/WhatsApp credentials, and the web build does not need private credentials. WhatsApp client configuration is lazy. Core release-service secrets are still mandatory at startup. Optional inference, WhatsApp and Pinata integrations need their own explicitly supplied configuration before use; the base stack does not pretend they are live.

`APP_ORIGIN` is the canonical server runtime origin. Redirects, mutation-origin checks and QR URLs prefer it over an image's build-time public setting. The homepage reads registry/contact configuration at request time. This prevents a reused web image from sending cluster B's users or labels to cluster A. Public browser variables still follow Next.js build-time rules; the configured network is Amoy for these release prototypes.

## Prepare a real cluster draft

```powershell
npm run cluster:prepare -- --id cooperative-slug --url https://your-actual-origin
```

The command creates a new private folder under `.local-data/clusters/`; it refuses to overwrite an existing folder. It generates separate database, Redis, session, QR, device-encryption and backup-encryption secrets. It does **not** invent a registry, relayer, TLS identity, institution, partner or beneficiary.

Before startup, supply the actual deployed registry v2/forwarder/genesis and RPC in `stack.env`, a separate unprivileged relayer key in the secret directory, and valid web TLS certificate/key files. Supply MQTT CA/server/bridge certificates if enabling the `iot` profile. Keep `stack.env` private too: an RPC URL may contain provider credentials. Do not print resolved configuration when it contains credentials. Restrict Windows folder ACLs; Unix file modes alone do not establish Windows privacy.

Pin the base/service image digests for an actual release. The prototype templates use explicit official image names and version tracks. They have not been presented as immutable production pins or a completed security certification.

## Build and initialize

Use a modern Docker/Compose or Podman/Compose environment. The local checks used Podman 6.0.1, podman-compose 1.6.0 and a rootless WSL Linux VM. The existing Podman machine was initially stopped; starting it did not change its configuration. No image was pushed to a registry.

Build the image targets, using a public origin appropriate for any public values inlined by Next.js:

```powershell
podman build --target worker -t localhost/honeychain-worker:local-review .
podman build --target migrator -t localhost/honeychain-migrator:local-review .
podman build --target web --build-arg NEXT_PUBLIC_APP_URL=https://your-actual-origin -t localhost/honeychain-web:local-review .
```

Use `infrastructure/cluster/compose.yml` with the generated private `stack.env`. Start PostgreSQL/Redis, run the `migrate` setup service, then `bind`. Binding checks the live registry and revokes application writes to the deployment identity/migration history. Only then start `web`, `chain` and `proxy`. Add the `iot` profile for the mutually authenticated MQTT broker and telemetry worker.

The Compose project name scopes networks and volumes. Default public bindings use localhost; publication and real DNS/TLS setup are separate release actions. Database and Redis ports are not published. The reverse proxy provides HTTPS, upload limits, API rate limits and bounded timeouts. It replaces incoming forwarded-IP headers with the actual connecting IP; a trusted upstream load balancer needs an explicit real-IP configuration.

## Migrations: correction found by a real fresh install

The earlier date-only directory names sorted device/deployment changes before the base schema. Fresh PostgreSQL deployment therefore failed with `SensorReading does not exist`. Existing integration tests had not exposed this because migrations were applied incrementally as they were written.

The directories are now explicitly ordered:

1. `20261020000000_honey_chain_v2`
2. `20261020010000_device_telemetry`
3. `20261020020000_deployment_identity`

Both **new empty container databases successfully applied all three** in that order. The failed synthetic databases were preserved for inspection. Only the project-owned localhost integration database had its previously completed migration names updated, after checking their SQL checksums and saving a history snapshot. No existing user database was migrated, reset or renamed.

Existing deployments need backup/schema review and the additive scripts described by documents 06/09/10 plus `prisma/changes/20261020-deployment-identity.sql`. Do not apply the create-all base migration to an existing schema or edit another deployment's migration history using the local test repair procedure.

## Readiness and recovery

`/api/health/live` reports process liveness. `/api/health/ready` checks PostgreSQL, the cluster binding when enabled, and Redis, with bounded waiting and a generic response that does not expose endpoints/secrets. It does not claim that the RPC, AI model, MQTT hardware or a laboratory is live.

Chain/MQTT workers write atomic readiness heartbeat files; the container probe rejects stopped, failed or stale heartbeats. SIGTERM stops polling and releases connections. Temporary chain dependencies back off; stored signed bytes/receipts remain the recovery source. The MQTT worker exits without acknowledging a transiently failed ingestion, allowing the same persistent client ID to recover delivery after restart.

Source changes add encrypted backup tooling:

```powershell
node scripts/cluster-backup.cjs backup --id cooperative-slug --engine podman
node scripts/cluster-backup.cjs restore --id cooperative-slug --engine podman --project honeychain-restore-cooperative-slug --file PATH_TO_ENCRYPTED_BACKUP
```

The command targets exactly one labelled PostgreSQL container, checks the source database identity, and encrypts the custom-format dump using an independent AES-256-GCM key. Cluster/registry/genesis metadata is authenticated with the ciphertext. Restore requires an explicitly separate restore project and an empty public schema. Authentication finishes in a private temporary file **before** a restore process starts. Foreign-cluster, wrong-key and tampered archives are refused; existing data is never automatically dropped. Temporary plaintext is removed on normal success/failure; protect the folder and inspect it after a hard crash.

Four backup-crypto unit tests passed, covering binary round-trip, tampering, wrong keys/clusters and preserving an existing output file. **The actual database backup/restore command also passed** against `honeychain-qa2-cluster-a` and the separate empty `honeychain-restore-qa-cluster-a` fixture. A restored synthetic canary was present. A second restore correctly refused the nonempty target. No restored writer service was activated. This rehearsal does not establish recovery of chain events occurring after a snapshot or a measured production RTO/RPO.

Keep encryption keys/version history in a separate secret manager and retain the QR/device keys needed to interpret a restored database. A database backup cannot roll back the blockchain. Quiesce writers for planned recovery, reconcile receipts and any later chain events before activation, and never activate old/new writer databases concurrently with one relayer.

## Executed checks and open work

- The latest combined application/unit run passed **103 tests**, including six authenticated-storage-receipt tests. See document 12 for the protocol and firmware deletion rules.
- The refreshed contract suite passed **32 tests**. PostgreSQL/EVM passed **10 tests**, and PostgreSQL/MQTT passed **6 tests**, including the committed-receipt checks. This is **151 passing automated tests** across those suites. Container acceptance checks are separate from that total.
- Worker compilation and `npx tsc --noEmit` passed on the latest runtime source. Lint reported **0 errors and 49 warnings across 155 files**. The Linux production Next.js build and standalone sealing passed. `git diff --check` passed before subsequent documentation changes.
- Linux production worker compilation and the initial runtime-image packaging checks passed.
- Fresh installation into two independent PostgreSQL instances passed after the migration-order fix.
- Each database was successfully bound against its own registry/forwarder on the local QA EVM. The QA EVM simulates chain ID 80002; it is **not Polygon Amoy**, a public deployment or field evidence.
- Corrected container startup, HTTPS backend API operation, cross-cluster records/login/session isolation, protected database-role permissions, worker operation, MQTT/TLS delivery, and encrypted database backup/restore passed their synthetic acceptance checks.
- Evidence: `docs/qa/cluster-api-acceptance.json`, `docs/qa/mqtt-tls-acceptance.json`, `docs/qa/backup-restore-acceptance.json` and `docs/qa/deployment-verification.json`. Private fixtures, configuration, keys and raw logs stay ignored under `.local-data/`.
- Browser observation remains blocked; no final UI confirmation is claimed. External-wallet acceptance, a real-chain deployment, post-snapshot chain recovery and production performance remain separate gates.

Other full-goal work remains: BLE gateway/firmware and persistent offline field delivery, assisted farmer signing/external wallet acceptance, calibrated AI/yield validation, and official presentation/attachments. Institution/team/location/interviews/photos/hardware/budget remain pending; fieldwork has not started.
