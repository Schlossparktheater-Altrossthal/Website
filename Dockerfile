# Dev Dockerfile for Next.js app
FROM node:20-slim

ARG NODE_ENV=development

ENV PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=${NODE_ENV}

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /app

# Install deps first (better caching)
COPY package.json pnpm-lock.yaml ./
# In dev images, avoid frozen lockfile to allow quick dep edits. Skip Prisma
# postinstall generate until schema is available.
RUN SKIP_PRISMA_POSTINSTALL=1 PRISMA_SKIP_POSTINSTALL_GENERATE=1 pnpm install --no-frozen-lockfile

# Copy the rest
COPY . .

# Generate Prisma client now that schema exists
RUN pnpm prisma:generate

EXPOSE 3000

CMD ["pnpm", "dev", "--turbo", "-p", "3000", "-H", "0.0.0.0"]
