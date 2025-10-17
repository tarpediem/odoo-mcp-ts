# Project Context

## Purpose
- Provide a Model Context Protocol (MCP) server that lets AI agents read, update, and create Odoo 16 timesheet (`account.analytic.line`) records through the official XML-RPC API.
- Offer a portable integration layer so hosts can interact with Odoo via stdio (default) or optional HTTP + Server-Sent Events transport.

## Tech Stack
- TypeScript (strict mode, ESM targeting Node.js 18+; built against Node 20 in Docker image)
- Node.js runtime with `tsx` for development and `tsc` for production builds
- MCP SDK (`@modelcontextprotocol/sdk`) for server scaffolding and transports
- XML-RPC client (`xmlrpc`) for communicating with Odoo
- Express (only when SSE transport is enabled)
- Zod for input/output validation
- dotenv for environment configuration loading

## Project Conventions

### Code Style
- Use modern TypeScript with `strict` compiler settings; prefer explicit types on public interfaces.
- Follow 2-space indentation and trailing commas as seen in current sources.
- Keep modules ESM (`type: module`); imports should be explicit with `.js` extensions for local files.
- Organize helper functions near their usage and favour small, composable utilities (e.g., `normalizeTimesheet`, `withOdooClient`).

### Architecture Patterns
- Entry point (`src/index.ts`) boots an MCP server, registers resources, and exposes tools that map directly to Odoo operations.
- Odoo access is encapsulated in `OdooClient`, which wraps XML-RPC calls and handles authentication caching.
- Configuration is centralized in `src/config.ts`, which validates required env vars and supports API key fallback.
- Resources exposed to MCP clients live in `src/resources.ts`, keeping documentation surfaced through the protocol.
- Optional SSE transport spins up an Express app while stdio remains the default for CLI hosts.

### Testing Strategy
- No automated test suite yet. Manual validation via `npm run dev` and the MCP host is expected.
- A smoke-test script (`npm run test:connection`) verifies environment variables and the ability to authenticate and query Odoo.
- When adding features, prefer lightweight integration scripts or mocked unit tests where practical, especially around Odoo RPC calls.

### Git Workflow
- Default to feature branches that target `main`; open pull requests for review before merging.
- Commits should be scoped and descriptive (no formal convention enforced today).
- Keep generated artifacts (`dist/`) out of version control; rely on `npm run build` during CI/deploy.

## Domain Context
- Operates on Odoo 16 timesheets (`account.analytic.line`), primarily managing fields `name`, `date`, `unit_amount`, `employee_id`, `project_id`, and `task_id`.
- Timesheet records encode many2one relationships as `[id, display_name]`; helpers normalize these for structured responses.
- MCP tools expose both human-readable text and structured JSON payloads, allowing callers to chain updates or display summaries directly.

## Important Constraints
- Requires Node.js 18 or newer (Docker image ships with Node 20) and network access to an Odoo 16 instance with XML-RPC enabled.
- Environment variables `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_USERNAME`, and either `ODOO_PASSWORD` or `ODOO_API_KEY` must be present at runtime.
- Server defaults to stdio transport; enabling SSE requires binding to `MCP_HTTP_PORT` and impacts deployment topology (needs port exposure).
- Authentication failures must be surfaced with clear error messages prefixed by the originating tool for easier debugging.

## External Dependencies
- Odoo XML-RPC endpoints (`/xmlrpc/2/common`, `/xmlrpc/2/object`) for authentication and CRUD operations.
- MCP-compatible hosts (Claude Desktop, Cursor, n8n, etc.) that start the server over stdio or HTTP SSE.
- Docker (optional) for containerized deployment using the provided multi-stage `Dockerfile`.
