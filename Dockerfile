# Multi-stage build for Node.js application
FROM node:18-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Dependencies stage
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod

# Development dependencies stage
FROM base AS dev-deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM dev-deps AS build

# Copy source code
COPY . .

# Build the backend application
WORKDIR /app/app/backend
RUN pnpm build

# Production stage
FROM base AS production

# Install dumb-init and curl for proper signal handling and health checks
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
WORKDIR /app
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/backend/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/backend/package.json ./package.json

# Create logs directory
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/live', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
