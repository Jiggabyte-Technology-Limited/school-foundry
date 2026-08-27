# Security, Child Safeguarding & Data Privacy Protocol

> **Governing Standards:**
> - Zambian Data Protection Act No. 3 of 2021
> - United Nations Convention on the Rights of the Child (General Comment No. 25 on the Digital Environment)
> - Digital Public Goods Alliance (DPGA) Privacy by Design Principles

---

## 1. Executive Summary & Philosophy

**School Foundry** is engineered with a strict **"Local-First, Zero-Surveillance"** architecture. Educational institutions in emerging markets often serve vulnerable children whose personal data must be safeguarded against commercial exploitation, data leaks, and unauthorized surveillance.

By storing all student, financial, and institutional records in an encrypted local database on the school’s physical hardware, School Foundry guarantees absolute data sovereignty and protects minors from cloud-based tracking.

---

## 2. Core Privacy Protections

### 2.1. Complete Absence of Behavioral Tracking & Ad Telemetry
- **No Analytics Trackers**: School Foundry contains zero third-party telemetry, tracking pixels, or behavioral analytics SDKs (e.g., Google Analytics, Facebook Pixel, Mixpanel).
- **No Third-Party Ad Networks**: The software does not serve ads or monetize user data under any circumstances.

### 2.2. Local-First Data Sovereignty
- All records (learner profiles, guardian contact information, fee schedules, transactions, and academic history) are written to a local SQLite database (`feesfoundry.db`) located within the operating system's protected user data directory.
- No student records are uploaded to remote cloud servers unless explicitly initiated and authorized by the institution's administrator via an encrypted backup.

### 2.3. Cryptographic Data Security & Access Controls
- **Password Security**: Administrative and bursar passwords are never stored in plaintext. They are salted and hashed using `bcryptjs` with high work factors.
- **Role-Based Access Control (RBAC)**: Enforces separation of duties between Administrative roles (configuration, user creation, fee policy) and Operator roles (payment recording, receipt printing).
- **Immutable Audit Trail (`activity_log`)**: Every administrative action, payment recording, fee amendment, and student deletion generates an immutable audit record containing the timestamp, user ID, and detailed operation parameters.

---

## 3. Child Safeguarding & Vulnerable Student Protections

### 3.1. Right to Protection Against Unfair Exclusion
- School Foundry includes dedicated data flags for **Orphans & Vulnerable Children (OVC)**, state social cash transfer recipients, and NGO bursary beneficiaries.
- When generating "Students with Outstanding Balances" or exam clearance lists, the system prevents automated punitive actions against students whose fees are covered by pending state subsidies.

### 3.2. Data Minimization
- The student registry collects only the minimal data required for academic administration:
  - Learner Name
  - Date of Birth & Gender (for demographic reporting)
  - Grade / Class Level
  - Guardian Contact Number (for emergency and receipt notification)
- No invasive biometric data or persistent external trackers are stored.

### 3.3. Right to Rectification & Erasure
- In accordance with the Zambian Data Protection Act No. 3 of 2021, guardians and school administrators maintain full control to update, correct, or archive student records.
- Soft-deactivation allows records to be protected while maintaining financial ledger integrity for auditing.

---

## 4. Disaster Recovery & Backup Encryption

- **Encrypted Local Backups**: The built-in `BackupManager` allows administrators to export full database archives to external USB media with SHA-256 integrity verification.
- **Air-Gapped Operation**: The backup and restore system requires zero internet connectivity, ensuring full disaster resilience during extended power or network blackouts.

---

## 5. Security Vulnerability Reporting

Security researchers and community contributors are encouraged to report potential vulnerabilities responsibly. Please email security reports to **security@jiggabyte.co.zm** or open a confidential security advisory on our GitHub repository.
