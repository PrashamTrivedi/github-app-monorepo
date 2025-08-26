# Custom Git Container for Cloudflare Workers
FROM node:18-alpine

# Install git and other necessary tools
RUN apk add --no-cache \
    git \
    curl \
    openssh-client \
    bash \
    jq

# Install GitHub CLI
RUN apk add --no-cache github-cli

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Install global npm packages that might be useful
RUN npm install -g typescript ts-node

# Set git configuration defaults
RUN git config --global user.name "GitHub App Bot" \
    && git config --global user.email "app@github.com" \
    && git config --global init.defaultBranch main

# Create entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]