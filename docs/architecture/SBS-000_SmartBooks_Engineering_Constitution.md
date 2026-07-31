# SBS-000 — SmartBooks Engineering Constitution

**Version:** v1.0 (Approved Master)  
**Status:** 🟢 Approved  
**Classification:** Normative (Foundational)  
**Owner:** Chief Architect  
**Priority:** Mandatory  
**Related Spec:** [SBS-ARCH-OVERVIEW-001_Enterprise_Architecture_Overview.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-OVERVIEW-001_Enterprise_Architecture_Overview.md)

---

## 1. Purpose & Authority

This **Engineering Constitution** defines the non-negotiable engineering principles that govern all architectural decisions, database models, coding practices, and deployment operations across the SmartBooks platform. 

Where code implementations, framework selection, or architecture specifications conflict, this Constitution takes precedence as the **highest authority** in the SmartBooks documentation hierarchy.

---

## 2. The Core Engineering Mission

Every engineer, architect, and contributor must optimize for these values in the following order:

```text
  Correctness  >  Security  >  Maintainability  >  Simplicity  >  Observability  >  Scalability
```

1. **Correct before Clever**: Business correctness and financial audit safety are absolute. Readable boilerplate code is preferred over clever, unreadable short-cuts.
2. **Simple before Complex**: Keep design patterns approachable. If a workflow can be completed using a simple synchronous transaction, do not use an asynchronous distributed worker without justification.
3. **Maintainable before Optimized**: Optimize code for the next engineer who reads it. Performance optimizations must never compromise legibility.
4. **Observable before Scalable**: If you cannot trace an operation, you cannot scale it safely. All execution flows must yield telemetry.
5. **Replaceable before Dependent**: Limit third-party SDK dependencies. Business capabilities must survive vendor migrations (payment gateways, SMS dispatchers, AI providers).

---

## 3. The Twelve Architectural Laws

Every code submission and system design must comply with these twelve laws:

### Law 1: Business Rules are Sacred
Business rules belong exclusively inside the **Domain Layer** as pure functions, aggregate roots, or value objects. The presentation, API, and database layers must never implement or modify business behavior.

### Law 2: Inward-Only Dependency Flow
Dependencies must point inward. Outer layers (API Controllers, ORM Schemas, Webhooks) depend on Application Use Cases. The Application Layer depends on the Domain. The Domain Layer depends on nothing.

### Law 3: Database & Schema Segregation
Each module owns its tables. Direct cross-schema joins, SELECTs, or database transactions spanning domains are **strictly prohibited**. Inter-domain updates are driven exclusively by asynchronous events.

### Law 4: APIs are Public Commitments
All REST APIs are formal contracts. Once published, breaking changes require incremental URL versioning (e.g. `/api/v1/` to `/api/v2/`).

### Law 5: AI as an Advisory Layer
AI is an advisory tool, not a system of record. AI extractions must write to draft states (e.g., `PENDING_REVIEW`) and pass through domain validations and human approval before mutating financial ledgers.

### Law 6: End-to-End Correlation Traceability
Every transaction, background task, or webhook ingestion must carry a unified `correlationId` to trace logs from the client's click to database writes.

### Law 7: Least Privilege Security
Design every interface assuming the outer environment is hostile. Input verification, tenant access tokens, and RBAC authorization are enforced at all entry boundaries.

### Law 8: Multi-Tenancy is Non-Negotiable
Logical tenant isolation (`tenant_id`) is enforced across all tables, caching layers, file storage, and trace logs. Data from different tenants must never intermix.

### Law 9: Immutable Ledgers & Append-Only Operations
In the financial core (Invoices, Payments, Stock Movements, Journals), completed transactions are **immutable**. Deleting or updating posted rows is forbidden. Corrections must generate new, separate compensating transaction entries.

### Law 10: Code and Documentation Evolve Together
Documentation is code. Outdated, missing, or misleading markdown blueprints are classified as critical system bugs that block build releases.

### Law 11: Vendor SDK Isolation (Ports & Adapters)
Vendor-specific libraries (Razorpay, Twilio, Meta) must be wrapped in local Port interfaces. The core application must remain unaware of the underlying vendor's SDK structure.

### Law 12: Architecture Precedes Implementation
No developer shall write production code before the corresponding capability specification is approved. Architectural questions must be resolved before writing code.
