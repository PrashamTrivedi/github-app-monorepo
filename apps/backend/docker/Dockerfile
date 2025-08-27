# Multi-stage build for Git Container
FROM node:18-alpine AS base

# Install git, pnpm and other necessary tools
RUN apk add --no-cache \
    git \
    curl \
    openssh-client \
    bash \
    && rm -rf /var/cache/apk/*

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create workspace directory
RUN mkdir -p /workspace && chmod 755 /workspace

# Create git-askpass script for authentication
RUN echo '#!/bin/sh' > /usr/local/bin/git-askpass && \
    echo 'echo "$GIT_PASSWORD"' >> /usr/local/bin/git-askpass && \
    chmod +x /usr/local/bin/git-askpass

# Production image
FROM node:18-alpine AS production

# Copy tools and configuration from base
COPY --from=base /usr/local/bin/git-askpass /usr/local/bin/git-askpass
COPY --from=base /workspace /workspace

# Install runtime dependencies and pnpm
RUN apk add --no-cache \
    git \
    curl \
    openssh-client \
    bash \
    && rm -rf /var/cache/apk/*

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies using pnpm
RUN pnpm install --prod

# Copy application code
COPY src/ ./src/

# Set environment variables
ENV NODE_ENV=production
ENV WORKSPACE_DIR=/workspace
ENV GIT_SSL_NO_VERIFY=0

# Expose the port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the container service
CMD ["node", "src/server.js"]