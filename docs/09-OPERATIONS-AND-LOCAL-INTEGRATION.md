# Honey Chain: actor approvals, recovery and local integration

Updated 20 October 2026. [Document 10](10-DEVICE-TELEMETRY-AND-AI.md) records subsequent telemetry, MQTT, AI and dependency changes. This supersedes the transaction-flow and database-integration status in document 08. The full application goal remains open; this is a software prototype, not a completed rural pilot.

This is an earlier checkpoint. [Document 11](11-CLUSTER-DEPLOYMENT-AND-RECOVERY.md) records the subsequently compiled worker images, cluster isolation, successful Linux production build, encrypted restore rehearsal and refreshed 151-test result. [Document 12](12-OFFLINE-DELIVERY-RECEIPTS.md) adds authenticated storage receipts. Follow those documents for the current deployment status rather than treating the remaining-work list below as unchanged.

## What is now implemented

A harvest, custody transfer, lab attestation, packaging action or recall creates a durable `ChainOperation`. The API returns an operation ID and a review URL. A saved request is **pending**, not blockchain-confirmed.

An enrolled actor reviews the exact action and signs an EIP-712 request with their wallet. The request binds the actor, registry, forwarder, chain, calldata, nonce, gas allowance, zero value and expiry. The server recovers the signer and verifies the forwarder request. A separate relayer pays gas and is refused if it holds any registry administrative or operational role. Farmers do not need gas for this flow; they still need an explicitly enrolled signing identity.

The web workspace provides “Approvals & receipts”, action review, wallet selection/network checks, signing, receipt polling, failed-operation retry and matching-transaction reconciliation. Harvest, custody, lab, packaging and recall forms open this review flow. WhatsApp harvest replies say that approval is pending and include the operation link. WhatsApp registration does not derive a private key from a phone number or application secret.

## State and recovery model

The normal progression is:

`AWAITING_SIGNATURE → READY → SIGNED → SUBMITTED → CONFIRMED`

- **AWAITING_SIGNATURE:** immutable payload, expected batch version and network identity are saved. No transaction has been sent.
- **READY:** the enrolled actor's bound approval is stored. Preparing an intent alone cannot reach this state.
- **SIGNED:** exact outer transaction bytes, hash, relayer address and nonce have committed to PostgreSQL before broadcast.
- **SUBMITTED:** the network has accepted the transaction, or matching acceptance was recovered by its hash. Successful database state is still pending.
- **CONFIRMED:** receipt status, canonical block, confirmation depth, actor-approval event, action event and current chain state have been checked. The receipt and batch/certificate/custody projection commit together.
- **FAILED:** a definite pre-submission failure or reverted transaction. Retry creates a new auditable intent. It does not rewrite the original approval/history.
- **NEEDS_REVIEW:** an ambiguous or inconsistent state, changed network/nonce, conflicting batch version, payload mismatch or exhausted non-submitted retry budget. Resolve the cause and reconcile evidence; do not fabricate a success or blindly submit another transaction.

One database lease per chain genesis and relayer serializes nonce allocation across registry addresses. The worker resumes signed/submitted work before allocating another nonce. Lost RPC acknowledgements rebroadcast the **same bytes**, which keep the same hash and nonce. A database failure after a successful receipt retries projection; unique operation IDs prevent duplicate custody events or certificates. Ordinary dependency retries back off to 60 seconds; non-submitted work has an eight-attempt budget. Submitted receipt polling remains pending until it can be resolved. Automatic fee replacement is not implemented.

One pending operation and an expected version protect each batch. Actor locks avoid overlapping approvals using the same forwarder nonce. Idempotency keys are required on mutation endpoints: replaying an identical request returns its existing operation; reusing a key for different content returns a conflict. These safeguards do not replace backups or operational monitoring.

Recall immediately marks the local batch and withdraws its QR tokens. Its separate chain action still requires the administrator's approval. The UI distinguishes immediate local withdrawal from a confirmed chain recall.

## Checks actually performed

- Application suite: **60 passing tests** (`npm run test:app`). Identity, authorization/ownership, evidence bytes, unavailable dependencies, idempotent form/API behavior, strict quantities, request origins, bounded uploads and development-fixture guards are covered.
- Contract suite: **32 passing tests** (`npm run test:chain`). Lifecycle, independent actors, metatransaction domains/nonces/replay, lab/custody constraints, permanent packaging inventory and recall are covered.
- Real integration suite: **10 passing tests** against isolated PostgreSQL 17.11 and a running local Hardhat node. This is not an in-memory database mock.
- The integration suite completes harvest → processing → lab → packaging → 50 stable jar labels/reprints → distribution → retail → sale → recall. It also checks a restart after signing, lost broadcast acknowledgement, rolled-back database projection after chain success, wrong-actor approval, concurrent batch mutations, parallel workers, external-transaction reconciliation and payload tampering before submission.
- Prisma client generation/schema validation and TypeScript checks passed. The fresh migration was applied only to the isolated integration database. No existing user database or public network was migrated/deployed.
- Full ESLint: **0 errors, 52 warnings across 120 files** at this checkpoint. See `qa/lint-full.json`. Warnings are not claimed to be resolved.

Browser checks verified account login, workspace, operation listing and action review. `qa/operation-review.jpg` shows review **before** submission. The final post-click confirmation screen was not verified: automatic browser review rejected further observation because of the account usage limit. Backend integration results must not be presented as proof that this final UI screen was observed. No real MetaMask approval, hardware session, independent laboratory or live IPFS round-trip was validated by these tests.

