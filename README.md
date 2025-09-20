# Theater Website

This project contains the Next.js based theater website together with the Socket.IO
realtime server. Both pieces always run inside the same Node.js process and the
realtime API is exposed under `/realtime` (websocket path `/realtime/socket.io`).

## Docker overview

- `Dockerfile.dev` builds the development image that serves the Next.js app via the
  bundled dev server and mounts the realtime routes below `/realtime`.
- `Dockerfile.prod` produces the production image with the statically built Next.js
  output. The runtime launches the combined server so the realtime API stays on
  the same host.

Both images execute `scripts/start-combined-server.mjs`, which prepares Next.js
and attaches the Socket.IO server to the same HTTP listener. The script configures
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
the container.

### Building the production image from source

```bash
docker build -f Dockerfile.prod -t theater-website:prod .

# Run the container (make sure a Postgres instance is reachable)
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/theater_prod?schema=public" \
  -e AUTH_SECRET="replace-me" \
  -e REALTIME_AUTH_TOKEN="replace-me" \
  theater-website:prod
```

Important environment variables:

- `REALTIME_BASE_PATH` (default `/realtime`) controls where the realtime API is
  mounted relative to the web app.
- `REALTIME_PUBLIC_ORIGIN` overrides the public URL when the realtime endpoint
  must use an absolute host instead of the relative `REALTIME_BASE_PATH`.
- `REALTIME_AUTH_TOKEN` and `REALTIME_HANDSHAKE_SECRET` protect the realtime
  handshake and admin events.

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

### Run the combined server without Docker

```bash
pnpm run start:combined
```

This executes `scripts/start-combined-server.mjs` and is helpful when developing
outside of containers.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

:)
