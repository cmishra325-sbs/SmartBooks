# SBS-INT-001 — Interaction Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Solution Architecture  
**Priority:** Critical (System Behavior)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md)

---

## 1. Purpose & Guiding Principles

This specification defines how SmartBooks modules interact to execute business processes. It establishes communication channels, transaction consistency rules, Saga orchestration patterns, idempotency guarantees, and tracing rules to ensure the system remains decoupled and audit-ready.

---

## 2. Interaction Taxonomy & Contracts

We classify all system interactions into four distinct categories:

| Interaction Type | Channel | Consistency | Rejection Policy | Example |
| :--- | :--- | :--- | :--- | :--- |
| **Command** | Direct Facade / API | Strong (within domain) | Can fail validation (e.g. Credit check). | `RecordPayment` |
| **Query** | Direct Facade / Read model | Eventual (Read model sync) | Fail on permissions or missing ID. | `GetItemPrice` |
| **Event** | Asynchronous Event Bus | Eventual (Across domains) | Non-rejectable. (Facts cannot be undone). | `SalesInvoicePosted` |
| **Scheduled Job** | Cron / Worker | Eventually consistent | Log failure and retry. | `DailyClosingSummary` |

---

## 3. Long-Running Workflows & Saga Patterns

Workflows spanning multiple domain boundaries (e.g., e-commerce order checkout or invoice-ledger posting) are coordinated using one of two Saga strategies:

### A. Choreography (Event-Driven)
* **Usage**: Used for simple, linear domain updates (e.g., sales checkout).
* **Pattern**: Domain A posts an event. Domain B listens and executes a command.
* **Flow**: `SalesInvoicePosted` event is emitted $\rightarrow$ `Inventory` listens and deducts stock, `Partners` listens and updates customer outstanding balance.

### B. Orchestration (Process Manager)
* **Usage**: Used for complex, multi-step workflows with conditional rollback requirements (e.g., e-commerce order processing).
* **Pattern**: A dedicated `Orchestrator` use-case in the Application layer coordinates actions by dispatching commands to individual domains and managing timeouts.

```
       [Order Process Orchestrator]
        │              │             │
        ├─ Reserve ───>│             │
        │  Stock       ▼             │
        │          [Inventory]       │
        │                            │
        ├────── Authorize ──────────>│
        │       Payment              ▼
        │                        [Payments]
```

---

## 4. Financial Compensations vs. Database Rollbacks

We prohibit SQL database rollbacks or hard deletions for posted transactions. Financial and inventory corrections are handled via **Compensating Transactions**.

* **Rule**: Once a transaction is `POSTED` (immutable state), errors must be corrected by publishing a new compensating transaction (e.g., issuing a Debit Note, Credit Note, or Reversing Journal Entry).
* **Audit Trail Invariant**: Compensating actions are treated as new domain events (`PurchaseInvoiceReversed`, `PaymentBounced`) with their own timestamp and operator signature.

---

## 5. Idempotency Key Guarantees

To prevent duplicate transaction execution during retries (e.g., double-charging a UPI payment or posting duplicate invoice totals):
* **Invariant**: High-impact Commands and Event consumers must require an `IdempotencyKey`.
* **Behavior**: If the system receives a request with an existing `IdempotencyKey`, it bypasses domain rule execution and returns the cached result of the original execution.

---

## 6. Observability & Distributed Tracing

Every transaction and event propagation must carry a unified metadata tracing envelope:

```json
{
  "metadata": {
    "correlationId": "corr-87f9-231a", // Shared across the entire business journey (e.g. PDF Upload to GL Posting)
    "causationId": "evt-01ab-234c",     // The ID of the event or command that immediately triggered this step
    "messageId": "msg-888f-999a",       // Unique identifier for this specific payload
    "timestamp": "2026-07-28T11:00:00Z",
    "userId": "usr_9992"
  }
}
```

* **Correlation ID**: Generated at system entry points (manual click, API call, OCR ingest) and propagated through all domain events and downstream database writes, ensuring complete trace analysis.
* **Causation ID**: Maps parent-child causality relationships (e.g. which specific `PurchaseInvoiceApproved` event caused a specific WAC update).
