-- SmartBooks Database Migration - Accounting Domain
-- Establishes the double-entry Chart of Accounts, Journal Entries, and Ledger Postings

-- 1. Chart of Accounts Table
CREATE TABLE accounting.accounts (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    code        VARCHAR(50) NOT NULL,                  -- Account Code: e.g., 10100 for Cash, 40100 for Revenue
    name        VARCHAR(255) NOT NULL,                 -- Account Name: e.g., Cash-in-Hand, Sales Revenue, Output CGST
    acct_type   VARCHAR(50) NOT NULL,                  -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    CONSTRAINT unique_tenant_account_code UNIQUE (tenant_id, code),
    CONSTRAINT check_account_type CHECK (acct_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'))
);

CREATE INDEX idx_accounts_tenant_code ON accounting.accounts (tenant_id, code);

-- 2. Journal Entries Master Table
CREATE TABLE accounting.journal_entries (
    id             UUID PRIMARY KEY,
    tenant_id      UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    reference_id   UUID NULL,                          -- Correlation ID linking back to transaction source (e.g. Bill ID)
    reference_type VARCHAR(100) NULL,                  -- Source context: e.g. SALES_BILL, PAYMENT_CONTRA
    narration      VARCHAR(500) NULL,                  -- Transaction memo: e.g. "Sales invoice posting for INV-2026-0001"
    posted_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_journal_entries_ref ON accounting.journal_entries (tenant_id, reference_id);

-- 3. Ledger Postings (Journal Lines / Double-Entry Splits)
CREATE TABLE accounting.ledger_postings (
    id               UUID PRIMARY KEY,
    journal_entry_id UUID NOT NULL REFERENCES accounting.journal_entries(id) ON DELETE CASCADE,
    account_id       UUID NOT NULL REFERENCES accounting.accounts(id),
    debit_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    credit_amount    NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    
    CONSTRAINT check_amount_non_negative CHECK (debit_amount >= 0 AND credit_amount >= 0),
    CONSTRAINT check_debit_or_credit_only CHECK (
        (debit_amount = 0 AND credit_amount > 0) OR 
        (debit_amount > 0 AND credit_amount = 0)
    )
);

CREATE INDEX idx_ledger_postings_journal ON accounting.ledger_postings (journal_entry_id);
CREATE INDEX idx_ledger_postings_account ON accounting.ledger_postings (account_id);
