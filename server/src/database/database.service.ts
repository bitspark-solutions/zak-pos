import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async query(text: string, params?: any[]) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string) {
    const result = await this.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: string) {
    const result = await this.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    tenantId?: string;
  }) {
    const result = await this.query(
      `INSERT INTO users (id, email, password, name, role, tenantId, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        Date.now().toString(),
        userData.email,
        userData.password,
        userData.name,
        userData.role || 'cashier',
        userData.tenantId || 'tenant-1'
      ]
    );
    return result.rows[0];
  }

  async updateUser(id: string, userData: Partial<{
    email: string;
    password: string;
    name: string;
    role: string;
    tenantId: string;
  }>) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updatedat = NOW()`);
    values.push(id);

    const result = await this.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteUser(id: string) {
    const result = await this.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAllUsers() {
    const result = await this.query(
      'SELECT id, email, name, role, tenantId, createdat, updatedat FROM users'
    );
    return result.rows;
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  getConnectionInfo() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
    };
  }

  async testConnection() {
    try {
      await this.query('SELECT 1');
      return { status: 'connected', message: 'Database connection successful' };
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }
}