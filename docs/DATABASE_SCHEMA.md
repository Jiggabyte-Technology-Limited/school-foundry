# Database Schema

FeesFoundry relies on a normalized relational database using **SQLite3**. The database file is stored locally in the OS-specific application data directory.

## Core Tables

### 1. `app_settings`
Stores global configurations such as the school name and database schema version.

### 2. `users`
Stores office staff and administrator accounts.
- Passwords are encrypted using `bcryptjs`.
- Roles: `admin`, `bursar`, `viewer`.

### 3. `academic_years` & `terms`
Defines the academic timeline. 
- An academic year contains multiple terms (usually 3).
- Used to scope fees and enrollments correctly over time.

### 4. `grades`
Defines the grade levels or forms (e.g., Grade 1, Form 1).

### 5. `students`
The core registry of students. 
- A student persists across years. 
- Stores Guardian contact details.

### 6. `student_year_enrollment`
A junction table linking a student to a specific grade within a specific academic year.

### 7. `fee_structure`
Defines how much is owed for a specific term, year, and grade. 
- Example: Grade 1, Term 1, 2026 = $500.

### 8. `payments` & `payment_receipts`
Records all financial transactions.
- **Amounts are stored in CENTS (INTEGER)** to avoid floating-point arithmetic errors. (e.g., $500.00 is stored as `50000`).
- Every payment generates a unique receipt number.
- `payment_receipts` captures a snapshot of the fee owed, amount paid, and outstanding balance at the exact moment the payment was made.

### 9. `activity_log`
An immutable audit trail. Records critical actions (logins, payments, student creation) for accountability.

## Schema Conventions
- All primary keys are `INTEGER PRIMARY KEY AUTOINCREMENT`.
- Dates and timestamps are stored as ISO 8601 UTC text strings (`YYYY-MM-DDTHH:MM:SS`).
- Monetary values are ALWAYS stored in cents as integers.
- Foreign keys enforce referential integrity (`PRAGMA foreign_keys = ON;`).