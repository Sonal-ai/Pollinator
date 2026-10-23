# Validation and source register

This is the original audit baseline. See [document 08](08-PROTOTYPE-IMPLEMENTATION-STATUS.md) for subsequent implementation, tests and current limitations.

**Date:** 20 October 2026, Asia/Kolkata.  
**Git baseline:** `54a1a496de12e34ee7a9e2abb740cf83f88d71f5`.  
**Environment:** Windows PowerShell; Node `v24.19.0`; npm `11.4.0`; installed Next.js `16.3.5`.

## 1. Checks actually performed

### Contract regression suite

Command: `npm run test:chain`.

**Result: passed, 23 tests.** Hardhat used its ephemeral test network, as configured for the `test` command. Coverage included role assignment, create, verifyLab, custody transfer, packaging single-call quantity check, recall, read status, and pause/unpause.

Passing this suite did not protect against the adversarial business sequences below. It does not certify deployed contract bytecode or production integrations.

### TypeScript

Command: `npx tsc --noEmit`.

**Result: passed, exit code 0, no diagnostics.** No application source was changed before or after this check.

### ESLint

Command: `npm run lint`.

**Result: failed, exit code 1: 137 problems — 54 errors and 83 warnings.** These are baseline issues, not introduced by this documentation change. Examples include CommonJS imports under the global TypeScript rule, explicit `any` types, React effect/purity findings, theme function declaration ordering, unescaped JSX entities, and unused imports/variables. Tooling files may need scoped CommonJS configuration; application errors need appropriate code fixes.

### Production build

Command: `npm run build`.

**Result: failed, exit code 1.** Next.js/Turbopack could not download **Geist** and **Geist Mono** from Google Fonts in this environment. The build stopped with two font-fetch errors. This is an observed external-resource failure, not proof that the remaining compilation/deployment stages pass or fail.

Recommendation: use locally packaged fonts for reproducible/offline builds, then rerun the full build and a clean-container smoke test. No change to fonts or network permissions was made during this documentation task.

### Metadata-hash reproduction

Executed a local Node check using the exact serialization expression in `src/lib/ipfs.ts`, with two metadata objects differing only in nested packaging fields. It printed:

```json
{
  "serialized": "{\"batchCode\":\"AUDIT\",\"packagingDetails\":{},\"quantityGrams\":25000,\"version\":\"1.0\"}",
  "nestedTamperingProducesSameHash": true
}
```

This confirms nested fields are dropped by the root-key whitelist. It is not a hash collision in SHA-256.

Minimal local reproduction, requiring no service or secret:

```javascript
const crypto = require('crypto');
const a = {
  batchCode: 'AUDIT',
  quantityGrams: 25000,
  packagingDetails: { jarCount: 50, jarSizeGrams: 500 },
  version: '1.0',
};
const b = { ...a, packagingDetails: { jarCount: 50000, jarSizeGrams: 500 } };
const bytes = (x) => JSON.stringify(x, Object.keys(x).sort());
const hash = (x) => crypto.createHash('sha256').update(bytes(x)).digest('hex');
console.log(bytes(a));
console.log(hash(a) === hash(b)); // true: nested quantity is not protected
```

### Contract adversarial sequence reproduction

A local Node/Hardhat execution explicitly selected `HARDHAT_NETWORK=hardhat`, deployed a fresh in-memory contract and used only local test accounts. No public network or stored production database was modified.

Observed results:

```json
{"check":"skip directly to sold and unregistered recipient","status":7,"recipientHasRetailRole":false}
{"check":"repeat packaging after forward transition","firstPackagingWithoutLab":true,"secondPackagingAccepted":true,"statusAfterSecondPackaging":4}
{"check":"missing batch reads","createdAt":0,"returnedStruct":true}
```

Reproduction sequence:

1. Deploy HoneyChain; grant beekeeper and processor roles to different local signers.
2. Register batch A with 25,000 g. Its beekeeper transfers directly to an unrelated signer with new status 7; the call succeeds although the recipient has no retailer role.
3. Register batch B with 25,000 g. Transfer to processor with status 2. Package 50 × 500 g without lab approval; the call succeeds.
4. Transfer batch B from processor to the same processor with status 5. Package another 50 × 500 g; the call succeeds and resets status to 4.
5. Read an unregistered key: a zero-valued struct returns with `createdAt=0`.

For reproducibility, the contract source SHA-256 observed during the checks was `62a5b5d7343c3df78a773712bbbcbc37b607e5530feed1e190c884b31e048f8e`. Hardhat artifacts existed in this checkout; the normal contract test command completed before recording the final test result. The artifact is not an independent attestation of an Amoy deployment.

## 2. Static source coverage

