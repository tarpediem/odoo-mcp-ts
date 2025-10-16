# MCP SSE Server

A simple SSE (Server-Sent Events) server implementing the Model Context Protocol (MCP) with two basic tools.

## Features

- **Hello World Tool**: Returns a greeting message
- **Calculator Tool**: Performs basic arithmetic operations (add, subtract, multiply, divide)
- **SSE Transport**: Compatible with n8n and other SSE clients
- **Express.js**: Lightweight HTTP server

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run

```bash
npm start
```

For development (build + run):

```bash
npm run dev
```

## Endpoints

- `GET /` - Server information and available endpoints
- `GET /sse` - SSE endpoint for MCP connection
- `POST /message` - Message endpoint for MCP communication
- `GET /health` - Health check endpoint

## Tools

### 1. hello_world

Returns a hello world message with optional custom name.

**Input:**

- `name` (string, optional): Name to greet (defaults to "World")

**Example:**

```json
{
  "name": "hello_world",
  "arguments": {
    "name": "Alice"
  }
}
```

### 2. calculator

Performs basic arithmetic operations.

**Input:**

- `operation` (string, required): One of "add", "subtract", "multiply", "divide"
- `a` (number, required): First number
- `b` (number, required): Second number

**Example:**

```json
{
  "name": "calculator",
  "arguments": {
    "operation": "add",
    "a": 5,
    "b": 3
  }
}
```

## Usage with n8n

1. Start the server: `npm start`
2. In n8n, use the SSE endpoint: `http://localhost:3000/sse`
3. Configure the message endpoint: `http://localhost:3000/message`

## Configuration

Set the `PORT` environment variable to change the default port (3000):

```bash
PORT=8080 npm start
```

## Docker

### Build and Run with Docker

```bash
docker build -t mcp-sse-server .
docker run -d -p 3333:3333 -e PORT=3333 --name mcp-sse-server mcp-sse-server
```

Or use the helper script:

```bash
chmod +x scripts/docker-run.sh
./scripts/docker-run.sh
```

### Using Docker Compose

```bash
docker-compose up -d
```

To stop:

```bash
docker-compose down
```

To view logs:

```bash
docker-compose logs -f
```

### Docker Management

View logs:

```bash
docker logs -f mcp-sse-server
```

Stop container:

```bash
docker stop mcp-sse-server
```

Remove container:

```bash
docker rm mcp-sse-server
```

## License

MIT
