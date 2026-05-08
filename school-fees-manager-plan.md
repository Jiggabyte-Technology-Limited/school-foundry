# 🏫 School Fees Manager — Project Plan
> A standalone offline desktop application for managing student fee payments at a high school in rural Zimbabwe.

---

## 📌 Project Overview

| Item | Detail |
|---|---|
| **App Name** | School Fees Manager *(working title)* |
| **Target User** | School administrators, bursars, secretaries |
| **Target Environment** | Windows PC, fully offline |
| **Tech Stack** | Electron.js + React + SQLite |
| **Business Model** | One-time license per machine |
| **Initial Target School** | ~900 students |

---

## 🎯 Problem Statement

High school administrators in rural Zimbabwe currently manage student fee payments using a manual paper receipt system. Duplicate paper receipts are issued — one to the parent, one filed at the school. This makes it extremely difficult to:

- Track who has paid and who has not
- Know outstanding balances per student
- Generate summaries per class or grade
- Review payment history across terms and years
- Maintain an audit trail of who recorded what

This application replaces that entire paper workflow with a simple, reliable, offline desktop system.

---

## 🖥️ Technology Decisions

### Why Electron + React + SQLite?

| Technology | Role | Why |
|---|---|---|
| **Electron.js** | Desktop app wrapper | Runs as standalone `.exe` on Windows, no browser or internet needed |
| **React** | User interface | Fast, component-based UI development |
| **SQLite** | Local database | Single file database, zero setup, works offline, easy to back up |
| **better-sqlite3** | SQLite Node.js driver | Synchronous, fast, reliable |
| **React-PDF / jsPDF** | PDF generation | Generate receipts and reports as downloadable PDFs |
| **electron-builder** | Packaging | Bundles app into a Windows `.exe` installer |

### How Electron Works
Electron bundles a Chromium browser engine with Node.js. The developer writes UI in React (like a website), but the user sees a normal desktop application window — no browser, no internet, installs like any Windows program.

---

## ✅ Full Feature Specification

### 1. 👤 User Management
- First-run setup creates the **Admin** account
- Admin can **create, edit, and deactivate** other user accounts
- **Roles:**
  - `admin` — full access to everything including user management, all reports, settings
  - `user` — record payments, view reports, manage students
- Login screen on every app open (session persists until app is closed)
- Passwords stored as hashed values (bcrypt) — never plain text

---

### 2. 🎓 Student Management
- Add, edit, and soft-delete (deactivate) students
- Each student record holds:
  - Full name
  - Student ID / registration number
  - Grade / form level
  - Guardian name and contact number
  - Date enrolled
  - Status (active / inactive)
- Search and filter by name, grade, status
- Student carries forward to new academic years automatically

---

### 3. 📅 Academic Year Management
- All data is scoped to an **Academic Year** (e.g. `2024`, `2025`)
- On first setup, admin creates the first academic year
- Admin can **open a new academic year** at year-end — active students roll over automatically
- Default view throughout the app is always the **current active year**
- Previous years are accessible in a read-only or review mode
- Each academic year has **3 terms** (configurable)

---

### 4. 💰 Fee Structure
- Admin sets the **fee amount per grade per term per academic year**
- Fee structure is defined at the start of each year (can be copied from previous year)
- Different grades can have different fee amounts
- Supports a **registration/levy fee** separate from term fees if needed

---

### 5. 💳 Payment Recording
- Record a payment against a specific student, term, and academic year
- Payment fields:
  - Student (searchable dropdown)
  - Academic year + term
  - Amount paid
  - Payment date
  - Receipt number (manual entry matching physical receipt book)
  - Payment method (cash / EcoCash / bank transfer)
  - Notes (optional)
  - Recorded by (auto-filled from logged-in user)
- **Partial payments** are fully supported — outstanding balance is calculated automatically
- Overpayments are flagged
- A payment can be **voided** by admin with a reason (voided payments remain in the log)

---

### 6. 🧾 Receipt Generation
- After recording a payment, a **printable PDF receipt** is generated
- Receipt includes:
  - School name and logo
  - Student name and grade
  - Receipt number
  - Amount paid, payment date, term
  - Outstanding balance
  - Name of person who recorded the payment
- Receipts can be reprinted at any time from the payment record

---

### 7. 📊 Reports

All reports are exportable as **PDF** and can be printed directly.

#### a) Class / Grade Report
- Select: Academic year, term, grade
- Shows all students in that grade with their payment status, amount paid, and outstanding balance
- Summary totals at the bottom

#### b) Full School Report
- Select: Academic year, term (or all terms)
- Overview of all grades — total expected, total collected, total outstanding
- Useful for the principal or end-of-term summary

