# Full application and blockchain audit

Audit date: 20 October 2026. Baseline: `54a1a496de12e34ee7a9e2abb740cf83f88d71f5`.

**Subsequent implementation:** Password authentication, server-managed roles, revocable account sessions, scoped private data access and removal of demo-identity fallbacks are now implemented in the working tree. This document preserves the original findings; see [authentication setup and rollout](06-AUTHENTICATION-SETUP.md) for activation, validation and items still open.

## 1. Executive assessment

Pollinator already connects farmer onboarding, hive telemetry, image inference, honey batches, lab PDFs, custody events, packaging, serialized QR links, scan anomalies, and recalls. This gives the team a useful prototype and a coherent domain.

The principal weakness is **evidence credibility**. The UI can claim more than the underlying transaction, file, actor authentication, or physical evidence establishes. The best improvement is to make a narrower end-to-end workflow demonstrably trustworthy, then measure its usefulness with a cooperative or beekeeper group.

Current architecture is a centralized application with public-chain anchoring. This can be a valid design, but it does not currently establish independent farmer, lab, and processor signatures. A database wallet address displayed in the dashboard is not evidence that the actor signed a blockchain transaction.

Severity definitions:

- **Critical:** unauthenticated privilege acquisition or fundamental identity compromise.
- **High:** false verification, unauthorized cross-user action, or bypass of a core provenance invariant.
- **Medium:** reliability, privacy, availability, operations, or user-decision defects.
- **Low:** inconsistencies and maintainability gaps with limited immediate impact.

Findings below distinguish source-confirmed behavior from locally reproduced behavior. No numeric security score, CVSS score, production exploit, or regulatory certification is implied.

## 2. What exists today

### Application and data

- Next.js 16.3.5 App Router, React 19, TypeScript, Prisma 5, PostgreSQL, and Redis conversation state.
- JWT cookies and dashboard navigation by role. Route handlers implement their own authorization inconsistently.
- Prisma models for beekeepers, hives/readings, AI inferences, honey batches, certificates, custody events, QR tokens/scans, and alerts.
- Dashboard pages for batches/details, custody, lab, processor, IoT, health, analytics, recall, and login.

### Blockchain

- `contracts/HoneyChain.sol` inherits OpenZeppelin `AccessControl` and `Pausable`.
- Batch registry includes creator/custodian, harvest time, quantity, metadata CID/hash, lab hash, flags, and lifecycle status.
- Events cover creation, verification, custody, packaging, and recall.
- Local Hardhat and Polygon Amoy configuration; an address manifest exists. Manifest addresses are configuration evidence, not proof of current deployment code, roles, balance, or liveness.
- All application writes in `src/lib/blockchain.ts` use the same singleton server wallet. Deployment grants operational roles to that wallet.
- No ERC-721 inheritance, NFT minting/ownership interface, payment settlement, escrow, or independent actor signature verification was found.

### Off-chain integrations

- Pinata JSON/PDF upload and IPFS gateway fetching.
- HMAC-SHA256 QR payloads with per-jar UUIDs; scan logging and heuristic geographic/volume alerts.
- Signed Meta webhook intake, Redis deduplication, multilingual Gemini text/audio handling, harvest confirmation, and hive pairing.
- AWS Lambda invocation for Varroa image inference. The Lambda model implementation, training data, deployment configuration, and evaluation are outside this repository.
- HTTP telemetry ingestion and a deterministic threshold-based hive health calculation. The hardware, MQTT broker, LoRa/ESP-NOW network, and acoustic pipeline shown in existing prose are not implemented end-to-end in the reviewed source.

## 3. Critical findings

### A01 — Login does not authenticate identity or privileged roles

**Critical; source-confirmed.** Evidence: `src/app/api/auth/login/route.ts:16`, `:31`, `:67`, `:114`.

Email login checks that the identifier contains `@` and that the submitted password has at least six characters. It never verifies a stored password or identity-provider result. The request can select an allowed role, with `admin` as the default; some persona addresses override the selected role. Phone login needs no OTP or other proof of phone possession.

**Impact:** an attacker can obtain an admin session and reach admin-authorized APIs, or impersonate a beekeeper. Cookie signing and HttpOnly flags cannot compensate for missing credential verification.

