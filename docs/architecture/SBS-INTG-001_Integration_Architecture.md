# SBS-INTG-001 — Integration Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** Enterprise Architecture  
**Priority:** Critical (External Communication)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-MOD-001_Module_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-MOD-001_Module_Architecture.md), [SBS-APP-001_Application_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-APP-001_Application_Architecture.md)

---

## 1. Purpose & Layer Position

This specification defines the rules governing how SmartBooks interacts with external systems (payment gateways, WhatsApp Business Cloud APIs, client web portals, and document parser engines). To preserve domain integrity, all external communications are isolated inside the **Integration Layer**, conforming to the **Ports and Adapters** (Hexagonal Architecture) pattern.

---

## 2. Ports and Adapters Boundary Pattern

External protocols (REST, JSON, WebSockets) and vendor-specific SDKs (Meta Cloud API SDK, Razorpay SDK) must never leak into the application or domain layers.

```
       [External Systems] (Shopify, WhatsApp, Razorpay)
               │
               ▼ (HTTP / Webhooks)
┌────────────────────────────────────────────────────────┐
│                   Integration Layer                    │
│   Adapters (e.g. RazorpayGateway, MetaWhatsAppClient)  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼ (Implements Port Interfaces)
┌────────────────────────────────────────────────────────┐
│                   Application Layer                    │
│   Ports (e.g. IPaymentClient, INotificationService)     │
└────────────────────────────────────────────────────────┘
```

* **Ports (Interfaces)**: Exposed in the `Application` or `Domain` layers. They describe the operational capabilities needed by the system using ubiquitous business structures (e.g. `ISmsClient.send(phoneNumber, text)`).
* **Adapters (Implementations)**: Reside strictly in the `integrations/` folder. They translate port method calls into specific HTTP payloads or SDK execution parameters.

---

## 3. Webhook Ingestion Buffer Pattern (Inbox Pattern)

Executing complex database transactions synchronously during inbound webhook requests (such as receiving a WhatsApp payment confirmation or WooCommerce order webhook) degrades response times and can cause timeouts or drop messages under high traffic.

* **Rule**: All inbound webhooks must follow the **Buffer-First-Process-Async** rule:

```
[Inbound Webhook HTTP Post]
            │
            ▼
    [Webhook Controller]
            │ (Verifies signature payload only)
            ▼
  [Write to integrations.webhook_inbox] (Status = 'PENDING')
            │
            ▼
[Return HTTP 200 OK to Sender] (Immediate release of connection)
            │
            ▼ (Asynchronous Background Job)
[Process use case command & mark processed]
```

* **Inbox Invariant**: Prevents dropped deliveries. If downstream database instances are locked, the webhook sender receives a successful `200 OK` response while the payload remains safely queued in the `webhook_inbox` for retry.

---

## 4. Outbound Idempotency Keys

When executing actions on external APIs (e.g. capturing payments, issuing refunds, dispatching WhatsApp messages):
* **Rule**: Every outbound adapter request must carry a unique `IdempotencyKey` derived from the initiating domain's Transaction ID (e.g., `payment_id`).
* **Rationale**: If a network timeout occurs during an API call, retrying the request with the identical key guarantees the third-party gateway returns the cached success response rather than double-charging.

---

## 5. Traceability Matrix & Alignment

All integrations map directly to the approved solution domains:

| External System | Integration Style | Primary Port Interface | Target Domain |
| :--- | :--- | :--- | :--- |
| **Web / Mobile POS** | Synchronous REST | Controllers / Use-cases | `Sales`, `Inventory` |
| **WhatsApp Business** | Webhooks (Buffered) | `IWhatsAppService` | `Automation` |
| **Payment Gateway** | Webhooks (Buffered) | `IPaymentGateway` | `Payments` |
| **OCR / Document AI** | Asynchronous DTO | `IDocumentParser` | `AI` |
| **Email / SMS** | Asynchronous Msg | `INotificationService` | `Automation` |
| **E-commerce Sync** | Webhook / REST | `ICommerceSyncService` | `Commerce` |
| **P&L / Tax Export** | Batch CSV / PDF | `IAnalyticsService` | `Analytics` |
