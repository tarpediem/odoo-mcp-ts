FROM node:20-alpine AS builder

WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./

# Default entrypoint uses stdio for MCP hosts (docker run -i ...)
ENTRYPOINT ["node", "dist/index.js"]
