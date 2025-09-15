# Dev Dockerfile for Next.js app
FROM node:20-slim

ENV PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /app

# Install deps first (better caching)
COPY package.json pnpm-lock.yaml ./
# In dev images, avoid frozen lockfile to allow quick dep edits
RUN pnpm install --no-frozen-lockfile

# Copy the rest
COPY . .

EXPOSE 3000

CMD ["pnpm", "dev", "--turbo", "-p", "3000", "-H", "0.0.0.0"]