**Required improvement:** use verified email/password or an identity provider for organisations, OTP/WhatsApp-issued short-lived sign-in challenges for farmers, and roles loaded only from a server-managed actor membership record. Place any persona picker exclusively in an isolated, unmistakably labeled demo environment.

**Acceptance:** arbitrary email/password/role combinations cannot create an authenticated privileged session; expired/reused OTPs fail; the role in the request is ignored for authorization.

### A02 — Demo identity fallbacks cross account boundaries

**Critical; source-confirmed.** Evidence: `src/lib/whatsapp/handler.ts:311–333`; `src/app/api/custody/route.ts`; dashboard batch, custody, and IoT queries.

WhatsApp lookup includes a fixed demo phone in its identity OR query and then falls back to a named demo beekeeper. Some dashboard and custody queries also include this identity regardless of the signed-in actor. Unrelated callers can therefore resolve to demo-owner data or actions. If that identity holds real data, the consequence extends beyond a presentation defect.

**Required improvement:** identify users by one verified canonical phone/actor ID, scope every resource to an organisation and owner, and remove fixed-person fallbacks. Create isolated fixture identities in a demo database instead.

**Acceptance:** two independent beekeepers cannot see or modify each other's batches, hives, inferences, or custody through the web or WhatsApp.

## 4. High-priority blockchain and evidence findings

### A03 — IPFS failures fabricate successful-looking references

**High; source-confirmed.** Evidence: `src/lib/ipfs.ts:114`, `:159`.

Failed Pinata calls return a string built from `Qm` and truncated hexadecimal SHA-256 output. No file has been pinned by that fallback. The construction is not a correctly encoded CID and must not be represented as persisted IPFS content. Calling routes believe storage succeeded and may anchor the fabricated reference.

**Required improvement:** return a typed storage failure or retain bytes in an explicit private pending upload store. Return success only after receiving and validating a real CID; retrieve and hash the stored bytes in an integration check. Local demo storage must have a separate namespace and visible label.

### A04 — Metadata hashing omits nested evidence and differs from the upload

**High; locally reproduced.** Evidence: `src/lib/ipfs.ts:54`, `:79`, `:90`.

`JSON.stringify(metadata, Object.keys(metadata).sort())` uses a global property whitelist, including when it visits nested objects. Nested fields such as `jarCount` and `jarSizeGrams` are omitted because they are not root keys. The upload sends the original metadata object as `pinataContent`, rather than the exact bytes hashed by this function.

Changing a sample nested jar count from 50 to 50,000 produced the same hash in a local reproduction. This does not require breaking SHA-256; the meaningful fields are excluded before hashing.

**Required improvement:** recursively canonicalize a versioned document, serialize once to UTF-8 bytes, hash those bytes, upload those exact bytes as a file, and verify raw retrieved bytes against the chain commitment. Treat a CID and an application hash as separate identifiers with explicit algorithms.

### A05 — Missing files and demo CIDs can pass integrity verification

**High; source-confirmed.** Evidence: `src/lib/ipfs.ts:201–215`.

Empty or selected demo CID patterns return `valid: true`. Gateway failures also return `valid: true` with `networkError`. A network outage should be an unavailable check, not positive evidence of integrity.

**Required improvement:** return `MATCH`, `MISMATCH`, `UNAVAILABLE`, or `SIMULATED`; require `MATCH` for a positive evidence badge. Keep recall warnings visible even when other checks are unavailable.

### A06 — Jar authentication is optional in the consumer route

**High; source-confirmed.** Evidence: `src/app/verify/page.tsx:44–45`, `:76–163`; `src/app/verify/verify-client.tsx:318–322`.

The page calls `processQRScan` only if both nonce and signature are present and the signature is not the special demo string. A batch-only URL or partial payload bypasses token validation. A fixed absent demo batch is rendered with constructed chain data and positive integrity. A batch information page is useful, but it must not imply a jar was authenticated.

**Required improvement:** distinguish batch lookup from serialized jar verification. Require a complete signed payload, matching token/batch binding, active token, and confirmed packaging evidence for the latter. Remove special-string bypasses from the real verification route.

