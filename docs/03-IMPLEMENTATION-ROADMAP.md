# Implementation roadmap and acceptance criteria

This is a proposed engineering plan, not completed implementation. Estimates assume an existing working development environment and a small student team; field access, credentials, cloud budgets, and organiser dates are external dependencies.

## 1. Order of work

### P0 — Restore truthful identity and evidence

**Work package 1: authentication and access.** Addresses A01, A02, A13, A15. Suggested owner: backend/security lead. Estimated effort: 2–4 person-days, depending on OTP/provider setup.

- Replace the public persona session issuer with real authentication and server-managed memberships.
- Remove fixed-person OR branches and cross-user fallbacks throughout WhatsApp, API, and dashboard queries.
- Require production secrets; isolate test/demo accounts and data.
- Introduce shared authorization/data-access functions and a public provenance response schema.

**Done when:** unauthenticated/incorrect credentials fail, clients cannot choose admin, an unknown organisation has no implicit access, and two test tenants cannot access each other's private records through direct URLs or mutations.

**Work package 2: truthful verification and storage.** Addresses A03–A06, A12, A17, A18, A29. Suggested owner: evidence/backend engineer with frontend support. Estimated effort: 2–4 person-days.

- Replace fabricated storage fallbacks with typed pending/error results.
- Serialize/hash/upload exact bytes; verify nested metadata and raw PDF bytes.
- Separate batch lookup, jar-label verification, and independent evidence results.
- Require complete signed QR data for a jar claim; remove demo bypasses from the real route.
- Protect label export; return minimal public data; remove unsupported purity/accreditation claims.

**Done when:** nested JSON/PDF alteration fails, storage/RPC failure shows unavailable, missing registration is not a real record, incomplete label data is not authenticated, and simulated data is visibly isolated.

### P1 — Enforce provenance invariants

**Work package 3: contract and actor trust.** Addresses A07, A09–A11, A24, A31. Suggested owner: blockchain engineer. Estimated effort: 3–6 person-days for independent lab signatures and a constrained lifecycle; more for a fully general signature system.

- Decide platform-attested versus independently signed operations and document that choice.
- Add legal transitions, explicit lab evidence prerequisites, current processor ownership, recipient role checks, and accepted custody.
- Add cumulative packaging and immutable runs/serial commitments; require positive quantities.
- Normalize identifier/state specifications without silently changing old batch hashes.
- Add nonce/deadline/domain/state binding if using typed signatures.

**Done when:** an unapproved batch cannot be packaged/sold, an unenrolled recipient cannot accept custody, repeated packaging cannot exceed remaining mass, forged/replayed actor operations fail, and direct contract calls enforce the same invariants as the UI.

**Work package 4: reliable chain projection.** Addresses A08, A19, A25, A27. Suggested owner: backend/infrastructure engineer. Estimated effort: 3–5 person-days for a minimal durable worker/indexer.

- Persist operation + outbox atomically; use payload-bound idempotency keys.
- Store submit/receipt/event identity and indexer checkpoints; expose pending/rejected/confirmed distinctly.
- Retry transient failures, recover after crashes, and reconcile DB against contract events.
- Preserve local recalls immediately while chain synchronization retries.
- Durably enqueue WhatsApp messages, process all messages, and make business operations idempotent.

**Done when:** stopping a worker after broadcast does not duplicate a batch on restart; a failed chain operation does not produce a confirmed DB state; two concurrent operations cannot inflate stock; recall stays visible during outages.

### P2 — Make the pilot dependable and useful

**Work package 5: farmer and hardware correctness.** Addresses A14, A20–A23, A28. Suggested owner: farmer experience/IoT engineer. Estimated effort: 2–4 person-days plus device access.

- Parse units/decimals and confirm normalized harvest amounts in the user's language.
- Prevent arbitrary device reclaims; add per-device authentication and replay checks.
- Distinguish stale/missing/simulated telemetry and uncertain image inference.
- Protect inference costs and file boundaries; calibrate scan warnings and counts.
- Minimize logs, private fields, retention, and third-party location calls.

**Done when:** `2.5 kg` becomes 2,500 g, stale/missing readings cannot appear healthy, unauthorised hardware reclaims fail, unusable photos return inconclusive, and scan warnings disclose uncertainty.

