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
  subgraph Stakeholders["👥 User Stakeholders & Touchpoints"]
    Farmer["🌾 Beekeeper / Farmer (WhatsApp Voice & Text)"]
    Processor["🏭 Processing Facility & Packaging Team"]
    Lab["🔬 Certified Quality Testing Lab"]
    Consumer["🛒 End Consumer (Smart Scanner)"]
  end

  subgraph BeehiveIoT["🐝 Physical Beehive & Star Topology IoT Layer"]
    subgraph Hive1["Hive #1 (Brood & Super Chambers)"]
      Sensors1["Sensors: Temp/Humidity (SHT31), Super Weight (HX711), Acoustic Mic (INMP441), Camera (ESP32-CAM)"]
    end
    subgraph Hive2["Hive #2"]
      Sensors2["Sensors: SHT31 Temp/Hum, HX711 Weight, INMP441 Mic"]
    end
    subgraph HiveN["Hive #N (Star Topology Nodes)"]
      SensorsN["Sensors: SHT31 Temp/Hum, HX711 Weight, INMP441 Mic"]
    end
    Gateway["📡 Central Field Gateway (ESP32 / 4G GSM Master Hub)"]
  end

  subgraph MQTTLayer["📶 MQTT Ingestion Layer (Star Topology)"]
    MQTTBroker["📨 MQTT Broker (Mosquitto / AWS IoT Core)"]
    IngestionWorker["⚡ Telemetry Ingestion Service (/api/sensor-data)"]
  end

  subgraph CloudBackend["☁️ AWS EC2 Cloud Infrastructure & Backend"]
    Nginx["🌐 NGINX Proxy + Let's Encrypt SSL (100.24.80.15.sslip.io)"]
    NextApp["⚡ Next.js 16 Full-Stack Engine (App Router)"]
    AuthMiddleware["🛡️ HMAC Signature Auth & Edge JWT Validator"]
    RedisFSM["🔄 Redis FSM (State Machine & Deduplication)"]
    PostgresDB[("🗄️ PostgreSQL Database (Prisma ORM)")]
  end

  subgraph AIIntelligence["🧠 AI Models & Health Analytics Engine"]
    GeminiNLP["🗣️ Google Gemini 3.5 Flash (Multimodal Audio & NLP)"]
    AcousticAI["🎵 Acoustic Buzzing Model (Swarming & Queen Piping)"]
    VisionAI["👁️ Computer Vision Model (Varroa Mite & Disease Detection)"]
    HiveScoreEngine["📊 Hive Health Score Algorithm (Weight, Temp, Humidity, Acoustics)"]
  end

  subgraph BlockchainIPFS["⛓️ Polygon Blockchain & Decentralized IPFS"]
    SmartContract["📜 HoneyChain.sol (Polygon Amoy Testnet)"]
    PinataIPFS["📦 Pinata IPFS Distributed Storage (Lab Certs & Metadata)"]
    CustodyEngine["🤝 Custody Transfer State Machine"]
  end

  subgraph AntiCloneEngine["🛡️ Anti-QR Cloning & Consumer Verification"]
    HMACSigner["🔐 Dynamic HMAC-SHA256 Token Generator"]
    GeoAudit["🗺️ Geo-Fencing & Scan Velocity Anomaly Detector"]
    RecallEngine["🚨 One-Click Cryptographic Recall System"]
  end

  %% Star Topology Telemetry Stream
  Sensors1 -->|ESP-NOW / LoRa| Gateway
  Sensors2 -->|ESP-NOW / LoRa| Gateway
  SensorsN -->|ESP-NOW / LoRa| Gateway
  Gateway -->|MQTT Pub: telemetry/hive_id| MQTTBroker
  MQTTBroker -->|Forward Telemetry Payload| IngestionWorker
  IngestionWorker --> NextApp

  %% User Ingress
  Farmer -->|WhatsApp Voice Note / Text| Nginx
  Processor -->|Batch Packaging & Custody Handover| Nginx
  Lab -->|Purity Certificate & NMR Upload| Nginx
  Consumer -->|Scan Anti-Clone QR Code| Nginx

  %% Edge & Processing
  Nginx --> AuthMiddleware
  AuthMiddleware --> NextApp
  NextApp <--> RedisFSM
  NextApp <--> PostgresDB

  %% AI Processing
  NextApp -->|Audio/Text Payload| GeminiNLP
  IngestionWorker -->|FFT Acoustic Analysis| AcousticAI
  NextApp -->|Hive Photo Inspection| VisionAI
  IngestionWorker & PostgresDB --> HiveScoreEngine
  HiveScoreEngine -->|Health Score 0-100| PostgresDB

  %% Blockchain & Storage
  NextApp -->|Mint Honey Batch NFT| SmartContract
  NextApp -->|Pin NMR & Purity Reports| PinataIPFS
  PinataIPFS -->|IPFS Hash (CID)| SmartContract
  Processor -->|Initiate Custody Transfer| CustodyEngine
  CustodyEngine -->|On-Chain Ownership Record| SmartContract

  %% Anti-Clone & Verification
  NextApp -->|Generate Secure QR Label| HMACSigner
  Consumer -->|Verify Honey Purity| AntiCloneEngine
  AntiCloneEngine --> GeoAudit
  GeoAudit -->|Increment Scan Count & Check Geo-Anomaly| PostgresDB
  RecallEngine -.->|Flag Compromised Batch| SmartContract
  RecallEngine -.->|Invalidate QR Codes| AntiCloneEngine
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
