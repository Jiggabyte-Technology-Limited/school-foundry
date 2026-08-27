# System Architecture

FeesFoundry follows a standard Electron multi-process architecture combined with a React single-page application frontend.

## 1. Process Model

### Main Process (`src/main.ts`)
- **Role:** The backend of the desktop application.
- **Responsibilities:**
  - Manages the application lifecycle (`app.whenReady`, window creation).
  - Handles native OS integrations.
  - Initializes and manages the SQLite database connection (`src/db/init.ts`).
  - Listens for IPC (Inter-Process Communication) calls from the renderer process.
  - Opens the window in maximized mode by default to ensure optimal dashboard viewing.

### Renderer Process (`src/renderer.tsx`, `src/components/*`)
- **Role:** The frontend UI.
- **Responsibilities:**
  - Renders the React component tree.
  - Handles routing via `react-router-dom`.
  - Manages local UI state.
  - Communicates with the main process (specifically the database) using the customized `db-client.ts` wrapper.

## 2. Database Integration Layer

Because the application requires direct access to a local SQLite database, it bypasses traditional REST APIs. 

### `src/lib/db-client.ts`
The renderer process uses a database client wrapper that leverages `@electron/remote` to interact directly with the `sqlite3` driver loaded in the Main process. 

- `db.get(query, params)`: Fetches a single row.
- `db.all(query, params)`: Fetches multiple rows.
- `db.run(query, params)`: Executes an insert/update/delete command.

*Note: For heightened security in future iterations, this remote module pattern could be migrated to a strict `contextBridge` + `ipcMain.handle` implementation.*

## 3. UI Architecture

### Theming and Styling
- **CSS Framework:** Tailwind CSS via `postcss` coupled with custom CSS variables (`src/theme/synthetix-tokens.css` and `src/index.css`).
- **Design System:** Minimalist, "glass-morphic" elements mixed with high-contrast data visualization to align with modern financial tools.

### Core Modules
1. **Authentication (`src/components/auth/`)**: Handles secure login, password hashing (`bcryptjs`), and user session management.
2. **Student Accounts (`src/components/StudentAccounts.tsx`)**: The central hub for viewing students, applying filters (Paid vs Owing), and generating dynamic financial statements.
3. **Payment Wizard (`src/components/PaymentWizard.tsx`)**: A multi-step modal for recording fee payments securely.
4. **Dashboard (`src/components/Dashboard.tsx`)**: Provides aggregate institutional metrics.