-- =============================================================================
-- POCKET POS - PostgreSQL Database Initialization Script
-- =============================================================================
-- This script initializes the PostgreSQL database for the Pocket POS system
-- It creates databases, users, and sets up initial schema

-- =============================================================================
-- DATABASE CREATION
-- =============================================================================

-- Create development database
CREATE DATABASE pocketpos_dev;

-- Create production database
CREATE DATABASE pocketpos_prod;

-- Create test database
CREATE DATABASE pocketpos_test;

-- =============================================================================
-- USER CREATION AND PERMISSIONS
-- =============================================================================

-- Create application user for development
CREATE USER pocketpos_dev WITH PASSWORD 'dev_password_123';
GRANT ALL PRIVILEGES ON DATABASE pocketpos_dev TO pocketpos_dev;
ALTER USER pocketpos_dev CREATEDB;

-- Create application user for production
CREATE USER pocketpos_prod WITH PASSWORD 'REPLACE_WITH_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE pocketpos_prod TO pocketpos_prod;

-- Create read-only user for reporting
CREATE USER pocketpos_readonly WITH PASSWORD 'readonly_password_123';
GRANT CONNECT ON DATABASE pocketpos_dev TO pocketpos_readonly;
GRANT CONNECT ON DATABASE pocketpos_prod TO pocketpos_readonly;

-- =============================================================================
-- CONNECT TO DEVELOPMENT DATABASE
-- =============================================================================
\c pocketpos_dev;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Enable btree_gin for better indexing
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =============================================================================
-- SCHEMAS
-- =============================================================================

-- Create schemas for better organization
CREATE SCHEMA IF NOT EXISTS pos;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant schema permissions
GRANT USAGE ON SCHEMA pos TO pocketpos_dev;
GRANT USAGE ON SCHEMA inventory TO pocketpos_dev;
GRANT USAGE ON SCHEMA users TO pocketpos_dev;
GRANT USAGE ON SCHEMA analytics TO pocketpos_dev;
GRANT USAGE ON SCHEMA audit TO pocketpos_dev;

GRANT CREATE ON SCHEMA pos TO pocketpos_dev;
GRANT CREATE ON SCHEMA inventory TO pocketpos_dev;
GRANT CREATE ON SCHEMA users TO pocketpos_dev;
GRANT CREATE ON SCHEMA analytics TO pocketpos_dev;
GRANT CREATE ON SCHEMA audit TO pocketpos_dev;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table
CREATE TABLE users.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stores table
CREATE TABLE pos.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE inventory.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES inventory.categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE inventory.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES inventory.categories(id),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    barcode VARCHAR(100),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    track_inventory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE inventory.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES inventory.products(id),
    store_id UUID REFERENCES pos.stores(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    max_quantity INTEGER,
    reorder_point INTEGER DEFAULT 0,
    last_counted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, store_id)
);

-- Transactions table
CREATE TABLE pos.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    store_id UUID REFERENCES pos.stores(id),
    cashier_id UUID REFERENCES users.users(id),
    customer_id UUID,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transaction items table
CREATE TABLE pos.transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES pos.transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES inventory.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- AUDIT TABLES
-- =============================================================================

-- Audit log table
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users.users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users.users(email);
CREATE INDEX idx_users_role ON users.users(role);
CREATE INDEX idx_users_active ON users.users(is_active);
CREATE INDEX idx_users_created_at ON users.users(created_at);

-- Products indexes
CREATE INDEX idx_products_sku ON inventory.products(sku);
CREATE INDEX idx_products_name ON inventory.products(name);
CREATE INDEX idx_products_category ON inventory.products(category_id);
CREATE INDEX idx_products_barcode ON inventory.products(barcode);
CREATE INDEX idx_products_active ON inventory.products(is_active);

-- Inventory indexes
CREATE INDEX idx_inventory_product_store ON inventory.inventory(product_id, store_id);
CREATE INDEX idx_inventory_quantity ON inventory.inventory(quantity);
CREATE INDEX idx_inventory_reorder ON inventory.inventory(reorder_point);

-- Transactions indexes
CREATE INDEX idx_transactions_number ON pos.transactions(transaction_number);
CREATE INDEX idx_transactions_store ON pos.transactions(store_id);
CREATE INDEX idx_transactions_cashier ON pos.transactions(cashier_id);
CREATE INDEX idx_transactions_date ON pos.transactions(created_at);
CREATE INDEX idx_transactions_status ON pos.transactions(payment_status);

