# School Foundry (Offline Desktop DPG Edition) 🎓

> **An Open-Source, Offline-First Digital Public Good (DPG) for Last-Mile Educational Continuity & School Administration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Digital Public Goods Standard](https://img.shields.io/badge/DPGA-Aligned-00a4f1.svg)](docs/DPGA_STANDARD_ALIGNMENT.md)
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

### 🛡️ Child Safeguarding & Data Sovereignty
- **Local-First Storage**: Built in strict compliance with the **Zambian Data Protection Act No. 3 of 2021** and the **UN Convention on the Rights of the Child (General Comment No. 25)**.
- **Zero Telemetry**: No third-party analytics pixels, no behavioral tracking, and no ad monetization.
- **Immutable Audit Trail (`activity_log`)**: Automatically logs all administrative actions for transparent institutional governance.

---

## 🛠️ Technical Stack & Architecture

- **Runtime:** [Electron](https://www.electronjs.org/) (Cross-platform desktop app for Windows, Linux, and macOS)
- **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Local Database:** [SQLite3](https://www.sqlite.org/) with atomic transactions and strict foreign key integrity
- **Bundler:** [Vite](https://vitejs.dev/)

```text
src/
├── main.ts              # Electron Main Process & SQLite Core Lifecycle
├── renderer.tsx         # React SPA Renderer & Client Router
├── components/          # Modular UI (Payments, Student Manager, Class Lists, etc.)
│   ├── auth/            # Authentication & License Gate
│   ├── payments/        # Payment Wizard & Receipt Generation
│   └── student-accounts/# Ledger & Financial Overview Panels
├── db/                  # SQLite Schema, Migrations, and IPC Bridge
├── license/             # Open Source DPG & Fleet Activation Validator
├── services/            # Core business logic services
└── lib/                 # Database client, auth context, machine fingerprinting
```

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

### Free Community Edition Activation
On initial startup, click **"🌐 Unlock Free Community Edition (Digital Public Good)"** or enter `DPGA-OPEN-SOURCE-COMMUNITY` to immediately access all features unrestricted.

### Building for Production
```bash
# Build standalone installer for Windows, Linux, or Mac
npm run build
```
The production installer will be output to the `release/` folder.

---

## 🌐 Digital Public Goods & UNICEF Alignment

School Foundry is designed and maintained as a **Digital Public Good (DPG)**:
- **[DPGA Standard Alignment Dossier](docs/DPGA_STANDARD_ALIGNMENT.md)**: 9-indicator self-assessment.
- **[UNICEF Venture Fund Grant Proposal](docs/UNICEF_VENTURE_FUND_APPLICATION.md)**: \$100k seed funding dossier.
- **[2-Minute Demo Video Storyboard](docs/APPLICATION_VIDEO_STORYBOARD.md)**: Screencast script and recording checklist.
- **[Child Safeguarding & Data Privacy Protocol](SECURITY_AND_PRIVACY.md)**: Zambian Data Protection Act compliance.

---

## 🤝 Contributing

We welcome contributions from educators, developers, and child welfare advocates worldwide!
Please read our **[Contributing Guidelines](CONTRIBUTING.md)** and **[Code of Conduct](CODE_OF_CONDUCT.md)** before submitting pull requests.

---

## 📝 License
School Foundry is open-source software licensed under the **[MIT License](LICENSE)**.

Developed in Zambia by **Jiggabyte Technology Limited**.
