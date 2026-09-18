# Pollinator — Complete Project Documentation

> **Platform:** Beekeeper intelligence, supply chain traceability, and honey authenticity verification powered by IoT, AI, and Blockchain.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Why This Problem Matters](#2-why-this-problem-matters)
3. [Who Are We Solving For?](#3-who-are-we-solving-for)
4. [Our Solution — What We Are Building](#4-our-solution--what-we-are-building)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [IoT Layer — Smart Hive Monitoring](#6-iot-layer--smart-hive-monitoring)
7. [AI Layer — Intelligence Engine](#7-ai-layer--intelligence-engine)
8. [Blockchain Layer — Polygon & Smart Contracts](#8-blockchain-layer--polygon--smart-contracts)
9. [Anti-Cloning & QR Safety System](#9-anti-cloning--qr-safety-system)
10. [WhatsApp Bot — Farmer Access Layer](#10-whatsapp-bot--farmer-access-layer)
11. [Web Dashboard — QA & Distribution Portal](#11-web-dashboard--qa--distribution-portal)
12. [AWS Cloud Infrastructure](#12-aws-cloud-infrastructure)
13. [Database Design](#13-database-design)
14. [Security Architecture](#14-security-architecture)
15. [Development Roadmap](#15-development-roadmap)
16. [References & Research](#16-references--research)

---

## 1. Problem Statement

India is the **5th largest honey producer in the world** with over 1,35,000 metric tonnes of honey produced annually. The KVIC (Khadi and Village Industries Commission) runs the National Honey Mission, distributing beehives and training to rural farmers to boost livelihoods.

Despite this scale, the industry is plagued by **three critical, interconnected problems:**

### Problem 1 — Rampant Honey Adulteration
A 2020 Centre for Science and Environment (CSE) investigation tested 13 major Indian honey brands and found **77% failed international quality tests** for adulteration with sugar syrups. The FSSAI (Food Safety and Standards Authority of India) regulates honey standards but detection is challenging and reactive. The end consumer has **absolutely no way** to verify the honey they buy is authentic.

### Problem 2 — Zero Supply Chain Transparency
The journey of honey from a beekeeper in rural Wardha to a consumer in Delhi passes through at least 5–7 hands:
`Beekeeper → Aggregator → Processing Unit → Lab → Packager → Distributor → Retailer → Consumer`

At every step, there is **no verifiable, tamper-proof record.** A dishonest aggregator can mix genuine honey with adulterated syrup. A lab certificate can be forged or re-used across batches. There is no system that irrefutably links the honey in a jar to the specific beekeeper and hive that produced it.

### Problem 3 — Beekeeper Blindness & Market Inequality
Small beekeepers (who form 97% of the sector under KVIC) have no real-time tools to:
- Monitor hive health and detect disease before colony collapse.
- Predict honey yield and plan harvests.
- Prove the quality and origin of their honey to get a fair price.
- Access market rates and government subsidy information.

This information gap means beekeepers sell their honey at exploitatively low prices to middlemen, while consumers pay premium prices for what may be adulterated product.

---

## 2. Why This Problem Matters

| Metric | Figure |
|---|---|
| India's honey production | ~1,35,000 MT/year |
| Beekeepers under KVIC schemes | ~5,00,000+ |
| Market size of honey (India) | ~₹5,000 Crore annually |
| Honey export value | ~$600 million/year |
| CSE adulteration rate (branded honey) | 77% brands failed quality tests |
| Beekeeper average price received | ₹80–120/kg |
| Retail price (same honey, same city) | ₹300–600/kg |

The **price gap** between what a beekeeper earns and what a consumer pays is a direct consequence of the trust and transparency vacuum in the supply chain. Solving this with technology does not just help beekeepers — it protects public health and directly strengthens India's agricultural export credibility.

> **Blockchain cannot test honey for purity. But it can create an immutable, tamper-proof record of the authenticity evidence (lab reports, custody logs, IoT data, and certifications) that no party in the supply chain can silently alter.**

---

## 3. Who Are We Solving For?

The Pollinator platform serves **five distinct stakeholders**, each with a different interface:

| Stakeholder | Problem | Our Interface |
|---|---|---|
| **Beekeeper / Farmer** | No real-time hive monitoring; no market access; no proof of origin | WhatsApp Bot (in local language, voice-enabled) |
| **QA Laboratory** | Manual, disconnected certificate workflows | Web Dashboard |
| **Distributor / Aggregator** | No digital custody trail; liability risk | Web Dashboard |
| **Retailer** | Cannot prove authenticity to consumers | QR Verification Page |
| **Consumer / Buyer** | No way to verify honey is genuine | QR Scan → Verification Web Page |

---

## 4. Our Solution — What We Are Building

**Pollinator** is a **full-stack AgriTech platform** that creates an unbroken, verifiable chain of trust from a bee hive to the consumer's table.

```
[IoT Sensors on Hive]
        ↓
[AI Health & Yield Analysis]
        ↓
[Beekeeper Logs Harvest via WhatsApp Bot]
        ↓
[Platform Creates Honey Batch]
        ↓
[Metadata Uploaded to IPFS — Decentralized Storage]
        ↓
[Batch ID + IPFS Hash Registered on Polygon Blockchain]
        ↓
[QA Lab Uploads Certificate → Hash Committed On-Chain]
        ↓
[Custody Transfer Events Logged On-Chain at Each Step]
        ↓
[QR Code Generated for the Physical Bottle]
        ↓
[Consumer Scans QR → Sees Full Provenance + Blockchain Proof]
```

### What Makes Us Different From Everything Else

| Existing Solution | What It Lacks | What Pollinator Adds |
|---|---|---|
| Madhukranti Portal (Govt) | No blockchain; no IoT; no AI | All three, plus WhatsApp for rural access |
| IBM Food Trust | Not honey-specific; enterprise only; expensive | Rural-first, KVIC-aligned, mobile-first |
| BroodMinder / Arnia | Only IoT hive monitoring; no provenance | Full chain from hive to consumer |
| Any other honey brand QR | Static QR with marketing copy | Dynamic QR linked to live blockchain evidence |

---

## 5. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     POLLINATOR PLATFORM                     │
├──────────────┬──────────────────────────┬───────────────────┤
│   IOT LAYER  │       AI LAYER           │  BLOCKCHAIN LAYER │
│              │                          │                   │
│  ESP32 +     │  Amazon Bedrock          │  Polygon Amoy     │
│  BME280 +    │  (Claude 3 Haiku)        │  Smart Contract   │
│  Load Cell   │                          │  (Solidity +      │
│  → MQTT →    │  Bee Disease Detection   │  OpenZeppelin)    │
│  Backend     │  (EfficientNet-B0)       │         +         │
│              │                          │  IPFS / Pinata    │
│              │  Yield Prediction        │  (Metadata)       │
│              │  (XGBoost)               │                   │
├──────────────┴──────────────────────────┴───────────────────┤
│                    NEXT.JS BACKEND (AWS App Runner)         │
│   API Routes │ Webhook Handler │ Database Service           │
├───────────────────────────────────────────────────────────┤
│            INTERFACES                                       │
│  WhatsApp Bot  │  Web Dashboard  │  QR Verification Page   │
└───────────────────────────────────────────────────────────┘
│                    AWS CLOUD (Infrastructure)               │
│  RDS (PostgreSQL) │ ElastiCache (Redis) │ App Runner       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. IoT Layer — Smart Hive Monitoring

### Hardware Stack

| Component | Measures | Why It Matters | Protocol | Cost (India) |
|---|---|---|---|---|
| **ESP32 DevKit** | Controller + Wi-Fi | Low-cost edge gateway | Wi-Fi, I2C, GPIO | ₹300–600 |
| **BME280** | Temperature, Humidity, Pressure | Hive environment health | I2C/SPI | ₹250–600 |
| **Load Cell (20–50 kg)** | Hive weight | Honey accumulation, swarm detection | Analog via HX711 | ₹400–1,500 |
| **HX711** | Load cell amplifier | Converts analog strain to digital | GPIO Serial | ₹100–250 |
| **GPS Module (NEO-6M)** | GPS coordinates | Deployment proof for KVIC | UART | ₹500–900 |
| **ESP32-CAM** (optional) | Bee imagery | Feeds into the AI disease model | Wi-Fi | ₹500–1,000 |

**Total per hive: ~₹1,550–3,850**

### What the IoT Data Tells Us

| Signal | What It Indicates |
|---|---|
| Sudden weight drop | Possible swarm, theft, or unauthorized harvest |
| Weight gain trend | Active nectar flow — good honey accumulation season |
| Temperature > 37°C | Colony stress, possible disease or overheating |
| Humidity > 75% | Risk of fermentation in uncapped honey |
| Rapid weight fluctuation | Active bee traffic, queen laying normally |
| Acoustic anomaly (future) | Possible queenlessness or swarming behavior |

### MQTT Data Payload

The ESP32 publishes the following JSON to `pollinator/hives/{hiveId}/telemetry` every 5 minutes:

```json
{
  "hiveId": "HIVE-001",
  "deviceId": "ESP32-001",
  "temperatureC": 34.2,
  "humidityPct": 61.8,
  "pressureHPa": 1009.4,
  "weightKg": 27.35,
  "batteryPct": 84,
  "timestamp": "2026-09-18T08:00:00+05:30"
}
```

### What Goes On-Chain vs Off-Chain

> **Rule:** Only store small, stable, public verification facts on the blockchain. Everything large, private, or noisy goes off-chain with a hash committed.

| IoT Data | On Blockchain | Off-Chain | Reason |
|---|---|---|---|
| Raw sensor stream | ❌ | ✅ PostgreSQL | Too large; high volume |
| Daily aggregate (avg temp, avg humidity, weight gain) | SHA-256 hash only | ✅ IPFS metadata | Cost and scalability |
| GPS coordinates | ❌ | ✅ Encrypted in DB | Privacy and theft risk |
| Region / State | ✅ | ✅ | Public provenance |

---

## 7. AI Layer — Intelligence Engine

The AI layer sits between the raw IoT data and the beekeeper's decision-making. It operates in **three modes:**

### Module 1 — Bee Disease Detection

**Model:** EfficientNet-B0 (image classifier)

- **Input:** Bee image (224×224 RGB), uploaded by farmer via WhatsApp or camera
- **Output classes:**
  - `healthy` — Colony in good condition
  - `varroa_parasite_suspected` — Mite infestation risk
  - `pollen_carrier` — Active foraging, positive sign
  - `uncertain` — Confidence < 0.70; recommend manual inspection
- **Dataset:** [Honey Bee Annotated Images (Kaggle)](https://www.kaggle.com/datasets/jenny18/honey-bee-annotated-images), [BeeAlarmed TensorFlow Dataset](https://www.tensorflow.org/datasets/catalog/bee_dataset)
- **API endpoint:** `POST /api/disease-detection`
- **Output also includes:** model version, inference timestamp, input image SHA-256 hash for audit trail

> ⚠️ **Important claim boundary:** The AI model is a **screening support tool**, not a diagnosis system. It flags risk for manual inspection. Lab verification is always the final word on authenticity.

### Module 2 — Honey Yield Prediction

**Model:** XGBoost (gradient-boosted decision trees on tabular data)

**Features used for prediction:**
- 7/14/30-day hive weight trend from IoT
- Temperature & humidity averages and anomalies from IoT
- Rainfall, wind, pressure from **Open-Meteo API** (free weather API)
- Season, month, region
- Flowering/forage season proxy (crop calendar for the region)
- Colony strength (manually entered)
- Historical harvest records from the database

**Output:**
- Expected yield range (kg) for the next harvest window
- Confidence band
- Top contributing factors (XGBoost feature importance)

> The yield prediction model requires local harvest history to be accurate in production. For the prototype, it is trained on publicly available weather history + manually entered sample values and is labeled as **"prototype dataset"** in the UI.

### Module 3 — Conversational AI (WhatsApp Bot Brain)

**Model:** Amazon Bedrock → Claude 3 Haiku

This is what powers the WhatsApp bot's intelligence. It performs:

1. **Language Detection:** Identifies if the farmer is writing in Hindi, Telugu, Bengali, Marathi, Tamil, or English.
2. **Translation:** Translates farmer input to English for internal logic processing.
3. **Intent Classification:** Routes the message to the correct handler (`REGISTRATION`, `HIVE_STATUS`, `ASK_DOUBT`, `HARVEST_MARKET`, etc.)
4. **Beekeeping Q&A:** Acts as an expert beekeeping assistant when intent is `ASK_DOUBT`.
5. **Response Translation:** Translates the bot's English reply back into the farmer's native language.

---

## 8. Blockchain Layer — Polygon & Smart Contracts

### Why Polygon (Amoy Testnet)?

| Network | Cost | Speed | Smart Contracts | Judge Verifiable | Verdict |
|---|---|---|---|---|---|
| Ethereum Mainnet | Very High | Moderate | ✅ | ✅ | ❌ Too expensive |
| Ethereum Sepolia | Free (testnet) | Moderate | ✅ | ✅ | 🟡 Acceptable |
| **Polygon Amoy** | **Free (testnet)** | **Fast** | **✅ Solidity/EVM** | **✅ Polygonscan** | **✅ Best choice** |
| Hyperledger Fabric | Infra cost | Fast | Chaincode | ❌ Not public | ❌ Too heavy for MVP |

Polygon Amoy gives us **EVM compatibility** (so we can use Solidity and MetaMask), a **public block explorer** that judges can independently verify, and **zero-cost transactions** on the testnet.

### Smart Contract Architecture (`HoneyChain.sol`)

The contract uses **OpenZeppelin's AccessControl** and **Pausable** modules, which are the gold standard for security.

#### Roles and Who Holds Them

```solidity
bytes32 public constant BEEKEEPER_ROLE = keccak256("BEEKEEPER_ROLE");
bytes32 public constant LAB_ROLE        = keccak256("LAB_ROLE");
bytes32 public constant PROCESSOR_ROLE  = keccak256("PROCESSOR_ROLE");
bytes32 public constant DISTRIBUTOR_ROLE= keccak256("DISTRIBUTOR_ROLE");
bytes32 public constant RETAILER_ROLE   = keccak256("RETAILER_ROLE");
```

The blockchain **cryptographically rejects** any transaction from a wallet that does not hold the required role. A random person cannot register a fake honey batch.

#### The HoneyBatch Data Structure

```solidity
struct HoneyBatch {
    bytes32 batchIdHash;        // SHA-256 hash of the batch ID string
    address beekeeper;          // Wallet address of the beekeeper
    address currentCustodian;   // Wallet who currently holds custody
    uint64 harvestTimestamp;    // Unix timestamp of harvest
    uint64 createdAt;           // Block timestamp of creation
    uint32 quantityGrams;       // Weight of honey in grams
    BatchStatus status;         // Current stage in supply chain
    string metadataCID;         // IPFS CID pointing to the metadata JSON
    bytes32 metadataHash;       // SHA-256 of the IPFS metadata (tamper detection)
    bytes32 labReportHash;      // SHA-256 of the lab certificate PDF
    bool labVerified;           // True only after an authorized lab signs
    bool recalled;
}
```

#### Batch Lifecycle States

```
Created → Harvested → Processed → LabVerified → Packaged → InDistribution → AtRetail → Sold
                                                                          ↘ Recalled / Rejected
```

#### Key Contract Functions

| Function | Who Can Call | What It Does |
|---|---|---|
| `createBatch(...)` | `BEEKEEPER_ROLE` | Registers new honey batch, emits `BatchCreated` event |
| `verifyLab(...)` | `LAB_ROLE` | Commits lab certificate hash on-chain, sets `labVerified = true` |
| `transferCustody(...)` | Current custodian | Transfers batch to next actor, emits `CustodyTransferred` |
| `packageBatch(...)` | `PROCESSOR_ROLE` | Marks batch as packaged, updates IPFS metadata CID |
| `recallBatch(...)` | `DEFAULT_ADMIN_ROLE` | Flags batch as recalled; consumer verification shows red alert |
| `getBatch(...)` | Anyone (free read) | Returns full batch details — this is what the QR scanner reads |

#### Blockchain Events (What Judges Verify on Polygonscan)

```solidity
event BatchCreated(bytes32 indexed batchIdHash, address indexed beekeeper, string metadataCID, bytes32 metadataHash);
event LabVerified(bytes32 indexed batchIdHash, address indexed lab, bytes32 labReportHash);
event CustodyTransferred(bytes32 indexed batchIdHash, address indexed from, address indexed to, uint8 status);
event BatchRecalled(bytes32 indexed batchIdHash, address indexed by, string reasonCID);
```

A judge can go to `https://amoy.polygonscan.com/tx/<TX_HASH>`, open the "Logs" tab, and independently verify these events without trusting our app at all.

### IPFS / Pinata — Decentralized Metadata Storage

Storing a 2MB JSON file or a lab certificate PDF directly on the blockchain would cost thousands of dollars in gas fees. Instead, we use the **IPFS (InterPlanetary File System)** pattern:

1. Build the metadata JSON with all batch details, IoT summary, and AI results.
2. Compute a `SHA-256` hash of the exact JSON string.
3. Upload the JSON to **Pinata** (IPFS pinning service).
4. Pinata returns an IPFS `CID` (Content Identifier, e.g., `QmXf2...`).
5. Store **only the tiny CID and hash** on the blockchain.

```json
{
  "batchCode": "HC-2026-MH01-000123",
  "beekeeperPublicName": "KVIC Cluster CL01, Beekeeper 07",
  "region": "Wardha, Maharashtra",
  "honeyType": "Multiflora",
  "harvestDate": "2026-09-05",
  "quantityGrams": 25000,
  "labReportHash": "0xabc123...",
  "iotSummary": {
    "period": "2026-08-25 to 2026-09-05",
    "avgTempC": 34.1,
    "avgHumidityPct": 62.3,
    "weightGainKg": 8.4
  },
  "aiSummary": {
    "modelVersion": "pollinator-efficientnet-b0-v1.0",
    "result": "healthy",
    "confidence": 0.91
  }
}
```

**Tamper-proof guarantee:** If anyone alters even a single character of the IPFS metadata file, the CID and hash will change. The consumer's verification page recomputes the hash at scan time and compares it to what is on the blockchain. Any mismatch = fraud detected.

---

## 9. Anti-Cloning & QR Safety System

This is one of the most nuanced parts of the system. **A QR code can be physically copied.** An attacker could photograph the QR on a genuine honey jar and print it on 1,000 fake jars. We address this with a multi-layered defense:

### Layer 1 — Signed QR Payload

The QR code does not just contain a batch ID. It contains a cryptographically signed payload:

```
https://pollinator.app/verify?b=HC-2026-MH01-000123&n=<nonce>&sig=<HMAC_signature>
```

- `b` = Batch ID
- `n` = A random nonce generated at QR creation time
- `sig` = HMAC-SHA256 signature of `(batch_id + nonce)` using a server-side secret key

**If an attacker modifies `b` to a fake batch ID, the `sig` will not match and verification fails immediately.**

### Layer 2 — Blockchain Lookup

The verification page does not just check our database. It directly **reads the deployed smart contract on Polygon** using a public RPC node:

```
contract.getBatch(keccak256(batch_id)) → returns on-chain record
```

If the batch does not exist on-chain, or if the IPFS hash on-chain does not match the current IPFS file, the page shows **"FRAUD DETECTED — Blockchain record mismatch"**.

### Layer 3 — Duplicate Scan Analytics (QR Clone Detection)

Every QR scan is logged in the database with:
- Approximate region (from IP geolocation, not exact location)
- Timestamp
- User agent

The system **flags a batch for review** if:
- The same QR is scanned from two different regions within a 30-minute window (physically impossible for a genuine product).
- A batch's scan count exceeds its declared quantity significantly.

This does not prevent cloning, but it **detects it rapidly** and can trigger an automatic recall.

### Layer 4 — Batch Recall System

If a batch is detected as cloned or adulterated, an admin can call `recallBatch(...)` on the smart contract. All future scans of that QR will show a **red "RECALLED — DO NOT CONSUME"** warning, regardless of what the attacker's fake bottle says.

### Layer 5 — Tamper-Evident Packaging (Future)

For production, physical item-level anti-cloning requires:
- **Unique QR serial per bottle** (not per batch), making it impossible to clone a single QR across an entire production run.
- **Holographic tamper-evident labels** that destroy themselves when peeled, so the QR code cannot be moved to a fake bottle.
- These are production-phase features; the current system provides batch-level proof.

---

## 10. WhatsApp Bot — Farmer Access Layer

The WhatsApp bot is the **primary interface for farmers**. Most small beekeepers in rural India are comfortable with WhatsApp but not smartphone apps. The bot meets them where they already are.

### Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js API Routes (Node.js) |
| AI Brain | Amazon Bedrock (Claude 3 Haiku) |
| State Management | Redis (FSM - Finite State Machine) |
| Translation | Amazon Bedrock (multilingual) |
| Voice Notes | Amazon Transcribe |
| Webhook Security | HMAC-SHA256 signature verification |

### Supported Languages

English, Hindi (हिन्दी), Telugu (తెలుగు), Bengali (বাংলা), Marathi (मराठी), Tamil (தமிழ்)

### Conversational Flows

```
User sends "Hi" / "hello"
    │
    ▼
Welcome Screen (Buttons):
  [Register as Beekeeper] [Ask a Question] [About Pollinator]
    │
    ├── Register → 4-Step Registration Flow
    │     Step 1: Name
    │     Step 2: State/Region
    │     Step 3: Number of hives
    │     Step 4: Beekeeping practices
    │
    ├── Main Menu (after registration):
    │     [🌡️ Hive Status] → Real-time IoT data for their hives
    │     [🐝 Bee Health]  → Upload image → AI analysis result
    │     [🍯 Harvest]     → Register new harvest → Creates blockchain batch
    │     [💰 Market]      → Honey prices, KVIC subsidies info
    │     [❓ Ask a Question] → Free-form beekeeping Q&A via Bedrock
    │
    └── Voice Note Support → Transcribed → Analyzed → Answered in same language
```

---

## 11. Web Dashboard — QA & Distribution Portal

The Web Dashboard is built as a **Next.js web application** and serves the non-farmer stakeholders of the supply chain.

### Key Features

| Feature | Description |
|---|---|
| **Batch Registry** | View all honey batches, their current blockchain status, IPFS CID, and transaction hash |
| **Lab Certificate Upload** | Authorized labs upload their test certificate; the platform hashes it and commits it to the blockchain |
| **Custody Transfer** | Distributors and retailers acknowledge custody transfer; logged on-chain |
| **IoT Dashboard** | View real-time sensor data for registered hives with historical charts |
| **AI Inference History** | Audit trail of all disease detection results with confidence scores and model versions |
| **Scan Analytics** | Dashboard showing duplicate scan alerts and geographic scan patterns |
| **Recall Management** | Admin interface to trigger on-chain recall of fraudulent batches |

### Technology

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Data:** Prisma ORM → Amazon RDS (PostgreSQL)
- **Blockchain reads:** Direct RPC calls to Polygon Amoy via `ethers.js`
- **Hosting:** AWS App Runner

---

## 12. AWS Cloud Infrastructure

The entire backend is designed to run natively on AWS, which also makes it deployable from a single GitHub repository push.

### Services Map

| AWS Service | Purpose in Pollinator |
|---|---|
| **AWS App Runner** | Hosts the Next.js app (web dashboard + API routes + webhook) |
| **Amazon Bedrock** | Powers the WhatsApp bot's AI brain (intent classification, translation, Q&A) |
| **Amazon Transcribe** | Converts farmer WhatsApp voice notes to text |
| **Amazon RDS (PostgreSQL)** | Primary database (farmer profiles, batches, IoT readings, certificates) |
| **Amazon ElastiCache (Redis)** | Manages WhatsApp bot FSM (conversation state per user) |
| **AWS IAM** | Role-based access control for all service permissions |

### Deployment Flow

```
GitHub Push → AWS App Runner Build → Deployed at *.awsapprunner.com
    ↓
Meta App Dashboard → Webhook URL = *.awsapprunner.com/api/webhook/whatsapp
    ↓
ElastiCache (Redis) for session state per wa_id
    ↓
RDS (PostgreSQL) for persistent data
    ↓
Bedrock for all AI calls
```

### Environment Variables Required

```
DATABASE_URL=           # Amazon RDS PostgreSQL connection string
REDIS_URL=              # Amazon ElastiCache Redis connection string
WHATSAPP_VERIFY_TOKEN=  # Meta App webhook verification token
WHATSAPP_APP_SECRET=    # Meta App secret for HMAC verification
WHATSAPP_PHONE_ID=      # WhatsApp Business phone number ID
WHATSAPP_ACCESS_TOKEN=  # Meta Graph API access token
AWS_REGION=             # e.g., us-east-1
AWS_ACCESS_KEY_ID=      # AWS IAM credentials
AWS_SECRET_ACCESS_KEY=  # AWS IAM credentials
POLYGON_RPC_URL=        # Alchemy/Infura Polygon Amoy RPC URL
PRIVATE_KEY=            # Blockchain admin wallet private key (NEVER commit!)
IPFS_GATEWAY=           # Pinata IPFS gateway URL
PINATA_JWT=             # Pinata API key for IPFS uploads
```

---

## 13. Database Design

The database (PostgreSQL on Amazon RDS) uses **Prisma ORM** for schema management and type-safe queries.

### Core Tables

```
WhatsAppUser          — WhatsApp-specific user (wa_id, language preference)
Beekeeper             — Farmer profile (name, region, hiveCount, practices, wallet)
Hive                  — Individual hive registration (beekeeperId, deviceId, region)
SensorReading         — IoT telemetry stream (hiveId, tempC, humidityPct, weightKg)
AIInference           — Disease detection log (hiveId, modelVersion, prediction, confidence)
HoneyBatch            — Core supply chain record (batchCode, status, metadataCID, txHash)
Certificate           — Lab certificate record (batchId, labActorId, certificateHash, ipfsCID)
CustodyEvent          — Blockchain custody transfer log (batchId, from, to, stage, txHash)
QRToken               — Generated QR (batchId, nonce, signature, active)
QRScan                — Scan analytics (qrTokenId, timestamp, ipRegion, userAgent)
```

### What Is On-Chain vs Off-Chain (Summary)

| Data | Blockchain | Database | Reason |
|---|---|---|---|
| Batch ID hash | ✅ | ✅ | Core proof anchor |
| Beekeeper wallet address | ✅ | ✅ (hashed) | Provenance proof |
| IPFS CID | ✅ | ✅ | Immutable reference |
| Metadata hash | ✅ | ✅ | Tamper detection |
| Lab report hash | ✅ | ✅ | Certificate proof |
| Custody transfers | ✅ | ✅ | Chain of custody |
| Raw IoT sensor stream | ❌ | ✅ | Too large for chain |
| GPS coordinates | ❌ | ✅ (encrypted) | Privacy |
| Lab certificate PDF | ❌ | ✅ IPFS | Too large for chain |
| Farmer PII | ❌ | ✅ (protected) | Privacy/GDPR-aligned |

---

## 14. Security Architecture

### Threat Model

| Threat | Attack Vector | Our Mitigation |
|---|---|---|
| **Fake batch creation** | Unauthorized actor calls createBatch | OpenZeppelin `AccessControl` — wallet must have `BEEKEEPER_ROLE` |
| **QR Cloning** | Attacker copies valid QR to fake jar | Multi-layer: HMAC signature, blockchain lookup, duplicate scan analytics, recall system |
| **Database tampering** | Admin alters off-chain records | Blockchain hashes and IPFS CIDs cross-check DB; any alteration is detectable |
| **Private key theft** | Attacker steals blockchain wallet key | Key stored in environment secrets (never in Git); production uses hardware wallet / multisig |
| **Fake lab certificate** | Corrupt lab uploads a fake PDF | `LAB_ROLE` required on-chain; certificate hash committed; independent verification |
| **IPFS metadata swap** | Attacker modifies IPFS content | CID changes if content changes; on-chain hash mismatch detects it |
| **WhatsApp webhook spoofing** | Fake webhook payload | HMAC-SHA256 `x-hub-signature-256` header verified on every request |
| **Replay attacks** | Old signed QR re-submitted | Nonces in QR payload; active token table; nonce marked used after first scan |
| **Fake sensor data** | Rogue ESP32 device posts fake telemetry | Device token required for MQTT; anomaly detection flags implausible readings |

---

## 15. Development Roadmap

### Phase 1 — Foundation (Week 1)
- [x] Next.js project initialized
- [x] Prisma ORM schema (Beekeeper, WhatsAppUser, HoneyBatch)
- [x] WhatsApp webhook with HMAC verification
- [x] Redis FSM (conversation state per user)
- [x] AWS Bedrock integration (replacing Gemini)
- [x] WhatsApp bot: Registration flow
- [x] WhatsApp bot: Main menu with buttons
- [x] Web dashboard: Honey batch list view

### Phase 2 — Core Features (Week 2)
- [ ] Solidity smart contract (`HoneyChain.sol`) with AccessControl
- [ ] Hardhat setup and local tests
- [ ] Deploy to Polygon Amoy testnet
- [ ] `/api/batch` endpoint: creates batch, uploads to IPFS, registers on-chain
- [ ] WhatsApp harvest registration flow (connects to batch creation)
- [ ] Web dashboard: Lab certificate upload + hash commitment
- [ ] QR code generation (signed payload)
- [ ] QR verification page (reads blockchain + IPFS live)

### Phase 3 — IoT & AI (Week 3)
- [ ] ESP32 firmware (BME280 + HX711 → MQTT)
- [ ] MQTT broker setup and `/api/sensor-data` endpoint
- [ ] IoT dashboard (real-time charts on web dashboard)
- [ ] EfficientNet-B0 disease detection model training
- [ ] `POST /api/disease-detection` endpoint
- [ ] WhatsApp: Image upload → disease detection result
- [ ] XGBoost yield prediction model

### Phase 4 — Anti-Cloning & Polish (Week 4)
- [ ] QR duplicate scan detection and alert system
- [ ] Batch recall flow (admin UI + on-chain)
- [ ] Amazon Transcribe integration for WhatsApp voice notes
- [ ] Custody transfer flow (Distributor → Retailer)
- [ ] Full end-to-end demo recording
- [ ] README and documentation finalized

---

## 16. References & Research

### Government & Industry Sources
- KVIC: https://www.kvic.gov.in/
- National Bee Board: https://nbb.gov.in/
- FSSAI Honey Standards: https://www.fssai.gov.in/
- CSE Honey Adulteration Report (2020): https://www.cseindia.org/

### Blockchain & Smart Contract
- Polygon Documentation: https://docs.polygon.technology/
- Amoy Testnet Explorer: https://amoy.polygonscan.com/
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- Hardhat: https://hardhat.org/docs
- IPFS Docs: https://docs.ipfs.tech/
- Pinata API: https://docs.pinata.cloud/

### AI & Machine Learning
- Honey Bee Annotated Images (Dataset): https://www.kaggle.com/datasets/jenny18/honey-bee-annotated-images
- BeeAlarmed Dataset (TF): https://www.tensorflow.org/datasets/catalog/bee_dataset
- VarroaDataset (Zenodo): https://zenodo.org/records/4085044
- XGBoost Docs: https://xgboost.readthedocs.io/
- Amazon Bedrock: https://docs.aws.amazon.com/bedrock/

### Key Research Papers
1. Tian, F. (2016). Agri-food supply chain traceability using RFID & blockchain. — Baseline architecture reference.
2. Galvez et al. (2018). Future challenges for blockchain in food traceability. — Supports "blockchain is evidence integrity, not physical proof."
3. **Fujairah Honey Chain (2025)**: Blockchain framework for honey monitoring. DOI: 10.3390/info16080626 — **Closest reference to our project.**
4. Bilik et al. (2021). Visual Diagnosis of Varroa Destructor using object detection (YOLO). DOI: 10.3390/s21082764 — Bee disease AI reference.
5. Sabic et al. (2025). Smart Beehive Technologies Review. DOI: 10.3390/s25175359 — State of the art in precision beekeeping.
6. Kontogiannis (2019). IoT Low-Power Beekeeping Safety System. DOI: 10.3390/inventions4030052 — Rural IoT deployment guide.

---

> **Important Disclaimer:**
> Pollinator provides cryptographic proof of the **integrity and provenance of authenticity evidence** (lab certificates, custody records, IoT summaries). It does **not** physically test honey for purity. Physical honey authenticity requires FSSAI-aligned laboratory testing. The platform's role is to ensure those test results and custody records cannot be silently altered after the fact.
