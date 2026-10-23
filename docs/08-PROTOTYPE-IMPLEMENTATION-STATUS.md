# Honey Chain: implementation status and next integration gate

Updated 20 October 2026. **Historical checkpoint:** the transaction-flow and database-integration sections below are superseded by [document 09](09-OPERATIONS-AND-LOCAL-INTEGRATION.md). Durable actor approval, relaying and recovery now pass real local PostgreSQL/Hardhat integration tests. Documents 01–05 preserve the original audit baseline; their old failure observations are not a description of every current file.

## Implemented

**Identity:** password accounts, server-managed roles, revocable sessions, owner-scoped dashboard/API access, and exact WhatsApp sender resolution. Unknown senders cannot inherit a demonstration beekeeper. See document 06 for provisioning and the additive account schema. No real accounts were created.

**Interface:** responsive light/dark landing page, a scrolling bee-box illustration covering sensors → Bluetooth → MQTT → server → blockchain → consumer, six stage controls, reduced-motion support, and themed dashboard/login/custody screens. Hardware and conversation illustrations are labelled; they are not live device or fieldwork evidence. Google font downloads are no longer a build dependency.

**Evidence:** exact uploaded bytes are hashed; recursive canonical JSON retains nested packaging fields and Unicode. Storage failures cannot manufacture a CID. Verification separates jar-label matching, chain availability, metadata integrity, report integrity and recall. Missing records never become a prebuilt demonstration. Batch-code lookup does not authenticate a serialized jar. The retired client-location endpoint cannot overwrite another visitor’s scan history.

**Registry v2:** actor roles, explicit lifecycle, immutable original harvest commitment, laboratory attribution, one-time packaging inventory, mass conservation and emergency recall. The standard OpenZeppelin ERC-2771 forwarder checks EIP-712 signatures with nonces, deadlines and chain/contract domains. A relayer can pay gas while events remain attributable to the actor. The administrator has no custody override. Deployment validates distinct actors before spending gas and does not grant every operational role to the deployer.

**Receipt handling:** failed custody, laboratory and packaging transactions return an error before saving successful-looking database state. The direct signing adapter refuses to impersonate another actor, checks registry version and chain ID, and requires a successful receipt. This removes the previous single-wallet shortcut; complete wallet/queue integration is still required.

**Jar inventory:** packaging stores count, size and transaction hash. QR issuance must match that inventory. A serializable database transaction and unique batch/jar index prevent unbounded issuance; retries/reprints reuse existing serials. Deactivated or inconsistent inventory requires reconciliation. The prototype limits one issuance to 10,000 jars. Printed labels can still be copied; scan anomaly alerts are advisory.

## Lifecycle

1. An enrolled beekeeper declares a harvest at `HARVESTED` and hands it to a processor while preserving that stage.
2. The processor declares processing and hands the batch to an enrolled lab at `PROCESSED`.
3. The lab commits a nonzero report hash while holding custody, producing `LAB_VERIFIED`. A producer cannot attest its own batch as an independent lab.
4. The lab hands it back to a processor, preserving `LAB_VERIFIED`.
5. The processor packages once. Positive jar count × jar mass cannot exceed declared harvest mass. Status becomes `PACKAGED`.
6. Handover to a distributor produces `IN_DISTRIBUTION`, then to a retailer produces `AT_RETAIL`. The retailer can declare `SOLD` without collecting consumer wallet details.
7. An administrator can recall at any stage, including during an emergency pause.

Generic custody handovers cannot grant lab approval or packaging state. A commitment establishes what an authorized actor declared; it cannot independently establish honey purity, sampling integrity or physical custody.

## Checks actually performed

- `npm run test:app`: **54 passing tests**, with external I/O mocked. Coverage includes identity, ownership, WhatsApp sender boundaries, byte integrity/tampering, unavailable services, serialized inventory retries and failed transaction behavior.
- `npm run test:chain`: **32 passing tests** on an ephemeral Hardhat network. One completes harvest → processing → lab → packaging → retail → recall using distinct actor signatures submitted by an unprivileged relayer; the beekeeper pays no gas in that test. Others reject signature replay/tampering, cross-domain signatures, stage skipping, unauthorized labs and repeat packaging.
- Solidity: **26 files compiled**, using pinned npm `solc` 0.8.26 and Cancun target. Compilation uses the local compiler rather than downloading a version list.
- Prisma client generation and schema validation: passed. SQL changes were **not applied** to a live database.
- Full ESLint run: **0 errors, 52 warnings across 94 files**. The warnings remain visible in `docs/qa/lint-full.json`; a passing lint command does not mean they were eliminated.
- Final `npm run build -- --webpack`: **passed**, including TypeScript, all 22 static pages and standalone packaging. `git diff --check` also passed.
- Browser checks: desktop light/dark toggle, light-theme persistence across reload, stage navigation, anonymous portal redirect to local login, unavailable-record behavior, mobile menu open/close and no horizontal overflow at a 390 × 844 viewport. Screenshots are in `docs/qa/`.

