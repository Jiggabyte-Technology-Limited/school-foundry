# Local Hotspot & Multi-Device Peer Synchronization Protocol 📡

> **Zero-Internet, Peer-to-Peer Offline Replication for Load-Shedding & Grid-Isolated Environments**

---

## 1. Overview & Problem Statement

In low-connectivity and off-grid schools across Southern Africa, multiple bursars or intake officers need to record fee payments simultaneously during busy registration periods (e.g. the first two weeks of a new term).

School Foundry enables multiple laptops to connect to a **standard Wi-Fi router or Windows Mobile Hotspot without internet** and automatically discover each other, replicate transactions in real-time, and maintain identical ledgers across all terminals.

---

## 2. Multi-Terminal Network Topology

```
                      ┌───────────────────────────────────────────────┐
                      │    Local Wi-Fi Router / Windows Hotspot       │
                      │            (192.168.137.x Subnet)             │
                      │               NO INTERNET REQUIRED            │
                      └───────┬───────────────────────────────┬───────┘
                              │                               │
                UDP Beacon    │                               │  UDP Beacon
                Port 51741    │                               │  Port 51741
                              ▼                               ▼
               ┌──────────────────────────────┐ ┌──────────────────────────────┐
               │      Bursar Terminal 1       │ │      Bursar Terminal 2       │
               │   (IP: 192.168.137.45:51740) │ │   (IP: 192.168.137.88:51740) │
               ├──────────────────────────────┤ ├──────────────────────────────┤
               │ • Node ID: node_a1b2c3       │ │ • Node ID: node_d4e5f6       │
               │ • Prefix: REC-T1-2026-XXXX   │ │ • Prefix: REC-T2-2026-XXXX   │
               │ • SQLite Local Database      │ │ • SQLite Local Database      │
               │ • Embedded HTTP Sync Server  │◄┼─► Embedded HTTP Sync Server  │
               └──────────────────────────────┘ └──────────────────────────────┘
```

---

## 3. Subnet Discovery Engine (`udp-beacon.ts`)

- **Protocol:** UDP Broadcast (`dgram`).
- **Port:** `51741`.
- **Frequency:** Heartbeat broadcast every 3 seconds to `255.255.255.255` and interface broadcast addresses.
- **Heartbeat Payload:**
  ```json
  {
    "app": "school-foundry-peer",
    "version": "1.0",
    "nodeId": "node_a1b2c3",
    "deviceName": "Bursar Terminal 1",
    "schoolName": "Lusaka Community School",
    "syncPort": 51740,
    "timestamp": 1756300000000
  }
  ```
- **Peer Lifecycle:**
  - Peers heard within 3 seconds are flagged as `online`.
  - Peers silent for > 7 seconds are flagged as `stale`.
  - Peers silent for > 12 seconds are automatically pruned from active peer state.

---

## 4. Embedded HTTP Sync Engine (`sync-server.ts`)

- **Server:** Node.js native `http` server on port `51740` (with automatic port escalation `51740-51750` if occupied).
- **Endpoints:**
  - `GET /api/sync/info`: Handshake endpoint exchanging terminal identity, device name, and schema version.
  - `POST /api/sync/pull`: Accepts `{ since: "<ISO_TIMESTAMP>" }`, returns all local mutations in `sync_deltas` since that cursor.
  - `POST /api/sync/push`: Accepts `{ deltas: [...] }` and executes an atomic SQLite transaction to apply incoming mutations.

---

## 5. Conflict-Free Multi-Master Concurrency Model

### 1. Global UUID Mapping (`sync_uuid`)
Every row across `students`, `payments`, `fee_structure`, `academic_years`, `terms`, `grades`, `class_sections`, `student_year_enrollment`, and `student_subsidies` has a unique `sync_uuid` (32-char hex). When Terminal 1 inserts payment `P1` and Terminal 2 inserts payment `P2`, both records have distinct `sync_uuid`s, preventing row replacement.

### 2. Receipt Number Partitioning
Receipt numbers are generated with node-prefixed codes:
- Terminal 1: `REC-T1-2026-0042`
- Terminal 2: `REC-T2-2026-0019`
This prevents collision errors when multiple cashiers issue paper receipts to parents simultaneously.

### 3. Commutative Integer-Cent Balances
Learner balances are derived dynamically from transaction history:
$$\text{Balance} = \sum (\text{Fee Invoices}) - \sum (\text{Valid Payments})$$
Because addition is commutative ($A + B = B + A$), when deltas from Terminal 1 and Terminal 2 merge in either order, both machines compute the exact same balance down to the single integer cent!