### A07 — Actor attribution on-chain is the server relayer

**High; source-confirmed.** Evidence: `src/lib/blockchain.ts:102–129`, `:176`, `:202`; `scripts/deploy.js` role grants; `contracts/HoneyChain.sol:177`.

The contract uses `msg.sender` for the originating beekeeper and lab. The application sends all operations with one configured wallet, while PostgreSQL stores different farmer/custodian/lab wallet addresses. These records do not prove that those actors authorized the action. The admin relayer can also override custody.

**Required improvement:** choose and disclose a trust model. Minimum honest MVP: platform-attested provenance with a documented central operator. Stronger design: enrolled independent lab/processor keys, actor-signed typed operations with nonces/deadlines, and a relayer that pays gas without becoming the attesting actor. Keep a WhatsApp-assisted cooperative attestation clearly distinct from a farmer-held signature.

### A08 — Blockchain failure still advances authoritative database state

**High; source-confirmed.** Evidence: certificate, custody, packaging, recall route handlers; batch create uses a separate `PENDING_CHAIN` status.

Certificate upload sets `lab_verified=true`, custody changes custodian/stage, and packaging sets `PACKAGED` even when the chain call fails. No durable retry/reconciliation worker was found. A confirmed chain transaction followed by a database failure can cause the reverse disagreement.

**Required improvement:** persist an operation/outbox record with idempotency key, then submit and reconcile chain events. Separate business lifecycle from evidence submission state. Record transaction hash, receipt block/hash, event identity, and confirmation policy. A pending operation must stay visibly pending.

**Recall exception:** retain immediate local safety blocking when recall submission fails, but label it `LOCAL_RECALL / CHAIN_PENDING`; queue the on-chain action and preserve its reason. Never weaken the warning to wait for chain availability.

### A09 — Lifecycle transitions can skip required business steps

**High; locally reproduced.** Evidence: `contracts/HoneyChain.sol:220–241`.

Custody accepts any nonzero recipient and any nondecreasing status except `Recalled`. The recipient does not need the role appropriate to the destination. A fresh batch was transferred directly to status 7 (`Sold`) to an address without retailer role in the local test. Selecting `LabVerified` or `Packaged` as a transfer status also does not execute the respective evidence-creating operation.

**Required improvement:** enforce explicit allowed transitions, actor/recipient role checks, required attestation prerequisites, and two-party handover acceptance. Keep laboratory approval as an independent evidence dimension instead of an interchangeable numeric custody stage.

### A10 — Packaging can repeat and does not enforce lab approval

**High; locally reproduced.** Evidence: `contracts/HoneyChain.sol:259–279`; packaging API.

The contract rejects packaging only when the current status equals `Packaged`. A processor can package, move to distribution, and package again, resetting the status. There is no cumulative packaged mass accounting and no `labVerified` requirement. The local reproduction packaged 25 kg twice using the same 25 kg batch and no lab approval. The endpoint also lacks ownership and lab approval checks; UI filtering is not enforcement.

**Required improvement:** store a separate immutable packaging run or cumulative consumed mass, require approved evidence, require the current authorized processor, reject zero counts/sizes, and preserve monotonic lifecycle state. Add loss/remainder accounting. Treat any intended rework/repack operation as an explicit event that revokes or accounts for previous serials.

### A11 — QR issuance is disconnected from approved packaging quantity

**High; source-confirmed.** Evidence: `src/app/api/qr/route.ts`; `src/lib/qr.ts:generateQRTokensForBatch`.

An admin or processor can choose arbitrary jar count and size for any batch with DB status `PACKAGED`. The route does not bind issuance to a confirmed packaging run or ensure this processor holds the batch. Regeneration deactivates all old tokens and issues new ones without an atomic inventory transaction. Already printed legitimate labels may stop working.

**Required improvement:** persist packaging quantity and unique serial range first; issue exactly that committed run; require owner scope; use idempotent creation and an explicit audited reprint policy. Consider a Merkle root for many serials only after the basic inventory is correct.

### A12 — Public token listing gives away reusable signed jar credentials

**High; source-confirmed.** Evidence: `GET src/app/api/qr/route.ts`.