These checks do not validate real hardware, MQTT, a laboratory, inference endpoint, testnet deployment or a complete database-backed app flow. A configured public contract address is not proof that v2 is deployed there.

## Schema and deployment activation

Back up and review the target database before applying `prisma/changes/20261020-dashboard-accounts.sql` and `prisma/changes/20261020-packaging-inventory.sql`. The label index aborts if legacy duplicate jar indices exist. Investigate those records; do not delete them automatically. Legacy packaged batches get zero inventory and cannot mint labels until reconciled with a real packaging commitment. Do not invent inventory to bypass the check.

Registry v2 needs a **new deployment** of the forwarder and registry. It is not an upgrade of an old v1 address. `deploy:local` targets an already running local node and enrolls distinct test actors. `deploy:amoy` uses `DEPLOYER_PRIVATE_KEY` and explicitly configured actor addresses. No public-network deployment was performed. Verify chain, forwarder, roles, receipts, bytecode and addresses before switching application configuration. The known Hardhat key is not used as a production signer.

Polygon retired its old Amoy RPC in July 2026. Defaults now use a provider listed in current guidance; custom configured URLs were not silently replaced. Amoy is chain 80002 and uses test POL. Sources: [retirement announcement](https://forum.polygon.technology/t/deprecation-of-polygons-public-rpc-endpoints-mainnet-amoy/22014), [RPC providers](https://docs.polygon.technology/pos/reference/rpc-endpoints), [wallet configuration](https://support.polygon.technology/support/solutions/articles/82000907114-how-to-add-amoy-network-in-your-wallet-), [OpenZeppelin metatransactions](https://docs.openzeppelin.com/contracts/5.x/api/metatx), and [Polygon’s Cancun-related upgrade](https://polygon.technology/blog/polygon-pos-is-cooking-the-napoli-upgrade-means-better-ux-the-mumbai-testnet-takes-a-bow). Implementation also follows the installed OpenZeppelin 5.6.1 sources.

## Local review

Configure `.env`, install dependencies, generate Prisma and use `npm run dev -- --webpack`. PostgreSQL/Redis are needed for account-backed workflows. For a built preview, use `npm run build -- --webpack`, then `npm run preview:standalone`. The latter copies public/static assets into the generated standalone output and listens on localhost port 3100. Set `NEXT_PUBLIC_APP_URL` correctly **before building**; Next.js can inline public values. A stale tunnel URL can otherwise redirect the production preview to that tunnel. No external site was published.

## Full-application work remaining

The full goal remains open. The next integration gate is a **durable, actor-authorized transaction flow against a working PostgreSQL environment**:

1. Store immutable intents, expected state/version, idempotency keys, actor approvals, network/contract identity, submission/receipt state and reconciliation status. Database failure after chain success must be recoverable without repeating the committed event.
2. Connect operator wallets to intent preparation/signing and the unprivileged relayer. Add bounded retries, nonce handling and receipt reconciliation. Account roles alone cannot produce an actor signature.
3. Provide explicit assisted enrollment/signing for WhatsApp farmers. Do not use the gas payer as every farmer. Keep lab/admin approval independently attributable. Request a wallet login when this concrete signing flow is ready to review.
4. Complete device proof of ownership, per-device credentials, telemetry validation, replay/duplicate handling, MQTT bridge, BLE gateway/firmware, offline queue and simulated/live source markers.
5. Complete inference failure/uncertainty behavior, colony-health rules and a labelled productivity estimator. Validate real data before claiming accuracy or yield improvements.
6. Add cluster membership/isolation, deployment services, secret management, health checks, backup/restore and release verification. Exercise independent actors and injected failures in a database-backed integrated demo.
7. Finish the official presentation/attachments after team institution/roles, beneficiary location, interviews/photos, hardware and budget are available. These remain pending; fieldwork has not begun. Eligibility, partners, completed pilots, measured impact and submission have not been invented.

Engineering can progress while fieldwork is pending. Fieldwork is necessary to substantiate the submission’s authenticity and impact claims.
