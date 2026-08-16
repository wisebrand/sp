# ==========================================
# Stage 1: Base & Dependencies
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create a non-root group and user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeapp

# Copy production node_modules from deps stage
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules

# Copy application source files
COPY --chown=nodeapp:nodejs . .

# Set permissions
USER nodeapp

# Expose server port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
