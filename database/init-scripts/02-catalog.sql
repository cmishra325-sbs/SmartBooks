-- SmartBooks Database Migration - Catalog Domain
-- Establishes the items table for Catalog Management

CREATE TABLE catalog.items (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    sku               VARCHAR(100) NULL,
    barcode           VARCHAR(100) NULL,
    item_type         VARCHAR(50) NOT NULL DEFAULT 'PRODUCT', -- PRODUCT, SERVICE, BUNDLE
    unit_of_measure   VARCHAR(20) NOT NULL DEFAULT 'PCS',     -- PCS, BOX, KG, LTR, GM
    hsn_code          VARCHAR(20) NULL,                       -- Indian HSN Code for GST
    purchase_price    NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    sales_price       NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    tax_rate          NUMERIC(5, 2) NOT NULL DEFAULT 0.00,    -- e.g. 18.00 for 18% GST
    is_tax_inclusive  BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,         -- Soft delete flag
    version           INTEGER NOT NULL DEFAULT 1,             -- Concurrency control version
    created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes for performance and isolation queries
CREATE INDEX idx_items_tenant_barcode ON catalog.items (tenant_id, barcode);
CREATE INDEX idx_items_tenant_sku ON catalog.items (tenant_id, sku);
CREATE INDEX idx_items_tenant_is_deleted ON catalog.items (tenant_id, is_deleted);
