import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { z } from 'zod';
import { loadOdooConfig } from './config.js';
import { OdooClient, TimesheetRecord } from './odooClient.js';
import { registerResources } from './resources.js';

type Many2OneValue = [number, string] | false | null | undefined;

interface NormalizedMany2One {
  id: number;
  name: string;
}

interface NormalizedTimesheet {
  id: number;
  description: string;
  date: string;
  hours: number;
  employee: NormalizedMany2One | null;
  project: NormalizedMany2One | null;
  task: NormalizedMany2One | null;
}

const timesheetOutputSchema = z.object({
  id: z.number(),
  description: z.string(),
  date: z.string(),
  hours: z.number(),
  employee: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  project: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable(),
  task: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullable()
});

function normalizeMany2One(value: Many2OneValue): NormalizedMany2One | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [id, name] = value;
    if (typeof id === 'number' && typeof name === 'string') {
      return { id, name };
    }
  }
  return null;
}

function normalizeTimesheet(record: TimesheetRecord): NormalizedTimesheet {
  return {
    id: record.id,
    description: record.name,
    date: record.date,
    hours: Number(record.unit_amount),
    employee: normalizeMany2One(record.employee_id),
    project: normalizeMany2One(record.project_id),
    task: normalizeMany2One(record.task_id)
  };
}

let cachedClient: OdooClient | null = null;

function getClient(): OdooClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config = loadOdooConfig();
  cachedClient = new OdooClient(config);
  return cachedClient;
}

async function withOdooClient<T>(operation: string, handler: (client: OdooClient) => Promise<T>): Promise<T> {
  try {
    const client = getClient();
    return await handler(client);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`[${operation}] ${error.message}`);
    }
    throw new Error(`[${operation}] Unknown error: ${JSON.stringify(error)}`);
  }
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
  .describe('Calendar date in YYYY-MM-DD format');

