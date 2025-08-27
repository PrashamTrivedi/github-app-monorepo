FROM node:22-alpine
# Cache bust: 2025-08-26-18:49

RUN apk add --no-cache git curl openssh-client bash jq
RUN mkdir -p /workspace /app
WORKDIR /app

RUN git config --global user.name "GitHub App Bot" && \
    git config --global user.email "app@github.com" && \
    git config --global init.defaultBranch main

RUN echo '#!/bin/sh' > /usr/local/bin/git-askpass && \
    echo 'echo "$GIT_PASSWORD"' >> /usr/local/bin/git-askpass && \
    chmod +x /usr/local/bin/git-askpass

COPY git-server.js /app/git-server.js
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]