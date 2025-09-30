import http from 'node:http';
import https from 'node:https';
import process from 'node:process';
import { spawn } from 'node:child_process';

function normalizeAbsolutePath(value, fallback) {
  const raw = (value ?? fallback ?? '').trim();
  if (!raw) {
    return fallback ?? '/';
  }

  if (raw === '/') {
    return '/';
  }

  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  const collapsed = prefixed.replace(/\/+/g, '/');
  const trimmed = collapsed.replace(/\/+$/, '');
  return trimmed || '/';
}

function resolveDeployWebhookTarget(defaultPort) {
  const directTarget =
    process.env.DEPLOY_WEBHOOK_TARGET_URL?.trim() ||
    process.env.AUTO_DEPLOY_INTERNAL_URL?.trim() ||
    process.env.AUTO_DEPLOY_PROXY_TARGET?.trim();

  if (directTarget) {
    return directTarget;
  }

  const host =
    process.env.DEPLOY_WEBHOOK_HOST?.trim() ||
    process.env.AUTO_DEPLOY_INTERNAL_HOST?.trim() ||
    process.env.AUTO_DEPLOY_CONTAINER_NAME?.trim();

  if (!host) {
    return null;
  }

  const protocol =
    process.env.DEPLOY_WEBHOOK_PROTOCOL?.trim() ||
    process.env.AUTO_DEPLOY_INTERNAL_PROTOCOL?.trim() ||
    'http';
  const port = parsePort(
    process.env.DEPLOY_WEBHOOK_PORT ??
      process.env.AUTO_DEPLOY_INTERNAL_PORT ??
      process.env.AUTO_DEPLOY_LISTEN_PORT,
    defaultPort,
  );

  return `${protocol}://${host}:${port}`;
}

