-- SmartBooks Database Initialization Script
-- Establishes schema namespaces and identity tables for Multi-Tenancy

-- 1. Create Bounded Context Schemas
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS partners;
CREATE SCHEMA IF NOT EXISTS purchases;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS automation;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS analytics;

-- 2. Create Tenants Registry Table (Multi-Tenancy Foundation)
CREATE TABLE IF NOT EXISTS identity.tenants (
    id         UUID PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    status     VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Create Users Table (Authentication Profile)
CREATE TABLE IF NOT EXISTS identity.users (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    user_role     VARCHAR(50) NOT NULL DEFAULT 'USER', -- OWNER, CASHIER, ACCOUNTANT, USER
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4. Unique Constraints & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON identity.users (email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON identity.users (tenant_id);
