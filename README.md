# Theater Website

This project contains the Next.js based theater website and a standalone
Socket.IO realtime server. Both services can now be deployed either as
individual containers (see the compose files under `docker-compose*.yml`) or as
a single "monolith" image that exposes the realtime endpoint on the same host as
the web application.

## Combined Docker image

The new `Dockerfile.monolith` builds a production image that bundles the
Next.js app and the realtime server into one container. By default the realtime
API is mounted under `/realtime`, so the browser connects via
`https://<host>/realtime` while the websocket requests continue to use the
standard Socket.IO path (`/realtime/socket.io`).

```bash
# Build the monolith image
docker build -f Dockerfile.monolith -t theater-website:monolith .

# Run the container (make sure a Postgres instance is reachable)
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/theater?schema=public" \
  -e AUTH_SECRET="replace-me" \
  -e REALTIME_AUTH_TOKEN="replace-me" \
  theater-website:monolith
```

Relevant environment variables:

- `REALTIME_BASE_PATH` (default `/realtime`) controls where the realtime API is
  mounted relative to the web app.
- `REALTIME_INTERNAL_ORIGIN` defines how the Next.js process reaches the
  realtime server from inside the container (defaults to
  `http://127.0.0.1:3000`).
- `REALTIME_PUBLIC_ORIGIN` may be set when the realtime endpoint should use an
  absolute public URL instead of the relative `REALTIME_BASE_PATH`.

The container entrypoint runs `pnpm prisma migrate deploy` before starting the
combined server. When running the image without Docker Compose make sure the
database is available before starting the container.

You can also start the combined server locally (without Docker) via:

```bash
pnpm run start:combined
```

This executes `scripts/start-combined-server.mjs`, which shares a single HTTP
server between Next.js and the realtime Socket.IO instance.

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