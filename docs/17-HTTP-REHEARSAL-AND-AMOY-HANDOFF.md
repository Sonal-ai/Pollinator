# HTTP rehearsal and Amoy handoff

Updated 21 October 2026. IoT is outside this rehearsal and remains the teammate's work.

## What now works together

The current Windows production standalone build passed the actual HTTP lifecycle on dedicated localhost PostgreSQL, Redis and EVM fixtures. Six roles signed in with generated passwords and secure HttpOnly cookies. The rehearsal covered pending harvest authorization, idempotency/conflict handling, wrong-role denial, actor-signed approval, processor/lab custody, a synthetic PDF commitment, packaging quantity limits, stable label reprints, distribution, retail, and recall. IPFS uploads and evidence retrieval were real. The consumer response contained matching-evidence text before recall and recall text afterward. This verifies server responses, not rendered browser behavior.

The 25,000-gram batch was packaged as ten 2,500-gram jars. An eleven-jar request was rejected. Recall disabled labels immediately before actor approval; the local chain recall was subsequently confirmed. The rehearsal batch `HC-2026-LOCA-ECB8DD` is now recalled. Operation IDs and transaction hashes are recorded in `qa/main-http-acceptance.json`. Preserve this local node if those receipts are needed; restarting an ephemeral chain can invalidate their context.

A second rehearsal exercised the actual signed webhook HTTP endpoint and compiled durable WhatsApp worker. Four synthetic incoming events recorded a 2.5 kg harvest, and repeated deliveries did not create duplicate inbox records. The worker called the real batch HTTP API, saved the approval link, reconciled signed synthetic READ callbacks, and completed HTTP actor authorization and local-chain registration. That batch is `HC-2026-LOCA-6A8FDF`. Provider sending and translation were mocked; IPFS and the HTTP/database/contract path were real. This does not prove actual phone delivery or Meta callback subscription. See `qa/whatsapp-http-acceptance.json`.

The real IPFS round trip independently retrieved exactly the uploaded bytes and SHA-256 commitment. See `qa/live-ipfs-roundtrip.json`. All uploaded records were synthetic and contain no field interviews, beneficiary details or real laboratory result.

The owned Redis fixture was stopped and restored deliberately: readiness and login returned HTTP 503 without issuing a login cookie during the outage, then both returned HTTP 200 after recovery. See `qa/http-redis-failure-recovery.json`.

## Repeat the software rehearsal

Use the dedicated fixtures described in [document 09](09-OPERATIONS-AND-LOCAL-INTEGRATION.md). Keep generated accounts and passwords private. The scripts refuse a database or chain outside the named localhost integration environment. They upload small synthetic evidence records to the configured IPFS account. They do not send WhatsApp messages or public-chain transactions.

1. Prepare the integration database, local registry/forwarder, demo accounts and password-protected Redis. The demo setup now explicitly pins `APP_ORIGIN` to `http://127.0.0.1:3100`; this prevents an earlier build's public `NEXT_PUBLIC_APP_URL` from becoming the local runtime origin.
2. Build using `npm run build:workers` and `npm run build -- --webpack`. Start the standalone app using `node scripts/with-integration-env.cjs scripts/preview-standalone.cjs`. The chain and Redis fixtures must already be running. If port 3100 belongs to another process, inspect ownership first.
3. Run `npm run verify:http:local`, then `npm run verify:whatsapp:http:local`. Run them sequentially against otherwise idle test queues. The scripts drive the compiled chain worker explicitly and use unlocked, publicly known local fixture wallets. They do not prove an external browser wallet works. Never use these fixture wallets on a public network.
4. Inspect the two generated acceptance JSON files for `passed: true`. A failed script records the stage; do not treat a file from an earlier run as a fresh pass. Review partial synthetic work before rerunning.

The additional script lint check passed for the handoff scripts. The build and 35 focused checks from checkpoint 2 remain separately recorded; HTTP steps are not additional unit-test counts.

## Presentation sequence: about seven minutes

