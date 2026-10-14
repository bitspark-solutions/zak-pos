-- Cluster-level role creation can't live in a Prisma migration (not transactional).
-- docker-compose.yml mounts this file as docker-entrypoint-initdb.d/02-app-role.sql,
-- so a fresh Postgres volume creates the role automatically before the API boots.
-- For servers provisioned outside compose, apply once per instance:
--   docker exec -i zakpos-postgres-1 psql -U postgres -d zakpos_dev < server/prisma/bootstrap/create_app_role.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zakpos_app') THEN
    CREATE ROLE zakpos_app LOGIN PASSWORD 'zakpos_app_dev_2026';
  END IF;
END
$$;

ALTER ROLE zakpos_app LOGIN PASSWORD 'zakpos_app_dev_2026'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
