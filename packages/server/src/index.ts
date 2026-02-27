import { Server, Origins } from 'boardgame.io/server';
import { PostgresStore } from 'bgio-postgres';
import { gameRegistry, prepareGame } from '@noble/bg-engine';
import { initAuthTables, createAuthRoutes, createGate } from './auth/index.js';
import './load-games.js';

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

const origins: (string | RegExp)[] = [Origins.LOCALHOST];
if (process.env.FRONTEND_URL) {
  origins.push(process.env.FRONTEND_URL);
}

const server = Server({
  games: gameRegistry.map((def) => prepareGame(def)),
  origins,
  db,
});

server.app.use(createGate(hasDb, origins));
server.app.use(createAuthRoutes(hasDb, origins));

async function start() {
  if (hasDb) {
    await initAuthTables();
    console.log('[bgf] auth tables initialized');
  }

  server.run(PORT, () => {
    console.log(`[bgf] boardgame.io server listening on http://localhost:${PORT}`);
    console.log(`[bgf] storage: ${db ? 'PostgreSQL' : 'in-memory'}`);
    console.log(`[bgf] auth: ${hasDb ? 'enabled (PostgreSQL)' : 'disabled (no DATABASE_URL)'}`);
    console.log(`[bgf] registered games: ${gameRegistry.map((d) => d.id).join(', ')}`);
  });
}

start().catch((err) => {
  console.error('[bgf] failed to start server:', err);
  process.exit(1);
});