function createDeployProxyConfig(defaultPort) {
  const target = resolveDeployWebhookTarget(defaultPort);
  if (!target) {
    return null;
  }

  let normalizedTarget;
  try {
    const url = new URL(target);
    normalizedTarget = `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch (error) {
    console.warn('[Proxy] Ignoring invalid deploy webhook target URL', target, error);
    return null;
  }

  const webhookPath = normalizeAbsolutePath(
    process.env.DEPLOY_WEBHOOK_PATH ||
      process.env.AUTO_DEPLOY_PROXY_PATH ||
      process.env.AUTO_DEPLOY_WEBHOOK_PATH,
    '/webhook',
  );

  const pathSet = new Set(['/healthz']);
  pathSet.add(webhookPath);
  if (webhookPath !== '/' && !webhookPath.endsWith('/')) {
    pathSet.add(`${webhookPath}/`);
  }

  const healthPath = webhookPath === '/' ? '/health' : `${webhookPath}/health`;
  pathSet.add(healthPath);
  if (!healthPath.endsWith('/')) {
    pathSet.add(`${healthPath}/`);
  }

  return {
    target: normalizedTarget,
    webhookPath,
    healthPath,
    allowedPaths: pathSet,
  };
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function main() {
  const proxyPort = parsePort(process.env.PORT ?? process.env.PROXY_PORT ?? 3000, 3000);
  const proxyHost =
    process.env.PROXY_HOST?.trim() ||
    process.env.APP_PROXY_HOST?.trim() ||
    process.env.HOST?.trim() ||
    '0.0.0.0';
  const appHost = process.env.APP_HOST?.trim() || process.env.APP_BIND_HOST?.trim() || '127.0.0.1';
  const appPort = parsePort(process.env.APP_SERVER_PORT ?? process.env.APP_PORT ?? proxyPort + 1, proxyPort + 1);

  if (!Number.isFinite(proxyPort) || proxyPort <= 0) {
    throw new Error(`Invalid proxy port: ${process.env.PORT}`);
  }
  if (!Number.isFinite(appPort) || appPort <= 0) {
    throw new Error(`Invalid application port: ${process.env.APP_SERVER_PORT ?? process.env.APP_PORT}`);
  }

  const targetUrl = `http://${appHost}:${appPort}`;
  const childEnv = {
    ...process.env,
    PORT: String(appPort),
    APP_PORT: String(appPort),
    APP_HOST: appHost,
    APP_BIND_HOST: appHost,
  };
  if (!childEnv.REALTIME_INTERNAL_ORIGIN) {
    childEnv.REALTIME_INTERNAL_ORIGIN = targetUrl;
  }

  console.log(`[Proxy] Launching combined application server on ${targetUrl}`);
  const child = spawn(process.execPath, ['scripts/start-combined-server.mjs'], {
    env: childEnv,
    stdio: 'inherit',
  });

  let shuttingDown = false;
  let plannedExitCode = 0;
  let serverClosed = false;
  let childExited = false;

  const defaultDeployPort = parsePort(process.env.AUTO_DEPLOY_LISTEN_PORT, 3000);
  const deployProxyConfig = createDeployProxyConfig(defaultDeployPort);
  if (deployProxyConfig) {
    console.log(
      `[Proxy] Forwarding ${deployProxyConfig.webhookPath} (health: ${deployProxyConfig.healthPath}, /healthz) to ${deployProxyConfig.target}`,
    );
  }

  const server = http.createServer((req, res) => {
    let target = targetUrl;
    if (deployProxyConfig) {
      try {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost');
        if (deployProxyConfig.allowedPaths.has(pathname)) {
          target = deployProxyConfig.target;
        }
      } catch (error) {
        console.warn('[Proxy] Failed to inspect request URL for deploy webhook routing', error);
      }
    }

    forwardHttpRequest(req, res, target, {
      proxyPort,
      shuttingDown: () => shuttingDown,
    });
  });

  const managedConnections = new Set();
  const managedUpstreamSockets = new Set();

  server.on('connection', (socket) => {
    managedConnections.add(socket);
    socket.on('close', () => {
      managedConnections.delete(socket);
    });
  });

  server.on('upgrade', (req, socket, head) => {
    managedConnections.add(socket);
    socket.on('close', () => {
      managedConnections.delete(socket);
    });

    forwardWebSocket(req, socket, head, targetUrl, {
      proxyPort,
      registerUpstream(socket) {
        managedUpstreamSockets.add(socket);
        socket.on('close', () => {
          managedUpstreamSockets.delete(socket);
        });
      },
      onProxyError(error) {
        if (shuttingDown) return;
        console.error('[Proxy] WebSocket proxy error', error);
      },
    });
  });

  server.on('error', (error) => {
    if (shuttingDown) return;
    console.error('[Proxy] HTTP server error', error);
  });

  const markServerClosed = () => {
    serverClosed = true;
    maybeExit();
  };

  server.listen(proxyPort, proxyHost, () => {
    const displayHost = ['0.0.0.0', '::', '::0'].includes(proxyHost) ? '0.0.0.0' : proxyHost;
    console.log(`[Proxy] Listening on http://${displayHost}:${proxyPort} and proxying to ${targetUrl}`);
  });

  function maybeExit() {
    if (serverClosed && childExited) {
      process.exit(plannedExitCode);
    }
  }

  function initiateShutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    plannedExitCode = exitCode;
    console.log(`[Proxy] Received ${signal}, shutting down`);
    server.close(markServerClosed);
    for (const socket of managedConnections) {
      socket.destroy();
    }
    for (const socket of managedUpstreamSockets) {
      socket.destroy();
    }
    if (!child.killed) {
      child.kill(signal);
    }
  }

  process.on('SIGTERM', () => initiateShutdown('SIGTERM', 0));
  process.on('SIGINT', () => initiateShutdown('SIGINT', 0));

  child.on('exit', (code, signal) => {
    childExited = true;
    if (!shuttingDown) {
      plannedExitCode = code ?? (signal ? 1 : 0);
      if (signal) {
        console.error(`[Proxy] Combined server exited unexpectedly due to signal ${signal}`);
      } else {
        console.error(`[Proxy] Combined server exited unexpectedly with code ${plannedExitCode}`);
      }
      shuttingDown = true;
      server.close(markServerClosed);
      for (const socket of managedConnections) {
        socket.destroy();
      }
      for (const socket of managedUpstreamSockets) {
        socket.destroy();
      }
    } else {
      plannedExitCode = code ?? plannedExitCode;
    }
    maybeExit();
  });
}

main().catch((error) => {
  console.error('[Proxy] Fatal error starting reverse proxy', error);
  process.exit(1);
});

function forwardHttpRequest(req, res, baseTarget, options) {
  const upstreamUrl = resolveTargetUrl(baseTarget, req.url ?? '/');
  const transport = selectTransport(upstreamUrl.protocol);
  const requestOptions = {
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port,
    method: req.method,
    path: upstreamUrl.pathname + upstreamUrl.search,
    headers: createProxyHeaders(req, upstreamUrl, {
      proxyPort: options.proxyPort,
      keepConnectionHeader: false,
    }),
  };

  const proxyReq = transport.request(requestOptions, (proxyRes) => {
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    }
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    if (options.shuttingDown()) {
      return;
    }
    console.error('[Proxy] Error while proxying request', error);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    if (!res.writableEnded) {
      res.end('Bad Gateway');
    }
    req.destroy();
  });

  req.on('aborted', () => {
    proxyReq.destroy();
  });

  proxyReq.on('response', () => {
    // Ensure the response stream closes alongside the proxy request.
    res.on('close', () => {
      proxyReq.destroy();
    });
  });

  req.pipe(proxyReq);
}