**Work package 6: release and evidence package.** Addresses A25–A30. Suggested owner: release/QA lead with all owners. Estimated effort: 2–4 person-days.

- Resolve baseline lint defects with appropriate CommonJS configuration for tooling and real fixes for application types/hooks.
- Make production build reproducible without live font downloads; package generated ABI/assets explicitly.
- Add CI, migrations, release manifest, readiness checks, backups/restore drill, and guarded demo seeds.
- Capture actual user feedback, reproducible performance/cost data, and a short demo with disclosed simulations.

**Done when:** a clean checkout/container passes defined gates, uses an explicit network/code manifest, can restore a backup, and the submitted claims have inspectable evidence.

## 2. A 48-hour rescue plan

This reduces immediate demo risk. It is not enough to claim production readiness or complete all architecture work.

**Hours 0–6:** freeze new features; snapshot the repository; isolate a demo database/testnet; eliminate public admin login and demo cross-user fallbacks; choose and state the platform-attested trust model if independent signatures cannot be completed safely.

**Hours 6–14:** remove fake CID and integrity-success fallbacks; correct exact-byte hashing; protect QR export; make evidence/pending/unavailable states visible. Prepare one real, retrievable test report or explicitly simulated report labeled as such.

**Hours 14–24:** block illegal lifecycle jumps and repeated packaging; enforce authorized processor/lab approval and fixed packaging quantity/serial issuance. Run new regression cases for the reproduced failures. Deploy only to an isolated test environment with a clear network label.

**Hours 24–34:** complete one batch end to end; verify the report hash independently; perform recall; demonstrate chain/storage outage without false green status. Fix baseline lint/build blockers required for the demo. Do not rush a broad wallet/signature redesign into the final hours.

**Hours 34–42:** interview available users with consent; collect actual observations and label the sample size. Prepare a cost/BOM sheet with measured units and unpriced items clearly pending.

**Hours 42–48:** record a maximum-five-minute Category II demonstration, prepare the official PPT format, check team/portal eligibility, and conduct one rehearsal with a fresh browser/profile and an independent verifier.

## 3. Planning horizon for this event

On 20 October 2026, the published build-stage start has passed. Validation is listed from 11 November and final selection from 20 November; these are stage starts, not confirmed closing dates. The published registration extension does not guarantee the team's portal access. Confirm the applicable dates before promising a submission schedule.

A practical proposed sequence from the audit date:

- **20–23 October:** verified problem framing, P0 controls, truthfulness fixes, and explicit trust model.
- **24–30 October:** constrained contract invariants, packaging limits, independent lab proof where feasible, and durable operation tracking.
- **31 October–7 November:** integrated workflow, signed custody, fault tests, small user trial and cost measurements.
- **8–10 November:** proposal evidence, recording, readiness review, and rehearsal.
- **From 11 November:** user validation, measured improvements and fixes, subject to organiser instructions.

These dates are internal targets only. Do not imply the organiser guarantees 75 new days before the listed final selection stage.

## 4. Category II 75-day development charter

The official guidelines request a 75-day plan. Present the following as a development charter relative to an organiser-approved Day 1, then align it to the official calendar. Revise duration/scope if the stage-specific window is shorter.

- **Days 1–10:** user interviews, baseline workflow measurement, beneficiary selection, authentication, tenant boundaries, evidence schema. Exit: problem evidence and a narrow validated workflow.
- **Days 11–25:** contract invariants, lab/sample model, packaging inventory, exact-byte evidence, and actor enrollment. Exit: reproducible negative tests plus a trustworthy testnet batch.
- **Days 26–40:** outbox/indexer, idempotency, accepted custody, pending-state UI, recall behavior, and resilient WhatsApp intake. Exit: crash/retry/outage scenarios pass.
- **Days 41–55:** cooperative pilot, assisted farmer workflow, labels and tamper-evident handling, initial cost and usability measurements. Exit: actual participant feedback, consented observations, and documented changes.
- **Days 56–65:** false-positive assessment, private/public data review, deployment/backups, accessibility and Hindi/English refinement. Exit: release/restore runbook and measured system limits.
- **Days 66–75:** validation against baseline, independent evidence reproduction, final cost/BOM, design files, report/video, and review of every claim. Exit: field evidence and a reproducible submission bundle.

