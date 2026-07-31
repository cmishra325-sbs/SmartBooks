# SBS-DBA-001 — Database Design Standards

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Solution Architecture / Data Architecture  
**Priority:** Critical (Implementation Foundation)  
**Related Specs:** [SBS-PER-001_Persistence_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-PER-001_Persistence_Architecture.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md)

---

## 1. Purpose & Guiding Principles

This specification defines the physical and logical database standards for SmartBooks. It governs naming conventions, primary key strategies, monetary precision, concurrency controls, and timezone rules, ensuring consistency across all database schemas.

---

## 2. Identifier Strategy (UUID v7 standard)

To facilitate future database segregation (microservices migration) without risk of key collisions:
* **Primary Key Standard**: All primary keys must be **UUID v7** (or **ULID**).
* **Rationale**: Unlike random UUID v4, UUID v7 is lexically sortable because it encodes a millisecond-precision Unix timestamp in its leading bits. This prevents B-tree index fragmentation and insertion performance degradation while maintaining global uniqueness.
* **Foreign Keys**: Referenced columns must be named `<entity>_id` matching the type of the target primary key.

---

## 3. Strict Naming Conventions

All database schemas, tables, and columns must adhere to the following rules:

| Database Object | Convention | Example |
| :--- | :--- | :--- |
| **Schema Names** | Singular business domain | `sales`, `catalog`, `inventory` |
| **Table Names** | Plural nouns, snake_case | `invoice_lines`, `business_partners` |
| **Column Names** | snake_case | `total_amount`, `average_unit_cost` |
| **Primary Key** | Always named `id` | `id` |
| **Boolean Flags** | Prefix with `is_`, `has_`, or `can_` | `is_active`, `is_deleted` |
| **Timestamp Columns**| Suffix with `_at` | `created_at`, `updated_at`, `posted_at` |

> [!WARNING]
> **Enum Convention**: Do not use database-level native enums (e.g. PostgreSQL `CREATE TYPE status_enum`). Native enums are highly rigid and difficult to alter during database migrations. Instead, store status codes as standard string types (`varchar` or `text`) and enforce validity in the Application layer.

---

## 4. Standard Audit Columns

Every table representing a mutable business entity must include the following audit fields:

```text
Table Definition
 ├── tenant_id   UUID          (Mandatory. Enforces row-level isolation)
 ├── created_at  TIMESTAMPTZ   (Immutable timestamp in UTC)
 ├── updated_at  TIMESTAMPTZ   (Mutable timestamp in UTC)
 ├── created_by  UUID          (UserId of the creator)
 └── updated_by  UUID          (UserId of the last modifier)
```

---

## 5. Monetary Values & Financial Precision

To prevent rounding errors and comply with Chartered Accounting (India) regulations:
* **Precision Standard**: Store all money values in `numeric(18, 4)` columns. Floating-point numbers (`float`, `real`, `double precision`) are **strictly prohibited** for financial calculations.
* **Why 4 Decimals?**: Storing up to 4 decimal places prevents rounding truncation errors from compounding during line-item calculations, discounts, and weighted average cost (WAC) updates.

---

## 6. Timezones & Effective Dates

* **Storage Standard**: All timestamps must be stored in UTC using the **`timestamptz`** (Timestamp with Time Zone) data type in PostgreSQL.
* **App Invariant**: System times are parsed/formatted locally at the presentation layer; the database only writes and reads UTC.
* **Business-Effective Dates**: Document dates (e.g., `invoice_date`) are stored separate from system timestamps (`created_at`) using standard `date` or `timestamptz` types based on business rules.

---

## 7. Optimistic Concurrency Control (OCC)

To prevent the "lost update" problem where multiple users edit the same entity simultaneously (e.g., two cashiers updating the same item quantity):
* **Version Invariant**: Every mutable aggregate root table (e.g. `inventory.inventory_stocks`) must include a `version` integer column (defaulting to 1).
* **Operation**: Updates must increment the version and evaluate the previous state:
  ```sql
  UPDATE inventory.inventory_stocks 
  SET quantity_on_hand = :new_qty, version = version + 1 
  WHERE id = :id AND version = :expected_version;
  ```
* **Failure Handling**: If the update returns 0 affected rows, the application throws a `ConcurrencyException` and prompts the user to refresh.
