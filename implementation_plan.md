# 🏫 School Fees Manager — Critical Review & Enhanced Implementation Plan

> A critique of the existing plan, suggested improvements, and a refined implementation blueprint ready for development.

---

## ✅ Confirmed Design Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Monetary storage | **INTEGER cents** — `$150.00` stored as `15000` |
| 2 | Fee types in v1 | **Yes** — `tuition`, `levy`, `exam`, `registration`, `other` |
| 3 | Receipt number uniqueness | **School-wide unique** — `UNIQUE(receipt_number)` on `payments` |
| 4 | Number of terms | **Flexible** — remove `CHECK(term_number IN (1,2,3))`, allow any count per year |
| 5 | Auto-lock session | **Yes, in v1** — idle timeout configurable in settings |
| 6 | Multi-language | **Scaffold for i18n in v1, English only** — all UI strings via a locale file |
| 7 | Installer type | **Full installer** (NSIS via electron-builder), **deployable via bootable USB** |

---

## 🟢 What's Already Strong

Before the critique, it's worth acknowledging what's genuinely well done:

- **Database design is solid.** The separation of `students` from `student_year_enrollment` is exactly right. Many amateur systems get this wrong, storing the grade on the student record and then wondering why historical queries break.
- **Soft deletes everywhere** — excellent discipline. Audit integrity is preserved.
- **The activity log design** is production-grade. Storing a `username` snapshot alongside the FK is a great practice for long-lived audit trails.
- **Key queries are pre-written** — this is extremely useful and shows real SQL literacy.
- **Fee structure is per-grade, per-term, per-year** — correct and flexible.
- **Technology choices are solid.** Electron + React + SQLite is a well-proven stack for this exact use case. `better-sqlite3` is the right driver.
- **Schema versioning via `app_settings`** — migration-aware from day one. Good.

---

## 🔴 Critical Issues & Gaps

### 1. Monetary Storage: `REAL` Is Dangerous for Money

> [!CAUTION]
> Storing money as `REAL` (floating point) is a well-known source of rounding bugs. `0.1 + 0.2` in floating point is `0.30000000000000004`. For a fee management system, this is unacceptable.

**Fix:** Store all monetary values as **`INTEGER` representing cents (or the smallest currency unit)**. Display layer divides by 100. E.g., `$150.00` is stored as `15000`.

```sql
-- ❌ Current (dangerous)
amount REAL NOT NULL CHECK(amount >= 0),

-- ✅ Fixed (safe)
amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
-- e.g. 15000 = $150.00
```

Alternatively, store as `TEXT` with fixed 2 decimal places and parse in the app layer. But integer cents is the industry standard.

---

### 2. `receipt_number` Has No Uniqueness Constraint

The receipt number is the reconciliation key against the physical receipt book. If two bursars accidentally enter the same receipt number, the system will silently accept it — producing phantom data.

**Fix:**
```sql
-- Add a UNIQUE constraint:
receipt_number TEXT NOT NULL UNIQUE,
```

Or at minimum a unique compound constraint scoped to the year:
```sql
UNIQUE(year_id, receipt_number)
```

---

### 3. License System Is Under-Specified and Risky

The current plan says "A valid license key is tied to that specific machine ID — cannot be forged." This is stated as a goal but the *mechanism* is not defined. Client-side license validation that "cannot be forged" is extremely difficult to achieve in Electron — the app's JavaScript source is inspectable.

**Issues:**
- Hardware fingerprints change when hardware is upgraded (RAM, HDD replacement). This will cause legitimate users to lose access.
- If no internet is required, license validation can only check a local file — meaning a determined person could copy that file.
- No trial expiry mechanism — the "10 student limit" demo mode can be bypassed by editing local storage.

**Practical Recommendation for v1:**
- Use a simple **asymmetric signature scheme**: the developer signs `machine_id + expiry_date` with a private key. The app verifies the signature with a bundled public key. This cannot be forged without the private key.
- Accept that a truly determined attacker can bypass any client-side scheme. Your target market (rural Zimbabwean schools) is not a high piracy risk — focus on making purchase easier than bypassing.
- For the demo mode: limit to 10 students **and** add a 30-day trial timer stored in `app_settings`, making dual protection.

---

### 4. No Multi-Guardian / Contact Support

Students often have two parents, or a guardian changes. The current schema has a single `guardian_name` + `guardian_contact` on the student record. This is fine for v1, but will immediately be a pain point for real school staff.

**Suggested addition (v1.5 or as optional columns now):**
```sql
guardian_name_2    TEXT,
guardian_contact_2 TEXT,
guardian_email     TEXT,  -- future: send digital receipts
```

---

### 5. No `fee_category` / Fee Type Distinction

The plan mentions "a registration/levy fee separate from term fees" but the `fee_structure` table has no way to model this. Everything is one `amount` per grade/term/year.

**Fix:** Add a `fee_type` column:
```sql
ALTER TABLE fee_structure ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'tuition'
  CHECK(fee_type IN ('tuition', 'registration', 'levy', 'exam', 'other'));
```

And update the `UNIQUE` constraint:
```sql
UNIQUE(year_id, term_id, grade_id, fee_type)
```