Suggested responsibilities are roles, not invented people: problem/pilot lead; backend/security lead; blockchain lead; farmer/frontend lead; IoT/AI lead if hardware is included; release/documentation lead. For fewer members, combine roles and reduce scope. All competition members must satisfy the official same-organisation rule.

## 5. Tests that protect the actual use case

### Contract invariants

- Create duplicate/zero/invalid batch; verify correct issuer attribution.
- Reject direct jumps to packaged/sold and recipients lacking required membership/role.
- Reject packaging before lab approval, by another processor, with zero quantity, or beyond remaining mass.
- Package, advance custody stage, and attempt packaging again; cumulative inventory still holds.
- Test report supersession/revocation and preservation of the original evidence trail.
- Test replay, expired authorization, wrong chain/contract domain, changed payload, and stale expected state when signatures are implemented.
- Ensure pause blocks ordinary mutations while authorised recall still works.
- Verify recall blocks new transfers/packaging regardless of API entry point.

### Integration and authorization

- Check every mutation unauthenticated, wrong role, correct role/wrong organisation, and correct owner.
- Test farmer A against farmer B's IDs in web, API, and WhatsApp paths.
- Generate more labels than the committed packaging run; reject without partial writes.
- Reuse an idempotency key with identical arguments: same result; changed arguments: reject.
- Fail IPFS before chain; fail chain before DB projection; crash after broadcast; recover without duplicate events/stock.
- Simulate two concurrent package/transfer requests and relayer nonce contention.
- Test malformed PDFs/images, oversized payloads, untrusted location data, and device replay.
- Process a webhook containing multiple entries/messages and retry a failed message safely.

### Consumer behavior

- Valid complete label, altered HMAC, wrong token/batch association, inactive/replaced token, partial label, batch-only lookup.
- Missing chain registration, wrong contract/network, RPC outage, IPFS outage, nested metadata alteration, PDF alteration.
- Recall committed on-chain, local recall pending chain, stale DB but recalled chain, and stale/unavailable sources.
- Copied QR, repeated legitimate scans, VPN-like location changes, count/first/latest correctness.
- Persistent simulated labeling; no seeded fixture can pass as live independent proof.

## 6. Pilot evidence and targets

The following are proposed targets, **not results**:

- Interview 5–10 beekeepers, at least one cooperative/processor representative, and one lab representative if accessible. Report actual participation and limitations.
- Try 3–5 labeled pilot/test batches and 50–100 jars or equivalent simulated labels if a real packaging run is unavailable. State which are physical.
- Measure median and p95 intake-to-confirmation time, consumer verification time, operation failure/retry rate, and recall visibility delay.
- Aim for 100% correctly attributed successful operations in the evaluated sample, zero false-green outcomes in the fault suite, and zero inventory over-issuance in concurrency tests.
- Measure each scan-warning false positive/false negative against a labeled test scenario set; never infer universal accuracy from a tiny demo.
- Compare farmer task completion and support needs in Hindi/English, with device/network/context recorded.
- Measure actual cash and infrastructure cost per batch/jar; exclude donated/testnet resources from claimed sustainable economics or disclose them explicitly.

Avoid claiming an income increase, reduced adulteration rate, accredited purity, a TRL level, model accuracy, or production scale without appropriate evidence. A useful honest pilot is stronger than an unsupported percentage.

## 7. Release criteria

- [ ] P0 authentication, tenant isolation, truthful evidence, and private QR export completed.
- [ ] Contract and API enforce lab, custody, quantity and recall invariants directly.
- [ ] Pending/confirmed/unavailable/simulated UI states survive failure tests.
- [ ] No production secret or destructive seed is bundled in deployment/submission artifacts.
- [ ] Typecheck, lint, focused tests, clean build and deployment smoke test pass.
- [ ] Chain ID, contract bytecode/ABI version, roles and evidence retrieval checked in the actual demo environment.
- [ ] Restore and operation reconciliation demonstrated on isolated data.
- [ ] Team eligibility, submission portal, current deadline and pre-existing-project policy confirmed.
- [ ] Evidence register, itemized BOM/costs, design files, actual user feedback, and maximum-five-minute video ready.

Current audit completion does not tick these implementation boxes; [the validation register](05-VALIDATION-AND-SOURCES.md) records only checks actually performed.