function registerTimesheetTools(server: McpServer): void {
  registerResources(server);

  server.registerTool(
  'list_timesheets',
  {
    title: 'List Timesheets',
    description: 'Search recent Odoo timesheet entries (account.analytic.line records).',
    inputSchema: {
      employeeId: z.number().int().nonnegative().optional().describe('Filter by employee ID.'),
      projectId: z.number().int().nonnegative().optional().describe('Filter by project ID.'),
      taskId: z.number().int().nonnegative().optional().describe('Filter by task ID.'),
      date: isoDateSchema.optional().describe('Filter by a specific entry date.'),
      descriptionQuery: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe('Case-insensitive match on the description.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(20)
        .describe('Maximum number of timesheets to return.')
    },
    outputSchema: {
      timesheets: z.array(timesheetOutputSchema)
    }
  },
  async ({ employeeId, projectId, taskId, date, descriptionQuery, limit }) => {
    const timesheets = await withOdooClient('list_timesheets', client =>
      client.findTimesheets(
        {
          employeeId,
          projectId,
          taskId,
          date,
          descriptionContains: descriptionQuery
        },
        limit
      )
    );

    const normalized = timesheets.map(normalizeTimesheet);
    const output = { timesheets: normalized };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
    }
  );

  server.registerTool(
  'update_timesheet',
  {
    title: 'Update Timesheet Entry',
    description: 'Modify an existing timesheet entry in Odoo.',
    inputSchema: {
      timesheetId: z.number().int().positive().describe('Internal ID of the timesheet record to update.'),
      description: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe('New description for the entry.'),
      projectId: z.number().int().positive().optional().describe('Project ID to associate with the entry.'),
      taskId: z.number().int().positive().optional().describe('Task ID to associate with the entry.'),
      hours: z
        .number()
        .min(0)
        .max(24)
        .optional()
        .describe('Number of hours to record for this entry.'),
      date: isoDateSchema.optional().describe('Update the entry date.')
    },
    outputSchema: {
      success: z.boolean(),
      updatedTimesheet: timesheetOutputSchema.nullable()
    }
  },
  async ({ timesheetId, description, projectId, taskId, hours, date }) => {
    const success = await withOdooClient('update_timesheet', client =>
      client.updateTimesheet(timesheetId, {
        description,
        projectId,
        taskId,
        unitAmountHours: hours,
        date
      })
    );

    const updated = success
      ? await withOdooClient('update_timesheet:fetch', client => client.getTimesheet(timesheetId))
      : null;

    const normalized = updated ? normalizeTimesheet(updated) : null;
    const output = {
      success,
      updatedTimesheet: normalized
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
    }
  );

  server.registerTool(
  'create_timesheet',
  {
    title: 'Create Timesheet Entry',
    description: 'Create a new timesheet entry in Odoo.',
    inputSchema: {
      employeeId: z.number().int().positive().describe('Employee ID for whom the entry is created.'),
      description: z.string().min(1).max(120).describe('Summary or label for the timesheet entry.'),
      hours: z.number().min(0).max(24).describe('Hours worked for this entry.'),
      date: isoDateSchema.describe('Entry date in YYYY-MM-DD.'),
      projectId: z.number().int().positive().optional().describe('Related project ID, if any.'),
      taskId: z.number().int().positive().optional().describe('Related task ID, if any.')
    },
    outputSchema: {
      success: z.boolean(),
      createdTimesheet: timesheetOutputSchema.nullable()
    }
  },
  async ({ employeeId, description, hours, date, projectId, taskId }) => {
    const timesheetId = await withOdooClient('create_timesheet', client =>
      client.createTimesheet({
        employeeId,
        description,
        unitAmountHours: hours,
        date,
        projectId,
        taskId
      })
    );

    const created = await withOdooClient('create_timesheet:fetch', client => client.getTimesheet(timesheetId));
    const normalized = created ? normalizeTimesheet(created) : null;
    const output = {
      success: normalized !== null,
      createdTimesheet: normalized
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
  });
}

function createConfiguredServer(): McpServer {
  const server = new McpServer({
    name: 'odoo-mcp-server',
    version: '0.1.0'
  });

  registerTimesheetTools(server);
  return server;
}

const transportMode = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

if (transportMode === 'stdio') {
  const server = createConfiguredServer();
  const transport = new StdioServerTransport();

  server
    .connect(transport)
    .then(() => {
      // No-op: the transport runs until the process exits.
    })
    .catch(error => {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    });

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else if (transportMode === 'sse') {
  const app = express();
  const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3333', 10);
  const ssePath = process.env.MCP_SSE_PATH ?? '/sse';
  const postPath = process.env.MCP_SSE_POST_PATH ?? '/messages';

  app.use(express.json({ limit: '4mb' }));

  interface SessionContext {
    server: McpServer;
    transport: SSEServerTransport;
  }

  const sessions = new Map<string, SessionContext>();

  const handleSSEConnection = async (_req: express.Request, res: express.Response) => {
    const sessionServer = createConfiguredServer();
    const transport = new SSEServerTransport(postPath, res);

    transport.onclose = () => {
      sessions.delete(transport.sessionId);
      sessionServer.close().catch(() => {
        // Ignore shutdown errors.
      });
    };

    transport.onerror = error => {
      console.error('SSE transport error:', error);
    };

    try {
      await sessionServer.connect(transport);
      sessions.set(transport.sessionId, { server: sessionServer, transport });
    } catch (error) {
      sessions.delete(transport.sessionId);
      res.end();
      console.error('Failed to establish SSE session:', error);
    }
  };

  app.get(ssePath, handleSSEConnection);

  if (ssePath !== '/mcp') {
    app.get('/mcp', handleSSEConnection);
  }

  app.post(postPath, async (req, res) => {
    const sessionIdParam = req.query.sessionId;

    if (!sessionIdParam || typeof sessionIdParam !== 'string') {
      res.status(400).send('Missing sessionId query parameter.');
      return;
    }

    const session = sessions.get(sessionIdParam);

    if (!session) {
      res.status(404).send('Unknown session.');
      return;
    }

    try {
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Failed to handle SSE POST message:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error.');
      }
    }
  });

  const serverInstance = app.listen(port, () => {
    console.log(`Odoo MCP server (SSE mode) listening on port ${port}, SSE path: ${ssePath}, POST path: ${postPath}`);
  });

  const shutdown = async () => {
    for (const { transport, server } of sessions.values()) {
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
    sessions.clear();

    await new Promise(resolve => serverInstance.close(resolve));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  console.error(`Unsupported MCP transport: ${transportMode}. Use "stdio" or "sse".`);
  process.exit(1);
}
