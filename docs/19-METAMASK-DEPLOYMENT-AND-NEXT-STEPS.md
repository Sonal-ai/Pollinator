# MetaMask deployment and next implementation steps

Updated 22 October 2026. IoT stays with the teammate and is outside this release sequence.

## Implemented and verified

The administrator dashboard now includes `/dashboard/deploy`. It saves six separate wallet assignments, prepares two contract deployments and five role grants, and opens one wallet request at a time. The confirmed administrator is `0x06a7E556dA2e1e7C40d0C3a19DDB6ED7cC7e4607`. `DEPLOYMENT_ADMIN_ADDRESS` is public configuration; the server does not need the administrator's private key.

The service checks RPC chain/genesis, wallet/network, gas balance, fee ceiling, transaction sender, frozen nonce, destination, zero value and exact calldata. It verifies receipts, confirmations, registry version, forwarder, administrator and separated actor/relayer roles. The browser wallet signs and broadcasts; the backend prepares transactions and reads public-chain state.

Before opening MetaMask, PostgreSQL records an uncertain outcome. A lost response blocks another wallet request until reconciled. Keep its hash and use **Verify saved transaction**. Explicit cancellation retains the exact nonce. A confirmed reverted transaction needs an explicit new attempt and retains its prior receipt. Unused plans can be discarded; possible submissions cannot. Fee replacements or unrelated transactions consuming the reserved nonce require operator review.

Export rechecks the live enrollment and downloads public addresses and receipts. It does not activate the backend, change its existing database binding, provision web accounts or install relayer credentials.

This checkpoint passed seven wallet/API unit tests, seven real PostgreSQL/local-EVM deployment tests and five readiness checks. The preceding development HTTP rehearsal passed login, role/origin boundaries, address validation, page response, draft cancellation, idempotency, seven local transactions with two confirmations and manifest export. Evidence: `qa/wallet-deployment-http.json`. These tests use synthetic accounts and local signing, with no MetaMask or visual inspection and no public broadcast.

TypeScript, worker compilation, targeted lint and the Windows webpack production standalone build passed. The initial build hit a locked Prisma DLL in the owned preview; stopping that preview allowed the build to finish. Standalone sealing removed copied environment data. Document 18 records the preceding container checkpoint; the final patched images and deployment page now also pass the narrower release checks below.

## Finish the live demo in this order

1. **Collect six public addresses:** relayer, beekeeper, lab, processor, distributor and retailer. All must differ from each other and the administrator. Owners retain keys. Fund administrator gas and the separate relayer; review fresh estimates rather than relying on historical quotes.
2. **Prepare the deployment app:** apply `20261022000000_wallet_registry_deployments` to the intended database, generate Prisma and build matching web/worker artifacts. Configure the public administrator setting and working Amoy RPC. Readiness checks the new tables when deployment is enabled; the Compose web service passes the setting. Provision a trusted administrator web account using the operator script. Wallet grants do not create web accounts.
3. **Review and sign:** open the administrator page in a permitted browser with MetaMask, check chain 80002 and all assignments, then review each of seven transactions. Inspect wallet activity and reconcile any uncertain hash before proceeding. No public transaction has been broadcast by the agent.
4. **Activate the verified registry:** export the manifest, select intended release/origin and verify chain/genesis/contracts. Configure the separate relayer securely outside chat. Use a fresh isolated database for a new registry, or an explicitly reviewed migration; never overwrite an existing deployment binding to conceal a mismatch. Provision real web accounts matching actor wallets and pass registry/readiness checks. The main Amoy registry currently fails required v2 compatibility checks.
5. **Finish live WhatsApp:** deploy matching durable worker/migrations, verify the intended HTTPS callback and WABA subscription, then test an incoming harvest through web approval and chain confirmation. The earlier outbound test is UNKNOWN because the recipient cannot check it; no automatic resend. Automatic approval review rejected the callback challenge for verification-token egress; that challenge was not executed.
6. **Finish browser and presentation acceptance:** inspect mobile/desktop, light/dark, account switching, wallet cancellation and MetaMask signing. Browser observation remains blocked by the security URL gate; HTTP checks establish a narrower scope. Rehearse document 17's lifecycle and capture permitted screens. Real team/institution and field evidence remain pending; fieldwork has not started.

The public isolated cluster requires a valid registry binding to start. Prepare deployment through an authorized existing administrator app before binding a fresh cluster; readiness is not a bootstrap bypass. No live callback changes or public deployment are implied by this implementation.