- Root configuration: package scripts/dependencies, TypeScript, ESLint, Next config, AGENTS instructions, `.gitignore`, example environment, deployment-address manifest.
- Contract and chain: HoneyChain Solidity, Hardhat config, deploy script, cached ABI surface, existing contract tests, server blockchain adapter and status API.
- Core services: auth, database client, environment validator, IPFS, QR, anti-clone, IoT health and external detector wrapper.
- All 20 API route files enumerated in the [audit coverage register](01-APPLICATION-AUDIT.md#6-api-coverage-register).
- Consumer verification server/client trust decisions; batch information and jar-scan paths.
- Dashboard role/navigation and relevant batch, detail, custody, IoT, health, lab, processor, analytics and recall access/query paths. This was not a full visual/accessibility evaluation of every component.
- WhatsApp webhook, message selection/deduplication/FSM, identity resolution, pairing, harvest units/confirmation, batch forwarding, text/audio AI calls and media/inference flow.
- Infrastructure/deployment scripts, Docker/Compose/NGINX configuration, IoT simulator and destructive demo seed behavior.
- README and existing `DOCUMENTATION.md` claims compared with source. Existing documents are retained; the new audit is a dated assessment and should take precedence for implementation status where they conflict.

No secret values were included in this documentation. The real `.env` contents were not printed or manually inspected; normal local tooling loaded its environment as part of the test/build commands.

## 3. Next.js local guidance consulted

The repository instructs agents to use installed Next.js documentation because this release may differ from familiar versions. Relevant installed guides were read:

- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`: distinguish authentication, session management and authorization; prefer a maintained auth solution and server-side validation.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`: App Router route-handler conventions and current default caching behavior.

No framework application code was changed. Future implementation should consult the relevant installed guides for the feature being changed, including proxy, server-side authorization, runtime/background processing, caching and deployment.

## 4. Official competition evidence

Primary official pages inspected for substantive claims:

- [Homepage and announcements](https://sewafirstryic.dtu.ac.in/#announcements): event identity; live notices dated 2/3 October, registration extension and submission enablement; conflicting banner wording disclosed.
- [Problem statements](https://sewafirstryic.dtu.ac.in/problem-statements): open local/community track `REG-001-OP`, agriculture and rural economy fit.
- [Guidelines](https://sewafirstryic.dtu.ac.in/guidelines): Category II eligibility, screen deliverables, engineering/user evidence, 75-day plan, qualitative evaluation criteria.
- [Events](https://sewafirstryic.dtu.ac.in/events): published 2026 stage start dates; no inference of final deadlines.
- [FAQ](https://sewafirstryic.dtu.ac.in/faq): expanded live answers for six-member maximum and same-organisation restriction.
- [Contact](https://sewafirstryic.dtu.ac.in/contact): official contact channel for unresolved rules.
- [Official linked Category II template](https://sewafirstryic.dtu.ac.in/assets/Open%20Submission-DIPLOMA%20_%20HIGHER%20EDUCATION-DU8_trC9.pptx): link verified; file contents not inspected.

Research method: TinyFish CLI was attempted first. Authentication was reported valid, but direct fetch and search failed with `fetch failed`. Research explicitly switched to the available web/browser tools; it is not described as a successful TinyFish search. Dynamic Category II content and FAQ accordions were checked because static extraction omitted them. The delegated research pass reported 28 unique URLs encountered/reviewed, including search results; that count is not 28 independently verified rule documents. The direct sources above support the event claims in this package.

## 5. Primary technical references

- [Ethereum: oracles](https://ethereum.org/developers/docs/oracles/) — the boundary between contract records and external-world claims. Supports explicitly retaining trust in samples, sensors, witnesses and labs.
- [EIP-712 typed structured data](https://eips.ethereum.org/EIPS/eip-712) — typed signing and domain separation; application replay protection remains necessary.
- [OpenZeppelin Contracts cryptography API](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography) — signature validation and typed-data building blocks. Consult the installed compatible version before implementation.
- [OpenZeppelin Nonces](https://docs.openzeppelin.com/contracts/5.x/api/utils#Nonces) — monotonically increasing nonce utilities for replay prevention.
- [GS1 EPCIS 2.0.1](https://ref.gs1.org/standards/epcis/2.0.1/) — useful event, sensor and transformation concepts for interoperability. The proposed design is EPCIS-inspired; no conformance certification or complete implementation is claimed.

These references support architectural choices. They do not validate a particular lab, a government subsidy, agricultural treatment advice, a production token price, or the accuracy of the external inference service.

## 6. Not validated or performed

- Live deployed application behavior; no application deployment URL was supplied.
- Current Amoy bytecode/source match, network/role configuration, transaction history or funded signer safety.
- Live Pinata upload/retrieval, Meta delivery/send, paid Gemini/Lambda inference, sensor hardware, lab sampling/chemistry, and actual user performance.
- Current dependency-advisory scan, formal smart-contract verification, fuzz/invariant suite, penetration testing, end-to-end browser test, clean container run, backup restore and cloud permission audit.
- Regulatory accreditation/compliance, IP/patent novelty, official permission to reuse an existing project, current portal access, final submission deadline, and confirmed partner commitments.
- Cloud writes/deployments, database resets/seeding, public-chain writes, organiser contact, registration, submission, or publication.

All timings, budgets, adoption targets and 75-day milestones outside the official rules are planning assumptions. Security fixes and product improvements remain proposed until implemented and verified.
