# SBS-FE-001 — Frontend Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Frontend Architecture  
**Priority:** Critical (User Experience Layer)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md), [SBS-API-001_API_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-API-001_API_Architecture.md)

---

## 1. Purpose & Layer position

This specification defines the architectural patterns, state divisions, module boundaries, and performance standards for the SmartBooks frontend user interface. Working within the outermost Clean Architecture layer, the frontend consumes only the published HTTP REST APIs and translates user interactions into API requests.

---

## 2. Feature-Based Directory Isolation (Boundary Rules)

To ensure frontend modularity and allow micro-frontends transition in the future, the code is organized into self-contained feature slices:

```text
src/
├── features/
│   ├── sales/                 # Isolated Sales Bounded Context
│   │   ├── components/        # Feature-specific UI components
│   │   ├── hooks/             # Local state and API query logic
│   │   ├── api/               # API query definitions for Sales
│   │   └── index.ts           # Public entrypoint (Facade) for other features
│   └── catalog/
├── design-system/             # Global presentation components (buttons, grids)
├── core/                      # Shell, routing, global authentication context
└── shared/                    # Utilities, general helpers
```

### Inbound Import Restrictions
* **Rule**: Sub-folders within a feature are private. A feature must **never** import directly from the internals of another feature (e.g. `import from '../sales/components/InvoiceCard'`).
* **Facade Entrypoint**: Cross-feature imports must import exclusively from the feature's root `index.ts` (e.g. `import { SalesInvoiceCard } from '@/features/sales'`). This boundary is enforced via ESLint import-rules.

---

## 3. Server State vs. Client State (TanStack Query standard)

SmartBooks separates data into **Server State** (local cache of API database records) and **Client State** (form buffers, modal toggles, current theme):

* **Server State Synchronization**: Feature modules must manage API queries and mutations using a dedicated server-state management tool (e.g. **TanStack Query**).
* **Benefits**: Eliminates manual `useEffect` API loops, handles network failures and automatic backoff retries, performs background data refetching, and provides clean cache invalidation (e.g., posting a sales invoice invalidates the `['sales', 'invoices']` query key, triggering a silent list refresh).

---

## 4. In-Memory POS Cache & Barcode Processing Invariant

To satisfy the **under-30-seconds checkout** requirement, the Sales Workspace POS interface operates offline-first for item scans:

```
[Cashier Scans Barcode]
          │
          ▼
[Local POS Cache (IndexedDB)] ───> Instant retrieve of Item, price, & taxes.
          │
          ▼
[Update Local UI State] ─────────> Quantity increments immediately (< 50ms).
          │
          ▼ (No network calls)
[Ready for Next Scan]
```

* **Execution**: During initialization, the Sales Workspace downloads the item catalog and tax registry to client-side storage (IndexedDB). Scanning queries this local store, recalculating totals instantly without network calls.
* **Commit**: API requests are deferred until the final "Post & Pay" command is submitted.

---

## 5. Metadata Tracing & Correlation Propagation

To enable end-to-end tracing from the client mouse-click to database ledger records:
* **Correlation ID Generation**: When a user triggers an action (e.g., clicking "Post Invoice" or submitting an upload file), the frontend generates a unique `correlationId` (UUID v4).
* **HTTP Headers**: This ID is injected into the HTTP request headers:
  * `X-Correlation-ID: corr-87f9-231a`
* **Log Matching**: The ID is logged locally in the browser console for UI exception tracking.

---

## 6. Frontend Capabilities Traceability Matrix

| Capability | UI Workspace | Primary APIs Consumed | Backend Module |
| :--- | :--- | :--- | :--- |
| **Sales Billing** | `/sales/pos`, `/sales/invoices` | Sales API | `Sales` |
| **Stock Management**| `/inventory/stock`, `/inventory/transfers`| Inventory API | `Inventory` |
| **Procurement** | `/purchases/invoices` | Purchases API | `Purchases` |
| **Settlements** | `/payments/receipts`, `/payments/payouts`| Payments API | `Payments` |
| **Ledger Audits** | `/accounting/journals`, `/accounting/ledger`| Accounting API | `Accounting` |
| **Products & Taxes**| `/catalog/items` | Catalog API | `Catalog` |
| **Partner Registry**| `/partners/business-partners` | Partner API | `Partners` |
| **Automation** | `/settings/notifications`, `/settings/whatsapp`| Automation API | `Automation` |
| **AI Assist** | `/ai/copilot` | AI API | `AI` |
| **Analytics BI** | `/analytics/dashboards`, `/analytics/reports`| Analytics API | `Analytics` |
