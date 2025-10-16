#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-odoo-mcp-server}
ENV_FILE=${ENV_FILE:-.env}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file '$ENV_FILE' not found."
  echo "Create it or set ENV_FILE=/path/to/env before running this script."
  exit 1
fi

echo "Building Docker image '$IMAGE_NAME'..."
docker build -t "$IMAGE_NAME" .

echo "Starting MCP server container (press Ctrl+C to stop)..."
docker run --rm -i \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME"