function forwardWebSocket(req, socket, head, baseTarget, options) {
  const upstreamUrl = resolveTargetUrl(baseTarget, req.url ?? '/');
  const transport = selectTransport(upstreamUrl.protocol);
  const requestOptions = {
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port,
    method: req.method,
    path: upstreamUrl.pathname + upstreamUrl.search,
    headers: createProxyHeaders(req, upstreamUrl, {
      proxyPort: options.proxyPort,
      keepConnectionHeader: true,
    }),
  };

  if (!/upgrade/i.test(requestOptions.headers.connection ?? '')) {
    requestOptions.headers.connection = 'Upgrade';
  }
  if (!requestOptions.headers.upgrade && req.headers.upgrade) {
    requestOptions.headers.upgrade = req.headers.upgrade;
  }

  const proxyReq = transport.request(requestOptions);

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    options.registerUpstream?.(proxySocket);

    proxySocket.on('error', (error) => {
      if (options.onProxyError && !socket.destroyed) {
        options.onProxyError(error);
      }
      socket.destroy();
    });

    socket.on('error', (error) => {
      proxySocket.destroy(error);
    });

    socket.write(formatUpgradeResponse(proxyRes));

    if (proxyHead && proxyHead.length) {
      socket.write(proxyHead);
    }
    if (head && head.length) {
      proxySocket.write(head);
    }

    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.on('response', (proxyRes) => {
    // The upstream declined to upgrade the connection; forward the response.
    socket.write(formatUpgradeResponse(proxyRes));
    proxyRes.on('end', () => {
      socket.end();
    });
    proxyRes.pipe(socket, { end: false });
  });

  proxyReq.on('error', (error) => {
    if (!socket.destroyed) {
      options.onProxyError?.(error);
      socket.destroy();
    }
  });

  proxyReq.end();
}

function resolveTargetUrl(baseTarget, requestUrl) {
  const resolved = new URL(requestUrl, baseTarget);
  if (!resolved.port) {
    resolved.port = resolved.protocol === 'https:' ? '443' : '80';
  }
  return resolved;
}

function selectTransport(protocol) {
  return protocol === 'https:' ? https : http;
}

function createProxyHeaders(req, upstreamUrl, { proxyPort, keepConnectionHeader }) {
  const headers = { ...req.headers };

  if (!keepConnectionHeader) {
    delete headers.connection;
    delete headers['proxy-connection'];
  }

  headers.host = upstreamUrl.host;

  const forwardedFor = getRemoteAddress(req.socket);
  if (forwardedFor) {
    headers['x-forwarded-for'] = headers['x-forwarded-for']
      ? `${headers['x-forwarded-for']}, ${forwardedFor}`
      : forwardedFor;
  }

  const originalHost = req.headers.host;
  if (originalHost) {
    headers['x-forwarded-host'] = originalHost;
  } else if (!headers['x-forwarded-host']) {
    headers['x-forwarded-host'] = upstreamUrl.host;
  }

  const forwardedProto = req.headers['x-forwarded-proto'] ?? 'http';
  headers['x-forwarded-proto'] = forwardedProto;

  const forwardedPort = req.headers['x-forwarded-port'] ?? (proxyPort ? String(proxyPort) : undefined);
  if (forwardedPort) {
    headers['x-forwarded-port'] = forwardedPort;
  }

  return headers;
}

function getRemoteAddress(socket) {
  const address = socket.remoteAddress;
  if (!address) return null;
  if (address.startsWith('::ffff:')) {
    return address.slice(7);
  }
  return address;
}

function formatUpgradeResponse(proxyRes) {
  const statusLine = `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode ?? 500} ${proxyRes.statusMessage ?? ''}`.trimEnd();
  let headerLines = '';
  for (const [name, value] of Object.entries(proxyRes.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headerLines += `${name}: ${entry}\r\n`;
      }
    } else if (typeof value !== 'undefined') {
      headerLines += `${name}: ${value}\r\n`;
    }
  }
  return `${statusLine}\r\n${headerLines}\r\n`;
}
