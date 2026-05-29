# School Foundry (Offline Edition)

> **"Intelligence Scaled. Convert Noise Into Clarity."**

School Foundry (also known as FeesFoundry) is a robust, offline-first school management ecosystem designed for the African B2B enterprise landscape. This repository contains the **Offline Desktop Version**, built to provide a reliable and secure platform for educational institutions in environments with unstable internet connectivity.

---

## 🌐 Versions

- **[Offline Edition (Current)]**: A standalone Electron desktop application for secure, local-first management.
- **[Cloud Edition]**: **Coming Soon.** A multi-tenant SaaS platform for remote access and scaled operations.

---

## 🚀 Key Features

### 👨‍🎓 Student & Enrollment Management
- **Persistent Student Registry:** Centralized student database that persists across academic cycles.
- **Academic Year Lifecycle:** Manage enrollments, terms, and grade transitions seamlessly.

### 💰 Fee & Payment Processing
- **Payment Wizard:** A secure, multi-step interface for high-integrity transaction recording.
- **Instant Receipting:** Professional PDF receipts generated instantly upon payment.

### 🛡️ Security & Offline Licensing
- **Symmetric Offline Activation:** To protect against unauthorized distribution, the app features a proprietary hardware-locked activation system. 
  - Generates a short 12-character Machine ID (e.g., `DEAA1860B03D`) locked to the motherboard and CPU.
  - Activated via a symmetric HMAC-SHA256 based 16-character license key (e.g., `ABCD-1234-EFGH-5678`).
- **Data Ownership:** All data stays on the institution's hardware, ensuring absolute privacy and POPIA compliance.

---

## 🛠️ Technical Stack

- **Runtime:** [Electron](https://www.electronjs.org/)
- **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Design System:** Custom tokens, Tailwind CSS
- **Database:** [SQLite3](https://www.sqlite.org/) (Integer-based cent storage to prevent floating-point errors)
- **Bundler:** [Vite](https://vitejs.dev/)

---

## 🏗️ Architecture

School Foundry uses a high-performance multi-process architecture:

- **Main Process:** Manages system integration, window lifecycles, and the SQLite core.
- **Renderer Process:** A reactive SPA driving the financial dashboards and management tools.
- **Keygen Web App (`/keygen-webapp`):** A standalone Express server used by the administrators to securely generate activation keys for clients based on their Machine IDs.

---

## 📁 Project Structure

```text
src/
├── main.ts              # Electron Main Process entry
├── renderer.tsx         # React Renderer Process entry
├── components/          # Modular UI (Payments, Student Manager, etc.)
├── db/                  # Schema, IPC, and Migrations
├── license/             # Hardware fingerprinting and HMAC license validation
├── services/            # Core business logic services (Students, Payments, Setup)
└── lib/                 # Core utilities (Auth, DB Client, Machine ID)

keygen-webapp/           # Separate Node.js application for generating License Keys
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the application in development mode with Hot Module Replacement (HMR):
```bash
npm run dev
```
*Note: This will start the Vite dev server and launch the Electron application automatically.*

### Building for Production
```bash
npm run build
```
Build artifacts for Windows, Mac, or Linux will be generated in the `release/` directory.

### Keygen Web App
To run the keygen web app, open a separate terminal:
```bash
cd keygen-webapp
npm install
npm start
```

---

## 📝 License
This project is licensed under the ISC License.
