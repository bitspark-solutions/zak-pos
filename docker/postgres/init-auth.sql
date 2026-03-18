-- =============================================================================
-- ZAKPOS - Authentication Database Initialization
-- =============================================================================
-- Simplified initialization script for current authentication system

-- =============================================================================
-- DATABASE CREATION
-- =============================================================================

-- Create development database (if not exists)
SELECT 'CREATE DATABASE zakpos_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zakpos_dev')\gexec

-- Create test database (if not exists)
SELECT 'CREATE DATABASE zakpos_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zakpos_test')\gexec

-- =============================================================================
-- CONNECT TO DEVELOPMENT DATABASE
-- =============================================================================
\c zakpos_dev;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE (Matching Current Auth System)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cashier',
    tenantId VARCHAR(50) NOT NULL DEFAULT 'tenant-1',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenantId);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert default admin user (if not exists)
INSERT INTO users (id, email, password, name, role, tenantId)
SELECT 
    '1',
    'admin@zakpos.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5K5K5K', -- 'password123'
    'Admin User',
    'owner',
    'tenant-1'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@zakpos.com');

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'ZakPOS authentication database initialized successfully!';
    RAISE NOTICE 'Database: zakpos_dev';
    RAISE NOTICE 'Default admin: admin@zakpos.com (password: password123)';
END $$;
