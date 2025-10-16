#!/bin/bash

# Test SSE connection with curl
echo "Testing SSE connection with curl..."

# Start listening to SSE events in the background
curl -N http://localhost:3333/sse > sse_response.txt &
SSE_PID=$!

# Give it a second to connect
sleep 2

# Extract the session ID from the response
SESSION_ID=$(grep -o 'sessionId=[^&"]*' sse_response.txt | cut -d= -f2)

if [ -z "$SESSION_ID" ]; then
  echo "Failed to get session ID"
  kill $SSE_PID
  exit 1
fi

echo "Got session ID: $SESSION_ID"

# Send a test message
echo "Sending test message..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' \
  "http://localhost:3333/messages?sessionId=$SESSION_ID"

# List available tools
echo -e "\nListing available tools..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"mcp.listTools"}' \
  "http://localhost:3333/messages?sessionId=$SESSION_ID"

echo ""
echo "Waiting for response..."
sleep 5

# Display the SSE response
echo "SSE response:"
cat sse_response.txt

# Clean up
kill $SSE_PID
rm sse_response.txt

echo "Test completed."
