# Pollinator: blockchain audit and hackathon improvement documentation

**Prepared:** 20 October 2026, Asia/Kolkata  
**Repository baseline:** `54a1a496de12e34ee7a9e2abb740cf83f88d71f5`  
**Implementation last updated:** 22 October 2026; current local handoff is [document 20](20-FINAL-LOCAL-INTEGRATION.md). Publication and fresh software checks are recorded in [document 21](21-PHASED-PUBLICATION.md), dated 23 October.  
**Purpose:** assess the existing application and define a credible, buildable improvement plan for the competition at [SEWAF FIRST RYIC, DTU](https://sewafirstryic.dtu.ac.in/).

## Recommendation

Position Pollinator as **a WhatsApp-accessible honey provenance and recall system for beekeeper cooperatives**, with independent lab attestations and serialized jar records. Keep IoT and AI as supporting evidence and farmer assistance. The strongest blockchain use is an independently checkable record of who attested to a batch, which report they signed, how custody moved, and whether the batch was recalled.

The current project is a substantial prototype. Its contract is an access-controlled provenance registry, not an ERC-721 NFT implementation. The original audit found a single-wallet trust model and successful-looking failure paths. Subsequent code adds registry v2 and repairs several of those boundaries; durable actor signing and receipt recovery pass local database/chain integration tests. Read document 14 for reference firmware and physical acceptance gates, document 13 for phone gateway software, document 11 for deployment/recovery, and documents 09 and 10 for preceding integration checkpoints.

## Read in this order

1. [Full application and blockchain audit](01-APPLICATION-AUDIT.md): implementation inventory, evidence, severity, practical fixes, and limitations.
2. [Target use case and technical architecture](02-TARGET-ARCHITECTURE.md): product focus, trust model, contract design, data model, verification behavior, and costs.
3. [Implementation roadmap and acceptance criteria](03-IMPLEMENTATION-ROADMAP.md): ordered work packages, a 48-hour rescue plan, longer delivery plan, tests, and pilot measurements.
4. [Hackathon fit and submission playbook](04-HACKATHON-PLAYBOOK.md): official event evidence, category fit, proposal material, demo, pitch, and questions to confirm.
5. [Validation and source register](05-VALIDATION-AND-SOURCES.md): executed checks, reproducible observations, source inventory, and external references.
6. [Authentication setup and rollout](06-AUTHENTICATION-SETUP.md): implemented first work package, account provisioning, schema activation, and remaining boundaries.
7. [ZIP requirements and 12-point dossier](07-SUBMISSION-REQUIREMENTS-AND-DOSSIER.md): exact Screen 1 fields, required uploads and factual details still pending fieldwork.
8. [Current implementation and next integration gate](08-PROTOTYPE-IMPLEMENTATION-STATUS.md): UI, evidence, registry v2, serialized inventory, rollout requirements and remaining full-application work.

9. [Durable operations and local integration](09-OPERATIONS-AND-LOCAL-INTEGRATION.md): wallet approval, relayer/receipt recovery, real integration tests, isolated service setup and outstanding release gates.

10. [Device telemetry, MQTT and AI](10-DEVICE-TELEMETRY-AND-AI.md): per-device enrollment/signatures, replay-safe intake, source labels, MQTT recovery, uncertainty-aware vision, scale-trend scenarios and remaining hardware/cluster gates.

11. [Cluster deployment and recovery](11-CLUSTER-DEPLOYMENT-AND-RECOVERY.md): compiled runtime services, isolated cluster configuration, fresh migration checks, backup tooling and pending container validation.

12. [Authenticated offline delivery receipts](12-OFFLINE-DELIVERY-RECEIPTS.md): server signatures issued after database commit, exact-packet binding and the firmware deletion rules used by the phone gateway in document 13.

13. [Phone gateway and offline queue](13-PHONE-GATEWAY-AND-OFFLINE-QUEUE.md): BLE transport and IndexedDB queue, authenticated MQTT relay/receipt lookup, real TLS/database integration and remaining firmware/browser gates.

14. [Hive firmware and bench plan](14-HIVE-FIRMWARE-AND-BENCH-PLAN.md): reference ESP32 source, NVS sequence reservation, signed flash journal, authenticated BLE/USB setup, host fault tests, C++ delivery integration and required physical validation.

15. [Web, WhatsApp and blockchain verification](15-MAIN-FLOW-VERIFICATION.md): active non-IoT priority, fresh contract/database/conversation tests, actual Meta connectivity, failing main Amoy compatibility, remaining gates and presentation sequence.

16. [WhatsApp delivery and recovery](16-WHATSAPP-DELIVERY-RUNBOOK.md): durable inbox/outbox, conversation transactions, delivery receipts, unknown-send review, migrations, worker activation and local verification limits.

17. [HTTP rehearsal and Amoy handoff](17-HTTP-REHEARSAL-AND-AMOY-HANDOFF.md): real HTTP lifecycle and signed-webhook integration, real IPFS evidence, outage recovery, repeatable commands, timed presentation and missing public-chain setup.

18. [Release container checkpoint](18-RELEASE-CONTAINER-CHECKPOINT.md): fresh Linux release images, merged secret isolation, evidence override, restricted-role migrations and worker health/shutdown verification.

Submission working materials: [field visit and evidence starter](submission/FIELDWORK-STARTER.md) and [editable slide content source](submission/SLIDE-CONTENT-DRAFT.json). The presentation is a content draft until the official template and verified field details are available.

## Original audit priorities

- Replace persona login with verified identity and server-managed roles. Remove cross-user demo fallbacks.
- Introduce explicit evidence states: confirmed, pending, unavailable, mismatched, and simulated. Unavailable evidence must never become a green verification.
- Remove fabricated IPFS CIDs and hash exact uploaded bytes with a recursive canonical format where required.
- Bind each state transition to an authorized actor, legal predecessor state, and confirmed transaction. Enforce lab approval and cumulative packaging limits.
- Tell one complete story: farmer records a harvest; lab attests; processor produces a bounded set of jars; consumer checks evidence; admin recalls; every jar shows the recall.

## Scope and status

The original audit records the pre-change baseline and proposed improvements. Documents 06 and 08–14 record implementation changes, activation steps and current limits. Other audit findings remain open unless explicitly recorded as addressed. The initial source review covered the contract, the then-existing 20 API route files, authentication/proxy, blockchain/IPFS/QR libraries, WhatsApp/AI/IoT integration, dashboard access/query paths, schema, deployment scripts, and existing tests. This is not a deployment certification.

The official event is a rural innovation challenge with a suitable agriculture/community track. A blockchain-specific track or compulsory blockchain technology was not established. Event deadlines and eligibility must be read from the verified playbook, including the extension notice and organisation restrictions.

- [19 - MetaMask deployment and next implementation steps](19-METAMASK-DEPLOYMENT-AND-NEXT-STEPS.md)
