# 🧠 AUTOAGENT — Project Overview for Codex

## 🔍 Project Summary

**AutoAgent** is a **vehicle search and lead management SaaS** designed to work directly inside **ChatGPT via the Apps SDK (MCP protocol)**.
It lets users **search live car listings**, **view map-based results**, and **submit leads** directly to dealerships — all from within ChatGPT.

This project integrates:

* A **MarketCheck API** for real-time vehicle listings
* **Custom MCP server** for OpenAI App SDK
* **Interactive vehicle search widgets** (Zillow-style map + cards)
* **Encrypted lead capture system** that forwards data to a **Dealer Dashboard**
* **Full diagnostic layer** for debugging ChatGPT timeouts and app validation

---

## 🧩 Tech Stack

| Layer            | Technology                                  | Purpose                                     |
| ---------------- | ------------------------------------------- | ------------------------------------------- |
| Server           | **Node.js + Express**                       | Hosts the MCP endpoint and widgets          |
| MCP              | **OpenAI Apps SDK (JSON-RPC 2.0)**          | Enables ChatGPT ↔ AutoAgent communication   |
| Database         | **SQLite**                                  | Stores encrypted leads                      |
| Frontend Widgets | **Pure HTML + Leaflet.js + CSS**            | Embedded iframes for ChatGPT UI             |
| APIs             | **MarketCheck**                             | Vehicle listings and specs                  |
| Encryption       | **libsodium (XSalsa20-Poly1305)**           | Encrypts PII in leads                       |
| Auth             | **Bearer tokens**                           | Dealer dashboard access                     |
| Diagnostics      | **Run ID tracking + Beacon + Console logs** | Full visibility into UI ↔ ChatGPT lifecycle |

---

## 🚗 Core Features

### 1. **Vehicle Search (search-vehicles tool)**

* Calls MarketCheck API using query parameters (make, model, location, condition, price range)
* Returns structured vehicle data with VIN, dealer info, and coordinates
* Includes a `components` array with an iframe pointing to:

  ```
  https://<ngrok-url>/widget/vehicle-results
  ```

### 2. **Zillow-Style Map Widget**

* Full-screen **Leaflet.js map**
* **Bottom sheet** with collapsible vehicle list
* **Pin ↔ Card linking** (highlight pin when card selected)
* **Filter chips**, price bubbles, and smooth transitions
* **Dark mode optimized for ChatGPT embedding**
* **Responsive** and mobile-friendly

### 3. **Lead Capture System**

* User clicks “Book Test Drive” or “Get Quote”
* Opens lead form → validates + encrypts data
* Stores in SQLite and forwards to dealer dashboard
* Fields include:
  `name, email, phone, vin, vehicleId, dealerId, consent, timestamp`

### 4. **Dealer Dashboard**

* Displays encrypted leads (decrypts if key present)
* Shows VIN, timestamp, and contact info
* Uses `Bearer` token auth for restricted access

---

## ⚙️ Diagnostic System

Built to debug ChatGPT connection & UI validation timeouts.

### Includes:

* **Run IDs (UUIDs)** for each tool call
* **Beacon endpoints** (`/widget/beacon`) for `ui:ready` timing
* **Console relay** (`/widget/console`) for browser logs
* **CSP headers** allowing embedding:

  ```
  frame-ancestors https://chat.openai.com https://chatgpt.com
  ```
* **HEAD /mcp handler** to pass ChatGPT’s health check
* **Diagnostic query mode:** `?diag=1` adds verbose bridge testing

---

## 🧪 Testing Tools

| Tool Name        | Purpose                                   | Endpoint                  |
| ---------------- | ----------------------------------------- | ------------------------- |
| `pingUi`         | Basic widget load test                    | `/widget/ping`            |
| `pingMicroUi`    | Minimal iframe test for ChatGPT embedding | `/widget/micro`           |
| `searchVehicles` | Main MarketCheck integration              | `/widget/vehicle-results` |
| `submitLead`     | Encrypted lead submission                 | `/widget/lead`            |

---

## ✅ What’s Working

* MCP handshake (`initialize`, `tools/list`) — ✅
* HEAD `/mcp` health check — ✅
* Components pattern (iframe URLs) — ✅
* MarketCheck integration — ✅
* Lead capture encryption + dashboard forwarding — ✅
* CSP headers and frame embedding — ✅
* Diagnostic beacons and console logs — ✅

---

## 🧩 What Was Fixed Recently

