import { config as loadEnv } from 'dotenv';

loadEnv();

export interface OdooConnectionConfig {
  baseUrl: string;
  database: string;
  username: string;
  password: string;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export function loadOdooConfig(): OdooConnectionConfig {
  const password = getEnv('ODOO_PASSWORD') ?? getEnv('ODOO_API_KEY');
  if (!password) {
    throw new Error('Environment variable ODOO_PASSWORD or ODOO_API_KEY is required');
  }

  return {
    baseUrl: requireEnv('ODOO_BASE_URL'),
    database: requireEnv('ODOO_DATABASE'),
    username: requireEnv('ODOO_USERNAME'),
    password
  };
}
