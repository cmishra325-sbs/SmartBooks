# SBS-PER-001 — Persistence Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Solution Architecture  
**Priority:** Critical (Data Foundation)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md)

---

## 1. Purpose & Core Principles

This specification defines how SmartBooks persists, secures, and isolates business data. It maps modular code boundaries to database-level boundaries, establishes transactional boundaries, details the read-model update pipeline, and outlines the tenant-isolation strategy.

---

## 2. Data Ownership Registry

We align table namespace ownership directly with the approved solution modules:

| Bounded Context (Module) | Autoritative Data Owned | Schema Prefix |
| :--- | :--- | :--- |
| **Identity** | Users, roles, permissions, tenant profiles, audit logs | `identity.*` |
| **Catalog** | Items (Products/Services), pricing, tax rules | `catalog.*` |
| **Inventory** | Stock quantity buckets, warehouse locations, WAC values | `inventory.*` |
| **Partners** | Supplier and Customer profiles, contact details | `partners.*` |
| **Purchases** | Purchase Orders, Purchase Invoices, line items | `purchases.*` |
| **Sales** | Quotations, Sales Orders, Sales Invoices, lines, hold queue | `sales.*` |
| **Payments** | Receipts, Payouts, Contra transfers, allocations | `payments.*` |
| **Accounting** | General Ledger journals, Account lines, fiscal periods | `accounting.*` |
| **Commerce** | Channel credentials, website inventory sync metadata | `commerce.*` |
| **Automation** | Notification history, background worker states | `automation.*` |
| **AI** | Chat history logs, document extraction cache | `ai.*` |
| **Analytics** | Denormalized read-models, report snapshots | `analytics.*` |

---

## 3. Database Schema Isolation Rules

To allow future migration from a modular monolith database to independent databases, we enforce strict logical boundaries within the shared database:

```
[PostgreSQL Database]
├── Schema: catalog
│     └── Table: items  (No foreign keys to other schemas)
├── Schema: sales
│     └── Table: invoices (Has ItemId string, no SQL foreign key)
└── Schema: partners
      └── Table: partners (Has PartnerId string, no SQL foreign key)
```

### A. No Cross-Schema Foreign Keys
* **Rule**: Foreign keys are **only** permitted within a module's own schema (e.g. `sales.invoice_lines.invoice_id` referencing `sales.invoices.id`). 
* **Rationale**: Defining cross-schema foreign keys (e.g., an invoice line referencing a catalog item ID via database constraint) prevents database separation, blocking future microservices migration.
* **Integrity Enforcement**: Reference validations (e.g., verifying `ItemId` exists) are performed at the Application/Domain layer prior to saving.

### B. No Cross-Schema SQL Joins
* **Rule**: Code inside a module must **never** execute SQL queries containing joins across schema namespaces.
* **Rationale**: Querying multiple schemas in a single SQL statement binds the code to a single shared database engine.

---

## 4. Multi-Tenancy Segregation Strategy

For Version 1 of our SaaS, we implement a **Single Database, Shared Schemas, Logical Tenant Isolation** approach:

* **Discriminator Column**: Every table across all schemas must contain a `tenant_id` UUID column.
* **Access Filtering**: Row-Level Security (RLS) or repository-level query wrappers must inject the active `tenant_id` automatically into every query (e.g. `WHERE tenant_id = :active_tenant`). 
* **Rule**: Direct queries lacking a `tenant_id` clause are blocked at the driver level to prevent data leaks.

---

## 5. Deletion Invariants (Hard vs. Soft vs. Blocked)

To protect accounting integrity, we define strict rules for data deletions:

### A. Immutable Records (No Deletions Allowed)
* **Entities**: `PurchaseInvoice`, `SalesInvoice`, `Payment`, `StockMovement`, `JournalEntry`.
* **Rule**: Once a document transitions to a posted status, hard or soft deleting the row is forbidden. Corrections must be handled via balancing/compensating entries.

### B. Master Data (Soft Delete Only)
* **Entities**: `Item`, `BusinessPartner`, `Warehouse`.
* **Rule**: Hard deleting is prohibited if the record is referenced by a posted invoice. Instead, the row is marked as `is_deleted = true`. This prevents broken historical invoice lookups.

---

## 6. Read Model (CQRS) Update Pipeline

To optimize read performance without compromising write integrity, dashboard metrics and lists use denormalized tables in the `analytics` schema:

```
[Sales Write Model]  ───>  Commits Invoice  ───>  Emits SalesInvoicePosted
                                                         │
                                                         ▼
                                               [Analytics Subscriber]
                                                         │
                                                         ▼
                                               Updates flat read tables
                                               in analytics.* schema
```

* **Invariant**: Read models are read-only projections. Under no circumstances should operational commands write directly to the `analytics` schema tables.
* **Consistency**: Read models are eventually consistent.