The unauthenticated endpoint returns full QR token rows, including nonce and signature. Anyone with the batch code can reconstruct active signed links and print copies. HMAC protects payload modification; a valid static QR can still be copied even after this endpoint is protected.

**Required improvement:** make label export private to the entitled packaging organisation; return only non-sensitive counts/status publicly. Combine serials with tamper-evident seals and cautiously worded scan anomaly warnings. A QR alone cannot prove the physical jar contains the tested honey.

### A13 — Resource ownership is not consistently enforced

**High; source-confirmed.** Evidence: batch creation accepts arbitrary `beekeeperId`; package/QR mutations check role without ownership; dashboard IoT/health `where` can become `undefined`; batch detail includes the full beekeeper record; analytics/recall/lab pages lack their own role checks.

The proxy checks a dashboard session and navigation hides some links, but direct URLs remain available to signed-in roles. Some APIs deliberately expose provenance publicly but use broad database-shaped responses, including internal alerts or identifiers. The IoT API returns hive details and readings without ownership checks.

**Required improvement:** centralize data access around actor, organisation, role, and ownership; deny missing memberships by default. Define a deliberately small public provenance response. Enforce authorization before the Prisma query on pages and APIs, not just on controls or navigation.

### A14 — IoT trust uses a shared credential and device pairing can reassign ownership

**High; source-confirmed; deployment impact conditional.** Evidence: `src/app/api/sensor-data/route.ts`; `src/app/dashboard/iot/simulator-modal.tsx:31`; `src/lib/whatsapp/handler.ts:615–622`.

The ingestion route uses one global secret with a known fallback; the browser simulator embeds that fallback. The submitted `deviceId` field is required but ignored in favor of `hiveId`. Anyone with the shared credential can target registered device identifiers. Pairing uses an upsert that can replace an existing hive's owner based only on its identifier.

**Required improvement:** use per-device enrollment credentials, a one-time ownership claim challenge, signed samples with sequence/timestamp/replay protection, revocation, and explicit transfer. Keep simulator traffic in a separate authenticated demo route with a `SIMULATED` source flag.

### A15 — Known fallback secrets and coupled wallet derivation

**High; source-confirmed; exploitability depends on configuration.** Evidence: `src/lib/auth.ts:9–13`; `src/app/api/auth/login/route.ts:28`; `src/lib/whatsapp/handler.ts:472`; `src/lib/env.ts`.

JWT and identity derivation have hardcoded fallbacks. Custodial wallet keys derive from a common application secret and phone/email identifiers; a compromise of that secret exposes all derivable keys. Different phone formatting produces different keys, and rotating the shared secret changes derived identities. The example's Hardhat key is a public development fixture, not evidence of a leaked funded account.

**Required improvement:** fail closed on missing production signing secrets, isolate JWT/WhatsApp/QR/key-management secrets, canonicalize identity once, and use KMS/HSM-backed or independently held keys with recovery and rotation. Do not present deterministic derived addresses as independent wallet ownership.

### A16 — Client-reported scan geography can rewrite other scans

**High; source-confirmed.** Evidence: `src/app/api/qr/sync-geo/route.ts`.

Any caller with a nonce can update the latest scan for that token without a scan-bound authorization token or HMAC verification. The caller can provide arbitrary city/country/coordinates. Concurrent scanners may overwrite each other's latest record and generate or suppress alerts.

**Required improvement:** return an opaque short-lived scan receipt after a validated scan; bind enrichment to that exact record, validate payloads, and mark location provenance/confidence. Keep user-reported and proxy-derived evidence separately. Neither should automatically prove counterfeiting or trigger a safety recall.

## 5. Medium and lower-priority findings

### A17 — Public chain reads do not distinguish missing batches

**Medium; locally reproduced.** Evidence: `contracts/HoneyChain.sol:310–327`; `src/lib/blockchain.ts:294–319`.

The contract returns a zero-valued struct for a missing mapping key; the adapter returns it as a record without checking `createdAt` or `batchExists`, despite its comment promising null for absent batches. Add an explicit existence check and return `NOT_REGISTERED`, distinct from RPC failure or a real created record.

### A18 — Lab evidence proves neither sampling nor accreditation

