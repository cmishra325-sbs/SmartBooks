# SBS-API-001 — API Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Platform Architecture  
**Priority:** Critical (Platform Interface)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md), [SBS-APP-001_Application_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-APP-001_Application_Architecture.md), [SBS-INTG-001_Integration_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-INTG-001_Integration_Architecture.md)

---

## 1. Purpose & Layer position

This specification defines the architectural standards, request pipelines, URL structures, error formats, and versioning rules for SmartBooks APIs. Sitting at the outermost boundary of Clean Architecture, the API layer translates external HTTP requests into Application layer Commands and Queries. It contains no business logic.

---

## 2. URL Path Versioning & Routing Conventions

To ensure ease of caching, proxy routing, and client integration:
* **Versioning Standard**: APIs must use **URL Path Versioning** prefixed with `/api/v{major}`:
  * Example: `/api/v1/sales-invoices`
* **Resource Paths**: Lowercase, plural nouns using hyphen separators (Kebab-case):
  * Items: `/api/v1/catalog/items`
  * Business Partners: `/api/v1/partners/business-partners`
  * Sales Invoices: `/api/v1/sales/invoices`
  * Purchases: `/api/v1/purchases/invoices`
  * Payments: `/api/v1/payments/transactions`
  * Accounting: `/api/v1/accounting/journal-entries`

### Business Action Endpoints
Where endpoints map to complex state changes rather than CRUD updates, paths append explicit business actions:
* `POST /api/v1/sales/invoices/{id}/post`
* `POST /api/v1/payments/transactions/{id}/reverse`
* `POST /api/v1/inventory/transfers`
* `POST /api/v1/accounting/fiscal-periods/{id}/close`

---

## 3. Multi-Tenant Context Propagation

For all REST API interactions, the active tenant context must be propagated securely:
* **Authenticated Clients (UI/Mobile)**: The `tenant_id` must be embedded as a claim within the user's cryptographically signed **JSON Web Token (JWT)**. The API layer extracts this claim and injects it into the command payload before routing.
* **Public/Integration APIs**: Third-party API clients pass a signed API Key or specify the tenant ID using the **`X-Tenant-ID`** custom HTTP header.
* **Rule**: Request payloads are rejected with HTTP `401 Unauthorized` if no tenant context can be resolved.

---

## 4. REST Response Semantics

HTTP status codes must reflect the operational state of the request:
* **`200 OK`**: Successful query or command returning a payload DTO.
* **`201 Created`**: Resource created successfully. Response must include the `Location` header pointing to the new entity.
* **`202 Accepted`**: Asynchronous batch or background task successfully queued (e.g. AI OCR ingestion). Response returns a task status URL for polling.
* **`422 Unprocessable Entity`**: Application or domain validation failure (e.g., credit limit exceeded).
* **`409 Conflict`**: Optimistic concurrency version clash. Client must refresh.

---

## 5. RFC 7807 Standard Error Envelope

To ensure error details are machine-readable and easy for frontend UI or developer systems to parse:
* **Standard**: Errors must return payloads adhering to **RFC 7807 (Problem Details for HTTP APIs)**:

```json
{
  "type": "https://api.smartbooks.com/errors/credit-limit-exceeded",
  "title": "Business Invariant Violation",
  "status": 422,
  "detail": "Invoice value of ₹25,000 exceeds customer's remaining credit limit of ₹10,000.",
  "instance": "/api/v1/sales/invoices",
  "code": "CREDIT_LIMIT_EXCEEDED",
  "correlationId": "corr-87f9-231a",
  "errors": [
    {
      "field": "customer_id",
      "message": "Credit limit would be exceeded by ₹15,000."
    }
  ]
}
```

* **Correlation ID**: Every error envelope must propagate the active `correlationId` from the tracing metadata to simplify log lookup.
* **Rule**: Internal database stacks and exceptions must never leak in the `detail` or `errors` collections.

---

## 6. Pagination & Filtering Standards

To prevent database overhead and memory saturation:
* **Collection Limit**: All collection queries (`GET`) must enforce default pagination limits (e.g. default 20, max 100).
* **Response Envelope**: Paginated collections return structured list metadata:
  ```json
  {
    "data": [...],
    "page": 1,
    "pageSize": 20,
    "totalCount": 142,
    "totalPages": 8
  }
  ```
* **Ordering**: All paginated collections must declare default, stable sorting parameters (e.g., ordering by `id` or `created_at` DESC) to ensure consistent results.
