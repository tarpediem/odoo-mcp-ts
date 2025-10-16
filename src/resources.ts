import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESOURCE_PREFIX = 'resource://odoo-mcp';

const README_URI = `${RESOURCE_PREFIX}/docs/readme`;
const CONFIG_URI = `${RESOURCE_PREFIX}/config/environment`;
const TIMESHEET_FIELDS_URI = `${RESOURCE_PREFIX}/docs/timesheet-fields`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

let readmeCache: string | null = null;

async function loadReadme(): Promise<string> {
  if (readmeCache) {
    return readmeCache;
  }
  const readmePath = resolve(projectRoot, 'README.md');
  readmeCache = await readFile(readmePath, 'utf-8');
  return readmeCache;
}

function describeEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    return `${name}: (not set)`;
  }
  if (name.toUpperCase().includes('PASSWORD') || name.toUpperCase().includes('KEY')) {
    return `${name}: (set, value hidden)`;
  }
  return `${name}: ${value}`;
}

const TIMESHEET_FIELD_DOC = `Timesheet fields (account.analytic.line):

- name: Description of the work completed.
- date: Entry date (YYYY-MM-DD).
- unit_amount: Logged hours (float).
- employee_id: Many2one link to hr.employee.
- project_id: Many2one link to project.project.
- task_id: Many2one link to project.task.

All create/update calls rely on Odoo's XML-RPC endpoint /xmlrpc/2/object with the model 'account.analytic.line'.`;

export function registerResources(server: McpServer): void {
  server.registerResource(
    'odoo-mcp-readme',
    README_URI,
    {
      title: 'Odoo MCP Server README',
      description: 'Project documentation shipped with this server.',
      mediaType: 'text/markdown'
    },
    async uri => ({
      contents: [
        {
          uri: uri.href,
          text: await loadReadme()
        }
      ]
    })
  );

  server.registerResource(
    'odoo-mcp-config',
    CONFIG_URI,
    {
      title: 'Odoo Environment Variables',
      description: 'Summary of required environment configuration for the MCP server.',
      mediaType: 'text/plain'
    },
    async uri => {
      const lines = [
        'Required environment variables:',
        describeEnvVar('ODOO_BASE_URL'),
        describeEnvVar('ODOO_DATABASE'),
        describeEnvVar('ODOO_USERNAME'),
        describeEnvVar('ODOO_PASSWORD'),
        describeEnvVar('ODOO_API_KEY')
      ];

      return {
        contents: [
          {
            uri: uri.href,
            text: lines.join('\n')
          }
        ]
      };
    }
  );

  server.registerResource(
    'odoo-mcp-timesheet-fields',
    TIMESHEET_FIELDS_URI,
    {
      title: 'Timesheet Field Reference',
      description: 'Field definitions for account.analytic.line used by the MCP server.',
      mediaType: 'text/markdown'
    },
    async uri => ({
      contents: [
        {
          uri: uri.href,
          text: TIMESHEET_FIELD_DOC
        }
      ]
    })
  );
}
