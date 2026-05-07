# Synthetix UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely migrate the application UI to the "Synthetix - Intelligence Scaled" design language, starting with a modern Welcome and Login experience, while preserving existing app functionality.

**Architecture:** 
- The migration will happen in a new branch `feature/synthetix-ui-migration`.
- We will replace the existing UI components with the Synthetix design system:
  - Welcome/Login flow as the entry point.
  - Consistent layout structures using the Bento grid density.
  - Typography update (Inter/JetBrains Mono).
  - Theme token migration.
- Functional logic (DB, State, IPC) remains untouched.

**Tech Stack:** React, TypeScript, CSS (Modules), Vite, Electron (presumed).

---

### Task 1: Initialize Synthetix Theme Tokens
**Files:**
- Modify: `src/index.css`
- Create: `src/theme/synthetix-tokens.css`

- [ ] **Step 1: Define CSS variables for the Synthetix palette**
- [ ] **Step 2: Update `index.css` to import the new tokens**

### Task 2: Implement Welcome & Login Screens
**Files:**
- Create: `src/components/auth/Welcome.tsx`
- Create: `src/components/auth/Login.tsx`
- Modify: `src/App.tsx` (Route logic)

- [ ] **Step 1: Create Welcome page with Synthetix display typography**
- [ ] **Step 2: Create Login page with card-density layout and Synthetix control styles**
- [ ] **Step 3: Update routing to ensure Welcome -> Login -> App flow**

### Task 3: Refactor Main Dashboard to Synthetix Bento Grid
**Files:**
- Modify: `src/components/Dashboard.tsx`
- Create: `src/components/ui/SynthetixCard.tsx`

- [ ] **Step 1: Implement the `SynthetixCard` wrapper**
- [ ] **Step 2: Replace existing grid with Synthetix Bento structure**
- [ ] **Step 3: Update typography and padding to match Synthetix tokens**

### Task 4: UI/UX Verification
**Files:**
- N/A (Manual Review)

- [ ] **Step 1: Verify all routes follow the Synthetix layout**
- [ ] **Step 2: Ensure dark/light contrast matches Synthetix spec**
- [ ] **Step 3: Verify no functional regressions in data management**

---
