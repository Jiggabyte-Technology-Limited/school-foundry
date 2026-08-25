# Digital Public Goods Alliance (DPGA) Standard Alignment Dossier

> **Project Name:** School Foundry (Offline Desktop DPG Edition)  
> **Repository:** https://github.com/sewardrichard/school-foundry-offline  
> **Entity:** Jiggabyte Technology Limited (Zambia)  
> **Target Sustainable Development Goals:** SDG 4 (Quality Education), SDG 10 (Reduced Inequalities), SDG 1 (No Poverty)  
> **Standard Version:** DPGA Standard v1.3  

---

## Executive Summary

School Foundry is an open-source, offline-first school management ecosystem specifically engineered for low-resource and low-connectivity environments in emerging markets. It enables primary, secondary, and community schools to maintain accurate student enrollment records, manage fee structures transparently, track vulnerable child subsidies, and generate instant verified payment receipts with zero dependency on continuous internet connectivity.

This document demonstrates School Foundry’s comprehensive compliance with all **9 Indicators** of the Digital Public Goods Standard.

---

## DPGA 9-Indicator Compliance Matrix

```
┌────┬────────────────────────────────────┬──────────┬────────────────────────────────────────────────────────┐
│ #  │ DPGA Indicator                     │ Status   │ Implementation Evidence                                │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ 1  │ Relevance to Sustainable Dev Goals │ Compliant│ Direct impact on SDG 4.1, 4.5 & SDG 10.2               │
│ 2  │ Use of Approved Open License       │ Compliant│ OSI-approved MIT License                               │
│ 3  │ Clear Ownership & Copyright        │ Compliant│ Jiggabyte Technology Limited & Open Source Contributors│
│ 4  │ Platform Independence              │ Compliant│ Cross-platform Electron (Windows, Linux, macOS) + Web  │
│ 5  │ Documentation & User Guides        │ Compliant│ Embedded offline user guide, API specs, and videos     │
│ 6  │ Mechanism for Data Extraction      │ Compliant│ Standardized JSON & CSV exports for national EMIS      │
│ 7  │ Adherence to Privacy Laws          │ Compliant│ Zambian Data Protection Act No. 3 of 2021 compliant    │
│ 8  │ Adherence to Standards / Interop   │ Compliant│ Open relational SQLite schema, ISO-8601, integer cents │
│ 9  │ Do No Harm & Child Safeguarding    │ Compliant│ Zero telemetry, local storage, OVC subsidy protection  │
└────┴────────────────────────────────────┴──────────┴────────────────────────────────────────────────────────┘
```

---

## Detailed Indicator Self-Assessment

### Indicator 1: Relevance to the Sustainable Development Goals (SDGs)
- **Target 4.1 (Free, equitable, and quality primary and secondary education)**: School Foundry prevents student dropouts caused by administrative record loss and payment reconciliation disputes in under-resourced schools.
- **Target 4.5 (Eliminate gender disparities and ensure equal access for the vulnerable)**: Features dedicated subsidy and bursary tracking for Orphans & Vulnerable Children (OVC) and students supported by government social cash transfers.
- **Target 10.2 (Promote universal social, economic, and political inclusion)**: Provides equitable access to digital management tools for rural and peri-urban community schools that cannot afford high-cost proprietary cloud SaaS.

### Indicator 2: Use of Approved Open Licenses
- The entire source code of the School Foundry core desktop application is released under the **MIT License**, an Open Source Initiative (OSI) and Free Software Foundation (FSF) approved license.
- Full text is available in the root [LICENSE](https://github.com/sewardrichard/school-foundry-offline/blob/main/LICENSE) file.

### Indicator 3: Clear Ownership & Copyright
- Copyright is held by Jiggabyte Technology Limited (Zambia) and community contributors. All third-party dependencies are open source and listed in `package.json`.

### Indicator 4: Platform Independence
- Built with standard open web technologies: **React**, **TypeScript**, **Electron**, and **SQLite3**.
- Runs natively on **Windows 10/11**, **Linux (Ubuntu/Debian)**, and **macOS** on commodity, low-cost computer hardware without requiring proprietary cloud runtime environments.

### Indicator 5: Documentation & User Guides
- Includes a comprehensive, embedded **Offline User Guide** within the application UI (`/components/UserGuide.tsx`), enabling school bursars and headteachers to learn and troubleshoot without an active internet connection.
- Complete developer onboarding, architectural diagrams, and installation instructions are provided in `README.md` and `docs/`.

### Indicator 6: Mechanism for Data Extraction
- Provides 1-click export of student records, class lists, fee balances, and financial transaction histories to open formats (**CSV** and **JSON**).
- Zero proprietary data lock-in: The raw SQLite database file (`feesfoundry.db`) can be opened, queried, and migrated using any standard SQLite client.

### Indicator 7: Adherence to Privacy Laws & Domestic Regulations
- Built in strict compliance with the **Zambian Data Protection Act No. 3 of 2021** and international data protection principles.
- Employs **Local-First Data Sovereignty**: Learner personal data is stored exclusively on the institution's local device and is never transmitted to unapproved third-party servers.
- Password hashes use industry-standard `bcryptjs` with salt rounds.

### Indicator 8: Adherence to Open Standards & Interoperability
- Relational schema designed for direct mapping to national **Education Management Information Systems (EMIS)** formats.
- Uses ISO 8601 formatted timestamps, integer-based currency representations (cents) to avoid floating-point errors, and standardized SQL constraints.

### Indicator 9: Do No Harm & Child Safeguarding
- **Zero Advertising & Zero Surveillance**: Contains no behavioral tracking, advertising SDKs, or data-brokerage hooks.
- **Child Protection Safeguards**: Prevents punitive automated exclusion of vulnerable students whose tuition is subsidized by state welfare or NGO grants.
- **Content Suitability**: Contains no harmful, adult, or non-educational content.

---

## Conclusion
School Foundry fulfills all prerequisites to be formally recognized as a **Digital Public Good** by the Digital Public Goods Alliance, accelerating equitable access to education management infrastructure across Southern Africa and beyond.