-- Transaction items indexes
CREATE INDEX idx_transaction_items_transaction ON pos.transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON pos.transaction_items(product_id);

-- Audit indexes
CREATE INDEX idx_audit_table_name ON audit.audit_log(table_name);
CREATE INDEX idx_audit_operation ON audit.audit_log(operation);
CREATE INDEX idx_audit_record_id ON audit.audit_log(record_id);
CREATE INDEX idx_audit_user_id ON audit.audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit.audit_log(created_at);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON pos.stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON inventory.categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON inventory.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory.inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON pos.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (table_name, operation, record_id, old_values)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (table_name, operation, record_id, old_values, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (table_name, operation, record_id, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert default store
INSERT INTO pos.stores (id, name, description, address, phone, email, tax_rate, currency)
VALUES (
    uuid_generate_v4(),
    'Main Store',
    'Primary store location',
    '123 Main Street, City, State 12345',
    '+1-555-0123',
    'store@pocketpos.com',
    0.0875, -- 8.75% tax rate
    'USD'
);

-- Insert admin user
INSERT INTO users.users (id, email, password_hash, first_name, last_name, role, is_active, email_verified)
VALUES (
    uuid_generate_v4(),
    'admin@pocketpos.com',
    crypt('admin123', gen_salt('bf')), -- Use bcrypt for password hashing
    'Admin',
    'User',
    'admin',
    true,
    true
);

-- Insert sample categories
INSERT INTO inventory.categories (id, name, description) VALUES
    (uuid_generate_v4(), 'Food & Beverages', 'Food and drink items'),
    (uuid_generate_v4(), 'Electronics', 'Electronic devices and accessories'),
    (uuid_generate_v4(), 'Clothing', 'Apparel and accessories'),
    (uuid_generate_v4(), 'Home & Garden', 'Home improvement and garden supplies');

-- =============================================================================
-- PERMISSIONS FOR READ-ONLY USER
-- =============================================================================

-- Grant read permissions to readonly user
GRANT USAGE ON SCHEMA pos TO pocketpos_readonly;
GRANT USAGE ON SCHEMA inventory TO pocketpos_readonly;
GRANT USAGE ON SCHEMA users TO pocketpos_readonly;
GRANT USAGE ON SCHEMA analytics TO pocketpos_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA pos TO pocketpos_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA inventory TO pocketpos_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA users TO pocketpos_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO pocketpos_readonly;

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- Sales summary view
CREATE VIEW analytics.sales_summary AS
SELECT 
    DATE(t.created_at) as sale_date,
    s.name as store_name,
    COUNT(t.id) as transaction_count,
    SUM(t.subtotal) as subtotal,
    SUM(t.tax_amount) as tax_amount,
    SUM(t.total_amount) as total_amount
FROM pos.transactions t
JOIN pos.stores s ON t.store_id = s.id
WHERE t.payment_status = 'completed'
GROUP BY DATE(t.created_at), s.name
ORDER BY sale_date DESC;

-- Product performance view
CREATE VIEW analytics.product_performance AS
SELECT 
    p.id,
    p.name,
    p.sku,
    c.name as category_name,
    SUM(ti.quantity) as total_sold,
    SUM(ti.total_amount) as total_revenue,
    AVG(ti.unit_price) as avg_price
FROM inventory.products p
LEFT JOIN inventory.categories c ON p.category_id = c.id
LEFT JOIN pos.transaction_items ti ON p.id = ti.product_id
LEFT JOIN pos.transactions t ON ti.transaction_id = t.id
WHERE t.payment_status = 'completed' OR t.payment_status IS NULL
GROUP BY p.id, p.name, p.sku, c.name
ORDER BY total_revenue DESC NULLS LAST;

-- Low inventory view
CREATE VIEW analytics.low_inventory AS
SELECT 
    p.name,
    p.sku,
    s.name as store_name,
    i.quantity,
    i.min_quantity,
    i.reorder_point
FROM inventory.inventory i
JOIN inventory.products p ON i.product_id = p.id
JOIN pos.stores s ON i.store_id = s.id
WHERE i.quantity <= i.reorder_point
ORDER BY i.quantity ASC;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Pocket POS database initialization completed successfully!';
    RAISE NOTICE 'Database: pocketpos_dev';
    RAISE NOTICE 'Schemas created: pos, inventory, users, analytics, audit';
    RAISE NOTICE 'Default admin user: admin@pocketpos.com (password: admin123)';
    RAISE NOTICE 'Please change default passwords before production use!';
END $$;