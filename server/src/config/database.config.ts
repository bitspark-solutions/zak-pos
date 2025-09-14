export const databaseConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  username: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres123',
  database: process.env.DB_DATABASE || process.env.POSTGRES_DB || 'zakpos_dev',
  entities: [],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: false,
  retryAttempts: 3,
  retryDelay: 3000,
};