**Medium; source-confirmed design gap.** Evidence: certificate schema/API, `verifyLab`, `src/app/verify/verify-client.tsx:487`.

A PDF hash is committed, but no sample identity/seal, sample handover, test method, measured result/pass-fail policy, certificate validity, accreditation evidence, or independent lab signature is modeled. The consumer UI uses a certified-lab purity label based on a database boolean. It does not hash fetched PDF bytes against the committed lab report hash.

Model these fields and make lab identity/credential review explicit. Only show what has actually been checked. A transaction hash proves a commitment, not chemical purity, accredited status, or sample-to-jar continuity.

### A19 — Webhook acknowledgement and deduplication can lose work

**Medium; source-confirmed.** Evidence: webhook `void handleIncomingMessage`, handler reads only `messages[0]`, FSM marks dedup keys before completion.

Processing is detached from the response without a durable queue. Process termination can lose acknowledged work; processing failure can leave a message marked as seen; additional messages/entries are ignored. Memory fallback does not survive restarts and does not synchronize replicas.

Verify signature, durably enqueue every message, acknowledge accepted intake, and track processing status with retries/dead letters and idempotent business operation IDs. Serialize mutations per conversation to avoid conflicting FSM updates.

### A20 — Amount parsing loses units and decimals

**Medium; source-confirmed.** Evidence: `src/lib/whatsapp/handler.ts:642`.

`parseInt(text.replace(/[^0-9]/g, ''), 10)` treats `25 kg` as 25 grams and `2.5 kg` as 25 grams. Parse explicit units and decimals with bounds; show normalized grams/kg in the confirmation and require unambiguous acknowledgement. Use the same validated domain service for web and WhatsApp creation.

### A21 — Inference endpoint permits unauthenticated compute and oversized input

**Medium; source-confirmed.** Evidence: `src/app/api/detect/varroa/route.ts`.

Inference runs before session retrieval, accepts multipart or base64 input with no explicit image size/dimension/type bound, and can persist unowned inference results. A no-detections result is assigned a default confidence of 0.95. The external model's accuracy was not verified.

Authenticate or apply a strict public quota before inference, validate bytes/dimensions, check response schema and timeout, use `INCONCLUSIVE` for unusable/no-bee images, and report evaluated model performance only on a labeled held-out dataset. Keep insect-image assessment separate from honey purity.

### A22 — Sensor heuristics can produce unwarranted healthy evidence

**Medium; source-confirmed.** Evidence: sensor route substitutes temperature 35, humidity 55, weight 40 when absent; `iot-health-model.ts` compares weight without elapsed time.

Missing readings can appear healthy. Rapid weight loss interpretation ignores measurement interval, harvesting, weather, and calibration. This is a rule-based score, not a validated predictive model. Require freshness/completeness, show unavailable inputs, normalize trend by time, and label recommendations as indicative. Keep raw high-volume telemetry off-chain and anchor summaries only where useful.

### A23 — Geographic anomaly certainty and counts are overstated

**Medium; source-confirmed.** Evidence: `src/lib/anti-clone.ts`; verify page takes only five scans.

Cross-country checks assign a fixed 8,000 km distance. High-volume detection counts all history despite a declared one-hour window. VPNs, mobile routing, shared links, bots, and repeated consumer checks can look suspicious. Verification UI calls the length of the latest-five list a total and its oldest entry a first scan.

Use real count/first/latest queries, measured time windows, confidence-aware distance or unknown distance, deduplication, and 'possible copied label' wording. Evaluate false positives; require human review for escalation.

### A24 — Custody status clamping disagrees with the stored event

**Medium; source-confirmed.** Evidence: `src/app/api/custody/route.ts` uses `Math.max` for the contract but persists the original requested string.

A backward requested status can leave on-chain state unchanged while recording an earlier stage in PostgreSQL. Validate legal transitions once, reject invalid requests, and project the actual emitted event. Do not silently adjust one side of a dual write.

### A25 — Build and release cannot depend on developer artifacts

**Medium; source-confirmed packaging gap; clean container not executed.** Evidence: runtime `require` of ignored `artifacts/.../HoneyChain.json`; Dockerfile never runs `compile:chain`; address manifest read from working directory; standalone output.