#### c) Individual Student Statement *(key feature)*
- Select a student
- Choose a **date range** — spanning any combination of terms and academic years
- Default range is the current academic year (all terms)
- Can go back to the student's very first year at the school
- Shows every payment made within that range, term by term, year by year
- Running balance shown throughout
- Clearly shows what was owed, what was paid, and what remains

#### d) Outstanding Fees Report
- Select: Academic year, term (or all terms), grade (or all grades)
- Lists only students with outstanding balances
- Sortable by amount owed, grade, name

#### e) Payment History Report
- Date range filter
- Lists all payments recorded in that period
- Useful for reconciliation — matches against receipt book

---

### 8. 🔒 Activity Log & Audit Trail
- Every significant action is recorded automatically:
  - User login / logout
  - Student created, edited, deactivated
  - Payment recorded, voided
  - Fee structure changed
  - User account created or changed
  - Backup created or restored
  - Academic year created
- Log entries include: timestamp, user, action, and relevant details
- Admin can view and filter the activity log
- Activity log is exportable as PDF
- Log entries are **never deletable** — permanent record

---

### 9. 💾 Backup & Restore
- **One-click backup** — exports the entire SQLite database as a single encrypted `.bak` file
- Admin chooses where to save it (USB drive, folder, etc.)
- **Restore from backup** — on a new machine: install app → restore backup → all data recovered
- Backup file is encrypted so it cannot be opened or tampered with outside the app
- App prompts admin to create a backup periodically (e.g. every 30 days)
- Backup filename includes date for easy identification: `SchoolFees_Backup_2025-07-14.bak`

---

### 10. 🔐 License & Copy Protection
- On install, the app reads a **unique machine ID** (hash of hardware identifiers)
- A valid **license key** is tied to that specific machine ID
- Without a valid license key, the app runs in a limited demo mode (e.g. max 10 students)
- License key is generated by the developer (you) using a private key — cannot be forged
- If a school changes computers: they contact you, you re-issue a key for the new machine (charge a small migration fee or offer it as goodwill)
- License key is stored locally and verified on every app launch

---

## 🗄️ Database Schema

*(See separate section — to be built out in full detail as next step)*

### Core Tables
- `users`
- `students`
- `academic_years`
- `terms`
- `fee_structure`
- `payments`
- `activity_log`
- `app_settings`

---

## 📁 Suggested Project Folder Structure

```
school-fees-manager/
├── public/
│   └── index.html
├── src/
│   ├── main/                  # Electron main process
│   │   ├── main.js            # App entry point
│   │   ├── database.js        # SQLite setup and migrations
│   │   ├── ipc/               # IPC handlers (bridge between UI and DB)
│   │   │   ├── students.js
│   │   │   ├── payments.js
│   │   │   ├── reports.js
│   │   │   ├── users.js
│   │   │   └── backup.js
│   │   └── license.js         # License key validation
│   ├── renderer/              # React frontend
│   │   ├── App.jsx
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Full page views
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Students.jsx
│   │   │   ├── Payments.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── ActivityLog.jsx
│   │   ├── hooks/             # Custom React hooks
│   │   └── utils/             # Helpers, PDF generation
│   └── shared/                # Shared constants/types
├── assets/
│   └── logo.png
├── package.json
└── electron-builder.config.js
```

---

## 🗺️ Build Phases

| Phase | What to Build | Deliverable |
|---|---|---|
| **1** | Project setup, Electron + React scaffold, SQLite connection | App opens, DB initialises |
| **2** | Auth — login screen, user management, sessions | Secure login working |
| **3** | Student management — CRUD, search, grade assignment | Students can be added/managed |
| **4** | Academic year + fee structure setup | Years and fees configurable |
| **5** | Payment recording + receipt PDF | Core daily workflow done |
| **6** | Reports — class, school, individual statement, outstanding | All reports working as PDF |
| **7** | Activity log | Full audit trail |
| **8** | Backup & Restore | Data migration solved |
| **9** | License key system | Copy protection ready |
| **10** | Polish — UI refinement, error handling, installer | Ready to sell |

---

## 💰 Business Model

| Item | Detail |
|---|---|
| **Pricing** | USD $150 – $300 once-off per school (per machine) |
| **License type** | Perpetual, machine-locked |
| **Machine migration** | Re-issue license on new machine (small fee or goodwill) |
| **Support** | Optional — charge for on-site setup or phone support |
| **Growth strategy** | Reference site (your uncle's school) → pitch to nearby schools → district rollout |
| **Demo mode** | App installs in demo mode (10 student limit) — easy for schools to trial before buying |

---

## 🚀 Next Step

**Build the full, detailed database schema** — every table, every column, data types, foreign keys, and indexes. This is the foundation everything else is built on and must be done right before any code is written.
