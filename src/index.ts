import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import cors from "cors";

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create MCP server
const mcpServer = new Server(
    {
        name: "mcp-sse-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "hello_world",
                description: "Returns a hello world message",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Optional name to greet (defaults to 'World')",
                        },
                    },
                },
            },
            {
                name: "calculator",
                description: "Performs basic arithmetic operations (add, subtract, multiply, divide)",
                inputSchema: {
                    type: "object",
                    properties: {
                        operation: {
                            type: "string",
                            enum: ["add", "subtract", "multiply", "divide"],
                            description: "The arithmetic operation to perform",
                        },
                        a: {
                            type: "number",
                            description: "First number",
                        },
                        b: {
                            type: "number",
                            description: "Second number",
                        },
                    },
                    required: ["operation", "a", "b"],
                },
            },
        ],
    };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    if (name === "hello_world") {
        const userName = (args as any)?.name || "World";
        return {
            content: [
                {
                    type: "text",
                    text: `Hello, ${userName}! 👋`,
                },
            ],
        };
    }

    if (name === "calculator") {
        const { operation, a, b } = args as {
            operation: string;
            a: number;
            b: number;
        };

        let result: number;
        switch (operation) {
            case "add":
                result = a + b;
                break;
            case "subtract":
                result = a - b;
                break;
            case "multiply":
                result = a * b;
                break;
            case "divide":
                if (b === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Error: Division by zero is not allowed",
                            },
                        ],
                        isError: true,
                    };
                }
                result = a / b;
                break;
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: Unknown operation '${operation}'`,
                        },
                    ],
                    isError: true,
                };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Result: ${a} ${operation} ${b} = ${result}`,
                },
            ],
        };
    }

    return {
        content: [
            {
                type: "text",
                text: `Error: Unknown tool '${name}'`,
            },
        ],
        isError: true,
    };
});

// SSE endpoint for MCP
app.get("/sse", async (req: Request, res: Response) => {
    console.log("New SSE connection established");

    const transport = new SSEServerTransport("/message", res);
    await mcpServer.connect(transport);

    // Handle client disconnect
    req.on("close", () => {
        console.log("SSE connection closed");
    });
});

// POST endpoint for messages
app.post("/message", async (req: Request, res: Response) => {
    console.log("Received message:", req.body);
    // The SSEServerTransport handles the message
    res.status(200).send();
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root endpoint with info
app.get("/", (req: Request, res: Response) => {
    res.json({
        name: "MCP SSE Server",
        version: "1.0.0",
        endpoints: {
            sse: "/sse - SSE endpoint for MCP connection",
            message: "/message - POST endpoint for messages",
            health: "/health - Health check",
        },
        tools: ["hello_world", "calculator"],
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 MCP SSE Server running on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`📨 Message endpoint: http://localhost:${PORT}/message`);
});

