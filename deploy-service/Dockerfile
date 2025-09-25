# syntax=docker/dockerfile:1.6
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        lsb-release \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/opt/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY deploy-service/entrypoint.sh /app/entrypoint.sh
COPY deploy-service/deploy.sh /app/deploy.sh
COPY deploy-service/server.mjs /app/server.mjs

RUN chmod +x /app/entrypoint.sh /app/deploy.sh

ENV LISTEN_PORT=3000

ENTRYPOINT ["/app/entrypoint.sh"]
