# 🐝 Pollinator (HoneyChain Ecosystem)

> **Decentralized Honey Supply Chain, IoT Hive Intelligence & Multilingual WhatsApp AI Assistant**  
> *Built for Bharat Builds Tour / AWS First Commit Hackathon 2026*

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Polygon Amoy](https://img.shields.io/badge/Polygon-Amoy_Testnet-8247E5?style=flat&logo=polygon)](https://polygon.technology/)
[![AWS Native](https://img.shields.io/badge/AWS-EC2_|_S3_|_SSM-FF9900?style=flat&logo=amazon-aws)](https://aws.amazon.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash_|_Multimodal-4285F4?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)
[![Meta WhatsApp](https://img.shields.io/badge/Meta_Cloud_API-WhatsApp_Bot-25D366?style=flat&logo=whatsapp)](https://developers.facebook.com/docs/whatsapp)
[![Prisma ORM](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Redis FSM](https://img.shields.io/badge/Redis-FSM_State_Machine-DC382D?style=flat&logo=redis)](https://redis.io/)

---

## 🍯 Executive Summary

The Indian apiculture industry faces two critical challenges:
1. **Middlemen Exploitation:** Smallholder beekeepers receive low farmgate prices while adulterated synthetic syrups flood the retail market.
2. **Technological Barrier:** Most rural beekeepers lack modern smartphones, crypto wallets, or English fluency to access transparent blockchain and IoT monitoring platforms.

**Pollinator** bridges this divide by delivering an end-to-end hardware-to-blockchain traceability ecosystem with a **zero-friction WhatsApp AI interface** (`Forager Bot`). Farmers interact in their native language (Hindi, Telugu, Tamil, Marathi, Bengali, English) via **voice notes and text**, while an **AWS-hosted Next.js engine** pairs their IoT hive sensors, mints cryptographic ERC-721 batch provenance on **Polygon Amoy**, and generates anti-counterfeit QR codes with real-time audit trails.

---

## 🌟 Key Architecture & Capabilities

### 1. 🤖 Multilingual WhatsApp AI & Voice Agent (`Forager Bot`)
* **Voice Note Chatting:** Natively processes WhatsApp voice notes (`audio/ogg`) using Gemini multimodal transcription and intent classification.
* **Frictionless Onboarding:** Welcomes new users without forcing registration, providing interactive guidance and answering beekeeping questions.
* **Dialect & Language Detection:** Automatically identifies regional Indian languages and adapts responses dynamically.
* **Real-Time Market Prices:** Delivers current farmgate rates for Mustard, Multiflora, Litchi, and Raw honey.
* **Government Scheme Guidance:** Step-by-step information on the **KVIC National Honey Mission** 80% subsidy and National Bee Board (NBB) support.
* **Beekeeping Advisor:** Diagnostic tips on Varroa mite treatment, queen bee acoustics, and seasonal brood management.

### 2. 🌡️ Smart IoT Hive Telemetry
* **Live Environmental Telemetry:** Continuous tracking of brood temperature, humidity, super weight, and battery levels from ESP32 field devices.
* **Acoustic & Anomaly Alerts:** Detection of swarming conditions (elevated temperatures >37°C) and pest infestation risks.
* **One-Touch Pairing:** Farmers can pair any smart box directly via WhatsApp using device IDs (e.g. `ESP32-001`).

### 3. ⛓️ Blockchain Provenance & Anti-Clone Verification
* **Cryptographic Batch Minting:** Honey harvests are minted as verifiable records on the **Polygon Amoy Testnet** with IPFS lab reports stored on Pinata.
* **HMAC-Protected Anti-Clone QR Codes:** Time-and-hash validated QR codes with geo-fencing to prevent packaging counterfeiting.
* **Deterministic Custodial Wallets:** Rural farmers do not need MetaMask. Wallets are derived deterministically using HMAC-SHA256, enabling zero-friction onboarding.

### 4. 📊 Enterprise Web Dashboard
* **Role-Based Workflows:** Tailored interfaces for Beekeepers, Processors, Certified Quality Testing Labs, and Regulatory Admins.
* **One-Click Recall Engine:** Instant cryptographic flagging of contaminated or adulterated batches across the distribution chain.

---

## 🏗️ System Architecture

```mermaid
flowchart TD

  %% -----------------------------------------------------------
  %% LAYER 1: FIELD IOT SENSING & USER TOUCHPOINTS
  %% -----------------------------------------------------------
  subgraph Layer1["1️⃣ Ingress: Field IoT & Stakeholder Touchpoints"]
    direction TB
    subgraph SubIoT["🐝 Physical Apiary & Star IoT Mesh"]
      direction TB
      HiveNode["🏠 Physical Smart Beehives (Brood & Super Chambers)<br/>• SHT31: Brood Temp & Humidity Sensor<br/>• HX711: Super Weight & Nectar Flow Load Cell<br/>• INMP441: Acoustic Microphone (Colony Buzzing)<br/>• ESP32-CAM: Visual Comb & Pest Inspection"]
      FieldGateway["📡 Central Apiary Field Gateway Hub<br/>Solar Powered ESP32 + 4G/LTE GSM Master"]
    end

    subgraph SubUsers["👥 User Stakeholders & Touchpoints"]
      direction TB
      Farmer["🌾 Beekeeper / Farmer<br/>(WhatsApp Voice & Text Interface)"]
      Processor["🏭 Honey Processor & Packaging Team<br/>(Batch Packaging & Custody Handover)"]
      Lab["🔬 Certified Quality Testing Lab<br/>(Purity & NMR Report Upload Portal)"]
      Consumer["🛒 End Consumer<br/>(Smart QR Scanner & Provenance Portal)"]
    end
  end

  %% -----------------------------------------------------------
  %% LAYER 2: INGESTION & GATEWAY ROUTING
  %% -----------------------------------------------------------
  subgraph Layer2["2️⃣ Ingestion, Edge Gateway & Security"]
    direction TB
    MQTTBroker["📨 MQTT Star Topology Broker (Mosquitto / AWS IoT Core)<br/>Topic: telemetry/{apiary_id}/{hive_id}"]
    IngestWorker["⚡ Telemetry Ingestion Worker (/api/sensor-data)<br/>Payload Decompression & Normalization"]
    NginxSSL["🌐 NGINX Reverse Proxy + Let's Encrypt SSL<br/>(100.24.80.15.sslip.io)"]
    AuthEdge["🛡️ Edge Security & HMAC Signature Validator<br/>Rate Limiter & Anti-Replay Guard"]
  end

  %% -----------------------------------------------------------
  %% LAYER 3: AWS CORE CLOUD BACKEND & DATA
  %% -----------------------------------------------------------
  subgraph Layer3["3️⃣ AWS EC2 Cloud Core Backend & Persistence"]
    direction TB
    NextApp["⚡ Next.js 16 Full-Stack Engine (App Router)<br/>APIs, WhatsApp Webhook & Server Actions"]
    RedisFSM["🔄 Redis / In-Memory FSM<br/>Session State Machine & Message Deduplication"]
    PostgresDB[("🗄️ PostgreSQL Database (Prisma ORM)<br/>Sensor Telemetry, Batches, Custody & Audit Logs")]
  end

  %% -----------------------------------------------------------
  %% LAYER 4: SPECIALIZED PROCESSING, TRUST & SECURITY ENGINES
  %% -----------------------------------------------------------
  subgraph Layer4["4️⃣ AI Intelligence, Blockchain & Anti-Clone Security"]
    direction TB

    subgraph AIEngine["🧠 AI Models & Health Analytics Engine"]
      direction TB
      GeminiVoice["🗣️ Google Gemini 3.5 Flash<br/>Multimodal Voice Transcription & Intent NLP"]
      AcousticAI["🎵 Acoustic Buzzing Model<br/>FFT Frequency Analysis: Swarming & Queen Piping"]
      VisionAI["👁️ Computer Vision Model<br/>Varroa Mite, Foulbrood & Pest Detection"]
      HiveScoreEngine["📊 Hive Health Score Algorithm<br/>Weight + Brood Temp + Humidity + Sound FFT"]
    end

    subgraph TrustEngine["⛓️ Blockchain, Storage & Custody Transfer"]
      direction TB
      PinataIPFS["📦 Pinata IPFS Distributed Storage<br/>Lab Certificates, NMR Spectra & Provenance CIDs"]
      SmartContract["📜 HoneyChain.sol (Polygon Amoy Testnet)<br/>ERC-721 Batch Provenance & Immutable Ledger"]
      CustodyEngine["🤝 Custody Transfer Protocol<br/>Beekeeper -> Processor -> Distributor -> Retailer"]
    end

    subgraph SecurityEngine["🛡️ Anti-QR Cloning & Verification Engine"]
      direction TB
      HMACSigner["🔐 Dynamic HMAC-SHA256 Token Generator<br/>Unique Cryptographic Seal per Honey Jar"]
      GeoAudit["🗺️ Geo-Fencing & Scan Velocity Anomaly Detector<br/>Counterfeit Clone Flagging & Replay Prevention"]
      RecallEngine["🚨 Cryptographic Batch Recall System<br/>Instant Batch Invalidation & Consumer Warning"]
    end
  end

  %% --- Field IoT Edge Flow ---
  HiveNode -->|"ESP-NOW / LoRa Star Mesh"| FieldGateway
  FieldGateway -->|"Cellular MQTT Publish"| MQTTBroker
  MQTTBroker -->|"Forward Telemetry"| IngestWorker
  IngestWorker -->|"Ingest Sensor Data"| NextApp

  %% --- User Ingress Flow ---
  Farmer -->|"WhatsApp Voice & Text"| NginxSSL
  Processor -->|"Custody Handover & Packaging"| NginxSSL
  Lab -->|"Upload Purity Certificate"| NginxSSL
  Consumer -->|"Scan Smart QR Label"| NginxSSL
  NginxSSL -->|"Reverse Proxy"| AuthEdge
  AuthEdge -->|"Validated Requests"| NextApp

  %% --- Core State & Persistence Flow ---
  NextApp -->|"Session State"| RedisFSM
  RedisFSM -->|"State Sync"| NextApp
  NextApp -->|"Read & Write Records"| PostgresDB
  PostgresDB -->|"Data Queries"| NextApp

  %% --- AI Diagnostics Pipelines ---
  NextApp -->|"Audio Voice Notes (.ogg)"| GeminiVoice
  NextApp -->|"Acoustic Audio Samples (.wav)"| AcousticAI
  NextApp -->|"Comb Imagery"| VisionAI
  NextApp -->|"Telemetry Vectors"| HiveScoreEngine
  HiveScoreEngine -->|"Store Health Score 0-100"| PostgresDB

  %% --- Trust & Custody Pipelines ---
  NextApp -->|"Upload Lab Certs"| PinataIPFS
  PinataIPFS -->|"IPFS Metadata CID"| SmartContract
  NextApp -->|"Mint Honey Batch NFT"| SmartContract
  NextApp -->|"Initiate Custody Handover"| CustodyEngine
  CustodyEngine -->|"Update Custodian On-Chain"| SmartContract

  %% --- Anti-Clone Security Pipelines ---
  NextApp -->|"Generate Secure QR Token"| HMACSigner
  NextApp -->|"Audit Scan Location & Speed"| GeoAudit
  GeoAudit -->|"Record Scan Event"| PostgresDB
  RecallEngine -.->|"Flag Compromised Batch"| SmartContract
  RecallEngine -.->|"Invalidate QR Tokens"| NextApp
```

### 🔄 End-to-End Honey Lifecycle & Custody Transfer Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as 🌾 Beekeeper
    participant Hive as 🐝 Smart Hive (IoT)
    participant MQTT as 📡 MQTT Broker
    participant Backend as ⚡ Next.js / AWS EC2
    participant AI as 🧠 AI Models (Gemini/Audio/CV)
    participant DB as 🗄️ PostgreSQL (Prisma)
    participant Chain as ⛓️ Polygon Amoy
    participant IPFS as 📦 Pinata IPFS
    actor Processor as 🏭 Honey Processor
    actor Consumer as 🛒 End Consumer

    %% 1. Telemetry & Scoring
    Hive->>MQTT: Publish Temp, Humidity, Weight, Acoustic (.wav) via Star Topology
    MQTT->>Backend: Ingest Telemetry (/api/sensor-data)
    Backend->>AI: Analyze Acoustic Buzzing + SHT31/HX711 Telemetry
    AI-->>Backend: Anomaly: None | Hive Score: 94/100 (Optimal Brood)
    Backend->>DB: Store Sensor Readings & Hive Health Score

    %% 2. Harvest Logging via WhatsApp
    Farmer->>Backend: WhatsApp Voice Note: "Logging 25kg Multiflora Harvest"
    Backend->>AI: Gemini Multimodal Transcribe & Intent Classify
    Backend->>Chain: Mint Honey Batch (Token ID, Harvest Hash, Hive Score)
    Chain-->>Backend: Polygon TX Hash (0x4B65...)
    Backend-->>Farmer: WhatsApp Confirmation + Blockchain Explorer Link

    %% 3. Lab Testing & IPFS
    Backend->>IPFS: Upload Lab Purity Certificate & NMR Analysis
    IPFS-->>Backend: Return CID (QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco)
    Backend->>Chain: Attach IPFS CID to Batch On-Chain

    %% 4. Custody Transfer
    Farmer->>Processor: Handover Physical Honey Consignment
    Processor->>Backend: Request Custody Transfer (Batch Code)
    Backend->>Chain: Update Custodian Address (Beekeeper -> Processor)
    Backend->>DB: Record Audit Trail with Timestamp & Geo Coordinates

    %% 5. Packaging & Anti-Clone QR Generation
    Processor->>Backend: Package Honey into 500g Jars
    Backend->>Backend: Generate Dynamic Anti-Clone QR (HMAC-SHA256 + Batch ID)
    Backend-->>Processor: Download Crypto-Tamper-Proof QR Labels

    %% 6. Consumer Verification
    Consumer->>Backend: Scan QR Code on Honey Jar (/verify?code=...&hmac=...)
    Backend->>Backend: Validate Cryptographic HMAC Signature
    Backend->>DB: Increment Scan Count & Check Geo-Anomaly Velocity
    Backend->>Chain: Query Real-Time On-Chain Batch & Recall Status
    Backend->>IPFS: Fetch Original Lab Purity Certificate
    Backend-->>Consumer: Display Holographic Provenance Journey & Purity Proof
```

---

## 🔬 Deep-Dive: Core Technical Components

### 1. 📡 Star Topology IoT Architecture & MQTT Broker
Each apiary operates on a **Star Topology Mesh**:
* **Sensor Nodes:** Individual hives contain lightweight microcontrollers (ESP32/ESP8266) equipped with:
  * **SHT31 / DHT22:** High-precision brood temperature (±0.2°C) and relative humidity.
  * **HX711 Load Cell:** Continuous super weight tracking (detecting nectar flow vs. consumption).
  * **INMP441 I2S Microphone:** Acoustic audio sampling of hive buzzing frequencies (100 Hz – 600 Hz).
  * **ESP32-CAM:** Periodic visual inspection snapshots of landing boards.
* **Star Topology Master Gateway:** Field hives broadcast telemetry locally via low-power ESP-NOW / LoRa to a central Solar-Powered GSM Gateway.
* **MQTT Broker:** The gateway publishes compressed JSON packets over cellular MQTT to Mosquitto / AWS IoT Core (`telemetry/{apiary_id}/{hive_id}`).

### 2. 🧠 AI Intelligence Layer & Hive Scoring Engine
* **Acoustic Buzzing Frequency Analysis:**
  * Healthy Queen/Colony: Dominant frequency band around $200\text{--}250\text{ Hz}$.
  * Swarming Impending: Audio spikes in the $450\text{--}600\text{ Hz}$ range ("piping" sounds) triggers automated early swarming warnings.
* **Computer Vision Disease Detection:**
  * Analyzes landing board and comb imagery using transfer-learned models to identify Varroa mite infestation, American Foulbrood, and wax moth larvae.
* **Dynamic Hive Health Score Algorithm:**
  $$\text{Hive Score} = w_T \cdot S_T(T) + w_H \cdot S_H(H) + w_W \cdot S_W(\Delta W) + w_A \cdot S_A(f) - D_{\text{penalty}}$$
  * $S_T$: Optimal brood temperature score ($34.5\text{--}35.5^\circ\text{C}$).
  * $S_H$: Relative humidity score ($40\text{--}60\%$).
  * $S_W$: Weight trend derivative (positive delta during harvest flow).
  * $S_A$: Acoustic stability index.
  * $D_{\text{penalty}}$: Penalties from visual disease detections.

### 3. 🛡️ Anti-Clone Cryptographic QR System
Standard QR codes are trivially copy-pasted onto fake honey jars. Pollinator prevents counterfeiting through a 4-tier security defense:
1. **Dynamic HMAC-SHA256 Tokenization:** Each QR URL contains a tamper-evident signature computed from the secret salt, batch identifier, and jar packaging index:
   $$\text{Token} = \text{HMAC-SHA256}(K_{\text{secret}}, \text{BatchCode} \mathbin{\Vert} \text{JarID})$$
2. **Scan Velocity & Geo-Anomaly Detection:** If the same jar QR code is scanned in New Delhi and Mumbai within 10 minutes, the engine automatically flags the batch as cloned and triggers an inspection alert.
3. **Scan Counter Invalidation:** The first scan indicates consumer purchase. Subsequent scans display warning badges highlighting potential package re-use.
4. **Cryptographic One-Click Recall:** Administrators can instantly revoke a compromised batch on-chain, rendering all associated QR codes immediately "RECALLED / DO NOT CONSUME" globally.

### 4. 🤝 Decentralized Custody Transfer State Machine
Every honey consignment moves through an immutable state ladder:
$$\text{Harvested} \longrightarrow \text{Lab Tested} \longrightarrow \text{Transferred to Processor} \longrightarrow \text{Packaged} \longrightarrow \text{Consumer Distributed}$$
* Handover between beekeepers and processors requires dual-party confirmation on Polygon Amoy.
* Batch metadata, including chemical analysis (Fructose/Glucose ratio, HMF, Moisture %, NMR spectral report), is permanently pinned to IPFS via Pinata.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend & API** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Cloud Infrastructure** | AWS EC2 (t3.small), Amazon S3, AWS Systems Manager (SSM), NGINX |
| **Artificial Intelligence** | Google Gemini 3.5 Flash / Flash Lite (Multimodal Audio & Intent Recognition), Amazon Bedrock Proxy |
| **State & Database** | Redis (Finite State Machine), PostgreSQL (Prisma ORM) |
| **Blockchain & Web3** | Solidity, Hardhat, Ethers.js v6, Polygon Amoy Testnet, Pinata IPFS |
| **Messaging & IoT** | Meta WhatsApp Cloud API, ESP32 IoT Sensor Protocols |
| **Security & Cryptography** | HMAC-SHA256 Webhook Verification, Let's Encrypt Automated SSL, EVM Deterministic Wallets |

---

## 🚀 Live Deployment Information

* **Web Dashboard:** [http://100.24.80.15](http://100.24.80.15)
* **Permanent HTTPS Webhook URL:** `https://100.24.80.15.sslip.io/api/webhook/whatsapp`
* **Verified WhatsApp Bot Phone:** `+91 88822 91014`
* **Polygon Amoy Smart Contract:** [`0x4B650a3d926A8f777f96422d790B0e36eB29b47a`](https://amoy.polygonscan.com/address/0x4B650a3d926A8f777f96422d790B0e36eB29b47a)
* **Meta Verify Token:** `honeychain_verify_2026`

---

## 💬 WhatsApp Forager Bot Flow

### Sample Farmer Interaction (Voice or Text)

```text
Farmer: "Hi"
Bot:    "👋 Welcome to HoneyChain & Pollinator!
         We connect beekeepers directly to fair markets and IoT hive monitoring on Polygon.
         How can I help you today?
         [1] Register Now
         [2] About Platform
         [3] Ask a Question"

Farmer (Voice Note in Hindi): "सरसों के शहद का आज का भाव क्या है?"
Bot:    "💰 Current Honey Market Rates:
         • Mustard Honey: ₹100–130/kg
         • Litchi Honey: ₹150–180/kg
         • Multiflora Honey: ₹90–120/kg
         🏛️ KVIC National Honey Mission offers up to 80% subsidy on 10 bee boxes."

Farmer: "Show my hive status"
Bot:    "🌡️ Your Hive IoT Status:
         📦 Hive ESP32-001
         • Temperature: 34.8°C (Optimal brood temp ✅)
         • Humidity: 46.2% (Healthy range ✅)
         • Super Weight: 24.5 kg (+1.2 kg gain this week 🍯)
         • Battery: 94% 🔋"
```

---

## 💻 Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Sonal-ai/Pollinator.git
cd Pollinator
npm install --legacy-peer-deps
```

### 2. Environment Variables Configuration
Create a `.env` file in the root directory:

```env
# Database & Cache
DATABASE_URL="postgresql://pollinator:dev_password_only@localhost:5432/pollinator?schema=public"
REDIS_URL="redis://localhost:6379"

# Meta WhatsApp Cloud API
WHATSAPP_PHONE_ID="your_phone_number_id"
WHATSAPP_ACCESS_TOKEN="your_meta_system_user_token"
WHATSAPP_APP_SECRET="your_app_secret"
WHATSAPP_VERIFY_TOKEN="honeychain_verify_2026"

# AI Layer
GEMINI_API_KEY="your_gemini_api_key"

# Blockchain (Polygon Amoy)
BLOCKCHAIN_NETWORK="amoy"
POLYGON_RPC_URL="https://polygon-amoy-bor-rpc.publicnode.com"
CONTRACT_ADDRESS="0x4B650a3d926A8f777f96422d790B0e36eB29b47a"
PRIVATE_KEY="your_wallet_private_key"

# IPFS Pinata
IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs/"
PINATA_JWT="your_pinata_jwt"

# Security & App URL
QR_HMAC_SECRET="at_least_32_character_random_hex_string"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Migration & Seeding
```bash
npx prisma db push
node seed.js
```

### 4. Smart Contract Compilation (Optional)
```bash
npm run compile:chain
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🔒 Security & Reliability Implementations

* **Meta HMAC-SHA256 Header Validation:** Every webhook request is cryptographically validated using the app secret to block spoofed or unauthorized triggers.
* **Resilient FSM Architecture:** Session states utilize Redis with in-memory caching fallbacks to guarantee zero message loss during network hiccups.
* **Deterministic EVM Custody:** Farmer addresses are derived using HMAC-SHA256 against their phone ID, removing private key management friction while keeping on-chain records distinct.
* **Native SSL on AWS:** Automatic SSL certificate issuance and renewal through Let's Encrypt on NGINX (`100.24.80.15.sslip.io`).

---

## 👥 Team & Acknowledgments

* **Project:** Pollinator (HoneyChain)
* **Hackathon:** Bharat Builds Tour / AWS First Commit 2026
* **Organized by:** AWS & WeMakeDevs
* **Built by:** Sonal Verma & Team
