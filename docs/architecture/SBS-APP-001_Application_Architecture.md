# SBS-APP-001 — Application Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Solution Architecture  
**Priority:** Critical (Application Layer)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md), [SBS-INT-001_Interaction_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-INT-001_Interaction_Architecture.md)

---

## 1. Purpose & Layer Position

This specification details the structure, responsibilities, and request pipeline of the SmartBooks **Application Layer**. In accordance with Clean Architecture, this layer serves as the boundary between external triggers (HTTP APIs, WhatsApp webhooks) and core business invariants. It orchestrates domain entities and database transactions but contains no business rules.

---

## 2. Command Query Responsibility Segregation (CQRS)

SmartBooks strictly separates write operations (Commands) from read operations (Queries) to maximize performance and simplify data access:

```
                  ┌──────────────────────────────┐
                  │      Presentation Layer      │
                  │   (Controllers, UI Views)    │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼ (Write Command)                               ▼ (Read Query)
┌─────────────────┐                             ┌─────────────────┐
│Application Cmd  │                             │Application Query│
│   Handler       │                             │   Handler       │
└────────┬────────┘                             └────────┬────────┘
         │                                               │ (Raw SQL / projection)
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│  Domain Layer   │                             │ Denormalized    │
│(Aggregates, WAC)│                             │ Read Model (DB) │
└─────────────────┘                             └─────────────────┘
```

### A. Write Pipeline (Commands)
* **Execution**: Command Handlers query the repository, instantiate the Aggregate Root, execute domain operations (invoking business invariants), commit database transactions, and queue Outbox events.

### B. Read Pipeline (Queries)
* **Execution**: Query Handlers **bypass** the Domain Layer, aggregate roots, and Repository abstractions. They execute raw SQL or simple database projection queries directly against denormalized tables (in `analytics.*` schema), mapping rows directly into Data Transfer Objects (DTOs).
* **Rationale**: Bypassing DDD mapping layers for lists and view models eliminates CPU overhead and prevents query optimization from polluting transactional boundaries.

---

## 3. Layered Validation Framework

Validation is executed in three distinct stages to ensure fail-fast behaviors and keep business rules isolated.

```
Incoming Request  ───>  1. Syntax Check (Presentation)  ───>  Format, Type errors.
                                   │
                                   ▼
                        2. State Check (Application)   ───>  ID existence verification.
                                   │
                                   ▼
                        3. Invariant Check (Domain)    ───>  Credit, Stock limit checks.
```

1. **Syntax Validation (Presentation Layer)**: Form validation, mandatory keys, date formatting, and input validation schemas. Executed prior to dispatching command objects.
2. **State Validation (Application Layer)**: Verifies that reference IDs passed on the command actually exist in the database (e.g. checking that `CustomerId` maps to an active database partner row).
3. **Invariant Validation (Domain Layer)**: Enforces business rules (e.g. checking if stock is sufficient, evaluating credit limits). Executed internally by the aggregate root.

---

## 4. Repository Boundary Interfaces

In Clean Architecture, repositories are defined at the domain boundary:
* **Interface Ownership**: Repository interfaces (e.g. `ISalesInvoiceRepository`) reside inside the **Domain Layer** (as they handle aggregate roots).
* **Implementation Ownership**: Concrete repository code (SQL generation, ORM, transaction commits) resides inside the **Infrastructure Layer**.
* **Usage**: Application Services reference repository interfaces via dependency injection.

---

## 5. Saga Orchestrator Execution Flow

For workflows that span multiple modules (such as e-commerce checkout), the Saga Orchestrator executes use-cases across contexts:

```
[Orchestrator Application Service]
  │
  ├── 1. Dispatch "ReserveStockCommand" to Inventory Context
  │      └── Success? Proceed. Fail? Trigger compensations.
  ├── 2. Dispatch "AuthorizePaymentCommand" to Payments Context
  │      └── Success? Proceed. Fail? Trigger compensating "ReleaseStockCommand".
  └── 3. Commit state & emit "SalesInvoicePosted" event
```

* **Saga State**: The orchestrator is stateful, saving a `SagaState` entity in the `automation` database schema to recover and resume workflows in the event of system failure.

---

## 6. Complete Capabilities to Use-Case Matrix

| Business Capability | Owning Monolith Module | Primary Application Use Cases |
| :--- | :--- | :--- |
| **Identity & Access** | `Identity` | `RegisterTenant`, `AuthenticateUser`, `AssignUserRole` |
| **Catalog Management** | `Catalog` | `CreateCatalogItem`, `UpdateItemPrice`, `CreateTaxCategory` |
| **Stock Control** | `Inventory` | `AdjustInventoryStock`, `InitiateStockTransfer`, `ReceiveStockTransfer` |
| **Partner CRM** | `Partners` | `CreateBusinessPartner`, `AdjustCreditLimit` |
| **Procurement Ingestion** | `Purchases` | `CreateDraftPurchaseFromAI`, `ApprovePurchaseInvoice` |
| **POS Checkout & Billing** | `Sales` | `CreateSalesInvoiceDraft`, `HoldSalesInvoice`, `PostSalesInvoice` |
| **Payment Settlement** | `Payments` | `RecordPayment`, `AllocatePaymentToInvoices`, `ReversePayment` |
| **Double-Entry Accounting**| `Accounting` | `PostJournalEntry`, `CloseFiscalPeriod`, `ReopenFiscalPeriod` |
| **WhatsApp & Automation** | `Automation` | `DispatchWhatsAppNotification`, `ProcessOutboxQueue` |
| **AI Insights** | `AI` | `ExtractInvoiceDataFromDocument`, `GenerateBusinessInsight` |
| **Business Analytics** | `Analytics` | `GenerateProfitLossStatement`, `ExportTaxRegister` |
