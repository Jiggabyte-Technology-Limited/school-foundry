# FeesFoundry Documentation

Welcome to the official documentation for **FeesFoundry**, the definitive financial operating system for modern academic institutions.

## Table of Contents
1. [Technical Stack (TECH_STACK.md)](./TECH_STACK.md)
2. [System Architecture (ARCHITECTURE.md)](./ARCHITECTURE.md)
3. [Database Schema (DATABASE_SCHEMA.md)](./DATABASE_SCHEMA.md)
4. [User Guide (USER_GUIDE.md)](./USER_GUIDE.md)
5. [Marketing & Distribution (MARKETING_AND_DISTRIBUTION.md)](./MARKETING_AND_DISTRIBUTION.md)

## Project Overview
FeesFoundry is an offline-first desktop application built with Electron, React, and SQLite. It is designed to run locally without requiring internet access or recurring subscriptions, ensuring full data ownership and zero downtime for schools.

### Key Value Propositions
- **Works Offline:** No internet required for core operations.
- **One-Off Payment:** No recurring SaaS subscriptions.
- **Full Data Ownership:** All data resides on the local machine via SQLite.
- **Purpose-Built:** Designed specifically for primary and high schools.

## Getting Started (Development)

### Prerequisites
- Node.js (LTS recommended)
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start the application in development mode
npm run dev
```

### Building for Production
```bash
# Build the React frontend and package the Electron app
npm run build
```

This will output the packaged application installer to the `release` directory.