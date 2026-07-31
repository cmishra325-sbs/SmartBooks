# SBS-IMP-001 — SmartBooks Implementation Blueprint

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Chief Architect / Engineering Manager  
**Priority:** Critical  
**Related Specs:** [SBS-000_SmartBooks_Engineering_Constitution.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-000_SmartBooks_Engineering_Constitution.md), [SBS-ARCH-OVERVIEW-001_Enterprise_Architecture_Overview.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-OVERVIEW-001_Enterprise_Architecture_Overview.md)

---

## 1. Purpose & Implementation Roadmap

This specification defines the sequence of development phases for SmartBooks. It details the dependencies, concrete milestone exit criteria, and testing gates, translating the enterprise architecture into an executable engineering plan.

The development roadmap is structured into 6 progressive phases:

```
Phase 0: Foundations & Local Dev Environment
                   │
                   ▼
Phase 1: Platform Identity & Tenant Isolation
                   │
                   ▼
Phase 2: Master Data Catalogs (Items & Partners)
                   │
                   ▼
Phase 3: Core Transaction Workflows (Sales, Purchases, Inventory, Payments)
                   │
                   ▼
Phase 4: Financial Core & Analytics (Accounting & Dashboards)
                   │
                   ▼
Phase 5: Automation, Integrations & AI (WhatsApp, Shopify, Gemini Ingest)
                   │
                   ▼
Phase 6: Production Hardening & GA Release
```

---

## 2. Phase Deliverables & Exit Criteria

### Phase 0: Foundations
* **Objectives**: Initialize codebase, set up local infrastructure, and configure CI/CD gates.
* **Deliverables**:
  * Repository initialization with ESLint import-boundary rules configured to prevent cross-module violations.
  * Local PostgreSQL environment running via Docker Compose.
  * CI pipeline configured to run unit tests and check ESLint compilation on every pull request.
* **Exit Criteria**: A new engineer can clone the repository, run `docker compose up`, and launch a clean local build with a single command.

### Phase 1: Platform Core (Identity)
* **Objectives**: Implement security, users, and multi-tenant isolation.
* **Deliverables**:
  * Database schema `identity` initialized.
  * User authentication endpoint (JWT generation).
  * Tenant context middleware (extracts `tenant_id` from JWT claims and configures PostgreSQL Row-Level Security).
* **Exit Criteria**: APIs reject queries lacking a valid JWT and fail if the active tenant context cannot be resolved.

### Phase 2: Master Data (Catalog & Partners)
* **Objectives**: Build registries of items and contacts.
* **Deliverables**:
  * Database schemas `catalog` and `partners` initialized.
  * Item Registry (`Item` aggregate: Products/Services/Bundles, tax categories, barcodes).
  * Partner Directory (`BusinessPartner` aggregate: Customer/Supplier roles, GSTIN validation, credit limit limits).
* **Exit Criteria**: Master items and partners can be created, updated (soft deleted), searched, and audited locally.

### Phase 3: Core Transactions (Sales, Purchases, Inventory, Payments)
* **Objectives**: Implement commercial and movement transaction workflows.
* **Deliverables**:
  * Schemas `sales`, `purchases`, `inventory`, and `payments` initialized.
  * POS billing checkout workspace (IndexedDB local POS catalog cache, split-payment allocations).
  * Warehouse stock tracking (quantity buckets, WAC valuation, physical adjustments, transfers).
  * Outbox event tables (`outbox_events` in each schema) running with transactional commits.
* **Exit Criteria**: Sales checkouts complete under 30s locally; stock levels are modified only through posted movements; payments allocate to invoices; and outbox logs are written within the same DB transaction.

### Phase 4: Financial Core & Analytics (Accounting & Dashboards)
* **Objectives**: Implement double-entry General Ledger and dashboards.
* **Deliverables**:
  * Schemas `accounting` and `analytics` initialized.
  * Accounting listener mapping incoming events (`SalesInvoicePosted`, `PaymentPosted`) to balanced journal lines.
  * Denormalized read-model tables in the `analytics` schema populated by outbox event subscribers.
* **Exit Criteria**: Posting an invoice automatically generates a balanced debit/credit journal entry; Trial Balance balances mathematically; and Profit & Loss reports query the `analytics` schema in under 200ms.

### Phase 5: Automation, Integrations & AI (WhatsApp, Shopify, Gemini)
* **Objectives**: Implement automation webhooks, external channels, and AI parsing.
* **Deliverables**:
  * Schemas `automation`, `commerce`, and `ai` initialized.
  * Webhook Inbox Buffer table (`webhook_inbox`) for incoming WhatsApp and gateway callbacks.
  * Gemini API adapter with structured JSON schema outputs for invoice document intelligence.
  * Commerce webhook sync connectors (syncing stock levels to Shopify/WooCommerce).
* **Exit Criteria**: OCR parser parses uploaded PDF bills directly into draft invoices; Lien WhatsApp template alerts trigger on transaction completion; and stock level syncs to channels are throttled/debounced.

### Phase 6: Production Hardening
* **Objectives**: Hardening, penetration testing, and disaster recovery.
* **Deliverables**:
  * Automated database backup and point-in-time recovery verification.
  * Performance load-testing simulating POS cashier checkout traffic.
  * Security penetration scans and accessibility audits.
* **Exit Criteria**: Zero high-severity security vulnerabilities remain; rollback testing is validated; and database recovery tests complete successfully.

---

## 3. Mandatory Quality & Test Gates

Before code is approved for staging or production, it must satisfy the following automated code gates:

* **Domain Unit Test Coverage**: Must meet **100% test coverage** for the Domain Layer (aggregates, value objects, domain services), as it houses the sacred business rules.
* **Application Use Case Coverage**: Must meet **$\ge 80\%$ test coverage** for Application Use Case handlers (testing commands, queries, and transaction boundaries).
* **Linting Invariant Checks**: Every build execution runs `dependency-cruiser` to block compile-time boundary violations (e.g. preventing the Domain from importing Infrastructure).
