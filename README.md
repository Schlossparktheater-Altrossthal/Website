# Theater Website

This repository combines the public Next.js 15 website and the Socket.IO based
realtime server for the theater collective. Both services run inside the same
Node.js process and expose the realtime API under `/realtime` (websocket path
`/realtime/socket.io`). The published Docker images wrap the combined server in a
lightweight reverse proxy so external deployments only have to expose a single
HTTP endpoint.

## Prerequisites

- Node.js 24 LTS (matches the `Dockerfile.*` images)
- [`pnpm` 9](https://pnpm.io/) via `corepack enable`
- PostgreSQL 16 for local development (Docker compose setup provided)
- Mailpit (optional) to preview transactional emails
- Docker + Docker Compose (optional but recommended for a full local stack)

## Environment configuration

1. Copy `.env.example` to `.env.local` for Next.js (and `.env` when using Docker).
2. Provide strong secrets for `AUTH_SECRET`, `REALTIME_AUTH_TOKEN`,
   `REALTIME_HANDSHAKE_SECRET` and (optionally) `REALTIME_SERVER_TOKEN`.
3. Point `DATABASE_URL` to your PostgreSQL instance.
4. Set both `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL` to the public origin of the
   app **without** a trailing slash. NextAuth uses it for callback URLs while
   notification emails and cron jobs rely on `NEXT_PUBLIC_BASE_URL`.
5. Configure your email transport via `EMAIL_SERVER` or `EMAIL_SERVICE` + API key.
6. Toggle offline support with `NEXT_PUBLIC_PWA_ENABLED` (set to `1` to register
   the service worker) and adjust the background sync throughput with
   `SYNC_BATCH_LIMIT`.

## Installation

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Local development

```bash
pnpm dev
```

The `dev` script executes `scripts/run-prisma-migrate.mjs`, applies pending
Prisma migrations, runs the seed script (when necessary) and finally launches the
Next.js turbopack dev server together with the realtime bridge. The app listens
on [http://localhost:3000](http://localhost:3000).

### Useful scripts

- `pnpm prisma:generate` – regenerate the Prisma client after schema changes.
- `pnpm db:migrate` – create and apply local development migrations.
- `pnpm db:seed` – repopulate the database with seed data.
- `pnpm start:combined` – run the production build and realtime server without Docker.
- `pnpm start:proxy` – emulate the Docker proxy setup locally.
- `pnpm swatches:gen` / `pnpm design-system:tokens` – update color palettes and
  design tokens.

### Quality checks

Before committing, ensure that the following commands succeed:

```bash
pnpm lint
pnpm test
pnpm build
```

(Documentation-only changes can skip these checks but should mention it in the
PR description.)

### Dev-only screenshot sessions

For local screenshot automation the endpoint
`/api/dev/screenshot-session` can mint a temporary NextAuth session for any of
the predefined development roles. The helper is only available when
`NODE_ENV !== "production"`. Visit a URL such as
`http://localhost:3000/api/dev/screenshot-session?role=owner&target=/mitglieder`
to set the session cookie and get redirected to the protected page. Append
`mode=json` to receive a JSON payload instead of a redirect or pass a custom
`email` query parameter to reuse a specific test account. The route reuses the
test users from `@/lib/auth-dev-test-users` and relies on `AUTH_SECRET` for JWT
signing.

## Docker overview

- `Dockerfile.dev` builds the development image that serves the Next.js app via
the bundled dev server and proxies the realtime routes below `/realtime`.
- `Dockerfile.prod` produces the production image with the statically built
Next.js output. The runtime launches the combined server and proxies it so the
realtime API stays on the same host.

Both images execute `scripts/start-with-proxy.mjs`. The script first prepares
Next.js via `scripts/start-combined-server.mjs`, attaches the Socket.IO server to
an internal HTTP listener and then exposes it through a lightweight reverse
proxy (default external port `3000`). During boot it configures
`NEXT_PUBLIC_REALTIME_URL`, `NEXT_PUBLIC_REALTIME_PATH` and
`REALTIME_SERVER_EVENT_PATH` automatically based on `REALTIME_BASE_PATH`
(default `/realtime`).

### Local development stack

```bash
docker compose up
```

The default `docker-compose.yml` builds the development image from the current
workspace, runs Prisma migrations/seeding and exposes the app on
`http://localhost:3000`. Postgres (database `theater_dev`) and Mailpit are part
of this stack. Hot reloading works because the repository is bind-mounted into
the container. Override `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL` and
`NEXT_PUBLIC_REALTIME_URL` before starting the stack when you want to serve the
app via a reverse proxy.

### Building the production image from source

```bash
docker build -f Dockerfile.prod \
  --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) \
  -t theater-website:prod .

# Run the container (make sure a Postgres instance is reachable)
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/theater_prod?schema=public" \
  -e AUTH_SECRET="replace-me" \
  -e REALTIME_AUTH_TOKEN="replace-me" \
  -e NEXTAUTH_URL="https://example.com" \
  -e NEXT_PUBLIC_BASE_URL="https://example.com" \
  theater-website:prod
```

Important environment variables:

- `REALTIME_BASE_PATH` (default `/realtime`) controls where the realtime API is
  mounted relative to the web app.
- `REALTIME_PUBLIC_ORIGIN` overrides the public URL when the realtime endpoint
  must use an absolute host instead of the relative `REALTIME_BASE_PATH`.
- `REALTIME_AUTH_TOKEN` and `REALTIME_HANDSHAKE_SECRET` protect the realtime
  handshake and admin events.
- `NEXT_PUBLIC_PWA_ENABLED` controls whether the client registers the PWA
  service worker and offline caches.
- `SYNC_BATCH_LIMIT` caps how many queued mutations get flushed per background
  sync cycle when offline work reconnects.
- `APP_SERVER_PORT` (default `PORT + 1`) sets the internal port where the
  combined Next.js/Socket.IO server listens when the reverse proxy is enabled.

### Hosting with images from the registry

The file `docker-compose.hosting.yml` consumes the published images from Docker
Hub and publishes two app instances via Traefik:

- `https://devtheater.beegreenx.de` using the `dev` tag
- `https://prodtheater.beegreenx.de` using the `prod` tag

Both services share a single Postgres container. A short-lived
`db-bootstrap` service (part of the compose file) connects to the database and
creates the schemas `theater_dev` and `theater_prod` on first startup, so no
external SQL file is required. The compose stack expects an external Docker
network called `proxy` so Traefik can route traffic to the containers.

### Auto-deploying with the webhook service container

`docker-compose.autodeploy.yml` builds a small service container that listens for
GitHub push webhooks and rebuilds/restarts the application container on demand.
Only this service image needs to be published to your registry – the actual
Next.js image will be rebuilt locally through `docker compose` whenever a push
arrives for the configured branch.

1. Build and publish the service image once: `docker build -f deploy-service/Dockerfile -t <registry>/theater-autodeploy .`.
2. Provision a host with Docker and mount `/var/run/docker.sock` into the
   service. The container uses the Docker API to rebuild the app image and
   therefore must run with this socket mount.
3. Create a persistent volume (automatically handled by the compose file) to
   store the checked-out repository under `/opt/worktree`.
4. Configure the environment variables in `.env` (see the template at the end
   of `.env.example`). The most relevant toggles are:
   - `AUTO_DEPLOY_GIT_REMOTE_URL` – SSH or HTTPS URL of this repository.
   - `AUTO_DEPLOY_TARGET_BRANCH` – the branch to deploy (default `main`).
   - `AUTO_DEPLOY_ENV` – selects `app-dev` or `app-prod` inside
     `docker-compose.hosting.yml`.
   - `AUTO_DEPLOY_SERVICE_NAME` – override when you want to deploy a custom
     service name instead of the dev/prod default.
   - `AUTO_DEPLOY_WEBHOOK_SECRET` – shared secret for the GitHub webhook
     signature.
5. Start the service: `docker compose -f docker-compose.autodeploy.yml up -d`.
6. Register a new GitHub webhook that points to
   `https://<host>:${AUTO_DEPLOY_WEBHOOK_PORT}${AUTO_DEPLOY_WEBHOOK_PATH}` and
   reuse the same secret. The container exposes a health probe at `/healthz` for
   monitoring.

When GitHub sends a push event for the selected branch the service performs the
following steps sequentially:

1. Fetch the latest commit and hard-reset the worktree.
2. Run `docker compose -f docker-compose.hosting.yml build <service>`.
3. Run `docker compose -f docker-compose.hosting.yml up -d <service>` to replace
   the running container.

Because deployments are queued, multiple pushes arriving in quick succession are
processed sequentially without overlapping builds. Check the container logs for
the `[deploy]` prefix to inspect the output of the build command.

### Run the combined server without Docker

```bash
pnpm run start:combined
```

This executes `scripts/start-combined-server.mjs` and is helpful when developing
outside of containers. To emulate the Docker behaviour with the reverse proxy
you can instead run:

```bash
pnpm run start:proxy
```

## Members navigation configuration

The sidebar for the members area is configured centrally in
`@/config/members-navigation.ts`. The file exports typed groups and items
(`MembersNavGroup`, `MembersNavItem`) including icon components, permission
keys and optional accessibility helpers such as `ariaLabel` or badges. Dynamic
entries – for example the department todo list or active production shortcuts –
are injected by `selectMembersNavigation` from `@/lib/members-navigation` based
on the user context. When adding new sections, extend the configuration and
consider updating `selectMembersNavigation` plus the accompanying tests in
`src/lib/__tests__/members-navigation.test.ts` so typical roles (finance, only
departments, etc.) remain covered.

## Creating the initial owner account

On a fresh database the application does not contain any users yet. During the
first server startup a one-time setup link is printed to the console, for
example:

```
[owner-setup]   http://localhost:3000/setup/owner/<token>
```

Open the URL in a browser to create the first owner account. The link becomes
invalid as soon as it has been used. Restart the server to generate a new link
whenever you need to add another owner.

After authentication you can browse to
[http://localhost:3000](http://localhost:3000) to explore the site. The landing
page is primarily composed of server components; UI patterns live under
`src/components` and `src/design-system`.
