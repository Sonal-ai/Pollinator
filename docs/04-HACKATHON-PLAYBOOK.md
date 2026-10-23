# Seva First Innovation Challenge 2026: Pollinator playbook

Verified on 20 October 2026, Asia/Kolkata. Official website: [SEWAF FIRST RYIC, DTU](https://sewafirstryic.dtu.ac.in/). This file distinguishes published rules from our proposed strategy. It does not confirm registration, team eligibility, or acceptance.

## 1. What the official site establishes

### Event and category

The event is **Seva First Innovation Challenge (SFIC) 2026**. It emphasizes problems, working prototypes, engineering feasibility, and user/field validation. Higher-education students, including diploma, undergraduate, postgraduate and Ph.D. programmes, are covered by **Category II: Diploma & Higher Education**. Check any challenge-specific category restrictions. [Official guidelines](https://sewafirstryic.dtu.ac.in/guidelines).

The best identified track for Pollinator is **Local Community Level → REG-001-OP: Village & Panchayat Development, Agriculture & Rural Economy**. This is an open problem framing opportunity suited to a local agricultural/community need. No blockchain-specific track or mandatory blockchain requirement was found. This fit is our recommendation, not an organiser endorsement. [Official problem statements](https://sewafirstryic.dtu.ac.in/problem-statements).

### Team constraints

- Maximum **six members, including the Team Leader**.
- Members must belong to **one organisation**; the FAQ disallows inter-school, inter-college, inter-startup and inter-industry teams.
- Verify the appropriate participation category, regional coverage, mentor/facility rules and any category-specific exceptions before finalizing the roster.

These team details were read in the expanded live FAQ; static extraction did not expose all answers. [Official FAQ](https://sewafirstryic.dtu.ac.in/faq).

### Published stage starts

- Launch: **19 September 2026**.
- Screening: **2 October 2026 onwards**.
- Build: **12 October 2026 onwards**.
- Validation: **11 November 2026 onwards**.
- Final selection: **20 November 2026 onwards**.
- Results: **TBA**.

These are published stage starts, **not verified final submission deadlines**. As of this audit, launch, screening start and build start are already past; validation/final selection starts are still ahead. [Official events/timeline](https://sewafirstryic.dtu.ac.in/events).

### Extension and portal uncertainty

The live homepage announcements included **DTU/SEVA/2026/CIR-02 dated 2 October**, extending registration/application submission until further notice, and **CIR-03 dated 3 October**, announcing Screen 1 PPT and Screen 2 video submission for registered participants. A banner elsewhere still indicated sign-in/sign-up would open after problem statements release. Treat that as conflicting site messaging: the published extension does not prove the team's current portal access or an unlimited future submission window. [Official announcements](https://sewafirstryic.dtu.ac.in/#announcements).

## 2. Category II deliverables and evaluation

The Category II tab on the guidelines page was inspected separately; the default static page exposes another category and can be misleading.

### Screen 1: PPT

The official guidance calls for:

- The detailed operational problem and beneficiaries.
- Empirical evidence, interviews/user interaction, and authenticity of the problem.
- Existing solutions and the specific gap.
- Working principle, architecture, calculations or simulation.
- Costs and feasibility.
- Development evidence, team responsibilities, a **75-day plan**, facilities/lab/fabrication access.
- Entry TRL and relevant design/literature/patent research evidence.

Use the [official Diploma & Higher Education template](https://sewafirstryic.dtu.ac.in/assets/Open%20Submission-DIPLOMA%20_%20HIGHER%20EDUCATION-DU8_trC9.pptx). The link was verified on the official page; the PPTX file's internal contents were not downloaded or inspected in this audit. Adapt the outline below to the actual template rather than assuming its slide names or count.

### Screen 2: video and tangible progress

The official guidance specifies a **recorded video of at most five minutes**, with prototype/software demonstration and evidence such as drawings/design files, calculations, itemized BOM, roles, timeline, technical gaps, and mitigations. The current repository should be presented honestly as an existing prototype, with event-specific improvements tracked separately. Whether reuse of pre-existing work is allowed remains a question for the organiser. [Category II guidelines](https://sewafirstryic.dtu.ac.in/guidelines).

### How the published evaluation affects the project

- **Problem authenticity:** use real interviews and the current cooperative trace/recall workflow. A generic adulteration statistic does not replace local evidence.
- **Differentiation:** show how farmer accessibility and accountable lab/custody evidence solve a documented gap. Explain when a database would suffice.
- **Engineering rigor:** show exact-byte verification, failed-signature rejection, inventory limits, pending transaction behavior and recovery.
- **Team/resources:** identify actual members, responsibilities, available devices/lab contacts and access permissions. Do not invent partner commitments.
- **Socioeconomic and sustainability impact:** define measurable time/cost/accessibility outcomes and who will operate/pay for the workflow.
- **Execution and progress:** show a working thin slice, user feedback, a realistic BOM/cost model, risks and the 75-day development charter.

No official numerical scoring weights were established. Do not assign invented judging points or guarantee selection.

## 3. Recommended project narrative

**Title:** Pollinator — farmer-accessible honey provenance and recall.

**One-line pitch:** Pollinator helps beekeeper cooperatives connect harvest records, accountable lab evidence, custody and serialized honey jars so buyers can inspect provenance and receive clear recall warnings.

**Core innovation hypothesis:** a low-friction farmer interface combined with independently checkable evidence and mass-bounded jar issuance can make small cooperative traceability practical without forcing farmers to manage crypto.

### Proposal abstract

> Small beekeeper cooperatives need a practical way to connect harvest lots, laboratory evidence, packaging and downstream recalls. Pollinator proposes a WhatsApp-assisted workflow that records harvest declarations, links sample-specific lab reports, tracks accepted custody transfers and issues serialized jar labels within the available honey quantity. Public-chain commitments make signed records and later changes independently checkable, while private farmer data and high-volume telemetry remain off-chain. Consumers can inspect evidence sources and recall status through a QR link. The pilot will evaluate task completion, trace/recall time, evidence availability, inventory consistency and operating cost with participating users. The current prototype provides batch, lab, custody, packaging, QR, IoT and health workflows; the next phase will repair identity verification, storage integrity, actor attribution and transaction recovery before validating benefits in the field.

This is proposed submission copy. Replace future-tense statements with completed outcomes only after evidence exists. Add the actual beneficiary location and interview observations once collected.

## 4. Evidence-led PPT outline

Adapt this content sequence to the official format:

1. **Title, team and local beneficiary:** exact organisation, participation category, location and contact. Use consented/synthetic identifiers.
2. **Observed workflow/problem:** an actual batch's present paper/WhatsApp/spreadsheet path; where traceability breaks; baseline timing if measured.
3. **User evidence:** real interview count, roles, dates, quotes within consent, and unmet needs. Mark missing evidence as pending.
4. **Existing alternatives:** paper/QR/database workflows and their practical gaps. Include relevant literature/patent search; do not claim novelty without doing it.
5. **Solution and accessibility:** farmer confirmation, cooperative operator, lab, processor, consumer and recall responsibilities.
6. **Architecture and trust:** what each actor signs; what is on-chain/off-chain; physical truth and central operator limitations.
7. **Working prototype and invariant:** one batch, report commitment, custody, 25 kg → 50 × 500 g jars, and rejection of excess issuance.
8. **Validation/failure behavior:** report alteration, missing evidence, unauthorized actor, pending transaction, copied label suspicion and recall.
9. **Costs/BOM and operating model:** measured units/prices, donation/testnet assumptions, label/lab/cloud/support costs, proposed customer.
10. **Impact and pilot design:** task time, trace/recall time, evidence availability and user completion; actual results versus targets.
11. **75-day plan/resources/risks:** owners, facilities, dependencies, mitigations and organiser calendar alignment.
12. **Current maturity and next milestones:** what exists, what is simulated, what needs validation, and a reproducible demo/source link.

Do not use an asserted TRL number solely because a web demo runs. Map actual evidence to the organiser's definitions and explain unvalidated subsystems.

## 5. A maximum-five-minute demonstration

The following is a proposed script for the improved application. Some steps currently fail the desired invariants; do not present them as working until implemented and retested.

- **0:00–0:30 — Local problem:** show a consented example of a trace/recall gap and identify the cooperative beneficiary.
- **0:30–1:10 — Farmer intake:** record a harvest by Hindi/English text or voice, display parsed units, confirm, then show pending and confirmed registration honestly.
- **1:10–1:55 — Lab evidence:** an enrolled lab submits a batch/sample-linked report; display issuer, hash and storage reference. Explain how the physical sample is linked.
- **1:55–2:35 — Custody and packaging:** recipient accepts the batch; package 25,000 g into 50 × 500 g jars. Attempt one extra jar or repeated full packaging and show rejection.
- **2:35–3:20 — Consumer verification:** scan a valid serialized label; inspect actual chain/contract, actor evidence and retrieved report hash. Show the difference between a batch lookup and jar label check.
- **3:20–4:10 — Adversarial/failure case:** show altered report/hash mismatch or unavailable storage without a green badge. A copied QR is a suspicion signal, not automatic proof of counterfeit honey.
- **4:10–4:40 — Recall:** issue a recall and rescan. Show the warning; if submission is pending, show local safety status and chain pending separately.
- **4:40–5:00 — Measured result and plan:** one actual metric, disclosed pilot/sample limits, cost, and next validation step.

Use a real recorded interaction or label any replay. Keep a tested backup recording for a connection failure, labeled as recorded evidence rather than live operation. Do not ask judges to trust an invented transaction hash or inaccessible mock report.

## 6. Defensible judge answers

**Why blockchain?** Independent organisations can verify signed commitments and changes without relying solely on the platform database. If no independent parties need that boundary, a signed database is simpler; the pilot evaluates the added value.

**Does it prove the honey is pure?** No. It can prove that evidence bytes match a particular issuer's recorded attestation. Sampling quality, laboratory competence, truthful collection and physical seal/custody remain external dependencies.

**Can a QR be cloned?** A static QR can be copied. Serialization, private label issuance, tamper-evident packaging and repeated-scan signals help investigate copying; they do not make printed codes uncopyable.

**What if the server or chain is unavailable?** The design preserves pending work, displays unavailable evidence explicitly, and keeps local recalls visible while chain submission retries. These recovery behaviors must be demonstrated, not assumed.

**Why not an NFT/token?** The needed property is accountable provenance and bounded inventory. A token standard does not solve identity, sample integrity, quantity accounting or evidence availability.

**How does a farmer participate without a wallet?** A verified WhatsApp/cooperative-assisted workflow records confirmation. If the cooperative attests on the farmer's behalf, the interface says so; it does not claim an independent farmer EVM signature.

**What is new compared with generic supply-chain QR systems?** The proposed contribution is rural-accessible intake plus accountable lab/custody evidence, truthful verification under faults, and mass-bounded label issuance. The specific differentiation needs a documented comparison and actual user validation.

## 7. Proposed pilot BOM and budget evidence

No current supplier prices were researched; obtain actual dated quotes before submission. A software-only traceability demo does not require an entire hardware mesh.

- Required: existing phone/laptop, hosted application/database/queue, testnet access, evidence storage, representative report, label printing, and tamper-evident label/seal samples.
- Optional IoT demonstrator: one real enrolled ESP32/gateway plus appropriate calibrated temperature/humidity and weight sensors, power/enclosure, and connectivity. Mark simulated telemetry explicitly if real hardware is unavailable.
- External access: lab testing or an authorised sample report, consented cooperative/user interactions, and fabrication/calibration assistance if hardware is claimed.
- For each line item record quantity, unit, supplier/source, quote date, unit cost, total, owned/donated/purchased status and recurring versus one-time expense.
- Separate software infrastructure, lab/service costs, field travel/support and label costs. Include unpriced dependencies as pending rather than zero.

## 8. Questions to confirm before submitting

The site did not establish all of the following. Ask the organiser through the [official contact page](https://sewafirstryic.dtu.ac.in/contact) or `sewafirst@dtu.ac.in`:

- Final closing dates and current registration/submission access for this team/category.
- Whether, and with what disclosure, an existing project/repository can be improved and submitted.
- Any category-specific regional/team/mentor exceptions; whether collaborators outside the organisation can provide advisory input without team membership.
- Whether this open-track entry can be software-first or must include physical hardware/prototype evidence.
- IP ownership, licensing/public disclosure, fees, final assessment format and detailed evaluation requirements.
- How the requested 75-day plan relates to the published November stage starts.

No contact message or application was sent during this audit. Registration/submission and contacting organisers remain user actions unless separately requested.
