# Final local integration

Updated 22 October 2026. Current user scope: finish the core application locally, excluding public deployment and IoT. Public-network blockers in documents 15–19 and `qa/main-goal-completion-audit.json` belong to the previous, broader scope.

**Current result:** the revised local software integration and browser acceptance are complete. The user-requested fresh HTTP tab enabled testing after the old encoded error page was rejected. The core browser lifecycle has ten confirmed local-chain operations, and the final recall-copy rebuild passed browser inspection. The app and compiled local chain worker are running. Public deployment, IoT and external validation below remain excluded or explicitly unverified.

## Included flow

Password login → farmer harvest → actor approval → local blockchain receipt → processor custody and processing → independent lab PDF approval → packaging → serialized QR labels → distribution and retail → consumer evidence checks → recall.

The WhatsApp rehearsal accepts signed synthetic webhook events, persists and processes them through the durable worker, creates the portal's harvest approval, and confirms it on the local chain. Meta sending and translation are mocked. Actual phone delivery has not been established; the earlier authorized send remains UNKNOWN and has not been resent.

The local EVM, PostgreSQL, Redis and configured IPFS round trips are real. Accounts, harvests, reports and wallet signatures used in acceptance are synthetic. No field pilot or real laboratory result is claimed.

## Fixes in this completion pass

- Harvest, custody, laboratory and packaging forms describe preparation and approval accurately, removing premature minting/confirmation messages and unreachable success panels.
- The harvest form uses a native modal dialog, associated field labels, a named close button, keyboard dismissal while idle, focus restoration and bounded vertical scrolling.
- Laboratory and packaging fields have associated labels. The PDF control remains keyboard accessible. Empty/oversized PDFs are rejected before client hashing; independent API size and PDF-header validation remain.
- An empty lab queue describes the lack of assigned processed batches, without claiming all batches are verified.
- Removed the blank “sample NABL certificate” generator. Demo reports must be explicitly synthetic; no accreditation is implied.
- Removed unqualified tamper-proof / anti-clone packaging copy. Reprints preserve serials, but printed codes can be copied.
- Corrected the landing journey: farmers use enrolled signing wallets; the relayer pays gas.
- Added the administrator recall form directly to each unrecalled batch dossier. A safety issue can now trigger recall without requiring a pre-existing scan alert. The API and actor-approval requirements remain enforced.
- Dossier headings show the configured network. Recall lists and empty states distinguish local safety warnings from confirmed chain operations. The confirmed-operation copy no longer describes a confirmed recall as pending.
- Removed test-harness timestamp mutations that raced the background worker's signing guard. The production signing protocol was not weakened.

## Evidence and acceptance

Latest scope/results: [local acceptance record](qa/final-local-integration.json). Earlier backend, enrollment and toolchain results with source hashes: [onboarding checkpoint](qa/onboarding-checkpoint.json).

[Core HTTP acceptance](qa/main-http-acceptance.json) runs the lifecycle against the production standalone app and actual local services. [WhatsApp HTTP acceptance](qa/whatsapp-http-acceptance.json) covers the signed synthetic webhook-to-chain path. [Login return acceptance](qa/login-return-http.json) checks protected approval links. [Core view HTTP acceptance](qa/core-views-http.json) checks server-rendered pages and role restrictions.

HTTP checks do not execute client JavaScript or establish visual acceptance. Browser interactions, desktop/mobile layout, keyboard focus and themes must be recorded separately. A successful build is not proof of those checks.

This pass verified 71 application tests, 32 contract tests, 12 WhatsApp tests, 13 durable PostgreSQL WhatsApp tests, the 19-step HTTP lifecycle, 7-step WhatsApp HTTP rehearsal, 3 login-return checks and 48 server-rendered view/role checks. The last two prove that recall is available to an administrator without a scan alert and hidden from the beekeeper. Suites overlap; counts must not be summed as unique tests. The Windows production build, standalone sealing and TypeScript passed. Focused lint has zero errors; seven existing unused-code warnings remain in the dossier source. Existing Linux image checkpoints predate these final UI changes.

## Browser acceptance performed

Using a fresh permitted localhost HTTP tab and synthetic accounts, the browser pass exercised:

