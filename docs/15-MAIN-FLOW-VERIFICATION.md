# Web, WhatsApp and blockchain verification

Updated 21 October 2026. Historical checklist for the broader live-integration scope. On 22 October the user excluded public deployment and IoT; [final local integration](20-FINAL-LOCAL-INTEGRATION.md) is now the active checklist. Green checks below apply only to their stated scope.

**Actual main configuration:** `.env` selects Amoy. Its configured registry did **not** establish a verified registry-v2 context; the read call returned `CALL_EXCEPTION`. See `qa/main-active-chain-check.json`. The successful local suites use `.env.integration` and do not prove that the main Amoy configuration works. Do not silently switch the main environment or claim public-chain acceptance. Resolve the deployment/configuration mismatch before a live-network demonstration.

## Verified in this checkpoint

- [x] 32 contract tests: roles, lifecycle, separate gas relayer, actor signatures, nonce/replay/domain checks, lab approval, permanent packaging limits and recall.
- [x] 10 PostgreSQL/local-EVM integration tests: complete harvest → lab → packaging/serialized labels → retail → recall, plus restart, duplicate, concurrent-worker and receipt recovery cases.
- [x] 65 application tests, including five new WhatsApp conversation/client checks.
- [x] One additional integration test connects the actual WhatsApp handler to the actual batch API code, PostgreSQL intent and wallet-approved local EVM registration. It checks 2.5 kg becomes 2,500 grams, pending state before approval, approval link, duplicate confirmation, confirmed database/contract state and a zero-gas actor wallet. Session/message transport and IPFS pinning are mocked; this is not a live phone or HTTP-browser test.
- [x] TypeScript check passed. Targeted lint passed with zero errors/warnings across seven changed source/test/setup files.
- [x] Real read-only Meta request returned HTTP 200, matching phone identity and reported Graph API version v26.0. See `qa/whatsapp-provider-check.json`. The client now uses this configurable version rather than a hard-coded v20 endpoint.
- [x] Corrected harvest routing: data-entry states precede global menu heuristics, so honey names and quantities cannot be diverted into market advice. Data entry does not invoke intent AI for every answer. Existing conversation language is preserved.
- [x] Corrected explicit confirmation, strict registration counts, bounded name/region/type fields and processing of every message across webhook entries/changes.
- [x] Provider request timeouts distinguish explicit rejection from unknown delivery outcome; provider response bodies are not exposed as errors. Local demo setup now supplies its missing private service key without changing the main `.env`.

These final suites total 108 tests. Earlier intermediate failures were test-fixture issues (phone length, module interop and an incorrect assertion field), corrected before the final pass. Production build and browser acceptance are not implied by these results.

## Live WhatsApp status

The user authorized a test to the number ending 1014. One `hello_world` template attempt ended without a captured provider response/message ID. Its outcome is **unknown**, not proven rejected or delivered. The user cannot check the phone yet. No automatic resend was made. See `qa/whatsapp-authorized-send.json`.

A working token/phone configuration does not prove inbound subscription, current-build callback routing, recipient eligibility or delivered/read status. Live two-way acceptance remains open.

The later read-only Meta inspection confirms a valid token and active app-level `messages` subscription. Its registered callback origin differs from the main environment; WABA-level subscription and the endpoint serving this build remain unverified. Automatic approval review rejected verification-token egress for a callback challenge, which was not performed. See document 16 and `qa/meta-subscription-check.json`.

## Actual HTTP and IPFS checkpoint

The current production standalone app passed the core workflow over real localhost HTTP: six-role password login, role boundaries, pending/actor-approved harvest, idempotency, processor/lab custody, real IPFS report/metadata, packaging limits, stable label reprints, distribution/retail and immediate/confirmed recall. A separate signed-webhook HTTP rehearsal connected the compiled WhatsApp worker to the real batch HTTP API and local actor-approved EVM registration. Only Meta sending and translation were mocked in that second rehearsal. Redis loss returned HTTP 503 for readiness/login without a session cookie, and restoration recovered HTTP 200.

An independent actual IPFS upload/retrieval matched both exact bytes and SHA-256. These results are recorded in `qa/main-http-acceptance.json`, `qa/whatsapp-http-acceptance.json`, `qa/live-ipfs-roundtrip.json` and `qa/http-redis-failure-recovery.json`. See [document 17](17-HTTP-REHEARSAL-AND-AMOY-HANDOFF.md) for repeatable commands and the presentation flow. Browser access was rejected by the browser security URL gate; HTTP response checks do not establish visual or external-wallet acceptance.

