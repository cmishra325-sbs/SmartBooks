# SBS-AI-001 — AI Services Architecture

**Version:** Draft v0.2  
**Status:** 🔵 In Review  
**Owner:** AI Architecture  
**Priority:** Strategic (Intelligent Services)  
**Related Specs:** [SBS-DM-001_Domain_Model.md](file:///C:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/product/SBS-DM-001_Domain_Model.md), [SBS-ARCH-001_Solution_Blueprint.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-ARCH-001_Solution_Blueprint.md), [SBS-INTG-001_Integration_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-INTG-001_Integration_Architecture.md), [SBS-API-001_API_Architecture.md](file:///c:/Users/Chandan%20Mishra/Documents/Antigravity/SmartBooks/docs/architecture/SBS-API-001_API_Architecture.md)

---

## 1. Purpose & Strategic Focus

This specification defines the integration boundaries, prompt storage rules, and validation pipelines for AI services. In SmartBooks, AI acts strictly as an **Advisory Enhancement Layer**. AI outputs are considered untrusted DTOs and must pass standard application validations before mutating domain models.

---

## 2. Ports & Reference Adapter (Gemini API & Google AI Studio)

While the AI interfaces are defined in a provider-agnostic manner (Clean Architecture Ports), we standardize on the **Google Gemini API** (via Google AI Studio) as our primary reference implementation:

```
[Application Layer Ports] (e.g. IDocumentParser)
           │
           ▼
[AI Domain Infrastructure Adapter]
           │
           ├─── Reference Implementation: Google AI Studio Client
           │      • gemini-1.5-pro: Used for complex document extraction & reasoning.
           │      • gemini-1.5-flash: Used for fast classifications & tagging.
           │
           └─── Future Implementation: Switchable to OpenAI, Claude, or local LLMs.
```

---

## 3. Strict Structured JSON Outputs Invariant

To prevent LLM hallucination and string parsing errors:
* **Rule**: All structured data queries (e.g. invoice extraction) must invoke the Gemini API passing a strict **JSON Schema** definition via the `responseSchema` configuration parameter and setting `responseMimeType: "application/json"`.
* **Flow**: The Gemini API parser performs schema conformance validation at the client SDK level before returning the JSON payload to the Application Layer.

---

## 4. Tenant Token Budgeting & Cost Governance

To prevent API cost runaway and potential Denial of Service (DoS) attacks on token usage:
* **Token Tracking Invariant**: Every AI Service execution must extract the input and output token counts from the Gemini API response metadata and record them in the `ai.ai_interaction_logs` table.
* **Tenant Limits**: The AI Gateway enforces token quotas and daily request limits per Tenant (e.g. maximum 100 document parses/day for basic tier) checked prior to model invocation.

---

## 5. Version-Controlled Prompt Repository

Prompts must be managed as source-code files located in the repository root directory `/ai/prompts/` rather than hardcoded inside application text.

### Prompt File Structure (`/ai/prompts/vendor_bill_extraction.txt`)
Prompts must use YAML front-matter to declare target model configurations, ensuring prompt parameters evolve alongside instructions:

```yaml
model: gemini-1.5-pro
temperature: 0.1
response_mime_type: application/json
response_schema_reference: schemas/invoice_extraction_schema.json
---
You are an expert ERP accountant. Parse the following wholesaler invoice PDF and output...
```

---

## 6. Human-in-the-Loop Verification Pipeline

All high-impact actions (such as posting invoices or allocating cash payments) derived from AI extraction must use a draft review pipeline:

```
[Supplier Invoice PDF Webhook] ───> AI Extract (gemini-1.5-pro)
                                           │
                                           ▼
                              [Save Draft Invoice] (Status = 'PENDING_REVIEW')
                                           │
                                           ▼
                              [UI Review Workspace] (Highlights low-confidence fields)
                                           │
                                           ▼ (Human clicks "Post")
                              [Sales/Purchase Invoice Posted]
```
