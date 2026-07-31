# SBS-ENG-001 — Engineering Standards

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Chief Architect / Engineering Lead  
**Priority:** Mandatory  
**Related Specs:** [SBS-000_SmartBooks_Engineering_Constitution.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-000_SmartBooks_Engineering_Constitution.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md)

---

## 1. Purpose & Precedence

This specification defines the physical repository layout, coding standards, testing metrics, and error-handling patterns for SmartBooks. It translates the high-level invariants of the Engineering Constitution into concrete rules for day-to-day coding.

---

## 2. Feature-First Repository Directory Standard

To preserve bounded context boundaries and prepare for eventual microservice extraction, the repository layout must organize folders by **business feature** rather than physical layer:

```text
/
├── backend/
│   ├── src/
│   │   ├── shared-kernel/      # Shared Value Objects (Money, GSTIN, Result)
│   │   └── modules/            # Isolated Bounded Contexts
│   │        ├── sales/         # Sales Domain, Application, Infra, API layers
│   │        ├── catalog/       # Catalog Domain, Application, Infra, API layers
│   │        └── inventory/     # Inventory Domain, Application, Infra, API layers
│   ├── tests/                  # Cross-module E2E workflow integration tests
│   └── package.json
├── frontend/                   # Feature-based client directories (Next.js/Vite)
├── ai/
│   ├── prompts/                # Version-controlled YAML prompt files
│   └── schemas/                # JSON schemas for structured LLM outputs
└── docker-compose.yml          # Local PostgreSQL dev database environment
```

> [!WARNING]
> **Monolithic Folder Banning**: Storing all domain entities in a single global `/packages/domain/` folder is **strictly prohibited**. It creates tight coupling across domains and prevents database isolation.

---

## 3. Typings & Code Style Conventions (TypeScript)

* **Explicitness over Inference**: All function signatures, API controllers, and use-case handlers must declare explicit input parameters and return types. Bypassing type safety using `any` or `unknown` is prohibited.
* **Interfaces vs Types**: Use `interface` for exposing contract definitions (like Repositories, Facades, or Clients) to support Dependency Injection. Use `type` for simple data shapes, DTOs, and union results.
* **Naming Conventions**:
  * Classes: `PascalCase` (e.g. `PostSalesInvoiceCommandHandler`).
  * Functions/Methods: `camelCase` (e.g. `deductAvailableStock()`).
  * Variables/DTOs: `camelCase` (e.g. `invoiceTotal`).
  * Database fields: `snake_case` (e.g. `tenant_id`, `created_at`).

---

## 4. Functional Error Handling (`Result<T, E>` Pattern)

To avoid breaking execution flows and maintain type safety, developers must utilize a functional **`Result`** wrapper for business validation errors, reserving code exceptions (`throw new Error()`) exclusively for unexpected infrastructure crashes (e.g., database timeout).

```typescript
// Good: Type-safe, compile-time validation check
public checkCreditLimit(amount: Money): Result<CreditCheckedDto, CreditLimitExceededError> {
  if (this.creditLimit.isExceededBy(amount)) {
    return Result.fail(new CreditLimitExceededError());
  }
  return Result.ok({ isApproved: true });
}

// Bad: Hidden control flow, untyped runtime crash
public checkCreditLimit(amount: Money) {
  if (this.creditLimit.isExceededBy(amount)) {
     throw new Error("Credit limit exceeded"); // PROHIBITED for business logic
  }
}
```

---

## 5. Automated Build & Pre-Commit Gates

Standards are enforced automatically in the local development loop before pull requests:
* **Pre-Commit Formatter Hook**: Git commits trigger `lint-staged` running **Prettier** (formatting) and **ESLint** (lint rules).
* **Dependency Cruising**: The CI runner executes `dependency-cruiser` on every push to verify that the inward dependency rule is not violated (e.g. throwing a build failure if the `domain` imports `infrastructure` folders).

---

## 6. Mandatory Test Coverage Gates

Pull requests must satisfy the following code coverage minimums to be merged:
* **Domain Layer**: **100% code coverage** (Must test all aggregates, value objects, and business rules).
* **Application Layer**: **$\ge 80\%$ code coverage** (Must test command/query handlers and transaction boundaries).
* **Infrastructure Layer**: **$\ge 50\%$ code coverage** (Must test database repositories using docker containers).
