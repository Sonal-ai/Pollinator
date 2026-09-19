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

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           FARMER TOUCHPOINTS                            │
│    WhatsApp Voice Note (.ogg) / Text in Hindi, Telugu, Marathi, etc.    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      META WHATSAPP CLOUD API                            │
│            Webhook Delivery with HMAC-SHA256 Signatures                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AWS CLOUD INFRASTRUCTURE (EC2)                        │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ NGINX Reverse Proxy + Let's Encrypt Native SSL (100.24.80.15)     │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────▼─────────────────────────────────┐  │
│  │ Next.js 16 Engine (/api/webhook/whatsapp) (PM2 Process)           │  │
│  │                                                                   │  │
│  │  • Gemini Multimodal Audio Transcription & Intent Analysis         │  │
│  │  • Redis Finite State Machine (FSM) with In-Memory Fallback       │  │
│  │  • Prisma ORM with PostgreSQL Database                            │  │
│  │  • Deterministic EVM Custodial Wallet Derivation                  │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     POLYGON BLOCKCHAIN        │               │       DECENTRALIZED IPFS      │
│  Smart Contracts on Amoy      │               │  Pinata Distributed Gateway   │
│  • ERC-721 Honey Batch Mint   │               │  • Lab Quality Certificates   │
│  • Custody Transfer Records   │               │  • Batch Metadata & Hashes    │
└───────────────────────────────┘               └───────────────────────────────┘
```

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
