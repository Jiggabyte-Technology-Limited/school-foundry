# Technical Stack

FeesFoundry is built on a highly pragmatic, offline-first technology stack designed to maximize reliability and minimize deployment friction for schools in emerging markets.

## Core Technologies

### 1. Desktop Runtime: Electron
- **Version:** ^42.0.0
- **Why Electron?** Enables the distribution of a cross-platform (Windows/Mac/Linux) desktop application using web technologies. Crucially, it allows the application to run entirely offline, which is a core requirement for schools operating in areas with unstable internet connectivity.
- **Packaging:** Handled by `electron-builder` to generate installable `.exe`, `.dmg`, or `.AppImage` files.

### 2. Frontend Framework: React (TypeScript)
- **Version:** ^19.2.5
- **Why React?** Provides a robust component-based architecture for building a reactive, data-heavy user interface (like financial dashboards and student lists).
- **TypeScript:** Enforces strict type-checking across the application, significantly reducing runtime errors and improving maintainability.

### 3. Build Tool: Vite
- **Version:** ^8.0.10
- **Why Vite?** Replaces Webpack/CRA for lightning-fast Hot Module Replacement (HMR) during development and highly optimized rollup builds for production. It is specifically configured via `vite-plugin-electron` to handle the dual main/renderer process build steps.

### 4. Database: SQLite3
- **Version:** ^6.0.1
- **Why SQLite?** The ultimate embedded database. It requires zero configuration, no background server process, and stores all data in a single local file. This guarantees that the school maintains absolute ownership of their financial data and that the app works seamlessly offline.

### 5. Styling: Tailwind CSS v4
- **Version:** ^4.2.4
- **Why Tailwind?** Utility-first CSS framework that allows for rapid UI development without writing custom CSS classes. It is combined with custom CSS variables (design tokens) to maintain a strict, professional aesthetic ("Squares and Cubes" philosophy).

### 6. Security: bcryptjs
- **Version:** ^2.4.3
- **Why bcryptjs?** Used to securely hash and verify administrator and office staff passwords before storing them in the SQLite database, ensuring local data security even if the database file is accessed directly.