## Durable WhatsApp checkpoint

The implementation now stores supported inbound events before acknowledging the webhook. PostgreSQL sessions, per-sender ordering, transactional replies, interrupted-work recovery, individual send-attempt history, delivery receipts and administrator review are implemented. Unknown send outcomes are held for review rather than automatically resent. The worker requires explicit deployment activation; writing the code does not activate the public callback.

Fresh verification after these changes: **22 application/webhook/admin/readiness/deployment tests, 12 real-PostgreSQL durability tests and one handler/API/PostgreSQL/local-EVM integration test passed**. The last test now also interrupts processing after the batch API saved its intent, then verifies recovery reuses that intent and finishes actor-approved registration. Provider transport, translation and IPFS remain mocked in this fixture. These 35 checks overlap the earlier checkpoint; do not add their counts to 108.

TypeScript, compiled workers and the Windows webpack production standalone build passed. Targeted lint covered 27 files with zero errors or warnings. The standalone postbuild check removed copied environment data. Container images have not been rebuilt for this checkpoint, and deployment acceptance remains open. See [document 16](16-WHATSAPP-DELIVERY-RUNBOOK.md) for migrations, worker activation and operator review, and `qa/main-flow-checkpoint-2.json` for the evidence record.

## Remaining gates, in order

Latest completion audit, 22 October 2026: verified implementation source hashes still match `qa/onboarding-checkpoint.json`. Local contract, backend, durable WhatsApp and HTTP evidence pass within their stated fixture scopes. The full live objective remains incomplete. See [document 19](19-METAMASK-DEPLOYMENT-AND-NEXT-STEPS.md) for setup and evidence.

1. **Supply role addresses and complete public deployment.** Administrator `0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607` is confirmed; administrator signing stays in MetaMask. Public addresses for the separate relayer, beekeeper, lab, processor, distributor and retailer are still unconfigured. The current main Amoy address has deployed code but its v2/forwarder reads fail. Refresh transaction review/gas quotes after the six addresses are supplied, then obtain the user's actual wallet signatures. `qa/amoy-deployment-readiness.json` and `qa/main-chain-diagnosis.json` now contain the refreshed post-selection read-only checks. No public broadcast has occurred.
2. **Activate the intended backend and workers.** Export and recheck the verified deployment manifest, select the release/origin and configure/fund the separate relayer securely outside chat. Apply intended database migrations and preserve deployment identity. Matching `onboarding-review` images and local restricted-role/startup checks pass; those results do not activate the public service. Provision real actor accounts; an unbound farmer can use trusted `--enroll-beekeeper` provisioning only after its chain role exists.
3. **Complete a live WhatsApp round trip.** Confirm the intended HTTPS callback and WABA subscription serving this build, activate durable processing, then test a real incoming harvest through its web approval link and chain receipt. The prior authorized send remains UNKNOWN because the recipient cannot check it; no automatic resend. The callback challenge was not executed after automatic approval rejected verification-token egress. Destination-specific authorization is still needed before that challenge or a public callback change.
4. **Complete browser and wallet acceptance.** Inspect mobile/desktop and light/dark behavior; exercise actual MetaMask approval, rejection and account/network switching through permitted browser access. The safe login-return path passes actual HTTP checks, but client navigation and visual inspection are still unverified. The earlier browser security URL gate rejection has not been bypassed.
5. **Rehearse and capture the final presentation.** Document 17 supplies the seven-minute sequence and the draft deck describes the prototype honestly. Capture permitted actual browser/wallet screens after the live checks. Institution/team, official template and real field evidence remain pending for submission; fieldwork has not started. Keep synthetic fixtures labelled. IoT remains deferred to the teammate.

The current production dependency audit is zero known advisories; 29 development-tool advisories remain tracked for a deliberate compatibility migration. That toolchain work must not be presented as completed or confused with live integration acceptance. No currently failing local workflow check is being hidden by the live blockers.

## Presentation sequence

Use synthetic records and named local demo accounts. The isolated setup is in [document 09](09-OPERATIONS-AND-LOCAL-INTEGRATION.md). Refresh fixture deployment after restarting an ephemeral chain; old receipt hashes do not establish confirmation on a new genesis. Demo passwords remain in ignored `.local-data/local-demo-accounts.json` and must not appear in slides or recordings.

