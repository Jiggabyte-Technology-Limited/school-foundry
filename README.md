# School Foundry (Offline Edition)

> **"Intelligence Scaled. Convert Noise Into Clarity."**

School Foundry is a robust, offline-first school management ecosystem designed for the African B2B enterprise landscape. This repository contains the **Offline Desktop Version**, built to provide a reliable and secure platform for educational institutions in environments with unstable internet connectivity.

---

## 🌐 Versions

- **[Offline Edition (Current)]**: A standalone Electron desktop application for secure, local-first management.
- **[Cloud Edition]**: **Coming Soon.** A multi-tenant SaaS platform for remote access and scaled operations.

For a preview of the vision and branding, visit: [School Foundry Landing Page](https://sewardrichard.github.io/school-foundry/)

---

## 🚀 Key Features

### 👨‍🎓 Student & Enrollment Management
- **Persistent Student Registry:** Centralized student database that persists across academic cycles.
- **Academic Year Lifecycle:** Manage enrollments, terms, and grade transitions seamlessly.
- **Advanced Filtering:** Instant identification of "Paid" vs. "Owing" students with the Synthetix data engine.

### 💰 Fee & Payment Processing
- **Dynamic Fee Structures:** Grade-specific, year-aware fee configurations.
- **Payment Wizard:** A secure, multi-step interface for high-integrity transaction recording.
- **Instant Receipting:** Professional PDF receipts generated instantly upon payment.
- **Financial Intelligence:** Detailed student statements and grade-wide financial health overviews.

### 🛡️ Security & Auditability
- **Synthetix Auth:** Role-based access control with `bcryptjs` encryption.
- **Immutable Activity Log:** A permanent audit trail of every financial and administrative action.
- **Data Ownership:** All data stays on the institution's hardware, ensuring absolute privacy and POPIA compliance.

### 💾 Data Resilience
- **Offline-First:** Zero dependency on internet for daily operations.
- **SQLite Reliability:** High-performance, single-file relational database.
- **Backup & Restore:** Integrated tools for data preservation and redundancy.

---

## 🛠️ Technical Stack

Built with the **Synthetix** design philosophy — "Squares and Cubes" — for a professional, minimalist aesthetic:

- **Runtime:** [Electron v42+](https://www.electronjs.org/)
- **Frontend:** [React v19](https://react.dev/) + [TypeScript v6](https://www.typescriptlang.org/)
- **Design System:** **Synthetix UI** (Custom tokens, Tailwind CSS v4, Glassmorphism)
- **Database:** [SQLite3 v6](https://www.sqlite.org/) (Integer-based cent storage)
- **Bundler:** [Vite v8](https://vitejs.dev/)

---

## 🏗️ Architecture

School Foundry uses a high-performance multi-process architecture:

- **Main Process:** Manages system integration, window lifecycles, and the SQLite core.
- **Renderer Process:** A reactive SPA driving the financial dashboards and management tools.
- **Data Layer:** Unified `db-client.ts` for low-latency renderer-to-DB communication via `@electron/remote`.

---

## 📁 Project Structure

```text
src/
├── main.ts              # Electron Main Process entry
├── renderer.tsx         # React Renderer Process entry
├── components/          # Modular UI (Payments, Student Manager, etc.)
├── db/                  # Schema, IPC, and Migrations
├── theme/               # Synthetix tokens and CSS
└── lib/                 # Printing, Auth, and Business Logic
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the application in development mode with HMR:
```bash
npx vite
```
*Note: This will start the Vite dev server and launch the Electron application automatically via the `vite-plugin-electron`.*

### Building for Production
```bash
npm run build
```
Build artifacts for Windows, Mac, or Linux will be in the `release/` directory.

---

## 📖 Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Technical Stack](docs/TECH_STACK.md)
- [User Guide](docs/USER_GUIDE.md)

---

## 📝 License
This project is licensed under the ISC License.