| Problem                            | Root Cause                                                             | Fix                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ❌ ChatGPT timeouts on creation     | Missing `initialized` + `notification` fields in `initialize` response | Added `initialized:true` + `"notification":{"method":"initialized"}` |
| ❌ Missing `heartbeat()` in widgets | Script crash before `ui:ready`                                         | Added fallback emitter                                               |
| ❌ CSP blocking embedding           | No `frame-ancestors` directive                                         | Added correct CSP headers                                            |
| ❌ `_meta` pattern deprecated       | ChatGPT Apps SDK now requires `components` array                       | Migrated all tools                                                   |
| ❌ Server caching old build         | Nodemon didn’t restart                                                 | Forced clean restart + version logging                               |

---

## 🚀 Current App URLs

| Component               | URL                                                                     |
| ----------------------- | ----------------------------------------------------------------------- |
| **MCP Endpoint**        | `https://rana-flightiest-malcolm.ngrok-free.dev/mcp`                    |
| **Vehicle Widget**      | `https://rana-flightiest-malcolm.ngrok-free.dev/widget/vehicle-results` |
| **Micro Widget (test)** | `https://rana-flightiest-malcolm.ngrok-free.dev/widget/micro`           |
| **Beacon**              | `/widget/beacon`                                                        |
| **Console**             | `/widget/console`                                                       |
| **Dealer Dashboard**    | `https://rana-flightiest-malcolm.ngrok-free.dev/dashboard`              |

---

## 🧰 Developer Notes for Codex

### 1. **If ChatGPT Times Out During Creation**

Check if `/mcp` responds with:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {...},
    "serverInfo": {...},
    "initialized": true,
    "notification": {"jsonrpc":"2.0","method":"initialized","params":{}}
  }
}
```

If `initialized` or `notification` are missing → ChatGPT will hang.

### 2. **If Widget Fails to Load**

Confirm:

* `frame-ancestors` CSP allows ChatGPT
* `window.openai` is defined
* `ui:ready` beacon fires within 3 seconds
* Logs appear at `/widget/console`

### 3. **If Beacons Not Reaching**

Run:

```bash
curl -X POST https://<ngrok>/widget/beacon \
  -H "Content-Type: application/json" \
  -d '{"tag":"test","ts":123}'
```

Expect `200 OK`.

---

## 🧱 Folder Structure

```
apps/
├── mcp-server/
│   ├── src/
│   │   ├── index.ts              # Express app + routes
│   │   ├── tools/
│   │   │   ├── searchVehicles.ts # MarketCheck integration
│   │   │   └── submitLead.ts     # Encrypted lead submission
│   │   ├── ui/
│   │   │   ├── vehicle-results.html
│   │   │   ├── micro.html
│   │   │   └── ping.html
│   │   ├── db/
│   │   │   └── leads.sqlite
│   │   ├── .well-known/
│   │   │   ├── ai-plugin.json
│   │   │   └── openapi.yaml
│   │   └── mcp-handler.ts
│   ├── package.json
│   └── tsconfig.json
└── dealer-dashboard/
    ├── src/
    │   ├── pages/leads.tsx
    │   └── lib/db.ts
    └── package.json
```

---

## 🔮 Next Development Tasks for Codex

1. **Add Dealer Onboarding System**

   * Form for uploading feed URLs or selecting CDK/MarketCheck
   * Store dealership credentials securely

2. **Add Feed Parsing**

   * Parse and normalize inventory feeds from CDK, Homenet, or MarketCheck
   * Auto-refresh every 24 hours per dealership

3. **Deploy Persistent Database**

   * Migrate SQLite → Supabase or Postgres
   * Add user accounts, dealership IDs, API tokens

4. **Improve Lead Dashboard**

   * Filter by VIN, dealer, or date
   * Add export (CSV, PDF)
   * Add lead status tracking

5. **Add Authentication for Dealers**

   * OAuth or JWT-based login system
   * Allow each dealer to manage their own inventory + leads

6. **MCP Extension**

   * Add more tools (`get-dealer-stats`, `update-vehicle`, `fetch-leads`)
   * Add real-time push notifications when a new lead is submitted

---

## 🧩 Summary for Codex

You are assisting development of a **full SaaS platform** integrating with **OpenAI’s Apps SDK (MCP)**.
Your responsibilities include:

* Maintaining compliance with the **JSON-RPC 2.0** spec
* Supporting **ChatGPT app creation validation**
* Ensuring all widgets properly **emit `ui:ready` events**
* Preserving **CSP and header configurations**
* Enabling seamless **dealer onboarding** and **inventory synchronization**

The core infrastructure is **stable and production-ready**, and the next phase focuses on expanding dealer tools, improving onboarding UX, and refining the MarketCheck integration pipeline.

---

Would you like me to add a **"Codex Task Index"** section (a checklist of code-level tasks Codex can auto-complete, like writing helper functions, testing routes, and handling CDK feed ingestion)? It’ll make your Codex autocompletions even more directed.