1. Desktop (1280 × 900), mobile (390 × 844), and narrow recall form (320 × 680); light/dark theme switching and persistence; mobile menu expansion/collapse and batch lookup.
2. Invalid/valid password login, all six actor accounts, sign-out, refresh, retailer denial from the lab route, and an actual protected approval's return destination after login.
3. Harvest dialog labels, native modal state, keyboard movement inside the dialog, Escape dismissal and return focus; submission to saved approval rather than premature success.
4. Missing-wallet feedback and persistence of the saved operation. Actual signatures came from a guarded operator-only helper using named local Hardhat actors through the authenticated API. This is not an external wallet-extension test.
5. Farmer/processor/lab handovers, processing, selection of an explicitly synthetic PDF, oversized-file rejection before hashing, and confirmed laboratory commitment.
6. Packaging presets, rejection of 27,500 g against a 25,000 g harvest, valid ten-jar packaging, ten rendered label images, and unchanged signed links after reprint.
7. Distribution and retail, signed-label evidence matches, batch-only lookup, immediate recall warning before signature, and confirmed recall afterward.

The browser batch is `HC-2026-LOCA-BC9D8F`. Its ten receipts are in [browser operation evidence](qa/final-ui-operations.json); [browser acceptance](qa/final-browser-acceptance.json) lists 17 observed checks and eight screenshots. Final status/source hashes are in [local acceptance](qa/final-local-integration.json). No browser console errors/warnings were reported. Physical printing, a real wallet extension, empty-file browser selection and real phone delivery were not tested. Print styles were reviewed in source; label rendering/reprints were observed.

## Failures preserved during QA

The final recheck observed an external Pinata connection timeout and correctly returned HTTP 503. Storage then recovered. The old HTTP runner also changed `updatedAt` during an active worker signature, causing that unsigned synthetic operation to enter review. Its exact failure is preserved; only the operation with no signed bytes/hash was discarded, with no invented receipt. After removing those test-only mutations, the complete HTTP lifecycle and WhatsApp rehearsal passed. See `qa/core-http-ipfs-outage.json` and `qa/core-http-fixture-race.json`.

## Run and rehearse

Keep main `.env` separate from `.env.integration`. Local commands target only `127.0.0.1:55432/pollinator_integration` and local EVM `127.0.0.1:8545`. Preserve the current chain while using saved receipts; do not reset or redeploy it merely to reopen the UI.

With the owned database, Redis and chain running:

```powershell
npm run build:workers
npm run build -- --webpack
node scripts/with-integration-env.cjs scripts/preview-standalone.cjs
```

In another terminal, run sequentially against idle fixture queues:

Stop any separately started local chain worker first: these scripts drive their own worker. Restart it afterward for interactive UI use.

```powershell
npm run verify:http:local
npm run verify:whatsapp:http:local
npm run verify:login:http:local
node scripts/verify-core-views-http.cjs
```

Open `http://127.0.0.1:3100/`. Demo credentials remain in ignored private file `.local-data/local-demo-accounts.json`; never include it in submission material. See [local operations](09-OPERATIONS-AND-LOCAL-INTEGRATION.md) for initial fixture setup.

Production mode requires an external enrolled wallet for interactive approval. For synthetic browser rehearsal, stop the owned preview, then run `npm run dev:local` and `npm run worker:local` in separate terminals. The explicitly enabled test-wallet button is development-only and restricted to named demo accounts on chain 31337. Keep that production guard intact.

The production browser pass instead prepared actions in the UI and used `node scripts/approve-local-ui-fixture.cjs OPERATION_ID` from the operator terminal. This helper refuses non-local chain/database contexts, unnamed demo actors and already-confirmed operations; it uses only the unlocked local fixture signer and saves actual receipts. It creates no production signing endpoint.

## Exclusions and remaining external validation

Public hosting, public-chain deployment, IoT, sensor telemetry and physical hardware acceptance are excluded. Existing hardware/deployment pages remain separate work and are not needed for the core flow.

Real Meta callback activation/delivery, external MetaMask acceptance, field interviews, team/institution details and a beneficiary pilot remain unverified. Local rehearsal must not be presented as proof of these activities.
