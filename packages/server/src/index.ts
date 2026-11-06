import { Server, Origins } from 'boardgame.io/server';
import { PostgresStore } from 'bgio-postgres';
import { gameRegistry, prepareGame } from '@noble/bg-engine';
import { initAuthTables, createAuthRoutes, createGate } from './auth/index.js';
import { loadExternalGames } from './load-games.js';

const PORT = Number(process.env.PORT) || 8000;
const hasDb = !!process.env.DATABASE_URL;

const db = hasDb
  ? new PostgresStore(process.env.DATABASE_URL!, {
      logging: false,
      dialectOptions: {
        ssl: { rejectUnauthorized: false },
      },
    })
  : undefined;

// FRONTEND_URL: one site, or several separated by commas (one per game client).
const frontendUrls = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const origins: (string | RegExp)[] = [Origins.LOCALHOST, ...frontendUrls];

async function start() {
  await loadExternalGames();

  const server = Server({
    games: gameRegistry.map((def) => prepareGame(def)),
    origins,
    db,
  });
  server.app.use(createGate(hasDb, origins));
  server.app.use(createAuthRoutes(hasDb, origins));

  if (hasDb) {
    await initAuthTables();
    console.log('[bgf] auth tables initialized');
  }

  server.run(PORT, () => {
    console.log(`[bgf] boardgame.io server listening on http://localhost:${PORT}`);
    console.log(`[bgf] allowed sites: ${frontendUrls.join(', ') || '(localhost only)'}`);
    console.log(`[bgf] storage: ${db ? 'PostgreSQL' : 'in-memory'}`);
    console.log(`[bgf] auth: ${hasDb ? 'enabled (PostgreSQL)' : 'disabled (no DATABASE_URL)'}`);
    const ids = gameRegistry.map((d) => d.id);
    console.log(`[bgf] registered games: ${ids.join(', ')}`);
    if (!ids.includes('compile')) {
      console.warn(
        '[bgf] Compile game not registered. From noble-bg-engine root run: npm run build -w packages/server (then restart).'
      );
    }
  });
}

start().catch((err) => {
  console.error('[bgf] failed to start server:', err);
  process.exit(1);
});
