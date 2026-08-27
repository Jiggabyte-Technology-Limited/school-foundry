# School Foundry (Offline Desktop DPG Edition) 🎓

> **An Open-Source, Offline-First Digital Public Good (DPG) for Last-Mile Educational Continuity & School Administration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Digital Public Goods Standard](https://img.shields.io/badge/DPGA-Aligned-00a4f1.svg)](docs/dpg-compliance/DPGA_STANDARD_ALIGNMENT.md)
[![SDG 4: Quality Education](https://img.shields.io/badge/SDG-4%20Quality%20Education-E5243B.svg)](https://sdgs.un.org/goals/goal4)
[![SDG 10: Reduced Inequalities](https://img.shields.io/badge/SDG-10%20Reduced%20Inequalities-DD1367.svg)](https://sdgs.un.org/goals/goal10)
[![Offline First](https://img.shields.io/badge/Architecture-Offline--First%20SQLite-10B981.svg)](#architecture)
[![Jurisdiction](https://img.shields.io/badge/Jurisdiction-Zambia%20(UNICEF%20Programme%20Country)-F59E0B.svg)](#)

---

## 🌍 The Problem & Our Mission

Across Sub-Saharan Africa, **over 65% of primary schools operate without basic electricity** (UNESCO UIS) and **over 80% lack pedagogical internet connectivity** (UNICEF/ITU Giga Initiative). 

In these off-grid, low-connectivity environments:
1. **Administrative Failure & Dropouts**: Schools rely on fragile paper ledgers and manual spreadsheets. When student records or fee payments cannot be verified during blackouts, children—especially vulnerable girls and orphans—are wrongfully barred from classes or exam halls.
2. **Institutional Financial Vulnerability**: Independent audits reveal that under-resourced schools lose **10%–20% of operational revenue to unrecorded transactions and reconciliation disputes**, threatening teacher retention and school survival.
3. **The SaaS Digital Divide**: Modern EdTech platforms require continuous broadband and per-student cloud subscriptions, excluding low-fee community and public schools.

**School Foundry** is a zero-dependency, offline-first school management ecosystem developed by **Jiggabyte Technology Limited** (Zambia). It enables primary, secondary, and community schools to maintain permanent student records, track vulnerable student subsidies (OVC), execute transparent fee reconciliation, and issue verifiable receipts—even with **zero internet connectivity** and **unstable electrical grids**.

---

## 🚀 Key Features

### 👨‍🎓 Student & Enrollment Lifecycle
- **Persistent Student Registry**: Permanent student database that persists across grades and academic years.
- **Academic Year Transitions**: Manage term promotions, grade transitions, and enrollment archives seamlessly.
- **Child Welfare & OVC Subsidy Tracking**: Flag students receiving government subsidies (e.g. Free Education Policy grants) or NGO bursaries to prevent punitive automated exclusions.

### 💰 High-Integrity Financial Operations
- **Interactive Payment Wizard**: Multi-step interface with validation checks to prevent double-entry and transaction errors.
- **Integer-Cent Arithmetic Engine**: All monetary values are calculated and stored in integer cents (e.g., 500.00 ZMW = 50000 cents) to eliminate floating-point rounding errors.
- **Instant Thermal & PDF Receipting**: Generates professional receipts with cryptographic verification hashes.

### 📡 Zero-Internet Multi-Device Hotspot Synchronization
- **Peer-to-Peer Subnet Discovery**: Runs a local UDP beacon on port `51741` to automatically discover other bursar laptops connected to the same Wi-Fi router or Windows Mobile Hotspot without internet.
- **Embedded Local HTTP Sync Engine**: Built-in HTTP replication server (port `51740`) synchronizes payments, student records, and fee structures in real-time.
- **Multi-Terminal Concurrency**: Uses UUID-based entity mapping and node-prefixed receipt numbers (`REC-T1-2026-XXXX`) so multiple bursars can record payments simultaneously offline without data collision.

### 🛡️ Physical & Local Disaster Recovery Layer
- **Mandatory USB Backup Prompt on Exit**: Automatically prompts the bursar on application close to save a timestamped `.db` backup to an external flash drive.
- **Monthly Reconciliation Paper Ledger**: Generates an immutable, cryptographically checksummed monthly paper audit ledger with signature blocks for physical filing in the school safe box.
- **Local-First Data Sovereignty**: Built in strict compliance with the **Zambian Data Protection Act No. 3 of 2021** and the **UN Convention on the Rights of the Child (General Comment No. 25)**.

---

## 🛠️ Technical Stack & Architecture

- **Runtime:** [Electron](https://www.electronjs.org/) (Cross-platform desktop app for Windows, Linux, and macOS)
- **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Local Database:** [SQLite3](https://www.sqlite.org/) with atomic transactions and strict foreign key integrity
- **Local Sync:** Embedded Node HTTP server + UDP beacon broadcast (`dgram`)
- **Bundler:** [Vite](https://vitejs.dev/)

---

## ⚡ Getting Started (Run in < 3 Minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20 LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/sewardrichard/school-foundry-offline.git
cd school-foundry-offline

# Install dependencies
npm install

# Start in development mode (Electron + React Vite HMR)
npm run dev
```

### 100% Free Community DPG Edition
School Foundry is completely free and open-source under the MIT License. On first launch, the app directly presents the Welcome & Setup Wizard with zero DRM, zero license keys, and zero machine fingerprinting.

### Building for Production
```bash
# Build standalone installer for Windows, Linux, or Mac
npm run build
```
The production installer will be output to the `release/` folder.

---

## 📚 Documentation Hub & Architecture

Comprehensive technical blueprints, user manuals, and compliance dossiers are available in the **[Documentation Hub](docs/README.md)**:

- **Technical Blueprints:**
  - **[System Architecture](docs/architecture/ARCHITECTURE.md)** & **[Database Schema](docs/architecture/DATABASE_SCHEMA.md)**
  - **[Local Hotspot Sync Protocol](docs/architecture/SYNC_ENGINE.md)**
- **User & Operator Manuals:**
  - **[Bursar Quick Start Guide](docs/guides/BURSAR_QUICK_START_GUIDE.md)** & **[User Guide](docs/guides/USER_GUIDE.md)**
  - **[Quick Reference Card](docs/guides/QUICK_REFERENCE.md)**
- **Digital Public Goods & Privacy:**
  - **[DPGA Standard Alignment Dossier](docs/dpg-compliance/DPGA_STANDARD_ALIGNMENT.md)**
  - **[Data Protection & Privacy Policy](docs/dpg-compliance/DATA_PROTECTION_AND_PRIVACY.md)**
  - **[UNICEF Venture Fund Proposal](docs/dpg-compliance/UNICEF_VENTURE_FUND.md)**
- **Commercialization:**
  - **[Marketing & Distribution](docs/gtm/MARKETING_AND_DISTRIBUTION.md)** & **[WhatsApp Outreach](docs/gtm/WHATSAPP_OUTREACH_PLAYBOOK.md)**

---

## 🤝 Contributing

We welcome contributions from educators, developers, and child welfare advocates worldwide!
Please read our **[Contributing Guidelines](CONTRIBUTING.md)** and **[Code of Conduct](CODE_OF_CONDUCT.md)** before submitting pull requests.

---

## 📝 License
School Foundry is open-source software licensed under the **[MIT License](LICENSE)**.

Developed in Zambia by **Jiggabyte Technology Limited**.
