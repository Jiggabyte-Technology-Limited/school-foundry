# UNICEF Venture Fund Grant Application Dossier

> **Grant Opportunity:** UNICEF Venture Fund (Seed Stage Investment & Technical Assistance)  
> **Applicant Entity:** Jiggabyte Technology Limited  
> **Country of Registration:** Zambia (Official UNICEF Programme Country)  
> **Project Title:** School Foundry (Offline Desktop DPG Edition)  
> **Open Source Repository:** https://github.com/sewardrichard/school-foundry-offline  
> **License:** MIT License (OSI-Approved Open Source)  
> **Requested Funding:** \$100,000 USD (Equity-Free Grant)  
> **Primary SDG Focus:** SDG 4 (Quality Education) | SDG 10 (Reduced Inequalities) | SDG 1 (No Poverty)  

---

## 1. Company & Founding Team Information

### 1.1. Company Name & Registration Details
- **Legal Entity Name:** Jiggabyte Technology Limited
- **Registration Country:** Zambia
- **Type of Entity:** Private Limited Company (For-Profit Tech Startup)
- **Year of Incorporation:** 2024–2026
- **Headquarters:** Lusaka, Zambia

### 1.2. Executive Summary & Value Proposition
Jiggabyte Technology is a Zambian technology company building mission-critical software infrastructure for underserved African institutions. Our flagship open-source solution, **School Foundry**, is an offline-first school management and child welfare platform designed for educational institutions operating in low-connectivity, power-deficit environments.

---

## 2. The Problem Statement & Impact on Children

### 2.1. What specific problem does your solution address?
Across Sub-Saharan Africa, over **65% of primary schools operate without basic electricity** (UNESCO UIS) and **over 80% lack pedagogical internet connectivity** (UNICEF/ITU Giga Initiative). In these off-grid and intermittent-power environments:
1. **Administrative Failure & Wrongful Student Dropouts**: Schools rely on fragile paper ledgers and manual spreadsheets that are easily lost, damaged, or corrupted during staff turnover. When student fee payments or subsidy allocations cannot be immediately verified, children—disproportionately vulnerable girls and orphans—are wrongfully barred from attending classes or writing national examinations.
2. **Institutional Revenue Leakage & Financial Insolvency**: Independent audits of low-resource and community schools across Africa document that institutions lose between **10% and 20% of their operational revenue to administrative leakages** (untracked waivers, unrecorded receipts, and manual reconciliation errors), while uncollected fee deficits frequently climb to **30%–38%** (ISASA / IDinsight). This revenue loss prevents schools from paying teachers on time, maintaining water and sanitation facilities, and acquiring learning materials.
3. **The Digital Divide of Cloud SaaS**: Conventional EdTech platforms assume high-speed internet, continuous electrical grid power, and recurring per-student subscription fees—pricing out and technologically excluding community and public schools.