A successful build in a checkout containing cached Hardhat artifacts does not prove a fresh image will include a current ABI and manifest. Compile/export a versioned minimal ABI in the build pipeline; explicitly include manifest/assets and verify `eth_chainId`, deployed bytecode, role wiring, and schema at readiness. Test a clean container before claiming reproducible deployment.

### A26 — Deployment and seed scripts have unsafe defaults for real data

**Medium; source-confirmed.** Evidence: `final-deploy.js`, `infrastructure/aws-deploy.js`, `scripts/seed-complete-demo.js`.

Deployment archives/user data can include `.env`; final deployment uses `prisma db push --accept-data-loss`; boot scripts reference absent `seed.js`; demo seed deletes domain tables and performs Redis `FLUSHALL`; infrastructure opens SSH globally. `.gitignore` does not prevent tar/docker build context inclusion, and no `.dockerignore` was present.

Use explicit archive allowlists and `.dockerignore`, runtime secret retrieval through instance identity, versioned migrations/backups, least-privilege network access, and demo-only seeds guarded by database/environment checks. Never run the existing seed on a shared or production database. No seed, deployment, deletion, or cloud write was executed during this audit.

### A27 — Rate limits and gas spending lack durable coordination

**Medium; source-confirmed.** Evidence: proxy memory map and forwarded-IP handling; singleton ethers wallet; QR generation loop; inference API.

Memory limits reset on restart and are not shared across instances. Forwarded headers need an established trusted-proxy boundary. Concurrent transaction submissions need nonce coordination, operation idempotency, bounded retries, and spending limits. QR export can still create up to 10,000 DB rows and a large response per request despite chunked image generation.

Add Redis/edge quotas by actor/device/IP, bounded jobs, signer nonce coordination, fee/balance alerts, timeouts, and retry policies. A public health endpoint should return only safe readiness fields, not raw configuration errors.

### A28 — Privacy commitments are not fully implemented

**Medium; source-confirmed.** Evidence: schema comments, full beekeeper include in dashboard detail, public hive/read APIs, Gemini request URL, query logging, verification client third-party geolocation.

The schema describes coordinate encryption but no corresponding encryption path was found. Runtime query logging is enabled, WhatsApp logs identifiers/transcribed text, and full fetch-URL logging plus a Gemini key in its URL is a potential log-exposure path. The verification page calls external IP-location services. Raw IP is deliberately not persisted in QR scans, which is a useful existing protection.

Define public/private fields, consent, retention, redacted logs, and secret-safe observability. Avoid claiming encryption or privacy guarantees based on comments. Use synthetic data in submissions; assess applicable privacy requirements with appropriate advice before a real deployment.

### A29 — Product claims exceed repository evidence

**Medium; documentation/source comparison.** Evidence: README and existing `DOCUMENTATION.md` versus implementation.

Claims include ERC-721 minting, uncloneable/time-varying QR behavior, live market rates, hardware mesh/MQTT/acoustic intelligence, independent lab-wallet validation, and some named AI models. The contract is a registry; QR payloads are static HMACs without a time field; market/subsidy text is hardcoded; the Gemini model list differs from the headline; hardware and model evaluation are not supplied.

Keep an 'implemented / integrated but unvalidated / simulated / planned' disclosure for every pitch claim. Verify any agricultural guidance or subsidy/rate statements against current primary sources before publishing. No fixed subsidy percentage, market price, income uplift, purity accuracy, or regulatory compliance is established by this audit.

### A30 — Quality gates and recovery coverage are incomplete

**Medium; repository inventory and executed checks.** Evidence: `test/HoneyChain.test.js`, package scripts, no checked-in CI workflow/migration directory found in reviewed paths.

The existing 23 tests pass, but miss the reproduced business-invariant failures and API integration/recovery. TypeScript passed; baseline lint/build results are in the validation register. Passing happy-path tests is insufficient evidence of secure identity, event reconciliation, correct evidence rendering, or a clean deployment.

Add focused invariant, authorization, storage-integrity, pending-state, concurrency, recall, and restore tests before broader features. Add a CI release gate; do not hide existing lint findings by disabling rules globally.