The live 12-slide content draft and `submission/SLIDE-CONTENT-DRAFT.json` now follow this core priority. Slides 1, 5, 6, 8, 9 and 11 were updated and visually checked, with source/limitations in speaker notes. The original slide structure remains. The draft is not the institution's official template, and no live screen rehearsal or field evidence is implied.

1. **Problem and boundaries, 45 seconds:** explain cooperative honey provenance and recall. The registry records attributable declarations and report commitments. Field validation, honey purity and market outcomes have not been established.
2. **Farmer request, one minute:** show a WhatsApp harvest draft of 2.5 kg and its approval link. Label any software-driven chat transport as simulated. Show the pending state before approval.
3. **Actor approval, one minute:** sign in as the enrolled beekeeper, inspect the operation, approve with that actor's wallet and show the confirmed transaction. A separate relayer pays gas. The current automated proof uses local fixture signing; external-wallet acceptance is still pending.
4. **Custody and laboratory, 90 seconds:** transfer to the processor, mark processed, then transfer to the lab. Upload an explicitly synthetic demonstration PDF, approve its commitment, and return custody to the processor. A synthetic PDF is not an independent real test result.
5. **Packaging and consumer, one minute:** package within the confirmed quantity, reprint a stable serial, then open the jar record and explain each evidence state. Use a fresh batch if showing the full live flow; the recorded HTTP rehearsal batch is already recalled.
6. **Recall, one minute:** show immediate local withdrawal, then actor-approved chain confirmation and the same consumer record's recall state.
7. **Evidence and next steps, 45 seconds:** identify what was verified locally, show the real IPFS round trip, and state the remaining public-chain, live phone, browser/wallet and fieldwork gates. Keep IoT out of the core demonstration.

No browser screenshots or visual acceptance are claimed. The browser security policy rejected access to the local tab, and no alternate browser or observation workaround was used. Complete visual/mobile/theme and external-wallet checks when the permitted browser path is available.

## Public Amoy handoff

The configured RPC really reports chain 80002. The configured registry address contains 13,407 bytes of deployed code, but `registryVersion()` and `trustedForwarder()` do not establish the required v2 interface. This does not identify its exact historical version. The new application must not assume that address is compatible. See `qa/main-chain-diagnosis.json`.

The main configuration has no valid deployment-administrator key, separate relayer key or five actor addresses. Public integration therefore cannot be completed by changing only the contract address. `npm run inspect:chain` and `npm run inspect:amoy` are read-only diagnostics; the second records a timestamped fee quote and missing setup items. Its fee quote is not an approved deployment cost.

Before a public write, choose user-controlled public addresses for the administrator, relayer, beekeeper, lab, processor, distributor and retailer. Each actor must have a distinct enrolled wallet; the relayer must have no administrator or operational role. Store signer secrets privately on the intended host, never in chat, documentation or a committed environment file. Fund the administrator and relayer with testnet currency.

Then prepare the fresh forwarder/registry deployment, actual gas estimates and role grants for review. Verify chain ID and RPC consistency, deploy only after approval of the concrete public-write plan, save the new addresses and genesis binding, and verify independent actor authorization and relayer receipts. Preserve the historical contract/database identity; do not claim old records became new actor-signed attestations. No deployment or broadcast has been performed in this handoff.

## Remaining acceptance gates

- Choose and configure the public Amoy signer/actor addresses, fund the relayer and approve a concrete deployment plan.
- Activate the matching web/WhatsApp worker and migrations on the intended deployment. Fresh container images, merged Compose and restricted-role QA migration/worker checks passed in [document 18](18-RELEASE-CONTAINER-CHECKPOINT.md); they do not activate a public deployment.
- Reconcile the one authorized WhatsApp test send, still UNKNOWN, and verify a real incoming harvest. The app-level Meta subscription is active, but the registered callback origin differs from the main environment. Confirm the intended endpoint and obtain destination-specific authorization before sending a verification-token challenge. WABA-level subscription remains unverified. The user cannot check delivery yet; do not blindly resend.
- Complete permitted browser, mobile/theme and external-wallet approval/rejection/account-switching checks, then rehearse the actual presentation screens.
- Supply verified team/institution and field evidence. Fieldwork has not started. IoT remains deferred.