1. Show the landing journey briefly, then sign in as the beekeeper. Explain that actor accounts approve their own business actions; a separate relayer pays gas.
2. Start **Log Harvest** in WhatsApp. Enter the honey type and an explicit quantity, such as 2.5 kg. Confirm the displayed 2,500-gram request. For local rehearsal, use the automated WhatsApp fixture and identify it as mocked transport until the real callback is verified.
3. Open the saved approval link in the beekeeper's authenticated web account. Show **pending signature/confirmation** before approval, then the confirmed receipt and batch. Chat registration alone must not create a wallet or claim chain confirmation.
4. Transfer to the processor, then to the independent lab. As the lab actor, upload the report and approve its exact-byte commitment. Return custody to the processor. Missing or failed evidence must stay unavailable.
5. Package within the harvested quantity. Generate serialized jar labels and reprint one: its serial/token must stay the same. Demonstrate rejection of an excessive packaging request if useful.
6. Open a jar's consumer QR record. Show source/actor attestations and evidence status. Explain that a blockchain record does not prove physical honey purity or prevent physical copying of a label.
7. As administrator, request a recall. Show immediate local withdrawal separately from the actor-approved chain recall, then reopen the same jar record to show recall visibility.

Do not insert IoT hardware or disease/yield accuracy claims into this core demonstration. Those remain separate work.


## MetaMask deployment checkpoint - 22 October

The administrator page, seven transaction review/recovery flow, database migration and manifest export are implemented. Seven wallet/API unit tests, five PostgreSQL/local-EVM deployment tests and five readiness tests pass. The actual development HTTP rehearsal confirms authenticated routes, both deployments and all five grants with two confirmations and manifest export; see `qa/wallet-deployment-http.json`. TypeScript, compiled workers, targeted lint and the Windows webpack production standalone build pass. These fixtures do not establish visual, MetaMask, public-chain or fresh Linux container acceptance. See [document 19](19-METAMASK-DEPLOYMENT-AND-NEXT-STEPS.md) for the concrete remaining steps.


Failure-path follow-up: canonical-block validation now fences prior deployment receipts and explicit retries. Seven real PostgreSQL/EVM deployment tests, seven wallet/API tests, twelve WhatsApp conversation/webhook/review tests, thirteen durable PostgreSQL WhatsApp tests and four read-only inspector tests pass. Counts overlap preceding checkpoints. The refreshed Amoy inspector recognizes the confirmed public administrator and MetaMask signing; six real addresses are still absent. Gateway/server failures are held as UNKNOWN rather than labelled rejected. See document 19 and `qa/amoy-deployment-readiness.json`.


Final patched release follow-up: all three `wallet-flow-review` Linux images build. The new deployment migration, restricted application-role writes/locks and real Linux release HTTP login/deployment-page/outage checks pass. The production dependency audit is zero after the redirect patch and two credential-stripping regressions pass; the development toolchain still has 59 reported advisories for a separate compatibility review. Temporary QA resources were stopped and the synthetic administrator revoked. See document 19 and `qa/wallet-release-checkpoint.json`.


Final patched preview: the complete core HTTP lifecycle passed 19 recorded checks with real IPFS, and signed-webhook-to-wallet-approved-local-chain HTTP acceptance passed all seven recorded steps with mocked Meta/translation and real IPFS. Both evidence files were refreshed after the redirect patch. Port 3100 remains the local synthetic preview; public activation is not implied.


Onboarding follow-up: trusted `--enroll-beekeeper` provisioning closes the null-wallet-to-login gap with chain-role verification, conflict checks and a serializable database transaction. Seven local enrollment checks and the strengthened enrolled-farmer WhatsApp integration pass. Approval links now retain a bounded internal destination through sign-in, with five focused return-path checks. Unused toolbox dependencies were removed: full audit 59 -> 29, with unchanged Solidity 0.8.26 bytecode/ABI and 32 passing contract tests. See document 19 for current scopes; fresh builds after these changes are tracked separately.


Final onboarding acceptance: Windows and matching Linux builds pass; clean Linux compilation exactly matches the saved Windows contract bytecode/ABI. Native production core (19 steps), signed WhatsApp-to-local-chain HTTP (7 steps), safe login-return HTTP and Linux release authentication/outage checks pass within their fixture scopes. The application suite has 71 passing checks. Temporary QA resources are stopped and port 3100 is healthy. The final read-only main check still fails registry-v2 compatibility, with six role addresses and relayer signing unconfigured. See document 19 and `qa/onboarding-checkpoint.json`; no public/phone/browser completion is claimed.