### 2.2. How does this directly benefit children and youth?
- **Guaranteed Educational Continuity**: Eliminates administrative record loss, ensuring every student’s enrollment, academic history, and financial clearance are permanently secured.
- **Protection for Vulnerable Children**: Prevents punitive exclusion by integrating dedicated tracking for government bursaries (e.g., Zambia's Free Education policy subsidies) and NGO sponsorship programs.
- **Transparent School Funding**: Increases school operational revenue retention, directly improving the quality of classroom resources and teacher stability.

---

## 3. The Technical Solution & Frontier Technology

### 3.1. Describe your solution and its technical architecture
School Foundry is a **zero-dependency, local-first school management ecosystem** packaged as a cross-platform desktop application (Electron + React + TypeScript + SQLite):
- **Local-First SQLite Core**: Operates 100% offline with zero external cloud dependencies.
- **Integer-Cent Accounting Engine**: Stored procedures and data types utilize integer cents (e.g., 50000 cents for 500.00 ZMW) to guarantee zero floating-point arithmetic errors.
- **Cryptographic Audit Ledger (`activity_log`)**: All payments, balance adjustments, and student profile changes are permanently recorded in an immutable local audit log.
- **Instant Thermal & PDF Receipting**: Generates verifiable offline receipts with unique verification hashes for parents and guardians.

### 3.2. What frontier technology does the solution leverage?
- **Distributed Local-Mesh Synchronization**: Evolving beyond single-workstation desktop software to an on-premise local area network (LAN) data mesh. Using lightweight local synchronization (SQLite WASM + CRDTs / PowerSync), teachers on low-cost smartphones and bursars on laptops can sync student attendance and fee records locally with **zero internet connection**.
- **Edge Analytics & Early Warning System**: On-device machine-learning heuristics that analyze local attendance and payment patterns to alert headteachers of potential student dropout risks before they occur.

---

## 4. Open Source Commitment & Digital Public Good (DPG) Strategy

### 4.1. Open Source Licensing & Code Availability
- **Repository:** https://github.com/sewardrichard/school-foundry-offline
- **License:** **MIT License** (OSI-Approved).
- **Digital Public Goods Standard:** Designed from inception to meet all 9 indicators of the DPGA Standard, guaranteeing platform independence, data extraction capabilities, and adherence to child data privacy standards.

### 4.2. Child Privacy & Data Protection Compliance
- Strictly compliant with the **Zambian Data Protection Act No. 3 of 2021** and the **UN Convention on the Rights of the Child (General Comment No. 25)**.
- **Zero Behavioral Tracking**: No ad networks, no analytics trackers, and no non-consensual biometric data harvesting.
- **Local-First Data Sovereignty**: All learner personal identifiable information (PII) remains physically within the custody of the school on local hardware.

### 4.3. Business Model & Long-Term Financial Sustainability (Open Core Model)
- **100% Free Core DPG**: The complete desktop management software is freely available to any public or community school in the world.
- **Commercial Value-Add Streams**:
  1. *Hardware Bundles & Thermal Printers*: Supplying pre-configured, low-power micro-PCs, solar battery packs, and POS receipt printers.
  2. *Managed Encrypted Cloud Relay (Optional)*: Providing automated off-site encrypted disaster recovery backups for schools with periodic connectivity.
  3. *Government & District EMIS Integration Services*: Customized data pipelines and onboarding for Ministries of Education.

---

## 5. 12-Month Work Plan & Budget Allocation (\$100,000 USD)

```
┌───────────────────────────────────────────────────────────────────┬──────────────┐
│ Milestone & Deliverables                                          │ Budget (USD) │
├───────────────────────────────────────────────────────────────────┼──────────────┤
│ Milestone 1: DPGA Certification & Open-Core Community Infrastructure│ $20,000      │
│   • Official DPGA registry listing and open-source documentation  │              │
│   • Developer onboarding tutorials and community translation tools│              │
├───────────────────────────────────────────────────────────────────┼──────────────┤
│ Milestone 2: Offline Local-Mesh Synchronization Engine (CRDT/LAN)  │ $35,000      │
│   • Multi-device local synchronization across classroom phones & PC│              │
│   • Offline peer-to-peer conflict resolution with zero internet   │              │
├───────────────────────────────────────────────────────────────────┼──────────────┤
│ Milestone 3: Vulnerable Child Subsidy Module & EMIS Interoperability│ $25,000     │
│   • Government subsidy & OVC scholarship tracking dashboard       │              │
│   • National EMIS open data export schema (JSON/CSV)              │              │
├───────────────────────────────────────────────────────────────────┼──────────────┤
│ Milestone 4: 30-School Pilot Deployment & Impact Evaluation       │ $20,000      │
│   • Field deployment across 30 rural & peri-urban schools in Zambia│              │
│   • Impact telemetry on student exclusion prevention and revenue  │              │
├───────────────────────────────────────────────────────────────────┼──────────────┤
│ TOTAL REQUESTED FUNDING                                           │ $100,000     │
└───────────────────────────────────────────────────────────────────┴──────────────┘
```

---

## 6. Key Performance Indicators & Target Metrics (12 Months)

1. **Beneficiary Reach**: 30 pilot schools onboarded, supporting over **18,000 primary and secondary students** across Zambia.
2. **Student Exclusion Reduction**: Eliminate wrongful student exam/classroom lockouts due to lost administrative records across 100% of pilot institutions.
3. **Operational Uptime**: 100% operational continuity during daily 8–12 hour electrical load-shedding blackouts.
4. **Open Source Adoption**: Minimum of 500 GitHub repository stars, 5 external community contributors, and 100 independent school downloads across Africa.

---

## 7. Data Sources & Empirical References

1. **School Electrification Deficit**:
   - **UNESCO Institute for Statistics (UIS)**: *Global Education Monitoring Report – School Infrastructure Indicators*. Demonstrates that only ~35% of primary schools in Sub-Saharan Africa have electricity access (~65% un-electrified), falling to single digits in several fragile states.
2. **Connectivity Deficit**:
   - **UNICEF & ITU Giga Initiative**: *Global School Connectivity Baseline Report*. Highlights that the digital divide in school connectivity is most acute in Sub-Saharan Africa, where over 80% of rural schools lack internet access and 88% of children in Eastern and Southern Africa lack home connectivity.
3. **School Financial Leakage & Collection Rates**:
   - **Independent Schools Association of Southern Africa (ISASA) & IDinsight**: *Financial Vulnerability and Sustainability in Low-Fee Schools*. Studies reveal that manual fee tracking results in 10%–20% operational revenue leakage due to unrecorded transactions and reconciliation disputes, while total fee collection shortfalls often reach 30%–38%, putting school sustainability at risk.
   - **Digital Public Infrastructure (DPI) in Education**: *Impact Assessment of Digital Financial Records in Sub-Saharan African Schools*. Automated, transparent local digital accounting reduces unrecorded fee leakage by up to 30%, directly improving operational resilience.
