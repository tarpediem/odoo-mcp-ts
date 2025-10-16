#!/bin/bash

# Build and run the Docker container

echo "Building Docker image..."
docker build -t mcp-sse-server .

echo "Running Docker container on port 3333..."
docker run -d \
  --name mcp-sse-server \
  -p 3333:3333 \
  -e PORT=3333 \
  --restart unless-stopped \
  mcp-sse-server

echo "✅ Container started successfully!"
echo "🚀 Server available at http://localhost:3333"
echo "📡 SSE endpoint: http://localhost:3333/sse"
echo ""
echo "To view logs: docker logs -f mcp-sse-server"
echo "To stop: docker stop mcp-sse-server"
echo "To remove: docker rm mcp-sse-server"