This allows schools to separately track tuition vs. exam fees vs. development levies on a single student's statement without them being lumped together.

---

### 6. No Dashboard / Home Screen Defined

The feature spec jumps straight to Users → Students → Years → Fees → Payments but never defines what the **Dashboard / Home screen** looks like. This is the first thing a bursar sees every morning. It should show:

- Today's payments total
- Current term outstanding total
- Recent payment entries (last 5)
- Quick-action buttons: Record Payment, Search Student
- Alert if no backup in 30+ days

This is a UX critical miss.

---

### 7. Session Security Not Fully Defined

The plan says "Login screen on every app open (session persists until app is closed)" — this is correct but incomplete:

- **No session timeout** — if a bursar walks away from the desk with the app open, anyone can record payments under their name.
- **No failed login lockout** — currently unlimited attempts.

**Recommended additions:**
- Auto-lock after 15 minutes of inactivity (configurable in settings)
- Lock out user account for 5 minutes after 5 consecutive failed attempts (log `USER_LOGIN_FAILED` events and count)

---

### 8. No SMS / WhatsApp Notification Path (Future-Proofing)

Parents in rural Zimbabwe commonly use WhatsApp. The `guardian_contact` field already captures phone numbers. The plan should at minimum **note** a future pathway for sending payment confirmations via WhatsApp Business API or SMS, even if v1 is offline-only. Omitting it from the plan entirely means the database won't be designed to support it later.

**Suggested addition to `app_settings`:**
| key | Example Value |
|---|---|
| `whatsapp_enabled` | `false` |
| `sms_provider` | (future) |

And `guardian_email` on students (as above) for potential future digital receipts.

---

### 9. Business Model: Pricing May Be Too Low

> [!IMPORTANT]
> At **USD $150–$300 once-off**, the pricing likely undervalues the product significantly for this market.

**Consider:**
- A school of 900 students paying ~$150/term in fees = **$135,000 in annual fee revenue the school manages**
- The software saves tens of hours of admin per month and prevents errors in a critical financial workflow
- **$300–$500 per machine** is more appropriate for the value delivered
- **Annual maintenance fee** of $50–$100 should be added — this covers:
  - Version updates (new features, bug fixes)
  - Remote support via phone/WhatsApp
  - License re-issue on hardware change
- Alternatively: **$200 upfront + $5/month** (prepaid annual). This gives recurring revenue.

**Also missing:** What happens at year 2? Schools will still need support. A perpetual-no-support model will generate constant support requests you can't charge for.

---

### 10. No Offline Installer / Deployment Strategy

The plan specifies `electron-builder` for packaging but doesn't address the deployment reality:

- The school has **no internet**. How does the installer get there? USB drive.
- How do updates get delivered? Also USB drive — but the app must support in-place update.
- The plan should include an **auto-update via USB** or manual update process.

---

## 🟡 Improvements & Additions

### A. Add a `payment_receipts` Table (or Receipt Archive)

Currently, receipts are generated on-the-fly from payment data. But if a fee structure changes (e.g., admin corrects an amount), re-generating the receipt might show different numbers than what the original receipt showed. Consider storing the **rendered receipt as a PDF blob** in the database at time of generation, or at minimum a **snapshot** of the key values:

```sql
CREATE TABLE IF NOT EXISTS payment_receipts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id     INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  fee_owed_cents INTEGER NOT NULL,       -- snapshot at time of receipt
  amount_paid_cents INTEGER NOT NULL,    -- snapshot at time of receipt  
  outstanding_cents INTEGER NOT NULL,    -- snapshot at time of receipt
  generated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by   INTEGER REFERENCES users(id)
);
```

---

### B. Add `last_login_at` to `users` Table

Useful for admin dashboard ("No logins since 3 weeks ago") and security auditing.

```sql
ALTER TABLE users ADD COLUMN last_login_at TEXT;
```

---

### C. Add Database Integrity Check on Every Launch

Add a startup routine:
```javascript
db.pragma('integrity_check');
db.pragma('foreign_key_check');
```

If either fails, alert the admin and prevent data entry until resolved.

---

### D. Clarify the "Copy from Last Year" Fee Structure Flow

The plan mentions this as a UI helper but doesn't specify if it copies **amounts** exactly or just the structure. Define this explicitly:
- Copy the fee structure (grade → term → amount) from year N to year N+1
- Admin can then edit individual amounts before "locking" the structure
- Add an `is_locked` flag to `fee_structure` or at the `academic_years` level

---

### E. Add an `enrollment_status` to `student_year_enrollment`

Currently only `is_active` boolean. Real schools have more states:

```sql
enrollment_status TEXT NOT NULL DEFAULT 'active' 
  CHECK(enrollment_status IN ('active', 'withdrawn', 'transferred', 'expelled', 'completed'))
```

---

### F. Add `grade_id` to `fee_structure` UNIQUE index — Verify Term Scoping

The current `UNIQUE(year_id, term_id, grade_id)` on `fee_structure` is correct — but note that `term_id` already implies `year_id` via the `terms` table FK. This creates a subtle redundancy. Not a bug, but a maintenance risk — consider whether to keep `year_id` on `fee_structure` at all, or derive it via `terms.year_id`. Keep it for now for query performance but document the intentional redundancy.

