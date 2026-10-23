# Phased Git publication

Prepared 23 October 2026, Asia/Kolkata.

The integration work is being published to [`codex/phased-integration`](https://github.com/Sonal-ai/Pollinator/tree/codex/phased-integration), starting from GitHub's existing `main` commit `3c0fe58e66286a9c8094d282711d5d957bf1a5fa`. Main is not overwritten or force-pushed. A local recovery stash preserves the original working changes.

Each phase has its own commit, a subject explaining the change, a body describing behavior and boundaries, and a separate push. These are ordered integration milestones; intermediate commits are not claimed to be independent production releases. Git history is the authoritative list of completed pushes.

## Publication phases

1. **Toolchain and private-file safeguards:** pinned compiler/dependencies, lockfile, framework settings, environment template and generated-file exclusions.
2. **Contracts, data and account foundations:** registry v2/forwarder, migrations, revocable sessions, authorization policies, evidence integrity and durable operation services.
3. **Authenticated APIs and chain processing:** actor approval endpoints, receipt worker, trusted enrollment and recoverable wallet-deployment preparation.
4. **WhatsApp durability:** signed webhook persistence, conversation ordering, outbox attempts, delivery reconciliation and recovery tests. Publishing this implementation does not activate a phone number or send messages.
5. **Integrated UI:** review-before-signing, responsive portal, evidence views, label reprints, direct administrator recall and local acceptance helpers. External MetaMask approval remains unverified.
6. **IoT and firmware groundwork:** telemetry, gateway queues, BLE/MQTT support, health advisories and reference firmware. This phase requires separate publication approval because IoT was excluded from the completion scope. Physical hardware validation remains deferred.
7. **Operations source:** runtime sealing, worker health, cluster configuration, backups and guarded local fixtures. Publishing this code performs no hosting, public-chain deployment or IoT activation.
8. **Documentation and sanitized evidence:** implementation records, runbooks, synthetic acceptance receipts/screenshots and this publication checkpoint.

## Validation before publication

Fresh checks passed on the complete local integration checkout:

- Application suite: 71 passing.
- Contract suite: 32 passing.
- Broader unit suite: 134 passing.
- WhatsApp unit suite: 12 passing; no real messages sent.
- Wallet unit suite: 7 passing; this does not prove a real MetaMask signature.
- Firmware software tests: 15 Node/host checks and 6 Python provisioning checks; no hardware validation implied.
- TypeScript check and compiled worker build: passed.

Suites overlap, so their counts must not be added as unique tests. These fresh checks cover the complete local checkout, including any IoT files awaiting publication approval. They must not be represented as a build of a partial remote snapshot with those files withheld.

The 22 October production/browser acceptance remains separately recorded in [the final local handoff](20-FINAL-LOCAL-INTEGRATION.md). Browser acceptance was not repeated as part of this Git publication pass. [The publication validation record](qa/phased-publication-checkpoint.json) distinguishes fresh checks from historical results.

## Private material

Every staged phase is checked against its exact path list and local private configuration values before commit. Environment files, private keys, database files, local caches and generated private account/device manifests are excluded. The repository retains only `.env.example` with placeholders.

Historical lint reports originally embedded source snapshots, absolute machine paths and an actual phone number. Their original copies remain in the ignored local recovery directory. Published reports retain diagnostics and counts while removing source snapshots, autofix replacement text and absolute paths. Historical hashes may differ after Git normalizes line endings; the publication record uses canonical Git content hashes for the current source.

The four original submission-reference screenshots are retained locally and excluded from GitHub publication. Their form requirements are transcribed in the dossier documentation. Published application screenshots show the synthetic local acceptance flow.

At the initial phase publication, real MetaMask approval was still pending. The subsequent 23 October [combined local verification](qa/metamask-local-e2e.json) now proves an external MetaMask approval through the actual app, local relayer, receipt and confirmed browser UI for one synthetic processing action. Public-network approval/deployment remains unverified. WhatsApp activation and real delivery remain deferred following the user's number removal. No public deployment or physical IoT completion is claimed by these pushes.
