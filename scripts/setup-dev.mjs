#!/usr/bin/env node
/**
 * Cross-platform dev environment setup.
 * Replaces start-dev.sh with a Node.js script that works on Windows, macOS, and Linux.
 *
 * Usage:
 *   pnpm dev:setup          # Docker mode (default): DB + Mailpit via Docker
 *   pnpm dev:setup --local  # Local mode: no Docker, assumes local Postgres
 *   pnpm dev:start          # Docker mode + start app container
 *   pnpm dev:start --local  # Local mode + start Next.js dev server
 *   pnpm dev:reset          # Reset containers, volumes, node_modules
 *   pnpm dev:clean          # Deep clean (containers, images, volumes, node_modules)
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

const log = {
  header: () => {
    console.log(c('blue', '\n🎭 Theater Website Development Environment'));
    console.log(c('blue', '==========================================\n'));
  },
  info: (msg) => console.log(`${c('green', '➤')} ${msg}`),
  warn: (msg) => console.log(`${c('yellow', '⚠')} ${msg}`),
  error: (msg) => console.error(`${c('red', '✗')} ${msg}`),
};

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: opts.silent ? 'pipe' : 'inherit', cwd: ROOT, ...opts });
}

function runOrFail(cmd, errorMsg) {
  const result = run(cmd);
  if (result.status !== 0) {
    log.error(errorMsg ?? `Command failed: ${cmd}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const MODE = args.includes('--local') ? 'local' : 'docker';
const COMMAND = args.find((a) => !a.startsWith('--')) ?? 'setup';
const PROD = args.includes('--prod') || args.includes('--production');

// ---------------------------------------------------------------------------
// Requirements check
// ---------------------------------------------------------------------------

function checkRequirements() {
  log.info('Checking requirements...');

  const required = [
    { cmd: 'node --version', name: 'Node.js', hint: 'https://nodejs.org' },
    { cmd: 'pnpm --version', name: 'pnpm', hint: 'npm install -g pnpm' },
  ];

  if (MODE === 'docker') {
    required.push(
      { cmd: 'docker --version', name: 'Docker', hint: 'https://docs.docker.com/get-docker/' },
      { cmd: 'docker compose version', name: 'Docker Compose', hint: 'Included with Docker Desktop' },
    );
  }

  for (const { cmd, name, hint } of required) {
    const result = run(cmd, { silent: true });
    if (result.status !== 0) {
      log.error(`${name} is not installed. ${hint}`);
      process.exit(1);
    }
  }

  log.info('All requirements satisfied ✓');
}

// ---------------------------------------------------------------------------
// .env setup
// ---------------------------------------------------------------------------

function generateSecret() {
  return randomBytes(32).toString('base64');
}

function setupEnv() {
  const envFile = join(ROOT, '.env');
  const envExample = join(ROOT, '.env.example');

  if (existsSync(envFile)) {
    log.info('.env file exists ✓');
    return;
  }

  log.warn('.env not found — creating from template...');

  if (!existsSync(envExample)) {
    log.error('.env.example not found. Cannot create .env.');
    process.exit(1);
  }

  copyFileSync(envExample, envFile);

  const authSecret = generateSecret();
  const realtimeToken = generateSecret();
  const cronSecret = generateSecret();

  let content = readFileSync(envFile, 'utf8');

  const replacements = [
    ['change-me-with-a-long-random-string', authSecret],
    [/replace-with-realtime-token/g, realtimeToken],
    ['replace-with-cron-secret', cronSecret],
    ['NEXTAUTH_URL=https://devtheater.beegreenx.de', 'NEXTAUTH_URL=http://localhost:3000'],
    ['NEXT_PUBLIC_BASE_URL=https://devtheater.beegreenx.de', 'NEXT_PUBLIC_BASE_URL=http://localhost:3000'],
    ['CORS_ORIGIN=https://devtheater.beegreenx.de', 'CORS_ORIGIN=http://localhost:3000'],
    ['NEXT_PUBLIC_PWA_ENABLED=0', 'NEXT_PUBLIC_PWA_ENABLED=1'],
  ];

  if (MODE === 'local') {
    replacements.push(
      ['NEXT_PUBLIC_AUTH_DEV_NO_DB=0', 'NEXT_PUBLIC_AUTH_DEV_NO_DB=1'],
      [
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater?schema=public',
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater_dev?schema=public',
      ],
    );
  } else if (PROD) {
    replacements.push(
      ['NEXT_PUBLIC_AUTH_DEV_NO_DB=0', 'NEXT_PUBLIC_AUTH_DEV_NO_DB=0'],
      [
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater?schema=public',
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater_prod?schema=public',
      ],
    );
  } else {
    replacements.push(
      ['NEXT_PUBLIC_AUTH_DEV_NO_DB=0', 'NEXT_PUBLIC_AUTH_DEV_NO_DB=1'],
      [
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater?schema=public',
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theater_dev?schema=public',
      ],
    );
  }

  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to);
  }

  writeFileSync(envFile, content, 'utf8');
  log.info('Created .env with secure random secrets ✓');
  log.warn('Please review .env and adjust settings as needed!');
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

function installDeps() {
  if (!existsSync(join(ROOT, 'node_modules')) || !existsSync(join(ROOT, 'pnpm-lock.yaml'))) {
    log.info('Installing Node.js dependencies...');
    runOrFail('pnpm install', 'pnpm install failed.');
  } else {
    log.info('Dependencies already installed ✓');
  }
}

// ---------------------------------------------------------------------------
// Docker mode
// ---------------------------------------------------------------------------

function startDockerServices() {
  log.info('Starting Docker services (db, mailpit)...');
  runOrFail('docker compose up -d db mailpit', 'Failed to start Docker services.');

  log.info('Waiting for database to be ready...');
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = run('docker compose exec -T db pg_isready -U postgres', { silent: true });
    if (result.status === 0) {
      log.info('Database ready ✓');
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  log.error('Database startup timeout!');
  process.exit(1);
}

function startDockerApp() {
  run('docker compose down', { silent: true });
  log.info('Starting app container (docker compose up --build app)...');
  runOrFail('docker compose up --build app', 'Failed to start app container.');
}

function startDockerProd() {
  run('docker compose -f docker-compose.yml -f docker-compose.hosting.yml down', { silent: true });
  log.info('Building and starting production containers...');
  runOrFail(
    'docker compose -f docker-compose.yml -f docker-compose.hosting.yml up --build -d',
    'Failed to start production containers.',
  );
  log.info('Production environment running at http://localhost:3000 ✓');
  log.info('Logs: docker compose -f docker-compose.yml -f docker-compose.hosting.yml logs -f');
  log.info('Stop: docker compose -f docker-compose.yml -f docker-compose.hosting.yml down');
}

// ---------------------------------------------------------------------------
// Local mode
// ---------------------------------------------------------------------------

function setupPrisma() {
  log.info('Generating Prisma client...');
  runOrFail('pnpm prisma:generate', 'Prisma generate failed.');
  log.info('Running database migrations...');
  runOrFail('pnpm db:migrate', 'Prisma migrate failed.');
}

function startLocalDev() {
  log.info('Starting Next.js dev server...');
  runOrFail('pnpm dev', 'Next.js dev server failed.');
}

// ---------------------------------------------------------------------------
// Reset / clean
// ---------------------------------------------------------------------------

function resetEnv() {
  log.info('Resetting environment (containers + volumes + node_modules + .next)...');
  run('docker compose down -v', { silent: true });
  run('rm -rf node_modules .next', { silent: true });
  run('Remove-Item -Recurse -Force node_modules,.next -ErrorAction SilentlyContinue', { silent: true });
  log.info('Reset complete ✓');
}

function cleanEnv() {
  log.info('Deep cleaning environment...');
  run('docker compose down --volumes --remove-orphans', { silent: true });
  run('docker compose rm -f', { silent: true });
  const images = run('docker compose config --images', { silent: true });
  if (images.status === 0 && images.stdout) {
    const imageList = images.stdout.toString().trim();
    if (imageList) run(`docker image rm ${imageList}`, { silent: true });
  }
  run('rm -rf node_modules .next', { silent: true });
  run('Remove-Item -Recurse -Force node_modules,.next -ErrorAction SilentlyContinue', { silent: true });
  log.info('Deep clean complete ✓');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

log.header();

switch (COMMAND) {
  case 'reset':
    resetEnv();
    break;

  case 'clean':
    cleanEnv();
    break;

  default: {
    checkRequirements();
    setupEnv();
    installDeps();

    if (COMMAND === 'start') {
      if (MODE === 'local') {
        setupPrisma();
        startLocalDev();
      } else if (PROD) {
        startDockerProd();
      } else {
        startDockerServices();
        runOrFail('pnpm prisma:generate', 'Prisma generate failed.');
        startDockerApp();
      }
    } else {
      // setup only
      if (MODE === 'local') {
        setupPrisma();
        log.info('Local setup complete. Run "pnpm dev" to start the dev server.');
      } else {
        startDockerServices();
        runOrFail('pnpm prisma:generate', 'Prisma generate failed.');
        log.info('Docker setup complete. Run "pnpm dev:start" to start the app container.');
      }
    }
    break;
  }
}