## Repeatable local verification

Use document 09's dedicated setup without resetting a chain containing saved receipts.

```powershell
npm run test:wallet
npm run test:wallet:integration
npm run build:workers
npm run build -- --webpack
```

`scripts/verify-wallet-http.cjs` requires an integration-configured Next development app on `127.0.0.1:3101`, matching `APP_ORIGIN`, and the fixture administrator. It guards the dedicated local database/RPC, keeps test plans archived for audit and does not replace the active fixture registry. Run `npm run verify:wallet:http:local` only against that fixture server.

Contract artifacts are generated before production builds, including the Docker builder. Apply the new migration to the actual deployment separately; it was applied to the dedicated native integration database and the backed-up owned container QA database, not a public deployment.


## Additional failure-path verification

The deployment flow now verifies the canonical block for every prior successful receipt and before retrying a reverted receipt. Seven PostgreSQL/EVM checks pass, including a real locally mined out-of-gas transaction with retained failed-attempt history. Orphaned-block responses are injected into the RPC reader; the shared local chain is not reverted or reset. Preparation and retry remain blocked under those injected responses and recover when canonical proof returns.

`npm run inspect:amoy` now accepts the confirmed public administrator address and reports MetaMask signing without requesting an administrator key. `RELAYER_ADDRESS` can be supplied before its server key is installed; mismatches are reported. Four inspector checks pass. A fresh read-only Amoy query confirmed chain 80002 and the selected administrator with testnet funds, while the six required addresses and relayer signing configuration remain absent. No public transaction was broadcast.


## Production dependency correction

