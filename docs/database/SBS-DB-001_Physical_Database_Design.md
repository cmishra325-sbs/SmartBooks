# SBS-DB-001 — Physical Database Design

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Data Architecture  
**Priority:** Critical (Implementation)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md), [SBS-DBA-001_Database_Design_Standards.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/engineering/SBS-DBA-001_Database_Design_Standards.md)

---

## 1. Purpose & Database Topology

This specification defines the physical schema architecture of the SmartBooks operational database. The application runs on a single PostgreSQL cluster. Segregation of modular database contexts is enforced through PostgreSQL schemas, preparing the data layer for zero-rewrite division into separate database instances in the future.

---

## 2. Schema Authorization & Security Boundaries

To prevent developer shortcuts and database coupling in the code:
* **DBMS Roles**: Create distinct database user roles for each module (e.g. `db_user_sales`, `db_user_inventory`).
* **Privilege Restrictions**:
  * `db_user_sales` owns and has `ALL PRIVILEGES` on the `sales` schema. It is granted `NO ACCESS` to the `inventory` or `accounting` schemas.
  * Cross-schema writes are blocked at the database engine level.
  * Sharing database connection pools across modules is prohibited; each module connection pool authenticates using its respective domain role.

---

## 3. Schema Ownership & Aggregate Registry

We align schemas and aggregates to the approved ubiquitous language:

| Schema Name | Bounded Context Owner | Core Aggregate Roots | Write Privileges |
| :--- | :--- | :--- | :--- |
| **`identity`** | Identity | `User`, `TenantProfile` | `identity` role only |
| **`catalog`** | Catalog | `Item` (Products/Services), `TaxCategory` | `catalog` role only |
| **`inventory`** | Inventory | `InventoryStock`, `Warehouse` | `inventory` role only |
| **`partners`** | Partners | `BusinessPartner` | `partners` role only |
| **`purchases`** | Purchases | `PurchaseInvoice`, `PurchaseOrder` | `purchases` role only |
| **`sales`** | Sales | `SalesInvoice`, `SalesOrder` | `sales` role only |
| **`payments`** | Payments | `Payment` | `payments` role only |
| **`accounting`** | Accounting | `JournalEntry`, `FiscalPeriod` | `accounting` role only |
| **`commerce`** | Commerce | `ChannelConnection` | `commerce` role only |
| **`automation`** | Automation | `NotificationLog`, `SagaState` | `automation` role only |
| **`ai`** | AI | `AIInteractionLog` | `ai` role only |
| **`analytics`** | Analytics | None (Read-only projections) | `analytics` subscriber role |

---

## 4. Transactional Outbox Table Schema Blueprint

To ensure eventual consistency, every schema that performs write transactions (e.g. `sales`, `purchases`, `payments`) must include an `outbox_events` table configured as follows:

```sql
CREATE TABLE <schema_name>.outbox_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSONB NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSED, FAILED
    correlation_id UUID NOT NULL,
    error_log      TEXT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at   TIMESTAMPTZ NULL
);
```

### Invariants
* **Atomicity**: Operational entities and their outbox events must be written within the same database transaction.
* **Index**: An index must exist on `(status, created_at)` to support rapid polling by the background event dispatcher.

---

## 5. Read Projection Layout (CQRS analytics schema)

The `analytics` schema stores denormalized, flattened query models:
* **Implementation**: Uses standard tables (not Postgres Views) updated asynchronously by outbox event subscribers.
* **Format**: Stores complex nested structures (e.g. invoice items, customer names) in `JSONB` columns, backed by GIN (Generalized Inverted Index) indexes to support high-speed ad-hoc querying.
* **Isolation**: Read models are strictly read-only for reporting controllers; they are never queried by write application services.

---

## 6. Physical Indexing Blueprint

In addition to standard primary key indexes, we enforce mandatory indexes to ensure multi-tenant query performance:
* **Tenant Partitioning Compound Indexes**: All lookup queries must include `tenant_id`. Therefore, lookup tables must utilize compound indexes:
  * Catalog items: `CREATE INDEX ON catalog.items (tenant_id, barcode);`
  * Sales invoices: `CREATE INDEX ON sales.invoices (tenant_id, invoice_number);`
* **Outbox Performance Indexes**: `CREATE INDEX ON <schema_name>.outbox_events (status) WHERE status = 'PENDING';`