---

## 📐 Revised & Enhanced Database Schema Additions

### New: `payment_receipts` table
```sql
CREATE TABLE IF NOT EXISTS payment_receipts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id        INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  fee_owed_cents    INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  outstanding_cents INTEGER NOT NULL,
  generated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  generated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);
```

### Amended: `users` table additions
```sql
last_login_at      TEXT,
failed_login_count INTEGER NOT NULL DEFAULT 0,
locked_until       TEXT
```

### Amended: `students` table additions
```sql
guardian_name_2    TEXT,
guardian_contact_2 TEXT,
guardian_email     TEXT
```

### Amended: `fee_structure` additions
```sql
fee_type TEXT NOT NULL DEFAULT 'tuition'
  CHECK(fee_type IN ('tuition', 'registration', 'levy', 'exam', 'other')),
is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1))
```

### Amended: `student_year_enrollment` change
```sql
-- Replace: is_active INTEGER
-- With:
enrollment_status TEXT NOT NULL DEFAULT 'active'
  CHECK(enrollment_status IN ('active', 'withdrawn', 'transferred', 'expelled', 'completed'))
```

### Monetary type change (all affected tables)
```
fee_structure.amount          → amount_cents INTEGER
payments.amount_paid          → amount_paid_cents INTEGER
payment_receipts (all amounts) → *_cents INTEGER
```

---

## 🗺️ Revised Build Phases

| Phase | What to Build | Deliverable | Est. Time |
|---|---|---|---|
| **1** | Project scaffold: Electron + React + Vite, SQLite connection, migrations runner | App opens, DB initialises, schema v1 applied | 1–2 days |
| **2** | First-run setup wizard: school info, admin account, first academic year + grades | Onboarding complete, app is usable | 1 day |
| **3** | Auth: login screen, session management, role-based route guards, failed login lockout, auto-lock | Secure auth working | 1–2 days |
| **4** | Student management: CRUD, search/filter, grade assignment per year | Students can be managed |1–2 days |
| **5** | Fee structure: per-grade/term/year config, copy-from-previous-year helper, fee types | Fees configurable | 1 day |
| **6** | Payment recording: form with student search, partial payments, overpayment flag, receipt PDF | Core daily workflow done | 2–3 days |
| **7** | Dashboard: today's payments, outstanding totals, recent payments, backup reminder alert | Staff home screen ready | 1 day |
| **8** | Reports: class report, full school report, individual statement, outstanding report, payment history | All reports as PDF | 2–3 days |
| **9** | Activity log: view, filter, export to PDF | Full audit trail visible | 1 day |
| **10** | Backup & Restore: encrypted export, USB restore, periodic reminder, integrity check | Data migration solved | 1–2 days |
| **11** | License key system: asymmetric signature validation, demo mode (10 students + 30-day timer) | Copy protection ready | 1–2 days |
| **12** | Polish: UI refinement, error handling, empty states, keyboard shortcuts, Windows installer | Ready to demo to school | 2–3 days |

**Total estimated development time: ~4–6 weeks** (solo developer, working evenings/weekends)

---

## 💰 Revised Business Model

| Item | Detail |
|---|---|
| **License type** | Perpetual seat license (machine-locked) |
| **v1 Price** | USD $350 upfront (reference school — grandfather pricing) |
| **Standard Price** | USD $450–500 per machine |
| **Annual Support Plan** | USD $80/year — covers updates, phone/WhatsApp support, license re-issue |
| **Setup Fee** | USD $50–100 for on-site installation + staff training (half-day) |
| **USB Update Delivery** | Free for support plan subscribers, $20 per-incident otherwise |
| **Demo mode** | 10 students + 30-day timer — both limits, not either/or |
| **Growth strategy** | Reference site (uncle's school) → document it as a case study → pitch to 5 nearby schools → district education office |
| **Pricing justification** | The school collects $135,000+/year in fees — $500 is 0.4% of annual revenue. Easy sell. |

---

## 🚀 Open Questions Before Development Starts

> All questions resolved. See **Confirmed Design Decisions** table at the top of this document.

---

## ✅ Pre-Development Checklist

- [x] All open questions resolved
- [x] Monetary storage → INTEGER cents confirmed
- [x] `fee_structure` gets `fee_type` column (tuition/levy/exam/registration/other)
- [x] `users` gets `last_login_at`, `failed_login_count`, `locked_until`
- [x] `students` gets secondary guardian + email fields
- [x] `student_year_enrollment` gets `enrollment_status` enum
- [x] `payment_receipts` snapshot table added
- [x] `receipt_number` → school-wide `UNIQUE` constraint
- [x] `terms.term_number` → flexible, no `CHECK(IN(1,2,3))` constraint
- [x] i18n locale file scaffold (English only in v1)
- [x] Full NSIS installer + USB-bootable deployment
- [ ] Design dashboard wireframe before coding Phase 7
- [ ] Set up GitHub repo
- [ ] Initialize Electron + React + Vite project scaffold

