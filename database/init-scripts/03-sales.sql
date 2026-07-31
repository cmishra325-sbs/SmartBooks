-- SmartBooks Database Migration - Sales Domain
-- Establishes transaction tables for POS Billing & Split Payments

-- 1. Sales Bills Master Table
CREATE TABLE sales.bills (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    bill_number     VARCHAR(100) NOT NULL,                 -- Store invoice series, e.g., INV/26-27/0001
    customer_id     UUID NULL,                             -- Reference to partner/CRM profile (can be NULL for guest cash sales)
    subtotal        NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Amount before GST tax
    tax_total       NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Cumulative SGST + CGST + IGST
    discount_total  NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    grand_total     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- subtotal + tax - discount
    paid_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Sum total of all payments applied
    status          VARCHAR(50) NOT NULL DEFAULT 'UNPAID',  -- DRAFT, UNPAID, PARTIALLY_PAID, PAID, CANCELLED
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Ensure bill number is unique for each store tenant workspace
CREATE UNIQUE INDEX idx_bills_tenant_number ON sales.bills (tenant_id, bill_number);
CREATE INDEX idx_bills_tenant_status ON sales.bills (tenant_id, status);

-- 2. Sales Bill Line Items Table
CREATE TABLE sales.bill_items (
    id              UUID PRIMARY KEY,
    bill_id         UUID NOT NULL REFERENCES sales.bills(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL,                         -- Reference to catalog item
    name            VARCHAR(255) NOT NULL,                 -- Snapshot of product name at moment of sale
    qty             NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
    unit_price      NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0.00,    -- Snapshot of GST percent (e.g. 18.00)
    cgst_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Central GST amount
    sgst_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- State GST amount
    igst_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Integrated GST amount
    subtotal        NUMERIC(18, 4) NOT NULL DEFAULT 0.0000, -- Row sum before tax (qty * price)
    grand_total     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000  -- Row sum after tax
);

CREATE INDEX idx_bill_items_bill ON sales.bill_items (bill_id);

-- 3. Sales Split Payments Registry Table
CREATE TABLE sales.bill_payments (
    id              UUID PRIMARY KEY,
    bill_id         UUID NOT NULL REFERENCES sales.bills(id) ON DELETE CASCADE,
    payment_mode    VARCHAR(50) NOT NULL,                  -- CASH, UPI, CARD, LEDGER
    amount          NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reference_number VARCHAR(100) NULL,                    -- Transaction ref (UPI reference or Card Auth Code)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_bill_payments_bill ON sales.bill_payments (bill_id);