### A31 — Hash and status conventions conflict in comments

**Low; source-confirmed.** Evidence: schema and Solidity comments call the batch key SHA-256, while `hashBatchCode` and tests use `ethers.id` (Keccak-256). Creation stores Solidity `Created` but database `HARVESTED` after a successful transaction.

Define versioned identifier, evidence-hash, and lifecycle specifications. Preserve existing identifiers during migration rather than silently rehashing them. Separate registration from harvest confirmation or map their semantics explicitly.

## 6. API coverage register

All 20 route files were reviewed. Public and private boundaries below describe what needs attention, not an endorsement of current behavior.

- `/api/auth/login`: POST authenticates insufficiently; DELETE clears cookie. A01/A15.
- `/api/auth/logout`: POST/GET clears cookie; forwarded host/proto should be trusted/canonical; GET has a state-changing side effect.
- `/api/batch`: POST role/API-key gated but missing beekeeper ownership; GET public listing returns broad records. A08/A13.
- `/api/batch/[batchCode]`: GET public record/chain read and partial discrepancy check; minimize public fields. A13/A17.
- `/api/batch/[batchCode]/package`: POST role gated; missing ownership, lab/state/cumulative enforcement; chain failure still updates DB. A08/A10.
- `/api/batch/[batchCode]/recall`: POST admin/API-key gated; local safety blocking is useful but chain pending/retry and reason provenance need persistence. A08.
- `/api/certificate`: POST lab/admin/API-key gated; identity/evidence validation and confirmation semantics incomplete. A07/A08/A18.
- `/api/custody`: POST ownership paths include demo fallback and divergent state handling; GET public history. A02/A09/A24.
- `/api/custody/transfer`: POST returns 410; deprecated, does not perform transfer.
- `/api/qr`: POST role gated; issuance and ownership gaps; GET exposes token signatures. A11/A12.
- `/api/qr/generate`: POST returns 410; deprecated.
- `/api/qr/verify`: POST returns 410; actual verification lives in `/verify`. A06.
- `/api/qr/sync-geo`: POST public latest-scan mutation; bind to a validated scan receipt. A16.
- `/api/ipfs`: POST session-role gated; arbitrary JSON upload needs ownership/schema/quota/timeout and safe error responses.
- `/api/sensor-data`: POST global shared secret; per-device identity/replay gaps. A14/A22.
- `/api/iot/[hiveId]`: GET public hive/readings; scope private telemetry, bound query result size. A13/A28.
- `/api/detect/varroa`: POST invokes Lambda before authentication, without explicit image bounds. A21.
- `/api/alerts/[alertId]/resolve`: POST requires admin; preserve an auditable actor and resolution reason. Current login undermines the role check. A01.
- `/api/blockchain/status`: GET checks balance but not sufficient chain/code/role readiness; safe errors and timeouts needed. A17/A25/A27.
- `/api/webhook/whatsapp`: GET token challenge and POST timing-safe HMAC are useful controls; queue, multi-message, and idempotency gaps remain. A19.

## 7. Existing strengths to retain

- A domain-specific supply-chain workflow, not merely a wallet-connect screen.
- OpenZeppelin role/pause primitives, duplicate batch prevention, nonzero harvest quantity, recall flag checks, and event emission.
- Recall remains callable while paused: preserve this useful emergency property explicitly.
- HMAC webhook verification, timing-safe QR signatures, HttpOnly/SameSite session cookie flags, input validation in several APIs, and no raw IP storage for scan records.
- Separation between database, storage, and chain libraries; local contract development and 23 regression tests.
- Farmer-facing voice/text access and a consumer QR workflow that can be retained while fixing evidence semantics.

## 8. Audit limits

This is an engineering source audit with local checks, not a formal smart-contract audit or penetration test. No deployed application URL was supplied; the provided website is the competition site. No mainnet/testnet write, live authentication attack, AWS action, WhatsApp send, database seed, production DB query, hardware test, lab validation, or paid inference was performed. Current Amoy bytecode and real actor-role configuration were not verified. Dependencies were read from installed/project metadata; a current vulnerability-advisory scan was not completed. See the validation register for actual test outputs and build limitations.