The release install exposed one production advisory in transitive `follow-redirects` 1.16.0. Updating only that package to 1.16.1 fixes the published [array-header credential stripping issue](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8) and [custom sensitive-header matching issue](https://github.com/advisories/GHSA-8r9p-f939-6h3c). Two localhost redirect regression tests pass. `npm audit --omit=dev` now reports zero known production dependency vulnerabilities at this checkpoint; that result is not a claim of complete security. The full development install still reports 59 toolchain advisories, requiring a separate compatibility review before upgrading the contract/build toolchain. See `qa/production-dependency-audit.json`.


## Final patched Linux release checkpoint

Fresh web, worker and migrator images built under `wallet-flow-review`; exact image IDs and source hashes are in `qa/wallet-release-checkpoint.json`. All run as UID/GID 1001. Offline checks found the new deployment page and no private workspace/environment files. The worker contains `follow-redirects` 1.16.1.

The new migration passed through the real migrator against a privately backed-up owned QA database. The restricted application role can create seven-step plans, persist locked UNKNOWN transitions and enforce the one-active-administrator index, while schema creation, deployment binding mutation and migration-history reads remain denied.

The actual Linux release entry point passed readiness, password login, administrator-page HTTP rendering, anonymous denial and cross-origin write protection. A deliberately unavailable loopback RPC returned a secret-safe HTTP 503. This checks release wiring and outage behavior; it does not prove Linux-to-Amoy deployment or visual/MetaMask acceptance. See `qa/wallet-container-http.json` and `qa/wallet-flow-compose.json`.

The synthetic administrator was disabled and its test sessions revoked. Temporary web/Redis/PostgreSQL containers were stopped, the preserved QA EVM was never restarted and Podman returned to its original stopped state. Web stop exit code was 143; database and Redis exited 0. The native port-3100 preview remains separate.


The final patched Windows production preview was then rechecked through the full core HTTP lifecycle: 19 recorded checks passed, including real IPFS evidence, role boundaries, custody, bounded packaging, stable QR reprints and recall. The separate signed-webhook HTTP rehearsal also passed all seven recorded steps through the compiled durable worker, actual batch API, authenticated actor approval and local-chain confirmation. Meta sending and translation remain mocked in that rehearsal; IPFS is real. Updated evidence is `qa/main-http-acceptance.json` and `qa/whatsapp-http-acceptance.json`. These checks still do not establish real-phone, public-Amoy or browser/MetaMask acceptance.


## Complete first-time farmer enrollment

WhatsApp registration intentionally creates a profile with no wallet. The trusted operator now has an explicit way to link that unbound profile and its login account together after the wallet has the beekeeper role on the configured registry:

```powershell
npm run account:provision -- --identifier '<registered phone or email>' --role beekeeper --wallet '<enrolled public address>' --beekeeper-id '<existing profile ID>' --enroll-beekeeper
```

Run this from an authorized source checkout with the intended database and registry configuration. It is an operator tool, not a public API or a command installed in the minimal release images. Verify the person's identity and wallet assignment before running it. Enter the account password through the existing masked terminal prompt; do not put it in arguments or chat. This command reads the chain and writes the database; it never grants a chain role or broadcasts a transaction.

The helper verifies chain/network/registry context, the database binding in isolated mode and an exclusive beekeeper role. A serializable transaction links only an unbound profile or its identical existing wallet, then creates/resets the same matching account. It rejects another profile/account using the wallet, phone mismatch, wallet replacement, account-binding changes and unbound historical batch data. A failed transaction cannot leave a partially linked profile. Resetting the account revokes earlier sessions.

Seven PostgreSQL/local-EVM enrollment checks pass, including concurrent ownership attempts, actual CLI execution and password-session revocation. The strengthened WhatsApp integration now starts from a null-wallet farmer, enrolls the account, authenticates its real password and completes durable harvest recovery and actor-signed local registration with zero gas in the farmer wallet. Chat transport and IPFS remain mocked in that fixture; it is not live-phone acceptance.

## Preserve approval links through sign-in

An unauthenticated WhatsApp approval link now carries its dashboard destination to sign-in. Successful login returns to that destination. The proxy overwrites any client-supplied return header, and the server account guard preserves the safe target for revoked sessions. Only bounded internal dashboard paths are accepted; external, protocol-relative, encoded-path and login-loop targets fall back to the dashboard. Five focused checks cover those paths and access boundaries. Browser execution still requires the permitted visual/MetaMask acceptance step.

## Development-toolchain reduction

The unused Ignition, TypeChain, gas-reporting, coverage and network-helper toolbox packages were removed; the existing ethers, Chai matcher and explorer source-verification plugins remain. No configured task or current test uses the removed plugins. The full npm audit fell from 59 to 29 reported dependency advisories. The remaining advisories affect required development tools and require a deliberate compatibility migration rather than an automatic major upgrade or Next.js lint-config downgrade. Production dependencies remain a separate audit scope.

Solidity stays pinned to 0.8.26. All 32 contract tests pass, and a forced clean compilation produced byte-for-byte identical creation/runtime bytecode and ABI for both contracts against the saved pre-change checkpoint. Existing deployment receipts are not being relabelled or reset.


Actual production HTTP login-return acceptance also passed anonymous and invalid-cookie redirection, real password access to the saved operation, and a signed but revoked account session returning to sign-in with its original target. The first HTTP harness assumed absolute redirect locations; it was corrected to handle Next.js relative localhost locations before the final pass. This verifies server routing and the shared destination validator, not execution of client navigation in a browser. Evidence: `qa/login-return-http.json`.


## Final onboarding acceptance checkpoint

Windows production build, worker compilation, TypeScript and lint across eleven touched files pass. The final local production HTTP lifecycle passes all 19 recorded checks with real IPFS; the signed WhatsApp-to-wallet-approved-local-chain HTTP rehearsal passes all seven steps with Meta/translation mocked and real IPFS. The app suite now has 71 passing checks, including the five return-path checks. Run the new enrollment checks with `npm run test:enrollment:integration`, its connected conversation with `npm run test:whatsapp:integration`, and production return routing with `npm run verify:login:http:local` against the guarded local fixture.

Matching `onboarding-review` Linux web, worker and migrator images build. Worker and migrator runtime contents retain their preceding image digests; the web digest changes for the authentication update. A clean Linux compiler stage, with host `artifacts` and `cache` excluded, produced exactly the same creation/runtime bytecode and ABI for both contracts as the saved Windows pre-change checkpoint. The Linux web release entry point passes safe sign-in redirection, readiness, actual administrator login, access boundaries and unavailable-RPC HTTP 503. These are local HTTP checks, not browser execution or Amoy transactions.

Temporary QA services were stopped, the synthetic administrator revoked and Podman returned to stopped; native preview readiness and landing page still return HTTP 200. Exact image IDs, source hashes, checks and scopes are in `qa/onboarding-checkpoint.json`.

A final read-only check still finds the main Amoy registry incompatible with the required v2 reads, and the relayer/five actor addresses are not configured. The selected administrator remains confirmed with MetaMask signing. Full completion still requires actual wallet setup/signing, intended release/callback activation, real two-way WhatsApp evidence and permitted browser/MetaMask acceptance. No public transaction or real Meta message was sent in this checkpoint.