## Reproduce the isolated Windows environment

Use Node.js and the project lockfile (`npm ci`), then `npx prisma generate` and `npm run compile:chain`. Read the installed Next.js documentation before changing framework code, as required by `AGENTS.md`.

The local helper expects the official PostgreSQL Windows archive extracted so that `.local-tools/postgresql-17.11/pgsql/bin/pg_ctl.exe` exists. Download sources: [PostgreSQL Windows](https://www.postgresql.org/download/windows/) → [EDB binary archives](https://www.enterprisedb.com/download-postgresql-binaries). Do not commit downloaded tools, database files or credentials. The native PostgreSQL/Redis processes need to run outside an execution sandbox that cannot load their DLLs.

Start the project-owned database:

```powershell
npm run db:local:start
npm run integration:schema
```

The helper uses localhost `55432`, database `pollinator_integration` and generated SCRAM credentials. It creates `.env.integration` from the existing `.env` on first use and replaces the integration database/chain/app settings. It never changes `.env` or a system database service. Both `.env.integration` and `.local-data/` are ignored. Review copied external-service settings before deliberately using those services; the chain test suite does not require a live WhatsApp/Pinata/AWS session.

In a separate terminal, start the ephemeral chain:

```powershell
npm run chain -- --hostname 127.0.0.1 --port 8545
```

Then deploy distinct local fixture actors and a relayer without roles:

```powershell
node scripts/setup-integration-chain.cjs
node scripts/setup-integration-redis.cjs
```

Run a locally installed Redis server with the generated `.local-data/redis-integration.conf`. That configuration binds only `127.0.0.1:56379`, uses a generated password and test database 15, and disables persistence. The installed Redis 3.0.504 used for local checks is a development fixture, not a production recommendation. Do not reuse or reconfigure another Redis service.

To create explicitly synthetic local accounts:

```powershell
node scripts/setup-local-demo.cjs
```

Generated passwords stay in `.local-data/local-demo-accounts.json`. They are not printed in logs. The setup updates only the named local-demo accounts in the isolated database and revokes their old sessions. Open the private credential file locally to sign in; do not publish it in a pitch or commit it.

Run the UI and worker in separate terminals:

```powershell
npm run dev:local
```

```powershell
npm run worker:local
```

Open `http://127.0.0.1:3100`. A production-mode build intentionally does not offer fixture approval. Development fixture approval additionally requires `LOCAL_TEST_SIGNING=true`, a `local-demo-` account, localhost RPC port 8545 and chain 31337. It signs using known Hardhat test accounts and is labelled synthetic. It is **not** real farmer/lab consent. Normal wallet signing remains the approval mechanism outside this fixture.

Run verification:

```powershell
npm run test:app
npm run test:chain
npm run test:integration
npm run build -- --webpack
```

The integration suite selects only the dedicated localhost database and chain. Tests create synthetic records; they are not beneficiary evidence. Stop the UI, worker, Hardhat and Redis with Ctrl+C in their own terminals, then `npm run db:local:stop`. Do not terminate unrelated services. Restarting Hardhat resets its chain: rerun setup, and never treat old database receipt hashes as confirmation on the new chain. Stored genesis identity deliberately prevents silent reuse.

## Existing database rollout

The fresh schema starts in `prisma/migrations/20261020000000_honey_chain_v2/`; the subsequent device-telemetry migration is described in document 10. `prisma migrate deploy` is appropriate for a **fresh** database. Do not apply that create-all migration blindly to an existing schema, or mark it applied without reviewing actual compatibility.

For an existing pre-change deployment, back up first and review the three additive scripts in order: dashboard accounts, packaging inventory, then `prisma/changes/20261020-chain-operations.sql`. Resolve legacy duplicate jar indices and reconcile legacy inventory from actual evidence. These additive scripts have not been applied to an existing user database. Baseline Prisma migration history explicitly as part of a reviewed rollout before using future migrations.

Deploy registry v2 and its forwarder to new addresses. Configure independent actors, a separate deployer and a funded relayer with no registry roles. Existing v1 addresses are not upgradeable to this contract. No public deployment has been performed. The current worker command uses `ts-node` and therefore requires development dependencies; a compiled production worker image, service monitoring and deployment runbook are still required before release.

## What remains

1. Assisted farmer enrollment and recoverable signing with explicit consent; external-wallet acceptance testing. Decide managed-key custody/recovery with the cooperative before enrolling real people.
2. Device ownership and per-device credentials; validated, replay-safe telemetry; a working MQTT bridge and BLE/offline gateway; source markers separating simulated and physical readings.
3. Honest image-inference uncertainty/failure handling, colony-health rules and a clearly labelled productivity estimator. Validate with real data before reporting model accuracy or yield gains.
4. Rural-cluster membership/isolation, production services, health checks, secrets, backups/restore and a release rehearsal.
5. Official presentation and supporting attachments. Institution, team/roles, village/cooperative, interviews/photos, hardware and budget remain pending. Fieldwork has not started. No pilot results, partnerships, eligibility or submission are claimed.


First-time farmer enrollment update, 22 October: after the administrator enrolls a real beekeeper wallet on the intended registry, the trusted source-checkout operator can run `account:provision` with `--enroll-beekeeper` to link an unbound WhatsApp profile and provision its matching login atomically. See document 19 for the command, identity checks and limitations. Registration alone still creates no wallet or chain record.
