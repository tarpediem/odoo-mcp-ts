## Odoo Timesheet MCP Server

This project implements a [Model Context Protocol](https://modelcontextprotocol.io/docs/develop/build-server) (MCP) server that provides tools for working with Odoo 16 timesheets via the [official external XML-RPC API](https://www.odoo.com/documentation/16.0/developer/reference/external_api.html).

The server exposes MCP tools for:

- Listing recent timesheet entries (`account.analytic.line`)
- Updating an existing timesheet
- Creating a new timesheet entry

All responses include structured JSON output and a text representation, so MCP clients can easily consume the data or display it to users.

### Prerequisites

- Node.js 18+ (tested with v24)
- An accessible Odoo 16 instance with XML-RPC enabled
- Credentials with permission to read/create/write `account.analytic.line` records

### Getting Started

```bash
npm install
```

Create a `.env` file (or export the variables) with your Odoo connection details:

```env
ODOO_BASE_URL=https://your-odoo-host.example.com
ODOO_DATABASE=your_database
ODOO_USERNAME=api.user@example.com
ODOO_PASSWORD=your_api_password
```

Available environment variables:

| Variable           | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| `ODOO_BASE_URL`    | Base URL to the Odoo instance (include protocol, e.g. `https://odoo.local`) |
| `ODOO_DATABASE`    | Odoo database name                                                          |
| `ODOO_USERNAME`    | Username/login used for authentication                                      |
| `ODOO_PASSWORD`    | Password for the user (optional if using API key)                           |
| `ODOO_API_KEY`     | API key/token for the user (takes precedence over `ODOO_PASSWORD`)          |

> Tip: Odoo treats API keys as passwords for RPC calls, so set either `ODOO_PASSWORD` or `ODOO_API_KEY` with your key—no code changes required.

### Development

Run the server in watch/dev mode with `tsx`:

```bash
npm run dev
```

For production builds:

```bash
npm run build
npm start
```

The server communicates over stdio, so you can plug it into any MCP-compatible host. When the server starts it registers three tools:

| Tool name          | Purpose                                   |
|--------------------|-------------------------------------------|
| `list_timesheets`  | Filter timesheets by employee/project/etc |
| `update_timesheet` | Patch an existing timesheet               |
| `create_timesheet` | Create a new timesheet entry              |

### Running in Docker

If you need to deploy the MCP server on multiple machines (for example your home workstation or an n8n host), you can use the provided Docker resources.

1. Ensure your `.env` (or chosen env file) contains the Odoo credentials/URL as described above.
2. Build and run the container via the helper script:

   ```bash
   ./scripts/docker-run.sh
   ```

   The script will:
   - Build the `odoo-mcp-server` image (override with `IMAGE_NAME=my-image ./scripts/docker-run.sh`)
   - Start the container with stdin/stdout attached so MCP hosts can communicate over stdio
   - Load environment variables from `.env` (override with `ENV_FILE=/path/to/env`)

To manage the container manually:

```bash
docker build -t odoo-mcp-server .
docker run --rm -i --env-file .env odoo-mcp-server
```

Because MCP relies on stdio, keep the `-i` flag so the container stays attached to the calling process. When integrating with platforms like n8n, configure the process step to start `docker run --rm -i ...` and pipe stdio as required by your workflow.

In addition to tools, the server exposes helpful MCP resources:

- `resource://odoo-mcp/docs/readme` – this README for quick reference inside a client.
- `resource://odoo-mcp/config/environment` – environment variable checklist (values hidden for secrets).
- `resource://odoo-mcp/docs/timesheet-fields` – summary of `account.analytic.line` fields used by the tools.

Each tool validates input using [`zod`](https://github.com/colinhacks/zod) and interacts with Odoo through the XML-RPC endpoints (`/xmlrpc/2/common` for authentication and `/xmlrpc/2/object` for RPC calls).

### Odoo Model Notes

Timesheets are stored in `account.analytic.line`. The server reads and writes the following fields:

- `name` (description)
- `date`
- `unit_amount` (hours)
- `employee_id`
- `project_id`
- `task_id`

If you need to customise the behaviour (additional fields, different defaults, etc.), extend the helper functions in `src/odooClient.ts`.

### MCP Integration Tips

- Ensure your MCP host starts this server as a stdio subprocess.
- All tool responses include both `structuredContent` (JSON) and a human-readable text payload.
- Authentication failures or RPC errors are surfaced as tool errors with contextual messages prefixed by the tool name.

### Useful Links

- [Odoo 16 External API reference](https://www.odoo.com/documentation/16.0/developer/reference/external_api.html)
- [Model Context Protocol - Build a server](https://modelcontextprotocol.io/docs/develop/build-server)
