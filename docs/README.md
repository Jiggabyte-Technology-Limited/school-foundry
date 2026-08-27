# School Foundry — Documentation Hub 📚

> **Central Knowledge Base & Technical Architecture for School Foundry (Offline Digital Public Good Edition)**

Welcome to the centralized documentation directory for School Foundry. Every document is categorized by its functional domain below.

---

## 🏗️ 1. Technical & System Architecture

Technical blueprints, database designs, and offline replication protocols for engineers and systems architects.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[System Architecture](architecture/ARCHITECTURE.md)** | Overview of Electron Main/Renderer architecture, IPC bridges, and local SQLite data lifecycle. | Full-Stack Engineers, DevOps |
| **[Database Schema](architecture/DATABASE_SCHEMA.md)** | Complete relational schema design, foreign key constraints, integer-cent arithmetic, and index layouts. | Database Engineers, Contributor |
| **[Tech Stack](architecture/TECH_STACK.md)** | Deep breakdown of dependencies: React 19, TypeScript, Electron, Vite, Tailwind CSS, and SQLite3. | Frontend & Desktop Developers |
| **[Local Hotspot Sync Engine](architecture/SYNC_ENGINE.md)** | UDP broadcast discovery beacon (`dgram`) and HTTP delta replication protocol for multi-device offline concurrency. | Systems & Network Architects |

---

## 📘 2. User & Operational Manuals

Step-by-step operational workflows, bursar cheat sheets, and school administration guides.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[Bursar Quick Start Guide](guides/BURSAR_QUICK_START_GUIDE.md)** | 1-page daily workflow: morning verification, recording cash/mobile payments, and issuing thermal receipts. | Bursars, Cashiers, Clerks |
| **[Comprehensive User Guide](guides/USER_GUIDE.md)** | Module-by-module walkthrough covering learner enrollment, fee structures, statement exports, and year rollovers. | Headteachers, Administrators |
| **[Quick Reference Card](guides/QUICK_REFERENCE.md)** | Keyboard shortcuts, receipt rules, troubleshooting table, and end-of-day checklist. | Front-Desk Operators |
| **[Branding & Design System](guides/BRANDING_GUIDE.md)** | Brand colors, logo assets, typography, receipt layout rules, and design tokens. | UI Designers, Contributors |

---

## 🌐 3. Digital Public Goods, Privacy & Governance

Compliance matrices, data protection policies, and institutional grant dossiers.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[DPGA Standard Alignment](dpg-compliance/DPGA_STANDARD_ALIGNMENT.md)** | 9-indicator compliance assessment for formal recognition as an open Digital Public Good (SDG 4, 10). | DPGA Reviewers, Donors, UN |
| **[Data Protection & Privacy Policy](dpg-compliance/DATA_PROTECTION_AND_PRIVACY.md)** | Strict compliance with the Zambian Data Protection Act No. 3 of 2021 and zero-telemetry child protection rules. | Compliance Officers, Ministries |
| **[UNICEF Venture Fund Dossier](dpg-compliance/UNICEF_VENTURE_FUND.md)** | \$100k grant proposal and mission narrative for last-mile offline educational administration in Sub-Saharan Africa. | Grant Reviewers, NGO Donors |

---

## 📈 4. Go-to-Market & Commercial Strategy

Distribution channels, CSR donor packaging, and headmaster WhatsApp engagement playbooks.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[Marketing & Distribution](gtm/MARKETING_AND_DISTRIBUTION.md)** | "Adopt-a-School" CSR donor bundling model, District School Inspector (DSI) partnerships, and hardware kits. | Venture Architects, Sales Ops |
| **[WhatsApp Outreach Playbook](gtm/WHATSAPP_OUTREACH_PLAYBOOK.md)** | Conversational sales scripts, video demo distribution tactics, and regional headmaster WhatsApp group strategies. | GTM Strategists, Field Reps |

---

## 🧭 Document Navigation Map

```text
docs/
├── README.md                          # 📍 You are here (Master Hub)
│
├── architecture/                      # 🏗️ Technical Specifications
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── TECH_STACK.md
│   └── SYNC_ENGINE.md
│
├── guides/                            # 📘 Manuals & Runbooks
│   ├── BURSAR_QUICK_START_GUIDE.md
│   ├── USER_GUIDE.md
│   ├── QUICK_REFERENCE.md
│   └── BRANDING_GUIDE.md
│
├── dpg-compliance/                    # 🌐 DPGA, Privacy & Grants
│   ├── DPGA_STANDARD_ALIGNMENT.md
│   ├── DATA_PROTECTION_AND_PRIVACY.md
│   └── UNICEF_VENTURE_FUND.md
│
└── gtm/                               # 📈 Commercial & Outreach
    ├── MARKETING_AND_DISTRIBUTION.md
    └── WHATSAPP_OUTREACH_PLAYBOOK.md
```
