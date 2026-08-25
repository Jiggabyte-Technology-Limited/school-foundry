# Contributing to School Foundry 🎓

Thank you for your interest in contributing to **School Foundry**! School Foundry is an open-source **Digital Public Good (DPG)** engineered to empower schools and safeguard educational continuity in low-connectivity, blackout-prone environments across the Global South.

By participating, you help ensure that children in under-resourced communities can access education without administrative disruptions or wrongful exclusion.

---

## 🌟 How You Can Contribute

1. **Reporting Bugs**: Found an issue or UI glitch? Open an issue on GitHub describing the bug, steps to reproduce, and your OS version.
2. **Suggesting Features**: Propose ideas that enhance offline resilience, child safeguarding, local synchronization, or reporting formats.
3. **Submitting Pull Requests**: Contribute bug fixes, performance optimizations, accessibility enhancements, or documentation improvements.
4. **Localization & Translations**: Help translate the application UI into local African languages (e.g., Bemba, Nyanja, Tonga, Shona, Swahili).

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20 LTS recommended)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)

### 2. Clone & Install
```bash
# Clone your fork
git clone https://github.com/sewardrichard/school-foundry-offline.git
cd school-foundry-offline

# Install dependencies
npm install
```

### 3. Running in Development Mode
```bash
# Starts Vite HMR server and Electron concurrently
npm run dev
```

### 4. Building Production Distributables
```bash
# Builds local production installer into release/
npm run build
```

---

## 🌿 Branching & Pull Request Process

1. Fork the repository and create a descriptive branch from `main`:
   ```bash
   git checkout -b fix/receipt-thermal-overflow
   ```
2. Write clean, type-safe TypeScript code following project patterns.
3. Test your changes locally to ensure database transactions and offline operations remain intact.
4. Commit your changes using conventional commit messages:
   - `feat(...)`: New feature or capability
   - `fix(...)`: Bug fix
   - `docs(...)`: Documentation updates
   - `refactor(...)`: Code restructuring without functional change
5. Push to your fork and submit a Pull Request against `main`.

---

## 🛡️ Child Safeguarding & Privacy Guidelines

When developing features for School Foundry:
- **Never introduce cloud trackers or analytics pixels**: All telemetry must remain zero-footprint unless explicitly configured by the institution.
- **Maintain integer-cent currency precision**: Never use JavaScript floating-point numbers for financial sums.
- **Ensure local SQLite data sovereignty**: All PII must reside within the local SQLite database.

---

## 📜 Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).
